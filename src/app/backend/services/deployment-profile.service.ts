import {resolve4} from 'dns/promises';
import {randomBytes} from 'crypto';
import {isIP} from 'net';
import {db} from '../config/db';
import {readInfrastructureSelection} from './infrastructure-health.service';
const parse=(v:any)=>{try{return typeof v==='string'?JSON.parse(v):v;}catch{return null;}};
const domain=(v:unknown)=>typeof v==='string'&&v.length<=253&&/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(v)&&!isIP(v);
export function deploymentHosting(value:any){
 const host={access_mode:value?.access_mode??'domain',domain:String(value?.domain??'').trim().toLowerCase(),public_ip:String(value?.public_ip??'').trim(),local_ip:String(value?.local_ip??'').trim(),public_https_port:Number(value?.public_https_port??443),local_https_port:Number(value?.local_https_port??443)};
 if(host.access_mode!=='domain'||!domain(host.domain)||isIP(host.public_ip)!==4||isIP(host.local_ip)!==4||![host.public_https_port,host.local_https_port].every(n=>Number.isInteger(n)&&n>0&&n<=65535))throw new RangeError('راجع دومين الإنتاج وعناوين IPv4 ومنافذ HTTPS.');
 return host;
}
export async function readDeploymentProfile(){
 const selection=await readInfrastructureSelection();
 const [hosting,databases,radius,gateways]=await Promise.all([
  db.query("SELECT setting_value FROM platform_settings WHERE setting_group='local_hosting' AND setting_key='shared_cloud_connection'"),
  db.query('SELECT id,name,host,port FROM database_servers WHERE archived_at IS NULL ORDER BY id'),
  db.query("SELECT id,setting_value FROM platform_settings WHERE setting_group='free_radius' ORDER BY id"),
  db.query('SELECT id,settings_json FROM ovpn_gateways ORDER BY id'),
 ]);
 const current=parse((hosting[0] as any[])[0]?.setting_value);
 return {generatedAt:new Date().toISOString(),hosting:current?{access_mode:current.access_mode??'domain',domain:current.domain??'',public_ip:current.public_ip??'',local_ip:current.local_ip??'',public_https_port:current.public_https_port??443,local_https_port:current.local_https_port??443}:null,selection,
  databases:databases[0],radius:(radius[0] as any[]).map(row=>{const c=parse(row.setting_value)??{};return {id:Number(row.id),name:String(c.name??''),host:String(c.host??''),authPort:Number(c.authPort),accountingPort:Number(c.accountingPort)};}),
  gateways:(gateways[0] as any[]).map(row=>{const c=parse(row.settings_json)??{};return {id:Number(row.id),name:String(c.name??''),apiHost:String(c.api_host??''),apiPort:Number(c.api_port),ovpnHost:String(c.ovpn_host??''),ovpnPort:Number(c.ovpn_port)};})};
}
export async function exportDeploymentProfile(body:any){
 const saved=await readDeploymentProfile(),hosting=deploymentHosting(body?.hosting??saved.hosting);
 const ids=body?.selection??saved.selection??{};
 for(const [key,rows] of [['databaseServerId',saved.databases],['radiusServerId',saved.radius],['gatewayId',saved.gateways]] as const)if(!Number.isSafeInteger(Number(ids[key]))||!(rows as any[]).some(row=>Number(row.id)===Number(ids[key])))throw new RangeError('اختر خوادم مسجلة للقاعدة وFreeRADIUS وCHR.');
 return {schemaVersion:1,generatedAt:new Date().toISOString(),hosting,selection:{databaseServerId:Number(ids.databaseServerId),radiusServerId:Number(ids.radiusServerId),gatewayId:Number(ids.gatewayId)},infrastructure:{database:(saved.databases as any[]).find(row=>Number(row.id)===Number(ids.databaseServerId)),radius:saved.radius.find(row=>row.id===Number(ids.radiusServerId)),chr:saved.gateways.find(row=>row.id===Number(ids.gatewayId))},source:'radius-lord-settings',containsSecrets:false};
}
export async function checkDeploymentHosting(body:any){
 const profile=await exportDeploymentProfile(body),host=profile.hosting,port=host.public_https_port===443?'':':'+host.public_https_port,url='https://'+host.domain+port;
 const checks:Array<{key:string;status:string;message:string;scope:string}>=[];
 try{const addresses=await Promise.race([resolve4(host.domain),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('DNS_TIMEOUT')),5000))]);checks.push({key:'dns',status:addresses.includes(host.public_ip)?'ok':'warning',message:addresses.includes(host.public_ip)?'سجل A يطابق عنوان الاستضافة المحفوظ.':'سجل A لا يطابق العنوان المتوقع؛ راجع DNS أو إعداد CDN.',scope:'server'});}catch{checks.push({key:'dns',status:'failed',message:'تعذر حل سجل A للدومين من الباك إند.',scope:'server'});}
 const nonce=randomBytes(16).toString('hex');
 try{const response=await fetch(url+'/api/platform-health?nonce='+nonce,{redirect:'error',signal:AbortSignal.timeout(7000),headers:{Accept:'application/json'}});const reader=response.body?.getReader();if(!reader)throw Error('RESPONSE_EMPTY');let text='',size=0;const decoder=new TextDecoder();for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>8192){await reader.cancel();throw Error('RESPONSE_SIZE');}text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();const value=JSON.parse(text);const ok=response.ok&&value.application==='radius-lord-backend'&&value.nonce===nonce;checks.push({key:'https_api',status:ok?'ok':'failed',message:ok?'HTTPS صالح ووصل طلب التحقق إلى الباك إند عبر دومين المنصة.':'الدومين لم يُرجع استجابة Radius Lord المتوقعة.',scope:'server'});}catch{checks.push({key:'https_api',status:'failed',message:'تعذر التحقق من HTTPS ومسار API؛ راجع الشهادة والوكيل والمنافذ.',scope:'server'});}
 checks.push({key:'external',status:'pending',message:'الفحص من الباك إند لا يثبت الوصول من الإنترنت؛ يلزم اختبار من شبكة خارجية.',scope:'external'},{key:'websocket',status:'pending',message:'يلزم اختبار طرفية SSH من المتصفح بعد تشغيل الوكيل؛ نجاح HTTP لا يثبت WebSocket.',scope:'browser'});
 return {checkedAt:new Date().toISOString(),profile,checks};
}
