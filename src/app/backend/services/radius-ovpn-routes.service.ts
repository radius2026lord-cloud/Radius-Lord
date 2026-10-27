import {isIP} from 'net';
import {lookup} from 'dns/promises';
import type {PoolConnection} from 'mysql2/promise';
import {runManagedRadiusScript} from './ssh-terminal.service';

type Route={gatewayId:number;tunnelId:number;tunnelAddress:string;nextHop:string};
const fail=(code:string):never=>{throw new Error(code);};
function privateIpv4(value:string){
 if(isIP(value)!==4)return false;
 const parts=value.split('.').map(Number);
 return parts[0]===10||(parts[0]===172&&parts[1]>=16&&parts[1]<=31)||(parts[0]===192&&parts[1]===168);
}
function validateRoutes(routes:Route[]){
 const normalized:Route[]=[],addresses=new Map<string,Route>();
 for(const route of routes){
  const gatewayId=Number(route.gatewayId),tunnelId=Number(route.tunnelId),tunnelAddress=String(route.tunnelAddress||''),nextHop=String(route.nextHop||'');
  if(!Number.isSafeInteger(gatewayId)||gatewayId<1||!Number.isSafeInteger(tunnelId)||tunnelId<1||!privateIpv4(tunnelAddress)||isIP(nextHop)!==4)fail('RADIUS_OVPN_ROUTE_INVALID');
  const previous=addresses.get(tunnelAddress);
  if(previous&&(previous.gatewayId!==gatewayId||previous.tunnelId!==tunnelId||previous.nextHop!==nextHop))fail('RADIUS_OVPN_ROUTE_CONFLICT');
  if(!previous){const normalizedRoute={gatewayId,tunnelId,tunnelAddress,nextHop};addresses.set(tunnelAddress,normalizedRoute);normalized.push(normalizedRoute);}
 }
 return normalized;
}
const applyScript="# Radius Lord managed OpenVPN return-route reconciler\nimport ipaddress\nimport json\nimport pathlib\nimport subprocess\nimport sys\n\nCONFIG = pathlib.Path(\"/etc/radius-lord/ovpn-routes.json\")\nPROTO = \"99\"\n\ndef run(args):\n    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=30)\n    if result.returncode:\n        raise RuntimeError(\"command failed: \" + \" \".join(args) + \" \" + result.stderr[-500:])\n    return result.stdout\n\ndef route_protocol(route):\n    return str(route.get(\"protocol\", route.get(\"proto\", \"\")))\n\ndef main():\n    data = json.loads(CONFIG.read_text())\n    if data.get(\"owner\") != \"radius-lord\":\n        raise RuntimeError(\"route configuration ownership mismatch\")\n    desired = data.get(\"routes\")\n    if not isinstance(desired, list):\n        raise RuntimeError(\"invalid route list\")\n    parsed = []\n    for item in desired:\n        address = ipaddress.ip_address(item[\"tunnelAddress\"])\n        net = ipaddress.ip_network(str(address) + \"/32\", strict=True)\n        hop = ipaddress.ip_address(item[\"nextHop\"])\n        if net.version != 4 or hop.version != 4 or not address.is_private:\n            raise RuntimeError(\"invalid private tunnel host route\")\n        lookup = json.loads(run([\"ip\", \"-j\", \"route\", \"get\", str(hop)]))\n        if len(lookup) != 1 or not lookup[0].get(\"dev\") or lookup[0].get(\"gateway\"):\n            raise RuntimeError(\"next hop is not directly reachable from this RADIUS host\")\n        parsed.append((net, str(hop), lookup[0][\"dev\"]))\n    for index, (net, hop, dev) in enumerate(parsed):\n        for other, other_hop, other_dev in parsed[index + 1:]:\n            if net.overlaps(other):\n                raise RuntimeError(\"duplicate OVPN tunnel address\")\n\n    current = json.loads(run([\"ip\", \"-j\", \"route\", \"show\", \"table\", \"main\"]))\n    for net, hop, dev in parsed:\n        for route in current:\n            if route_protocol(route) == PROTO:\n                continue\n            dst = route.get(\"dst\")\n            if not dst or dst == \"default\":\n                continue\n            try:\n                existing = ipaddress.ip_network(dst, strict=False)\n            except ValueError:\n                continue\n            if existing.version != 4 or not existing.overlaps(net):\n                continue\n            same_path = route.get(\"gateway\") == hop and route.get(\"dev\") == dev\n            if same_path:\n                continue\n            if net.subnet_of(existing) and (route_protocol(route) == \"kernel\" or route.get(\"scope\") == \"link\"):\n                raise RuntimeError(\"tunnel address overlaps a directly connected network\")\n            if existing.subnet_of(net):\n                raise RuntimeError(\"a more-specific route conflicts with the tunnel route\")\n\n    wanted = {str(net) for net, _, _ in parsed}\n    for net, hop, dev in parsed:\n        run([\"ip\", \"route\", \"replace\", str(net), \"via\", hop, \"dev\", dev, \"proto\", PROTO])\n    for route in current:\n        if route_protocol(route) != PROTO:\n            continue\n        dst = route.get(\"dst\")\n        if dst and dst != \"default\" and dst not in wanted:\n            run([\"ip\", \"route\", \"del\", dst, \"proto\", PROTO])\n    print(\"radius_lord_ovpn_routes_applied\")\n\ntry:\n    main()\nexcept Exception as error:\n    print(\"radius_lord_ovpn_routes_failed: \" + str(error), file=sys.stderr)\n    sys.exit(24)\n";
const installerTemplate="import base64,json,os,pathlib,subprocess,sys\npayload=json.loads(base64.b64decode(\"__PAYLOAD__\"))\nroot=pathlib.Path(\"/etc/radius-lord\")\nif root.is_symlink(): raise SystemExit(22)\nroot.mkdir(mode=0o700,parents=True,exist_ok=True)\nos.chmod(root,0o700)\nconfig=root/\"ovpn-routes.json\"\napply=pathlib.Path(\"/usr/local/sbin/radius-lord-apply-ovpn-routes\")\nunit=pathlib.Path(\"/etc/systemd/system/radius-lord-ovpn-routes.service\")\nmarker=\"# Radius Lord managed OpenVPN return-route reconciler\"\nunit_text=\"\"\"# Radius Lord managed OpenVPN return-route reconciler\n[Unit]\nDescription=Radius Lord persistent OVPN return routes\nWants=network-online.target\nAfter=network-online.target\n\n[Service]\nType=oneshot\nExecStart=/usr/bin/python3 /usr/local/sbin/radius-lord-apply-ovpn-routes\nRemainAfterExit=yes\n\n[Install]\nWantedBy=multi-user.target\n\"\"\"\nfor path in (config,apply,unit):\n if path.is_symlink(): raise SystemExit(22)\n if path.exists() and path != config and not path.read_text().startswith(marker):\n  raise SystemExit(23)\nif config.exists():\n try:\n  if json.loads(config.read_text()).get(\"owner\")!=\"radius-lord\": raise SystemExit(23)\n except (ValueError,AttributeError): raise SystemExit(23)\ncontent=json.dumps({\"owner\":\"radius-lord\",\"routes\":payload[\"routes\"]},separators=(\",\",\":\"))+\"\\n\"\ndef atomic_write(path,text,mode):\n fd,tmp=__import__(\"tempfile\").mkstemp(prefix=\".\"+path.name+\".\",dir=str(path.parent))\n try:\n  os.fchmod(fd,mode)\n  with os.fdopen(fd,\"w\") as stream: stream.write(text);stream.flush();os.fsync(stream.fileno())\n  os.replace(tmp,path)\n finally:\n  if os.path.exists(tmp): os.unlink(tmp)\natomic_write(config,content,0o600)\natomic_write(apply,marker+\"\\n\"+payload[\"applyScript\"],0o750)\natomic_write(unit,unit_text,0o644)\nsubprocess.run([\"/usr/bin/systemctl\",\"daemon-reload\"],check=True,timeout=30)\nsubprocess.run([\"/usr/bin/systemctl\",\"enable\",\"radius-lord-ovpn-routes.service\"],check=True,timeout=30,stdout=subprocess.DEVNULL)\nsubprocess.run([\"/usr/bin/systemctl\",\"restart\",\"radius-lord-ovpn-routes.service\"],check=True,timeout=45)\nprint(\"radius_lord_ovpn_route_service_ready\")\n";
export async function syncRadiusOvpnRoutes(central:PoolConnection,sshServerId:number){
 if(!Number.isSafeInteger(sshServerId)||sshServerId<1)fail('RADIUS_SSH_REQUIRED');
 const [rows]:any=await central.query(`SELECT t.id tunnel_id,t.tunnel_address,g.id gateway_id,g.settings_json FROM nas_tunnels t JOIN ovpn_gateways g ON g.id=t.ovpn_gateway_id WHERE t.tenant_nas_id IS NOT NULL ORDER BY g.id,t.id`);
 const routes:Route[]=[];
 const gatewaySettings=new Map<number,any>();
 for(const row of rows){
  const gatewayId=Number(row.gateway_id),tunnelId=Number(row.tunnel_id),tunnelAddress=String(row.tunnel_address||'');
  let settings=gatewaySettings.get(gatewayId);
  if(!settings){settings=typeof row.settings_json==='string'?JSON.parse(row.settings_json):row.settings_json;gatewaySettings.set(gatewayId,settings);}
  const explicitHop=String(settings?.radius_route_next_hop||'').trim();
  if(explicitHop&&isIP(explicitHop)!==4)fail('RADIUS_OVPN_ROUTE_INVALID');
  let nextHop=explicitHop;
  if(!nextHop)nextHop=(await lookup(String(settings?.api_host||''),{family:4})).address;
  routes.push({gatewayId,tunnelId,tunnelAddress,nextHop});
 }
 const normalized=validateRoutes(routes),payload=Buffer.from(JSON.stringify({routes:normalized,applyScript}),'utf8').toString('base64');
 try{await runManagedRadiusScript(sshServerId,installerTemplate.replace('__PAYLOAD__',payload));}
 catch{fail('RADIUS_OVPN_ROUTE_SYNC_FAILED');}
}
