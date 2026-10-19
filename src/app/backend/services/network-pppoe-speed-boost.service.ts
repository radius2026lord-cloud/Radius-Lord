import {lookup} from 'dns/promises';
import {db} from '../config/db';
import {readPrivateSetting} from './radius-provision.service';
import {runManagedRadiusScript} from './ssh-terminal.service';
import {withNetwork} from './network-runtime.service';
import {managerAccess} from './network-manager-access.service';

type CoaSession={host:string;port:number;secret:string;username:string;sessionId:string;nasIp:string;rateLimit:string};

function toBps(value:any){
 const mbps=Number(value);
 if(!Number.isFinite(mbps)||mbps<=0||mbps>1_000_000||Math.round(mbps*1000)!==mbps*1000)throw new Error('PPPOE_SPEED_BOOST_INPUT');
 return BigInt(Math.round(mbps*1_000_000));
}
function formatBps(value:bigint){
 for(const [size,suffix] of [[1_000_000_000n,'G'],[1_000_000n,'M'],[1_000n,'k']] as const)if(value%size===0n)return `${value/size}${suffix}`;
 return String(value);
}
function rateLimit(downloadBps:bigint,uploadBps:bigint){
 // RouterOS Mikrotik-Rate-Limit order in this project is upload/download.
 return `${formatBps(uploadBps)}/${formatBps(downloadBps)}`;
}

function remoteCoaScript(rows:CoaSession[]){
 const payload=Buffer.from(JSON.stringify(rows)).toString('base64');
 return `import base64,json,ipaddress,os,re,subprocess,tempfile,concurrent.futures\nitems=json.loads(base64.b64decode('${payload}'))\ndef quoted(value): return '"'+str(value).replace('\\\\','\\\\\\\\').replace('"','\\\\"').replace('\\r','').replace('\\n','')+'"'\ndef send(item):\n try:\n  host=item['host'];port=int(item['port']);session=item['sessionId'];username=item['username'];nas=ipaddress.IPv4Address(item['nasIp']);rate=item['rateLimit']\n  if host.startswith('[') and host.endswith(']'): host=host[1:-1]\n  if not re.fullmatch(r'[A-Za-z0-9._:-]{1,255}',host) or not 1<=port<=65535 or not 1<=len(session)<=64 or not username or any(ch in username for ch in '\\r\\n') or not re.fullmatch(r'[0-9.]+[kKmMgG]?/[0-9.]+[kKmMgG]?',rate) or not item['secret']: return False\n  target=('['+host+']' if ':' in host and not host.startswith('[') else host)+':'+str(port)\n  packet='User-Name = '+quoted(username)+'\\nNAS-IP-Address = '+str(nas)+'\\nAcct-Session-Id = '+quoted(session)+'\\nMikrotik-Rate-Limit = '+quoted(rate)+'\\n'\n  fd,path=tempfile.mkstemp(prefix='rl-coa-',dir='/run')\n  try:\n   os.fchmod(fd,0o600)\n   with os.fdopen(fd,'w') as secret_file: secret_file.write(item['secret'])\n   result=subprocess.run(['/usr/bin/radclient','-r','1','-t','2','-S',path,target,'coa'],input=packet,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=6,check=False)\n   return 'CoA-ACK' in result.stdout\n  finally:\n   try: os.unlink(path)\n   except FileNotFoundError: pass\n except Exception: return False\nwith concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool: results=list(pool.map(send,items))\nprint(json.dumps({'attempted':len(items),'acknowledged':sum(1 for ok in results if ok)}))\n`;
}

async function sendCoa(scope:any,sessions:any[],rateLimit:string){
 const runtime=await readPrivateSetting('environment_runtime','environment_'+Number(scope.environment_id));
 if(!runtime||Number(runtime.tenantId)!==Number(scope.tenant_id)||Number(runtime.subscriptionId)!==Number(scope.subscription_id)||!Number.isSafeInteger(Number(runtime.radiusServerId))||!Number.isSafeInteger(Number(runtime.radiusSshServerId)))throw new Error('PPPOE_SPEED_BOOST_TRANSPORT_UNAVAILABLE');
 const [configs]:any=await db.query("SELECT setting_value FROM platform_settings WHERE id=? AND setting_group='free_radius'",[runtime.radiusServerId]);
 const radius=configs[0]?JSON.parse(configs[0].setting_value):null;
 if(!radius?.host||Number(radius.sshServerId)!==Number(runtime.radiusSshServerId))throw new Error('PPPOE_SPEED_BOOST_TRANSPORT_UNAVAILABLE');
 const [sshRows]:any=await db.query('SELECT host FROM server_ssh_connections WHERE database_server_id=?',[runtime.radiusSshServerId]);
 if(!sshRows[0]?.host)throw new Error('PPPOE_SPEED_BOOST_TRANSPORT_UNAVAILABLE');
 const [radiusAddresses,sshAddresses]=await Promise.all([lookup(radius.host,{all:true}),lookup(sshRows[0].host,{all:true})]);
 if(!radiusAddresses.some((address:any)=>sshAddresses.some((sshAddress:any)=>address.address===sshAddress.address)))throw new Error('PPPOE_SPEED_BOOST_TRANSPORT_UNAVAILABLE');
 const items=sessions.map((row:any)=>({host:String(row.coa_host),port:Number(row.coa_port)||3799,secret:String(row.secret),username:String(row.username),sessionId:String(row.acctsessionid),nasIp:String(row.nasipaddress),rateLimit}));
 const output=await runManagedRadiusScript(Number(runtime.radiusSshServerId),remoteCoaScript(items));
 const result=JSON.parse(output.trim().split(/\r?\n/).at(-1)||'{}'),attempted=Number(result.attempted),acknowledged=Number(result.acknowledged);
 if(!Number.isSafeInteger(attempted)||!Number.isSafeInteger(acknowledged)||attempted!==items.length||acknowledged<0||acknowledged>attempted)throw new Error('PPPOE_SPEED_BOOST_TRANSPORT_UNAVAILABLE');
 return {attempted,acknowledged};
}

async function getActiveSessions(app:any,username:string){
 const [rows]:any=await app.query(`SELECT ra.username,ra.acctsessionid,ra.nasipaddress,COALESCE(NULLIF(l.coa_host,''),ra.nasipaddress) coa_host,COALESCE(NULLIF(l.coa_port,0),3799) coa_port,n.secret
  FROM radacct ra JOIN nas n ON n.nasname=ra.nasipaddress JOIN lord_nas l ON l.radius_nas_id=n.id
  WHERE ra.username=? AND ra.acctstoptime IS NULL AND ra.acctsessionid<>'' AND l.is_enabled=1 AND FIND_IN_SET('ppp',l.radius_services)>0
  ORDER BY ra.radacctid LIMIT 20`,[username]);
 return rows;
}

export async function startPppoeLineSpeedBoost(scope:any,lineValue:any,input:any){
 const id=Number(lineValue),downloadBps=toBps(input?.downloadMbps),uploadBps=toBps(input?.uploadMbps),durationValue=Number(input?.durationValue),durationUnit=String(input?.durationUnit||'');
 const units:Record<string,number>={minute:60,hour:3600,day:86400};
 if(!Number.isSafeInteger(id)||id<1||!Number.isInteger(durationValue)||durationValue<1||!units[durationUnit]||durationValue*units[durationUnit]>2592000)throw new Error('PPPOE_SPEED_BOOST_INPUT');
 await withNetwork(scope,async app=>{const access=await managerAccess(app,scope.managerId,scope.authVersion);if(access.role!=='principal'&&!access.permissions.includes('customers.update'))throw new Error('NETWORK_AUTH');});
 await revertExpiredPppoeLineSpeedBoosts(scope);
 return withNetwork(scope,async app=>{
  const access=await managerAccess(app,scope.managerId,scope.authVersion);
  if(access.role!=='principal'&&!access.permissions.includes('customers.update'))throw new Error('NETWORK_AUTH');
  await app.beginTransaction();let coaAttempted=false,username='',originalRate='',boostedRate='';
  try{
   const [accounts]:any=await app.query(`SELECT p.id,p.radius_identity_id,p.admin_status,r.current_username username,sp.lifecycle,sp.expires_at
    FROM pppoe_accounts p JOIN radius_identities r ON r.id=p.radius_identity_id
    JOIN pppoe_subscriptions sp ON sp.id=(SELECT s.id FROM pppoe_subscriptions s WHERE s.account_id=p.id AND s.service_role='base' ORDER BY s.id DESC LIMIT 1)
    WHERE p.id=? AND p.archived_at IS NULL FOR UPDATE`,[id]);
   const account=accounts[0];if(!account)throw new Error('PPPOE_LINE_UNAVAILABLE');username=String(account.username);
   if(account.admin_status!=='enabled'||account.lifecycle!=='active'||account.expires_at&&new Date(account.expires_at).getTime()<=Date.now())throw new Error('PPPOE_SPEED_BOOST_LINE_INACTIVE');
   const sessions=await getActiveSessions(app,username);if(!sessions.length)throw new Error('PPPOE_SPEED_BOOST_SESSION_REQUIRED');
   const [existing]:any=await app.query("SELECT id FROM pppoe_line_speed_boosts WHERE account_id=? AND status='active' FOR UPDATE",[id]);if(existing.length)throw new Error('PPPOE_SPEED_BOOST_ACTIVE');
   const [overrides]:any=await app.query("SELECT op,value FROM radreply WHERE username=? AND attribute='Mikrotik-Rate-Limit' ORDER BY id",[username]);
   const [groups]:any=await app.query(`SELECT rr.value FROM radusergroup ug JOIN radgroupreply rr ON rr.groupname=ug.groupname
    WHERE ug.username=? AND rr.attribute='Mikrotik-Rate-Limit' ORDER BY ug.priority,ug.id,rr.id LIMIT 1`,[username]);
   originalRate=String(overrides[0]?.value||groups[0]?.value||'');if(!originalRate)throw new Error('PPPOE_SPEED_BOOST_RATE_UNAVAILABLE');
   boostedRate=rateLimit(downloadBps,uploadBps);
   const originalOverrides=JSON.stringify(overrides.map((row:any)=>({op:String(row.op),value:String(row.value)})));
   const durationSeconds=durationValue*units[durationUnit];
   const [clock]:any=await app.query('SELECT UTC_TIMESTAMP(6) started_at,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL '+durationSeconds+' SECOND) expires_at');
   await app.query("DELETE FROM radreply WHERE username=? AND attribute='Mikrotik-Rate-Limit'",[username]);
   await app.query("INSERT INTO radreply(username,attribute,op,value) VALUES(?,'Mikrotik-Rate-Limit',':=',?)",[username,boostedRate]);
   const [created]:any=await app.query(`INSERT INTO pppoe_line_speed_boosts(account_id,username,multiplier,download_bps,upload_bps,original_rate_limit,boosted_rate_limit,original_user_reply,started_at,expires_at,created_by)
    VALUES(?,?,NULL,?,?,?,?,?,?,?,?)`,[id,username,downloadBps.toString(),uploadBps.toString(),originalRate,boostedRate,originalOverrides,clock[0].started_at,clock[0].expires_at,scope.managerId]);
   coaAttempted=true;const result=await sendCoa(scope,sessions,boostedRate);if(result.acknowledged!==result.attempted)throw new Error('PPPOE_SPEED_BOOST_COA_FAILED');
   const [actor]:any=await app.query('SELECT id,full_name FROM managers WHERE id=?',[scope.managerId]);
   await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,account_id,after_data,result) VALUES(?,?,'manager','pppoe.line.speed_boost','pppoe_account',?,?,?,'success')",[scope.managerId,JSON.stringify({id:actor[0]?.id,full_name:actor[0]?.full_name}),id,account.radius_identity_id,JSON.stringify({downloadBps:downloadBps.toString(),uploadBps:uploadBps.toString(),originalRateLimit:originalRate,boostedRateLimit:boostedRate,startedAt:clock[0].started_at,expiresAt:clock[0].expires_at})]);
   await app.commit();return {success:true,id:Number(created.insertId),rateLimit:boostedRate,expiresAt:clock[0].expires_at};
  }catch(error){await app.rollback();if(coaAttempted&&originalRate)try{const sessions=await getActiveSessions(app,username);if(sessions.length)await sendCoa(scope,sessions,originalRate);}catch{}throw error;}
 });
}

async function restoreReply(app:any,username:string,originalUserReply:string){
 await app.query("DELETE FROM radreply WHERE username=? AND attribute='Mikrotik-Rate-Limit'",[username]);
 let original:any=[];try{original=JSON.parse(originalUserReply);}catch{}
 for(const row of Array.isArray(original)?original:[])if(typeof row?.op==='string'&&typeof row?.value==='string')await app.query("INSERT INTO radreply(username,attribute,op,value) VALUES(?,'Mikrotik-Rate-Limit',?,?)",[username,row.op,row.value]);
}

export async function revertExpiredPppoeLineSpeedBoosts(scope:any){
 return withNetwork(scope,async app=>{
  const [lock]:any=await app.query("SELECT GET_LOCK('radius-lord:pppoe-line-speed-boosts',0) acquired");if(!lock[0]?.acquired)return 0;
  let count=0;
  try{
   const [due]:any=await app.query("SELECT id FROM pppoe_line_speed_boosts WHERE status='active' AND expires_at<=UTC_TIMESTAMP(6) ORDER BY expires_at,id LIMIT 20");
   for(const item of due){
    await app.beginTransaction();let changed=false;
    try{
     const [rows]:any=await app.query("SELECT * FROM pppoe_line_speed_boosts WHERE id=? AND status='active' AND expires_at<=UTC_TIMESTAMP(6) FOR UPDATE",[item.id]);const boost=rows[0];if(!boost){await app.rollback();continue;}
     const sessions=await getActiveSessions(app,String(boost.username));
     if(sessions.length){const result=await sendCoa(scope,sessions,String(boost.original_rate_limit));if(result.attempted!==result.acknowledged)throw new Error('PPPOE_SPEED_BOOST_COA_FAILED');changed=true;}
     await restoreReply(app,String(boost.username),String(boost.original_user_reply));
     await app.query("UPDATE pppoe_line_speed_boosts SET status='reverted',reverted_at=UTC_TIMESTAMP(6) WHERE id=?",[boost.id]);
     await app.query("INSERT INTO activity_log(actor_kind,action_code,target_type,target_id,before_data,after_data,result) VALUES('system','pppoe.line.speed_boost.revert','pppoe_account',?,?,?,'success')",[boost.account_id,JSON.stringify({rateLimit:boost.boosted_rate_limit,expiresAt:boost.expires_at}),JSON.stringify({rateLimit:boost.original_rate_limit,revertedAt:new Date().toISOString(),activeSessionUpdated:changed})]);
     await app.commit();count++;
    }catch(error){await app.rollback();console.error('[pppoe-line-speed-boost]',(error as any)?.code||(error as Error).message||'REVERT_FAILED');}
   }
   return count;
  }finally{await app.query("SELECT RELEASE_LOCK('radius-lord:pppoe-line-speed-boosts')");}
 });
}
