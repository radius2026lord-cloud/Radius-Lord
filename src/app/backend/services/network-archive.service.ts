import {randomUUID} from 'crypto';
import {db} from '../config/db';
import {networkScope,withNetwork} from './network-runtime.service';
import {invalidateNetworkManager} from './network-session-version.service';

let timer:NodeJS.Timeout|undefined,running=false;
async function cleanup(scope:any){
 const central=await db.pool.getConnection();let locked=false;
 try{const [lock]:any=await central.query("SELECT GET_LOCK('radius-lord:manager-credentials',0) acquired");if(!lock[0]?.acquired)return;locked=true;
 await withNetwork(scope,async app=>{await app.beginTransaction();try{
 const [policies]:any=await app.query('SELECT retention_days,automatic_cleanup FROM network_archive_policy WHERE id=1 FOR UPDATE');const policy=policies[0];if(!policy?.automatic_cleanup){await app.rollback();return;}
 const [managers]:any=await app.query("SELECT id FROM managers WHERE manager_type='subordinate' AND archived_at IS NOT NULL AND purged_at IS NULL AND TIMESTAMPDIFF(DAY,archived_at,CURRENT_TIMESTAMP)>=? ORDER BY archived_at,id LIMIT 100 FOR UPDATE",[policy.retention_days]);
 for(const manager of managers){
 await invalidateNetworkManager(central,scope,Number(manager.id));const [children]:any=await app.query('SELECT id FROM managers WHERE parent_agent_manager_id=?',[manager.id]);for(const child of children)await invalidateNetworkManager(central,scope,Number(child.id));
 await app.query('DELETE FROM manager_contact_numbers WHERE manager_id=?',[manager.id]);
 await app.query("UPDATE managers SET full_name='حساب محذوف',username=?,password_hash=?,contact_email=NULL,phone=NULL,notes=NULL,is_enabled=0,purged_at=CURRENT_TIMESTAMP WHERE id=?",['purged_'+manager.id+'_'+randomUUID().slice(0,8),'PURGED:'+randomUUID(),manager.id]);
 await app.query("UPDATE network_scopes SET name=CONCAT('نطاق مؤرشف #',id),is_enabled=0 WHERE owner_manager_id=?",[manager.id]);
 await app.query("INSERT INTO activity_log(actor_kind,action_code,target_type,target_id,after_data,result) VALUES('system','managers.archive.cleanup','manager',?,?,'success')",[manager.id,JSON.stringify({retentionDays:Number(policy.retention_days),restorable:false})]);
 }
 const [groups]:any=await app.query('SELECT id FROM permission_groups WHERE archived_at IS NOT NULL AND purged_at IS NULL AND TIMESTAMPDIFF(DAY,archived_at,CURRENT_TIMESTAMP)>=? ORDER BY archived_at,id LIMIT 100 FOR UPDATE',[policy.retention_days]);
 for(const group of groups){await app.query('DELETE FROM permission_group_permissions WHERE permission_group_id=?',[group.id]);await app.query("UPDATE permission_groups SET name=CONCAT('مجموعة محذوفة #',id),description=NULL,is_enabled=0,purged_at=CURRENT_TIMESTAMP WHERE id=?",[group.id]);await app.query("INSERT INTO activity_log(actor_kind,action_code,target_type,target_id,after_data,result) VALUES('system','permission_groups.archive.cleanup','permission_group',?,?,'success')",[group.id,JSON.stringify({retentionDays:Number(policy.retention_days),restorable:false})]);}
 await app.commit();
 }catch(e){await app.rollback();throw e;}});
 }finally{if(locked)await central.query("SELECT RELEASE_LOCK('radius-lord:manager-credentials')");central.release();}
}
export function startNetworkArchiveWorker(){
 if(timer)return;
 const tick=async()=>{if(running)return;running=true;try{const [rows]:any=await db.query("SELECT DISTINCT t.slug FROM tenants t JOIN tenant_environments e ON e.tenant_id=t.id WHERE t.status='active' AND t.archived_at IS NULL AND e.status='ready' AND e.archived_at IS NULL");for(const row of rows){try{await cleanup(await networkScope(row.slug));}catch(e){const code=(e as any).code;if(!['ER_NO_SUCH_TABLE','ER_BAD_FIELD_ERROR'].includes(code))console.error('[network-archive]',{result:'cleanup_deferred',code:code||'ENVIRONMENT_UNAVAILABLE'});}}}catch{console.error('[network-archive]',{result:'worker_unavailable'});}finally{running=false;}};
 timer=setInterval(()=>void tick(),3600000);timer.unref();void tick();return()=>{if(timer)clearInterval(timer);timer=undefined;};
}
