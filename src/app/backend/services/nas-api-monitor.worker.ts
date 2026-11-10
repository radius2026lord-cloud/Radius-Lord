import type {PoolConnection} from 'mysql2/promise';
import {db} from '../config/db';
import {networkScope,withNetwork,validateLocalLicense} from './network-runtime.service';
import {checkNetworkNasApi,readNetworkOvpn} from './network-ovpn.service';
import {assertNasResourceScope,nasResourceTag} from './nas-resource-scope.service';

const lockName='radius-lord:nas-api-monitor';
const tickMs=10000,intervalMs=5*60000,batchLimit=3;
let running=false;

// Global, sequential budget across backend instances. A page refresh reads stored
// observations; opening more browser tabs must not multiply device polls.
export function startNasApiMonitorWorker(){
 let stopped=false,timer:ReturnType<typeof setTimeout>;
 async function tick(){
  if(stopped||running)return;running=true;
  let central:PoolConnection|undefined,locked=false;
  try{
   central=await db.pool.getConnection();
   const [locks]:any=await central.query('SELECT GET_LOCK(?,0) acquired',[lockName]);locked=Number(locks[0]?.acquired)===1;if(!locked)return;
   const [environments]:any=await central.query(`SELECT t.id tenantId,t.slug,e.id environmentId,p.setting_value schedule,r.setting_value healthRequest
    FROM tenants t JOIN tenant_environments e ON e.id=(SELECT MAX(candidate.id) FROM tenant_environments candidate WHERE candidate.tenant_id=t.id AND candidate.archived_at IS NULL)
    LEFT JOIN platform_settings p ON p.setting_group='nas_api_monitor' AND p.setting_key=CONCAT('environment_',e.id)
    LEFT JOIN platform_settings r ON r.setting_group='master_network_health_requests' AND r.setting_key=CONCAT('environment_',e.id)
    WHERE t.archived_at IS NULL AND t.status='active' AND e.status='ready'
     AND EXISTS(SELECT 1 FROM subscriptions s WHERE s.tenant_id=t.id AND s.status='active' AND s.expires_at>UTC_TIMESTAMP())
     AND (COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.nextAt')),'null'),'')<? OR (COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(r.setting_value,'$.requestedAt')),'null'),'')>COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.handledHealthRequestAt')),'null'),'') AND COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.attemptedAt')),'null'),'')<?))
    ORDER BY COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.attemptedAt')),'null'),''),e.id LIMIT ${batchLimit}`,[new Date().toISOString(),new Date(Date.now()-30000).toISOString()]);
   for(const environment of environments){
    if(stopped)break;
    const attemptedAt=new Date().toISOString();let nasId:number|null=null,code:string|null=null,nextDelay=60000,handledHealthRequestAt:string|null=null;
    try{
     const scope=await networkScope(environment.slug);
     if(Number(scope.tenant_id)!==Number(environment.tenantId)||Number(scope.environment_id)!==Number(environment.environmentId))throw new Error('NAS_SNAPSHOT_SCOPE');
     const previous=typeof environment.schedule==='string'?JSON.parse(environment.schedule):environment.schedule;
     const healthRequest=typeof environment.healthRequest==='string'?JSON.parse(environment.healthRequest):environment.healthRequest;
     const requestedAt=healthRequest?.requestedAt||'';
     handledHealthRequestAt=previous?.handledHealthRequestAt??null;
     const cursor=Number.isSafeInteger(Number(previous?.nasId))?Number(previous.nasId):0;
     await withNetwork(scope,async app=>{
      await validateLocalLicense(app,scope);
      const snapshot=await readNetworkOvpn(app);assertNasResourceScope(snapshot,scope);
      const table=snapshot.connectionMode==='direct'?'nas_direct_connections':'nas_ovpn_connections';
      const cutoff=new Date(Date.now()-intervalMs).toISOString();
      const [candidates]:any=await app.query(`SELECT l.id FROM lord_nas l JOIN ${table} c ON c.nas_id=l.id
       JOIN nas_management_services ms ON ms.lord_nas_id=l.id AND ms.service_type='api' AND ms.is_enabled=1
       WHERE l.archived_at IS NULL AND l.is_enabled=1
        AND JSON_UNQUOTE(JSON_EXTRACT(c.configuration_snapshot,'$.radiusConfigured'))='true'
        AND JSON_EXTRACT(c.configuration_snapshot,'$.environmentId')=?
        AND JSON_EXTRACT(c.configuration_snapshot,'$.tenantId')=?
        AND JSON_EXTRACT(c.configuration_snapshot,'$.subscriptionId')=?
        AND (GREATEST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(c.configuration_snapshot,'$.apiLastCheck.receivedAt')),''),COALESCE(JSON_UNQUOTE(JSON_EXTRACT(c.configuration_snapshot,'$.monitorLastAttemptAt')),''))<=?
        OR (?<>'' AND GREATEST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(c.configuration_snapshot,'$.apiLastCheck.receivedAt')),''),COALESCE(JSON_UNQUOTE(JSON_EXTRACT(c.configuration_snapshot,'$.monitorLastAttemptAt')),''))<LEAST(?,?)))
       ORDER BY (l.id>?) DESC,l.id LIMIT 1`,[scope.environment_id,scope.tenant_id,scope.subscription_id,cutoff,requestedAt,requestedAt,new Date(Date.now()-30000).toISOString(),cursor]);
      if(!candidates[0]){handledHealthRequestAt=requestedAt||null;return;}
      nasId=Number(candidates[0].id);nextDelay=tickMs;
      await app.query(`UPDATE ${table} SET configuration_snapshot=JSON_SET(configuration_snapshot,'$.monitorLastAttemptAt',?) WHERE nas_id=?`,[attemptedAt,nasId]);
      try{await checkNetworkNasApi(central!,app,nasId,scope);}
      catch(error){
       if((error as Error)?.message==='OVPN_GATEWAY_BUSY'){
        nextDelay=30000;
        await app.query(`UPDATE ${table} SET configuration_snapshot=JSON_SET(configuration_snapshot,'$.monitorLastAttemptAt',?) WHERE nas_id=?`,[new Date(Date.now()-intervalMs+30000).toISOString(),nasId]);
       }
       throw error;
      }
     });
    }catch(error){
     const raw=(error as {code?:string})?.code||(error as Error)?.message;
     code=/^[A-Z0-9_]{1,80}$/.test(raw||'')?raw!:'NAS_MONITOR_UNAVAILABLE';
     if(nasId===null){nextDelay=intervalMs;const request=typeof environment.healthRequest==='string'?JSON.parse(environment.healthRequest):environment.healthRequest;handledHealthRequestAt=request?.requestedAt??null;}
     console.warn('[nas-api-monitor]',{environmentId:Number(environment.environmentId),nasId,resourceTag:nasId?nasResourceTag(Number(environment.environmentId),nasId):undefined,code});
    }
    await central.query("INSERT INTO platform_settings(setting_group,setting_key,setting_value,value_type,is_public) VALUES('nas_api_monitor',?,?,'json',0) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",['environment_'+environment.environmentId,JSON.stringify({environmentId:Number(environment.environmentId),tenantId:Number(environment.tenantId),nasId,attemptedAt,observedAt:nasId!==null?new Date().toISOString():(typeof environment.schedule==='string'?JSON.parse(environment.schedule):environment.schedule)?.observedAt??null,handledHealthRequestAt,nextAt:new Date(Date.now()+nextDelay).toISOString(),code})]);
   }
  }catch(error){console.warn('[nas-api-monitor]',{code:(error as {code?:string})?.code||'MONITOR_UNAVAILABLE'});}
  finally{
   if(central){try{if(locked)await central.query('SELECT RELEASE_LOCK(?)',[lockName]);central.release();}catch{central.destroy();}}
   running=false;if(!stopped)timer=setTimeout(()=>void tick(),tickMs);
  }
 }
 timer=setTimeout(()=>void tick(),tickMs);
 return ()=>{stopped=true;clearTimeout(timer);};
}
