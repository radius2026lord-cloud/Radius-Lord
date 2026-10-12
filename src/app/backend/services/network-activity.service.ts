// The activity endpoint returns tenant-local, authorized records only.
function json(value:any){if(typeof value==='string'){try{return JSON.parse(value);}catch{return null;}}return value;}
function sanitize(value:any):any{if(Array.isArray(value))return value.map(sanitize);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/(password|token|secret|private.?key|credentials|activation|api.?key)/i.test(key)).map(([key,item])=>[key,sanitize(item)]));return value;}
export async function readNetworkActivity(app:any,access:any,input:any){
 const cursor=Number(input.cursor||0),q=String(input.q||'').trim(),result=String(input.result||'');if(!Number.isSafeInteger(cursor)||cursor<0||q.length>100||!['','success','failed'].includes(result))throw new Error('ACTIVITY_INPUT');
 const clauses:string[]=[],params:any[]=[];
 if(access.role!=='principal'){if(!access.permissions.includes('activity.view'))throw new Error('NETWORK_AUTH');if(access.role==='agent'){clauses.push('(actor_manager_id=? OR actor_manager_id IN (SELECT id FROM managers WHERE parent_agent_manager_id=? AND scope_id=?))');params.push(access.manager.id,access.manager.id,access.manager.scope_id);}else{clauses.push('actor_manager_id=?');params.push(access.manager.id);}}
 if(cursor){clauses.push('id<?');params.push(cursor);}if(result){clauses.push('result=?');params.push(result);}if(q){clauses.push("(LOCATE(?,action_code)>0 OR LOCATE(?,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(actor_snapshot,'$.full_name')),''))>0)");params.push(q,q);}
 const [rows]:any=await app.query('SELECT id,actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,before_data,after_data,result,failure_code,request_id,operation_id,occurred_at FROM activity_log'+(clauses.length?' WHERE '+clauses.join(' AND '):'')+' ORDER BY id DESC LIMIT 51',params);
 const [settings]:any=await app.query('SELECT timezone FROM network_settings WHERE id=1');
 const page=rows.slice(0,50).map((row:any)=>({...row,actor_snapshot:sanitize(json(row.actor_snapshot)),before_data:sanitize(json(row.before_data)),after_data:sanitize(json(row.after_data))}));return {timezone:settings[0]?.timezone||'Asia/Damascus',items:page,nextCursor:rows.length>50?Number(page[page.length-1].id):null};
}
