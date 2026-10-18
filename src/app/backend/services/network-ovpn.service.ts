import {createHash,randomBytes,X509Certificate,createPrivateKey,createPublicKey} from 'crypto';
import {lookup} from 'dns/promises';
import type mysql from 'mysql2/promise';
import type {PoolConnection} from 'mysql2/promise';
import {db} from '../config/db';
import {RouterApi} from './routeros-api.service';
import {inspectRouter,preflightInventory,validateProvision,poolRanges} from './ovpn-provision.service';
import {encryptProvisioningSecret,decryptProvisioningSecret} from './provisioning-secrets.service';
const fail=(code:string):never=>{throw new Error(code);};
const ipNumber=(s:string)=>s.split('.').reduce((n,v)=>n*256+Number(v),0);
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
export async function createNetworkNas(app:mysql.Connection,scope:any,managerId:number,snapshot:any,input:{name:string;requestId:string;vendor?:string;model?:string;managementHost?:string;radiusServices?:string[];location?:string;description?:string}){
 const name=String(input.name??'').trim(),managementHost=String(input.managementHost??'127.0.0.2').trim(),vendor=String(input.vendor??'mikrotik');
 const services=Array.isArray(input.radiusServices)?Array.from(new Set(input.radiusServices.filter(value=>value==='ppp'||value==='hotspot'))):['ppp'];
 if(!name||name.length>150||!managementHost||managementHost.length>255||! /^[a-zA-Z0-9_.:-]+$/.test(managementHost)||vendor!=='mikrotik'||!services.length||! /^[a-zA-Z0-9_-]{8,64}$/.test(input.requestId))fail('NAS_INPUT_INVALID');
 const model=String(input.model??'').trim(),location=String(input.location??'').trim(),description=String(input.description??'').trim();
 if(model.length>100||location.length>150||description.length>200)fail('NAS_INPUT_INVALID');
 const shortname='rl_'+scope.environment_id+'_'+createHash('sha256').update(input.requestId).digest('hex').slice(0,12);
 await app.beginTransaction();try{
 await app.query('SELECT id FROM platform_subscription WHERE id=1 FOR UPDATE');
 const [existing]:any=await app.query('SELECT id,name FROM lord_nas WHERE radius_nas_id IN (SELECT id FROM nas WHERE shortname=?)',[shortname]);if(existing.length>1||existing[0]&&existing[0].name!==name)fail('NAS_REQUEST_CONFLICT');
 if(existing[0]){await app.commit();return Number(existing[0].id);}
 const [count]:any=await app.query('SELECT COUNT(*) count FROM nas');if(snapshot.maxNas!==0&&Number(count[0].count)>=snapshot.maxNas+snapshot.additionalNas)fail('NAS_PLAN_LIMIT_REACHED');
 const [nas]:any=await app.query("INSERT INTO nas (nasname,shortname,type,secret,description) VALUES ('127.0.0.2',?,?,?,'Radius Lord managed OpenVPN')",[shortname,vendor,randomBytes(24).toString('hex')]);
 const [local]:any=await app.query("INSERT INTO lord_nas (radius_nas_id,name,vendor,model,radius_services,coa_host,management_host,auth_port,acct_port,coa_port,location,description,created_by) VALUES (?,?,?,?,?,'127.0.0.2',?,?,?,3799,?,?,?)",[nas.insertId,name,vendor,model||null,services.join(','),managementHost,snapshot.authPort,snapshot.accountingPort,location||null,description||null,managerId]);
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
 const marker='Radius Lord env '+scope.environment_id+' nas '+nasId,username='rl_env_'+scope.environment_id+'_nas_'+nasId;
 let [reservations]:any=await central.query('SELECT * FROM nas_tunnels WHERE environment_id=? AND tenant_nas_id=?',[scope.environment_id,nasId]);let tunnel=reservations[0];
 if(!tunnel){
 const [reserved]:any=await central.query('SELECT tunnel_address FROM nas_tunnels WHERE ovpn_gateway_id=?',[snapshot.gatewayId]);
 const used=await api.command('/ip/pool/used/print',{'.proplist':'pool,address'}),secrets=await api.command('/ppp/secret/print',{'.proplist':'remote-address'});
 const occupied=new Set([...reserved.map((r:any)=>r.tunnel_address),...used.map(r=>r.address),...secrets.map(r=>r['remote-address'])]);
 let address='';for(const range of poolRanges(o).split(',')){const [a,b]=range.split('-').map(ipNumber);for(let n=a;n<=b;n++){const candidate=ipString(n);if(!occupied.has(candidate)){address=candidate;break;}}if(address)break;}if(!address)fail('OVPN_POOL_FULL');
 const [insert]:any=await central.query("INSERT INTO nas_tunnels (environment_id,ovpn_gateway_id,tenant_nas_id,tunnel_username,tunnel_password_encrypted,tunnel_address,certificate_reference,status) VALUES (?,?,?,?,?,?,?,'provisioning')",[scope.environment_id,snapshot.gatewayId,nasId,username,encryptProvisioningSecret(randomBytes(24).toString('base64url')),address,username]);
 [reservations]=await central.query('SELECT * FROM nas_tunnels WHERE id=?',[insert.insertId]);tunnel=reservations[0];
 }
 if(Number(tunnel.ovpn_gateway_id)!==snapshot.gatewayId||tunnel.tunnel_username!==username||tunnel.certificate_reference!==username)fail('OVPN_TUNNEL_OWNERSHIP');
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
 await app.query('UPDATE lord_nas SET coa_host=? WHERE id=?',[tunnel.tunnel_address,nasId]);
 await app.query(`INSERT INTO nas_ovpn_connections (nas_id,central_tunnel_id,central_gateway_id,server_host,server_port,transport_protocol,tunnel_username,tunnel_password_encrypted,encryption_key_id,tunnel_address,ca_certificate_reference,client_certificate_reference,client_private_key_encrypted,radius_server_address,configuration_snapshot,sync_version,synced_at) VALUES (?,?,?,?,?,'tcp',?,?,'gateway-key-v1',?,?,?,?,?,?,1,NOW(6))`,[nasId,tunnel.id,snapshot.gatewayId,snapshot.host,snapshot.port,username,tunnel.tunnel_password_encrypted,tunnel.tunnel_address,ca.name,username,encryptProvisioningSecret(keyPem),snapshot.radiusAddress,JSON.stringify(configuration)]);
 await app.commit();}catch(e){await app.rollback();throw e;}
 await central.query("UPDATE nas_tunnels SET status='awaiting_link' WHERE id=?",[tunnel.id]);
 });
}

export async function markNasRadiusConfigured(app:mysql.Connection){
 await app.query("UPDATE nas_ovpn_connections SET configuration_snapshot=JSON_SET(configuration_snapshot,'$.radiusConfigured',JSON_EXTRACT('true','$')),synced_at=NOW(6)");
}
export async function nasRadiusClients(app:mysql.Connection){
 const [rows]:any=await app.query('SELECT l.id,n.nasname address,n.secret FROM lord_nas l JOIN nas n ON n.id=l.radius_nas_id JOIN nas_ovpn_connections c ON c.nas_id=l.id WHERE l.archived_at IS NULL AND l.is_enabled=1');return rows.map((r:any)=>({name:'rl_nas_'+r.id,address:r.address,secret:r.secret}));
}
const ros=(s:string)=>'"'+s.replace(/\\/g,'\\\\').replace(/\$/g,'\\$').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n')+'"';
export async function networkNasScript(app:mysql.Connection,nasId:number){
 const [rows]:any=await app.query('SELECT c.*,n.secret,l.name,l.coa_port,l.radius_services FROM nas_ovpn_connections c JOIN lord_nas l ON l.id=c.nas_id JOIN nas n ON n.id=l.radius_nas_id WHERE c.nas_id=? AND l.archived_at IS NULL',[nasId]);const row=rows[0];if(!row)fail('NAS_CONNECTION_NOT_READY');const coaPort=Number(row.coa_port);if(!Number.isInteger(coaPort)||coaPort<1||coaPort>65535)fail('NAS_COA_PORT_INVALID');const radiusServices=String(row.radius_services||'ppp').split(',').filter((service:string)=>service==='ppp'||service==='hotspot');if(!radiusServices.length)fail('NAS_SERVICES_INVALID');
 const c=typeof row.configuration_snapshot==='string'?JSON.parse(row.configuration_snapshot):row.configuration_snapshot,name=c.certificateName;
 if(!c.radiusConfigured)fail('NAS_RADIUS_NOT_READY');
 const coaComment=ros(name+'_coa'),coaFirewall='/ip firewall filter add chain=input action=accept protocol=udp src-address='+ros(row.radius_server_address+'/32')+' dst-port='+coaPort+' in-interface=$ovpnName comment='+coaComment+' place-before=0';
 const coaUpdate=['/ip firewall filter remove [find where comment='+coaComment+']',coaFirewall,'/radius incoming set accept=yes port='+coaPort];
 const lines=['# Radius Lord: managed OpenVPN + PPP RADIUS. Import on RouterOS 6.43+ / 7.', '# Keep this file private. Gateway must route VPN traffic to the RADIUS address.', ':local ovpnName '+ros(name), ':if ([:len [/interface ovpn-client find where name=$ovpnName]] > 0) do={',...coaUpdate,':put "Radius Lord CoA reception updated for the existing connection."','} else={'];
 for(const [suffix,value] of [['ca',c.caCertificate],['client',c.clientCertificate],['key',decryptProvisioningSecret(row.client_private_key_encrypted)]]){const file=name+'_'+suffix;lines.push('/file print file='+ros(file),':delay 1s','/file set [find where name='+ros(file+'.txt')+'] contents='+ros(value),'/certificate import file-name='+ros(file+'.txt')+' passphrase='+ros(suffix==='key'?decryptProvisioningSecret(c.keyPassphraseEncrypted):''),'/file remove [find where name='+ros(file+'.txt')+']');}
 lines.push('/certificate set [find where fingerprint='+ros(c.caFingerprint)+'] trusted=yes',':local clientCert [/certificate find where common-name='+ros(name)+' and private-key=yes]',':if ([:len $clientCert] != 1) do={ :error "Client certificate missing or ambiguous" }',':set clientCert [/certificate get $clientCert name]',':local cipher "aes256-cbc"',':if ([:pick [/system resource get version] 0 2] = "6.") do={ :set cipher "aes256" }','/interface ovpn-client add name=$ovpnName connect-to='+ros(row.server_host)+' port='+row.server_port+' user='+ros(row.tunnel_username)+' password='+ros(decryptProvisioningSecret(row.tunnel_password_encrypted))+' certificate=$clientCert cipher=$cipher auth=sha1 add-default-route=no use-peer-dns=no verify-server-certificate=yes disabled=no','/ip route add dst-address='+ros(row.radius_server_address+'/32')+' gateway=$ovpnName comment='+ros(name),...coaUpdate,'/radius add service='+radiusServices.join(',')+' address='+ros(row.radius_server_address)+' src-address='+ros(row.tunnel_address)+' authentication-port='+c.authPort+' accounting-port='+c.accountingPort+' secret='+ros(row.secret)+' timeout=3s comment='+ros(name),...(radiusServices.includes('ppp')?['/ppp aaa set use-radius=yes accounting=yes interim-update=3m']:[]),':put "Radius Lord configuration imported. Check the OpenVPN interface and gateway routing."','}');
 return lines.join('\r\n')+'\r\n';
}
export async function refreshNasLinks(central:PoolConnection,app:mysql.Connection,scope:any,snapshot:any){
 return withGateway(central,snapshot.gatewayId,async(api)=>{const active=await api.command('/ppp/active/print',{'.proplist':'name,address,service'});const [rows]:any=await central.query('SELECT * FROM nas_tunnels WHERE environment_id=? AND ovpn_gateway_id=?',[scope.environment_id,snapshot.gatewayId]);for(const t of rows){const connected=active.some(r=>r.name===t.tunnel_username&&r.address===t.tunnel_address&&r.service==='ovpn');await central.query("UPDATE nas_tunnels SET status=?,last_seen_at=IF(?,NOW(),last_seen_at) WHERE id=?",[connected?'connected':t.last_seen_at?'disconnected':'awaiting_link',connected,t.id]);await app.query('UPDATE lord_nas SET activity_status=?,last_seen_at=IF(?,NOW(6),last_seen_at) WHERE id=?',[connected?'recent':t.last_seen_at?'stale':'unknown',connected,t.tenant_nas_id]);}return rows.length;});
}
export async function removeNetworkTunnels(central:PoolConnection,environmentId:number){
 const [rows]:any=await central.query('SELECT * FROM nas_tunnels WHERE environment_id=?',[environmentId]);
 for(const t of rows){const name='rl_env_'+environmentId+'_nas_'+t.tenant_nas_id,marker='Radius Lord env '+environmentId+' nas '+t.tenant_nas_id;if(t.tunnel_username!==name||t.certificate_reference!==name)fail('OVPN_CLEANUP_OWNERSHIP');
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
