import {db} from '../config/db';
import {networkScope,withNetwork} from './network-runtime.service';
import type {PoolConnection} from 'mysql2/promise';

let running=false;
export function startMasterNetworkMetricsWorker(){
 let stopped=false;
 let timer:ReturnType<typeof setTimeout>;
 async function tick(){
  if(running||stopped)return;
  running=true;
  let lock:PoolConnection|undefined;
  let acquired=false;
  try{
   lock=await db.pool.getConnection();
   const [locks]:any=await lock.query("SELECT GET_LOCK('lord-master-network-metrics',0) acquired");
   acquired=Boolean(Number(locks[0]?.acquired));
   if(!acquired)return;
   const saveSnapshot=(key:string,value:unknown)=>lock!.query(
    "INSERT INTO platform_settings (setting_group,setting_key,setting_value,value_type,is_public) VALUES ('master_network_metrics',?,?,'json',0) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
    [key,JSON.stringify(value)]
   );
   const [rows]:any=await lock.query(`SELECT t.id,t.slug,e.id environmentId
    FROM tenants t JOIN tenant_environments e ON e.id=(SELECT MAX(candidate.id) FROM tenant_environments candidate WHERE candidate.tenant_id=t.id AND candidate.archived_at IS NULL AND candidate.ready_at IS NOT NULL)
    LEFT JOIN platform_settings p ON p.setting_group='master_network_metrics' AND p.setting_key=CONCAT('tenant_',t.id)
    WHERE t.archived_at IS NULL AND t.status='active' AND e.status='ready'
    AND (p.setting_value IS NULL OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.environmentId')),'')<>CAST(e.id AS CHAR) OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.attemptedAt')),'') < DATE_FORMAT(UTC_TIMESTAMP()-INTERVAL 5 MINUTE,'%Y-%m-%dT%H:%i:%s'))
    ORDER BY COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.attemptedAt')),''),t.id LIMIT 1`);
   const tenant=rows[0];
   if(!tenant)return;
   const key='tenant_'+tenant.id,attemptedAt=new Date().toISOString();
   try{
    const scope=await networkScope(tenant.slug,false,true);
    if(Number(scope.environment_id)!==Number(tenant.environmentId))throw Error('ENVIRONMENT_CHANGED');
    const {metrics,nasInventory}=await withNetwork(scope,async app=>{
     const [customers]:any=await app.query({sql:`SELECT COUNT(DISTINCT c.id) totalSubscribers,COUNT(DISTINCT a.id) totalPppoeAccounts,
      COUNT(DISTINCT CASE WHEN live.username IS NOT NULL THEN a.id END) connectedPppoeAccounts,
      COUNT(DISTINCT CASE WHEN live.username IS NOT NULL THEN c.id END) connectedSubscribers,
      COUNT(DISTINCT CASE WHEN c.created_at>=UTC_TIMESTAMP()-INTERVAL 24 HOUR THEN c.id END) newSubscribers24h,
      COALESCE(SUM(live.sessions),0) activeSessions
      FROM pppoe_accounts a
      LEFT JOIN customers c ON c.id=a.customer_id AND c.archived_at IS NULL
      LEFT JOIN radius_identities r ON r.id=a.radius_identity_id
      LEFT JOIN (SELECT username,COUNT(*) sessions FROM radacct WHERE acctstoptime IS NULL
       AND COALESCE(acctupdatetime,acctstarttime)>=UTC_TIMESTAMP()-INTERVAL 6 MINUTE GROUP BY username) live ON live.username=r.current_username
      WHERE a.archived_at IS NULL`,timeout:5000});
     const [hotspot]:any=await app.query({sql:`SELECT COUNT(*) totalHotspotAccounts,
      COALESCE(SUM(live.username IS NOT NULL),0) connectedHotspotAccounts,
      COALESCE(SUM(live.sessions),0) hotspotSessions
      FROM hotspot_accounts h JOIN radius_identities r ON r.id=h.radius_identity_id
      LEFT JOIN (SELECT username,COUNT(*) sessions FROM radacct WHERE acctstoptime IS NULL
       AND COALESCE(acctupdatetime,acctstarttime)>=UTC_TIMESTAMP()-INTERVAL 6 MINUTE GROUP BY username) live ON live.username=r.current_username
      WHERE h.archived_at IS NULL`,timeout:5000});
     const [nas]:any=await app.query({sql:`SELECT id,name,is_enabled,
      (is_enabled=1 AND activity_status='recent' AND last_seen_at>=UTC_TIMESTAMP()-INTERVAL 90 SECOND) connected
      FROM lord_nas WHERE archived_at IS NULL`,timeout:5000});
     const values={...customers[0],...hotspot[0],totalNas:nas.length,connectedNas:nas.filter((row:any)=>Number(row.connected)===1).length};
     for(const key of Object.keys(values))values[key]=Number(values[key]||0);
     return {metrics:{...values,disconnectedSubscribers:values.totalSubscribers-values.connectedSubscribers},
      nasInventory:nas.map((row:any)=>({id:Number(row.id),name:String(row.name),enabled:Number(row.is_enabled)===1}))};
    });
    await saveSnapshot(key,{environmentId:Number(tenant.environmentId),attemptedAt,readAt:new Date().toISOString(),status:'ok',scope:'pppoe-hotspot',metrics,nasInventory});
   }catch(error){
    const [previous]:any=await lock.query("SELECT setting_value FROM platform_settings WHERE setting_group='master_network_metrics' AND setting_key=?",[key]);
    let saved:any={};
    try{saved=typeof previous[0]?.setting_value==='string'?JSON.parse(previous[0].setting_value):previous[0]?.setting_value||{};}catch{}
    const environmentId=Number(tenant.environmentId);
    const previousSnapshot=Number(saved?.environmentId)===environmentId?saved:{};
    await saveSnapshot(key,{...previousSnapshot,environmentId,attemptedAt,status:'unavailable'});
    console.error('[master-network-metrics]',{tenantId:tenant.id,code:(error as any)?.code||'UNAVAILABLE'});
   }
  }catch(error){console.error('[master-network-metrics]',{code:(error as any)?.code||'UNAVAILABLE'});}
  finally{
   if(lock){
    try{if(acquired)await lock.query("SELECT RELEASE_LOCK('lord-master-network-metrics')");lock.release();}
    catch{lock.destroy();console.error('[master-network-metrics]',{code:'LOCK_RELEASE_UNAVAILABLE'});}
   }
   running=false;
   if(!stopped)timer=setTimeout(()=>void tick(),10000);
  }
 }
 timer=setTimeout(()=>void tick(),10000);
 return ()=>{stopped=true;clearTimeout(timer);};
}
