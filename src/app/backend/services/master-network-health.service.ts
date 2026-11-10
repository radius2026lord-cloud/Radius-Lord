import type {PoolConnection} from 'mysql2/promise';
import {db} from '../config/db';
import {withNetwork} from './network-runtime.service';
import {readMasterNetworkTunnels,describeMasterNetworkTunnels} from './master-network-tunnels.service';

const group='master_network_health',requestGroup='master_network_health_requests';
const intervalMs=5*60000,staleMs=7*60000;
const parse=(value:any)=>{try{return typeof value==='string'?JSON.parse(value):value;}catch{return null;}};
const fresh=(value:unknown,ttl:number,now=Date.now())=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&now-Date.parse(value)>=-5000&&now-Date.parse(value)<=ttl;
type SignalState='ok'|'failed'|'unknown'|'stale'|'pending'|'not_applicable';
type ApiDevice={id:number;name:string;state:SignalState;checkedAt:string|null;lastSuccessAt:string|null;code:string|null};
type Snapshot={tenantId:number;environmentId:number;checkedAt:string;lastSuccessAt:string|null;handledRequestAt:string|null;connectionMode:'ovpn'|'direct'|'unknown';timezone:string;nasInventory:Array<{id:number;name:string;enabled:boolean}>;database:{state:SignalState;code:string|null;latencyMs:number|null};apiDevices:ApiDevice[];apiReadOk:boolean};
function safeCode(error:unknown){const code=(error as {code?:string})?.code||(error as Error)?.message;return /^[A-Z0-9_]{1,80}$/.test(code||'')?code!:'HEALTH_CHECK_UNAVAILABLE';}
const reasons:Record<string,string>={ECONNREFUSED:'رفض الاتصال بقاعدة البيانات',ETIMEDOUT:'انتهت مهلة الاتصال بقاعدة البيانات',PROTOCOL_SEQUENCE_TIMEOUT:'انتهت مهلة استعلام قاعدة البيانات',ER_ACCESS_DENIED_ERROR:'تعذّر التحقق من بيانات اتصال قاعدة البيانات',ER_BAD_DB_ERROR:'قاعدة البيانات غير متاحة',NETWORK_DATABASE_SCOPE:'اسم قاعدة البيانات لا يطابق الشبكة',NETWORK_CONNECTIONS_BUSY:'الفحص مؤجل لانشغال اتصالات قاعدة البيانات',NETWORK_NOT_AVAILABLE:'إعداد اتصال قاعدة البيانات غير متاح',NAS_SNAPSHOT_SCOPE:'بيانات الربط لا تطابق هوية الشبكة'};

async function observe(environment:any,previous:Snapshot|null,requestedAt:string|null):Promise<Snapshot>{
 const checkedAt=new Date().toISOString();
 const result:Snapshot={tenantId:Number(environment.tenantId),environmentId:Number(environment.environmentId),checkedAt,lastSuccessAt:previous?.lastSuccessAt??null,handledRequestAt:requestedAt,connectionMode:previous?.connectionMode??'unknown',timezone:previous?.timezone||'Asia/Damascus',nasInventory:previous?.nasInventory??[],database:{state:'unknown',code:null,latencyMs:null},apiDevices:previous?.apiDevices??[],apiReadOk:false};
 const started=Date.now();
 try{
  // Resolve only this environment's credentials. Health checks are independent of
  // subscription validity: an expired plan does not imply an unreachable database.
  const [rows]:any=await db.query(`SELECT t.id tenant_id,e.id environment_id,d.db_name,d.db_username,d.app_password_encrypted,
   ds.host database_host,ds.port database_port,ds.tls_required,ds.tls_ca_reference
   FROM tenants t JOIN tenant_environments e ON e.tenant_id=t.id
   JOIN tenant_databases d ON d.id=e.tenant_database_id AND d.tenant_id=t.id
   JOIN database_servers ds ON ds.id=d.database_server_id
   WHERE t.id=? AND e.id=? AND t.archived_at IS NULL AND e.archived_at IS NULL AND e.status='ready'
    AND ds.archived_at IS NULL AND ds.status='active' AND d.status='active' AND d.credentials_state='ready'`,[environment.tenantId,environment.environmentId]);
  const scope=rows[0];if(!scope||scope.tls_ca_reference)throw new Error('NETWORK_NOT_AVAILABLE');
  await withNetwork(scope,async app=>{
   await app.query({sql:'SELECT 1',timeout:3000});
   result.database={state:'ok',code:null,latencyMs:Date.now()-started};result.lastSuccessAt=checkedAt;
   try{
    const [settings]:any=await app.query({sql:'SELECT configuration_snapshot FROM network_ovpn_settings WHERE id=1',timeout:3000});
    const config=parse(settings[0]?.configuration_snapshot);
    if(!config||Number(config.tenantId)!==result.tenantId||Number(config.environmentId)!==result.environmentId)throw new Error('NAS_SNAPSHOT_SCOPE');
    result.connectionMode=config.connectionMode==='direct'?'direct':'ovpn';
    const [zones]:any=await app.query({sql:'SELECT timezone FROM network_settings WHERE id=1',timeout:3000});
    const zone=String(zones[0]?.timezone||'Asia/Damascus');try{new Intl.DateTimeFormat('en',{timeZone:zone});result.timezone=zone;}catch{}
    const table=result.connectionMode==='direct'?'nas_direct_connections':'nas_ovpn_connections';
    const [nas]:any=await app.query({sql:`SELECT l.id,l.name,ms.is_enabled apiEnabled,
     JSON_EXTRACT(c.configuration_snapshot,'$.tenantId') tenantId,JSON_EXTRACT(c.configuration_snapshot,'$.environmentId') environmentId,
     JSON_UNQUOTE(JSON_EXTRACT(c.configuration_snapshot,'$.apiLastCheck.receivedAt')) checkedAt,
     JSON_UNQUOTE(JSON_EXTRACT(c.configuration_snapshot,'$.apiLastCheck.ok')) ok,
     JSON_UNQUOTE(JSON_EXTRACT(c.configuration_snapshot,'$.apiLastCheck.code')) code,
     JSON_UNQUOTE(JSON_EXTRACT(c.configuration_snapshot,'$.apiLastSuccessAt')) lastSuccessAt
     FROM lord_nas l LEFT JOIN ${table} c ON c.nas_id=l.id
     LEFT JOIN nas_management_services ms ON ms.id=(SELECT MIN(m.id) FROM nas_management_services m WHERE m.lord_nas_id=l.id AND m.service_type='api')
     WHERE l.archived_at IS NULL AND l.is_enabled=1 ORDER BY l.id`,timeout:3000});
    result.nasInventory=nas.map((n:any)=>({id:Number(n.id),name:String(n.name),enabled:true}));
    result.apiDevices=nas.filter((n:any)=>Number(n.apiEnabled)===1).map((n:any):ApiDevice=>{
     const valid=Number(n.tenantId)===result.tenantId&&Number(n.environmentId)===result.environmentId;
     const state:SignalState=!valid?'unknown':!n.checkedAt?'pending':!fresh(n.checkedAt,6*60000)?'stale':n.ok==='true'?'ok':n.ok==='false'?'failed':'unknown';
     return {id:Number(n.id),name:String(n.name),state,checkedAt:valid?n.checkedAt??null:null,lastSuccessAt:valid?n.lastSuccessAt||(n.ok==='true'?n.checkedAt:null):null,code:valid?(n.code&&/^[A-Z0-9_]{1,80}$/.test(n.code)?n.code:null):'NAS_SNAPSHOT_SCOPE'};
    });result.apiReadOk=true;
   }catch(error){result.apiReadOk=false;console.warn('[network-health-readings]',{environmentId:result.environmentId,code:safeCode(error)});}
  });
 }catch(error){
  const code=safeCode(error);result.database={state:['NETWORK_NOT_AVAILABLE','NETWORK_CONNECTIONS_BUSY'].includes(code)?'unknown':'failed',code,latencyMs:null};
  console.warn('[network-health]',{environmentId:result.environmentId,code});
 }
 return result;
}

export async function listMasterNetworkHealth(){
 const now=Date.now();
 const [rows]:any=await db.query(`SELECT t.id,t.name,t.slug,t.status,e.id environmentId,e.status environmentStatus,
  p.setting_value snapshot,r.setting_value request
  FROM tenants t JOIN tenant_environments e ON e.id=(SELECT MAX(candidate.id) FROM tenant_environments candidate WHERE candidate.tenant_id=t.id AND candidate.archived_at IS NULL AND candidate.ready_at IS NOT NULL)
  LEFT JOIN platform_settings p ON p.setting_group=? AND p.setting_key=CONCAT('environment_',e.id)
  LEFT JOIN platform_settings r ON r.setting_group=? AND r.setting_key=CONCAT('environment_',e.id)
  WHERE t.archived_at IS NULL ORDER BY t.id DESC`,[group,requestGroup]);
 const inventory=await readMasterNetworkTunnels(rows.map((row:any)=>Number(row.environmentId)));
 const items=rows.map((row:any)=>{
  const saved=parse(row.snapshot),snapshot:Snapshot|null=Number(saved?.tenantId)===Number(row.id)&&Number(saved?.environmentId)===Number(row.environmentId)?saved:null;
  const request=parse(row.request),queued=Boolean(request?.requestedAt&&(!snapshot?.handledRequestAt||request.requestedAt>snapshot.handledRequestAt));
  const expired=!snapshot||!fresh(snapshot.checkedAt,staleMs,now);
  const database={state:(!snapshot?'pending':expired?'stale':snapshot.database.state) as SignalState,checkedAt:snapshot?.checkedAt??null,lastSuccessAt:snapshot?.lastSuccessAt??null,latencyMs:expired?null:snapshot?.database.latencyMs??null,reason:snapshot?.database.code?reasons[snapshot.database.code]||'تعذّر تنفيذ فحص قاعدة البيانات':null};
  const devices=(snapshot?.apiDevices??[]).map(device=>({...device,state:!fresh(device.checkedAt,6*60000,now)&&device.checkedAt?'stale':device.state}));
  const usable=!expired&&snapshot?.database.state==='ok'&&snapshot.apiReadOk;
  const total=devices.length,connected=usable?devices.filter(d=>d.state==='ok').length:0;
  const apiState:SignalState=!snapshot?'pending':expired?'stale':!usable?'unknown':!total?'pending':devices.some(d=>d.state==='failed')?'failed':devices.some(d=>d.state==='stale')?'stale':devices.every(d=>d.state==='ok')?'ok':devices.some(d=>d.state==='unknown')?'unknown':'pending';
  const checked=devices.map(d=>d.checkedAt).filter((v):v is string=>Boolean(v)).sort();
  const api={state:apiState,total,connected,checkedAt:checked.length===total&&total?checked[0]:null,devices};
  const ovpn=describeMasterNetworkTunnels(inventory,Number(row.environmentId),snapshot?.nasInventory,true);
  const mode=snapshot?.connectionMode??'unknown',local=mode==='direct';
  const tunnelState:SignalState=local?'not_applicable':mode==='unknown'?'pending':ovpn.state==='connected'?'ok':ovpn.state==='disconnected'||ovpn.state==='partial'?'failed':ovpn.state==='stale'?'stale':ovpn.state==='unavailable'?'unknown':'pending';
  const allDown=!local&&mode==='ovpn'&&ovpn.total>0&&ovpn.state==='disconnected';
  const states=[database.state,api.state,...(local?[]:[tunnelState])];
  const state=row.environmentStatus!=='ready'?'unknown':allDown?'disconnected':states.includes('failed')?'attention':states.includes('unknown')?'unknown':states.includes('stale')?'stale':states.includes('pending')?'pending':'healthy';
  return {id:Number(row.id),name:row.name,slug:row.slug,environmentId:Number(row.environmentId),environmentStatus:row.environmentStatus,tenantStatus:row.status,timezone:snapshot?.timezone||'Asia/Damascus',connectionMode:mode,state,queued,checkedAt:snapshot?.checkedAt??null,database,api,ovpn:{...ovpn,state:tunnelState},reason:allDown?'جميع أنفاق الشبكة منقطعة':database.state==='failed'?database.reason:apiState==='failed'?'تعذّر الوصول إلى API لبعض الأجهزة':tunnelState==='failed'?'يوجد جهاز NAS منقطع':state==='stale'?'تحتاج القراءات إلى تحديث':state==='unknown'?'تعذّر التحقق من إحدى الخدمات':state==='pending'?'بانتظار اكتمال الفحوص':null};
 });
 const affected=new Map<number,{id:number;name:string;state:string;networks:number}>();
 for(const item of items)if(item.connectionMode==='ovpn')for(const gateway of item.ovpn.gateways){if(!gateway.unavailable&&!gateway.stale)continue;const previous=affected.get(gateway.id);affected.set(gateway.id,{id:gateway.id,name:gateway.name,state:gateway.unavailable?'unknown':'stale',networks:(previous?.networks??0)+1});}
 return {generatedAt:new Date(now).toISOString(),items,gateways:[...affected.values()]};
}

export async function requestMasterNetworkHealth(environmentId:number){
 const [rows]:any=await db.query("SELECT id FROM tenant_environments WHERE id=? AND status='ready' AND archived_at IS NULL",[environmentId]);
 if(!rows[0])throw new Error('NETWORK_HEALTH_NOT_READY');
 const requestedAt=new Date().toISOString(),key='environment_'+environmentId;
 // Atomic cooldown; repeated clicks/tabs cannot enqueue unbounded work.
 await db.query(`INSERT INTO platform_settings(setting_group,setting_key,setting_value,value_type,is_public) VALUES(?,?,?,'json',0)
  ON DUPLICATE KEY UPDATE setting_value=IF(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(setting_value,'$.requestedAt')),'')<?,VALUES(setting_value),setting_value)`,[requestGroup,key,JSON.stringify({requestedAt}),new Date(Date.now()-30000).toISOString()]);
}

export function startMasterNetworkHealthWorker(){
 let stopped=false,timer:ReturnType<typeof setTimeout>;
 async function tick(){
  let central:PoolConnection|undefined,locked=false;
  try{
   central=await db.pool.getConnection();const [locks]:any=await central.query("SELECT GET_LOCK('lord-master-network-health',0) acquired");locked=Number(locks[0]?.acquired)===1;if(!locked)return;
   const [rows]:any=await central.query(`SELECT t.id tenantId,e.id environmentId,p.setting_value snapshot,r.setting_value request
    FROM tenants t JOIN tenant_environments e ON e.id=(SELECT MAX(candidate.id) FROM tenant_environments candidate WHERE candidate.tenant_id=t.id AND candidate.archived_at IS NULL AND candidate.ready_at IS NOT NULL)
    LEFT JOIN platform_settings p ON p.setting_group=? AND p.setting_key=CONCAT('environment_',e.id)
    LEFT JOIN platform_settings r ON r.setting_group=? AND r.setting_key=CONCAT('environment_',e.id)
    LEFT JOIN platform_settings api ON api.setting_group='nas_api_monitor' AND api.setting_key=CONCAT('environment_',e.id)
    WHERE t.archived_at IS NULL AND e.status='ready' AND (
     COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r.setting_value,'$.requestedAt')),'null'),'')>COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.handledRequestAt')),'null'),'')
     OR COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(api.setting_value,'$.observedAt')),'null'),'')>COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.checkedAt')),'null'),'')
     OR COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.checkedAt')),'null'),'')<?)
    ORDER BY (COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r.setting_value,'$.requestedAt')),'null'),'')>COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.handledRequestAt')),'null'),'')) DESC,
     COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.checkedAt')),'null'),''),e.id LIMIT 1`,[group,requestGroup,new Date(Date.now()-intervalMs).toISOString()]);
   const row=rows[0];if(!row||stopped)return;const old=parse(row.snapshot),previous=Number(old?.tenantId)===Number(row.tenantId)&&Number(old?.environmentId)===Number(row.environmentId)?old:null;
   const result=await observe(row,previous,parse(row.request)?.requestedAt??null);
   await central.query("INSERT INTO platform_settings(setting_group,setting_key,setting_value,value_type,is_public) VALUES(?,?,?,'json',0) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[group,'environment_'+row.environmentId,JSON.stringify(result)]);
  }catch(error){console.warn('[master-network-health]',{code:safeCode(error)});}
  finally{if(central){try{if(locked)await central.query("SELECT RELEASE_LOCK('lord-master-network-health')");central.release();}catch{central.destroy();}}if(!stopped)timer=setTimeout(()=>void tick(),10000);}
 }
 timer=setTimeout(()=>void tick(),10000);return()=>{stopped=true;clearTimeout(timer);};
}
