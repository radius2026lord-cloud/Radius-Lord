import {db} from '../config/db';
import {networkScope} from './network-runtime.service';
import {processPppoeLifecycle} from './network-pppoe-lifecycle.service';

let timer:NodeJS.Timeout|undefined,running=false;
export function startPppoeLifecycleWorker(){
 if(timer)return;
 const tick=async()=>{
  if(running)return;
  running=true;
  try{
   const [rows]:any=await db.query("SELECT DISTINCT t.slug FROM tenants t JOIN tenant_environments e ON e.tenant_id=t.id WHERE t.status='active' AND t.archived_at IS NULL AND e.status='ready' AND e.archived_at IS NULL");
   for(const row of rows){
    try{await processPppoeLifecycle(await networkScope(row.slug));}
    catch(error){const code=(error as any)?.code|| (error as any)?.message;if(!['ER_NO_SUCH_TABLE','ER_BAD_FIELD_ERROR','NETWORK_NOT_AVAILABLE'].includes(code))console.error('[pppoe-lifecycle-worker]',code||'ENVIRONMENT_UNAVAILABLE');}
   }
  }catch(error){console.error('[pppoe-lifecycle-worker]',(error as any)?.code||'WORKER_UNAVAILABLE');}
  finally{running=false;}
 };
 timer=setInterval(()=>void tick(),30000);
 timer.unref();
 void tick();
 return()=>{if(timer)clearInterval(timer);timer=undefined;};
}
