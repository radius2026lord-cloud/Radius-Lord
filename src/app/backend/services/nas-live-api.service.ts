import {readNetworkNasItems} from './network-nas-snapshot.service';
import {createHash} from 'crypto';
import {db} from '../config/db';
import {withNetwork} from './network-runtime.service';
import {checkNetworkNasApi} from './network-ovpn.service';

type Observation={success:boolean;code?:string;metrics?:any;checkedAt?:string;apiPort?:number;connection?:any;nas?:any};
type Entry={until:number;pending?:Promise<Observation>;value?:Observation};
const entries=new Map<string,Entry>();
let active=0;
const safeCode=(error:unknown)=>error instanceof Error&&/^[A-Z][A-Z0-9_]{0,79}$/.test(error.message)?error.message:'NAS_API_UNAVAILABLE';
// HTTP requests from all viewers share one result/in-flight operation per NAS.
// No intervals or timers survive a closed page. Failed probes back off for 15s.
export async function readNasLiveApi(scope:any,nasId:number):Promise<Observation>{
 if(!Number.isSafeInteger(nasId)||nasId<1)throw new Error('NAS_INPUT_INVALID');
 const key=[scope.tenant_id,scope.environment_id,scope.subscription_id,nasId].join(':');
 const previous=entries.get(key);
 if(previous?.pending)return previous.pending;
 if(previous?.value&&previous.until>Date.now())return previous.value;
 for(const [id,entry] of entries)if(!entry.pending&&entry.until<=Date.now())entries.delete(id);
 if(active>=4||entries.size>=128)return {success:false,code:'NAS_LIVE_BUSY'};
 const entry:Entry={until:0};entries.set(key,entry);active++;
 entry.pending=(async()=>{
  let central:any,locked=false;
  const lock='nas-live:'+createHash('sha256').update(key).digest('hex').slice(0,48);
  try{
   central=await db.pool.getConnection();
   const [rows]:any=await central.query('SELECT GET_LOCK(?,0) acquired',[lock]);
   if(!rows[0]?.acquired)return {success:false,code:'NAS_LIVE_BUSY'};
   locked=true;
   return await withNetwork(scope,async app=>{
    try{
     const result=await checkNetworkNasApi(central,app,nasId,scope,undefined,undefined,true);
     const [nas]=await readNetworkNasItems(app,nasId);
     // Explicit allowlist: never expose configuration snapshots or credentials.
     return {success:true,nas,metrics:result.metrics,checkedAt:result.checkedAt,apiPort:result.apiPort,connection:result.connection};
    }catch(error){
     const [nas]=await readNetworkNasItems(app,nasId).catch(()=>[]);
     return {success:false,code:safeCode(error),nas};
    }
   });
  }catch(error){return {success:false,code:safeCode(error)};}
  finally{try{if(locked)await central.query('SELECT RELEASE_LOCK(?)',[lock]);}finally{central?.release();}}
 })();
 try{
  const result=await entry.pending;
  entry.value=result;entry.until=Date.now()+(result.success?4500:['NAS_LIVE_BUSY','NAS_API_BUSY','OVPN_GATEWAY_BUSY'].includes(result.code||'')?4500:15000);
  return result;
 }finally{entry.pending=undefined;active--;}
}
