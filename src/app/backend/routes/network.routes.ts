import {readHostingPreflight} from '../services/hosting-preflight.service';
import {Router} from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {env} from '../config/env';
import {db} from '../config/db';
import {networkScope,withNetwork,validateLocalLicense} from '../services/network-runtime.service';
import {provisioningKey} from '../services/provisioning-secrets.service';
const router=Router();
const failed=new Map<string,{count:number;until:number}>();
router.use(async(req,res,next)=>{res.setHeader('Cache-Control','no-store');if(req.method!=='GET'&&req.headers.origin&&req.headers.origin!==new URL(env.FRONTEND_URL).origin){try{const hosting=await readHostingPreflight((sql,params)=>db.query(sql,params));if(req.headers.origin!==new URL(hosting.baseUrl).origin)throw new Error();}catch{return res.status(403).json({message:'مصدر الطلب غير مصرح.'});}}next();});
function cookie(header:string|undefined){try{return decodeURIComponent(header?.split(';').map(x=>x.trim()).find(x=>x.startsWith('network_token='))?.slice(14)??'');}catch{return '';}}
router.post('/:slug/login',async(req,res)=>{
 const key=req.ip??'';const now=Date.now();const attempts=failed.get(key);if(attempts&&attempts.until>now&&attempts.count>=10)return res.status(429).json({message:'انتظر دقائق قبل إعادة المحاولة.'});
 try{
  const username=String(req.body?.username??''),password=String(req.body?.password??'');if(username.length>100||password.length>128||!username||!password)throw new Error('INVALID_LOGIN');
  const scope=await networkScope(String(req.params.slug));const manager=await withNetwork(scope,async connection=>{await validateLocalLicense(connection,scope);const [rows]:any=await connection.query('SELECT id,full_name,password_hash FROM managers WHERE username=? AND is_enabled=1 AND archived_at IS NULL',[username]);if(!rows[0]||!await bcrypt.compare(password,rows[0].password_hash))throw new Error('INVALID_LOGIN');return rows[0];});
  failed.delete(key);const token=jwt.sign({kind:'network-manager',tenantId:scope.tenant_id,environmentId:scope.environment_id,sub:String(manager.id),slug:scope.slug},env.JWT_SECRET,{algorithm:'HS256',expiresIn:'20m'});
  res.cookie('network_token',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/api/network',maxAge:1200000});return res.json({success:true,name:manager.full_name});
 }catch{for(const [k,v]of Array.from(failed))if(v.until<=now)failed.delete(k);if(failed.size>1000)failed.clear();failed.set(key,{count:attempts&&attempts.until>now?attempts.count+1:1,until:now+300000});return res.status(401).json({message:'بيانات الدخول غير صحيحة أو البيئة غير متاحة.'});}
});
router.post('/:slug/logout',(req,res)=>{res.clearCookie('network_token',{path:'/api/network',httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'});return res.json({success:true});});
router.get('/:slug/me',async(req,res)=>{
 try{const token:any=jwt.verify(cookie(req.headers.cookie),env.JWT_SECRET,{algorithms:['HS256']});if(token.kind!=='network-manager'||token.slug!==req.params.slug)throw new Error('SCOPE');const scope=await networkScope(String(req.params.slug));if(Number(token.tenantId)!==Number(scope.tenant_id)||Number(token.environmentId)!==Number(scope.environment_id))throw new Error('SCOPE');
 const result=await withNetwork(scope,async connection=>{const license=await validateLocalLicense(connection,scope);const [rows]:any=await connection.query('SELECT id,full_name,manager_type FROM managers WHERE id=? AND is_enabled=1 AND archived_at IS NULL',[token.sub]);if(!rows[0])throw new Error('MANAGER');return {manager:rows[0],networkName:scope.name,license:license.license_number,expiresAt:license.expires_at,maxSubscribers:Number(license.max_pppoe_accounts),maxNas:Number(license.base_max_nas)};});return res.json(result);
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
