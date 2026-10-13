import {randomInt} from 'crypto';
import {withNetwork} from './network-runtime.service';
import {managerAccess} from './network-manager-access.service';

const ownerId=(access:any)=>{
 const value=access.role==='agent_employee'?Number(access.manager.parent_agent_manager_id):Number(access.manager.id);
 if(!Number.isSafeInteger(value)||value<1)throw new Error('NETWORK_AUTH');
 return value;
};
const text=(value:any,max:number,field:string,required=false)=>{
 const result=String(value??'').trim();
 if(required&&!result)throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{[field]:'هذا الحقل مطلوب.'}});
 if(result.length>max)throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{[field]:'القيمة أطول من المسموح.'}});
 return result||null;
};
const coord=(value:any,low:number,high:number,field:string)=>{
 if(value===null||value===undefined||value==='')return null;
 const n=Number(value);
 if(!Number.isFinite(n)||n<low||n>high)throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{[field]:'قيمة الموقع غير صالحة.'}});
 return n;
};
function paymentCode(){return 'C'+String(randomInt(0,10000000000)).padStart(10,'0');}

export async function readNetworkSubscribers(scope:any){
 return withNetwork(scope,async app=>{
  const access=await managerAccess(app,scope.managerId,scope.authVersion),managerId=ownerId(access),principal=access.role==='principal';
  if(!principal&&!access.permissions.includes('customers.view'))throw new Error('NETWORK_AUTH');
  const where=principal?'':'WHERE c.manager_id=?',params=principal?[]:[managerId];
  const [items]:any=await app.query(`SELECT c.id,c.manager_id,c.first_name,c.last_name,c.phone,c.address,c.latitude,c.longitude,c.notes,c.status,c.created_at,
    (SELECT COUNT(*) FROM pppoe_accounts p WHERE p.customer_id=c.id AND p.archived_at IS NULL) pppoe_count,
    (SELECT COUNT(*) FROM hotspot_standalone_cards sc JOIN hotspot_accounts h ON h.id=sc.account_id WHERE sc.customer_id=c.id AND h.archived_at IS NULL) hotspot_count,
    (SELECT GROUP_CONCAT(cat.name ORDER BY cat.name SEPARATOR '، ') FROM customer_category_memberships m JOIN customer_categories cat ON cat.id=m.category_id WHERE m.customer_id=c.id AND cat.archived_at IS NULL) categories
   FROM customers c ${where} ORDER BY c.id DESC LIMIT 500`,params);
  const [categories]:any=await app.query(`SELECT c.id,c.name FROM customer_categories c JOIN customer_category_manager_assignments a ON a.category_id=c.id
   WHERE a.manager_id=? AND c.archived_at IS NULL ORDER BY c.name,c.id`,[managerId]);
  const [owners]:any=await app.query('SELECT full_name FROM managers WHERE id=?',[managerId]);
  return {items,categories,owner:{id:managerId,name:owners[0]?.full_name||access.manager.full_name,role:access.role}};
 });
}

export async function createNetworkSubscriber(scope:any,input:any){
 return withNetwork(scope,async app=>{
  const access=await managerAccess(app,scope.managerId,scope.authVersion),managerId=ownerId(access);
  if(access.role!=='principal'&&!access.permissions.includes('customers.create'))throw new Error('NETWORK_AUTH');
  const firstName=text(input.firstName,100,'firstName',true)!,lastName=text(input.lastName,100,'lastName',true)!;
  const phone=text(input.phone,40,'phone',true),address=text(input.address,10000,'address',true),notes=text(input.notes,10000,'notes');
  const latitude=coord(input.latitude,-90,90,'latitude'),longitude=coord(input.longitude,-180,180,'longitude');
  if((latitude===null)!==(longitude===null))throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{latitude:'أدخل خطي العرض والطول معًا.'}});
  const status=String(input.status??'active');
  if(!['active','suspended'].includes(status))throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{status:'اختر حالة صحيحة.'}});
  const categoryId=input.categoryId==null||input.categoryId===''?null:Number(input.categoryId);
  if(categoryId!==null&&(!Number.isSafeInteger(categoryId)||categoryId<1))throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{categoryId:'اختر تصنيفًا صالحًا.'}});
  await app.beginTransaction();
  try{
   if(categoryId!==null){
    const [allowed]:any=await app.query(`SELECT c.id FROM customer_categories c JOIN customer_category_manager_assignments a ON a.category_id=c.id
     WHERE c.id=? AND c.archived_at IS NULL AND a.manager_id=? FOR UPDATE`,[categoryId,managerId]);
    if(!allowed[0])throw new Error('SUBSCRIBER_CATEGORY_UNAVAILABLE');
   }
   let created:any=null,code='';
   for(let attempt=0;attempt<8;attempt++){
    code=paymentCode();
    try{
     [created]=await app.query(`INSERT INTO customers(manager_id,first_name,last_name,phone,address,latitude,longitude,notes,payment_code,created_by_manager_id,status)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`,[managerId,firstName,lastName,phone,address,latitude,longitude,notes,code,scope.managerId,status]);
     break;
    }catch(e:any){if(e?.code!=='ER_DUP_ENTRY'||attempt===7)throw e;}
   }
   const id=Number(created.insertId);
   if(categoryId!==null)await app.query('INSERT INTO customer_category_memberships(customer_id,category_id,manager_id,assigned_by_manager_id) VALUES(?,?,?,?)',[id,categoryId,managerId,scope.managerId]);
   const snapshot=JSON.stringify({id:scope.managerId,full_name:access.manager.full_name,role:access.role});
   const after=JSON.stringify({managerId,firstName,lastName,phone,address,latitude,longitude,notes,status,categoryId,paymentCode:code});
   await app.query(`INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,customer_id,after_data,result)
    VALUES(?,?,'manager','subscribers.create','customer',?,?,?,'success')`,[scope.managerId,snapshot,id,id,after]);
   await app.commit();
   return {success:true,item:{id,manager_id:managerId,first_name:firstName,last_name:lastName,phone,address,latitude,longitude,notes,status,created_at:new Date().toISOString(),pppoe_count:0,hotspot_count:0,categories:categoryId?null:null,payment_code:code}};
  }catch(error){
   await app.rollback();
   try{await app.query(`INSERT INTO activity_log(actor_manager_id,actor_kind,action_code,target_type,result,failure_code)
    VALUES(?,'manager','subscribers.create','customer','failed','SUBSCRIBER_CREATE_REJECTED')`,[scope.managerId]);}catch{}
   throw error;
  }
 });
}

export async function setNetworkSubscriberStatus(scope:any,input:any){
 return withNetwork(scope,async app=>{
  const access=await managerAccess(app,scope.managerId,scope.authVersion),managerId=ownerId(access);
  if(access.role!=='principal'&&!access.permissions.includes('customers.update'))throw new Error('NETWORK_AUTH');
  const id=Number(input.id),status=String(input.status);
  if(!Number.isSafeInteger(id)||id<1||!['active','suspended'].includes(status))throw new Error('SUBSCRIBER_INPUT');
  await app.beginTransaction();
  try{
   const [rows]:any=await app.query(`SELECT id,manager_id,status,first_name,last_name FROM customers WHERE id=? AND archived_at IS NULL ${access.role==='principal'?'':'AND manager_id=?'} FOR UPDATE`,access.role==='principal'?[id]:[id,managerId]);
   const row=rows[0];if(!row)throw new Error('SUBSCRIBER_NOT_FOUND');
   if(row.status!==status){
    await app.query('UPDATE customers SET status=? WHERE id=?',[status,id]);
    await app.query(`INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,customer_id,before_data,after_data,result)
     VALUES(?,?,'manager','subscribers.status','customer',?,?,?,?, 'success')`,[scope.managerId,JSON.stringify({id:scope.managerId,full_name:access.manager.full_name,role:access.role}),id,id,JSON.stringify({status:row.status}),JSON.stringify({status})]);
   }
   await app.commit();return {success:true};
  }catch(error){await app.rollback();throw error;}
 });
}
