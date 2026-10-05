import { isIP } from 'net';
import { RouterApi, RouterRow } from './routeros-api.service';
const yes=(v:string)=>v==='true'||v==='yes';
export async function inspectRouter(api:RouterApi){
 const resource=await api.command('/system/resource/print',{'.proplist':'version'});
 const identity=await api.command('/system/identity/print',{'.proplist':'name'});
 const version=resource[0]?.version??'';
 const match=version.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
 if(!match || Number(match[1])<6 || (Number(match[1])===6 && (Number(match[2])<43)))throw new Error('يلزم RouterOS 6.43 أو أحدث.');
 const multi=Number(match[1])>7 || (Number(match[1])===7 && Number(match[2])>=17);
 const profiles=await api.command('/ppp/profile/print',{'.proplist':'.id,name,local-address,remote-address'});
 const pools=await api.command('/ip/pool/print',{'.proplist':'.id,name,ranges'});
 const certificates=await api.command('/certificate/print',{'.proplist':'.id,name,fingerprint,private-key,key-usage,expired,revoked,invalid-before,invalid-after,common-name'});
 const servers=await api.command('/interface/ovpn-server/server/print',{'.proplist':'.id,name,port,certificate,default-profile,disabled,enabled,protocol,auth,cipher,require-client-certificate'});
 return {version,identity:identity[0]?.name??'',multi,profiles,pools,certificates,servers};
}
export type RouterInventory=Awaited<ReturnType<typeof inspectRouter>>;
export type ProvisionOptions={ovpn_host:string;ovpn_port:number;server_name:string;certificate_name:string;certificate_mode:string;ppp_profile:string;profile_mode:string;pool_name:string;pool_mode:string;tunnel_cidr:string;server_tunnel_address:string};
function named(rows:RouterRow[],name:string){const found=rows.filter(r=>r.name===name);if(found.length>1)throw new Error('يوجد أكثر من عنصر بالاسم نفسه.');return found[0];}
function ipNumber(s:string){return s.split('.').reduce((n,v)=>(n*256+Number(v))>>>0,0);}
function ipString(n:number){return [n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join('.');}
export function validateProvision(b:any):ProvisionOptions{
 const o={} as ProvisionOptions;
 for(const k of ['ovpn_host','server_name','certificate_name','certificate_mode','ppp_profile','profile_mode','pool_name','pool_mode','tunnel_cidr','server_tunnel_address'] as const){if(typeof b[k]!=='string'||b[k].length>253)throw new Error('بيانات إعداد OpenVPN غير مكتملة.');o[k]=b[k].trim();}
 o.ovpn_port=Number(b.ovpn_port);if(!Number.isInteger(o.ovpn_port)||o.ovpn_port<1||o.ovpn_port>65535)throw new Error('منفذ OpenVPN غير صالح.');
 if(!o.ovpn_host || (!isIP(o.ovpn_host)&& !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(o.ovpn_host)))throw new Error('عنوان OpenVPN غير صالح.');
 for(const k of ['server_name','certificate_name','ppp_profile','pool_name'] as const)if(!o[k]||o[k].length>60||/[\x00-\x1f]/.test(o[k]))throw new Error('أدخل اسمًا صالحًا لكل عنصر، حتى 60 حرفًا.');
 for(const k of ['certificate_mode','profile_mode','pool_mode'] as const)if(!['existing','create'].includes(o[k]))throw new Error('طريقة اختيار الإعداد غير صالحة.');
 const parts=o.tunnel_cidr.split('/'),prefix=Number(parts[1]),net=ipNumber(parts[0]??''),first=Number(parts[0]?.split('.')[0]),second=Number(parts[0]?.split('.')[1]);
 const privateRange=first===10 || first===172&&second>=16&&second<=31 || first===192&&second===168;
 const mask=(0xffffffff<<(32-prefix))>>>0;
 if(parts.length!==2||isIP(parts[0])!==4||!Number.isInteger(prefix)||prefix<(first===10?8:first===172?12:16)||prefix>30||!privateRange||((net&mask)>>>0)!==net)throw new Error('أدخل نطاقًا خاصًا صحيحًا بين /8 و/30، مثل 10.80.0.0/24.');
 const local=ipNumber(o.server_tunnel_address),last=(net|~mask)>>>0;
 if(isIP(o.server_tunnel_address)!==4||((local&mask)>>>0)!==net||local<=net||local>=last)throw new Error('عنوان طرف الخادم يجب أن يكون ضمن النطاق وبعيدًا عن عنوان الشبكة والبث.');
 return o;
}
export function poolRanges(o:ProvisionOptions){const [network,p]=o.tunnel_cidr.split('/'),net=ipNumber(network),last=(net|~((0xffffffff<<(32-Number(p)))>>>0))>>>0,local=ipNumber(o.server_tunnel_address);return [[net+1,local-1],[local+1,last-1]].filter(([a,b])=>a<=b).map(([a,b])=>`${ipString(a)}-${ipString(b)}`).join(',');}
export function preflightInventory(inv:RouterInventory,o:ProvisionOptions){
 const pool=named(inv.pools,o.pool_name),profile=named(inv.profiles,o.ppp_profile),cert=named(inv.certificates,o.certificate_name);
 for(const [mode,row,title] of [[o.pool_mode,pool,'IP Pool'],[o.profile_mode,profile,'PPP Profile'],[o.certificate_mode,cert,'الشهادة']] as const){if(mode==='existing'&&!row)throw new Error(`العنصر المختار غير موجود: ${title}.`);}
 if(pool && pool.ranges!==poolRanges(o))throw new Error('نطاقات الـPool الموجود تختلف عن النطاق المطلوب؛ اختر اسمًا جديدًا أو نطاقًا مطابقًا.');
 if(profile&&(profile['local-address']!==o.server_tunnel_address||profile['remote-address']!==o.pool_name))throw new Error('إعدادات الـProfile الموجود مختلفة؛ اختر اسمًا جديدًا أو إعدادات مطابقة.');
 if(cert&&(o.certificate_mode==='existing'||cert.fingerprint)&&(!cert.fingerprint||!yes(cert['private-key'])||yes(cert.expired)||yes(cert.revoked)||!cert['key-usage']?.includes('tls-server')))throw new Error('الشهادة المختارة ليست شهادة خادم موقعة وصالحة مع مفتاح خاص.');
 if(!inv.multi && inv.servers.length>1)throw new Error('تعذر تحديد إعداد OpenVPN لهذا الإصدار.');
 const server=inv.multi?named(inv.servers,o.server_name):inv.servers[0];
 if(inv.servers.some(s=>s!==server && Number(s.port)===o.ovpn_port && (s.protocol??'tcp')==='tcp' && (yes(s.enabled)||s.disabled==='false'||s.disabled==='no')))throw new Error('المنفذ مستخدم بخادم OpenVPN آخر.');
 return {pool,profile,cert,server};
}
export async function provisionRouter(api:RouterApi,inv:RouterInventory,o:ProvisionOptions,onStep:(step:string)=>Promise<void>){
 const current=preflightInventory(inv,o);
 const ensureCert=async(name:string,ca?:string)=>{
  let row=named(await api.command('/certificate/print',{'.proplist':'.id,name,fingerprint,common-name,key-usage,private-key'}),name);
  if(!row){await api.command('/certificate/add',{name,'common-name':ca?o.ovpn_host:name,'key-size':'2048','days-valid':ca?'825':'3650','key-usage':ca?'digital-signature,key-encipherment,tls-server':'key-cert-sign,crl-sign',...(ca?{'subject-alt-name':`${isIP(o.ovpn_host)?'IP':'DNS'}:${o.ovpn_host}`}:{})});row=named(await api.command('/certificate/print',{'.proplist':'.id,name,fingerprint'}),name);}
  if(!row)throw new Error('تعذر قراءة قالب الشهادة.');
  if(!row.fingerprint && row['common-name'] && row['common-name']!==(ca?o.ovpn_host:name))throw new Error('يوجد قالب شهادة مختلف بالاسم المطلوب؛ اختر اسمًا جديدًا.');
  if(row.fingerprint && (!yes(row['private-key']) || !row['key-usage']?.includes(ca?'tls-server':'key-cert-sign')))throw new Error('يوجد عنصر شهادة غير متوافق بالاسم المطلوب.');
  if(!row.fingerprint)await api.command('/certificate/sign',{numbers:row['.id'],name,...(ca?{ca}:{})},[],45000);
  for(let i=0;i<15;i++){const ready=named(await api.command('/certificate/print',{'.proplist':'.id,name,fingerprint,private-key,key-usage'}),name);if(ready?.fingerprint){if(!yes(ready['private-key']))throw new Error('الشهادة لا تملك مفتاحًا خاصًا.');return;}await new Promise(r=>setTimeout(r,500));}
  throw new Error('توقيع الشهادة لم يكتمل؛ أعد الفحص ثم استكمل التجهيز.');
 };
 if(!current.cert?.fingerprint){await onStep('certificate');const ca=`${o.certificate_name}-ca`;await ensureCert(ca);await ensureCert(o.certificate_name,ca);}
 if(!current.pool){await onStep('pool');await api.command('/ip/pool/add',{name:o.pool_name,ranges:poolRanges(o)});}
 if(!current.profile){await onStep('profile');await api.command('/ppp/profile/add',{name:o.ppp_profile,'local-address':o.server_tunnel_address,'remote-address':o.pool_name,'only-one':'yes'});}
 await onStep('ovpn_server');
 const settings={port:String(o.ovpn_port),mode:'ip',certificate:o.certificate_name,'default-profile':o.ppp_profile,auth:'sha1',cipher:inv.version.startsWith('6.')?'aes256':'aes256-cbc','require-client-certificate':'yes',...(inv.multi?{protocol:'tcp',disabled:'no'}:{enabled:'yes'})};
 if(inv.multi){if(current.server)await api.command('/interface/ovpn-server/server/set',{'.id':current.server['.id'],...settings});else await api.command('/interface/ovpn-server/server/add',{name:o.server_name,...settings});}else await api.command('/interface/ovpn-server/server/set',settings);
 const after=await inspectRouter(api),s=after.multi?named(after.servers,o.server_name):after.servers[0];
 if(!s||s.certificate!==o.certificate_name||s['default-profile']!==o.ppp_profile||Number(s.port)!==o.ovpn_port||!(yes(s.enabled)||s.disabled==='false'||s.disabled==='no'))throw new Error('لم تطابق قراءة الخادم الإعدادات المطلوبة.');
 return after;
}
