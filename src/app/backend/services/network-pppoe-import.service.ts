import {randomInt} from 'crypto';
import {withNetwork} from './network-runtime.service';
import {managerAccess} from './network-manager-access.service';
import {encryptProvisioningSecret,provisioningKey} from './provisioning-secrets.service';
import {createPppoeLine} from './network-pppoe-lines.service';

const MAX_ROWS=5000;
const ownerId=(access:any)=>access.role==='agent_employee'?Number(access.manager.parent_agent_manager_id):Number(access.manager.id);
const text=(value:any,max=1000)=>String(value??'').trim().slice(0,max);
const digits=(value:string)=>value.replace(/[٠-٩۰-۹]/g,d=>String('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹'.indexOf(d)%10));
const blank=(row:any)=>!text(row.firstName)&&!text(row.lastName)&&!text(row.username)&&!text(row.password)&&!text(row.profile);
const paymentCode=()=>`C${String(randomInt(0,10_000_000_000)).padStart(10,'0')}`;
const hasArabic=(value:string)=>/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(value);

function normalizedSpeed(value:any){
 const raw=digits(text(value,150)).toLowerCase().replace(/\s+/g,'');
 const matchPart=(part:string)=>{const match=/^(\d+(?:\.\d+)?)([kmg])?/i.exec(part);if(!match)return null;const number=Number(match[1]),unit=(match[2]||'m').toLowerCase(),factor=unit==='g'?1_000_000_000:unit==='m'?1_000_000:1_000;if(!Number.isFinite(number)||number<=0)return null;return String(Math.round(number*factor));};
 const pieces=raw.split('/');
 if(pieces.length>2)return null;
 const first=matchPart(pieces[0]||'');if(!first)return null;
 const second=pieces.length===2?matchPart(pieces[1]||''):first;if(!second)return null;
 return `${first}/${second}`;
}
function localExpiry(value:any){
 const raw=digits(text(value,80));if(!raw)return null;
 let match=/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw);
 if(!match){const numeric=/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw);if(numeric){const first=Number(numeric[1]),second=Number(numeric[2]);if(first>12)match=[numeric[0],numeric[3],numeric[2],numeric[1],numeric[4]||'',numeric[5]||'',numeric[6]||''] as unknown as RegExpExecArray;else if(first>=1&&first<=12&&second>=1&&second<=31)match=[numeric[0],numeric[3],numeric[1],numeric[2],numeric[4]||'',numeric[5]||'',numeric[6]||''] as unknown as RegExpExecArray;}}
 if(!match)return undefined;
 const hasTime=Boolean(match[4]),year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),hour=hasTime?Number(match[4]):23,minute=hasTime?Number(match[5]):59,second=hasTime?Number(match[6]||0):59;
 const date=new Date(Date.UTC(year,month-1,day,hour,minute,second));if(year<1900||date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day||hour>23||minute>59||second>59)return undefined;
 return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')}`;
}
function rowIdentity(row:any,index:number){
 const firstName=text(row.firstName,100)||`عميل ${index+1}`;
 const lastName=text(row.lastName,100);
 const username=text(row.username,64).toLowerCase();
 const suppliedPassword=String(row.password??''),password=suppliedPassword.length<=64?suppliedPassword:'';
 const profile=text(row.profile,150);
 const phone=digits(text(row.phone,40)).replace(/[\s()+-]/g,'');
 const notes=text(row.notes,2000);
 const expiry=localExpiry(row.expiresAt);
 const speed=normalizedSpeed(profile);
 return {firstName,lastName,username,password,passwordTooLong:suppliedPassword.length>64,profile,phone,notes,expiry,speed};
}
function prepareRows(rows:any[]){
 const seen=new Set<number>();
 return rows.map((raw,index)=>{
  const sourceRow=Number(raw?.rowNumber);
  let rowNumber=Number.isSafeInteger(sourceRow)&&sourceRow>=2?sourceRow:index+2;
  while(seen.has(rowNumber))rowNumber++;
  seen.add(rowNumber);
  return {raw:raw||{},rowNumber};
 }).filter(item=>!blank(item.raw)).map((item,index)=>({...item,data:rowIdentity(item.raw,index)}));
}
function safeRowFailure(error:any){
 const message=String(error?.message||'');
 if(message==='PPPOE_LINE_USERNAME_TAKEN')return 'username_duplicate';
 if(message==='PPPOE_IMPORT_PHONE_DUPLICATE')return 'phone_duplicate';
 if(message==='PPPOE_ACCOUNTING_INTERVAL_REQUIRED')return 'accounting_interval_required';
 if(error?.code==='ER_CHECK_CONSTRAINT_VIOLATED'&&message.includes('chk_ppp_subscription_times'))return 'expiry_constraint';
 if(error?.code==='ER_CHECK_CONSTRAINT_VIOLATED')return 'database_constraint';
 if(error?.code==='ER_NO_REFERENCED_ROW_2'||error?.code==='ER_NO_REFERENCED_ROW')return 'database_reference';
 if(error?.code==='ER_BAD_NULL_ERROR'||error?.code==='ER_NO_DEFAULT_FOR_FIELD')return 'database_required_field';
 if(error?.code==='ER_DUP_ENTRY')return 'database_duplicate';
 return 'row_create_failed';
}
function logSafeRowFailure(batchId:number,rowNumber:number,error:any,reason:string,stage:string){
 const code=String(error?.code||''),sqlState=String(error?.sqlState||''),rawMessage=String(error?.message||'');
 const constraint=/CONSTRAINT\s+[`'\"]([A-Za-z0-9_]+)[`'\"]/i.exec(rawMessage)?.[1];
 console.error('[pppoe-import] row creation failed',{batchId,rowNumber,reason,stage:stage||error?.pppoeStage||'unknown',databaseCode:/^[A-Z0-9_]{2,64}$/.test(code)?code:undefined,sqlState:/^[0-9A-Z]{5}$/.test(sqlState)?sqlState:undefined,constraint:constraint&&/^[A-Za-z0-9_]{1,80}$/.test(constraint)?constraint:undefined});
}

async function verifySupportedSchema(app:any){
 try{
  await app.query('SELECT manager_id,first_name,last_name,phone,notes,payment_code,created_by_manager_id FROM customers LIMIT 0');
  await app.query('SELECT category_id,manager_id FROM customer_category_manager_assignments LIMIT 0');
  await app.query('SELECT customer_id,category_id,manager_id,assigned_by_manager_id FROM customer_category_memberships LIMIT 0');
  await app.query('SELECT id,current_username,service_kind FROM radius_identities LIMIT 0');
  await app.query('SELECT username,radius_identity_id FROM radius_username_reservations LIMIT 0');
  await app.query('SELECT username,attribute,op,value FROM radcheck LIMIT 0');
  await app.query('SELECT username,groupname,priority FROM radusergroup LIMIT 0');
  await app.query('SELECT customer_id,radius_identity_id,identity_kind,address,service_type_id,connection_method_id,station_device_id,admin_status,created_by FROM pppoe_accounts LIMIT 0');
  await app.query('SELECT account_id,package_version_id,effective_service_snapshot,lifecycle,expires_at FROM pppoe_subscriptions LIMIT 0');
  await app.query('SELECT upload_bytes,download_bytes FROM pppoe_subscription_usage LIMIT 0');
  await app.query('SELECT id,name,package_type,is_enabled,archived_at FROM pppoe_packages LIMIT 0');
  await app.query('SELECT id,package_id,version_no,radius_group_name,service_snapshot,radius_snapshot FROM pppoe_package_versions LIMIT 0');
  await app.query('SELECT id,nasname FROM nas LIMIT 0');
  await app.query('SELECT id,radius_nas_id,radius_services,is_enabled,archived_at FROM lord_nas LIMIT 0');
  await app.query('SELECT id,timezone FROM network_settings LIMIT 0');
  await app.query('SELECT id,name,code FROM service_types LIMIT 0');
  await app.query('SELECT id,service_type_id,name,code FROM connection_methods LIMIT 0');
  await app.query('SELECT groupname,attribute,op,value FROM radgroupreply LIMIT 0');
  await app.query('SELECT groupname,attribute,op,value FROM radgroupcheck LIMIT 0');
  await app.query('SELECT username,attribute,op,value FROM radreply LIMIT 0');
  await app.query('SELECT actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,customer_id,account_id,after_data,result FROM activity_log LIMIT 0');
  await app.query('SELECT created_by,category_id,status FROM pppoe_import_batches LIMIT 0');
  await app.query('SELECT batch_id,source_row_number,reason_code,encrypted_payload FROM pppoe_import_review_rows LIMIT 0');
 }catch(error:any){const wrapped:any=new Error('PPPOE_IMPORT_SCHEMA_MISMATCH');wrapped.causeCode=error?.code;throw wrapped;}
}
async function authorize(app:any,scope:any){
 const access=await managerAccess(app,scope.managerId,scope.authVersion);
 if(access.role!=='principal')throw new Error('NETWORK_AUTH');
 await verifySupportedSchema(app);
 return access;
}
async function loadProfiles(app:any){
 const [rows]:any=await app.query(`SELECT v.id package_version_id,p.name,v.version_no,v.radius_group_name,
  JSON_UNQUOTE(JSON_EXTRACT(v.service_snapshot,'$.download_bps')) download_bps,
  JSON_UNQUOTE(JSON_EXTRACT(v.service_snapshot,'$.upload_bps')) upload_bps
  FROM pppoe_packages p JOIN pppoe_package_versions v ON v.package_id=p.id
  WHERE p.is_enabled=1 AND p.archived_at IS NULL AND p.package_type NOT IN('daily','addon')
  ORDER BY p.name,v.version_no DESC`);
 return rows;
}
async function requirePppNas(app:any){const [rows]:any=await app.query("SELECT n.id FROM lord_nas l JOIN nas n ON n.id=l.radius_nas_id WHERE l.archived_at IS NULL AND l.is_enabled=1 AND FIND_IN_SET('ppp',l.radius_services)>0 LIMIT 1");if(!rows.length)throw new Error('PPPOE_LINE_NAS_REQUIRED');}
async function inspectRows(app:any,rows:any[],versionMap:any){
 const normalized=prepareRows(rows);
 const usernames=Array.from(new Set(normalized.map(item=>item.data.username).filter((value:string)=>/^[a-z0-9_.@-]{1,64}$/.test(value))));
 const phones=Array.from(new Set(normalized.map(item=>item.data.phone).filter((value:string)=>/^\d{1,15}$/.test(value))));
 const usernameHits=new Set<string>(),phoneHits=new Set<string>();
 for(let offset=0;offset<usernames.length;offset+=400){const chunk=usernames.slice(offset,offset+400);if(!chunk.length)continue;const [found]:any=await app.query(`SELECT username FROM radius_username_reservations WHERE username IN (${chunk.map(()=>'?').join(',')})`,chunk);for(const item of found)usernameHits.add(String(item.username));}
 for(let offset=0;offset<phones.length;offset+=400){const chunk=phones.slice(offset,offset+400);if(!chunk.length)continue;const [found]:any=await app.query(`SELECT phone FROM customers WHERE phone IN (${chunk.map(()=>'?').join(',')})`,chunk);for(const item of found)phoneHits.add(String(item.phone));}
 const seenNames=new Set<string>(),seenPhones=new Set<string>();
 return normalized.map(({rowNumber,data})=>{
  const reasons:string[]=[];let kind:'ready'|'duplicate'|'rejected'='ready';
  if(!data.username||! /^[a-z0-9_.@-]{1,64}$/.test(data.username)||!data.password||data.passwordTooLong||hasArabic(data.password))reasons.push('required_credentials');
  if(!data.profile)reasons.push('profile_missing');
  const versionId=versionMap?.[data.profile]??(data.speed?versionMap?.[data.speed]:null)??null;
  if(!versionId)reasons.push(data.speed?'profile_unmapped':'profile_invalid');
  // A date that cannot be normalized must not prevent creating the PPPoE line.
  // Keep the account and import it without an expiry so an administrator can complete it later.
  if(data.phone&&!/^\d{1,15}$/.test(data.phone))reasons.push('phone_invalid');
  const dupUsername=usernameHits.has(data.username)||seenNames.has(data.username);
  const dupPhone=Boolean(data.phone)&&(phoneHits.has(data.phone)||seenPhones.has(data.phone));
  if(dupUsername||dupPhone){kind='duplicate';if(dupUsername)reasons.push('username_duplicate');if(dupPhone)reasons.push('phone_duplicate');}
  else if(reasons.length)kind='rejected';
  if(data.username)seenNames.add(data.username);if(data.phone)seenPhones.add(data.phone);
  return {rowNumber,firstName:data.firstName,lastName:data.lastName,username:data.username,profile:data.profile,normalizedSpeed:data.speed,phone:Boolean(data.phone),expiresAt:data.expiry||null,packageVersionId:versionId?Number(versionId):null,kind,reasons};
 });
}
export async function previewPppoeImport(scope:any,input:any){
 return withNetwork(scope,async app=>{await authorize(app,scope);await requirePppNas(app);const rows=Array.isArray(input.rows)?input.rows:[];if(!rows.length||rows.length>MAX_ROWS)throw new Error('PPPOE_IMPORT_ROW_LIMIT');const categoryId=Number(input.categoryId);if(!Number.isSafeInteger(categoryId)||categoryId<1)throw new Error('PPPOE_IMPORT_CATEGORY_REQUIRED');const [cats]:any=await app.query('SELECT c.id FROM customer_categories c JOIN customer_category_manager_assignments a ON a.category_id=c.id WHERE c.id=? AND c.archived_at IS NULL AND a.manager_id=? LIMIT 1',[categoryId,scope.managerId]);if(!cats.length)throw new Error('PPPOE_IMPORT_CATEGORY_INVALID');const profiles=await loadProfiles(app);const versionMap=input.profileMap&&typeof input.profileMap==='object'?input.profileMap:{};const validVersions=new Set(profiles.map((item:any)=>String(item.package_version_id)));for(const value of Object.values(versionMap))if(value&&!validVersions.has(String(value)))throw new Error('PPPOE_IMPORT_PROFILE_INVALID');const items=await inspectRows(app,rows,versionMap);return {total:items.length,ready:items.filter(item=>item.kind==='ready').length,duplicates:items.filter(item=>item.kind==='duplicate').length,rejected:items.filter(item=>item.kind==='rejected').length,withPhone:items.filter(item=>item.phone).length,withoutPhone:items.filter(item=>!item.phone).length,withExpiry:items.filter(item=>item.expiresAt).length,withoutExpiry:items.filter(item=>!item.expiresAt).length,profiles:profiles.map((item:any)=>({id:Number(item.package_version_id),name:item.name,version:Number(item.version_no),speed:`${normalizedSpeed(`${Number(item.download_bps)/1_000_000}M/${Number(item.upload_bps)/1_000_000}M`)||''}`})),items};});
}

export async function readPppoeImportReview(scope:any){
 return withNetwork(scope,async app=>{
  await authorize(app,scope);
  const [rows]:any=await app.query(`SELECT r.id,r.batch_id,r.source_row_number,r.username,r.reason_code,r.created_at,
    b.source_name,b.created_at batch_created_at
    FROM pppoe_import_review_rows r
    JOIN pppoe_import_batches b ON b.id=r.batch_id
    JOIN customer_category_manager_assignments a ON a.category_id=b.category_id AND a.manager_id=?
    WHERE r.resolved_at IS NULL
    ORDER BY r.id DESC LIMIT 200`,[scope.managerId]);
  const [summary]:any=await app.query(`SELECT COUNT(*) pending_rows,COUNT(DISTINCT r.batch_id) pending_batches
    FROM pppoe_import_review_rows r
    JOIN pppoe_import_batches b ON b.id=r.batch_id
    JOIN customer_category_manager_assignments a ON a.category_id=b.category_id AND a.manager_id=?
    WHERE r.resolved_at IS NULL`,[scope.managerId]);
  return {items:rows.map((row:any)=>({...row,id:Number(row.id),batch_id:Number(row.batch_id),source_row_number:Number(row.source_row_number)})),pendingRows:Number(summary[0]?.pending_rows||0),pendingBatches:Number(summary[0]?.pending_batches||0),limit:200};
 });
}

export async function commitPppoeImport(scope:any,input:any){
 return withNetwork(scope,async app=>{
  // Fail before creating any customers if duplicate/rejected rows cannot be safely encrypted.
  provisioningKey();
  const access=await authorize(app,scope);await requirePppNas(app);const rows=Array.isArray(input.rows)?input.rows:[];if(!rows.length||rows.length>MAX_ROWS)throw new Error('PPPOE_IMPORT_ROW_LIMIT');
  const categoryId=Number(input.categoryId);if(!Number.isSafeInteger(categoryId)||categoryId<1)throw new Error('PPPOE_IMPORT_CATEGORY_REQUIRED');
  const [categories]:any=await app.query('SELECT c.id FROM customer_categories c JOIN customer_category_manager_assignments a ON a.category_id=c.id WHERE c.id=? AND c.archived_at IS NULL AND a.manager_id=? LIMIT 1',[categoryId,scope.managerId]);if(!categories.length)throw new Error('PPPOE_IMPORT_CATEGORY_INVALID');
  const profiles=await loadProfiles(app),profileMap=input.profileMap&&typeof input.profileMap==='object'?input.profileMap:{};const allowed=new Set(profiles.map((item:any)=>String(item.package_version_id)));for(const value of Object.values(profileMap))if(value&&!allowed.has(String(value)))throw new Error('PPPOE_IMPORT_PROFILE_INVALID');
  const prepared=prepareRows(rows),dataByRow=new Map(prepared.map(item=>[item.rowNumber,item.data]));const items=await inspectRows(app,rows,profileMap);const imported:number[]=[],queue:{rowNumber:number;reason:string;username:string|null;raw:any}[]=[];
  let batchId:number;
  await app.beginTransaction();try{const [batch]:any=await app.query("INSERT INTO pppoe_import_batches(created_by,category_id,source_name,total_rows,imported_rows,duplicate_rows,rejected_rows,status) VALUES(?,?,?, ?,0,0,0,'processing')",[scope.managerId,categoryId,text(input.sourceName,255)||null,items.length]);batchId=Number(batch.insertId);await app.commit();}catch(error){await app.rollback();throw error;}
  for(const item of items){
   const data=dataByRow.get(item.rowNumber);if(!data)throw new Error('PPPOE_IMPORT_ROW_MAPPING_FAILED');
   if(item.kind!=='ready'||!item.packageVersionId){queue.push({rowNumber:item.rowNumber,reason:item.reasons[0]||'profile_unmapped',username:/^[a-z0-9_.@-]{1,64}$/.test(data.username)?data.username:null,raw:data});continue;}
   await app.beginTransaction();let stage='customer.create';try{
    const managerId=ownerId(access);let customer:any=null;
    for(let attempt=0;attempt<8;attempt++){const code=paymentCode();try{[customer]=await app.query("INSERT INTO customers(manager_id,status,first_name,last_name,phone,notes,payment_code,created_by_manager_id) VALUES(?,'active',?,?,?,?,?,?)",[managerId,data.firstName,data.lastName,data.phone||null,data.notes||null,code,scope.managerId]);break;}catch(error:any){if(error?.code==='ER_DUP_ENTRY'&&String(error?.message||'').includes('uq_customer_phone'))throw new Error('PPPOE_IMPORT_PHONE_DUPLICATE');if(error?.code!=='ER_DUP_ENTRY'||attempt===7)throw error;}}
    const customerId=Number(customer.insertId);stage='category.membership.create';await app.query('INSERT INTO customer_category_memberships(customer_id,category_id,manager_id,assigned_by_manager_id) VALUES(?,?,?,?)',[customerId,categoryId,managerId,scope.managerId]);
    stage='pppoe_line.create';const line=await createPppoeLine(scope,{customerId,packageVersionId:item.packageVersionId,username:data.username,password:data.password,expiresAtOverride:data.expiry||'',address:'',lineName:''},app,{importedExpiry:true,includeIdentityId:true,onStage:(lineStage:string)=>{stage=`pppoe_line.${lineStage}`;}});
    stage='import.activity_log.create';await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,customer_id,account_id,after_data,result) VALUES(?,?,'manager','pppoe.import.create','pppoe_account',?,?,?,?, 'success')",[scope.managerId,JSON.stringify({id:scope.managerId,full_name:access.manager.full_name,role:access.role}),line.item.id,customerId,line.item.radius_identity_id,JSON.stringify({batchId,rowNumber:item.rowNumber,username:data.username,categoryId,packageVersionId:item.packageVersionId})]);
    await app.query('UPDATE pppoe_import_batches SET imported_rows=imported_rows+1 WHERE id=?',[batchId]);await app.commit();imported.push(item.rowNumber);
   }catch(error:any){await app.rollback();const code=safeRowFailure(error);logSafeRowFailure(batchId,item.rowNumber,error,code,stage);queue.push({rowNumber:item.rowNumber,reason:code,username:data.username||null,raw:data});}
  }
  for(const record of queue){await app.query('INSERT INTO pppoe_import_review_rows(batch_id,source_row_number,username,reason_code,encrypted_payload) VALUES(?,?,?,?,?)',[batchId,record.rowNumber,record.username,record.reason,encryptProvisioningSecret(JSON.stringify(record.raw))]);}
  const duplicates=queue.filter(row=>row.reason.includes('duplicate')).length,rejected=queue.length-duplicates,status=queue.length?'completed_with_issues':'completed';
  await app.beginTransaction();try{
   await app.query('UPDATE pppoe_import_batches SET duplicate_rows=?,rejected_rows=?,status=? WHERE id=?',[duplicates,rejected,status,batchId]);
   await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,after_data,result) VALUES(?,?,'manager','pppoe.import.commit','pppoe_import_batch',?,?, 'success')",[scope.managerId,JSON.stringify({id:scope.managerId,full_name:access.manager.full_name,role:access.role}),batchId,JSON.stringify({total:items.length,imported:imported.length,duplicates,rejected})]);
   await app.commit();
  }catch(error){await app.rollback();throw error;}
  return {success:true,batchId,total:items.length,imported:imported.length,duplicates,rejected,queued:queue.length};
 });
}
