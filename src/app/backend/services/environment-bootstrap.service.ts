import {readEnvironmentNasLink,directNasSchema} from './environment-nas-link.service';
import {randomBytes} from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import type {PoolConnection} from 'mysql2/promise';
import {db} from '../config/db';
import {env} from '../config/env';
import {encryptProvisioningSecret,decryptProvisioningSecret,provisioningKey} from './provisioning-secrets.service';
import {readPrivateSetting,savePrivateSetting,applyRadiusDatabase,radiusDatabaseHost,grantRadiusAccounts,radiusAccountHosts,verifyRadiusDatabase} from './radius-provision.service';
import {validLimits} from './subscription-environment.service';
import {licenseSignature,validateLocalLicense} from './network-runtime.service';
import {saveNetworkOvpn,createNetworkNas,provisionNetworkNas,reserveNetworkNasCapacity,nasRadiusClients,markNasRadiusConfigured,purchasedNasCapacity,radiusIpv4} from './network-ovpn.service';
import {syncRadiusOvpnRoutes} from './radius-ovpn-routes.service';
import {readHostingPreflight} from './hosting-preflight.service';
type Step=(code:string,operation:()=>Promise<void>,alwaysRun?:boolean)=>Promise<void>;
const fail=(code:string)=>{throw new Error(code);};
async function verifyApplicationRequest<T>(stage: 'PAGE' | 'LOGIN', request: (signal: AbortSignal) => Promise<T>): Promise<T> {
 for(let attempt=0;attempt<2;attempt++){
  const signal=AbortSignal.timeout(30000);
  try{return await request(signal);}
  catch(error){
   if(signal.aborted){
    if(attempt===0)continue;
    throw new Error(`NETWORK_APPLICATION_${stage}_TIMEOUT`);
   }
   if(error instanceof TypeError)throw new Error(`NETWORK_APPLICATION_${stage}_UNREACHABLE`);
   throw error;
  }
 }
 throw new Error(`NETWORK_APPLICATION_${stage}_TIMEOUT`);
}
const utcSql=(date:Date|null)=>date?date.toISOString().slice(0,19).replace('T',' '):null;
export async function writeLocalLicense(connection:mysql.Connection,scope:any,status:'pending'|'active',startsAt:Date|null=null,expiresAt:Date|null=null){
 const limits=validLimits(scope.plan_limits_snapshot);if(!limits)fail('LICENSE_LIMITS_REQUIRED');
 const [existing]:any=await connection.query('SELECT central_tenant_id,license_number FROM platform_subscription WHERE id=1');if(existing[0]&&(Number(existing[0].central_tenant_id)!==Number(scope.tenant_id)||existing[0].license_number!==scope.license_number))fail('NETWORK_LICENSE_SCOPE');
 if((startsAt===null)!==(expiresAt===null)||startsAt&&expiresAt&&(!Number.isFinite(startsAt.getTime())||!Number.isFinite(expiresAt.getTime())||expiresAt<=startsAt))fail('LICENSE_PERIOD_INVALID');
 startsAt=startsAt?new Date(Math.floor(startsAt.getTime()/1000)*1000):null;expiresAt=expiresAt?new Date(Math.floor(expiresAt.getTime()/1000)*1000):null;
 const payload=JSON.stringify({dateEncoding:'utc',planName:scope.plan_name_snapshot,durationMonths:Number(scope.duration_months_snapshot),tenantId:Number(scope.tenant_id),subscriptionId:Number(scope.subscription_id),license:scope.license_number,status,maxSubscribers:limits!.maxSubscribers,maxNas:limits!.maxNas,additionalNas:scope.additionalNas??0,startsAt:startsAt?.toISOString()??null,expiresAt:expiresAt?.toISOString()??null});
 await connection.query(`INSERT INTO platform_subscription (id,central_tenant_id,central_subscription_id,license_number,license_status,subscription_status,plan_name_snapshot,deployment_code,max_pppoe_accounts,base_max_nas,additional_nas_capacity,duration_months_snapshot,activated_at,starts_at,expires_at,sync_version,synced_at,signed_payload,payload_signature,signing_key_id) VALUES (1,?,?,?,?,?,?,'shared_cloud',?,?,?,?,?,?,?,1,UTC_TIMESTAMP(),?,?,?) ON DUPLICATE KEY UPDATE sync_version=sync_version+IF(NOT(signed_payload<=>VALUES(signed_payload)) OR NOT(plan_name_snapshot<=>VALUES(plan_name_snapshot)) OR NOT(duration_months_snapshot<=>VALUES(duration_months_snapshot)),1,0),central_subscription_id=VALUES(central_subscription_id),plan_name_snapshot=VALUES(plan_name_snapshot),deployment_code=VALUES(deployment_code),max_pppoe_accounts=VALUES(max_pppoe_accounts),base_max_nas=VALUES(base_max_nas),duration_months_snapshot=VALUES(duration_months_snapshot),license_status=VALUES(license_status),subscription_status=VALUES(subscription_status),additional_nas_capacity=VALUES(additional_nas_capacity),activated_at=COALESCE(activated_at,VALUES(activated_at)),starts_at=VALUES(starts_at),expires_at=VALUES(expires_at),signed_payload=VALUES(signed_payload),payload_signature=VALUES(payload_signature),synced_at=UTC_TIMESTAMP()`,[scope.tenant_id,scope.subscription_id,scope.license_number,status,status,scope.plan_name_snapshot,limits!.maxSubscribers,limits!.maxNas,scope.additionalNas??0,scope.duration_months_snapshot,status==='active'?utcSql(startsAt):null,utcSql(startsAt),utcSql(expiresAt),JSON.stringify(payload),licenseSignature(payload),'gateway-key-v1']);
}
export async function completeEnvironment(options:{central:PoolConnection;admin:mysql.Connection;app:mysql.Connection;job:any;database:any;server:any;selection:any;step:Step;activationStarted:()=>Promise<void>;audit:(event:string)=>Promise<void>}){
 const {central,admin,app,job,database:d,server,selection,step,audit}=options;
 const [rows]:any=await central.query(`SELECT t.id tenant_id,t.name,t.slug,t.license_number,s.id subscription_id,s.plan_limits_snapshot,s.duration_months_snapshot,dt.code deployment_code,p.plan_name_snapshot,c.full_name owner_name FROM tenants t JOIN subscriptions s ON s.tenant_id=t.id AND s.id=? JOIN payment_orders p ON p.id=? AND p.tenant_id=t.id AND p.subscription_id=s.id JOIN customers c ON c.id=t.customer_id JOIN deployment_types dt ON dt.id=s.deployment_type_id WHERE t.id=?`,[job.subscription_id,job.payment_order_id,job.tenant_id]);
 const scope=rows[0];if(!scope)fail('BOOTSTRAP_SCOPE_REQUIRED');if(scope.deployment_code!=='shared_cloud')fail('ENVIRONMENT_DEPLOYMENT_NOT_SUPPORTED');scope.environment_id=Number(job.environment_id);scope.additionalNas=await purchasedNasCapacity(central,scope);
 const key='environment_'+job.environment_id;
 let state=await readPrivateSetting('environment_runtime',key);
 if(state&&(state.tenantId!==Number(job.tenant_id)||state.subscriptionId!==Number(job.subscription_id)||state.radiusServerId!==selection.radiusServerId))fail('BOOTSTRAP_STATE_CHANGED');
 if(!state){state={tenantId:Number(job.tenant_id),subscriptionId:Number(job.subscription_id),radiusServerId:selection.radiusServerId,username:'setup_'+randomBytes(8).toString('hex'),mustChangeCredentials:true,passwordEncrypted:encryptProvisioningSecret(randomBytes(24).toString('base64url')),radiusUsername:'rl_health_'+job.environment_id,radiusPasswordEncrypted:encryptProvisioningSecret(randomBytes(24).toString('hex')),radiusSecretEncrypted:encryptProvisioningSecret(randomBytes(32).toString('hex')),authPort:20000+Number(job.environment_id)*2,accountingPort:20001+Number(job.environment_id)*2};if(state.accountingPort>65535)fail('RADIUS_PORT_CAPACITY');await savePrivateSetting('environment_runtime',key,state);}
 const password=decryptProvisioningSecret(state.passwordEncrypted);
 await step('network_manager',async()=>{
  const [managers]:any=await app.query("SELECT id,username,password_hash FROM managers WHERE manager_type='principal' LIMIT 1");
  if(managers[0]){if(managers[0].username!==state.username||!await bcrypt.compare(password,managers[0].password_hash))fail('NETWORK_PRINCIPAL_CONFLICT');}
  else await app.query("INSERT INTO managers (full_name,username,password_hash,manager_type,is_enabled) VALUES (?,?,?,'principal',1)",[scope.owner_name,state.username,await bcrypt.hash(password,12)]);
 });
 await step('network_license',async()=>{const [licenses]:any=await app.query('SELECT central_tenant_id,central_subscription_id,license_number FROM platform_subscription WHERE id=1');if(licenses[0]&&(Number(licenses[0].central_tenant_id)!==Number(job.tenant_id)||Number(licenses[0].central_subscription_id)!==Number(job.subscription_id)||licenses[0].license_number!==scope.license_number))fail('NETWORK_LICENSE_CONFLICT');await writeLocalLicense(app,scope,'pending');await validateLocalLicense(app,scope,true);});
 const [radiusRows]:any=await db.query("SELECT setting_value FROM platform_settings WHERE id=? AND setting_group='free_radius'",[selection.radiusServerId]);const radiusConfig=radiusRows[0]?JSON.parse(radiusRows[0].setting_value):null;
 if(!radiusConfig||!radiusConfig.sshServerId||Number(radiusConfig.sshServerId)!==Number(selection.radiusSshServerId))fail('RADIUS_SSH_SELECTION_REQUIRED');
 if(server.tls_required)fail('RADIUS_AUTOMATION_REQUIRES_LOCAL_MYSQL_WITHOUT_TLS');
 const nasLink=await readEnvironmentNasLink(central,job);
 await step('network_ovpn',async()=>{
  if(nasLink.mode==='direct'){
   const limits=validLimits(scope.plan_limits_snapshot)!;
   const snapshot={version:1,connectionMode:'direct',tenantId:Number(scope.tenant_id),subscriptionId:Number(scope.subscription_id),environmentId:Number(job.environment_id),deployment:scope.deployment_code,gatewayId:0,radiusServerId:Number(selection.radiusServerId),radiusAddress:await radiusIpv4(radiusConfig.host),authPort:state.authPort,accountingPort:state.accountingPort,maxNas:limits.maxNas,additionalNas:scope.additionalNas};
   await admin.query(directNasSchema);await saveNetworkOvpn(admin,app,snapshot);
   const [principal]:any=await app.query("SELECT id FROM managers WHERE manager_type='principal' AND archived_at IS NULL");if(!principal[0])fail('NETWORK_PRINCIPAL_REQUIRED');
   const nasId=await createNetworkNas(app,scope,Number(principal[0].id),snapshot,{...nasLink,name:'الخادم الأول',requestId:'initial_nas_v1'});
   await provisionNetworkNas(central,app,scope,nasId,snapshot);return;
  }
  const [gateways]:any=await central.query('SELECT settings_json FROM ovpn_gateways WHERE id=?',[selection.gatewayId]);if(!gateways[0])fail('OVPN_GATEWAY_REQUIRED');const g=typeof gateways[0].settings_json==='string'?JSON.parse(gateways[0].settings_json):gateways[0].settings_json;
  const limits=validLimits(scope.plan_limits_snapshot)!;
  const snapshot={version:1,tenantId:Number(scope.tenant_id),subscriptionId:Number(scope.subscription_id),environmentId:Number(job.environment_id),deployment:scope.deployment_code,gatewayId:Number(selection.gatewayId),radiusServerId:Number(selection.radiusServerId),host:g.ovpn_host,port:Number(g.ovpn_port),protocol:'tcp',profile:g.ppp_profile,cidr:g.tunnel_cidr,serverAddress:g.server_tunnel_address,serverCertificate:g.certificate_name,radiusAddress:await radiusIpv4(radiusConfig.host),authPort:state.authPort,accountingPort:state.accountingPort,maxNas:limits.maxNas,additionalNas:scope.additionalNas};
  await saveNetworkOvpn(admin,app,snapshot);
  const [principal]:any=await app.query("SELECT id FROM managers WHERE manager_type='principal' AND archived_at IS NULL");if(!principal[0])fail('NETWORK_PRINCIPAL_REQUIRED');
  const nasId=await createNetworkNas(app,scope,Number(principal[0].id),snapshot,{name:'الخادم الأول',requestId:'initial_nas_v1'});
  await provisionNetworkNas(central,app,scope,nasId,snapshot);
  await syncRadiusOvpnRoutes(central,Number(radiusConfig.sshServerId),Number(scope.environment_id));
  const nasCapacity=limits.maxNas===0?0:limits.maxNas+scope.additionalNas;
  await reserveNetworkNasCapacity(central,scope,snapshot,nasCapacity);
 },true);

 await step('network_radius',async()=>{
  state.radiusAccountHosts=await radiusAccountHosts(server,radiusConfig.host);state.radiusSshServerId=selection.radiusSshServerId;await savePrivateSetting('environment_runtime',key,state);
  await grantRadiusAccounts(admin,server,radiusConfig.host,d.radius_username,decryptProvisioningSecret(d.radius_password_encrypted),d.db_name);
  const [checks]:any=await app.query("SELECT value FROM radcheck WHERE username=? AND attribute='Cleartext-Password'",[state.radiusUsername]);
  if(checks.length&&checks.some((r:any)=>r.value!==decryptProvisioningSecret(state.radiusPasswordEncrypted)))fail('RADIUS_TEST_ACCOUNT_CONFLICT');
  if(!checks.length)await app.query("INSERT INTO radcheck (username,attribute,op,value) VALUES (?,'Cleartext-Password',':=',?)",[state.radiusUsername,decryptProvisioningSecret(state.radiusPasswordEncrypted)]);
  await applyRadiusDatabase({sshServerId:radiusConfig.sshServerId,radiusHost:radiusConfig.host,databaseHost:await radiusDatabaseHost(server,radiusConfig.host),databasePort:server.port,databaseName:d.db_name,username:d.radius_username,password:decryptProvisioningSecret(d.radius_password_encrypted),authPort:state.authPort,accountingPort:state.accountingPort,name:'rl_env_'+job.environment_id,secret:decryptProvisioningSecret(state.radiusSecretEncrypted),clients:await nasRadiusClients(app)});
  await markNasRadiusConfigured(app);
 },true);
 await step('network_radius_verify',async()=>{
  try {
   await verifyRadiusDatabase({host:radiusConfig.host,authPort:state.authPort,accountingPort:state.accountingPort,secretEncrypted:state.radiusSecretEncrypted,testUsername:state.radiusUsername,testPasswordEncrypted:state.radiusPasswordEncrypted},app);
  } finally {
   // Remove the temporary principal and any records written by the RADIUS probe.
   await app.query('DELETE FROM radcheck WHERE username=?',[state.radiusUsername]);
   await app.query('DELETE FROM radacct WHERE username=?',[state.radiusUsername]);
   await app.query('DELETE FROM radpostauth WHERE username=?',[state.radiusUsername]);
  }
 },true);
 await step('network_database_isolation',async()=>{
  const [databases]:any=await central.query('SELECT db_name FROM tenant_databases WHERE database_server_id=? AND tenant_id<>? AND credentials_state=?',[server.id,job.tenant_id,'ready']);
  for(const sql of ['SELECT 1 FROM mysql.user LIMIT 1',...databases.map((other:any)=>{if(!/^rl_tenant_(?:zone_[0-9]+|[0-9]+_[a-f0-9]{16})$/.test(other.db_name))fail('ISOLATION_DATABASE_NAME');return `SELECT 1 FROM \`${other.db_name}\`.managers LIMIT 1`;})]){
   let denied=false;try{await app.query({sql,timeout:5000});}catch(e){denied=['ER_TABLEACCESS_DENIED_ERROR','ER_DBACCESS_DENIED_ERROR'].includes((e as any).code);}if(!denied)fail('NETWORK_DATABASE_ISOLATION_FAILED');
  }
 },true);
 const hosting=await readHostingPreflight((sql,params)=>central.query(sql,params));
 const url=hosting.baseUrl+'/network/'+scope.slug;
 await step('network_application_verify',async()=>{
  await verifyApplicationRequest('PAGE',async signal=>{
   const page=await fetch(url,{redirect:'error',signal});
   await page.body?.cancel();
   if(!page.ok)fail('NETWORK_PAGE_NOT_AVAILABLE');
  });
  const nonce=randomBytes(16).toString('hex');const proof=jwt.sign({kind:'network-bootstrap',slug:scope.slug,environmentId:job.environment_id,jobId:job.id,nonce},provisioningKey(),{algorithm:'HS256',expiresIn:'2m'});
  await verifyApplicationRequest('LOGIN',async signal=>{
   const response=await fetch(hosting.baseUrl+'/api/network/'+scope.slug+'/verify',{method:'POST',headers:{'Content-Type':'application/json','x-provisioning-proof':proof},body:JSON.stringify({username:state.username,password}),redirect:'error',signal});
   if(!response.ok){await response.body?.cancel();fail('NETWORK_APPLICATION_LOGIN_FAILED');}
   const report:any=await response.json().catch(error=>{
    if(signal.aborted)throw error;
    throw new Error('NETWORK_APPLICATION_LOGIN_INVALID_RESPONSE');
   });
   if(report?.application!=='radius-lord-network'||Number(report.environmentId)!==Number(job.environment_id)||Number(report.tenantId)!==Number(job.tenant_id)||report.nonce!==nonce)fail('NETWORK_APPLICATION_LOGIN_FAILED');
  });
 },true);
 // One central transaction activates network/license/subscription/job. Local activation remains inaccessible until commit.
 await options.activationStarted();
 await central.beginTransaction();
 try{
  const [locked]:any=await central.query("SELECT s.status,s.starts_at,s.expires_at,s.duration_months_snapshot FROM subscriptions s JOIN payment_orders p ON p.subscription_id=s.id AND p.tenant_id=s.tenant_id WHERE s.id=? AND s.tenant_id=? AND p.id=? AND p.status IN ('paid','completed','manual_authorized') FOR UPDATE",[job.subscription_id,job.tenant_id,job.payment_order_id]);
  if(!locked[0]||locked[0].status!=='pending'||locked[0].starts_at||locked[0].expires_at)fail('ENVIRONMENT_ACTIVATION_CONFLICT');
  const [times]:any=await central.query('SELECT NOW() starts_at,DATE_ADD(NOW(),INTERVAL ? MONTH) expires_at',[scope.duration_months_snapshot]);
  await writeLocalLicense(app,scope,'active',new Date(times[0].starts_at),new Date(times[0].expires_at));
  await central.query("UPDATE subscriptions SET status='active',starts_at=?,expires_at=? WHERE id=? AND tenant_id=?",[times[0].starts_at,times[0].expires_at,job.subscription_id,job.tenant_id]);
  await central.query("UPDATE subscription_licenses SET status='active' WHERE tenant_id=? AND subscription_id=?",[job.tenant_id,job.subscription_id]);
  await central.query("UPDATE tenants SET status='active' WHERE id=?",[job.tenant_id]);
  await central.query("UPDATE tenant_environments SET status='ready',ready_at=NOW(),system_url=? WHERE id=? AND tenant_id=?",[url,job.environment_id,job.tenant_id]);
  if(hosting.mode==='local_ip'){
   await central.query("INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public) VALUES ('network_quick_setup',?,'1','json',0) ON DUPLICATE KEY UPDATE setting_key=VALUES(setting_key)",[key]);
  }
  await central.query("UPDATE tenant_environment_status SET database_status='healthy',radius_status='healthy',reported_at=NOW(),last_seen_at=NOW() WHERE environment_id=?",[job.environment_id]);
  await central.query("UPDATE subscription_addons SET status='active' WHERE subscription_id=? AND tenant_id=? AND status='pending'",[job.subscription_id,job.tenant_id]);
  await central.query("UPDATE environment_provisioning_jobs SET status='success',current_step='environment_activation',finished_at=NOW(),error_code=NULL,error_message=NULL WHERE id=?",[job.id]);
  await central.query("INSERT INTO environment_provisioning_steps (job_id,step_code,status,attempt_count,started_at,finished_at) VALUES (?,'environment_activation','success',1,NOW(),NOW()) ON DUPLICATE KEY UPDATE status='success',finished_at=NOW()",[job.id]);
  // Password delivery is manual and time-limited; database/SSH secrets are never returned.
  state.credentialsExpiresAt=new Date(Date.now()+86400000).toISOString();await savePrivateSetting('environment_runtime',key,state);
  await audit('environment_activated');await central.commit();
 }catch(e){await central.rollback();throw e;}
 return {url};
}

