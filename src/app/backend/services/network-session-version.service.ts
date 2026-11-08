import {createHash,randomUUID} from 'crypto';
import {db} from '../config/db';
import {revokeCentralSession} from './central-session.service';
export function networkSessionId(token:any){
 if(typeof token.jti==='string'&&/^(?:[a-f0-9-]{36}|[a-f0-9]{64})$/.test(token.jti))return token.jti;
 if(!Number.isInteger(token.iat))throw new Error('NETWORK_AUTH');
 return createHash('sha256').update(JSON.stringify([token.sub,token.tenantId,token.environmentId,token.iat,token.authVersion])).digest('hex');
}
export async function revokeNetworkSession(token:any){
 await revokeCentralSession('network_'+networkSessionId(token),Number(token.exp));
}
export async function networkSessionVersion(scope:any,managerId:number,token?:any){
 if(token){
  const [rows]:any=await db.query(`SELECT
   (SELECT setting_value FROM platform_settings WHERE setting_group='network_session_versions' AND setting_key=?) version,
   EXISTS(SELECT 1 FROM platform_settings WHERE setting_group='auth_revoked_sessions' AND setting_key=?) revoked`,
   ['manager_'+scope.environment_id+'_'+managerId,'network_'+networkSessionId(token)]);
  if(Number(rows[0]?.revoked)===1)throw new Error('NETWORK_AUTH');
  return rows[0]?.version||'0';
 }
 const [rows]:any=await db.query("SELECT setting_value FROM platform_settings WHERE setting_group='network_session_versions' AND setting_key=?",['manager_'+scope.environment_id+'_'+managerId]);return rows[0]?.setting_value||'0';
}
export async function invalidateNetworkManager(central:any,scope:any,managerId:number){await central.query("INSERT INTO platform_settings(setting_group,setting_key,setting_value) VALUES('network_session_versions',?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",['manager_'+scope.environment_id+'_'+managerId,randomUUID()]);}
