function zonedParts(value:Date,timeZone:string){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(value);
 return Object.fromEntries(parts.filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)])) as Record<string,number>;
}
function localMidnightUtc(year:number,month:number,day:number,timeZone:string){
 const target={year,month,day,hour:0,minute:0,second:0};let guess=Date.UTC(year,month-1,day);
 for(let attempt=0;attempt<5;attempt++){const current=zonedParts(new Date(guess),timeZone),delta=Date.UTC(target.year,target.month-1,target.day)-Date.UTC(current.year,current.month-1,current.day,current.hour,current.minute,current.second);if(!delta)break;guess+=delta;}
 return new Date(guess);
}
function sqlDate(value:Date){return value.toISOString().slice(0,23).replace('T',' ');}

export async function readNetworkDashboardOverview(app:any){
 const [settings]:any=await app.query('SELECT timezone FROM network_settings WHERE id=1');
 const timeZone=String(settings[0]?.timezone||'Asia/Damascus');
 const today=zonedParts(new Date(),timeZone),start=localMidnightUtc(today.year,today.month,today.day,timeZone),nextDate=new Date(Date.UTC(today.year,today.month-1,today.day+1)),end=localMidnightUtc(nextDate.getUTCFullYear(),nextDate.getUTCMonth()+1,nextDate.getUTCDate(),timeZone);
 const [rows]:any=await app.query(`
  SELECT COUNT(*) totalLines,
   COALESCE(SUM(live.username IS NOT NULL),0) connected,
   COALESCE(SUM(a.admin_status='enabled' AND live.username IS NULL AND (sub.lifecycle='active' AND COALESCE(sub.grace_expires_at,sub.expires_at)>UTC_TIMESTAMP(6) OR sub.lifecycle='pending')),0) activeDisconnected,
   COALESCE(SUM(a.admin_status='enabled' AND (sub.lifecycle='ended' OR sub.lifecycle IN('active','pending') AND COALESCE(sub.grace_expires_at,sub.expires_at)<=UTC_TIMESTAMP(6))),0) expired,
   COALESCE(SUM(a.admin_status='disabled'),0) suspended
  FROM pppoe_accounts a
  JOIN radius_identities r ON r.id=a.radius_identity_id
  LEFT JOIN pppoe_subscriptions sub ON sub.id=(SELECT s.id FROM pppoe_subscriptions s WHERE s.account_id=a.id AND s.service_role='base' ORDER BY s.id DESC LIMIT 1)
  LEFT JOIN (SELECT username FROM radacct WHERE acctstoptime IS NULL AND COALESCE(acctupdatetime,acctstarttime)>=UTC_TIMESTAMP(6)-INTERVAL 6 MINUTE GROUP BY username) live ON live.username=r.current_username
  WHERE a.archived_at IS NULL`);
 const [newRows]:any=await app.query("SELECT COUNT(*) newCustomersToday FROM customers c WHERE c.archived_at IS NULL AND c.created_at>=? AND c.created_at<? AND EXISTS(SELECT 1 FROM pppoe_accounts p WHERE p.customer_id=c.id AND p.archived_at IS NULL)",[sqlDate(start),sqlDate(end)]);
 const [expiringSoon]:any=await app.query(`SELECT c.id customerId,CONCAT_WS(' ',c.first_name,c.last_name) customerName,p.id lineId,COALESCE(NULLIF(p.line_name,''),r.current_username) lineName,r.current_username username,sp.expires_at effectiveExpiry,TIMESTAMPDIFF(DAY,UTC_TIMESTAMP(),sp.expires_at) daysRemaining
  FROM pppoe_accounts p JOIN customers c ON c.id=p.customer_id JOIN radius_identities r ON r.id=p.radius_identity_id JOIN pppoe_subscriptions sp ON sp.id=(SELECT s.id FROM pppoe_subscriptions s WHERE s.account_id=p.id AND s.service_role='base' ORDER BY s.id DESC LIMIT 1)
  WHERE p.archived_at IS NULL AND c.archived_at IS NULL AND p.admin_status='enabled' AND sp.lifecycle IN('active','pending') AND sp.expires_at>UTC_TIMESTAMP() AND sp.expires_at<=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 DAY)
  ORDER BY effectiveExpiry,p.id LIMIT 100`);
 const [quotaNear]:any=await app.query(`SELECT c.id customerId,CONCAT_WS(' ',c.first_name,c.last_name) customerName,p.id lineId,COALESCE(NULLIF(p.line_name,''),r.current_username) lineName,r.current_username username,sp.quota_allowance_bytes quotaBytes,COALESCE(su.upload_bytes,0)+COALESCE(su.download_bytes,0) usedBytes,ROUND(100*(COALESCE(su.upload_bytes,0)+COALESCE(su.download_bytes,0))/NULLIF(sp.quota_allowance_bytes,0),1) usedPercent
  FROM pppoe_accounts p JOIN customers c ON c.id=p.customer_id JOIN radius_identities r ON r.id=p.radius_identity_id JOIN pppoe_subscriptions sp ON sp.id=(SELECT s.id FROM pppoe_subscriptions s WHERE s.account_id=p.id AND s.service_role='base' ORDER BY s.id DESC LIMIT 1)
  LEFT JOIN pppoe_subscription_usage su ON su.subscription_id=sp.id
  WHERE p.archived_at IS NULL AND c.archived_at IS NULL AND p.admin_status='enabled' AND sp.lifecycle IN('active','pending') AND sp.quota_allowance_bytes>0 AND COALESCE(su.upload_bytes,0)+COALESCE(su.download_bytes,0)>=sp.quota_allowance_bytes*0.5
  ORDER BY usedPercent DESC,p.id LIMIT 100`);
 const [activity]:any=await app.query(`
  SELECT al.id,COALESCE(al.customer_id,a.customer_id,IF(al.target_type='customer',al.target_id,NULL)) customerId,al.action_code actionCode,al.target_type targetType,al.result,al.occurred_at occurredAt,
   COALESCE(JSON_UNQUOTE(JSON_EXTRACT(al.actor_snapshot,'$.full_name')),IF(al.actor_kind='system','النظام','مستخدم سابق')) actorName,
   CONCAT_WS(' ',c.first_name,c.last_name) customerName,COALESCE(a.line_name,r.current_username) lineName,r.current_username username
  FROM activity_log al
  LEFT JOIN pppoe_accounts a ON a.radius_identity_id=al.account_id OR (al.target_type='pppoe_account' AND a.id=al.target_id)
  LEFT JOIN radius_identities r ON r.id=COALESCE(al.account_id,a.radius_identity_id)
  LEFT JOIN customers c ON c.id=COALESCE(al.customer_id,a.customer_id,IF(al.target_type='customer',al.target_id,NULL))
  WHERE al.customer_id IS NOT NULL OR al.target_type IN('customer','pppoe_account') OR al.action_code LIKE 'pppoe.line.%'
  ORDER BY al.id DESC LIMIT 8`);
 const [nasSummary]:any=await app.query("SELECT COUNT(*) enabledNas,COALESCE(SUM(activity_status<>'recent' OR last_seen_at IS NULL OR last_seen_at<UTC_TIMESTAMP(6)-INTERVAL 90 SECOND),0) nasIssueCount FROM lord_nas WHERE archived_at IS NULL AND is_enabled=1");
 const [nasRows]:any=await app.query("SELECT id,name,activity_status,last_seen_at FROM lord_nas WHERE archived_at IS NULL AND is_enabled=1 AND (activity_status<>'recent' OR last_seen_at IS NULL OR last_seen_at<UTC_TIMESTAMP(6)-INTERVAL 90 SECOND) ORDER BY CASE activity_status WHEN 'stale' THEN 0 ELSE 1 END,id LIMIT 5");
 const [nasTelemetryRows]:any=await app.query("SELECT l.id,l.name,l.vendor,l.model,l.routeros_version,l.activity_status,l.last_seen_at,c.tunnel_address,c.configuration_snapshot,ms.port api_port,ms.is_enabled api_enabled,(SELECT COUNT(DISTINCT ra.username) FROM radacct ra WHERE ra.nasipaddress=c.tunnel_address AND ra.acctstoptime IS NULL AND COALESCE(ra.acctupdatetime,ra.acctstarttime)>=UTC_TIMESTAMP(6)-INTERVAL 6 MINUTE) connected_accounts FROM lord_nas l LEFT JOIN nas_ovpn_connections c ON c.nas_id=l.id LEFT JOIN nas_management_services ms ON ms.lord_nas_id=l.id AND ms.service_type='api' WHERE l.archived_at IS NULL AND l.is_enabled=1 ORDER BY l.id");
 const nasOverview=nasTelemetryRows.map((row:any)=>{let config:any={};try{config=typeof row.configuration_snapshot==='string'?JSON.parse(row.configuration_snapshot):row.configuration_snapshot||{};}catch{}const latest=config.telemetryLatest&&typeof config.telemetryLatest==='object'?config.telemetryLatest:null,metrics=Array.isArray(config.telemetrySamples)?config.telemetrySamples.slice(-12):[],lastSeenAt=row.last_seen_at?new Date(row.last_seen_at).toISOString():null;return {id:Number(row.id),name:row.name,vendor:row.vendor,model:row.model??null,routerosVersion:row.routeros_version??latest?.version??null,boardName:latest?.board??row.model??null,uptime:latest?.uptime??null,address:row.tunnel_address??null,apiPort:row.api_port?Number(row.api_port):null,apiEnabled:Number(row.api_enabled)===1,status:row.activity_status==='recent'&&row.last_seen_at&&Date.now()-new Date(row.last_seen_at).getTime()<90000?'connected':row.activity_status==='stale'?'disconnected':'awaiting_link',lastSeenAt,connectedAccounts:Number(row.connected_accounts||0),metrics,metricsUpdatedAt:latest?.receivedAt??null,apiLastCheck:config.apiLastCheck??null};});
 const summary={...rows[0],...nasSummary[0],newCustomersToday:Number(newRows[0]?.newCustomersToday||0),timezone:timeZone};
 for(const key of ['totalLines','connected','activeDisconnected','expired','suspended','newCustomersToday','enabledNas','nasIssueCount'])summary[key]=Number(summary[key]||0);
 return {summary,activity,nasAlerts:nasRows.map((row:any)=>({id:Number(row.id),name:row.name,status:row.activity_status,lastSeenAt:row.last_seen_at})),nasOverview,followUpAlerts:{expiring:expiringSoon.map((row:any)=>({...row,customerId:Number(row.customerId),lineId:Number(row.lineId),daysRemaining:Number(row.daysRemaining)})),quota:quotaNear.map((row:any)=>({...row,customerId:Number(row.customerId),lineId:Number(row.lineId),quotaBytes:String(row.quotaBytes),usedBytes:String(row.usedBytes),usedPercent:Number(row.usedPercent)}))}};
}
