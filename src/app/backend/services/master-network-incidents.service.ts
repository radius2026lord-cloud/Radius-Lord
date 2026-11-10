import {createHash,randomUUID} from 'crypto';
import type {PoolConnection} from 'mysql2/promise';
import {db} from '../config/db';
import {listMasterNetworkHealth} from './master-network-health.service';

const stateGroup='master_network_incident_state',historyGroup='master_network_incidents';
type Kind='ovpn'|'api'|'database'|'chr';
type NetworkRef={id:number;environmentId:number;name:string;timezone:string};
type Observation={resource:string;kind:Kind;at:string;ok:boolean;network:NetworkRef|null;networks:NetworkRef[];nasId:number|null;deviceName:string|null;gatewayId:number|null;gatewayName:string|null;lastSuccessAt:string|null;reason:string};
type Cursor={resource:string;lastObservedAt:string;lastHealthyAt:string|null;firstFailureAt:string|null;failures:number;openId:string|null};
type Episode={id:string;resource:string;kind:Kind;status:'open'|'resolved';network:NetworkRef|null;networks:NetworkRef[];nasId:number|null;deviceName:string|null;gatewayId:number|null;gatewayName:string|null;firstFailureAt:string;confirmedAt:string;lastCheckedAt:string;lastSuccessAt:string|null;resolvedAt:string|null;reason:string;searchText:string};
const parse=(value:any)=>{try{return typeof value==='string'?JSON.parse(value):value;}catch{return null;}};
const time=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const fresh=(at:unknown,ttl:number,now:number):at is string=>time(at)&&now-Date.parse(at)>=-5000&&now-Date.parse(at)<=ttl;
const earlierSuccess=(at:unknown,before:string)=>time(at)&&Date.parse(at)<Date.parse(before)?at:null;
const searchable=(episode:Pick<Episode,'network'|'networks'|'deviceName'|'gatewayName'>)=>[episode.network?.name,episode.network?.id,episode.deviceName,episode.gatewayName,...episode.networks.map(n=>n.name)].filter(v=>v!=null).join(' ').toLocaleLowerCase();

// Consume distinct real observations, never page views or repeated cached failures.
function observations(report:Awaited<ReturnType<typeof listMasterNetworkHealth>>):Observation[]{
 const now=Date.parse(report.generatedAt),result:Observation[]=[],gateways=new Map<number,{gateway:any;networks:NetworkRef[]}>();
 for(const item of report.items){
  if(item.environmentStatus!=='ready')continue;
  const network:NetworkRef={id:item.id,environmentId:item.environmentId,name:item.name,timezone:item.timezone};
  const base={network,networks:[network],nasId:null,deviceName:null,gatewayId:null,gatewayName:null};
  if(['ok','failed'].includes(item.database.state)&&fresh(item.database.checkedAt,7*60000,now))result.push({...base,resource:'database:'+item.environmentId,kind:'database',at:item.database.checkedAt,ok:item.database.state==='ok',lastSuccessAt:item.database.lastSuccessAt,reason:item.database.reason||'تعذّر الاتصال بقاعدة البيانات'});
  if(item.connectionMode==='ovpn')for(const gateway of item.ovpn.gateways){const existing=gateways.get(gateway.id);gateways.set(gateway.id,{gateway,networks:[...(existing?.networks??[]),network]});}
  const gatewayBlocked=item.connectionMode==='ovpn'&&item.ovpn.gateways.some((g:{unavailable:boolean;stale:boolean;pending:boolean})=>g.unavailable||g.stale||g.pending);
  if(!gatewayBlocked&&item.api.state!=='unknown')for(const device of item.api.devices){
   if(!['ok','failed'].includes(device.state)||!fresh(device.checkedAt,6*60000,now))continue;
   const transportFailure=device.code&&/^(OVPN_GATEWAY_|NAS_OVPN_TUNNEL_NOT_CONNECTED$)/.test(device.code);
   if(device.state==='failed'&&transportFailure)continue; // not evidence that the NAS API itself is down
   result.push({...base,nasId:device.id,deviceName:device.name,resource:'api:'+item.environmentId+':'+device.id,kind:'api',at:device.checkedAt,ok:device.state==='ok',lastSuccessAt:device.lastSuccessAt,reason:device.code==='NAS_CENTRAL_TUNNEL_MISMATCH'?'عدم تطابق بيانات نفق الشبكة مع CHR':device.code==='NAS_OVPN_ADDRESS_CONFLICT'?'تعارض في هوية عنوان النفق أثناء فحص API':device.code==='NAS_API_TCP_TIMEOUT'?'انتهت مهلة الوصول إلى منفذ API':'تعذّر الوصول إلى API على جهاز NAS'});
  }
  if(item.connectionMode==='ovpn')for(const tunnel of item.ovpn.tunnels??[]){
   if(!['connected','disconnected'].includes(tunnel.state)||!fresh(tunnel.readAt,3*60000,now))continue;
   result.push({...base,nasId:tunnel.nasId,deviceName:tunnel.name,gatewayId:tunnel.gatewayId,gatewayName:tunnel.gateway,resource:'ovpn:'+item.environmentId+':'+tunnel.nasId,kind:'ovpn',at:tunnel.readAt,ok:tunnel.state==='connected',lastSuccessAt:tunnel.lastSeenAt,reason:'انقطاع نفق OpenVPN للجهاز'});
  }
 }
 for(const [id,{gateway,networks}] of gateways){
  const at=gateway.unavailable?gateway.attemptedAt:gateway.readAt;
  if(gateway.stale||gateway.pending||!fresh(at,3*60000,now))continue;
  result.push({resource:'chr:'+id,kind:'chr',at,ok:!gateway.unavailable,network:null,networks,nasId:null,deviceName:null,gatewayId:id,gatewayName:gateway.name,lastSuccessAt:gateway.unavailable?gateway.readAt:null,reason:'تعذّر فحص بوابة CHR المشتركة؛ حالة أنفاق الشبكات غير مؤكدة'});
 }
 const unique=new Map<string,Observation>(),conflicts=new Set<string>();
 for(const observation of result){
  const previous=unique.get(observation.resource);
  if(previous&&previous.at===observation.at&&previous.ok!==observation.ok){conflicts.add(observation.resource);continue;}
  if(!previous||Date.parse(observation.at)>Date.parse(previous.at))unique.set(observation.resource,observation);
 }
 return [...unique.values()].filter(o=>!conflicts.has(o.resource)).sort((a,b)=>a.resource.localeCompare(b.resource));
}
async function save(connection:PoolConnection,group:string,key:string,value:unknown){
 await connection.query("INSERT INTO platform_settings(setting_group,setting_key,setting_value,value_type,is_public) VALUES(?,?,?,'json',0) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[group,key,JSON.stringify(value)]);
}
async function apply(connection:PoolConnection,observation:Observation,old:Cursor|null,key:string){
 if(old&&(old.resource!==observation.resource||!time(old.lastObservedAt)))throw new Error('INCIDENT_CURSOR_INVALID');
 if(old&&Date.parse(observation.at)<=Date.parse(old.lastObservedAt))return;
 const cursor:Cursor=old?{...old}:{resource:observation.resource,lastObservedAt:observation.at,lastHealthyAt:null,firstFailureAt:null,failures:0,openId:null};
 cursor.lastObservedAt=observation.at;
 const seed=earlierSuccess(observation.lastSuccessAt,observation.at);
 if(seed&&(!cursor.lastHealthyAt||Date.parse(seed)>Date.parse(cursor.lastHealthyAt)))cursor.lastHealthyAt=seed;
 await connection.beginTransaction();
 try{
  let episode:Episode|null=null;
  if(cursor.openId){
   const [rows]:any=await connection.query('SELECT setting_value FROM platform_settings WHERE setting_group=? AND setting_key=? FOR UPDATE',[historyGroup,'incident_'+cursor.openId]);
   episode=parse(rows[0]?.setting_value);
   if(!episode||episode.resource!==observation.resource||episode.id!==cursor.openId||episode.status!=='open')throw new Error('INCIDENT_EPISODE_INVALID');
  }
  // A persisted success can fall between two sampled failures while the bounded
  // queue catches up. It breaks failure confirmation and ends an older episode.
  if(!observation.ok&&seed&&old&&Date.parse(seed)>Date.parse(old.lastObservedAt)){
   if(episode){episode.status='resolved';episode.resolvedAt=seed;episode.lastCheckedAt=seed;await save(connection,historyGroup,'incident_'+episode.id,episode);episode=null;}
   cursor.failures=0;cursor.firstFailureAt=null;cursor.openId=null;
  }
  if(!observation.ok&&!episode&&old&&Date.parse(observation.at)-Date.parse(old.lastObservedAt)>15*60000){cursor.failures=0;cursor.firstFailureAt=null;}
  if(observation.ok){
   if(episode){episode.status='resolved';episode.resolvedAt=observation.at;episode.lastCheckedAt=observation.at;await save(connection,historyGroup,'incident_'+episode.id,episode);}
   cursor.lastHealthyAt=observation.at;cursor.failures=0;cursor.firstFailureAt=null;cursor.openId=null;
  }else{
   cursor.firstFailureAt??=observation.at;cursor.failures=Math.min(2,cursor.failures+1);
   if(!episode&&cursor.failures>=2){
    episode={id:randomUUID(),resource:observation.resource,kind:observation.kind,status:'open',network:observation.network,networks:observation.networks,nasId:observation.nasId,deviceName:observation.deviceName,gatewayId:observation.gatewayId,gatewayName:observation.gatewayName,firstFailureAt:cursor.firstFailureAt,confirmedAt:observation.at,lastCheckedAt:observation.at,lastSuccessAt:earlierSuccess(cursor.lastHealthyAt,cursor.firstFailureAt),resolvedAt:null,reason:observation.reason,searchText:''};cursor.openId=episode.id;
   }
   if(episode){
    episode.lastCheckedAt=observation.at;episode.reason=observation.reason;episode.network=observation.network;episode.networks=observation.networks;episode.deviceName=observation.deviceName;episode.gatewayName=observation.gatewayName;episode.searchText=searchable(episode);
    await save(connection,historyGroup,'incident_'+episode.id,episode);
   }
  }
  await save(connection,stateGroup,key,cursor);await connection.commit();
 }catch(error){try{await connection.rollback();}catch{connection.destroy();}throw error;}
}

export function startMasterNetworkIncidentWorker(){
 let stopped=false,timer:ReturnType<typeof setTimeout>,offset=0;
 async function tick(){
  let connection:PoolConnection|undefined,locked=false;
  try{
   connection=await db.pool.getConnection();const [locks]:any=await connection.query("SELECT GET_LOCK('lord-master-network-incidents',0) acquired");locked=Number(locks[0]?.acquired)===1;if(!locked)return;
   const report=await listMasterNetworkHealth(),all=observations(report);
   const count=Math.min(50,all.length),batch=Array.from({length:count},(_,i)=>all[(offset+i)%all.length]);offset=all.length?(offset+count)%all.length:0;
   if(!batch.length)return;
   const keys=batch.map(o=>'resource_'+createHash('sha256').update(o.resource).digest('hex'));
   const [rows]:any=await connection.query('SELECT setting_key,setting_value FROM platform_settings WHERE setting_group=? AND setting_key IN (?)',[stateGroup,keys]);
   const states=new Map<string,any>(rows.map((row:any)=>[row.setting_key,parse(row.setting_value)]));
   for(let index=0;index<batch.length&&!stopped;index++){
    const key=keys[index];if(states.has(key)&&!states.get(key))throw new Error('INCIDENT_CURSOR_INVALID');
    await apply(connection,batch[index],states.get(key)??null,key);
   }
  }catch(error){console.warn('[master-network-incidents]',{code:/^[A-Z0-9_]{1,80}$/.test((error as any)?.code||'')?(error as any).code:/^INCIDENT_[A-Z_]+$/.test((error as Error)?.message||'')?(error as Error).message:'INCIDENT_WORKER_UNAVAILABLE'});}
  finally{if(connection){try{if(locked)await connection.query("SELECT RELEASE_LOCK('lord-master-network-incidents')");connection.release();}catch{connection.destroy();}}if(!stopped)timer=setTimeout(()=>void tick(),15000);}
 }
 timer=setTimeout(()=>void tick(),15000);return()=>{stopped=true;clearTimeout(timer);};
}

export async function listMasterNetworkIncidents(query:Record<string,unknown>){
 const single=(key:string,defaultValue:string)=>{const value=query[key];if(value===undefined)return defaultValue;if(typeof value!=='string')throw new RangeError('INVALID_INCIDENT_FILTER');return value;};
 const status=single('status','all'),kind=single('kind','all'),period=single('period','all'),network=single('network','all'),search=single('q','').trim(),page=Number(single('page','1')),limit=Number(single('limit','24'));
 if(!['all','open','resolved'].includes(status)||!['all','ovpn','api','database','chr'].includes(kind)||!['all','24h','7d','30d'].includes(period)||network!=='all'&&!/^[1-9][0-9]*$/.test(network)||network!=='all'&&!Number.isSafeInteger(Number(network))||search.length>160||!Number.isSafeInteger(page)||page<1||page>100000||![12,24,48,96].includes(limit))throw new RangeError('INVALID_INCIDENT_FILTER');
 const where=["setting_group=?"],params:any[]=[historyGroup];
 if(kind!=='all'){where.push("JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.kind'))=?");params.push(kind);}
 if(period!=='all'){where.push("JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.firstFailureAt'))>=?");params.push(new Date(Date.now()-({'24h':1,'7d':7,'30d':30}[period as '24h'|'7d'|'30d'])*86400000).toISOString());}
 if(network!=='all'){where.push("(JSON_EXTRACT(setting_value,'$.network.id')=? OR JSON_CONTAINS(JSON_EXTRACT(setting_value,'$.networks'),CAST(? AS JSON)))");params.push(Number(network),JSON.stringify({id:Number(network)}));}
 if(search){where.push("JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.searchText')) LIKE ? ESCAPE '!'");params.push('%'+search.toLocaleLowerCase().replace(/[!%_]/g,match=>'!'+match)+'%');}
 const filter=where.join(' AND '),selected=status==='all'?'':" AND JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.status'))=?";
 const [countsResult,rowsResult,networkResult]=await Promise.all([
  db.query(`SELECT JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.status')) status,COUNT(*) count FROM platform_settings WHERE ${filter} GROUP BY status`,params),
  db.query(`SELECT setting_value FROM platform_settings WHERE ${filter}${selected} ORDER BY JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.firstFailureAt')) DESC,setting_key DESC LIMIT ? OFFSET ?`,[...params,...(status==='all'?[]:[status]),limit,(page-1)*limit]),
  db.query('SELECT id,name FROM tenants WHERE archived_at IS NULL ORDER BY name,id'),
 ]);
 const counts:Record<string,number>={open:0,resolved:0};for(const row of countsResult[0] as any[])if(['open','resolved'].includes(row.status))counts[row.status]=Number(row.count);counts.all=counts.open+counts.resolved;
 const now=Date.now(),items=(rowsResult[0] as any[]).map(row=>parse(row.setting_value)).filter((episode):episode is Episode=>Boolean(episode?.id&&['open','resolved'].includes(episode.status)&&time(episode.firstFailureAt))).map(({resource,searchText,...episode})=>({...episode,durationSeconds:Math.max(0,Math.floor(((episode.resolvedAt?Date.parse(episode.resolvedAt):now)-Date.parse(episode.firstFailureAt))/1000))}));
 return {generatedAt:new Date(now).toISOString(),items,counts,total:counts[status],page,limit,networks:networkResult[0]};
}
