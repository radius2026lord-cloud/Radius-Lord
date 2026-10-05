"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Server, ShieldCheck } from "lucide-react";
import ProjectInput from "@/components/ui/project-input";
import ProjectDropdown from "@/components/ui/project-dropdown";
import Button from "@/components/ui/project-button";
import ProjectTooltip from "@/components/ui/project-tooltip";
import { useAuth } from "@/components/auth/auth-provider";
import { CollectionState } from "@/components/ui/collection-display";

type Item=Record<string,string>;
type Inventory={version:string;identity:string;multi:boolean;pools:Item[];profiles:Item[];certificates:Item[];servers:Item[]};
type Gateway={id?:number;name:string;description:string;api_host:string;api_port:number;api_username:string;api_tls:boolean;ovpn_host:string;ovpn_port:number;server_name:string;certificate_name:string;certificate_mode:string;ppp_profile:string;profile_mode:string;pool_name:string;pool_mode:string;tunnel_cidr:string;server_tunnel_address:string;has_api_password?:boolean};
const initial:Gateway={name:"",description:"",api_host:"",api_port:8728,api_username:"",api_tls:false,ovpn_host:"",ovpn_port:1194,server_name:"lord-ovpn",certificate_name:"lord-ovpn-server",certificate_mode:"create",ppp_profile:"lord-ovpn",profile_mode:"create",pool_name:"lord-ovpn-pool",pool_mode:"create",tunnel_cidr:"10.80.0.0/24",server_tunnel_address:"10.80.0.1"};
const base="/api/admin/platform-settings/ovpn-gateways";
export default function OvpnGatewayForm({gatewayId,viewOnly=false}:{gatewayId?:number;viewOnly?:boolean}){
 const router=useRouter(),{isMasterAdmin,loading:authLoading}=useAuth();
 const [form,setForm]=useState<Gateway>(initial),[password,setPassword]=useState(""),[loading,setLoading]=useState(Boolean(gatewayId)),[busy,setBusy]=useState(false),[error,setError]=useState(""),[step,setStep]=useState(1),[advanced,setAdvanced]=useState(false),[inventory,setInventory]=useState<Inventory|null>(null),[verified,setVerified]=useState(""),[review,setReview]=useState(false),[completed,setCompleted]=useState(false);
 useEffect(()=>{if(!isMasterAdmin||!gatewayId)return;let cancelled=false;(async()=>{try{const r=await fetch(base,{credentials:"include"}),j=await r.json();if(!r.ok)throw new Error(j.message);const row=j.gateways.find((g:Gateway)=>g.id===gatewayId);if(!row)throw new Error("الخادم غير موجود.");if(!cancelled)setForm({...initial,...row});}catch(e){if(!cancelled)setError(e instanceof Error?e.message:"تعذر تحميل الخادم.");}finally{if(!cancelled)setLoading(false);}})();return()=>{cancelled=true;};},[isMasterAdmin,gatewayId]);
 function change<K extends keyof Gateway>(k:K,v:Gateway[K]){setForm(f=>({...f,[k]:v}));setReview(false);setCompleted(false);if(['api_host','api_port','api_username','api_tls'].includes(k)){setVerified("");setInventory(null);}}
 async function request(path:string,body:unknown,method="POST"){const r=await fetch(path,{method,credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),j=await r.json();if(!r.ok)throw new Error(j.message||"تعذر تنفيذ الطلب.");return j;}
 function prefill(inv:Inventory,f:Gateway):Gateway{
  const s=inv.servers.find(x=>x.name===f.server_name)||(!inv.multi?inv.servers[0]:undefined);
  const profile=inv.profiles.find(x=>x.name===(s?.['default-profile']||f.ppp_profile));
  const pool=inv.pools.find(x=>x.name===(profile?.['remote-address']||f.pool_name));
  const cert=inv.certificates.filter(x=>x.fingerprint).find(x=>x.name===(s?.certificate||f.certificate_name));
  return {...f,ovpn_host:f.ovpn_host||f.api_host,ovpn_port:s?.port?Number(s.port):f.ovpn_port,server_name:s?.name||f.server_name,ppp_profile:profile?.name||f.ppp_profile,profile_mode:profile?"existing":"create",pool_name:pool?.name||f.pool_name,pool_mode:pool?"existing":"create",certificate_name:cert?.name||f.certificate_name,certificate_mode:cert?"existing":"create",server_tunnel_address:profile?.['local-address']||f.server_tunnel_address};
 }
 async function inspect(){setBusy(true);setError("");setVerified("");setReview(false);try{
  const payload={...form,api_password:password||undefined};
  let result=await request(base+(form.id?`/${form.id}`:"")+"/inspect",payload);
  // Persist the connection only after successful authentication; provisioning is a separate explicit action.
  const saved=await request(base+(form.id?`/${form.id}`:""),{...payload,verified:result.verified},form.id?"PUT":"POST");
  const next={...form,...saved.settings} as Gateway;setForm(next);setPassword("");
  result=await request(`${base}/${next.id}/inspect`,{...next});
  setForm(prefill(result.inventory,next));setInventory(result.inventory);setVerified(result.verified);setStep(2);
 }catch(e){setError(e instanceof Error?e.message:"تعذر الاتصال بالخادم.");}finally{setBusy(false);}}
 async function apply(){setBusy(true);setError("");try{await request(`${base}/${form.id}/apply`,{...form,api_password:password||undefined,verified});setCompleted(true);setVerified("");setReview(false);}catch(e){setError(e instanceof Error?e.message:"تعذر تطبيق الإعدادات.");setVerified("");setReview(false);}finally{setBusy(false);}}
 const field=(k:keyof Gateway,label:string,placeholder="",numeric=false)=><label key={k} className="space-y-2 text-xs font-medium text-slate-600 dark:text-slate-300"><span>{label}</span><ProjectInput disabled={busy||viewOnly} required value={String(form[k]??"")} dir={['name','description'].includes(k)?"rtl":"ltr"} inputMode={numeric?"numeric":undefined} maxLength={numeric?5:253} placeholder={placeholder} onChange={e=>change(k,(numeric?Number(e.target.value.replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g,"")):e.target.value) as never)}/></label>;
 const selectResource=(kind:"pool"|"profile"|"certificate",title:string,items:Item[])=>{
 const mode=kind==="pool"?"pool_mode":kind==="profile"?"profile_mode":"certificate_mode",name=kind==="pool"?"pool_name":kind==="profile"?"ppp_profile":"certificate_name";
 return <div className="space-y-3 rounded-[18px] border border-[#d7e3ef] p-4 dark:border-white/10"><h3 className="text-sm font-semibold">{title}</h3>{busy?<p className="text-xs text-slate-500">جارٍ التطبيق...</p>:<ProjectDropdown value={form[mode]} onChange={v=>{change(mode,v);if(v==="existing"&&items[0])change(name,items[0].name);}} options={[{value:"create",label:"إنشاء جديد"},...(items.length?[{value:"existing",label:"اختيار الموجود على الخادم"}]:[])]}/>} {form[mode]==="create"?field(name,"الاسم"):busy?<p>{form[name]}</p>:<ProjectDropdown value={form[name]} onChange={v=>{change(name,v);if(kind==="profile"){const p=items.find(x=>x.name===v);if(p?.['local-address'])change("server_tunnel_address",p['local-address']);if(p?.['remote-address']&&inventory?.pools.some(x=>x.name===p['remote-address'])){change("pool_mode","existing");change("pool_name",p['remote-address']);}}}} options={items.map(x=>({value:x.name,label:x.name,hint:kind==="pool"?x.ranges:undefined}))}/>}</div>;
 };
 if(authLoading||loading)return <CollectionState>جارٍ التحميل...</CollectionState>;
 if(!isMasterAdmin)return <CollectionState>هذه الصفحة خاصة بالمدير الرئيسي للمنصة.</CollectionState>;
 return <div dir="rtl" className="space-y-3 text-slate-800 dark:text-slate-200">
 <div className="flex justify-end"><ProjectTooltip label="عرض خوادم الاتصال"><Button variant="back" onClick={()=>router.push('/Dashboard/connection-servers')}><ArrowRight/>عرض الخوادم</Button></ProjectTooltip></div>
 {!viewOnly&&<div className="rl-surface flex flex-wrap items-center gap-3 rounded-[18px] bg-white px-4 py-3 text-xs dark:bg-[#0d243b]"><span className={step===1?"font-bold text-blue-600":"text-slate-500"}>1 · بيانات الاتصال</span><span className={step===2?"font-bold text-blue-600":"text-slate-500"}>2 · إعداد OpenVPN</span></div>}
 <section className="rl-surface overflow-hidden rounded-[22px] bg-white p-4 sm:p-5 dark:bg-[#0d243b]">
 {(step===1||viewOnly)?<><h2 className="mb-4 flex items-center gap-2 font-semibold"><Server className="h-5 w-5 text-blue-500"/>بيانات الاتصال الأساسية</h2><div className="grid gap-4 sm:grid-cols-2">{field("name","اسم الخادم")}{field("api_host","عنوان IP أو الدومين")}{field("api_username","اسم المستخدم")}<label className="space-y-2 text-xs font-medium"><span>كلمة المرور {form.has_api_password?"— اترك فارغة للإبقاء عليها":""}</span>{viewOnly?<p>محفوظة ومشفّرة</p>:<ProjectInput disabled={busy} type="password" autoComplete="new-password" maxLength={512} value={password} onChange={e=>{setPassword(e.target.value);setVerified("");setInventory(null);}}/>}</label></div>
 {!viewOnly&&<><Button className="mt-4" variant="ghost" disabled={busy} onClick={()=>setAdvanced(x=>!x)}>خيارات الاتصال المتقدمة</Button>{advanced&&<div className="mt-3 grid gap-4 sm:grid-cols-2">{field("api_port","منفذ API","8728",true)}<div className="space-y-2"><span className="text-xs">طريقة الاتصال</span>{!busy&&<ProjectDropdown value={String(form.api_tls)} onChange={v=>{change("api_tls",v==="true");change("api_port",v==="true"?8729:8728);}} options={[{value:"false",label:"API — شبكة موثوقة"},{value:"true",label:"API مع TLS"}]}/>}</div></div>}<p className="mt-4 text-xs text-slate-500">يلزم تفعيل API على MikroTik. مع TLS نتحقق من شهادة اتصال الإدارة؛ لا علاقة لها بشهادة OpenVPN.</p></>}
 {viewOnly&&<div className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-2">{field("ovpn_host","عنوان OpenVPN")}{field("ovpn_port","المنفذ","",true)}{field("ppp_profile","PPP Profile")}{field("pool_name","IP Pool")}{field("certificate_name","الشهادة")}{field("server_tunnel_address","عنوان الخادم داخل النفق")}</div>}
 </>:<><div className="mb-4 rounded-[16px] bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"><ShieldCheck className="mb-1 h-5 w-5"/>تم الاتصال بـ{inventory?.identity} — RouterOS <bdi>{inventory?.version}</bdi></div>
 <div className="grid gap-4 sm:grid-cols-2">{field("ovpn_host","العنوان العام لاتصال NAS")}{field("ovpn_port","منفذ OpenVPN","1194",true)}{inventory?.multi?field("server_name","اسم خدمة OpenVPN"): <p className="self-center text-xs text-slate-500">هذا الإصدار يستخدم إعداد OpenVPN واحدًا؛ سيُعدّل عند التطبيق.</p>}{field("server_tunnel_address","عنوان الخادم داخل النفق")}{field("tunnel_cidr","نطاق الأنفاق — CIDR")}</div>
 <div className="mt-5 grid gap-4 md:grid-cols-3">{selectResource("pool","IP Pool",inventory?.pools??[])}{selectResource("profile","PPP Profile",inventory?.profiles??[])}{selectResource("certificate","شهادة OpenVPN",inventory?.certificates.filter(c=>c.fingerprint&&['true','yes'].includes(c['private-key'])&&!['true','yes'].includes(c.expired)&&!['true','yes'].includes(c.revoked)&&c['key-usage']?.includes('tls-server'))??[])}</div>
 <p className="mt-4 text-xs leading-6 text-slate-500">تُستثنى عناوين الشبكة والبث وعنوان طرف الخادم من الـPool الجديد. إنشاء الشهادة يتضمن إنشاء CA خاصة بها على MikroTik. البروتوكول TCP؛ شهادات العملاء ومسارات الراديوس والجدار الناري تُجهّز ضمن ربط NAS لاحقًا.</p>
 {review&&<div className="mt-5 space-y-2 rounded-[16px] border border-blue-200 p-4 text-sm dark:border-white/10"><h3 className="font-bold">مراجعة قبل التطبيق</h3><p>الخادم: {form.name} — <bdi>{form.api_host}</bdi></p><p>OpenVPN: <bdi>{form.ovpn_host}:{form.ovpn_port}</bdi></p><p>Pool: <bdi>{form.pool_name}</bdi> · {form.pool_mode==="create"?"إنشاء":"استخدام الموجود"}</p><p>Profile: <bdi>{form.ppp_profile}</bdi> · {form.profile_mode==="create"?"إنشاء":"استخدام الموجود"}</p><p>الشهادة: <bdi>{form.certificate_name}</bdi> · {form.certificate_mode==="create"?"إنشاء CA وشهادة خادم":"استخدام الموجودة"}</p><p className="text-xs text-slate-500">سيُفعّل خادم OpenVPN المحدد بإعدادات TCP واشتراط شهادة العميل. تعديل خدمة موجودة قد يؤثر على اتصالاتها؛ التطبيق لا يغير API أو الجدار الناري.</p></div>}
 </>}
 </section>
 {error&&<p role="alert" className="rounded-[14px] bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}
 {completed&&<p role="status" className="rounded-[14px] bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">تم تطبيق إعدادات OpenVPN وقراءتها من الخادم وحفظها بنجاح.</p>}
 {!viewOnly&&<div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={()=>router.push('/Dashboard/connection-servers')}>إغلاق</Button>{step===2&&<Button variant="secondary" disabled={busy} onClick={()=>{setStep(1);setReview(false);}}>بيانات الاتصال</Button>}{step===1?<Button disabled={busy} onClick={inspect}>{busy?"جارٍ فحص الاتصال...":"فحص الاتصال والمتابعة"}</Button>:!verified?<Button disabled={busy} onClick={inspect}>{busy?"جارٍ فحص الاتصال...":"إعادة فحص الاتصال"}</Button>:review?<Button disabled={busy} onClick={apply}><Check/>{busy?"جارٍ التطبيق...":"تطبيق الإعدادات على الخادم"}</Button>:<Button disabled={busy} onClick={()=>setReview(true)}>مراجعة الإعدادات</Button>}</div>}
 </div>;
}
