import type mysql from 'mysql2/promise';
import {validateLocalLicense} from './network-runtime.service';

export type PppoeCapacity={used:number;limit:number;available:number|null;unlimited:boolean};
export class PppoePlanLimitError extends Error{
 readonly capacity:PppoeCapacity;
 constructor(capacity:PppoeCapacity){super('PPPOE_PLAN_LIMIT_REACHED');this.capacity=capacity;}
}

// Caller owns the transaction. Use the same local subscription lock as NAS creation.
// Counting accounts (including disabled/expired ones), never customers or hotspot cards,
// makes several PPPoE lines on one customer consume several subscription slots.
export async function readPppoePlanCapacity(app:mysql.Connection,scope:any,lock=false):Promise<PppoeCapacity>{
 if(lock){
  await app.query('SELECT id FROM platform_subscription WHERE id=1 FOR UPDATE');
 }
 const license=await validateLocalLicense(app,scope);
 const limit=Number(license.max_pppoe_accounts);
 if(!Number.isSafeInteger(limit)||limit<0)throw new Error('NETWORK_LICENSE_PAYLOAD');
 // A locking read sees newly committed accounts after waiting for the subscription lock,
 // even if the caller already established a REPEATABLE READ snapshot.
 const [rows]:any=await app.query('SELECT COUNT(*) used FROM pppoe_accounts WHERE archived_at IS NULL'+(lock?' FOR UPDATE':''));
 const used=Number(rows[0]?.used);
 if(!Number.isSafeInteger(used)||used<0)throw new Error('PLAN_CAPACITY_UNAVAILABLE');
 return {used,limit,available:limit===0?null:Math.max(0,limit-used),unlimited:limit===0};
}

export async function requirePppoePlanCapacity(app:mysql.Connection,scope:any,requested=1){
 if(!Number.isSafeInteger(requested)||requested<1)throw new Error('PLAN_CAPACITY_INPUT');
 const capacity=await readPppoePlanCapacity(app,scope,true);
 if(capacity.available!==null&&requested>capacity.available)throw new PppoePlanLimitError(capacity);
 return capacity;
}
