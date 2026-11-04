import {db} from '../config/db';
import {networkScope,withNetwork} from './network-runtime.service';
import {savePrivateSetting} from './radius-provision.service';

let running=false;
export function startMasterNetworkMetricsWorker(){
 let stopped=false;
 let timer:ReturnType<typeof setTimeout>;
 async function tick(){
  if(running||stopped)return;
  running=true;
  let lock:any;
  try{
   lock=await db.pool.getConnection();
   const [locks]:any=await lock.query("SELECT GET_LOCK('lord-master-network-metrics',0) acquired");
   if(!Number(locks[0]?.acquired))return;
   const [rows]:any=await lock.query(`SELECT t.id,t.slug,e.id environmentId
    FROM tenants t JOIN tenant_environments e ON e.tenant_id=t.id
    LEFT JOIN platform_settings p ON p.setting_group='master_network_metrics' AND p.setting_key=CONCAT('tenant_',t.id)
    WHERE t.archived_at IS NULL AND e.archived_at IS NULL AND e.status='ready'
    AND (p.setting_value IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.attemptedAt')) < DATE_FORMAT(UTC_TIMESTAMP()-INTERVAL 5 MINUTE,'%Y-%m-%dT%H:%i:%s'))
    ORDER BY COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.attemptedAt')),''),t.id LIMIT 1`);
   const tenant=rows[0];
   if(!tenant)return;
   const key='tenant_'+tenant.id,attemptedAt=new Date().toISOString();
   try{
    const scope=await networkScope(tenant.slug,true);
    if(Number(scope.environment_id)!==Number(tenant.environmentId))throw Error('ENVIRONMENT_CHANGED');
    const metrics=await withNetwork(scope,async app=>{
     const [customers]:any=await app.query({sql:`SELECT COUNT(DISTINCT c.id) totalSubscribers,
      COUNT(DISTINCT CASE WHEN live.username IS NOT NULL THEN c.id END) connectedSubscribers,
      COUNT(DISTINCT CASE WHEN c.created_at>=UTC_TIMESTAMP()-INTERVAL 24 HOUR THEN c.id END) newSubscribers24h,
      COALESCE(SUM(live.sessions),0) activeSessions
      FROM customers c JOIN pppoe_accounts a ON a.customer_id=c.id AND a.archived_at IS NULL
      JOIN radius_identities r ON r.id=a.radius_identity_id
      LEFT JOIN (SELECT username,COUNT(*) sessions FROM radacct WHERE acctstoptime IS NULL
       AND COALESCE(acctupdatetime,acctstarttime)>=UTC_TIMESTAMP()-INTERVAL 6 MINUTE GROUP BY username) live ON live.username=r.current_username
      WHERE c.archived_at IS NULL`,timeout:5000});
     const [nas]:any=await app.query({sql:`SELECT COUNT(*) totalNas,COALESCE(SUM(is_enabled=1 AND activity_status='recent' AND last_seen_at>=UTC_TIMESTAMP()-INTERVAL 90 SECOND),0) connectedNas FROM lord_nas WHERE archived_at IS NULL`,timeout:5000});
     const values={...customers[0],...nas[0]};
     for(const key of Object.keys(values))values[key]=Number(values[key]||0);
     return {...values,disconnectedSubscribers:values.totalSubscribers-values.connectedSubscribers};
    });
    await savePrivateSetting('master_network_metrics',key,{environmentId:Number(tenant.environmentId),attemptedAt,readAt:new Date().toISOString(),status:'ok',scope:'pppoe',metrics});
   }catch(error){
    const [previous]:any=await lock.query("SELECT setting_value FROM platform_settings WHERE setting_group='master_network_metrics' AND setting_key=?",[key]);
    let saved:any={};
    try{saved=typeof previous[0]?.setting_value==='string'?JSON.parse(previous[0].setting_value):previous[0]?.setting_value||{};}catch{}
    await savePrivateSetting('master_network_metrics',key,{...saved,attemptedAt,status:'unavailable'});
    console.error('[master-network-metrics]',{tenantId:tenant.id,code:(error as any)?.code||'UNAVAILABLE'});
   }
  }catch(error){console.error('[master-network-metrics]',{code:(error as any)?.code||'UNAVAILABLE'});}
  finally{
   if(lock){try{await lock.query("SELECT RELEASE_LOCK('lord-master-network-metrics')");}finally{lock.release();}}
   running=false;
   if(!stopped)timer=setTimeout(()=>void tick(),10000);
  }
 }
 timer=setTimeout(()=>void tick(),10000);
 return ()=>{stopped=true;clearTimeout(timer);};
}
