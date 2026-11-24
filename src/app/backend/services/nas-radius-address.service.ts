import {db} from '../config/db';
import {lookup} from 'dns/promises';
import {isIP} from 'net';
import {runManagedRadiusScript} from './ssh-terminal.service';
import {assertNasResourceScope} from './nas-resource-scope.service';
const loopback=(host:string)=>host.split('.')[0]==='127';
const usable=(host:string)=>isIP(host)===4&&!loopback(host)&&Number(host.split('.')[0])>0&&Number(host.split('.')[0])<224&&!host.startsWith('169.254.');
export function radiusNasAddress(value:unknown){
 if(typeof value!=='string'||!usable(value.trim()))throw new Error('NAS_RADIUS_ADDRESS_INVALID');
 return value.trim();
}
// Use the saved SSH identity only; never accept credentials or arbitrary commands.
export async function radiusNasSshServer(host:string,configuredId?:number){
 const [rows]:any=configuredId?await db.query('SELECT database_server_id,host FROM server_ssh_connections WHERE database_server_id=?',[configuredId]):await db.query('SELECT c.database_server_id,c.host FROM server_ssh_connections c JOIN database_servers s ON s.id=c.database_server_id WHERE c.host=? AND s.archived_at IS NULL',[host]);
 if(rows.length!==1||!Number.isSafeInteger(Number(rows[0].database_server_id)))throw new Error('RADIUS_SSH_REQUIRED');
 const [requested,ssh]=await Promise.all([lookup(host,{family:4,all:true}),lookup(String(rows[0].host),{family:4,all:true})]);
 if(!requested.some(address=>ssh.some(saved=>saved.address===address.address)))throw new Error('RADIUS_SSH_HOST_MISMATCH');
 return Number(rows[0].database_server_id);
}
export async function readRadiusNasAddresses(serverId:number):Promise<Array<{address:string;interface:string}>>{
 if(!Number.isSafeInteger(serverId)||serverId<1)throw new Error('RADIUS_SSH_REQUIRED');
 const script=`import json,subprocess
links=json.loads(subprocess.run(["ip","-j","-4","address","show"],check=True,capture_output=True,text=True,timeout=10).stdout)
result=[]
for link in links:
 if "UP" not in link.get("flags",[]): continue
 for info in link.get("addr_info",[]):
  if info.get("family")=="inet" and info.get("scope")=="global" and info.get("local"):
   result.append({"address":info["local"],"interface":link["ifname"]})
print(json.dumps(result))
`;
 let rows:any;
 try{rows=JSON.parse((await runManagedRadiusScript(serverId,script)).trim());}
 catch{throw new Error('NAS_RADIUS_ADDRESS_CHECK_FAILED');}
 if(!Array.isArray(rows)||rows.length>256)throw new Error('NAS_RADIUS_ADDRESS_CHECK_FAILED');
 const addresses=rows.filter(row=>row&&typeof row.address==='string'&&usable(row.address)&&typeof row.interface==='string');
 return addresses.filter((row,index)=>addresses.findIndex(item=>item.address===row.address)===index).map(row=>({address:row.address,interface:row.interface.slice(0,64)}));
}
export async function verifyRadiusNasAddress(config:any){
 const address=radiusNasAddress(config.nasAddress);
 const assigned=await readRadiusNasAddresses(Number(config.sshServerId));
 if(!assigned.some(item=>item.address===address))throw new Error('NAS_RADIUS_ADDRESS_NOT_ASSIGNED');
 return address;
}
export const radiusNasAddressMessages:Record<string,string>={
 NAS_RADIUS_ADDRESS_INVALID:'أدخل عنوان IPv4 صالحًا لوصول أجهزة NAS؛ لا تستخدم loopback أو multicast أو link-local.',
 NAS_RADIUS_ADDRESS_NOT_ASSIGNED:'العنوان غير موجود على واجهة شبكة مفعّلة في خادم FreeRADIUS المختار.',
 NAS_RADIUS_ADDRESS_CHECK_FAILED:'تعذر قراءة عناوين خادم FreeRADIUS عبر SSH؛ تحقق من الاتصال والصلاحيات.',
 RADIUS_SSH_REQUIRED:'احفظ اتصال SSH لخادم FreeRADIUS أولًا، ثم أعد تحديد عنوان وصول NAS.',
 RADIUS_SSH_HOST_MISMATCH:'عنوان الفحص المحلي لا يطابق خادم SSH المحفوظ؛ راجع اختيار الخادم.'
};
// Management may use loopback. NAS packets must use an address on the RADIUS host.
export async function resolveNasRadiusAddress(config:any,gateway?:any){
 if(String(config.nasAddress??'').trim())return verifyRadiusNasAddress(config);
 const address=(await lookup(String(config.host),{family:4})).address;
 if(usable(address))return address;
 if(!loopback(address)||!gateway||!Number.isSafeInteger(Number(config.sshServerId)))throw new Error('NAS_RADIUS_ADDRESS_REQUIRED');
 const nextHop=(await lookup(String(gateway.radius_route_next_hop||gateway.api_host||''),{family:4})).address;
 if(!usable(nextHop))throw new Error('NAS_RADIUS_ADDRESS_REQUIRED');
 const payload=Buffer.from(JSON.stringify({nextHop})).toString('base64');
 const script=`import base64,json,ipaddress,subprocess
hop=json.loads(base64.b64decode("${payload}"))["nextHop"]
routes=json.loads(subprocess.run(["ip","-j","-4","route","get",hop],check=True,capture_output=True,text=True,timeout=10).stdout)
if len(routes)!=1 or routes[0].get("gateway") or not routes[0].get("dev"): raise RuntimeError("RADIUS next hop must be directly reachable")
source=str(ipaddress.IPv4Address(routes[0].get("prefsrc") or routes[0].get("src") or ""))
if ipaddress.ip_address(source).is_loopback: raise RuntimeError("loopback is not a NAS destination")
print(source)
`;
 const result=(await runManagedRadiusScript(Number(config.sshServerId),script)).trim();
 if(!usable(result))throw new Error('NAS_RADIUS_ADDRESS_REQUIRED');
 return result;
}
// Narrow repair: only replace an unusable loopback destination. All other
// immutable settings and connection identities must still match exactly.
export async function repairNasRadiusAddress(central:any,app:any,scope:any,snapshot:any){
 assertNasResourceScope(snapshot,scope);
 if(!loopback(String(snapshot.radiusAddress||'')))return snapshot;
 const direct=snapshot.connectionMode==='direct';
 const [settings]:any=await central.query("SELECT setting_value FROM platform_settings WHERE id=? AND setting_group='free_radius'",[snapshot.radiusServerId]);
 const [gateways]:any=direct?[[]]:await central.query('SELECT settings_json FROM ovpn_gateways WHERE id=?',[snapshot.gatewayId]);
 if(!settings[0]||!direct&&!gateways[0])throw new Error('NAS_RADIUS_ADDRESS_REQUIRED');
 const parse=(value:any)=>typeof value==='string'?JSON.parse(value):value;
 const address=await resolveNasRadiusAddress(parse(settings[0].setting_value),direct?undefined:parse(gateways[0].settings_json));
 await app.beginTransaction();try{
  const [saved]:any=await app.query('SELECT configuration_snapshot FROM network_ovpn_settings WHERE id=1 FOR UPDATE');
  const old=parse(saved[0]?.configuration_snapshot);assertNasResourceScope(old,scope);
  if(Object.keys(old).length!==Object.keys(snapshot).length||Object.keys(snapshot).some(key=>old[key]!==snapshot[key]))throw new Error('NETWORK_OVPN_SNAPSHOT_CHANGED');
  const table=direct?'nas_direct_connections':'nas_ovpn_connections';
  const [connections]:any=await app.query('SELECT nas_id,configuration_snapshot'+(direct?'':',central_gateway_id,radius_server_address')+' FROM '+table+' FOR UPDATE');
  for(const row of connections){const config=parse(row.configuration_snapshot);assertNasResourceScope(config,scope,Number(row.nas_id));if((!direct&&(Number(row.central_gateway_id)!==Number(snapshot.gatewayId)||row.radius_server_address!==snapshot.radiusAddress))||['gatewayId','radiusServerId','authPort','accountingPort'].some(key=>Number(config[key])!==Number(snapshot[key]))||config.radiusAddress!==snapshot.radiusAddress)throw new Error('NAS_SNAPSHOT_SCOPE');}
  const repaired={...old,radiusAddress:address};
  await app.query('UPDATE network_ovpn_settings SET configuration_snapshot=?,synced_at=NOW(6) WHERE id=1',[JSON.stringify(repaired)]);
  await app.query('UPDATE network_settings SET radius_server_address=? WHERE id=1',[address]);
  if(direct)await app.query("UPDATE nas_direct_connections SET configuration_snapshot=JSON_SET(configuration_snapshot,'$.radiusAddress',?)",[address]);
  else await app.query("UPDATE nas_ovpn_connections SET radius_server_address=?,configuration_snapshot=JSON_SET(configuration_snapshot,'$.radiusAddress',?)",[address,address]);
  await app.commit();return repaired;
 }catch(error){await app.rollback();throw error;}
}

