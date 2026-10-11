import {createHmac,timingSafeEqual} from 'crypto';
import jwt from 'jsonwebtoken';
import {db} from '../config/db';
import {env} from '../config/env';
export function centralAuthVersion(passwordHash:string){return createHmac('sha256',env.JWT_SECRET).update('radius-lord:central-session:v1\0'+passwordHash).digest('hex');}
export async function checkCentralSession(payload:any){
 const id=Number(payload.sub);
 if(!Number.isSafeInteger(id)||id<1||!['master_admin','customer'].includes(payload.accountType)||payload.kind!=='central-account'||payload.iss!=='radius-lord'||payload.aud!=='central'||!Number.isInteger(payload.exp)||payload.exp*1000<=Date.now()||typeof payload.jti!=='string'||!/^[a-f0-9-]{36}$/.test(payload.jti)||typeof payload.authVersion!=='string'||!Number.isInteger(payload.iat)||payload.exp-payload.iat>1200)throw new Error('CENTRAL_SESSION_INVALID');
 const table=payload.accountType==='master_admin'?'master_admins':'customers';
 const [rows]:any=await db.query(`SELECT a.password_hash,a.status,r.id revoked FROM ${table} a LEFT JOIN platform_settings r ON r.setting_group='auth_revoked_sessions' AND r.setting_key=? WHERE a.id=? LIMIT 1`,[payload.jti,id]);
 const account=rows[0];if(!account||account.status!=='active'||account.revoked)throw new Error('CENTRAL_SESSION_INVALID');
 const expected=Buffer.from(centralAuthVersion(account.password_hash),'hex'),actual=Buffer.from(payload.authVersion,'hex');if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw new Error('CENTRAL_SESSION_INVALID');
 return payload;
}
export async function verifyCentralSession(token:string){return checkCentralSession(jwt.verify(token,env.JWT_SECRET,{algorithms:['HS256'],issuer:'radius-lord',audience:'central'}));}
export async function revokeCentralSession(jti:string,expiresAt:number){
 await db.query("INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public) VALUES ('auth_revoked_sessions',?,?,'number',0) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[jti,String(expiresAt)]);
 await db.query("DELETE FROM platform_settings WHERE setting_group='auth_revoked_sessions' AND CAST(setting_value AS UNSIGNED)<UNIX_TIMESTAMP() LIMIT 200");
}
