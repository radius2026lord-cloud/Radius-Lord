import {lookup} from 'dns/promises';
import {db} from '../config/db';
import {readPrivateSetting} from './radius-provision.service';
import {runManagedRadiusScript} from './ssh-terminal.service';

type DisconnectResult={attempted:number;acknowledged:number};

function remoteDisconnectScript(rows:any[]){
 const payload=Buffer.from(JSON.stringify(rows.map(row=>({host:String(row.coa_host),port:Number(row.coa_port)||3799,secret:String(row.secret),username:String(row.username),sessionId:String(row.acctsessionid),nasIp:String(row.nasipaddress)})))).toString('base64');
 return `import base64,json,ipaddress,os,re,subprocess,tempfile,concurrent.futures\nitems=json.loads(base64.b64decode('${payload}'))\ndef quoted(value): return '"'+str(value).replace('\\\\','\\\\\\\\').replace('"','\\\\"').replace('\\r','').replace('\\n','')+'"'\ndef send(item):\n try:\n  host=item['host'];port=int(item['port']);session=item['sessionId'];username=item['username'];nas=ipaddress.IPv4Address(item['nasIp'])\n  if host.startswith('[') and host.endswith(']'): host=host[1:-1]\n  if not re.fullmatch(r'[A-Za-z0-9._:-]{1,255}',host) or not 1<=port<=65535 or not 1<=len(session)<=64 or not username or any(ch in username for ch in '\\r\\n') or not item['secret']: return False\n  target=('['+host+']' if ':' in host and not host.startswith('[') else host)+':'+str(port)\n  packet='User-Name = '+quoted(username)+'\\nNAS-IP-Address = '+str(nas)+'\\nAcct-Session-Id = '+quoted(session)+'\\n'\n  fd,path=tempfile.mkstemp(prefix='rl-coa-',dir='/run')\n  try:\n   os.fchmod(fd,0o600)\n   with os.fdopen(fd,'w') as secret_file: secret_file.write(item['secret'])\n   result=subprocess.run(['/usr/bin/radclient','-x','-r','1','-t','1','-S',path,target,'disconnect'],input=packet,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=5,check=False)\n   return 'Disconnect-ACK' in result.stdout\n  finally:\n   try: os.unlink(path)\n   except FileNotFoundError: pass\n except Exception: return False\nwith concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool: results=list(pool.map(send,items))\nprint(json.dumps({'attempted':len(items),'acknowledged':sum(1 for ok in results if ok)}))\n`;
}

export async function disconnectPppoeSessions(scope:any,app:any,usernameValue?:string|string[],force=false,serviceKindValue='ppp'):Promise<DisconnectResult>{
 const usernames=Array.from(new Set((Array.isArray(usernameValue)?usernameValue:[usernameValue]).map(value=>String(value||'').trim()).filter(Boolean))).slice(0,100);
 const usernameFilter=usernames.length?`AND ra.username IN (${usernames.map(()=>'?').join(',')})`:'';
 const serviceKind=serviceKindValue==='hotspot'?'hotspot':'ppp';
 const [rows]:any=await app.query(`SELECT DISTINCT ra.username,ra.acctsessionid,ra.nasipaddress,COALESCE(NULLIF(l.coa_host,''),ra.nasipaddress) coa_host,COALESCE(NULLIF(l.coa_port,0),3799) coa_port,n.secret
  FROM radacct ra LEFT JOIN radcheck rc ON rc.username=ra.username AND rc.attribute='Auth-Type' AND rc.value='Reject'
  JOIN nas n ON n.nasname=ra.nasipaddress JOIN lord_nas l ON l.radius_nas_id=n.id
  WHERE ra.acctstoptime IS NULL AND ra.acctsessionid<>'' ${usernameFilter} AND (?=1 OR rc.id IS NOT NULL) AND l.is_enabled=1 AND FIND_IN_SET(?,l.radius_services)>0
  ORDER BY ra.username,ra.acctsessionid LIMIT 100`,[...usernames,force?1:0,serviceKind]);
 if(!rows.length)return {attempted:0,acknowledged:0};
 const runtime=await readPrivateSetting('environment_runtime','environment_'+Number(scope.environment_id));
 if(!runtime||Number(runtime.tenantId)!==Number(scope.tenant_id)||Number(runtime.subscriptionId)!==Number(scope.subscription_id)||!Number.isSafeInteger(Number(runtime.radiusServerId))||Number(runtime.radiusServerId)<1||!Number.isSafeInteger(Number(runtime.radiusSshServerId))||Number(runtime.radiusSshServerId)<1)throw new Error('RADIUS_DISCONNECT_TRANSPORT_UNAVAILABLE');
 const [configs]:any=await db.query("SELECT setting_value FROM platform_settings WHERE id=? AND setting_group='free_radius'",[runtime.radiusServerId]);
 const radius=configs[0]?JSON.parse(configs[0].setting_value):null;
 if(!radius?.host||Number(radius.sshServerId)!==Number(runtime.radiusSshServerId))throw new Error('RADIUS_DISCONNECT_TRANSPORT_UNAVAILABLE');
 const [sshRows]:any=await db.query('SELECT host FROM server_ssh_connections WHERE database_server_id=?',[runtime.radiusSshServerId]);
 if(!sshRows[0]?.host)throw new Error('RADIUS_DISCONNECT_TRANSPORT_UNAVAILABLE');
 const [radiusAddresses,sshAddresses]=await Promise.all([lookup(radius.host,{all:true}),lookup(sshRows[0].host,{all:true})]);
 if(!radiusAddresses.some((address:any)=>sshAddresses.some((sshAddress:any)=>address.address===sshAddress.address)))throw new Error('RADIUS_DISCONNECT_TRANSPORT_UNAVAILABLE');
 const output=await runManagedRadiusScript(Number(runtime.radiusSshServerId),remoteDisconnectScript(rows));
 const result=JSON.parse(output.trim().split(/\r?\n/).at(-1)||'{}');
 const attempted=Number(result.attempted),acknowledged=Number(result.acknowledged);
 if(!Number.isSafeInteger(attempted)||!Number.isSafeInteger(acknowledged)||attempted!==rows.length||acknowledged<0||acknowledged>attempted)throw new Error('RADIUS_DISCONNECT_RESPONSE_INVALID');
 return {attempted,acknowledged};
}
