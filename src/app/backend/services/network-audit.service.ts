import {randomUUID} from 'crypto';
import {withNetwork} from './network-runtime.service';

// Explicit allowlist: never serialize request bodies, passwords, JWTs or activation links.
export async function auditNetworkEvent(app:any,event:{action:string;managerId?:number;result?:'success'|'failed';reason?:string}){
 const id=event.managerId;let snapshot:null|{id:number;full_name:string}=null;
 if(id){const [rows]:any=await app.query('SELECT id,full_name FROM managers WHERE id=?',[id]);snapshot=rows[0]?{id:Number(rows[0].id),full_name:rows[0].full_name}:null;}
 await app.query("INSERT INTO activity_log(actor_manager_id,actor_snapshot,actor_kind,action_code,target_type,target_id,result,failure_code,request_id) VALUES(?,? ,?,?, 'manager',?,?,?,?)",[snapshot?.id||null,snapshot?JSON.stringify(snapshot):null,snapshot?'manager':'system',event.action,snapshot?.id||null,event.result||'success',event.result==='failed'?event.reason||'AUTH_REJECTED':null,randomUUID()]);
}
export async function auditRejectedLogin(scope:any){try{await withNetwork(scope,app=>auditNetworkEvent(app,{action:'auth.login',result:'failed',reason:'AUTH_REJECTED'}));}catch{console.error('[network-audit]',{action:'auth.login',result:'audit_unavailable'});}}
