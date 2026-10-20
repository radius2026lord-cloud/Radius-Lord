import {createHash,randomBytes,randomInt,X509Certificate,createPrivateKey,createPublicKey} from 'crypto';
import {lookup} from 'dns/promises';
import {createConnection} from 'net';
import type mysql from 'mysql2/promise';
import type {PoolConnection} from 'mysql2/promise';
import {db} from '../config/db';
import {env} from '../config/env';
import {RouterApi} from './routeros-api.service';
import {inspectRouter,preflightInventory,validateProvision,poolRanges} from './ovpn-provision.service';
import {encryptProvisioningSecret,decryptProvisioningSecret} from './provisioning-secrets.service';
const fail=(code:string):never=>{throw new Error(code);};
// Shared management API identity requested for every MikroTik NAS.
const managedNasApiUsername='lord',managedNasApiPassword='lord1224';
const ipNumber=(s:string)=>s.split('.').reduce((n,v)=>n*256+Number(v),0);
const isIpv4=(s:string)=>{const parts=s.split('.');return parts.length===4&&parts.every(part=>/^\d{1,3}$/.test(part)&&Number(part)>=0&&Number(part)<=255);};
const isPrivateIpv4=(s:string)=>{if(!isIpv4(s))return false;const p=s.split('.').map(Number);return p[0]===10||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168);};
// Probe the exact TCP path before attempting RouterOS API credentials.
// The kernel-selected source address is used only when the direct path is verified.
function probeNasApiTcp(host:string,port:number):Promise<{sourceAddress:string;targetAddress:string;elapsedMs:number}>{return new Promise((resolve,reject)=>{const started=Date.now(),socket=createConnection({host,port});let settled=false;const finish=(failure?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);const diagnostics={sourceAddress:String(socket.localAddress??''),targetAddress:String(socket.remoteAddress??host),elapsedMs:Date.now()-started};socket.removeAllListeners();socket.destroy();if(failure){(failure as Error&{diagnostics?:typeof diagnostics}).diagnostics=diagnostics;reject(failure);}else resolve(diagnostics);};const timer=setTimeout(()=>finish(new Error('NAS_API_TCP_TIMEOUT')),4000);socket.once('connect',()=>finish());socket.once('error',error=>{const code=(error as NodeJS.ErrnoException).code;finish(new Error(code==='ECONNREFUSED'?'NAS_API_TCP_REFUSED':code==='EHOSTUNREACH'||code==='ENETUNREACH'?'NAS_API_ROUTE_UNAVAILABLE':'NAS_API_TCP_FAILED'));});});}
const ipString=(n:number)=>[Math.floor(n/16777216),Math.floor(n/65536)%256,Math.floor(n/256)%256,n%256].join('.');
const yes=(v:string)=>v==='true'||v==='yes';
const revoked=(v:string)=>Boolean(v&&!['false','no'].includes(v));
export async function purchasedNasCapacity(central:PoolConnection,scope:any){
 const [rows]:any=await central.query("SELECT COALESCE(SUM(quantity*nas_capacity_increment),0) capacity FROM subscription_addons WHERE tenant_id=? AND subscription_id=? AND status IN ('pending','active') AND (expires_at IS NULL OR expires_at>NOW())",[scope.tenant_id,scope.subscription_id]);
 const capacity=Number(rows[0].capacity);if(!Number.isSafeInteger(capacity)||capacity<0)fail('NAS_CAPACITY_INVALID');return capacity;
}
// Additive schema: the pinned tenant template remains unchanged for retrying jobs.
export async function saveNetworkOvpn(admin:mysql.Connection,app:mysql.Connection,snapshot:any){
 await admin.query("CREATE TABLE IF NOT EXISTS network_ovpn_settings (id TINYINT UNSIGNED NOT NULL PRIMARY KEY,configuration_snapshot JSON NOT NULL,synced_at DATETIME(6) NOT NULL,CONSTRAINT chk_network_ovpn_id CHECK(id=1 AND JSON_TYPE(configuration_snapshot)='OBJECT')) ENGINE=InnoDB");
 const [rows]:any=await app.query('SELECT configuration_snapshot FROM network_ovpn_settings WHERE id=1');
 if(rows[0]){const old=typeof rows[0].configuration_snapshot==='string'?JSON.parse(rows[0].configuration_snapshot):rows[0].configuration_snapshot;if(Object.keys(old).length!==Object.keys(snapshot).length||Object.keys(snapshot).some(k=>old[k]!==snapshot[k]))fail('NETWORK_OVPN_SNAPSHOT_CHANGED');}
 else await app.query('INSERT INTO network_ovpn_settings VALUES (1,?,NOW(6))',[JSON.stringify(snapshot)]);
 await app.query('UPDATE network_settings SET radius_server_address=? WHERE id=1',[snapshot.radiusAddress]);
}
export async function readNetworkOvpn(app:mysql.Connection){
 const [tables]:any=await app.query("SHOW TABLES LIKE 'network\\_ovpn\\_settings'");if(!tables.length)return null;
 const [rows]:any=await app.query('SELECT configuration_snapshot FROM network_ovpn_settings WHERE id=1');return rows[0]?typeof rows[0].configuration_snapshot==='string'?JSON.parse(rows[0].configuration_snapshot):rows[0].configuration_snapshot:null;
}
async function gateway(central:PoolConnection,id:number,requireReady=true){
 const [rows]:any=await central.query('SELECT settings_json,api_password_encrypted FROM ovpn_gateways WHERE id=?',[id]);if(!rows[0])fail('OVPN_GATEWAY_REQUIRED');
 const g=typeof rows[0].settings_json==='string'?JSON.parse(rows[0].settings_json):rows[0].settings_json;
 if(requireReady&&(!g.enabled||g.provision_state!=='ready'))fail('OVPN_GATEWAY_NOT_READY');return {g,password:decryptProvisioningSecret(rows[0].api_password_encrypted)};
}
async function withGateway<T>(central:PoolConnection,id:number,operation:(api:RouterApi,g:any)=>Promise<T>,requireReady=true){
 const {g,password}=await gateway(central,id,requireReady),lockName='ovpn:'+createHash('sha256').update(g.api_host).digest('hex').slice(0,50);
 const [lock]:any=await central.query('SELECT GET_LOCK(?,0) acquired',[lockName]);if(!lock[0]?.acquired)fail('OVPN_GATEWAY_BUSY');let api:RouterApi|undefined;
 try{api=await RouterApi.connect({host:g.api_host,port:Number(g.api_port),username:g.api_username,password,secure:Boolean(g.api_tls)});return await operation(api,g);}
 finally{api?.close();await central.query('SELECT RELEASE_LOCK(?)',[lockName]);}
}
export async function createNetworkNas(app:mysql.Connection,scope:any,managerId:number,snapshot:any,input:{name:string;requestId:string;vendor?:string;model?:string;radiusServices?:string[];location?:string;description?:string;enabled?:boolean;apiPort?:number}){
 const name=String(input.name??'').trim(),vendor=String(input.vendor??'mikrotik'),apiUsername=managedNasApiUsername,apiPassword=managedNasApiPassword,apiPort=Number(input.apiPort??8728);
 const services=Array.isArray(input.radiusServices)?Array.from(new Set(input.radiusServices.filter(value=>value==='ppp'||value==='hotspot'))):['ppp'];
 if(!name||name.length>150||vendor!=='mikrotik'||!services.length||! /^[a-zA-Z0-9_-]{8,64}$/.test(input.requestId)||input.enabled!==undefined&&typeof input.enabled!=='boolean'||!Number.isInteger(apiPort)||apiPort<1||apiPort>65535)fail('NAS_INPUT_INVALID');
 
 const model=String(input.model??'').trim(),location=String(input.location??'').trim(),description=String(input.description??'').trim();if(model.length>100||location.length>150||description.length>200)fail('NAS_INPUT_INVALID');
 const shortname='rl_'+scope.environment_id+'_'+createHash('sha256').update(input.requestId).digest('hex').slice(0,12);
 await app.beginTransaction();try{
 await app.query('SELECT id FROM platform_subscription WHERE id=1 FOR UPDATE');
 const [existing]:any=await app.query('SELECT id,name FROM lord_nas WHERE radius_nas_id IN (SELECT id FROM nas WHERE shortname=?)',[shortname]);if(existing.length>1||existing[0]&&existing[0].name!==name)fail('NAS_REQUEST_CONFLICT');
 if(existing[0]){const existingId=Number(existing[0].id),encrypted=encryptProvisioningSecret(apiPassword);const [savedCredential]:any=await app.query('UPDATE nas_management_credentials SET username=?,password_encrypted=?,encryption_key_id=?,updated_by=? WHERE lord_nas_id=?',[apiUsername,encrypted,'gateway-key-v1',managerId,existingId]);if(!savedCredential.affectedRows)await app.query('INSERT INTO nas_management_credentials (lord_nas_id,username,password_encrypted,encryption_key_id,updated_by) VALUES (?,?,?,?,?)',[existingId,apiUsername,encrypted,'gateway-key-v1',managerId]);const [apiService]:any=await app.query("SELECT id FROM nas_management_services WHERE lord_nas_id=? AND service_type='api' ORDER BY id LIMIT 1",[existingId]);if(apiService[0])await app.query('UPDATE nas_management_services SET port=?,is_enabled=1 WHERE id=?',[apiPort,apiService[0].id]);else await app.query("INSERT INTO nas_management_services (lord_nas_id,service_type,name,host,port,protocol,is_enabled,description) VALUES (?,'api','MikroTik API',NULL,?,'tcp',1,'Lord_Radius managed RouterOS API service')",[existingId,apiPort]);await app.commit();return existingId;}
 const [count]:any=await app.query('SELECT COUNT(*) count FROM nas');if(snapshot.maxNas!==0&&Number(count[0].count)>=snapshot.maxNas+snapshot.additionalNas)fail('NAS_PLAN_LIMIT_REACHED');
 const [nas]:any=await app.query("INSERT INTO nas (nasname,shortname,type,secret,description) VALUES ('127.0.0.2',?,?,?,'Radius Lord managed OpenVPN')",[shortname,vendor,randomBytes(24).toString('hex')]);
 const [local]:any=await app.query("INSERT INTO lord_nas (radius_nas_id,name,vendor,model,radius_services,coa_host,management_host,auth_port,acct_port,coa_port,is_enabled,location,description,created_by) VALUES (?,?,?,?,?,'127.0.0.2','127.0.0.2',?,?,?, ?,?,?,?)",[nas.insertId,name,vendor,model||null,services.join(','),snapshot.authPort,snapshot.accountingPort,3799,input.enabled===false?0:1,location||null,description||null,managerId]);
 await app.query('INSERT INTO nas_management_credentials (lord_nas_id,username,password_encrypted,encryption_key_id,updated_by) VALUES (?,?,?,?,?)',[local.insertId,apiUsername,encryptProvisioningSecret(apiPassword),'gateway-key-v1',managerId]);
 await app.query("INSERT INTO nas_management_services (lord_nas_id,service_type,name,host,port,protocol,is_enabled,description) VALUES (?,'api','MikroTik API',NULL,?,'tcp',1,'Lord_Radius managed RouterOS API service')",[local.insertId,apiPort]);
 await app.commit();return Number(local.insertId);
 }catch(e){await app.rollback();throw e;}
}
export async function provisionNetworkNas(central:PoolConnection,app:mysql.Connection,scope:any,nasId:number,snapshot:any){
 if(snapshot.environmentId!==Number(scope.environment_id)||snapshot.tenantId!==Number(scope.tenant_id)||snapshot.subscriptionId!==Number(scope.subscription_id)||snapshot.deployment!=='shared_cloud')fail('NAS_SNAPSHOT_SCOPE');
 const [locals]:any=await app.query('SELECT * FROM lord_nas WHERE id=? AND archived_at IS NULL',[nasId]);const local=locals[0];if(!local)fail('NAS_NOT_FOUND');
 const [done]:any=await app.query('SELECT central_tunnel_id FROM nas_ovpn_connections WHERE nas_id=?',[nasId]);if(done[0])return;
 await withGateway(central,snapshot.gatewayId,async(api,g)=>{
 const o=validateProvision({...g,certificate_mode:'existing',profile_mode:'existing',pool_mode:'existing'}),inventory=await inspectRouter(api),current=preflightInventory(inventory,o);
 if(!current.server||!(yes(current.server.enabled)||['false','no'].includes(current.server.disabled))||Number(current.server.port)!==o.ovpn_port||current.server.certificate!==o.certificate_name||current.server['default-profile']!==o.ppp_profile||(current.server.protocol??'tcp')!=='tcp'||!yes(current.server['require-client-certificate']))fail('OVPN_SERVER_CHANGED');
 if(g.ovpn_host!==snapshot.host||Number(g.ovpn_port)!==snapshot.port||g.ppp_profile!==snapshot.profile||g.tunnel_cidr!==snapshot.cidr||g.server_tunnel_address!==snapshot.serverAddress||g.certificate_name!==snapshot.serverCertificate)fail('OVPN_GATEWAY_SNAPSHOT_CHANGED');
 const certs=await api.command('/certificate/print',{'.proplist':'.id,name,common-name,issuer,ca,key-usage,private-key,fingerprint,expired,revoked'});
 const serverCert=certs.find(r=>r.name===o.certificate_name),cas=certs.filter(r=>r['key-usage']?.includes('key-cert-sign')&&yes(r['private-key'])&&!yes(r.expired)&&!revoked(r.revoked));
 const ca=(cas.find(r=>r.name===serverCert?.ca)||cas.find(r=>r['common-name']===serverCert?.issuer))??fail('OVPN_SIGNING_CA_REQUIRED');
 if(!ca?.fingerprint)fail('OVPN_SIGNING_CA_REQUIRED');
 let [reservations]:any=await central.query('SELECT * FROM nas_tunnels WHERE environment_id=? AND tenant_nas_id=?',[scope.environment_id,nasId]);let tunnel=reservations[0];
 if(!tunnel){
 const [available]:any=await central.query("SELECT * FROM nas_tunnels WHERE environment_id=? AND tenant_nas_id IS NULL AND status='reserved' ORDER BY reservation_slot LIMIT 1",[scope.environment_id]);
 if(available[0]){tunnel=available[0];const [claimed]:any=await central.query("UPDATE nas_tunnels SET tenant_nas_id=?,status='provisioning' WHERE id=? AND tenant_nas_id IS NULL AND status='reserved'",[nasId,tunnel.id]);if(!claimed.affectedRows)fail('NAS_RESERVATION_RACE');tunnel.tenant_nas_id=nasId;tunnel.status='provisioning';}
 }
 if(!tunnel){
 const [reserved]:any=await central.query('SELECT tunnel_address FROM nas_tunnels WHERE ovpn_gateway_id=?',[snapshot.gatewayId]);
 const used=await api.command('/ip/pool/used/print',{'.proplist':'pool,address'}),secrets=await api.command('/ppp/secret/print',{'.proplist':'remote-address'});
 const occupied=new Set([...reserved.map((r:any)=>r.tunnel_address),...used.map(r=>r.address),...secrets.map(r=>r['remote-address'])]);
 let address='';for(const range of poolRanges(o).split(',')){const [a,b]=range.split('-').map(ipNumber);for(let n=a;n<=b;n++){const candidate=ipString(n);if(!occupied.has(candidate)){address=candidate;break;}}if(address)break;}if(!address)fail('OVPN_POOL_FULL');
 const [slots]:any=await central.query('SELECT reservation_slot FROM nas_tunnels WHERE environment_id=? AND reservation_slot IS NOT NULL',[scope.environment_id]);const usedSlots=new Set(slots.map((r:any)=>Number(r.reservation_slot)));let slot=1;while(usedSlots.has(slot))slot++;
 const username='rl_env_'+scope.environment_id+'_nas_'+nasId;
 const [insert]:any=await central.query("INSERT INTO nas_tunnels (environment_id,ovpn_gateway_id,tenant_nas_id,reservation_slot,tunnel_username,tunnel_password_encrypted,tunnel_address,certificate_reference,status) VALUES (?,?,?,?,?,?,?,?,'provisioning')",[scope.environment_id,snapshot.gatewayId,nasId,slot,username,encryptProvisioningSecret(randomBytes(24).toString('base64url')),address,username]);
 [reservations]=await central.query('SELECT * FROM nas_tunnels WHERE id=?',[insert.insertId]);tunnel=reservations[0];
 }
 const username=String(tunnel.tunnel_username),marker=/_slot_\d+$/.test(username)?'Radius Lord env '+scope.environment_id+' nas slot '+tunnel.reservation_slot:'Radius Lord env '+scope.environment_id+' nas '+nasId;
 if(Number(tunnel.ovpn_gateway_id)!==snapshot.gatewayId||tunnel.certificate_reference!==username)fail('OVPN_TUNNEL_OWNERSHIP');
 const owned=await api.command('/ppp/secret/print',{'.proplist':'.id,name,comment,service,profile,remote-address,local-address'},['?name='+username]);
 if(owned.some(r=>r.comment!==marker||r.profile!==o.ppp_profile||r['remote-address']!==tunnel.tunnel_address||r.service!=='ovpn'))fail('OVPN_SECRET_CONFLICT');
 if(!owned.length)await api.command('/ppp/secret/add',{name:username,password:decryptProvisioningSecret(tunnel.tunnel_password_encrypted),service:'ovpn',profile:o.ppp_profile,'remote-address':tunnel.tunnel_address,'local-address':o.server_tunnel_address,comment:marker});
 let cert=certs.find(r=>r.name===username);
 if(cert&&(cert['common-name']!==username||!cert['key-usage']?.includes('tls-client')))fail('OVPN_CLIENT_CERT_CONFLICT');
 if(!cert){await api.command('/certificate/add',{name:username,'common-name':username,'key-size':'2048','days-valid':'825','key-usage':'digital-signature,key-encipherment,tls-client'});cert=(await api.command('/certificate/print',{'.proplist':'.id,name'},['?name='+username]))[0];}
 if(!cert?.['.id'])fail('OVPN_CLIENT_CERT_REQUIRED');
 if(!cert.fingerprint)await api.command('/certificate/sign',{'.id':cert['.id'],name:username,ca:ca.name},[],45000);
 cert=(await api.command('/certificate/print',{'.proplist':'.id,name,fingerprint,private-key,key-usage,expired,revoked,common-name'},['?name='+username]))[0];
 if(!cert?.fingerprint||!yes(cert['private-key'])||yes(cert.expired)||revoked(cert.revoked))fail('OVPN_CLIENT_CERT_NOT_READY');
 const passphrase=randomBytes(24).toString('hex'),base=username+'_export',caBase=username+'_ca_export';
 const names=[base+'.crt',base+'.key',caBase+'.crt'];
 const removeExports=async()=>{for(const name of names){const rows=await api.command('/file/print',{'.proplist':'.id,name'},['?name='+name]);for(const r of rows)await api.command('/file/remove',{'.id':r['.id']});}};
 // Export files are uniquely reserved to this managed tunnel; remove them after reading.
 await removeExports();let caPem='',certPem='',keyPem='';
 try{
 await api.command('/certificate/export-certificate',{'.id':ca['.id'],type:'pem','file-name':caBase});
 await api.command('/certificate/export-certificate',{'.id':cert['.id'],type:'pem','file-name':base,'export-passphrase':passphrase});
 const contents:string[]=[];for(const name of names){const rows=await api.command('/file/print',{'.proplist':'.id,name'},['?name='+name]);if(rows.length!==1)fail('OVPN_EXPORT_MISSING');const value=(await api.command('/file/get',{'.id':rows[0]['.id'],'value-name':'contents'}))[0]?.ret??'';if(value.length>4096||!value.includes('-----BEGIN '))fail('OVPN_EXPORT_INVALID');contents.push(value);}
 [certPem,keyPem,caPem]=contents;
 try{const authority=new X509Certificate(caPem),client=new X509Certificate(certPem),privateKey=createPrivateKey({key:keyPem,passphrase});
 const publicKey=createPublicKey(privateKey).export({type:'spki',format:'der'}),expected=client.publicKey.export({type:'spki',format:'der'});
 if(!client.verify(authority.publicKey)||!publicKey.equals(expected)||authority.fingerprint256.replace(/:/g,'').toLowerCase()!==ca.fingerprint.replace(/:/g,'').toLowerCase()||new Date(client.validFrom).getTime()>Date.now()||new Date(authority.validFrom).getTime()>Date.now()||new Date(client.validTo).getTime()<=Date.now()||new Date(authority.validTo).getTime()<=Date.now())fail('OVPN_CERTIFICATE_EXPORT_MISMATCH');
 }catch{fail('OVPN_CERTIFICATE_EXPORT_MISMATCH');}
 }finally{await removeExports();}
 const configuration={radiusConfigured:false,...snapshot,certificateName:username,caFingerprint:ca.fingerprint,caCertificate:caPem,clientCertificate:certPem,keyPassphraseEncrypted:encryptProvisioningSecret(passphrase)};
 await app.beginTransaction();try{
 await app.query('UPDATE nas SET nasname=?,server=? WHERE id=?',[tunnel.tunnel_address,'rl_env_'+scope.environment_id,local.radius_nas_id]);
 await app.query('UPDATE lord_nas SET coa_host=?,management_host=? WHERE id=?',[tunnel.tunnel_address,tunnel.tunnel_address,nasId]);
 await app.query(`INSERT INTO nas_ovpn_connections (nas_id,central_tunnel_id,central_gateway_id,server_host,server_port,transport_protocol,tunnel_username,tunnel_password_encrypted,encryption_key_id,tunnel_address,ca_certificate_reference,client_certificate_reference,client_private_key_encrypted,radius_server_address,configuration_snapshot,sync_version,synced_at) VALUES (?,?,?,?,?,'tcp',?,?,'gateway-key-v1',?,?,?,?,?,?,1,NOW(6))`,[nasId,tunnel.id,snapshot.gatewayId,snapshot.host,snapshot.port,username,tunnel.tunnel_password_encrypted,tunnel.tunnel_address,ca.name,username,encryptProvisioningSecret(keyPem),snapshot.radiusAddress,JSON.stringify(configuration)]);
 await app.commit();}catch(e){await app.rollback();throw e;}
 await central.query("UPDATE nas_tunnels SET status='awaiting_link' WHERE id=?",[tunnel.id]);
 });
}

export async function reserveNetworkNasCapacity(central:PoolConnection,scope:any,snapshot:any,capacity:number){
 if(!Number.isSafeInteger(capacity)||capacity<0)fail('NAS_CAPACITY_INVALID');if(capacity===0)return 0;
 return withGateway(central,snapshot.gatewayId,async(api,g)=>{
  const o=validateProvision({...g,certificate_mode:'existing',profile_mode:'existing',pool_mode:'existing'}),inventory=await inspectRouter(api),current=preflightInventory(inventory,o);
  if(!current.server||!(yes(current.server.enabled)||['false','no'].includes(current.server.disabled))||Number(current.server.port)!==o.ovpn_port||current.server.certificate!==o.certificate_name||current.server['default-profile']!==o.ppp_profile||(current.server.protocol??'tcp')!=='tcp'||!yes(current.server['require-client-certificate']))fail('OVPN_SERVER_CHANGED');
  if(g.ovpn_host!==snapshot.host||Number(g.ovpn_port)!==snapshot.port||g.ppp_profile!==snapshot.profile||g.tunnel_cidr!==snapshot.cidr||g.server_tunnel_address!==snapshot.serverAddress||g.certificate_name!==snapshot.serverCertificate)fail('OVPN_GATEWAY_SNAPSHOT_CHANGED');
  const certs=await api.command('/certificate/print',{'.proplist':'.id,name,common-name,issuer,ca,key-usage,private-key,fingerprint,expired,revoked'}),serverCert=certs.find(r=>r.name===o.certificate_name),cas=certs.filter(r=>r['key-usage']?.includes('key-cert-sign')&&yes(r['private-key'])&&!yes(r.expired)&&!revoked(r.revoked)),ca=(cas.find(r=>r.name===serverCert?.ca)||cas.find(r=>r['common-name']===serverCert?.issuer))??fail('OVPN_SIGNING_CA_REQUIRED');if(!ca?.fingerprint)fail('OVPN_SIGNING_CA_REQUIRED');
  const [existing]:any=await central.query('SELECT * FROM nas_tunnels WHERE environment_id=? ORDER BY id',[scope.environment_id]);let nextSlot=1;
  for(const tunnel of existing){if(tunnel.reservation_slot)continue;while(existing.some((r:any)=>Number(r.reservation_slot)===nextSlot))nextSlot++;await central.query('UPDATE nas_tunnels SET reservation_slot=? WHERE id=? AND reservation_slot IS NULL',[nextSlot,tunnel.id]);tunnel.reservation_slot=nextSlot++;}
  let count=0;
  for(let slot=1;slot<=capacity;slot++){
   let tunnel=existing.find((r:any)=>Number(r.reservation_slot)===slot);if(tunnel?.tenant_nas_id)continue;if(tunnel?.status==='reserved')continue;
   if(!tunnel){
    const [reserved]:any=await central.query('SELECT tunnel_address FROM nas_tunnels WHERE ovpn_gateway_id=?',[snapshot.gatewayId]),used=await api.command('/ip/pool/used/print',{'.proplist':'pool,address'}),secrets=await api.command('/ppp/secret/print',{'.proplist':'remote-address'}),occupied=new Set([...reserved.map((r:any)=>r.tunnel_address),...used.map((r:any)=>r.address),...secrets.map((r:any)=>r['remote-address'])]);let address='';
    for(const range of poolRanges(o).split(',')){const [a,b]=range.split('-').map(ipNumber);for(let n=a;n<=b;n++){const candidate=ipString(n);if(!occupied.has(candidate)){address=candidate;break;}}if(address)break;}if(!address)fail('OVPN_POOL_FULL');
    const username='rl_env_'+scope.environment_id+'_slot_'+slot,password=encryptProvisioningSecret(randomBytes(24).toString('base64url')),[insert]:any=await central.query("INSERT INTO nas_tunnels (environment_id,ovpn_gateway_id,tenant_nas_id,reservation_slot,tunnel_username,tunnel_password_encrypted,tunnel_address,certificate_reference,status) VALUES (?,?,NULL,?,?,?,?,?,'provisioning')",[scope.environment_id,snapshot.gatewayId,slot,username,password,address,username]);
    const [rows]:any=await central.query('SELECT * FROM nas_tunnels WHERE id=?',[insert.insertId]);tunnel=rows[0];existing.push(tunnel);
   }
   const username=String(tunnel.tunnel_username),marker='Radius Lord env '+scope.environment_id+' nas slot '+slot;
   if(Number(tunnel.ovpn_gateway_id)!==snapshot.gatewayId||tunnel.certificate_reference!==username||!/_slot_\d+$/.test(username))fail('OVPN_TUNNEL_OWNERSHIP');
   const owned=await api.command('/ppp/secret/print',{'.proplist':'.id,name,comment,service,profile,remote-address,local-address'},['?name='+username]);if(owned.some(r=>r.comment!==marker||r.profile!==o.ppp_profile||r['remote-address']!==tunnel.tunnel_address||r.service!=='ovpn'))fail('OVPN_SECRET_CONFLICT');if(!owned.length)await api.command('/ppp/secret/add',{name:username,password:decryptProvisioningSecret(tunnel.tunnel_password_encrypted),service:'ovpn',profile:o.ppp_profile,'remote-address':tunnel.tunnel_address,'local-address':o.server_tunnel_address,comment:marker});
   let cert=certs.find(r=>r.name===username);if(cert&&(cert['common-name']!==username||!cert['key-usage']?.includes('tls-client')))fail('OVPN_CLIENT_CERT_CONFLICT');if(!cert){await api.command('/certificate/add',{name:username,'common-name':username,'key-size':'2048','days-valid':'825','key-usage':'digital-signature,key-encipherment,tls-client'});cert=(await api.command('/certificate/print',{'.proplist':'.id,name'},['?name='+username]))[0];}if(!cert?.['.id'])fail('OVPN_CLIENT_CERT_REQUIRED');if(!cert.fingerprint)await api.command('/certificate/sign',{'.id':cert['.id'],name:username,ca:ca.name},[],45000);cert=(await api.command('/certificate/print',{'.proplist':'.id,name,fingerprint,private-key,key-usage,expired,revoked,common-name'},['?name='+username]))[0];if(!cert?.fingerprint||!yes(cert['private-key'])||yes(cert.expired)||revoked(cert.revoked))fail('OVPN_CLIENT_CERT_NOT_READY');
   await central.query("UPDATE nas_tunnels SET status='reserved' WHERE id=? AND tenant_nas_id IS NULL",[tunnel.id]);tunnel.status='reserved';count++;
  }
  return count;
 });
}

export async function markNasRadiusConfigured(app:mysql.Connection){
 await app.query("UPDATE nas_ovpn_connections SET configuration_snapshot=JSON_SET(configuration_snapshot,'$.radiusConfigured',JSON_EXTRACT('true','$')),synced_at=NOW(6)");
}
export async function setNetworkNasEnabled(app:mysql.Connection,nasId:number,enabled:boolean){
 if(!Number.isSafeInteger(nasId)||nasId<1||typeof enabled!=='boolean')fail('NAS_STATUS_INPUT');
 const [result]:any=await app.query('UPDATE lord_nas SET is_enabled=? WHERE id=? AND archived_at IS NULL',[enabled?1:0,nasId]);
 if(!result.affectedRows)fail('NAS_NOT_FOUND');
 return enabled;
}
export async function nasRadiusClients(app:mysql.Connection){
 const [rows]:any=await app.query('SELECT l.id,n.nasname address,n.secret FROM lord_nas l JOIN nas n ON n.id=l.radius_nas_id JOIN nas_ovpn_connections c ON c.nas_id=l.id WHERE l.archived_at IS NULL AND l.is_enabled=1');return rows.map((r:any)=>({name:'rl_nas_'+r.id,address:r.address,secret:r.secret}));
}
const ros=(s:string)=>'"'+s.replace(/\\/g,'\\\\').replace(/\$/g,'\\$').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n')+'"';
export async function networkNasScript(central:PoolConnection,app:mysql.Connection,nasId:number,scope:any){
 await app.beginTransaction();let row:any,c:any,telemetryToken='';try{
 const [rows]:any=await app.query("SELECT c.*,n.secret,l.name,l.coa_port,l.radius_services,mc.username api_username,mc.password_encrypted api_password_encrypted,ms.port api_port,ms.is_enabled api_service_enabled FROM nas_ovpn_connections c JOIN lord_nas l ON l.id=c.nas_id JOIN nas n ON n.id=l.radius_nas_id LEFT JOIN nas_management_credentials mc ON mc.lord_nas_id=l.id LEFT JOIN nas_management_services ms ON ms.lord_nas_id=l.id AND ms.service_type='api' WHERE c.nas_id=? AND l.archived_at IS NULL FOR UPDATE",[nasId]);row=rows[0];if(!row)fail('NAS_CONNECTION_NOT_READY');const apiUsername=managedNasApiUsername,apiPassword=managedNasApiPassword,currentApiPassword=row.api_password_encrypted?decryptProvisioningSecret(row.api_password_encrypted):null;if(row.api_username!==apiUsername||currentApiPassword!==apiPassword){const encrypted=encryptProvisioningSecret(apiPassword),[saved]:any=await app.query('UPDATE nas_management_credentials SET username=?,password_encrypted=?,encryption_key_id=?,updated_by=? WHERE lord_nas_id=?',[apiUsername,encrypted,'gateway-key-v1',Number(scope.managerId),nasId]);if(!saved.affectedRows)await app.query('INSERT INTO nas_management_credentials (lord_nas_id,username,password_encrypted,encryption_key_id,updated_by) VALUES (?,?,?,?,?)',[nasId,apiUsername,encrypted,'gateway-key-v1',Number(scope.managerId)]);row.api_username=apiUsername;row.api_password_encrypted=encrypted;}if(!row.api_port){const apiPort=8728,[service]:any=await app.query("SELECT id FROM nas_management_services WHERE lord_nas_id=? AND service_type='api' ORDER BY id LIMIT 1",[nasId]);if(service[0])await app.query('UPDATE nas_management_services SET port=?,is_enabled=1 WHERE id=?',[apiPort,service[0].id]);else await app.query("INSERT INTO nas_management_services (lord_nas_id,service_type,name,host,port,protocol,is_enabled,description) VALUES (?,'api','MikroTik API',NULL,?,'tcp',1,'Lord_Radius managed RouterOS API service')",[nasId,apiPort]);row.api_port=apiPort;}else if(Number(row.api_service_enabled)!==1)await app.query("UPDATE nas_management_services SET is_enabled=1 WHERE lord_nas_id=? AND service_type='api'",[nasId]);c=typeof row.configuration_snapshot==='string'?JSON.parse(row.configuration_snapshot):row.configuration_snapshot;
 const [centralTunnels]:any=await central.query('SELECT t.*,g.settings_json FROM nas_tunnels t JOIN ovpn_gateways g ON g.id=t.ovpn_gateway_id WHERE t.id=? AND t.environment_id=? AND t.tenant_nas_id=?',[row.central_tunnel_id,scope.environment_id,nasId]);const centralTunnel=centralTunnels[0];if(!centralTunnel)fail('NAS_CENTRAL_TUNNEL_NOT_FOUND');const centralGateway=typeof centralTunnel.settings_json==='string'?JSON.parse(centralTunnel.settings_json):centralTunnel.settings_json;if(Number(centralTunnel.ovpn_gateway_id)!==Number(c.gatewayId)||centralGateway.ovpn_host!==row.server_host||Number(centralGateway.ovpn_port)!==Number(row.server_port)||centralGateway.server_tunnel_address!==c.serverAddress||centralTunnel.tunnel_address!==row.tunnel_address||centralTunnel.tunnel_username!==row.tunnel_username)fail('NAS_CENTRAL_TUNNEL_MISMATCH');row.tunnel_address=centralTunnel.tunnel_address;row.tunnel_username=centralTunnel.tunnel_username;row.tunnel_password_encrypted=centralTunnel.tunnel_password_encrypted;row.server_host=centralGateway.ovpn_host;row.server_port=Number(centralGateway.ovpn_port);row.api_tunnel_source_address=String(c.serverAddress||'');row.api_direct_source_address='';
 if(!c.telemetryTokenEncrypted){telemetryToken=randomBytes(32).toString('base64url');c.telemetryTokenEncrypted=encryptProvisioningSecret(telemetryToken);await app.query('UPDATE nas_ovpn_connections SET configuration_snapshot=? WHERE nas_id=?',[JSON.stringify(c),nasId]);}else telemetryToken=decryptProvisioningSecret(c.telemetryTokenEncrypted);
 await app.commit();
 }catch(error){await app.rollback();throw error;}
 try{const directPath=await probeNasApiTcp(String(row.tunnel_address),Number(row.api_port));if(isPrivateIpv4(directPath.sourceAddress))row.api_direct_source_address=directPath.sourceAddress;}catch(error){const diagnostic=(error as Error&{diagnostics?:{sourceAddress?:string}}).diagnostics;if((error as Error).message==='NAS_API_TCP_REFUSED'&&diagnostic?.sourceAddress&&isPrivateIpv4(diagnostic.sourceAddress))row.api_direct_source_address=diagnostic.sourceAddress;}
 const coaPort=Number(row.coa_port),apiPort=Number(row.api_port),apiGatewaySource=String(row.api_tunnel_source_address??''),apiDirectSource=String(row.api_direct_source_address??'');if(!Number.isInteger(coaPort)||coaPort<1||coaPort>65535||!Number.isInteger(apiPort)||apiPort<1||apiPort>65535)fail('NAS_COA_PORT_INVALID');if(!isIpv4(apiGatewaySource)||apiDirectSource&&!isPrivateIpv4(apiDirectSource))fail('NAS_OVPN_SERVER_ADDRESS_INVALID');const apiSources=Array.from(new Set([apiGatewaySource,...(apiDirectSource?[apiDirectSource]:[])])),apiAllowedAddresses=apiSources.map((address:string)=>address+'/32').join(',');const radiusServices=String(row.radius_services||'ppp').split(',').filter((service:string)=>service==='ppp'||service==='hotspot');if(!radiusServices.length)fail('NAS_SERVICES_INVALID');
 const name=c.certificateName,telemetryUrl=new URL(`/api/network/${encodeURIComponent(scope.slug)}/nas/${nasId}/telemetry`,env.FRONTEND_URL).toString(),telemetryName='rl_nas_'+nasId+'_metrics',apiGroup='Lord_Radius_API',apiUsername=String(row.api_username),apiPassword=decryptProvisioningSecret(row.api_password_encrypted);
 const telemetrySource=[
  ':local cpu [/system resource get cpu-load]',
  ':local freeMemory [/system resource get free-memory]',
  ':local totalMemory [/system resource get total-memory]',
  ':local version [/system resource get version]',
  ':local board [/system resource get board-name]',
  ':local uptime [/system resource get uptime]',
  ':local temperature "null"',
  ':local rawTemperature ""',
  ':do { :set rawTemperature [/system health get [find where name="cpu-temperature"] value] } on-error={ :do { :set rawTemperature [/system health get [find where name="temperature"] value] } on-error={} }',
  ':if ([:len $rawTemperature] > 0) do={ :set temperature [:tostr [:tonum $rawTemperature]] }',
  ':local payload ("{\\\"cpu\\\":" . $cpu . ",\\\"freeMemory\\\":" . $freeMemory . ",\\\"totalMemory\\\":" . $totalMemory . ",\\\"temperature\\\":" . $temperature . ",\\\"version\\\":\\\"" . $version . "\\\",\\\"board\\\":\\\"" . $board . "\\\",\\\"uptime\\\":\\\"" . $uptime . "\\\"}")',
  '/tool fetch url='+ros(telemetryUrl)+' http-method=post http-header-field='+ros('Content-Type: application/json,Authorization: Bearer '+telemetryToken)+' http-data=$payload output=none keep-result=no',
 ].join('\n');
 const telemetrySetup=['# Lord_Radius: replace the managed metrics job','/system scheduler remove [find where name='+ros(telemetryName)+' and comment="Lord_Radius"]','/system script remove [find where name='+ros(telemetryName)+' and comment="Lord_Radius"]','/system script add name='+ros(telemetryName)+' policy=read,write,test source='+ros(telemetrySource)+' comment="Lord_Radius"','/system scheduler add name='+ros(telemetryName)+' interval=5m start-time=startup on-event='+ros('/system script run '+telemetryName)+' policy=read,write,test comment="Lord_Radius"'];
 if(!c.radiusConfigured)fail('NAS_RADIUS_NOT_READY');
 const coaComment=ros('Lord_Radius'),coaFirewall='/ip firewall filter add chain=input action=accept protocol=udp src-address='+ros(row.radius_server_address+'/32')+' dst-port='+coaPort+' in-interface=$ovpnName comment='+coaComment+' place-before=0',apiFirewalls=apiSources.map((address:string)=>'/ip firewall filter add chain=input action=accept protocol=tcp src-address='+ros(address+'/32')+' dst-port='+apiPort+' in-interface=$ovpnName comment='+coaComment+' place-before=0');
 const coaUpdate=['/ip firewall filter remove [find where comment='+coaComment+']',coaFirewall,...apiFirewalls];
 const apiSetup=['# Lord_Radius: create a dedicated RouterOS API group',':local apiGroupIds [/user group find where name='+ros(apiGroup)+']',':if ([:len $apiGroupIds] = 0) do={ /user group add name='+ros(apiGroup)+' policy=read,api } else={ :local apiGroupId [:pick $apiGroupIds 0]; /user group set $apiGroupId policy=read,api }','# Lord_Radius: create or update only the application-owned API user',':local apiUserIds [/user find where name='+ros(apiUsername)+']',':if ([:len $apiUserIds] > 1) do={ :error "Lord_Radius API user is ambiguous" }',':if ([:len $apiUserIds] = 0) do={ /user add name='+ros(apiUsername)+' group='+ros(apiGroup)+' password='+ros(apiPassword)+' comment="Lord_Radius" } else={ :local apiUserId [:pick $apiUserIds 0]; /user set $apiUserId group='+ros(apiGroup)+' password='+ros(apiPassword)+' comment="Lord_Radius" }','# Lord_Radius: enable API service on the selected port',':local apiServiceIds [/ip service find where name="api"]',':if ([:len $apiServiceIds] != 1) do={ :error "RouterOS API service is missing or ambiguous" }',':local apiServiceId [:pick $apiServiceIds 0]','/ip service set $apiServiceId disabled=no port='+apiPort+' address='+ros(apiAllowedAddresses)];
 const radiusSetup=['# Lord_Radius: replace only the application managed RADIUS client','/radius remove [find where comment="Lord_Radius"]','/radius add service='+radiusServices.join(',')+' protocol=udp address='+ros(row.radius_server_address)+' src-address='+ros(row.tunnel_address)+' authentication-port='+Number(c.authPort)+' accounting-port='+Number(c.accountingPort)+' secret='+ros(row.secret)+' timeout=3s disabled=no comment="Lord_Radius"','# Lord_Radius: enable RADIUS incoming CoA','/radius incoming set accept=yes port='+coaPort,...(radiusServices.includes('ppp')?['# Lord_Radius: enable PPP RADIUS authentication and accounting','/ppp aaa set use-radius=yes accounting=yes interim-update=3m']:[]),...(radiusServices.includes('hotspot')?['# Lord_Radius: enable Hotspot RADIUS without changing login methods','/ip hotspot profile set [find] use-radius=yes radius-accounting=yes radius-interim-update=3m']:[])];
 const routeSetup=[
  '# Lord_Radius: create or repair only this tunnel route',
  ':local radiusRouteIds [/ip route find where comment="Lord_Radius" and dst-address='+ros(row.radius_server_address+'/32')+']',
  ':if ([:len $radiusRouteIds] > 1) do={ :error "Lord_Radius route is ambiguous" }',
  ':if ([:len $radiusRouteIds] = 1) do={ :local radiusRouteId [:pick $radiusRouteIds 0]; /ip route set $radiusRouteId gateway=$ovpnName disabled=no } else={ /ip route add dst-address='+ros(row.radius_server_address+'/32')+' gateway=$ovpnName comment="Lord_Radius" }',
 ];
 const apiRouteSetup=['/ip route remove [find where comment="Lord_Radius_API"]',...(apiDirectSource&&apiDirectSource!==apiGatewaySource&&apiDirectSource!==row.radius_server_address?['# Lord_Radius: direct-path replies use the detected private application source through OVPN','/ip route add dst-address='+ros(apiDirectSource+'/32')+' gateway=$ovpnName comment="Lord_Radius_API"']:[])];
 const lines=['# Lord_Radius: managed API, OpenVPN, RADIUS and monitoring. Import on RouterOS 6.43+ / 7.','# Keep this file private; it contains API, RADIUS and tunnel credentials.',':local ovpnName '+ros(name),...apiSetup,...radiusSetup,...telemetrySetup,':local cipher "aes256-cbc"',':if ([:pick [/system resource get version] 0 2] = "6.") do={ :set cipher "aes256" }',':local managedOvpnIds [/interface ovpn-client find where comment="Lord_Radius" and user='+ros(row.tunnel_username)+']',':if ([:len $managedOvpnIds] > 1) do={ :error "Lord_Radius OpenVPN client is ambiguous" }',':if ([:len $managedOvpnIds] = 1) do={',':local managedOvpnId [:pick $managedOvpnIds 0]',':local namedOvpnIds [/interface ovpn-client find where name=$ovpnName]',':if ([:len $namedOvpnIds] > 1) do={ :error "OpenVPN interface name is ambiguous" }',':if ([:len $namedOvpnIds] = 1) do={ :if ([:pick $namedOvpnIds 0] != $managedOvpnId) do={ :error "OpenVPN interface name is already in use" } }',':local existingCertIds [/certificate find where common-name='+ros(name)+' and private-key=yes]',':if ([:len $existingCertIds] != 1) do={ :error "Client certificate missing or ambiguous" }',':local existingClientCert [:pick $existingCertIds 0]',':set existingClientCert [/certificate get $existingClientCert name]',':put "Lord_Radius: repairing the existing managed OpenVPN client."','/interface ovpn-client set $managedOvpnId name=$ovpnName connect-to='+ros(row.server_host)+' port='+row.server_port+' mode=ip protocol=tcp user='+ros(row.tunnel_username)+' password='+ros(decryptProvisioningSecret(row.tunnel_password_encrypted))+' profile=default certificate=$existingClientCert verify-server-certificate=yes tls-version=any auth=sha1 cipher=$cipher use-peer-dns=no add-default-route=no route-nopull=no disabled=no comment="Lord_Radius"',...routeSetup,...apiRouteSetup,...coaUpdate,'} else={',':if ([:len [/interface ovpn-client find where name=$ovpnName]] > 0) do={ :error "An unmanaged OpenVPN client already uses the Lord_Radius interface name" }'];
 for(const [suffix,value] of [['ca',c.caCertificate],['client',c.clientCertificate],['key',decryptProvisioningSecret(row.client_private_key_encrypted)]]){const file=name+'_'+suffix;lines.push('# Lord_Radius: import managed OpenVPN certificate material','/file print file='+ros(file),':delay 1s','/file set [find where name='+ros(file+'.txt')+'] contents='+ros(value),'/certificate import file-name='+ros(file+'.txt')+' passphrase='+ros(suffix==='key'?decryptProvisioningSecret(c.keyPassphraseEncrypted):''),'/file remove [find where name='+ros(file+'.txt')+']');}
 lines.push('# Lord_Radius: trust the project CA and establish the managed OpenVPN tunnel','/certificate set [find where fingerprint='+ros(c.caFingerprint)+'] trusted=yes',':local newCertIds [/certificate find where common-name='+ros(name)+' and private-key=yes]',':if ([:len $newCertIds] != 1) do={ :error "Client certificate missing or ambiguous" }',':local newClientCert [:pick $newCertIds 0]',':set newClientCert [/certificate get $newClientCert name]','/interface ovpn-client add name=$ovpnName connect-to='+ros(row.server_host)+' port='+row.server_port+' mode=ip protocol=tcp user='+ros(row.tunnel_username)+' password='+ros(decryptProvisioningSecret(row.tunnel_password_encrypted))+' profile=default certificate=$newClientCert cipher=$cipher auth=sha1 verify-server-certificate=yes add-default-route=no use-peer-dns=no disabled=no comment="Lord_Radius"',...routeSetup,...apiRouteSetup,':put "Lord_Radius configuration imported. Check the OpenVPN interface and gateway routing."',...coaUpdate,'}');
 return lines.join('\r\n')+'\r\n';
}
// Verify the RouterOS API over the NAS tunnel and refresh its resource snapshot.
// Tunnel presence alone is deliberately not treated as proof that API works.
async function readNasApiSample(api:RouterApi){
 const [resource]=await api.command('/system/resource/print',{'.proplist':'cpu-load,free-memory,total-memory,version,board-name,uptime'});
 if(!resource)fail('NAS_API_EMPTY_RESPONSE');
 let temperature:number|null=null;
 try{const health=await api.command('/system/health/print');const entry=health.find(item=>/temperature/i.test(item.name??''));if(entry?.value){const value=Number(String(entry.value).replace(/[^0-9.+-]/g,''));if(Number.isFinite(value))temperature=value;}}catch{/* Some RouterOS boards do not expose health data. */}
 const cpu=Number(resource['cpu-load']),freeMemory=Number(resource['free-memory']),totalMemory=Number(resource['total-memory']);
 if(!Number.isFinite(cpu)||!Number.isFinite(freeMemory)||!Number.isFinite(totalMemory)||totalMemory<=0||freeMemory<0||freeMemory>totalMemory)fail('NAS_API_INVALID_RESPONSE');
 return {receivedAt:new Date().toISOString(),cpu,freeMemory,totalMemory,temperature,version:String(resource.version||'').slice(0,40),board:String(resource['board-name']||'').slice(0,100),uptime:String(resource.uptime||'').slice(0,40)};
}
async function saveNasApiSample(app:mysql.Connection,nasId:number,port:number,sample:any,transport:string,gatewayId?:number){
 const [current]:any=await app.query('SELECT configuration_snapshot FROM nas_ovpn_connections WHERE nas_id=?',[nasId]);
 const config=typeof current[0]?.configuration_snapshot==='string'?JSON.parse(current[0].configuration_snapshot):current[0]?.configuration_snapshot||{};
 config.telemetrySamples=[...(Array.isArray(config.telemetrySamples)?config.telemetrySamples:[]),sample].slice(-36);config.telemetryLatest=sample;config.apiLastCheck={receivedAt:sample.receivedAt,ok:true,port,transport,...(gatewayId?{gatewayId}:{})};
 await app.query('UPDATE nas_ovpn_connections SET configuration_snapshot=? WHERE nas_id=?',[JSON.stringify(config),nasId]);
 if(sample.version)await app.query('UPDATE lord_nas SET routeros_version=? WHERE id=?',[sample.version,nasId]);
}
async function readPppoeLiveTraffic(api:RouterApi,username:string){
 // Ask RouterOS for its version for diagnostics only. Capability checks below determine
 // the actual data path, so no release number is treated as a compatibility boundary.
 let routerosVersion='غير معروف';
 try{const [resource]=await api.command('/system/resource/print',{'.proplist':'version'});if(resource?.version)routerosVersion=String(resource.version).slice(0,80);}catch{/* Metadata permission is optional. */}
 const base='name,service,bytes,uptime,address,caller-id';
 const attempts=[
  {source:'routeros_api_ppp_stats',attrs:{'.proplist':base,stats:''}},
  {source:'routeros_api_ppp_bytes',attrs:{'.proplist':base}}
 ] as const;
 let sessions:any[]=[];
 let lastError:unknown;
 for(const attempt of attempts){
  try{
   const rows=await api.command('/ppp/active/print',attempt.attrs);
   sessions=rows.filter(row=>row.name===username&&String(row.service||'').toLowerCase()==='pppoe');
   if(!sessions.length)return {connected:false,uploadBytes:'0',downloadBytes:'0',sessionCount:0,sessionSeconds:0,routerosVersion,counterSource:attempt.source};
   if(sessions.some(row=>/^\d+\/\d+$/.test(String(row.bytes||''))))return buildPppoeTraffic(sessions,routerosVersion,attempt.source);
  }catch(error){lastError=error;}
 }
 // Compatibility path: obtain the live PPPoE interface and its byte counters using
 // RouterOS API resources. This works even when /ppp/active does not expose "stats".
 try{
  let userInterfaces:any[]=[];
  try{
   const interfaces=await api.command('/interface/pppoe-server/print',{'.proplist':'.id,name,user,remote-address'});
   userInterfaces=interfaces.filter(row=>row['.id']&&(
    String(row.user||'')===username||
    String(row.name||'')===username||
    String(row.name||'')==='pppoe-'+username||
    String(row.name||'')==='<pppoe-'+username+'>'
   ));
  }catch(error){lastError=error;}
  // Older RouterOS builds may expose the dynamic PPPoE interface only in the
  // generic interface menu. Match its runtime name when the dedicated menu is absent.
  if(!userInterfaces.length){
   try{
    const interfaces=await api.command('/interface/print',{'.proplist':'.id,name,type'});
    userInterfaces=interfaces.filter(row=>row['.id']&&
     (String(row.type||'').toLowerCase().includes('pppoe')||/^<?pppoe-/i.test(String(row.name||'')))&&
     (String(row.name||'')===username||
      String(row.name||'')==='pppoe-'+username||
      String(row.name||'')==='<pppoe-'+username+'>')
    );
   }catch(error){lastError=error;}
  }
  const matched=userInterfaces.filter(iface=>sessions.some(session=>
   session['caller-id']&&String(iface['remote-address']||'').toLowerCase()===String(session['caller-id']).toLowerCase()
   ||String(iface.name||'')===username
   ||String(iface.name||'')==='pppoe-'+username
   ||String(iface.name||'')==='<pppoe-'+username+'>'
  ));
  const selected=matched.length?matched:(sessions.length===1&&userInterfaces.length===1?userInterfaces:[]);
  if(!selected.length)throw lastError instanceof Error?lastError:new Error('NAS_PPP_ACTIVE_COUNTERS_UNAVAILABLE');
  let upload=0n,download=0n,hasCounters=false;
  const asCounter=(value:unknown):bigint|undefined=>{
   const normalized=String(value??'').replace(/[,\s]/g,'');
   return /^\d+$/.test(normalized)?BigInt(normalized):undefined;
  };
  for(const iface of selected){
   let counterRow:any;
   for(const counterMode of ['stats-detail','stats']){
    try{
     const rows=await api.command('/interface/print',{
      '.proplist':'.id,name,tx-byte,rx-byte,bytes',
      [counterMode]:''
     },['?.id='+iface['.id']]);
     if(rows[0]){counterRow=rows[0];if(asCounter(counterRow['tx-byte'])!==undefined&&asCounter(counterRow['rx-byte'])!==undefined)break;}
    }catch(error){lastError=error;}
   }
   if(!counterRow)continue;
   // RouterOS interface statistics expose separate tx-byte/rx-byte fields.
   // A few API builds expose the PPP pair as bytes=tx/rx instead.
   let tx=asCounter(counterRow['tx-byte']),rx=asCounter(counterRow['rx-byte']);
   if(tx===undefined||rx===undefined){
    const pair=String(counterRow.bytes||'').split('/');
    if(pair.length===2){tx=asCounter(pair[0]);rx=asCounter(pair[1]);}
   }
   if(tx===undefined||rx===undefined)continue;
   // tx from the router is subscriber download; rx is subscriber upload.
   download+=tx;upload+=rx;hasCounters=true;
  }
  if(!hasCounters)throw lastError instanceof Error?lastError:new Error('NAS_PPP_ACTIVE_COUNTERS_UNAVAILABLE');
  return buildPppoeTraffic(sessions,routerosVersion,'routeros_api_pppoe_interface',upload,download);
 }catch(error){if(error instanceof Error)throw error;throw new Error('NAS_PPP_ACTIVE_COUNTERS_UNAVAILABLE');}
}
function buildPppoeTraffic(sessions:any[],routerosVersion:string,counterSource:string,uploadValue?:bigint,downloadValue?:bigint){
 let upload=uploadValue??0n,download=downloadValue??0n;
 if(uploadValue===undefined||downloadValue===undefined){
  for(const session of sessions){const pair=String(session.bytes||'').split('/');if(pair.length===2&&pair.every(value=>/^\d+$/.test(value))){download+=BigInt(pair[0]);upload+=BigInt(pair[1]);}}
 }
 if(!sessions.length||uploadValue===undefined&&downloadValue===undefined&&sessions.every(session=>!/^\d+\/\d+$/.test(String(session.bytes||''))))throw new Error('NAS_PPP_ACTIVE_COUNTERS_UNAVAILABLE');
 const uptime=String(sessions[0].uptime||''),clock=uptime.match(/(?:^|d)(\d{1,3}):(\d{2}):(\d{2})$/),units=Array.from(uptime.matchAll(/(\d+)(w|d|h|m|s)/g));let sessionSeconds=clock?Number(clock[1])*3600+Number(clock[2])*60+Number(clock[3]):0;for(const match of units){const factor=match[2]==='w'?604800:match[2]==='d'?86400:match[2]==='h'?3600:match[2]==='m'?60:1;sessionSeconds+=Number(match[1])*factor;}
 return {connected:true,uploadBytes:upload.toString(),downloadBytes:download.toString(),sessionCount:sessions.length,sessionSeconds,uptime:uptime||null,framedIp:sessions[0].address||null,callingStation:sessions[0]['caller-id']||null,routerosVersion,counterSource};
}
export async function checkNetworkNasApi(central:PoolConnection,app:mysql.Connection,nasId:number,scope:any,monitorUsername?:string){
 const [rows]:any=await app.query("SELECT c.*,l.name,l.is_enabled,mc.username,mc.password_encrypted,ms.port,ms.is_enabled api_enabled FROM nas_ovpn_connections c JOIN lord_nas l ON l.id=c.nas_id JOIN nas_management_credentials mc ON mc.lord_nas_id=l.id JOIN nas_management_services ms ON ms.lord_nas_id=l.id AND ms.service_type='api' WHERE c.nas_id=? AND l.archived_at IS NULL ORDER BY ms.id LIMIT 1",[nasId]);
 const row=rows[0];if(!row)fail('NAS_API_NOT_CONFIGURED');if(Number(row.is_enabled)!==1||Number(row.api_enabled)!==1)fail('NAS_API_DISABLED');
 const port=Number(row.port);if(!Number.isInteger(port)||port<1||port>65535)fail('NAS_API_PORT_INVALID');
 const c=typeof row.configuration_snapshot==='string'?JSON.parse(row.configuration_snapshot):row.configuration_snapshot;
 const [tunnels]:any=await central.query('SELECT t.*,g.settings_json FROM nas_tunnels t JOIN ovpn_gateways g ON g.id=t.ovpn_gateway_id WHERE t.id=? AND t.environment_id=? AND t.tenant_nas_id=?',[row.central_tunnel_id,scope.environment_id,nasId]);
 const tunnel=tunnels[0];if(!tunnel)fail('NAS_CENTRAL_TUNNEL_NOT_FOUND');
 const gatewaySettings=typeof tunnel.settings_json==='string'?JSON.parse(tunnel.settings_json):tunnel.settings_json;
 if(Number(tunnel.ovpn_gateway_id)!==Number(c.gatewayId)||gatewaySettings.server_tunnel_address!==c.serverAddress||tunnel.tunnel_address!==row.tunnel_address||tunnel.tunnel_username!==row.tunnel_username)fail('NAS_CENTRAL_TUNNEL_MISMATCH');
 if(!isIpv4(String(c.serverAddress||''))||!isIpv4(String(tunnel.tunnel_address||'')))fail('NAS_OVPN_SERVER_ADDRESS_INVALID');
 const marker=`Lord_Radius_API_Relay_${Number(scope.environment_id)}_${nasId}`;
 let tcp:{sourceAddress:string;targetAddress:string;elapsedMs:number}|undefined,api:RouterApi|undefined,relayTargetPort=0,directFailure:unknown,stage='direct_probe',relaySourceAddress='',relayGatewayAddress='',relayOvpnInterface='';
 let relayRuleCounters:Array<{kind:string;comment:string;packets:string;bytes:string;chain?:string;action?:string;protocol?:string;srcAddress?:string;dstAddress?:string;dstPort?:string;toAddresses?:string;toPorts?:string;outInterface?:string}>=[];
 try{
  if(!monitorUsername){
  try{
   const directTcp=await probeNasApiTcp(String(tunnel.tunnel_address),port);
   if(isPrivateIpv4(directTcp.sourceAddress)){
    api=await RouterApi.connect({host:String(tunnel.tunnel_address),port,username:String(row.username),password:decryptProvisioningSecret(row.password_encrypted),secure:false});
    const sample=await readNasApiSample(api);api.close();api=undefined;
    await saveNasApiSample(app,nasId,port,sample,'direct');
    return {apiPort:port,checkedAt:sample.receivedAt,metrics:sample,connection:{...directTcp,transport:'direct',login:'ok' as const}};
   }
   directFailure=new Error('NAS_API_DIRECT_SOURCE_UNSUPPORTED');
  }catch(error){directFailure=error;api?.close();api=undefined;}
  }
  stage='gateway_api_connect';
  const result=await withGateway(central,Number(tunnel.ovpn_gateway_id),async(gatewayApi,g)=>{
   stage='gateway_api_preflight';
   relayTargetPort=Number(g.api_port);
   const gatewayHost=await radiusIpv4(String(g.api_host));
   const gatewayReachability=await probeNasApiTcp(gatewayHost,Number(g.api_port));
   // The application host can sit behind NAT. Use the peer address RouterOS
   // actually sees for this API account rather than the OS-local socket address.
   stage='identify_gateway_api_peer';
   const apiSessions=await gatewayApi.command('/user/active/print',{'.proplist':'name,address,via'});
   const gatewayApiPeers=Array.from(new Set(apiSessions
    .filter(session=>session.name===String(g.api_username)&&['api','api-ssl'].includes(String(session.via||'')))
    .map(session=>String(session.address||'').split('/')[0])
    .filter(isIpv4)));
   if(gatewayApiPeers.length!==1)fail('OVPN_GATEWAY_API_PEER_AMBIGUOUS');
   const sourceAddress=gatewayApiPeers[0];relaySourceAddress=sourceAddress;relayGatewayAddress=gatewayReachability.targetAddress;
   const active=await gatewayApi.command('/ppp/active/print',{'.proplist':'name,address,service'});
   const natRules=await gatewayApi.command('/ip/firewall/nat/print',{'.proplist':'.id,protocol,dst-port,comment'});
   const services=await gatewayApi.command('/ip/service/print',{'.proplist':'name,port'});
   stage='verify_ovpn_tunnel';
   if(!active.some((entry:any)=>entry.name===tunnel.tunnel_username&&entry.address===tunnel.tunnel_address&&entry.service==='ovpn'))fail('NAS_OVPN_TUNNEL_NOT_CONNECTED');
   stage='identify_nas_ovpn_interface';
   const ovpnInterfaces=await gatewayApi.command('/interface/print',{'.proplist':'name,type'});
   const matchingOvpnInterfaces=ovpnInterfaces.filter((item:any)=>item.type==='ovpn-in'&&String(item.name||'').includes(String(tunnel.tunnel_username)));
   const nasOvpnInterface=matchingOvpnInterfaces.length===1?String(matchingOvpnInterfaces[0].name):'';relayOvpnInterface=nasOvpnInterface;
   const occupied=new Set<number>();
   const addPorts=(raw:string)=>{for(const piece of String(raw||'').split(',')){const range=piece.trim().split('-').map(Number);if(range.length===1&&Number.isInteger(range[0]))occupied.add(range[0]);else if(range.length===2&&range.every(Number.isInteger)&&range[1]-range[0]<2048)for(let p=range[0];p<=range[1];p++)occupied.add(p);}};
   for(const rule of natRules)if(String(rule.protocol||'')==='tcp')addPorts(rule['dst-port']);
   for(const service of services)addPorts(service.port);
   let relayPort=0;for(let attempt=0;attempt<100;attempt++){const candidate=randomInt(45000,60000);if(!occupied.has(candidate)){relayPort=candidate;break;}}
   if(!relayPort)fail('NAS_API_RELAY_PORT_UNAVAILABLE');relayTargetPort=relayPort;
   const cleanup=async()=>{
    for(const [path,suffix] of [['/ip/firewall/filter','-allow'],['/ip/firewall/nat','-dst'],['/ip/firewall/nat','-src']] as const){
     const kind=path.endsWith('/filter')?'filter':'nat';
     stage='cleanup_'+kind+'_print';
     // Read the menu without RouterOS query words; match our exact managed comment locally.
     // This avoids RouterOS/API-version-specific behavior for comment query filters.
     const found=await gatewayApi.command(path+'/print',{'.proplist':'.id,comment'});
     for(const item of found.filter(row=>row.comment===marker+suffix))if(item['.id']){
      stage='cleanup_'+kind+'_remove';
      await gatewayApi.command(path+'/remove',{'.id':item['.id']});
     }
    }
   };
   const readRelayCounters=async()=>{
    const counters:Array<{kind:string;comment:string;packets:string;bytes:string;chain?:string;action?:string;protocol?:string;srcAddress?:string;dstAddress?:string;dstPort?:string;toAddresses?:string;toPorts?:string;outInterface?:string}>=[];
    for(const [path,kind] of [['/ip/firewall/nat','nat'],['/ip/firewall/filter','filter']] as const){
     const properties=kind==='nat'?'.proplist=.id,comment,packets,bytes,chain,action,protocol,src-address,dst-address,dst-port,to-addresses,to-ports,out-interface':'.proplist=.id,comment,packets,bytes';
     const rows=await gatewayApi.command(path+'/print',{'.proplist':properties.replace('.proplist=','')});
     for(const row of rows)if(typeof row.comment==='string'&&row.comment.startsWith(marker)){
      const value=(key:string)=>row[key]===undefined||row[key]===null||row[key]===''?undefined:String(row[key]);
      counters.push({kind,comment:row.comment,packets:String(row.packets??'0'),bytes:String(row.bytes??'0'),...(kind==='nat'?{chain:value('chain'),action:value('action'),protocol:value('protocol'),srcAddress:value('src-address'),dstAddress:value('dst-address'),dstPort:value('dst-port'),toAddresses:value('to-addresses'),toPorts:value('to-ports'),outInterface:value('out-interface')}:{})});
     }
    }
    return counters;
   };
   stage='prepare_relay_rules';
   await cleanup();
   // RouterOS API place-before expects an internal item ID (for example *1), not
   // the CLI list position "0". Read IDs after cleanup so retries never refer to
   // one of the temporary rules that cleanup just removed.
   stage='read_nat_rule_order';
   const natOrder=await gatewayApi.command('/ip/firewall/nat/print',{'.proplist':'.id'});
   stage='read_filter_rule_order';
   const filterOrder=await gatewayApi.command('/ip/firewall/filter/print',{'.proplist':'.id'});
   const natPlaceBefore=natOrder[0]?.['.id'],filterPlaceBefore=filterOrder[0]?.['.id'];
   let relayRulesStarted=false;
   let relayFailureStage='';
   try{
    relayRulesStarted=true;
    stage='install_dstnat_rule';
    await gatewayApi.command('/ip/firewall/nat/add',{chain:'dstnat',protocol:'tcp','src-address':sourceAddress,'dst-address':gatewayReachability.targetAddress,'dst-port':String(relayPort),action:'dst-nat','to-addresses':String(tunnel.tunnel_address),'to-ports':String(port),comment:marker+'-dst',...(natPlaceBefore?{'place-before':natPlaceBefore}:{})});
    stage='install_forward_rule';
    await gatewayApi.command('/ip/firewall/filter/add',{chain:'forward',action:'accept',protocol:'tcp','src-address':sourceAddress,'dst-address':String(tunnel.tunnel_address),'dst-port':String(port),comment:marker+'-allow',...(filterPlaceBefore?{'place-before':filterPlaceBefore}:{})});
    stage='install_srcnat_rule';
    await gatewayApi.command('/ip/firewall/nat/add',{chain:'srcnat',action:'src-nat',protocol:'tcp','src-address':sourceAddress,'dst-address':String(tunnel.tunnel_address),'dst-port':String(port),'to-addresses':String(c.serverAddress),comment:marker+'-src',...(natPlaceBefore?{'place-before':natPlaceBefore}:{})});
    stage='probe_nas_api_relay';
    tcp=await probeNasApiTcp(gatewayReachability.targetAddress,relayPort);
    stage='nas_api_login';
    api=await RouterApi.connect({host:gatewayReachability.targetAddress,port:relayPort,username:String(row.username),password:decryptProvisioningSecret(row.password_encrypted),secure:false});
    if(monitorUsername){stage='read_pppoe_live_traffic';const traffic=await readPppoeLiveTraffic(api,monitorUsername);return {traffic,relayPort,sourceAddress,targetAddress:gatewayReachability.targetAddress,elapsedMs:tcp.elapsedMs,gatewayId:Number(tunnel.ovpn_gateway_id)};}
    stage='read_nas_api_resources';
    const sample=await readNasApiSample(api);
    return {sample,relayPort,sourceAddress,targetAddress:gatewayReachability.targetAddress,elapsedMs:tcp.elapsedMs,gatewayId:Number(tunnel.ovpn_gateway_id)};
   }catch(error){
    relayFailureStage=stage;
    throw error;
   }finally{
    api?.close();api=undefined;
    if(relayRulesStarted){
     const operationStage=relayFailureStage||stage;
     try{relayRuleCounters=await readRelayCounters();}catch{/* Preserve the original failure; always attempt to remove relay rules. */}
     await cleanup();
     // Cleanup uses stage for its own diagnostics; restore the failed operation
     // stage after successful cleanup so the UI/log identify where forwarding stopped.
     stage=operationStage;
    }
   }
  });
  if(monitorUsername)return {apiPort:port,checkedAt:new Date().toISOString(),traffic:result.traffic,connection:{sourceAddress:result.sourceAddress,targetAddress:result.targetAddress,elapsedMs:result.elapsedMs,transport:'ovpn_gateway_relay',gatewayId:result.gatewayId,relayPort:result.relayPort,login:'ok' as const}};
  const sample=result.sample;
  if(typeof sample==='undefined')throw new Error('NAS_API_INVALID_RESPONSE');
  await saveNasApiSample(app,nasId,port,sample,'ovpn_gateway_relay',result.gatewayId);
  return {apiPort:port,checkedAt:sample.receivedAt,metrics:sample,connection:{sourceAddress:result.sourceAddress,targetAddress:result.targetAddress,elapsedMs:result.elapsedMs,transport:'ovpn_gateway_relay',gatewayId:result.gatewayId,relayPort:result.relayPort,login:'ok' as const}};
 }catch(error){
  const [current]:any=await app.query('SELECT configuration_snapshot FROM nas_ovpn_connections WHERE nas_id=?',[nasId]);
  const raw=error instanceof Error?error.message:'NAS_API_UNKNOWN',osCode=String((error as NodeJS.ErrnoException)?.code||''),errorName=error instanceof Error?error.name:'UnknownError',code=raw==='فشل تسجيل الدخول إلى API. تحقق من بيانات الدخول والصلاحيات.'?'NAS_API_LOGIN_FAILED':raw.startsWith('فشل الأمر /ppp/active/print:')?'NAS_PPP_ACTIVE_STATS_FAILED':/^[A-Z][A-Z0-9_]{1,63}$/.test(raw)?raw:'API_CONNECTION_FAILED',rawDiagnostics=tcp?{...tcp}:((error as Error&{diagnostics?:any}).diagnostics||{}),diagnostics={...rawDiagnostics,targetPort:relayTargetPort||undefined,relayPort:relayTargetPort||undefined,gatewayAddress:relayGatewayAddress||undefined,nasTunnelAddress:String(tunnel.tunnel_address),relaySourceAddress:relaySourceAddress||undefined,relayOvpnInterface:relayOvpnInterface||undefined,relayRuleCounters:relayRuleCounters.length?relayRuleCounters:undefined,transport:'ovpn_gateway_relay',stage,failureCode:code,errorName,...(raw.startsWith('فشل الأمر /ppp/active/print:')?{errorSummary:String((error as Error&{routerMessage?:string}).routerMessage||raw).slice(0,220)}:{}),...(/^[A-Z0-9_]{2,32}$/.test(osCode)?{osCode}:{}),directFailure:directFailure instanceof Error&&/^[A-Z][A-Z0-9_]{1,63}$/.test(directFailure.message)?directFailure.message:'DIRECT_PATH_FAILED',login:code==='NAS_API_LOGIN_FAILED'?'failed':stage==='read_nas_api_resources'?'authenticated':'not-tested'};
  const safeErrorSummary=error instanceof Error&&/^فشل الأمر \/ip\/firewall\/(?:nat|filter)\/(?:add|remove|print): [^\r\n]{1,180}$/.test(error.message)?error.message:undefined;
  if(!monitorUsername)console.error('[nas-api-check]',{environmentId:Number(scope.environment_id),nasId,stage,code,errorName,gatewayAddress:relayGatewayAddress||undefined,nasTunnelAddress:String(tunnel.tunnel_address),relaySourceAddress:relaySourceAddress||undefined,relayOvpnInterface:relayOvpnInterface||undefined,relayRuleCounters:relayRuleCounters.length?relayRuleCounters:undefined,...(safeErrorSummary?{errorSummary:safeErrorSummary}:{}),...(/^[A-Z0-9_]{2,32}$/.test(osCode)?{osCode}:{})});
  if(!monitorUsername&&current[0]){const config=typeof current[0].configuration_snapshot==='string'?JSON.parse(current[0].configuration_snapshot):current[0].configuration_snapshot||{};config.apiLastCheck={receivedAt:new Date().toISOString(),ok:false,port,code,transport:'ovpn_gateway_relay',connection:diagnostics};await app.query('UPDATE nas_ovpn_connections SET configuration_snapshot=? WHERE nas_id=?',[JSON.stringify(config),nasId]);}
  const failure=new Error(code);(failure as Error&{diagnostics?:typeof diagnostics}).diagnostics=diagnostics;throw failure;
 }finally{api?.close();}
}
export async function refreshNasLinks(central:PoolConnection,app:mysql.Connection,scope:any,snapshot:any){
 return withGateway(central,snapshot.gatewayId,async(api)=>{const active=await api.command('/ppp/active/print',{'.proplist':'name,address,service'});const [rows]:any=await central.query('SELECT * FROM nas_tunnels WHERE environment_id=? AND ovpn_gateway_id=?',[scope.environment_id,snapshot.gatewayId]);for(const t of rows){if(!t.tenant_nas_id)continue;const connected=active.some(r=>r.name===t.tunnel_username&&r.address===t.tunnel_address&&r.service==='ovpn');await central.query("UPDATE nas_tunnels SET status=?,last_seen_at=IF(?,NOW(),last_seen_at) WHERE id=?",[connected?'connected':t.last_seen_at?'disconnected':'awaiting_link',connected,t.id]);await app.query('UPDATE lord_nas SET activity_status=?,last_seen_at=IF(?,NOW(6),last_seen_at) WHERE id=?',[connected?'recent':t.last_seen_at?'stale':'unknown',connected,t.tenant_nas_id]);}return rows.length;});
}
export async function removeNetworkTunnels(central:PoolConnection,environmentId:number){
 const [rows]:any=await central.query('SELECT * FROM nas_tunnels WHERE environment_id=?',[environmentId]);
 for(const t of rows){const name=String(t.tunnel_username),reserved=/_slot_\d+$/.test(name),expected=reserved?'rl_env_'+environmentId+'_slot_'+t.reservation_slot:'rl_env_'+environmentId+'_nas_'+t.tenant_nas_id,marker=reserved?'Radius Lord env '+environmentId+' nas slot '+t.reservation_slot:'Radius Lord env '+environmentId+' nas '+t.tenant_nas_id;if(name!==expected||!/^rl_env_\d+_(?:nas_\d+|slot_\d+)$/.test(name)||t.certificate_reference!==name||reserved&&Number(t.reservation_slot)<1||!reserved&&!t.tenant_nas_id)fail('OVPN_CLEANUP_OWNERSHIP');
 await withGateway(central,Number(t.ovpn_gateway_id),async(api)=>{
 const secrets=await api.command('/ppp/secret/print',{'.proplist':'.id,name,comment'},['?name='+name]);if(secrets.some(r=>r.comment!==marker))fail('OVPN_CLEANUP_SECRET_CONFLICT');
 const certs=await api.command('/certificate/print',{'.proplist':'.id,name,common-name,key-usage'},['?name='+name]);if(certs.some(r=>r['common-name']!==name||!r['key-usage']?.includes('tls-client')))fail('OVPN_CLEANUP_CERT_CONFLICT');
 for(const r of secrets)await api.command('/ppp/secret/remove',{'.id':r['.id']});
 for(const r of await api.command('/ppp/active/print',{'.proplist':'.id,name'},['?name='+name]))await api.command('/ppp/active/remove',{'.id':r['.id']});
 for(const r of certs)await api.command('/certificate/remove',{'.id':r['.id']});
 for(const file of [name+'_export.crt',name+'_export.key',name+'_ca_export.crt'])for(const r of await api.command('/file/print',{'.proplist':'.id,name'},['?name='+file]))await api.command('/file/remove',{'.id':r['.id']});
 },false);
 // Retain the reservation until the tenant DB has been dropped; otherwise an interrupted
 // cleanup could allow its address to be reused while its old RADIUS client still exists.
 await central.query("UPDATE nas_tunnels SET status='disabled' WHERE id=?",[t.id]);
 }
}
export async function radiusIpv4(host:string){return (await lookup(host,{family:4})).address;}

