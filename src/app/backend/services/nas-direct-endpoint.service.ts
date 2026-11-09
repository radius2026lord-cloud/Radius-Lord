import {createHash} from 'crypto';
import {directAddress} from './environment-nas-link.service';
import type {NasResourceScope} from './nas-resource-scope.service';

// All direct endpoints share the backend routing domain. Reserve their IP:port
// centrally so two customer databases cannot silently address the same API.
// Historical addresses remain as ownership tombstones, fencing in-flight
// calls during edits and avoiding reassignment to another tenant too early.
export async function reserveDirectNasEndpoint(central:any,scope:NasResourceScope,nasId:number,address:string,port:number){
 const host=directAddress(address);
 if(![scope.tenant_id,scope.environment_id,scope.subscription_id,nasId].every(value=>Number.isSafeInteger(Number(value))&&Number(value)>0)||!Number.isInteger(port)||port<1||port>65535)throw new Error('NAS_DIRECT_ENDPOINT_INVALID');
 const key='endpoint_'+createHash('sha256').update(host+':'+port).digest('hex');
 const value={tenantId:Number(scope.tenant_id),environmentId:Number(scope.environment_id),subscriptionId:Number(scope.subscription_id),nasId:Number(nasId),address:host,port};
 const read=()=>central.query("SELECT setting_value FROM platform_settings WHERE setting_group='nas_direct_endpoints' AND setting_key=?",[key]);
 let [rows]:any=await read();
 if(!rows[0]){
  await central.query("INSERT IGNORE INTO platform_settings(setting_group,setting_key,setting_value,value_type,is_public) VALUES('nas_direct_endpoints',?,?,'json',0)",[key,JSON.stringify(value)]);
  [rows]=await read();
 }
 if(!rows[0])throw new Error('NAS_DIRECT_ENDPOINT_UNAVAILABLE');
 const current=typeof rows[0].setting_value==='string'?JSON.parse(rows[0].setting_value):rows[0].setting_value;
 if(Object.keys(value).some(key=>current[key]!==value[key as keyof typeof value]))throw new Error('NAS_DIRECT_ENDPOINT_IN_USE');
}
