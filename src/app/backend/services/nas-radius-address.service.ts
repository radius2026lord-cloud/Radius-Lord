import {lookup} from 'dns/promises';
import {isIP} from 'net';
import {runManagedRadiusScript} from './ssh-terminal.service';
import {assertNasResourceScope} from './nas-resource-scope.service';
const loopback=(host:string)=>host.split('.')[0]==='127';
const usable=(host:string)=>isIP(host)===4&&!loopback(host)&&Number(host.split('.')[0])>0&&Number(host.split('.')[0])<224;
// Management may use loopback. NAS packets must use an address on the RADIUS host.
export async function resolveNasRadiusAddress(config:any,gateway?:any){
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
 if(snapshot.connectionMode==='direct')throw new Error('NAS_RADIUS_ADDRESS_REQUIRED');
 const [settings]:any=await central.query("SELECT setting_value FROM platform_settings WHERE id=? AND setting_group='free_radius'",[snapshot.radiusServerId]);
 const [gateways]:any=await central.query('SELECT settings_json FROM ovpn_gateways WHERE id=?',[snapshot.gatewayId]);
 if(!settings[0]||!gateways[0])throw new Error('NAS_RADIUS_ADDRESS_REQUIRED');
 const parse=(value:any)=>typeof value==='string'?JSON.parse(value):value;
 const address=await resolveNasRadiusAddress(parse(settings[0].setting_value),parse(gateways[0].settings_json));
 await app.beginTransaction();try{
  const [saved]:any=await app.query('SELECT configuration_snapshot FROM network_ovpn_settings WHERE id=1 FOR UPDATE');
  const old=parse(saved[0]?.configuration_snapshot);assertNasResourceScope(old,scope);
  if(Object.keys(old).length!==Object.keys(snapshot).length||Object.keys(snapshot).some(key=>old[key]!==snapshot[key]))throw new Error('NETWORK_OVPN_SNAPSHOT_CHANGED');
  const [connections]:any=await app.query('SELECT nas_id,central_gateway_id,configuration_snapshot,radius_server_address FROM nas_ovpn_connections FOR UPDATE');
  for(const row of connections){const config=parse(row.configuration_snapshot);assertNasResourceScope(config,scope,Number(row.nas_id));if(Number(row.central_gateway_id)!==Number(snapshot.gatewayId)||['gatewayId','radiusServerId','authPort','accountingPort'].some(key=>Number(config[key])!==Number(snapshot[key]))||config.radiusAddress!==snapshot.radiusAddress||row.radius_server_address!==snapshot.radiusAddress)throw new Error('NAS_SNAPSHOT_SCOPE');}
  const repaired={...old,radiusAddress:address};
  await app.query('UPDATE network_ovpn_settings SET configuration_snapshot=?,synced_at=NOW(6) WHERE id=1',[JSON.stringify(repaired)]);
  await app.query('UPDATE network_settings SET radius_server_address=? WHERE id=1',[address]);
  await app.query("UPDATE nas_ovpn_connections SET radius_server_address=?,configuration_snapshot=JSON_SET(configuration_snapshot,'$.radiusAddress',?)",[address,address]);
  await app.commit();return repaired;
 }catch(error){await app.rollback();throw error;}
}
