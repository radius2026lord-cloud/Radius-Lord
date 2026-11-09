import mysql from 'mysql2/promise';
import {createHash,createHmac,timingSafeEqual} from 'crypto';
import {db} from '../config/db';
import {decryptProvisioningSecret,provisioningKey} from './provisioning-secrets.service';
let connections=0;
type ConnectionWaiter={grant:()=>void;timer:ReturnType<typeof setTimeout>};
const connectionWaiters:ConnectionWaiter[]=[];
// Queue short bursts from page reloads without increasing database concurrency.
async function acquireNetworkConnection(){
 if(connections<24){connections++;return;}
 if(connectionWaiters.length>=96)throw new Error('NETWORK_CONNECTIONS_BUSY');
 await new Promise<void>((resolve,reject)=>{
  const waiter:ConnectionWaiter={grant:resolve,timer:setTimeout(()=>{
   const index=connectionWaiters.indexOf(waiter);
   if(index>=0)connectionWaiters.splice(index,1);
   reject(new Error('NETWORK_CONNECTIONS_BUSY'));
  },15000)};
  connectionWaiters.push(waiter);
 });
}
function releaseNetworkConnection(){
 const waiter=connectionWaiters.shift();
 if(waiter){clearTimeout(waiter.timer);waiter.grant();}
 else connections--;
}
type NetworkPool={pool:mysql.Pool;users:number};
const networkPools=new Map<string,NetworkPool>();
function networkPool(scope:any){
 const key=createHash('sha256').update(JSON.stringify([scope.tenant_id,scope.environment_id,scope.database_host,scope.database_port,scope.db_name,scope.db_username,scope.app_password_encrypted,scope.tls_required])).digest('hex');
 const existing=networkPools.get(key);
 if(existing){networkPools.delete(key);networkPools.set(key,existing);return existing;}
 if(networkPools.size>=32){
  const idle=Array.from(networkPools).find(([,entry])=>entry.users===0);
  if(!idle)throw new Error('NETWORK_CONNECTIONS_BUSY');
  networkPools.delete(idle[0]);void idle[1].pool.end().catch(()=>{});
 }
 const entry:NetworkPool={users:0,pool:mysql.createPool({host:scope.database_host,port:scope.database_port,user:scope.db_username,password:decryptProvisioningSecret(scope.app_password_encrypted),database:scope.db_name,connectTimeout:8000,connectionLimit:2,maxIdle:1,idleTimeout:60000,waitForConnections:true,queueLimit:24,enableKeepAlive:true,...(scope.tls_required?{ssl:{rejectUnauthorized:true}}:{})})};
 networkPools.set(key,entry);return entry;
}
export async function networkScope(slug:string,provisioning=false,subscriptionAccess=false){
 if(!/^network-[a-f0-9]{24}$/.test(slug))throw new Error('NETWORK_NOT_AVAILABLE');
 const [rows]:any=await db.query(`SELECT t.id tenant_id,t.slug,t.name,t.status tenant_status,t.license_number,e.id environment_id,e.status environment_status,d.*,ds.host database_host,ds.port database_port,ds.tls_required,ds.tls_ca_reference,s.id subscription_id,s.status subscription_status,s.expires_at,l.status license_status FROM tenants t JOIN tenant_environments e ON e.tenant_id=t.id JOIN tenant_databases d ON d.id=e.tenant_database_id AND d.tenant_id=t.id JOIN database_servers ds ON ds.id=d.database_server_id JOIN subscription_licenses l ON l.tenant_id=t.id JOIN subscriptions s ON s.id=l.subscription_id AND s.tenant_id=t.id WHERE t.slug=? AND t.archived_at IS NULL AND e.archived_at IS NULL AND ds.archived_at IS NULL AND ds.status='active' AND d.status='active' AND d.credentials_state='ready' ORDER BY e.id DESC,s.id DESC LIMIT 1`,[slug]);
 const scope=rows[0];if(!scope||scope.tls_ca_reference)throw new Error('NETWORK_NOT_AVAILABLE');
 if(provisioning){if(scope.environment_status!=='provisioning'||scope.subscription_status!=='pending')throw new Error('NETWORK_NOT_PROVISIONING');}
 else if(scope.environment_status!=='ready'||scope.tenant_status!=='active'||!(subscriptionAccess?['active','expired']:['active']).includes(scope.subscription_status)||!(subscriptionAccess?['active','expired']:['active']).includes(scope.license_status)||!scope.expires_at||(!subscriptionAccess&&new Date(scope.expires_at).getTime()<=Date.now()))throw new Error('NETWORK_NOT_AVAILABLE');
 return scope;
}
export function licenseSignature(payload:string){return createHmac('sha256',provisioningKey()).update('radius-lord:network-license:v1\0').update(payload).digest('hex');}
// UTC writes are compared as SQL text, independent of the Node host timezone.
// Existing signed licenses retain their historical driver interpretation; never shift data on read.
function licenseDateMatches(signed:any,value:any,utcText:any,utcOnly=false){
 if(signed===null)return value===null;
 if(typeof signed!=='string'||!Number.isFinite(Date.parse(signed)))return false;
 if(signed===utcText)return true;
 if(utcOnly)return false;
 const legacy=value?new Date(value):null;
 return Boolean(legacy&&Number.isFinite(legacy.getTime())&&legacy.toISOString()===signed);
}
export async function validateLocalLicense(connection:mysql.Connection,scope:any,provisioning=false,subscriptionAccess=false){
 const [rows]:any=await connection.query("SELECT *,DATE_FORMAT(starts_at,'%Y-%m-%dT%H:%i:%s.000Z') starts_at_utc_text,DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%s.000Z') expires_at_utc_text FROM platform_subscription WHERE id=1");const license=rows[0];
 if(!license||Number(license.central_tenant_id)!==Number(scope.tenant_id)||Number(license.central_subscription_id)!==Number(scope.subscription_id)||license.license_number!==scope.license_number)throw new Error('NETWORK_LICENSE_SCOPE');
 const payload=typeof license.signed_payload==='string'?license.signed_payload:JSON.stringify(license.signed_payload);
 // Canonical payload is serialized as a string inside JSON to preserve its exact signature bytes.
 const parsed=JSON.parse(payload);const serialized=typeof parsed==='string'?parsed:JSON.stringify(parsed);
 const expected=Buffer.from(licenseSignature(serialized),'hex'),actual=Buffer.from(license.payload_signature,'hex');if(actual.length!==expected.length||!timingSafeEqual(expected,actual))throw new Error('NETWORK_LICENSE_SIGNATURE');
 const signed=JSON.parse(serialized);
 if(signed.dateEncoding==='utc'&&(signed.planName!==license.plan_name_snapshot||signed.durationMonths!==Number(license.duration_months_snapshot)))throw new Error('NETWORK_LICENSE_PAYLOAD');
 if(Number(signed.tenantId)!==Number(scope.tenant_id)||Number(signed.subscriptionId)!==Number(scope.subscription_id)||signed.license!==license.license_number||signed.status!==license.subscription_status||signed.maxSubscribers!==Number(license.max_pppoe_accounts)||signed.maxNas!==Number(license.base_max_nas)||signed.additionalNas!==Number(license.additional_nas_capacity)||!licenseDateMatches(signed.startsAt,license.starts_at,license.starts_at_utc_text,signed.dateEncoding==='utc')||!licenseDateMatches(signed.expiresAt,license.expires_at,license.expires_at_utc_text,signed.dateEncoding==='utc'))throw new Error('NETWORK_LICENSE_PAYLOAD');
 if(!provisioning&&(!(subscriptionAccess?['active','expired']:['active']).includes(license.subscription_status)||!(subscriptionAccess?['active','expired']:['active']).includes(license.license_status)||!signed.expiresAt||(!subscriptionAccess&&Date.parse(signed.expiresAt)<=Date.now())))throw new Error('NETWORK_LICENSE_EXPIRED');
 return {...license,canonicalStartsAt:signed.startsAt,canonicalExpiresAt:signed.expiresAt};
}
export async function withNetwork<T>(scope:any,operation:(connection:mysql.Connection)=>Promise<T>):Promise<T>{
 await acquireNetworkConnection();let connection:mysql.PoolConnection|undefined,entry:NetworkPool|undefined;
 try{
  entry=networkPool(scope);entry.users++;
  // Retry connection acquisition only; never replay an operation or transaction.
  for(let attempt=0;;attempt++){
   try{connection=await entry.pool.getConnection();break;}
   catch(error){
    const value=error as {code?:string;message?:string};
    const occupied=value.code==='ER_TOO_MANY_USER_CONNECTIONS'||value.code==='ER_USER_LIMIT_REACHED'&&/\bmax_user_connections\b/.test(value.message||'');
    if(!occupied||attempt>=3)throw error;
    await new Promise(resolve=>setTimeout(resolve,250*2**attempt+Math.floor(Math.random()*150)));
   }
  }
  const [name]:any=await connection.query({sql:'SELECT DATABASE() name',timeout:5000});
  if(name[0]?.name!==scope.db_name)throw new Error('NETWORK_DATABASE_SCOPE');
  return await operation(connection);
 }finally{
  try{
   if(connection){
    // Never return an unfinished transaction to another request.
    try{await connection.rollback();connection.release();}catch{connection.destroy();}
   }
  }finally{if(entry)entry.users--;releaseNetworkConnection();}
 }
}

