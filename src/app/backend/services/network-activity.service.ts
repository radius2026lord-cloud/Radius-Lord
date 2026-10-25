// Activity records are scoped to the tenant and to the manager's authorized customer set.
function json(value:any){if(typeof value==='string'){try{return JSON.parse(value);}catch{return null;}}return value;}
function sanitize(value:any):any{
 if(Array.isArray(value))return value.map(sanitize);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/(password|token|secret|private.?key|credentials|activation|api.?key|payment.?code|national.?number|identity.?number)/i.test(key)).map(([key,item])=>[key,sanitize(item)]));
 return value;
}
function validDate(value:string){if(!value)return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;}
const ACCOUNT_CUSTOMERS="(SELECT p.radius_identity_id AS identity_id,p.customer_id FROM pppoe_accounts p UNION ALL SELECT h.radius_identity_id AS identity_id,sc.customer_id FROM hotspot_standalone_cards sc JOIN hotspot_accounts h ON h.id=sc.account_id)";
function subscriberScope(access:any,alias='c'){
 if(access.role==='principal')return {sql:'',params:[] as any[]};
 if(access.role==='agent')return {sql:` AND (${alias}.manager_id=? OR ${alias}.manager_id IN (SELECT id FROM managers WHERE parent_agent_manager_id=? AND scope_id=?))`,params:[access.manager.id,access.manager.id,access.manager.scope_id]};
 if(access.role==='agent_employee'){const ownerId=Number(access.manager.parent_agent_manager_id);return {sql:` AND (${alias}.manager_id=? OR ${alias}.manager_id IN (SELECT id FROM managers WHERE parent_agent_manager_id=? AND scope_id=?))`,params:[ownerId,ownerId,access.manager.scope_id]};}
 return {sql:` AND ${alias}.manager_id=?`,params:[access.manager.id]};
}
async function readSubscriberActivity(app:any,access:any,input:any,base:any){
 const {cursor,q,result,operation,target,actorId,actorKind,fromDate,toDate,customerId,sourceType,operations}=base;
 const scope=subscriberScope(access,'c');
 const optionsSql=`SELECT c.id,c.first_name,c.last_name FROM customers c WHERE c.archived_at IS NULL${scope.sql} ORDER BY c.id DESC LIMIT 500`;
 const [subscriberOptions]:any=await app.query(optionsSql,scope.params);
 const clauses:string[]=['1=1'],params:any[]=[];
 if(customerId) {clauses.push('e.customer_id=?');params.push(customerId);}
 if(sourceType){clauses.push('e.source_type=?');params.push(sourceType);}
 if(operation)clauses.push(operations[operation]);
 if(target){clauses.push('e.target_type=?');params.push(target);}
 if(actorId){clauses.push('e.actor_manager_id=?');params.push(actorId);}
 if(actorKind){clauses.push('e.actor_kind=?');params.push(actorKind);}
 if(fromDate){clauses.push('e.occurred_at>=?');params.push(fromDate+' 00:00:00');}
 if(toDate){clauses.push('e.occurred_at<DATE_ADD(?,INTERVAL 1 DAY)');params.push(toDate+' 00:00:00');}
 if(q){clauses.push("(LOCATE(?,e.action_code)>0 OR LOCATE(?,CONCAT_WS(' ',e.customer_first_name,e.customer_last_name))>0 OR LOCATE(?,COALESCE(e.username,''))>0 OR LOCATE(?,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.actor_snapshot,'$.full_name')),''))>0)");params.push(q,q,q,q);}
 const union=`
  SELECT a.id,'audit' source_type,COALESCE(a.customer_id,ac.customer_id,IF(a.target_type='customer',a.target_id,NULL)) customer_id,
   c.first_name customer_first_name,c.last_name customer_last_name,
   COALESCE(JSON_UNQUOTE(JSON_EXTRACT(a.after_data,'$.username')),JSON_UNQUOTE(JSON_EXTRACT(a.before_data,'$.username')),CONVERT(ri.current_username USING utf8mb4) COLLATE utf8mb4_bin) username,
   a.account_id,a.actor_manager_id,a.actor_snapshot,a.actor_kind,a.action_code,a.target_type,a.target_id,a.before_data,a.after_data,a.result,a.failure_code,a.request_id,a.operation_id,a.occurred_at
  FROM activity_log a
  LEFT JOIN ${ACCOUNT_CUSTOMERS} ac ON ac.identity_id=a.account_id
  LEFT JOIN radius_identities ri ON ri.id=a.account_id
  LEFT JOIN customers c ON c.id=COALESCE(a.customer_id,ac.customer_id,IF(a.target_type='customer',a.target_id,NULL))
  WHERE (a.customer_id IS NOT NULL OR a.account_id IS NOT NULL OR a.action_code REGEXP '^(customers|subscribers)[.]|^(pppoe[.]line|hotspot[.](account|line))[.]')
  UNION ALL
  SELECT ra.radacctid,'session' source_type,ac.customer_id,c.first_name,c.last_name,ra.username,ri.id,NULL,JSON_OBJECT('full_name','النظام'),'system',
   IF(ra.acctstoptime IS NULL,'subscriber.session.connected','subscriber.session.disconnected'),'session',ra.radacctid,NULL,
   JSON_OBJECT('username',ra.username,'sessionId',ra.acctsessionid,'nasIp',ra.nasipaddress,'startedAt',ra.acctstarttime,'lastUpdate',ra.acctupdatetime,'stoppedAt',ra.acctstoptime,'sessionSeconds',ra.acctsessiontime,'uploadBytes',ra.acctinputoctets,'downloadBytes',ra.acctoutputoctets,'framedIp',ra.framedipaddress,'callingStationId',ra.callingstationid,'terminateCause',ra.acctterminatecause),
   'success',NULL,NULL,NULL,COALESCE(ra.acctstoptime,ra.acctupdatetime,ra.acctstarttime)
  FROM radacct ra JOIN radius_identities ri ON ri.current_username=ra.username
  JOIN ${ACCOUNT_CUSTOMERS} ac ON ac.identity_id=ri.id JOIN customers c ON c.id=ac.customer_id
  WHERE 1=1
  UNION ALL
  SELECT pa.id,'auth' source_type,ac.customer_id,c.first_name,c.last_name,pa.username,ri.id,NULL,JSON_OBJECT('full_name','النظام'),'system',
   IF(pa.reply='Access-Accept','subscriber.auth.accept','subscriber.auth.reject'),'authentication',pa.id,NULL,
   JSON_OBJECT('username',pa.username,'reply',pa.reply),
   IF(pa.reply='Access-Accept','success','failed'),IF(pa.reply='Access-Accept',NULL,'AUTH_REJECTED'),NULL,NULL,pa.authdate
  FROM radpostauth pa JOIN radius_identities ri ON ri.current_username=pa.username
  JOIN ${ACCOUNT_CUSTOMERS} ac ON ac.identity_id=ri.id JOIN customers c ON c.id=ac.customer_id
  WHERE 1=1
 `;
 const scopeForEvents=access.role==='principal'?'':access.role==='agent'
  ?' AND (c.manager_id=? OR (e.customer_id IS NULL AND e.actor_manager_id IN (SELECT id FROM managers WHERE (id=? OR parent_agent_manager_id=?) AND scope_id=?)))'
  :access.role==='agent_employee'
  ?' AND (c.manager_id=? OR c.manager_id IN (SELECT id FROM managers WHERE parent_agent_manager_id=? AND scope_id=?) OR (e.customer_id IS NULL AND e.actor_manager_id IN (SELECT id FROM managers WHERE (id=? OR parent_agent_manager_id=?) AND scope_id=?)))'
  :' AND (c.manager_id=? OR (e.customer_id IS NULL AND e.actor_manager_id=?))';
 const eventScopeParams=access.role==='principal'?[]:access.role==='agent'?[access.manager.id,access.manager.id,access.manager.id,access.manager.scope_id]:access.role==='agent_employee'?[Number(access.manager.parent_agent_manager_id),Number(access.manager.parent_agent_manager_id),access.manager.scope_id,Number(access.manager.parent_agent_manager_id),Number(access.manager.parent_agent_manager_id),access.manager.scope_id]:[access.manager.id,access.manager.id];
 const scoped=`SELECT e.*,CONCAT_WS(' ',e.customer_first_name,e.customer_last_name) customer_name FROM (${union}) e
  LEFT JOIN customers c ON c.id=e.customer_id WHERE ${clauses.join(' AND ')}${scopeForEvents}`;
 const [counts]:any=await app.query(`SELECT COUNT(*) total,COALESCE(SUM(e.result='success'),0) success,COALESCE(SUM(e.result='failed'),0) failed,COUNT(DISTINCT COALESCE(e.actor_manager_id,0)) actors FROM (${scoped}) e`,[...params,...eventScopeParams]);
 const pageClauses=result?clauses.concat('e.result=?'):clauses,pageFilterParams=result?params.concat(result):params;
 const pagedScoped=`SELECT e.*,CONCAT_WS(' ',e.customer_first_name,e.customer_last_name) customer_name FROM (${union}) e LEFT JOIN customers c ON c.id=e.customer_id WHERE ${pageClauses.join(' AND ')}${scopeForEvents}`;
 const pageParams=[...pageFilterParams,...eventScopeParams];
 const [rows]:any=await app.query(`SELECT e.* FROM (${pagedScoped}) e ORDER BY e.occurred_at DESC,e.source_type,e.id DESC LIMIT 51 OFFSET ?`,[...pageParams,cursor]);
 const [settings]:any=await app.query('SELECT timezone FROM network_settings WHERE id=1');
 const items=rows.slice(0,50).map((row:any)=>({...row,actor_snapshot:sanitize(json(row.actor_snapshot)),before_data:sanitize(json(row.before_data)),after_data:sanitize(json(row.after_data))}));
 return {summary:counts[0],timezone:settings[0]?.timezone||'Asia/Damascus',items,nextCursor:rows.length>50?cursor+50:null,subscriberOptions};
}
export async function readNetworkActivity(app:any,access:any,input:any){
 const cursor=Number(input.cursor||0),q=String(input.q||'').trim(),result=String(input.result||''),kind=String(input.kind||'system'),operation=String(input.operation||''),target=String(input.target||''),actorId=Number(input.actorId||0),actorKind=String(input.actorKind||''),fromDate=String(input.fromDate||''),toDate=String(input.toDate||''),customerId=Number(input.customerId||0),sourceType=String(input.sourceType||'');
 const operations:Record<string,string>={create:"e.action_code REGEXP '([.]|-)create$|[.]issue$'",update:"e.action_code REGEXP '([.]|-)update$|[.]toggle$|[.]password$'",status:"e.action_code REGEXP '[.]status$|[.]enable$|[.]disable$|[.]toggle$'",renew:"e.action_code REGEXP '[.]renew$|[.]expire$'",speed:"e.action_code REGEXP '[.]speed_boost([.]revert)?$'",connection:"e.action_code REGEXP '^subscriber[.]session[.]'",auth:"e.action_code REGEXP '^subscriber[.]auth[.]'",archive:"e.action_code REGEXP '([.]|-)archive$'",restore:"e.action_code REGEXP '([.]|-)restore$'",delete:"e.action_code REGEXP '([.]|-)delete$|[.]cleanup$'",login:"e.action_code='auth.login'",logout:"e.action_code='auth.logout'"};
 if(!Number.isSafeInteger(cursor)||cursor<0||q.length>100||!['','success','failed'].includes(result)||!['system','admin','subscribers'].includes(kind)||operation&&!Object.prototype.hasOwnProperty.call(operations,operation)||target&&!/^[a-z_]{1,64}$/.test(target)||!Number.isSafeInteger(actorId)||actorId<0||!['','manager','system'].includes(actorKind)||!validDate(fromDate)||!validDate(toDate)||fromDate&&toDate&&fromDate>toDate||!Number.isSafeInteger(customerId)||customerId<0||kind!=='subscribers'&&customerId||!['','audit','session','auth'].includes(sourceType)||kind!=='subscribers'&&sourceType)throw new Error('ACTIVITY_INPUT');
 const requiredPermission=kind==='subscribers'?'customers.view':'activity.view';if(access.role!=='principal'&&!access.permissions.includes(requiredPermission))throw new Error('NETWORK_AUTH');
 if(kind==='subscribers')return readSubscriberActivity(app,access,input,{cursor,q,result,operation,target,actorId,actorKind,fromDate,toDate,customerId,sourceType,operations});
 const clauses:string[]=[],params:any[]=[];
 if(access.role!=='principal'){if(access.role==='agent'){clauses.push('(actor_manager_id=? OR actor_manager_id IN (SELECT id FROM managers WHERE parent_agent_manager_id=? AND scope_id=?))');params.push(access.manager.id,access.manager.id,access.manager.scope_id);}else{clauses.push('actor_manager_id=?');params.push(access.manager.id);}}
 const subscriberActivity="(action_code REGEXP '^(customers|subscribers)[.]' OR action_code REGEXP '^pppoe[.]line[.]' OR action_code REGEXP '^hotspot[.](account|line)[.]' OR action_code REGEXP '^(lines|sessions)[.]' OR action_code REGEXP '^subscriber[.](session|auth)[.]')";
 const administrative="(action_code REGEXP '^(managers|permission_groups|categories|customer_categories|profiles|packages|nas|network)[.]' OR action_code REGEXP '^archive[.]policy[.]') AND action_code NOT REGEXP '([.]|-)view
 if(operation)clauses.push(operations[operation].replace('e.action_code','action_code'));if(target){clauses.push('target_type=?');params.push(target);}if(actorId){clauses.push('actor_manager_id=?');params.push(actorId);}if(actorKind)clauses.push('actor_kind=?');if(fromDate){clauses.push('occurred_at>=?');params.push(fromDate+' 00:00:00');}if(toDate){clauses.push('occurred_at<DATE_ADD(?,INTERVAL 1 DAY)');params.push(toDate+' 00:00:00');}
 if(q){clauses.push("(LOCATE(?,action_code)>0 OR LOCATE(?,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(actor_snapshot,'$.full_name')),''))>0)");params.push(q,q);}
 const where=' WHERE '+clauses.join(' AND ');
 const [counts]:any=await app.query("SELECT COUNT(*) total,COALESCE(SUM(result='success'),0) success,COALESCE(SUM(result='failed'),0) failed,COUNT(DISTINCT COALESCE(actor_manager_id,0)) actors FROM activity_log"+where,params);
 const pageClauses=[...clauses],pageParams=[...params];if(cursor){pageClauses.push('id<?');pageParams.push(cursor);}if(result){pageClauses.push('result=?');pageParams.push(result);}
 const [rows]:any=await app.query('SELECT id,customer_id,account_id,actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,before_data,after_data,result,failure_code,request_id,operation_id,occurred_at FROM activity_log'+(pageClauses.length?' WHERE '+pageClauses.join(' AND '):'')+' ORDER BY id DESC LIMIT 51',pageParams);
 const [settings]:any=await app.query('SELECT timezone FROM network_settings WHERE id=1');
 const items=rows.slice(0,50).map((row:any)=>({...row,actor_snapshot:sanitize(json(row.actor_snapshot)),before_data:sanitize(json(row.before_data)),after_data:sanitize(json(row.after_data))}));
 return {summary:counts[0],timezone:settings[0]?.timezone||'Asia/Damascus',items,nextCursor:rows.length>50?Number(items[items.length-1].id):null};
}
 AND action_code<>'managers.access'";
 clauses.push(kind==='admin'?'('+administrative+' AND NOT '+subscriberActivity+')':'NOT ('+administrative+') AND NOT '+subscriberActivity);
 if(operation)clauses.push(operations[operation].replace('e.action_code','action_code'));if(target){clauses.push('target_type=?');params.push(target);}if(actorId){clauses.push('actor_manager_id=?');params.push(actorId);}if(actorKind)clauses.push('actor_kind=?');if(fromDate){clauses.push('occurred_at>=?');params.push(fromDate+' 00:00:00');}if(toDate){clauses.push('occurred_at<DATE_ADD(?,INTERVAL 1 DAY)');params.push(toDate+' 00:00:00');}
 if(q){clauses.push("(LOCATE(?,action_code)>0 OR LOCATE(?,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(actor_snapshot,'$.full_name')),''))>0)");params.push(q,q);}
 const where=' WHERE '+clauses.join(' AND ');
 const [counts]:any=await app.query("SELECT COUNT(*) total,COALESCE(SUM(result='success'),0) success,COALESCE(SUM(result='failed'),0) failed,COUNT(DISTINCT COALESCE(actor_manager_id,0)) actors FROM activity_log"+where,params);
 const pageClauses=[...clauses],pageParams=[...params];if(cursor){pageClauses.push('id<?');pageParams.push(cursor);}if(result){pageClauses.push('result=?');pageParams.push(result);}
 const [rows]:any=await app.query('SELECT id,customer_id,account_id,actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,before_data,after_data,result,failure_code,request_id,operation_id,occurred_at FROM activity_log'+(pageClauses.length?' WHERE '+pageClauses.join(' AND '):'')+' ORDER BY id DESC LIMIT 51',pageParams);
 const [settings]:any=await app.query('SELECT timezone FROM network_settings WHERE id=1');
 const items=rows.slice(0,50).map((row:any)=>({...row,actor_snapshot:sanitize(json(row.actor_snapshot)),before_data:sanitize(json(row.before_data)),after_data:sanitize(json(row.after_data))}));
 return {summary:counts[0],timezone:settings[0]?.timezone||'Asia/Damascus',items,nextCursor:rows.length>50?Number(items[items.length-1].id):null};
}
