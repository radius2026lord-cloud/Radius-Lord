import {currentNasSignal,type NasDiagnostics,type NasDiagnosticSignal,type NasDiagnosticState} from '../shared/nas-diagnostics';

function iso(value:unknown):string|null{const time=value?new Date(value as string|Date).getTime():NaN;return Number.isFinite(time)?new Date(time).toISOString():null;}
export function buildNasDiagnostics(row:any,config:any,snapshot:any,direct:boolean,now=Date.now()):NasDiagnostics{
 const signal=(state:NasDiagnosticState,reason:string,checked:unknown,lastSuccess:unknown,ttl:number):NasDiagnosticSignal=>{
  const checkedAt=iso(checked),lastSuccessAt=iso(lastSuccess);
  return currentNasSignal({state,reason,checkedAt,lastSuccessAt,validUntil:checkedAt?new Date(Date.parse(checkedAt)+ttl).toISOString():null},now);
 };
 const scope=snapshot?{tenantId:Number(snapshot.tenantId),environmentId:Number(snapshot.environmentId),subscriptionId:Number(snapshot.subscriptionId),nasId:Number(row.id),gatewayId:direct?null:Number(snapshot.gatewayId)}:null;
 const enabled=Number(row.is_enabled)===1,apiEnabled=Number(row.api_enabled)===1,api=config.apiLastCheck,link=config.linkLastCheck;
 const linkSignal=direct?signal('not_applicable','direct_connection',null,null,0):!enabled?signal('disabled','nas_disabled',link?.receivedAt,row.last_seen_at,90000):
  link?signal(link.ok===false?'unknown':link.connected?'ok':'failed',link.ok===false?'link_check_unavailable':link.connected?'link_connected':'link_disconnected',link.receivedAt,row.last_seen_at,90000):
  signal(row.activity_status==='recent'&&row.last_seen_at?'ok':'unknown','link_not_checked',row.activity_status==='recent'?row.last_seen_at:null,row.last_seen_at,90000);
 const apiSignal=!enabled||!apiEnabled?signal('disabled','api_disabled',api?.receivedAt,config.apiLastSuccessAt,180000):
  signal(!api?'unknown':api.ok?'ok':'failed',!api?'api_not_checked':api.ok?'api_connected':String(api.code||'api_failed'),api?.receivedAt,config.apiLastSuccessAt||(api?.ok?api.receivedAt:null),180000);
 const sample=config.telemetryLatest,clients=sample?.radiusClients?.clients;
 const own=Array.isArray(clients)?clients.filter((client:any)=>client.address===config.radiusAddress&&Number(client.authenticationPort)===Number(config.authPort)&&Number(client.accountingPort)===Number(config.accountingPort)):[];
 const evidence=config.radiusResponseHealth;
 let radiusSignal:NasDiagnosticSignal;
 if(!enabled)radiusSignal=signal('disabled','nas_disabled',evidence?.receivedAt,config.radiusLastResponseAt,360000);
 else if(String(row.radius_ready)!=='true')radiusSignal=signal('unknown','radius_not_configured',null,config.radiusLastResponseAt,360000);
 else if(!own.length)radiusSignal=signal('unknown','radius_no_observation',sample?.receivedAt,config.radiusLastResponseAt,360000);
 else if(own.every((client:any)=>client.disabled))radiusSignal=signal('warning','radius_clients_disabled',sample?.receivedAt,config.radiusLastResponseAt,180000);
 else if(own.some((client:any)=>!client.disabled&&client.status!=='ok'))radiusSignal=signal('unknown','radius_monitor_unavailable',sample?.receivedAt,config.radiusLastResponseAt,180000);
 else if(evidence)radiusSignal=signal(evidence.state==='responding'?'ok':evidence.state==='timeout'?'warning':'failed',evidence.state==='responding'?'radius_response':evidence.state==='timeout'?'radius_timeout':'radius_bad_reply',evidence.receivedAt,config.radiusLastResponseAt,360000);
 else radiusSignal=signal('unknown','radius_no_recent_response',sample?.receivedAt,config.radiusLastResponseAt,360000);
 const readings=signal(!enabled?'disabled':sample?.receivedAt?'ok':'unknown',!enabled?'nas_disabled':sample?.receivedAt?'reading_available':'reading_missing',sample?.receivedAt,sample?.receivedAt,360000);
 return {generatedAt:new Date(now).toISOString(),scope,link:linkSignal,api:apiSignal,radius:radiusSignal,readings};
}
