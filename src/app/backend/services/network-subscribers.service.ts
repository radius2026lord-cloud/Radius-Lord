import {randomInt} from 'crypto';
import {readFile} from 'fs/promises';
import path from 'path';
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
function identityImageDirectory(scope:any){return path.join(path.resolve(process.env.IDENTITY_UPLOAD_DIR||'uploads/identity-documents'),String(Number(scope.tenant_id)),String(Number(scope.environment_id)));}
async function decodeIdentityImage(value:any){
 if(value==null||value==='')return null;
 if(typeof value!=='string'||value.length>2_100_000)throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{identityImages:'صورة الهوية أكبر من الحجم المسموح.'}});
 const match=/^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
 if(!match)throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{identityImages:'صيغة صورة الهوية غير مدعومة.'}});
 const bytes=Buffer.from(match[1],'base64');
 if(!bytes.length||bytes.length>1_500_000)throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{identityImages:'يجب ألا يتجاوز حجم كل صورة 1.5 ميغابايت.'}});
 try{const sharp=require('sharp');return await sharp(bytes,{limitInputPixels:8_000_000,failOn:'warning'}).rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();}
 catch{throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{identityImages:'تعذر قراءة صورة الهوية. اختر صورة واضحة بصيغة JPG أو PNG أو WebP.'}});}
}
const latinDigits=(value:string)=>value.replace(/[٠-٩۰-۹]/g,digit=>String("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹".indexOf(digit)%10));
function normalizeNationalNumber(value:any){
 const raw=text(value,50,'identityDocument',true)!;
 const normalized=latinDigits(raw).replace(/[\s-]/g,'');
 if(!/^\d{11}$/.test(normalized))throw new Error('SUBSCRIBER_NATIONAL_NUMBER_INVALID');
 return normalized;
}
async function ensureNationalNumberAvailable(app:any,nationalNumber:string,exceptCustomerId?:number){
 const [rows]:any=await app.query(`SELECT customer_id FROM customer_identity_documents WHERE national_number=? ${exceptCustomerId?'AND customer_id<>?':''} LIMIT 1 FOR UPDATE`,exceptCustomerId?[nationalNumber,exceptCustomerId]:[nationalNumber]);
 if(rows[0])throw new Error('SUBSCRIBER_NATIONAL_NUMBER_EXISTS');
}
async function ensureCustomerPhoneAvailable(app:any,phone:string){
 const [rows]:any=await app.query('SELECT id FROM customers WHERE phone=? LIMIT 1 FOR UPDATE',[phone]);
 if(rows[0])throw new Error('SUBSCRIBER_PHONE_EXISTS');
}
function splitBirthPlaceDate(value:any){
 const raw=String(value??'').trim();
 const normalized=latinDigits(raw);
 const match=/(\d{1,4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,4})/.exec(normalized);
 if(!match)return {birthPlace:raw||null,birthDate:null};
 const parts=match.slice(1).map(Number);
 const year=match[1].length===4?parts[0]:parts[2];
 const month=parts[1];
 const day=match[1].length===4?parts[2]:parts[0];
 const date=new Date(Date.UTC(year,month-1,day));
 const valid=year>=1900&&year<=new Date().getUTCFullYear()&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
 const birthPlace=raw.replace(match[0],'').replace(/^[\s#,:;،.\-/]+|[\s#,:;،.\-/]+$/g,'').trim();
 return {birthPlace:birthPlace||null,birthDate:valid?`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`:null};
}

export async function readNetworkSubscribers(scope:any){
 return withNetwork(scope,async app=>{
  const access=await managerAccess(app,scope.managerId,scope.authVersion),managerId=ownerId(access),principal=access.role==='principal';
  if(!principal&&!access.permissions.includes('customers.view'))throw new Error('NETWORK_AUTH');
  const where=principal?'':'WHERE c.manager_id=?',params=principal?[]:[managerId];
  const [items]:any=await app.query(`SELECT c.id,c.manager_id,c.first_name,c.last_name,c.phone,c.address,c.latitude,c.longitude,c.notes,c.status,c.created_at,
    EXISTS(SELECT 1 FROM customer_identity_documents d WHERE d.customer_id=c.id AND d.capture_method='qr') identity_verified,
    (SELECT COUNT(*) FROM pppoe_accounts p WHERE p.customer_id=c.id AND p.archived_at IS NULL) pppoe_count,
    (SELECT COUNT(*) FROM hotspot_standalone_cards sc JOIN hotspot_accounts h ON h.id=sc.account_id WHERE sc.customer_id=c.id AND h.archived_at IS NULL) hotspot_count,
    (SELECT GROUP_CONCAT(cat.name ORDER BY cat.name SEPARATOR '، ') FROM customer_category_memberships m JOIN customer_categories cat ON cat.id=m.category_id WHERE m.customer_id=c.id AND cat.archived_at IS NULL) categories,
    (SELECT GROUP_CONCAT(DISTINCT m.category_id ORDER BY m.category_id SEPARATOR ',') FROM customer_category_memberships m JOIN customer_categories cat ON cat.id=m.category_id WHERE m.customer_id=c.id AND cat.archived_at IS NULL) category_ids,
    EXISTS(SELECT 1 FROM radacct ra JOIN radius_identities r ON r.current_username=ra.username WHERE ra.acctstoptime IS NULL AND ((EXISTS(SELECT 1 FROM pppoe_accounts p WHERE p.customer_id=c.id AND p.radius_identity_id=r.id AND p.archived_at IS NULL) OR EXISTS(SELECT 1 FROM hotspot_standalone_cards sc JOIN hotspot_accounts h ON h.id=sc.account_id WHERE sc.customer_id=c.id AND h.radius_identity_id=r.id AND h.archived_at IS NULL))) is_online,
    (EXISTS(SELECT 1 FROM pppoe_accounts p WHERE p.customer_id=c.id AND p.archived_at IS NULL AND EXISTS(SELECT 1 FROM pppoe_subscriptions ended WHERE ended.account_id=p.id AND ended.lifecycle='ended') AND NOT EXISTS(SELECT 1 FROM pppoe_subscriptions live WHERE live.account_id=p.id AND live.lifecycle IN('pending','active')))
      OR EXISTS(SELECT 1 FROM hotspot_standalone_cards sc JOIN hotspot_accounts h ON h.id=sc.account_id WHERE sc.customer_id=c.id AND h.archived_at IS NULL AND EXISTS(SELECT 1 FROM hotspot_service_periods ended WHERE ended.account_id=h.id AND ended.lifecycle='ended') AND NOT EXISTS(SELECT 1 FROM hotspot_service_periods live WHERE live.account_id=h.id AND live.lifecycle IN('pending','active')))) has_expired_subscription,
    (SELECT GROUP_CONCAT(DISTINCT ra.nasipaddress ORDER BY ra.nasipaddress SEPARATOR ',') FROM radacct ra JOIN radius_identities r ON r.current_username=ra.username WHERE ra.nasipaddress<>'' AND (EXISTS(SELECT 1 FROM pppoe_accounts p WHERE p.customer_id=c.id AND p.radius_identity_id=r.id AND p.archived_at IS NULL) OR EXISTS(SELECT 1 FROM hotspot_standalone_cards sc JOIN hotspot_accounts h ON h.id=sc.account_id WHERE sc.customer_id=c.id AND h.radius_identity_id=r.id AND h.archived_at IS NULL))) server_addresses
   FROM customers c ${where} ORDER BY c.id DESC LIMIT 500`,params);
  const [categories]:any=await app.query(`SELECT c.id,c.name FROM customer_categories c JOIN customer_category_manager_assignments a ON a.category_id=c.id
   WHERE a.manager_id=? AND c.archived_at IS NULL ORDER BY c.name,c.id`,[managerId]);
  const linkedCustomerScope=principal?'':'AND c.manager_id=?';
  const [servers]:any=await app.query(`SELECT DISTINCT ra.nasipaddress address,COALESCE(NULLIF(l.name,''),NULLIF(n.shortname,''),NULLIF(n.nasname,''),ra.nasipaddress) name
   FROM radacct ra JOIN radius_identities r ON r.current_username=ra.username
   LEFT JOIN nas n ON n.nasname=ra.nasipaddress
   LEFT JOIN lord_nas l ON l.radius_nas_id=n.id AND l.archived_at IS NULL
   WHERE ra.nasipaddress<>'' AND EXISTS(
    SELECT 1 FROM (
     SELECT p.radius_identity_id,p.customer_id FROM pppoe_accounts p WHERE p.archived_at IS NULL
     UNION ALL
     SELECT h.radius_identity_id,sc.customer_id FROM hotspot_standalone_cards sc JOIN hotspot_accounts h ON h.id=sc.account_id WHERE h.archived_at IS NULL
    ) linked JOIN customers c ON c.id=linked.customer_id WHERE linked.radius_identity_id=r.id AND c.archived_at IS NULL ${linkedCustomerScope}
   ) ORDER BY name,address`,principal?[]:[managerId]);
  const [owners]:any=await app.query('SELECT full_name FROM managers WHERE id=?',[managerId]);
  return {items,categories,servers,owner:{id:managerId,name:owners[0]?.full_name||access.manager.full_name,role:access.role}};
 });
}


export async function suggestNetworkSubscriberData(scope:any,input:any){
 return withNetwork(scope,async app=>{
  const access=await managerAccess(app,scope.managerId,scope.authVersion),managerId=ownerId(access),principal=access.role==='principal';
  if(!principal&&!access.permissions.includes('customers.view'))throw new Error('NETWORK_AUTH');
  const field=String(input.field||''),column=field==='firstName'?'first_name':field==='lastName'?'last_name':null;
  if(!column&&field!=='address')throw Object.assign(new Error('SUBSCRIBER_SUGGESTION_INPUT'),{fields:{field:'نوع الاقتراح غير صالح.'}});
  const query=String(input.q||'').trim().slice(0,120);
  if(query.length<2)return {items:[]};
  const escaped=query.replace(/[!%_]/g,char=>'!'+char)+'%';
  const scopeSql=principal?'':'manager_id=? AND ';
  const params=principal?[escaped]:[managerId,escaped];
  if(field==='address'){
   const [rows]:any=await app.query(`SELECT address AS value FROM customer_address_suggestions WHERE ${scopeSql}address LIKE ? ESCAPE '!' ORDER BY address LIMIT 10`,params);
   return {items:rows.map((row:any)=>String(row.value))};
  }
  const [rows]:any=await app.query(`SELECT DISTINCT ${column} AS value FROM customers WHERE ${scopeSql}archived_at IS NULL AND ${column} LIKE ? ESCAPE '!' ORDER BY ${column} LIMIT 10`,params);
  return {items:rows.map((row:any)=>String(row.value))};
 });
}

export async function createNetworkSubscriber(scope:any,input:any){
 return withNetwork(scope,async app=>{
  const access=await managerAccess(app,scope.managerId,scope.authVersion),managerId=ownerId(access);
  if(access.role!=='principal'&&!access.permissions.includes('customers.create'))throw new Error('NETWORK_AUTH');
  const firstName=text(input.firstName,100,'firstName',true)!,lastName=text(input.lastName,100,'lastName',true)!;
  const entryMode=String(input.entryMode??'manual');
  if(!['manual','identity'].includes(entryMode))throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{entryMode:'اختر طريقة إدخال صالحة.'}});
  const isIdentityEntry=entryMode==='identity';
  const phone=isIdentityEntry?text(input.phone,15,'phone',true):null;
  if(phone&&!/^[0-9]{1,15}$/.test(phone))throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{phone:'أدخل أرقام الهاتف فقط وبحد أقصى 15 رقمًا.'}});
  const address=isIdentityEntry?text(input.address,10000,'address',true):null,notes=text(input.notes,10000,'notes');
  const identityInput=isIdentityEntry&&input.identityDocument&&typeof input.identityDocument==='object'?input.identityDocument:null;
  const identityDocument=identityInput?.captureMethod==='qr'?{
   fatherName:text(identityInput.fatherName,100,'fatherName'),
   motherName:text(identityInput.motherName,100,'motherName'),
   birthPlaceDate:text(identityInput.birthPlaceDate,160,'birthPlaceDate'),
   nationalNumber:normalizeNationalNumber(identityInput.nationalNumber),
  }:null;
  if(isIdentityEntry&&!identityDocument)throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{identityDocument:'اقرأ باركود الهوية قبل حفظ الملف.'}});
  const latitude=coord(input.latitude,-90,90,'latitude'),longitude=coord(input.longitude,-180,180,'longitude');
  if((latitude===null)!==(longitude===null))throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{latitude:'أدخل خطي العرض والطول معًا.'}});
  const status=String(input.status??'active');
  if(!['active','suspended'].includes(status))throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{status:'اختر حالة صحيحة.'}});
  const categoryId=input.categoryId==null||input.categoryId===''?null:Number(input.categoryId);
  if(categoryId===null)throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{categoryId:'اختر تصنيفًا لإتمام حفظ المشترك.'}});
  if(!Number.isSafeInteger(categoryId)||categoryId<1)throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{categoryId:'اختر تصنيفًا صالحًا.'}});
  const uploadedIdentityImages=isIdentityEntry&&identityDocument?{
   front:await decodeIdentityImage(input.identityImages?.front),
   back:await decodeIdentityImage(input.identityImages?.back),
  }:null;
  await app.beginTransaction();
  try{
   if(identityDocument)await ensureNationalNumberAvailable(app,identityDocument.nationalNumber);
   if(categoryId!==null){
    const [allowed]:any=await app.query(`SELECT c.id FROM customer_categories c JOIN customer_category_manager_assignments a ON a.category_id=c.id
     WHERE c.id=? AND c.archived_at IS NULL AND a.manager_id=? FOR UPDATE`,[categoryId,managerId]);
    if(!allowed[0])throw new Error('SUBSCRIBER_CATEGORY_UNAVAILABLE');
   }
   if(phone)await ensureCustomerPhoneAvailable(app,phone);
   let created:any=null,code='';
   for(let attempt=0;attempt<8;attempt++){
    code=paymentCode();
    try{
     [created]=await app.query(`INSERT INTO customers(manager_id,first_name,last_name,phone,address,latitude,longitude,notes,payment_code,created_by_manager_id,status)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`,[managerId,firstName,lastName,phone,address,latitude,longitude,notes,code,scope.managerId,status]);
     break;
    }catch(e:any){
     if(e?.code==='ER_DUP_ENTRY'&&String(e?.message||'').includes('uq_customer_phone'))throw new Error('SUBSCRIBER_PHONE_EXISTS');
     if(e?.code!=='ER_DUP_ENTRY'||attempt===7)throw e;
    }
   }
   const id=Number(created.insertId);
   if(identityDocument){
    const {birthPlace,birthDate}=splitBirthPlaceDate(identityDocument.birthPlaceDate);
    await app.query(`INSERT INTO customer_identity_documents(customer_id,first_name,last_name,father_name,mother_name,birth_place,birth_date,national_number,front_image_data,back_image_data,capture_method,updated_by_manager_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,'qr',?)`,[id,firstName,lastName,identityDocument.fatherName,identityDocument.motherName,birthPlace,birthDate,identityDocument.nationalNumber,uploadedIdentityImages?.front||null,uploadedIdentityImages?.back||null,scope.managerId]);
   }
   if(address)await app.query(`INSERT INTO customer_address_suggestions(manager_id,address,address_hash)
    VALUES(?,?,UNHEX(SHA2(LOWER(TRIM(?)),256)))
    ON DUPLICATE KEY UPDATE address=VALUES(address),last_used_at=CURRENT_TIMESTAMP`,[managerId,address,address]);
   if(categoryId!==null)await app.query('INSERT INTO customer_category_memberships(customer_id,category_id,manager_id,assigned_by_manager_id) VALUES(?,?,?,?)',[id,categoryId,managerId,scope.managerId]);
   const snapshot=JSON.stringify({id:scope.managerId,full_name:access.manager.full_name,role:access.role});
   const after=JSON.stringify({managerId,firstName,lastName,phone,address,latitude,longitude,notes,status,categoryId,paymentCode:code,identityVerified:Boolean(identityDocument)});
   await app.query(`INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,customer_id,after_data,result)
    VALUES(?,?,'manager','subscribers.create','customer',?,?,?,'success')`,[scope.managerId,snapshot,id,id,after]);
   await app.commit();
   return {success:true,item:{id,manager_id:managerId,first_name:firstName,last_name:lastName,phone,address,latitude,longitude,notes,status,created_at:new Date().toISOString(),pppoe_count:0,hotspot_count:0,categories:categoryId?null:null,payment_code:code,identity_verified:Boolean(identityDocument)}};
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

export async function verifyNetworkSubscriberIdentity(scope:any,input:any){
 return withNetwork(scope,async app=>{
  const access=await managerAccess(app,scope.managerId,scope.authVersion),managerId=ownerId(access);
  if(access.role!=='principal'&&!access.permissions.includes('customers.update'))throw new Error('NETWORK_AUTH');
  const id=Number(input.id);
  if(!Number.isSafeInteger(id)||id<1)throw new Error('SUBSCRIBER_INPUT');
  const raw=input.identityDocument&&typeof input.identityDocument==='object'?input.identityDocument:null;
  if(raw?.captureMethod!=='qr')throw Object.assign(new Error('SUBSCRIBER_INPUT'),{fields:{identityDocument:'اقرأ باركود الهوية قبل تأكيد التوثيق.'}});
  const firstName=text(input.firstName,100,'firstName',true)!,lastName=text(input.lastName,100,'lastName',true)!;
  const identityDocument={
   fatherName:text(raw.fatherName,100,'fatherName'),
   motherName:text(raw.motherName,100,'motherName'),
   birthPlaceDate:text(raw.birthPlaceDate,160,'birthPlaceDate'),
   nationalNumber:normalizeNationalNumber(raw.nationalNumber),
  };
  const uploadedIdentityImages={
   front:await decodeIdentityImage(input.identityImages?.front),
   back:await decodeIdentityImage(input.identityImages?.back),
  };
  await app.beginTransaction();
  try{
   const [customers]:any=await app.query(`SELECT id,manager_id,first_name,last_name FROM customers WHERE id=? AND archived_at IS NULL ${access.role==='principal'?'':'AND manager_id=?'} FOR UPDATE`,access.role==='principal'?[id]:[id,managerId]);
   const customer=customers[0];if(!customer)throw new Error('SUBSCRIBER_NOT_FOUND');
   await ensureNationalNumberAvailable(app,identityDocument.nationalNumber,id);
   const {birthPlace,birthDate}=splitBirthPlaceDate(identityDocument.birthPlaceDate);
   const [existingIdentity]:any=await app.query('SELECT customer_id FROM customer_identity_documents WHERE customer_id=? FOR UPDATE',[id]);
   if(existingIdentity[0]){
    await app.query(`UPDATE customer_identity_documents SET first_name=?,last_name=?,father_name=?,mother_name=?,birth_place=?,birth_date=?,national_number=?,front_image_data=COALESCE(?,front_image_data),back_image_data=COALESCE(?,back_image_data),capture_method='qr',updated_by_manager_id=? WHERE customer_id=?`,
     [firstName,lastName,identityDocument.fatherName,identityDocument.motherName,birthPlace,birthDate,identityDocument.nationalNumber,uploadedIdentityImages.front,uploadedIdentityImages.back,scope.managerId,id]);
   }else{
    await app.query(`INSERT INTO customer_identity_documents(customer_id,first_name,last_name,father_name,mother_name,birth_place,birth_date,national_number,front_image_data,back_image_data,capture_method,updated_by_manager_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,'qr',?)`,[id,firstName,lastName,identityDocument.fatherName,identityDocument.motherName,birthPlace,birthDate,identityDocument.nationalNumber,uploadedIdentityImages.front,uploadedIdentityImages.back,scope.managerId]);
   }
   const snapshot=JSON.stringify({id:scope.managerId,full_name:access.manager.full_name,role:access.role});
   const after=JSON.stringify({identityVerified:true,nationalNumber:identityDocument.nationalNumber,frontImage:Boolean(uploadedIdentityImages.front),backImage:Boolean(uploadedIdentityImages.back)});
   await app.query(`INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,customer_id,after_data,result)
    VALUES(?,?,'manager','subscribers.identity.verify','customer',?,?,?,'success')`,[scope.managerId,snapshot,id,id,after]);
   await app.commit();return {success:true};
  }catch(error){await app.rollback();throw error;}
 });
}


export async function readNetworkSubscriberDetail(scope:any,value:any){
 return withNetwork(scope,async app=>{
  const access=await managerAccess(app,scope.managerId,scope.authVersion),managerId=ownerId(access),principal=access.role==='principal';
  if(!principal&&!access.permissions.includes('customers.view'))throw new Error('NETWORK_AUTH');
  const id=Number(value);
  if(!Number.isSafeInteger(id)||id<1)throw new Error('SUBSCRIBER_INPUT');
  const [customers]:any=await app.query(`SELECT c.id,c.manager_id,c.first_name,c.last_name,c.phone,c.address,c.notes,c.payment_code,c.status,c.created_at,m.full_name manager_name,
    EXISTS(SELECT 1 FROM customer_identity_documents d WHERE d.customer_id=c.id AND d.capture_method='qr') identity_verified,
    EXISTS(SELECT 1 FROM customer_identity_documents d WHERE d.customer_id=c.id AND (d.front_image_data IS NOT NULL OR d.front_image_reference IS NOT NULL)) identity_front_image,
    EXISTS(SELECT 1 FROM customer_identity_documents d WHERE d.customer_id=c.id AND (d.back_image_data IS NOT NULL OR d.back_image_reference IS NOT NULL)) identity_back_image,
    (SELECT GROUP_CONCAT(cat.name ORDER BY cat.name SEPARATOR '، ') FROM customer_category_memberships x JOIN customer_categories cat ON cat.id=x.category_id WHERE x.customer_id=c.id AND cat.archived_at IS NULL) categories
   FROM customers c LEFT JOIN managers m ON m.id=c.manager_id
   WHERE c.id=? AND c.archived_at IS NULL ${principal?'':'AND c.manager_id=?'} LIMIT 1`,principal?[id]:[id,managerId]);
  const customer=customers[0];if(!customer)throw new Error('SUBSCRIBER_NOT_FOUND');
  const [[pppoe],[hotspot]]:any=await Promise.all([
   app.query(`SELECT p.id,r.current_username username,p.line_name,COALESCE(p.admin_status,'enabled') status,
    (SELECT rg.groupname FROM radusergroup rg WHERE rg.username=r.current_username ORDER BY rg.priority,rg.id LIMIT 1) service_name,
    COALESCE(u.upload_bytes,0) upload_bytes,COALESCE(u.download_bytes,0) download_bytes,
    (SELECT COUNT(*) FROM radacct ra WHERE ra.username=r.current_username AND ra.acctstoptime IS NULL) live_sessions,
    (SELECT MAX(ra.acctupdatetime) FROM radacct ra WHERE ra.username=r.current_username AND ra.acctstoptime IS NULL) last_seen,
    (SELECT ra.framedipaddress FROM radacct ra WHERE ra.username=r.current_username AND ra.acctstoptime IS NULL ORDER BY ra.acctupdatetime DESC,ra.radacctid DESC LIMIT 1) framed_ip,
    (SELECT ra.callingstationid FROM radacct ra WHERE ra.username=r.current_username AND ra.acctstoptime IS NULL ORDER BY ra.acctupdatetime DESC,ra.radacctid DESC LIMIT 1) calling_station,
    (SELECT ra.nasipaddress FROM radacct ra WHERE ra.username=r.current_username AND ra.acctstoptime IS NULL ORDER BY ra.acctupdatetime DESC,ra.radacctid DESC LIMIT 1) nas_ip
    FROM pppoe_accounts p JOIN radius_identities r ON r.id=p.radius_identity_id
    LEFT JOIN (SELECT username,SUM(acctinputoctets) upload_bytes,SUM(acctoutputoctets) download_bytes FROM radacct GROUP BY username) u ON u.username=r.current_username
    WHERE p.customer_id=? AND p.archived_at IS NULL AND p.admin_status='enabled' ORDER BY p.id DESC`,[id]),
   app.query(`SELECT a.id,r.current_username username,a.status status,p.name service_name,sp.lifecycle,
    COALESCE(u.upload_bytes,0) upload_bytes,COALESCE(u.download_bytes,0) download_bytes,
    (SELECT COUNT(*) FROM radacct ra WHERE ra.username=r.current_username AND ra.acctstoptime IS NULL) live_sessions,
    (SELECT MAX(ra.acctupdatetime) FROM radacct ra WHERE ra.username=r.current_username AND ra.acctstoptime IS NULL) last_seen,
    (SELECT ra.framedipaddress FROM radacct ra WHERE ra.username=r.current_username AND ra.acctstoptime IS NULL ORDER BY ra.acctupdatetime DESC,ra.radacctid DESC LIMIT 1) framed_ip,
    (SELECT ra.callingstationid FROM radacct ra WHERE ra.username=r.current_username AND ra.acctstoptime IS NULL ORDER BY ra.acctupdatetime DESC,ra.radacctid DESC LIMIT 1) calling_station,
    (SELECT ra.nasipaddress FROM radacct ra WHERE ra.username=r.current_username AND ra.acctstoptime IS NULL ORDER BY ra.acctupdatetime DESC,ra.radacctid DESC LIMIT 1) nas_ip
    FROM hotspot_accounts a JOIN hotspot_standalone_cards sc ON sc.account_id=a.id
    JOIN radius_identities r ON r.id=a.radius_identity_id
    LEFT JOIN hotspot_service_periods sp ON sp.live_account_id=a.id
    LEFT JOIN hotspot_package_versions v ON v.id=sp.package_version_id
    LEFT JOIN hotspot_packages p ON p.id=v.package_id
    LEFT JOIN hotspot_period_usage u ON u.period_id=sp.id
    WHERE sc.customer_id=? AND a.archived_at IS NULL AND a.status='enabled' ORDER BY a.id DESC`,[id])
  ]);
  const accounts=[...pppoe.map((x:any)=>({...x,kind:'pppoe'})),...hotspot.map((x:any)=>({...x,kind:'hotspot'}))];
  return {item:customer,accounts};
 });
}

export async function readNetworkSubscriberIdentityImage(scope:any,value:any,side:any){
 return withNetwork(scope,async app=>{
  const access=await managerAccess(app,scope.managerId,scope.authVersion),managerId=ownerId(access),principal=access.role==='principal';
  if(!principal&&!access.permissions.includes('customers.view'))throw new Error('NETWORK_AUTH');
  const id=Number(value);if(!Number.isSafeInteger(id)||id<1||!['front','back'].includes(String(side)))throw new Error('SUBSCRIBER_INPUT');
  const dataColumn=side==='front'?'front_image_data':'back_image_data';
  const referenceColumn=side==='front'?'front_image_reference':'back_image_reference';
  const [rows]:any=await app.query(`SELECT d.${dataColumn} image_data,d.${referenceColumn} image_reference FROM customer_identity_documents d JOIN customers c ON c.id=d.customer_id WHERE c.id=? AND c.archived_at IS NULL ${principal?'':'AND c.manager_id=?'} LIMIT 1`,principal?[id]:[id,managerId]);
  if(Buffer.isBuffer(rows[0]?.image_data))return rows[0].image_data as Buffer;
  const name=rows[0]?.image_reference;if(typeof name==='string'&&/^[a-f0-9-]{36}\.webp$/.test(name))return readFile(path.join(identityImageDirectory(scope),name));
  throw new Error('SUBSCRIBER_IMAGE_NOT_FOUND');
 });
}
