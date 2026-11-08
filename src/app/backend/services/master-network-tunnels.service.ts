import {db} from '../config/db';
import type {PoolConnection} from 'mysql2/promise';
import {readGatewayOvpnSessions} from './network-ovpn.service';

type Tunnel={id:number;environmentId:number;gatewayId:number;nasId:number;username:string;address:string;lastSeenAt:Date|null};
type ObservedState='connected'|'disconnected'|'unknown';
type ConnectionEvent={at:string;state:ObservedState;previousState:ObservedState|null;nasId:number;gatewayId:number;tunnelId:number;environmentId:number;durationSeconds:number|null;baseline:boolean};
type SessionObservation={connected:boolean;lastSeenAt:string|null;since?:string};
type GatewaySnapshot={attemptedAt:string;readAt?:string;status:'ok'|'unavailable';sessions?:Record<string,SessionObservation>};
type NasInventory=Array<{id:number;name:string;enabled:boolean}>;
const group='master_ovpn_health';
const eventGroup='master_ovpn_events';
const lockName='lord-master-ovpn-health';
const sessionKey=(username:string,address:string)=>JSON.stringify([username,address]);
function parse(value:unknown):GatewaySnapshot|null{
 try{return typeof value==='string'?JSON.parse(value):value as GatewaySnapshot|null;}catch{return null;}
}
function tunnelTime(value:Date|string|null){
 const parsed=value?new Date(value):null;
 return parsed&&Number.isFinite(parsed.getTime())?parsed.toISOString():null;
}

function makeEvent(tunnel:Tunnel,at:string,state:ObservedState,previousState:ObservedState|null,durationSeconds:number|null,baseline:boolean):ConnectionEvent{
 return {at,state,previousState,durationSeconds,baseline,nasId:Number(tunnel.nasId),gatewayId:Number(tunnel.gatewayId),tunnelId:Number(tunnel.id),environmentId:Number(tunnel.environmentId)};
}

export function startMasterNetworkTunnelsWorker(){
 let stopped=false;
 let timer:ReturnType<typeof setTimeout>;
 async function tick(){
  if(stopped)return;
  let connection:PoolConnection|undefined;
  let acquired=false;
  try{
   connection=await db.pool.getConnection();
   const [locks]:any=await connection.query('SELECT GET_LOCK(?,0) acquired',[lockName]);
   acquired=Number(locks[0]?.acquired)===1;
   if(!acquired)return;
   const [rows]:any=await connection.query(`SELECT g.id,p.setting_value snapshot
    FROM ovpn_gateways g LEFT JOIN platform_settings p ON p.setting_group=? AND p.setting_key=CONCAT('gateway_',g.id)
    WHERE EXISTS(SELECT 1 FROM nas_tunnels t JOIN tenant_environments e ON e.id=t.environment_id
     WHERE t.ovpn_gateway_id=g.id AND t.tenant_nas_id IS NOT NULL AND t.status NOT IN ('reserved','disabled','provisioning') AND e.status='ready' AND e.archived_at IS NULL)
    AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.attemptedAt')),'') < DATE_FORMAT(UTC_TIMESTAMP()-INTERVAL 60 SECOND,'%Y-%m-%dT%H:%i:%s')
    ORDER BY COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.setting_value,'$.attemptedAt')),''),g.id LIMIT 1`,[group]);
   if(!rows[0])return;
   const gatewayId=Number(rows[0].id);
   const previous=parse(rows[0].snapshot);
   const attemptedAt=new Date().toISOString();
   let snapshot:GatewaySnapshot;
   let tracked:Tunnel[]=[];
   const events:ConnectionEvent[]=[];
   try{
    const [tunnels]=await connection.query(`SELECT t.id,t.environment_id environmentId,t.tenant_nas_id nasId,t.ovpn_gateway_id gatewayId,t.tunnel_username username,t.tunnel_address address
     FROM nas_tunnels t JOIN tenant_environments e ON e.id=t.environment_id
     WHERE t.ovpn_gateway_id=? AND t.tenant_nas_id IS NOT NULL AND t.status NOT IN ('reserved','disabled','provisioning')
       AND e.status='ready' AND e.archived_at IS NULL`,[gatewayId]);
    tracked=tunnels as Tunnel[];
    const active=await readGatewayOvpnSessions(connection,gatewayId);
    const activeKeys=new Set(active.filter(row=>row.service==='ovpn').map(row=>sessionKey(row.name,row.address)));
    const readAt=new Date().toISOString();
    const sessions:NonNullable<GatewaySnapshot['sessions']>={};
    for(const tunnel of tracked){
     const key=sessionKey(tunnel.username,tunnel.address),connected=activeKeys.has(key);
     const old=previous?.sessions?.[key];
     const previousTime=Date.parse(previous?.readAt??'');
     const uninterrupted=previous?.status==='ok'&&Number.isFinite(previousTime)&&Date.parse(readAt)-previousTime<=180000;
     if(old&&previous?.status==='ok'&&Number.isFinite(previousTime)&&!uninterrupted){
      events.push(makeEvent(tunnel,new Date(previousTime+180000).toISOString(),'unknown',old.connected?'connected':'disconnected',null,false));
     }
     const changed=!old?.since||!uninterrupted||old.connected!==connected;
     const since=changed?readAt:old?.since??previous?.readAt??readAt;
     sessions[key]={connected,since,lastSeenAt:connected?readAt:old?.lastSeenAt??null};
     if(changed){
      const duration=old&&uninterrupted&&old.since?Math.max(0,Math.round((Date.parse(readAt)-Date.parse(old.since))/1000)):null;
      events.push(makeEvent(tunnel,readAt,connected?'connected':'disconnected',old?.since&&uninterrupted?(old.connected?'connected':'disconnected'):'unknown',duration,!old?.since||!uninterrupted));
     }
    }
    snapshot={status:'ok',attemptedAt,readAt,sessions};
   }catch(error){
    snapshot={...previous,attemptedAt,status:'unavailable'};
    if(previous?.status==='ok'){
     for(const tunnel of tracked){
      const old=previous.sessions?.[sessionKey(tunnel.username,tunnel.address)];
      if(old)events.push(makeEvent(tunnel,attemptedAt,'unknown',old.connected?'connected':'disconnected',null,false));
     }
    }
    console.error('[master-network-ovpn]',{gatewayId,code:(error as {code?:string})?.code||'UNAVAILABLE'});
   }
   await connection.beginTransaction();
   try{
    for(const event of events){
     const key='environment_'+event.environmentId+'_'+Date.parse(event.at)+'_'+event.tunnelId+'_'+event.state;
     await connection.query(`INSERT INTO platform_settings(setting_group,setting_key,setting_value,value_type,is_public)
      VALUES (?,?,?,'json',0) ON DUPLICATE KEY UPDATE setting_value=setting_value`,[eventGroup,key,JSON.stringify(event)]);
    }
    await connection.query(`INSERT INTO platform_settings(setting_group,setting_key,setting_value,value_type,is_public)
     VALUES (?,?,?,'json',0) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`,[group,'gateway_'+gatewayId,JSON.stringify(snapshot)]);
    await connection.commit();
   }catch(error){await connection.rollback().catch(()=>{});throw error;}
  }catch(error){console.error('[master-network-ovpn]',{code:(error as {code?:string})?.code||'UNAVAILABLE'});}
  finally{
   if(connection){
    try{if(acquired)await connection.query('SELECT RELEASE_LOCK(?)',[lockName]);connection.release();}
    catch{connection.destroy();}
   }
   if(!stopped)timer=setTimeout(()=>void tick(),5000);
  }
 }
 timer=setTimeout(()=>void tick(),5000);
 return ()=>{stopped=true;clearTimeout(timer);};
}

export async function readMasterNetworkTunnels(environmentIds:number[],includeHistory=false){
 const byEnvironment=new Map<number,Tunnel[]>();
 const history:ConnectionEvent[]=[];
 const gateways=new Map<number,{name:string;snapshot:GatewaySnapshot|null}>();
 if(!environmentIds.length)return {byEnvironment,gateways,history};
 const [tunnels]=await db.query(`SELECT id,environment_id environmentId,ovpn_gateway_id gatewayId,tenant_nas_id nasId,
  tunnel_username username,tunnel_address address,last_seen_at lastSeenAt
  FROM nas_tunnels WHERE environment_id IN (?) AND tenant_nas_id IS NOT NULL AND status NOT IN ('reserved','disabled','provisioning') ORDER BY id`,[environmentIds]);
 const gatewayIds=new Set<number>();
 for(const tunnel of tunnels as Tunnel[]){
  const id=Number(tunnel.environmentId);
  const list=byEnvironment.get(id)??[];
  list.push(tunnel);
  byEnvironment.set(id,list);
  gatewayIds.add(Number(tunnel.gatewayId));
 }
 if(gatewayIds.size){
  const [rows]:any=await db.query(`SELECT g.id,JSON_UNQUOTE(JSON_EXTRACT(g.settings_json,'$.name')) name,p.setting_value snapshot
   FROM ovpn_gateways g LEFT JOIN platform_settings p ON p.setting_group=? AND p.setting_key=CONCAT('gateway_',g.id)
   WHERE g.id IN (?)`,[group,[...gatewayIds]]);
  for(const row of rows)gateways.set(Number(row.id),{name:row.name||'CHR #'+row.id,snapshot:parse(row.snapshot)});
 }
 if(includeHistory&&environmentIds.length===1){
  const [events]:any=await db.query(`SELECT setting_value FROM platform_settings WHERE setting_group=? AND setting_key LIKE ? ESCAPE '!' ORDER BY setting_key DESC LIMIT 200`,[eventGroup,'environment!_'+environmentIds[0]+'!_%']);
  for(const row of events){
   try{
    const event=typeof row.setting_value==='string'?JSON.parse(row.setting_value):row.setting_value;
    if(Number(event?.environmentId)===environmentIds[0]&&['connected','disconnected','unknown'].includes(event.state)&&Number.isFinite(Date.parse(event.at)))history.push(event);
   }catch{}
  }
 }
 return {byEnvironment,gateways,history};
}

export function describeMasterNetworkTunnels(inventory:Awaited<ReturnType<typeof readMasterNetworkTunnels>>,environmentId:number,nasInventory:NasInventory|undefined,details:boolean){
 const now=Date.now();
 const nasById=Array.isArray(nasInventory)?new Map(nasInventory.map(nas=>[nas.id,nas])):null;
 const tunnels=(inventory.byEnvironment.get(environmentId)??[]).flatMap(tunnel=>{
  const nasId=Number(tunnel.nasId);
  const nas=nasById?.get(nasId);
  if(nasById&&!nas?.enabled)return [];
  const gatewayId=Number(tunnel.gatewayId);
  const gateway=inventory.gateways.get(gatewayId),snapshot=gateway?.snapshot;
  const observed=snapshot?.sessions?.[sessionKey(tunnel.username,tunnel.address)];
  const fresh=Boolean(snapshot?.readAt&&now-Date.parse(snapshot.readAt)<=3*60*1000);
  const state=snapshot?.status==='unavailable'?'unavailable':snapshot?.readAt&&!fresh?'stale':!observed?'pending':observed.connected?'connected':'disconnected';
  return [{tunnelId:Number(tunnel.id),nasId,name:nas?.name||'NAS #'+nasId,gatewayId,gateway:gateway?.name||'CHR #'+gatewayId,
   state,since:observed?.since??null,readAt:snapshot?.readAt??null,lastSeenAt:observed?.lastSeenAt??tunnelTime(tunnel.lastSeenAt)}];
 });
 const total=tunnels.length,connected=tunnels.filter(tunnel=>tunnel.state==='connected').length;
 const disconnected=tunnels.filter(tunnel=>tunnel.state==='disconnected').length;
 const state=!total?'unlinked':tunnels.some(tunnel=>tunnel.state==='unavailable')?'unavailable':
  tunnels.some(tunnel=>tunnel.state==='stale')?'stale':connected+disconnected<total?'pending':
  connected===total?'connected':connected?'partial':'disconnected';
 const readAt=tunnels.length&&tunnels.every(tunnel=>tunnel.readAt)?tunnels.map(tunnel=>tunnel.readAt!).sort()[0]:null;
 const history=inventory.history.filter(event=>tunnels.some(tunnel=>tunnel.tunnelId===event.tunnelId)).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
 return {state,total,connected,disconnected,readAt,...(details?{tunnels,history}:{})};
}
