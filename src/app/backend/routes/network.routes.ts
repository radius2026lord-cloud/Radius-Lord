import {readHostingPreflight} from '../services/hosting-preflight.service';
import {consumeActivation} from '../services/environment-activation.service';
import {createHash} from 'crypto';
import {Router,type Request} from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {env} from '../config/env';
import {db} from '../config/db';
import {networkScope,withNetwork,validateLocalLicense} from '../services/network-runtime.service';
import {provisioningKey,decryptProvisioningSecret} from '../services/provisioning-secrets.service';
import {readNetworkOvpn,createNetworkNas,provisionNetworkNas,networkNasScript,nasRadiusClients,markNasRadiusConfigured,refreshNasLinks} from '../services/network-ovpn.service';
import {readPrivateSetting,applyRadiusDatabase,radiusDatabaseHost} from '../services/radius-provision.service';
const router=Router();
const failed=new Map<string,{count:number;until:number}>();
router.use(async(req,res,next)=>{res.setHeader('Cache-Control','no-store');if(req.method!=='GET'&&req.headers.origin&&req.headers.origin!==new URL(env.FRONTEND_URL).origin){try{const hosting=await readHostingPreflight((sql,params)=>db.query(sql,params));if(req.headers.origin!==new URL(hosting.baseUrl).origin)throw new Error();}catch{return res.status(403).json({message:'مصدر الطلب غير مصرح.'});}}next();});
function cookie(header:string|undefined){try{return decodeURIComponent(header?.split(';').map(x=>x.trim()).find(x=>x.startsWith('network_token='))?.slice(14)??'');}catch{return '';}}
async function principal(req:Request){
 const token:any=jwt.verify(cookie(req.headers.cookie),env.JWT_SECRET,{algorithms:['HS256']});if(token.kind!=='network-manager'||token.slug!==req.params.slug)throw new Error('NETWORK_AUTH');
 const scope=await networkScope(String(req.params.slug));if(Number(token.tenantId)!==Number(scope.tenant_id)||Number(token.environmentId)!==Number(scope.environment_id))throw new Error('NETWORK_AUTH');
 await withNetwork(scope,async connection=>{await validateLocalLicense(connection,scope);const [rows]:any=await connection.query("SELECT password_hash FROM managers WHERE id=? AND manager_type='principal' AND is_enabled=1 AND archived_at IS NULL",[token.sub]);if(!rows[0]||token.authVersion!==createHash('sha256').update(rows[0].password_hash).digest('hex'))throw new Error('NETWORK_AUTH');});
 return {...scope,managerId:Number(token.sub)};
}
const nasError=(e:unknown)=>({message:(e as Error)?.message==='NAS_PLAN_LIMIT_REACHED'?'وصلت إلى عدد أجهزة NAS المسموح به في الخطة.':(e as Error)?.message==='NETWORK_AUTH'?'انتهت الجلسة أو لا تملك صلاحية إدارة الخوادم.':'تعذر تجهيز اتصال NAS. يمكنك إعادة المحاولة لاستكماله؛ راجع البوابة والشهادات وSSH.',code:/^[A-Z0-9_]+$/.test((e as Error)?.message??'')?(e as Error).message:'NAS_OPERATION_FAILED'});
router.get('/:slug/nas',async(req,res)=>{try{const scope=await principal(req);return res.json(await withNetwork(scope,async app=>{const snapshot=await readNetworkOvpn(app);const [rows]:any=await app.query("SELECT l.id,l.name,l.activity_status,l.last_seen_at,c.tunnel_address,c.server_host,c.central_tunnel_id,JSON_EXTRACT(c.configuration_snapshot,'$.radiusConfigured') radius_ready FROM lord_nas l LEFT JOIN nas_ovpn_connections c ON c.nas_id=l.id WHERE l.archived_at IS NULL ORDER BY l.id");return {configured:Boolean(snapshot),maxNas:snapshot?snapshot.maxNas===0?0:snapshot.maxNas+snapshot.additionalNas:0,items:rows.map((r:any)=>({id:Number(r.id),name:r.name,address:r.tunnel_address??null,ready:Boolean(r.central_tunnel_id)&&String(r.radius_ready)==='true',status:r.activity_status==='recent'&&r.last_seen_at&&Date.now()-new Date(r.last_seen_at).getTime()<90000?'connected':r.activity_status==='stale'?'disconnected':'awaiting_link',lastSeenAt:r.last_seen_at}))};}));}catch{return res.status(401).json({message:'انتهت الجلسة أو لا تملك صلاحية إدارة الخوادم.'});}});
router.get('/:slug/nas/:id/script',async(req,res)=>{try{const scope=await principal(req),id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)throw new Error('NAS_INPUT_INVALID');const script=await withNetwork(scope,app=>networkNasScript(app,id));res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="radius-lord-nas-${id}.rsc"`);return res.send(script);}catch(e){return res.status(409).json(nasError(e));}});
async function provisionNasRequest(req:Request,res:any,refresh=false){
 const central=await db.pool.getConnection();let locked=false;
 try{const [lock]:any=await central.query("SELECT GET_LOCK('radius-lord:database-provisioner',0) acquired");if(!lock[0]?.acquired)throw new Error('NAS_PROVISIONING_BUSY');locked=true;
 const scope=await principal(req);
 await withNetwork(scope,async app=>{
 const snapshot=await readNetworkOvpn(app);if(!snapshot)throw new Error('NAS_NEW_ENVIRONMENT_REQUIRED');const license=await validateLocalLicense(app,scope);if(snapshot.maxNas!==Number(license.base_max_nas)||snapshot.additionalNas!==Number(license.additional_nas_capacity))throw new Error('NAS_LICENSE_SNAPSHOT_CHANGED');
 if(refresh){await refreshNasLinks(central,app,scope,snapshot);return;}
 const id=req.params.id?Number(req.params.id):await createNetworkNas(app,scope,scope.managerId,snapshot,{name:String(req.body?.name??''),requestId:String(req.body?.requestId??'')});if(!Number.isSafeInteger(id)||id<1)throw new Error('NAS_INPUT_INVALID');
 await provisionNetworkNas(central,app,scope,id,snapshot);
 const state=await readPrivateSetting('environment_runtime','environment_'+scope.environment_id);if(!state||state.tenantId!==Number(scope.tenant_id)||state.subscriptionId!==Number(scope.subscription_id)||state.radiusServerId!==snapshot.radiusServerId)throw new Error('NAS_RADIUS_SCOPE');
 const [configs]:any=await central.query("SELECT setting_value FROM platform_settings WHERE id=? AND setting_group='free_radius'",[snapshot.radiusServerId]);if(!configs[0])throw new Error('RADIUS_NOT_FOUND');const radius=JSON.parse(configs[0].setting_value);
 const [servers]:any=await central.query('SELECT * FROM database_servers WHERE id=?',[scope.database_server_id]);if(!servers[0]||servers[0].tls_required||Number(radius.sshServerId)!==Number(state.radiusSshServerId))throw new Error('NAS_RADIUS_SCOPE');
 await applyRadiusDatabase({sshServerId:radius.sshServerId,radiusHost:radius.host,databaseHost:await radiusDatabaseHost(servers[0],radius.host),databasePort:Number(servers[0].port),databaseName:scope.db_name,username:scope.radius_username,password:decryptProvisioningSecret(scope.radius_password_encrypted),authPort:state.authPort,accountingPort:state.accountingPort,name:'rl_env_'+scope.environment_id,secret:decryptProvisioningSecret(state.radiusSecretEncrypted),clients:await nasRadiusClients(app)});
 await markNasRadiusConfigured(app);
 });return res.json({success:true,message:refresh?'تم تحديث حالة الأنفاق من البوابة.':'تم تجهيز الاتصال وربطه بخدمة RADIUS. حمّل السكربت وطبّقه على جهاز NAS.'});
 }catch(e){return res.status(409).json(nasError(e));}finally{if(locked)await central.query("SELECT RELEASE_LOCK('radius-lord:database-provisioner')");central.release();}
}
router.post('/:slug/nas',async(req,res)=>provisionNasRequest(req,res));
router.post('/:slug/nas/:id/retry',async(req,res)=>provisionNasRequest(req,res));
router.post('/:slug/nas-check',async(req,res)=>provisionNasRequest(req,res,true));
router.post('/:slug/activate',async(req,res)=>{
 const key='activate:'+(req.ip??'');const now=Date.now(),attempts=failed.get(key);if(attempts&&attempts.until>now&&attempts.count>=10)return res.status(429).json({message:'انتظر دقائق قبل إعادة المحاولة.'});
 try{const username=await consumeActivation(String(req.params.slug),String(req.body?.token??''),String(req.body?.password??''));failed.delete(key);return res.json({success:true,username,message:'تم تعيين كلمة المرور. يمكنك تسجيل الدخول الآن.'});}
 catch{for(const [k,v]of Array.from(failed))if(v.until<=now)failed.delete(k);if(failed.size>1000)failed.clear();failed.set(key,{count:attempts&&attempts.until>now?attempts.count+1:1,until:now+300000});return res.status(400).json({message:'الرابط غير صالح أو انتهت صلاحيته أو استُخدم. كلمة المرور يجب أن تكون من 8 إلى 128 محرفًا.'});}
});
router.post('/:slug/login',async(req,res)=>{
 const key=req.ip??'';const now=Date.now();const attempts=failed.get(key);if(attempts&&attempts.until>now&&attempts.count>=10)return res.status(429).json({message:'انتظر دقائق قبل إعادة المحاولة.'});
 try{
  const username=String(req.body?.username??''),password=String(req.body?.password??'');if(username.length>100||password.length>128||!username||!password)throw new Error('INVALID_LOGIN');
  const scope=await networkScope(String(req.params.slug));const manager=await withNetwork(scope,async connection=>{await validateLocalLicense(connection,scope);const [rows]:any=await connection.query('SELECT id,full_name,password_hash FROM managers WHERE username=? AND is_enabled=1 AND archived_at IS NULL',[username]);if(!rows[0]||!await bcrypt.compare(password,rows[0].password_hash))throw new Error('INVALID_LOGIN');return rows[0];});
  failed.delete(key);const token=jwt.sign({kind:'network-manager',tenantId:scope.tenant_id,environmentId:scope.environment_id,authVersion:createHash('sha256').update(manager.password_hash).digest('hex'),sub:String(manager.id),slug:scope.slug},env.JWT_SECRET,{algorithm:'HS256',expiresIn:'20m'});
  res.cookie('network_token',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/api/network',maxAge:1200000});return res.json({success:true,name:manager.full_name});
 }catch{for(const [k,v]of Array.from(failed))if(v.until<=now)failed.delete(k);if(failed.size>1000)failed.clear();failed.set(key,{count:attempts&&attempts.until>now?attempts.count+1:1,until:now+300000});return res.status(401).json({message:'بيانات الدخول غير صحيحة أو البيئة غير متاحة.'});}
});
router.post('/:slug/logout',(req,res)=>{res.clearCookie('network_token',{path:'/api/network',httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'});return res.json({success:true});});
router.get('/:slug/me',async(req,res)=>{
 try{const token:any=jwt.verify(cookie(req.headers.cookie),env.JWT_SECRET,{algorithms:['HS256']});if(token.kind!=='network-manager'||token.slug!==req.params.slug)throw new Error('SCOPE');const scope=await networkScope(String(req.params.slug));if(Number(token.tenantId)!==Number(scope.tenant_id)||Number(token.environmentId)!==Number(scope.environment_id))throw new Error('SCOPE');
 const result=await withNetwork(scope,async connection=>{const license=await validateLocalLicense(connection,scope);const [rows]:any=await connection.query('SELECT id,full_name,manager_type,password_hash FROM managers WHERE id=? AND is_enabled=1 AND archived_at IS NULL',[token.sub]);if(!rows[0]||token.authVersion!==createHash('sha256').update(rows[0].password_hash).digest('hex'))throw new Error('MANAGER');return {manager:{id:rows[0].id,full_name:rows[0].full_name,manager_type:rows[0].manager_type},networkName:scope.name,license:license.license_number,expiresAt:license.expires_at,maxSubscribers:Number(license.max_pppoe_accounts),maxNas:Number(license.base_max_nas)===0?0:Number(license.base_max_nas)+Number(license.additional_nas_capacity)};});return res.json(result);
 }catch{return res.status(401).json({message:'انتهت الجلسة أو البيئة غير متاحة.'});}
});
// Worker-only HTTP proof: this exercises the same network scope, DB and password verification as login.
router.post('/:slug/verify',async(req,res)=>{
 try{const proof:any=jwt.verify(String(req.headers['x-provisioning-proof']??''),provisioningKey(),{algorithms:['HS256']});if(proof.kind!=='network-bootstrap'||proof.slug!==req.params.slug)throw new Error('PROOF');
 const scope=await networkScope(String(req.params.slug),true);if(Number(proof.environmentId)!==Number(scope.environment_id))throw new Error('PROOF');
 const [jobs]:any=await db.query("SELECT id FROM environment_provisioning_jobs WHERE id=? AND environment_id=? AND tenant_id=? AND status='running'",[proof.jobId,scope.environment_id,scope.tenant_id]);if(!jobs[0])throw new Error('JOB');
 await withNetwork(scope,async connection=>{await validateLocalLicense(connection,scope,true);const [rows]:any=await connection.query("SELECT password_hash FROM managers WHERE username=? AND manager_type='principal' AND is_enabled=1 AND archived_at IS NULL",[String(req.body?.username??'')]);if(!rows[0]||!await bcrypt.compare(String(req.body?.password??''),rows[0].password_hash))throw new Error('LOGIN');});
 return res.json({application:'radius-lord-network',environmentId:scope.environment_id,tenantId:scope.tenant_id,nonce:proof.nonce});
 }catch{return res.status(403).json({message:'فشل التحقق من بيئة الشبكة.'});}
});
export default router;
