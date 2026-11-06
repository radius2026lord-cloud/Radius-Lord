import {createHash,randomBytes,timingSafeEqual} from 'crypto';
import bcrypt from 'bcryptjs';
import type {PoolConnection} from 'mysql2/promise';
import {db} from '../config/db';
import type {AuthenticatedRequest} from '../middleware/auth.middleware';
import {writeMasterAdminAuditLog} from './audit.service';
import {readHostingPreflight} from './hosting-preflight.service';
import {networkScope,validateLocalLicense,withNetwork} from './network-runtime.service';
import {invalidateNetworkManager} from './network-session-version.service';

type Scope = Awaited<ReturnType<typeof networkScope>>;
type Recovery = {managerId:number;adminId:number;hash:string;expiresAt:string;usedAt?:string;revokedAt?:string};
const lockName='radius-lord:manager-credentials';
const group='network_access_recovery';
const keyFor=(scope:Scope)=>'environment_'+scope.environment_id;
const digest=(token:string)=>createHash('sha256').update(token).digest();
export class RecoveryError extends Error {
 constructor(public status:number,message:string){super(message);}
}

async function underCredentialLock<T>(work:(central:PoolConnection)=>Promise<T>){
 const central=await db.pool.getConnection();
 let acquired=false;
 try{
  const [rows]:any=await central.query('SELECT GET_LOCK(?, 0) AS acquired',[lockName]);
  acquired=Number(rows[0]?.acquired)===1;
  if(!acquired)throw new RecoveryError(409,'تجري عملية أخرى على بيانات الدخول. أعد المحاولة.');
  return await work(central);
 }finally{
  try{if(acquired)await central.query('SELECT RELEASE_LOCK(?)',[lockName]);}
  catch{central.destroy();}
  finally{central.release();}
 }
}

async function readSetting(central:PoolConnection,settingGroup:string,key:string,lock=false){
 const [rows]:any=await central.query('SELECT setting_value FROM platform_settings WHERE setting_group=? AND setting_key=?'+(lock?' FOR UPDATE':''),[settingGroup,key]);
 return rows[0]?JSON.parse(rows[0].setting_value):null;
}

async function writeRecovery(central:PoolConnection,key:string,state:Recovery){
 await central.query("INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public) VALUES (?,?,?,'json',0) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[group,key,JSON.stringify(state)]);
}

function linkStatus(state:Recovery|null){
 if(!state)return null;
 return {
  status:state.usedAt?'used':state.revokedAt?'revoked':Date.parse(state.expiresAt)<=Date.now()?'expired':'pending',
  expiresAt:state.expiresAt,usedAt:state.usedAt??null,revokedAt:state.revokedAt??null,
 };
}

async function activeManager(scope:Scope){
 return withNetwork(scope,async connection=>{
  await validateLocalLicense(connection,scope,false,true);
  const [rows]:any=await connection.query("SELECT id,username FROM managers WHERE manager_type='principal' AND is_enabled=1 AND archived_at IS NULL LIMIT 2");
  if(rows.length!==1)throw new RecoveryError(409,'تعذر تحديد المدير الرئيسي النشط لهذه الشبكة.');
  return {id:Number(rows[0].id),username:String(rows[0].username)};
 });
}

async function audit(req:AuthenticatedRequest,adminId:number,scope:Scope,eventType:string,managerId:number,description:string,central:PoolConnection){
 await writeMasterAdminAuditLog(req,adminId,{
  actionCode:'UPDATE',entityTypeCode:'TENANT_ENVIRONMENT',entityId:Number(scope.environment_id),tenantId:Number(scope.tenant_id),
  description,metadata:{eventType,managerId,environmentId:Number(scope.environment_id)},
 },central);
}

async function transaction<T>(central:PoolConnection,work:()=>Promise<T>){
 await central.beginTransaction();
 try{const result=await work();await central.commit();return result;}
 catch(error){await central.rollback().catch(()=>{});throw error;}
}

async function lockEnvironment(central:PoolConnection,scope:Scope){
 const [rows]:any=await central.query("SELECT id FROM tenant_environments WHERE id=? AND tenant_id=? AND status='ready' AND archived_at IS NULL FOR UPDATE",[scope.environment_id,scope.tenant_id]);
 if(!rows[0])throw new RecoveryError(409,'بيئة الشبكة غير جاهزة.');
}

export async function manageNetworkAccess(req:AuthenticatedRequest,slug:string,action:'read'|'issue'|'revoke'){
 const scope=await networkScope(slug,false,true);
 if(action==='read'){
  const manager=await activeManager(scope);
  const [rows]:any=await db.query('SELECT setting_value FROM platform_settings WHERE setting_group=? AND setting_key=?',[group,keyFor(scope)]);
  const state=rows[0]?JSON.parse(rows[0].setting_value) as Recovery:null;
  return {username:manager.username,link:linkStatus(state)};
 }
 return underCredentialLock(async central=>{
  const manager=await activeManager(scope),key=keyFor(scope),adminId=req.auth!.accountId;
  return transaction(central,async()=>{
   await lockEnvironment(central,scope);
   const previous=await readSetting(central,group,key,true) as Recovery|null;
   if(action==='revoke'){
    if(previous&&linkStatus(previous)?.status==='pending'){
     previous.revokedAt=new Date().toISOString();
     await writeRecovery(central,key,previous);
     await audit(req,adminId,scope,'network_access_recovery_revoked',manager.id,'إلغاء رابط استعادة وصول مدير الشبكة',central);
    }
    return {username:manager.username,link:linkStatus(previous)};
   }
   const hosting=await readHostingPreflight((sql,params)=>central.query(sql,params));
   const token=randomBytes(32).toString('base64url');
   const state:Recovery={managerId:manager.id,adminId,hash:digest(token).toString('hex'),expiresAt:new Date(Date.now()+30*60*1000).toISOString()};
   await writeRecovery(central,key,state);
   await audit(req,adminId,scope,'network_access_recovery_issued',manager.id,'إصدار رابط استعادة وصول مدير الشبكة',central);
   return {username:manager.username,link:linkStatus(state),url:hosting.baseUrl+'/network/'+encodeURIComponent(scope.slug)+'#recover='+token};
  });
 });
}

function invalidLink(){
 return new RecoveryError(400,'رابط الاستعادة غير صالح أو انتهت صلاحيته.');
}

function matchesRecovery(recovery:Recovery|null,token:string):recovery is Recovery{
 return Boolean(recovery&&linkStatus(recovery)?.status==='pending'&&/^[a-f0-9]{64}$/.test(recovery.hash)&&timingSafeEqual(digest(token),Buffer.from(recovery.hash,'hex')));
}

export async function recoverNetworkAccess(req:AuthenticatedRequest,slug:string){
 const {token,password}=req.body??{};
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw invalidLink();
 const scope=await networkScope(slug,false,true);
 if(req.body?.action==='preview'){
  const [rows]:any=await db.query('SELECT setting_value FROM platform_settings WHERE setting_group=? AND setting_key=?',[group,keyFor(scope)]);
  if(!matchesRecovery(rows[0]?JSON.parse(rows[0].setting_value):null,token))throw invalidLink();
  return {networkName:scope.name};
 }
 const rawUsername=typeof req.body?.username==='string'?req.body.username:'';
 const username=rawUsername.trim().toLowerCase();
 if(/\p{Script=Arabic}/u.test(rawUsername)||typeof password==='string'&&/\p{Script=Arabic}/u.test(password))throw new RecoveryError(422,'الأحرف العربية غير مسموحة في اسم المستخدم أو كلمة المرور.');
 if(!/^[a-z][a-z0-9_.-]{2,63}$/.test(username)||username.startsWith('setup_'))throw new RecoveryError(422,'أدخل اسمًا من 3 إلى 64 محرفًا يبدأ بحرف إنجليزي ويحتوي فقط على حروف إنجليزية أو أرقام أو . _ -');
 if(typeof password!=='string'||password.length<8||Buffer.byteLength(password,'utf8')>72)throw new RecoveryError(422,'اختر كلمة مرور من 8 محارف على الأقل وبحد أقصى 72 بايت.');
 return underCredentialLock(async central=>{
  const key=keyFor(scope);
  const manager=await activeManager(scope);
  const state=await transaction(central,async()=>{
   await lockEnvironment(central,scope);
   const recovery=await readSetting(central,group,key,true) as Recovery|null;
   if(!matchesRecovery(recovery,token)||recovery.managerId!==manager.id)throw invalidLink();
   const runtime=await readSetting(central,'environment_runtime',key,true);
   if(!runtime||runtime.tenantId!==Number(scope.tenant_id)||runtime.subscriptionId!==Number(scope.subscription_id))throw invalidLink();
   if(username!==manager.username){
    const [reserved]:any=await central.query(`SELECT 1 FROM master_admins WHERE username=? OR email=? UNION ALL
     SELECT 1 FROM customers WHERE username=? OR email=? UNION ALL
     SELECT 1 FROM platform_settings WHERE setting_group='environment_runtime' AND setting_key<>? AND
       (JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.username'))=? OR JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.pendingUsername'))=?)
     UNION ALL SELECT 1 FROM platform_settings WHERE setting_group='network_manager_directory' AND JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.username'))=? LIMIT 1`,
     [username,username,username,username,key,username,username,username]);
    const duplicate=await withNetwork(scope,async connection=>{
     const [rows]:any=await connection.query('SELECT 1 FROM managers WHERE username=? AND id<>? LIMIT 1',[username,manager.id]);
     return rows.length>0;
    });
    if(reserved.length||duplicate)throw new RecoveryError(409,'اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.');
   }
   const passwordHash=await bcrypt.hash(password,12);
   // Claim before writing across databases. A failed write cannot make this token usable again.
   recovery.revokedAt=new Date().toISOString();
   await writeRecovery(central,key,recovery);
   // Keep the new alias resolvable if the tenant update succeeds before central finalization.
   runtime.pendingUsername=username;
   await central.query("UPDATE platform_settings SET setting_value=? WHERE setting_group='environment_runtime' AND setting_key=?",[JSON.stringify(runtime),key]);
   await invalidateNetworkManager(central,scope,manager.id);
   await central.query("INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public) VALUES ('environment_activation',?,?,'json',0) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[key,JSON.stringify({consumedAt:new Date().toISOString()})]);
   await audit(req,recovery.adminId,scope,'network_access_recovery_claimed',manager.id,'بدء استخدام رابط إعادة تعيين بيانات دخول مدير الشبكة',central);
   return {recovery,runtime,passwordHash};
  });
  await withNetwork(scope,async connection=>{
   const [result]:any=await connection.query("UPDATE managers SET username=?,password_hash=? WHERE id=? AND username=? AND manager_type='principal' AND is_enabled=1 AND archived_at IS NULL",[username,state.passwordHash,manager.id,manager.username]);
   if(result.affectedRows!==1)throw new RecoveryError(409,'تغير حساب المدير. اطلب رابط استعادة جديدًا.');
  });
  await transaction(central,async()=>{
   await lockEnvironment(central,scope);
   state.runtime.username=username;
   state.runtime.mustChangeCredentials=false;
   delete state.runtime.passwordEncrypted;
   delete state.runtime.credentialsExpiresAt;
   delete state.runtime.pendingUsername;
   await invalidateNetworkManager(central,scope,manager.id);
   await central.query("UPDATE platform_settings SET setting_value=? WHERE setting_group='environment_runtime' AND setting_key=?",[JSON.stringify(state.runtime),key]);
   state.recovery.usedAt=new Date().toISOString();delete state.recovery.revokedAt;
   await writeRecovery(central,key,state.recovery);
   await audit(req,state.recovery.adminId,scope,'network_access_recovery_used',manager.id,'استخدام رابط إعادة تعيين بيانات دخول مدير الشبكة',central);
  });
 });
}
