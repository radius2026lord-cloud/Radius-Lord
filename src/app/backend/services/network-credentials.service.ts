import {auditNetworkEvent} from './network-audit.service';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {createHash} from 'crypto';
import {db} from '../config/db';
import {env} from '../config/env';
import {readPrivateSetting,savePrivateSetting} from './radius-provision.service';
import {validateLocalLicense,withNetwork} from './network-runtime.service';
export async function credentialsRequired(scope:any){
 const state=await readPrivateSetting('environment_runtime','environment_'+scope.environment_id);
 if(!state||state.tenantId!==Number(scope.tenant_id)||state.subscriptionId!==Number(scope.subscription_id))throw new Error('NETWORK_AUTH');
 return state.mustChangeCredentials===true;
}
export async function changeInitialCredentials(scope:any,token:any,input:any){
 const username=String(input?.username||'').trim().toLowerCase(),password=String(input?.password||'');
 if(!/^[a-z][a-z0-9_.-]{2,63}$/.test(username)||username.startsWith('setup_')||password.length<8||password.length>128)throw new Error('CREDENTIALS_INPUT');
 const central=await db.pool.getConnection();let locked=false;
 try{const [lock]:any=await central.query("SELECT GET_LOCK('radius-lord:manager-credentials',0) acquired");if(!lock[0]?.acquired)throw new Error('CREDENTIALS_BUSY');locked=true;
 const key='environment_'+scope.environment_id,state=await readPrivateSetting('environment_runtime',key);
 if(!state||state.tenantId!==Number(scope.tenant_id)||state.subscriptionId!==Number(scope.subscription_id)||state.mustChangeCredentials!==true)throw new Error('NETWORK_AUTH');
 const [reserved]:any=await central.query(`SELECT 1 FROM master_admins WHERE username=? OR email=? UNION ALL SELECT 1 FROM customers WHERE username=? OR email=? UNION ALL SELECT 1 FROM platform_settings WHERE setting_group='environment_runtime' AND setting_key<>? AND (JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.username'))=? OR JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.pendingUsername'))=?) UNION ALL SELECT 1 FROM platform_settings WHERE setting_group='network_manager_directory' AND JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.username'))=? LIMIT 1`,[username,username,username,username,key,username,username,username]);
 if(reserved.length)throw new Error('USERNAME_TAKEN');
 const passwordHash=await withNetwork(scope,async app=>{await validateLocalLicense(app,scope);await app.beginTransaction();try{
 const [rows]:any=await app.query("SELECT id,username,password_hash FROM managers WHERE id=? AND manager_type='principal' AND is_enabled=1 AND archived_at IS NULL FOR UPDATE",[token.sub]);const manager=rows[0];
 if(!manager||token.authVersion!==createHash('sha256').update(manager.password_hash).digest('hex'))throw new Error('NETWORK_AUTH');
 const recovering=state.pendingUsername===manager.username;
 if(!recovering&&(!state.credentialsExpiresAt||new Date(state.credentialsExpiresAt).getTime()<=Date.now()))throw new Error('CREDENTIALS_EXPIRED');
 if(!recovering&&(username===manager.username||await bcrypt.compare(password,manager.password_hash)))throw new Error('CREDENTIALS_REUSE');
 const [local]:any=await app.query('SELECT id FROM managers WHERE username=? AND id<>? LIMIT 1',[username,manager.id]);if(local.length)throw new Error('USERNAME_TAKEN');
 // Persist the new directory alias first, so a failed central finalization is resumable.
 state.pendingUsername=username;await savePrivateSetting('environment_runtime',key,state);
 const hash=await bcrypt.hash(password,12);await app.query('UPDATE managers SET username=?,password_hash=? WHERE id=?',[username,hash,manager.id]);await auditNetworkEvent(app,{action:'auth.initial_credentials.update',managerId:Number(manager.id)});await app.commit();return hash;
 }catch(e){await app.rollback();throw e;}});
 state.username=username;state.mustChangeCredentials=false;state.credentialsChangedAt=new Date().toISOString();delete state.pendingUsername;delete state.passwordEncrypted;delete state.credentialsExpiresAt;
 await savePrivateSetting('environment_runtime',key,state);
 return jwt.sign({kind:'network-manager',tenantId:scope.tenant_id,environmentId:scope.environment_id,authVersion:createHash('sha256').update(passwordHash).digest('hex'),sub:String(token.sub),slug:scope.slug},env.JWT_SECRET,{algorithm:'HS256',expiresIn:'20m'});
 }finally{if(locked)await central.query("SELECT RELEASE_LOCK('radius-lord:manager-credentials')");central.release();}
}
