import {randomBytes,createHash,timingSafeEqual} from 'crypto';
import bcrypt from 'bcryptjs';
import {db} from '../config/db';
import {networkScope,withNetwork,validateLocalLicense} from './network-runtime.service';
import {readPrivateSetting} from './radius-provision.service';
import {encryptProvisioningSecret,decryptProvisioningSecret} from './provisioning-secrets.service';
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function activationLink(scope:{environment_id:number;tenant_id:number;subscription_id:number;system_url:string},expiresAt:string){
 const central=await db.pool.getConnection();
 try{await central.beginTransaction();const [environments]:any=await central.query('SELECT status,archived_at FROM tenant_environments WHERE id=? FOR UPDATE',[scope.environment_id]);if(!environments[0]||environments[0].archived_at||environments[0].status!=='ready')throw new Error('ACTIVATION_LINK_UNAVAILABLE');
 const [rows]:any=await central.query("SELECT setting_value FROM platform_settings WHERE setting_group='environment_activation' AND setting_key=? FOR UPDATE",['environment_'+scope.environment_id]);
 let state=rows[0]?JSON.parse(rows[0].setting_value):null;
 if(state&&(state.tenantId!==Number(scope.tenant_id)||state.subscriptionId!==Number(scope.subscription_id)||state.consumedAt))throw new Error('ACTIVATION_LINK_UNAVAILABLE');
 if(!state){const token=randomBytes(32).toString('base64url');state={tenantId:Number(scope.tenant_id),subscriptionId:Number(scope.subscription_id),tokenHash:hash(token),tokenEncrypted:encryptProvisioningSecret(token),expiresAt};await central.query("INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public) VALUES ('environment_activation',?,?,'json',0)",['environment_'+scope.environment_id,JSON.stringify(state)]);}
 if(new Date(state.expiresAt).getTime()<=Date.now())throw new Error('ACTIVATION_LINK_EXPIRED');
 await central.commit();return{url:scope.system_url+'#activate='+decryptProvisioningSecret(state.tokenEncrypted),expiresAt:state.expiresAt};
 }catch(e){await central.rollback();throw e;}finally{central.release();}
}
export async function consumeActivation(slug:string,token:string,password:string){
 if(!/^[A-Za-z0-9_-]{43}$/.test(token)||password.length<8||password.length>128)throw new Error('ACTIVATION_INVALID');
 const scope=await networkScope(slug),central=await db.pool.getConnection();
 try{await central.beginTransaction();const [environment]:any=await central.query('SELECT archived_at,status FROM tenant_environments WHERE id=? FOR UPDATE',[scope.environment_id]);if(!environment[0]||environment[0].archived_at||environment[0].status!=='ready')throw new Error('ACTIVATION_INVALID');
 const key='environment_'+scope.environment_id;const [rows]:any=await central.query("SELECT setting_value FROM platform_settings WHERE setting_group='environment_activation' AND setting_key=? FOR UPDATE",[key]);const state=rows[0]?JSON.parse(rows[0].setting_value):null;
 if(!state||state.consumedAt||state.tenantId!==Number(scope.tenant_id)||state.subscriptionId!==Number(scope.subscription_id)||new Date(state.expiresAt).getTime()<=Date.now())throw new Error('ACTIVATION_INVALID');
 const actual=Buffer.from(hash(token),'hex'),expected=Buffer.from(state.tokenHash,'hex');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error('ACTIVATION_INVALID');
 const runtime=await readPrivateSetting('environment_runtime',key);if(!runtime||runtime.tenantId!==Number(scope.tenant_id)||runtime.subscriptionId!==Number(scope.subscription_id))throw new Error('ACTIVATION_INVALID');
 const passwordHash=await bcrypt.hash(password,12);await withNetwork(scope,async connection=>{await validateLocalLicense(connection,scope);const [result]:any=await connection.query("UPDATE managers SET password_hash=? WHERE username=? AND manager_type='principal' AND is_enabled=1 AND archived_at IS NULL",[passwordHash,runtime.username]);if(result.affectedRows!==1)throw new Error('ACTIVATION_MANAGER');});
 state.consumedAt=new Date().toISOString();delete state.tokenEncrypted;await central.query("UPDATE platform_settings SET setting_value=? WHERE setting_group='environment_activation' AND setting_key=?",[JSON.stringify(state),key]);delete runtime.passwordEncrypted;delete runtime.credentialsExpiresAt;await central.query("UPDATE platform_settings SET setting_value=? WHERE setting_group='environment_runtime' AND setting_key=?",[JSON.stringify(runtime),key]);await central.commit();return runtime.username;
 }catch(e){await central.rollback();throw e;}finally{central.release();}
}
