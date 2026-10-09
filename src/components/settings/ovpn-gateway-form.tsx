"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Server, ShieldCheck } from "lucide-react";
import FloatingContentGuide from "@/components/ui/floating-content-guide";
import OvpnHealthCard from "@/components/settings/ovpn-health-card";
import ProjectInput from "@/components/ui/project-input";
import ProjectDropdown from "@/components/ui/project-dropdown";
import Button from "@/components/ui/project-button";
import ProjectTooltip from "@/components/ui/project-tooltip";
import { useAuth } from "@/components/auth/auth-provider";
import { CollectionState } from "@/components/ui/collection-display";

type Item=Record<string,string>;
type Inventory={version:string;identity:string;multi:boolean;pools:Item[];profiles:Item[];certificates:Item[];servers:Item[]};
type Gateway={id?:number;name:string;description:string;api_host:string;api_port:number;api_username:string;api_tls:boolean;ovpn_host:string;ovpn_port:number;server_name:string;certificate_name:string;certificate_mode:string;ppp_profile:string;profile_mode:string;pool_name:string;pool_mode:string;tunnel_cidr:string;server_tunnel_address:string;has_api_password?:boolean;last_checked_at?:string};
const initial:Gateway={name:"",description:"",api_host:"",api_port:8728,api_username:"",api_tls:false,ovpn_host:"",ovpn_port:1194,server_name:"lord-ovpn",certificate_name:"lord-ovpn-server",certificate_mode:"create",ppp_profile:"lord-ovpn",profile_mode:"create",pool_name:"lord-ovpn-pool",pool_mode:"create",tunnel_cidr:"10.80.0.0/24",server_tunnel_address:"10.80.0.1"};
const base="/api/admin/platform-settings/ovpn-gateways";
export default function OvpnGatewayForm({gatewayId,viewOnly=false}:{gatewayId?:number;viewOnly?:boolean}){
 const router=useRouter(),{isMasterAdmin,loading:authLoading}=useAuth();
 const contentRef=useRef<HTMLDivElement>(null);
 const panelRef=useRef<HTMLElement>(null),errorRef=useRef<HTMLParagraphElement>(null);
 const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({}),[warningVersion,setWarningVersion]=useState(0);
 const [setupMode,setSetupMode]=useState("automatic"),[setupStep,setSetupStep]=useState(0);
 const [form,setForm]=useState<Gateway>(initial),[password,setPassword]=useState(""),[loading,setLoading]=useState(Boolean(gatewayId)),[busy,setBusy]=useState(false),[error,setError]=useState(""),[step,setStep]=useState(1),[advanced,setAdvanced]=useState(false),[inventory,setInventory]=useState<Inventory|null>(null),[verified,setVerified]=useState(""),[review,setReview]=useState(false),[completed,setCompleted]=useState(false),[connectionSaved,setConnectionSaved]=useState(false);
 useEffect(()=>{if(!isMasterAdmin||!gatewayId)return;let cancelled=false;(async()=>{try{const r=await fetch(base,{credentials:"include"}),j=await r.json();if(!r.ok)throw new Error(j.message);const row=j.gateways.find((g:Gateway)=>g.id===gatewayId);if(!row)throw new Error("الخادم غير موجود.");if(!cancelled)setForm({...initial,...row});}catch(e){if(!cancelled)setError(e instanceof Error?e.message:"تعذر تحميل الخادم.");}finally{if(!cancelled)setLoading(false);}})();return()=>{cancelled=true;};},[isMasterAdmin,gatewayId]);
 function change<K extends keyof Gateway>(k:K,v:Gateway[K]){setForm(f=>({...f,[k]:v}));setReview(false);setCompleted(false);if(['api_host','api_port','api_username','api_tls'].includes(k)){setVerified("");setInventory(null);}}
 function warn(input:HTMLInputElement,message:string,focus=true){setFieldErrors(x=>({...x,[input.name]:message}));setWarningVersion(x=>x+1);if(!focus)return;input.focus();input.scrollIntoView({block:"center",behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?"auto":"smooth"});}
 function validateInput(input:HTMLInputElement,focus=true){
  if(input.required&&!input.value.trim()){warn(input,"هذا الحقل مطلوب.",focus);return false;}
  if(input.inputMode==="numeric"&&(!/^\d+$/.test(input.value)||Number(input.value)<1||Number(input.value)>65535)){warn(input,"أدخل رقمًا صحيحًا بين 1 و65535.",focus);return false;}
  setFieldErrors(x=>{const next={...x};delete next[input.name];return next;});return true;
 }
 function validateVisible(){const inputs=Array.from(panelRef.current?.querySelectorAll<HTMLInputElement>('input:not(:disabled)')??[]);for(const input of inputs){if(!validateInput(input))return false;}return true;}
 function nextSetup(){if(!validateVisible())return;setError("");if((setupMode==="automatic"&&setupStep===1)||setupStep===4){setReview(true);}else{setSetupStep(x=>x+1);}}
 function enterField(event:React.KeyboardEvent<HTMLElement>){
  if(event.key!=="Enter"||event.nativeEvent.isComposing||event.shiftKey||busy)return;
  const input=event.target;if(!(input instanceof HTMLInputElement))return;
  event.preventDefault();if(!validateInput(input))return;
  const inputs=Array.from(panelRef.current?.querySelectorAll<HTMLInputElement>('input:not(:disabled)')??[]);const next=inputs[inputs.indexOf(input)+1];
  if(next){next.focus();next.scrollIntoView({block:"center",behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?"auto":"smooth"});}
  else if(step===1){if(validateVisible())void inspect();}else if(verified&&!review){nextSetup();}
 }
 useEffect(()=>{if(viewOnly||busy)return;const panel=panelRef.current;if(!panel)return;panel.scrollIntoView({block:"nearest",behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?"auto":"smooth"});panel.querySelector<HTMLElement>('input:not(:disabled),button:not(:disabled)')?.focus({preventScroll:true});},[step,setupStep,review,advanced,viewOnly,busy,loading,authLoading]);
 useEffect(()=>{if(error)errorRef.current?.scrollIntoView({block:"center",behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?"auto":"smooth"});},[error]);
 async function request(path:string,body:unknown,method="POST"){const r=await fetch(path,{method,credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),j=await r.json();if(!r.ok)throw new Error(j.message||"تعذر تنفيذ الطلب.");return j;}
 function prefill(inv:Inventory,f:Gateway):Gateway{
  const s=inv.servers.find(x=>x.name===f.server_name)||(!inv.multi?inv.servers[0]:undefined);
  const profile=inv.profiles.find(x=>x.name===(s?.['default-profile']||f.ppp_profile));
  const pool=inv.pools.find(x=>x.name===(profile?.['remote-address']||f.pool_name));
  const cert=inv.certificates.filter(x=>x.fingerprint).find(x=>x.name===(s?.certificate||f.certificate_name));
  return {...f,ovpn_host:f.ovpn_host||f.api_host,ovpn_port:s?.port?Number(s.port):f.ovpn_port,server_name:s?.name||f.server_name,ppp_profile:profile?.name||f.ppp_profile,profile_mode:profile?"existing":"create",pool_name:pool?.name||f.pool_name,pool_mode:pool?"existing":"create",certificate_name:cert?.name||f.certificate_name,certificate_mode:cert?"existing":"create",server_tunnel_address:profile?.['local-address']||f.server_tunnel_address};
 }
 async function inspect(){if(!validateVisible())return;setBusy(true);setError("");setVerified("");setReview(false);try{
  const payload={...form,api_password:password||undefined};
  let result=await request(base+(form.id?`/${form.id}`:"")+"/inspect",payload);
  // Persist the connection only after successful authentication; provisioning is a separate explicit action.
  const saved=await request(base+(form.id?`/${form.id}`:""),{...payload,verified:result.verified},form.id?"PUT":"POST");
  const next={...form,...saved.settings} as Gateway;setForm(next);setConnectionSaved(true);setPassword("");
  result=await request(`${base}/${next.id}/inspect`,{...next});
  setForm(prefill(result.inventory,next));setInventory(result.inventory);setVerified(result.verified);setStep(2);setSetupStep(0);
 }catch(e){setError(e instanceof Error?e.message:"تعذر الاتصال بالخادم.");}finally{setBusy(false);}}
 async function apply(){setBusy(true);setError("");try{await request(`${base}/${form.id}/apply`,{...form,api_password:password||undefined,verified});setCompleted(true);setVerified("");setReview(false);}catch(e){setError(e instanceof Error?e.message:"تعذر تطبيق الإعدادات.");setVerified("");setReview(false);}finally{setBusy(false);}}
 const field=(k:keyof Gateway,label:string,placeholder="",numeric=false)=><label key={k} className="space-y-2 text-xs font-medium text-slate-600 dark:text-slate-300"><span>{label}</span><ProjectInput name={k} aria-invalid={Boolean(fieldErrors[k])} aria-describedby={fieldErrors[k]?`ovpn-error-${k}`:undefined} onBlur={e=>{if(!viewOnly)validateInput(e.currentTarget,false);}} disabled={busy||viewOnly} required value={String(form[k]??"")} dir={['name','description'].includes(k)?"rtl":"ltr"} inputMode={numeric?"numeric":undefined} maxLength={numeric?5:253} placeholder={placeholder} onChange={e=>{setFieldErrors(x=>{const next={...x};delete next[k];return next;});if(numeric&&/[^0-9٠-٩]/.test(e.target.value)){warn(e.currentTarget,"هذا الحقل يقبل الأرقام فقط.");}change(k,(numeric?Number(e.target.value.replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g,"")):e.target.value) as never);}}/>{fieldErrors[k]&&<p key={warningVersion} id={`ovpn-error-${k}`} role="alert" className="ui-field-warning mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors[k]}</p>}</label>;
 const selectResource=(kind:"pool"|"profile"|"certificate",title:string,items:Item[])=>{
 const mode=kind==="pool"?"pool_mode":kind==="profile"?"profile_mode":"certificate_mode",name=kind==="pool"?"pool_name":kind==="profile"?"ppp_profile":"certificate_name";
 return <div className="space-y-3 rounded-[18px] border border-[#d7e3ef] p-4 dark:border-white/10"><h3 className="text-sm font-semibold">{title}</h3>{busy?<p className="text-xs text-slate-500">جارٍ التطبيق...</p>:<ProjectDropdown value={form[mode]} onChange={v=>{change(mode,v);if(v==="existing"&&items[0])change(name,items[0].name);}} options={[{value:"create",label:"إنشاء جديد"},...(items.length?[{value:"existing",label:"اختيار الموجود على الخادم"}]:[])]}/>} {form[mode]==="create"?field(name,"الاسم"):busy?<p>{form[name]}</p>:<ProjectDropdown value={form[name]} onChange={v=>{change(name,v);if(kind==="profile"){const p=items.find(x=>x.name===v);if(p?.['local-address'])change("server_tunnel_address",p['local-address']);if(p?.['remote-address']&&inventory?.pools.some(x=>x.name===p['remote-address'])){change("pool_mode","existing");change("pool_name",p['remote-address']);}}}} options={items.map(x=>({value:x.name,label:x.name,hint:kind==="pool"?x.ranges:undefined}))}/>}</div>;
 };
 if(authLoading||loading)return <CollectionState loading>جارٍ التحميل...</CollectionState>;
 if(!isMasterAdmin)return <CollectionState>هذه الصفحة خاصة بالمدير الرئيسي للمنصة.</CollectionState>;
 return <div ref={contentRef} dir="rtl" className="space-y-3 text-slate-800 dark:text-slate-200">
 <div className="flex justify-end"><ProjectTooltip label="عرض خوادم الاتصال"><Button variant="back" onClick={()=>router.push('/Dashboard/connection-servers')}><ArrowRight/>عرض الخوادم</Button></ProjectTooltip></div>
 {!viewOnly&&<div className="rl-surface flex flex-wrap items-center gap-3 rounded-[18px] bg-white px-4 py-3 text-xs dark:bg-[#0d243b]"><span className={step===1?"font-bold text-blue-600":"text-slate-500"}>1 · بيانات الاتصال</span><span className={step===2?"font-bold text-blue-600":"text-slate-500"}>2 · إعداد OpenVPN</span></div>}
 {form.id&&(connectionSaved||form.last_checked_at)&&<OvpnHealthCard gatewayId={form.id}/>}
 <section data-scroll-section ref={panelRef} onKeyDown={enterField} key={`${step}-${setupStep}-${review}-${advanced}`} className="ui-state-enter rl-surface overflow-hidden rounded-[22px] bg-white p-4 sm:p-5 dark:bg-[#0d243b]">
 {(step===1||viewOnly)?<><h2 className="mb-4 flex items-center gap-2 font-semibold"><Server className="h-5 w-5 text-blue-500"/>بيانات الاتصال الأساسية</h2><div className="grid gap-4 sm:grid-cols-2">{field("name","اسم الخادم")}{field("api_host","عنوان IP أو الدومين")}{field("api_username","اسم المستخدم")}<label className="space-y-2 text-xs font-medium"><span>كلمة المرور {form.has_api_password?"— اترك فارغة للإبقاء عليها":""}</span>{viewOnly?<p>محفوظة ومشفّرة</p>:<ProjectInput name="api_password" required={!form.has_api_password} aria-invalid={Boolean(fieldErrors.api_password)} aria-describedby={fieldErrors.api_password?"ovpn-error-api_password":undefined} onBlur={e=>validateInput(e.currentTarget,false)} disabled={busy} type="password" autoComplete="new-password" maxLength={512} value={password} onChange={e=>{setFieldErrors(x=>({...x,api_password:""}));setPassword(e.target.value);setVerified("");setInventory(null);}}/>}{fieldErrors.api_password&&<p key={warningVersion} id="ovpn-error-api_password" role="alert" className="ui-field-warning text-xs text-red-600 dark:text-red-400">{fieldErrors.api_password}</p>}</label></div>
 {!viewOnly&&<><Button className="mt-4" variant="ghost" disabled={busy} onClick={()=>setAdvanced(x=>!x)}>خيارات الاتصال المتقدمة</Button>{advanced&&<div className="mt-3 grid gap-4 sm:grid-cols-2">{field("api_port","منفذ API","8728",true)}<div className="space-y-2"><span className="text-xs">طريقة الاتصال</span>{!busy&&<ProjectDropdown value={String(form.api_tls)} onChange={v=>{change("api_tls",v==="true");change("api_port",v==="true"?8729:8728);}} options={[{value:"false",label:"API — شبكة موثوقة"},{value:"true",label:"API مع TLS"}]}/>}</div></div>}<p className="mt-4 text-xs text-slate-500">يلزم تفعيل API على MikroTik. مع TLS نتحقق من شهادة اتصال الإدارة؛ لا علاقة لها بشهادة OpenVPN.</p></>}
 {viewOnly&&<div className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-2">{field("ovpn_host","عنوان OpenVPN")}{field("ovpn_port","المنفذ","",true)}{field("ppp_profile","PPP Profile")}{field("pool_name","IP Pool")}{field("certificate_name","الشهادة")}{field("server_tunnel_address","عنوان الخادم داخل النفق")}</div>}
 </>:<><div className="mb-4 rounded-[16px] bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"><ShieldCheck className="mb-1 h-5 w-5"/>تم حفظ بيانات الاتصال في المنصة والاتصال بـ{inventory?.identity} — RouterOS <bdi>{inventory?.version}</bdi></div>
 {!review&&<div className="space-y-4">
 <p className="text-sm font-semibold">{["طريقة التجهيز","عنوان الخدمة","نطاق العناوين وIP Pool","PPP Profile","شهادة OpenVPN"][setupStep]}</p>
 {setupStep===0&&<><ProjectDropdown value={setupMode} onChange={v=>{setSetupMode(v);setReview(false);}} options={[{value:"automatic",label:"تجهيز تلقائي"},{value:"manual",label:"إعداد يدوي خطوة بخطوة"}]}/><p className="text-xs leading-6 text-slate-500">التلقائي يجهز القيم الافتراضية للعناصر الجديدة ويحتفظ بإعدادات العناصر المطابقة الموجودة. اليدوي يتيح تعديل القيم واختيار عناصر الخادم. في الحالتين تراجع الإعدادات قبل تطبيقها.</p></>}
 {setupStep===1&&<div className="grid gap-4 sm:grid-cols-2">{field("ovpn_host","العنوان الذي ستستخدمه أجهزة NAS")}{field("ovpn_port","منفذ OpenVPN","1194",true)}{setupMode==="manual"&&inventory?.multi&&field("server_name","اسم خدمة OpenVPN")}<p className="text-xs leading-6 text-slate-500 sm:col-span-2">تحقق من أن العنوان قابل للوصول من أجهزة NAS؛ عنوان API المقترح قد يكون محليًا.</p></div>}
 {setupMode==="manual"&&setupStep===2&&<><div className="grid gap-4 sm:grid-cols-2">{field("tunnel_cidr","نطاق الأنفاق — CIDR")}{field("server_tunnel_address","عنوان الخادم داخل النفق")}</div>{selectResource("pool","IP Pool",inventory?.pools??[])}</>}
 {setupMode==="manual"&&setupStep===3&&selectResource("profile","PPP Profile",inventory?.profiles??[])}
 {setupMode==="manual"&&setupStep===4&&selectResource("certificate","شهادة OpenVPN",inventory?.certificates.filter(c=>c.fingerprint&&['true','yes'].includes(c['private-key'])&&!['true','yes'].includes(c.expired)&&!['true','yes'].includes(c.revoked)&&c['key-usage']?.includes('tls-server'))??[])}
 </div>}
 <p className="mt-4 text-xs leading-6 text-slate-500">تُستثنى عناوين الشبكة والبث وعنوان طرف الخادم من الـPool الجديد. إنشاء الشهادة يتضمن إنشاء CA خاصة بها على MikroTik. البروتوكول TCP؛ شهادات العملاء ومسارات الراديوس والجدار الناري تُجهّز ضمن ربط NAS لاحقًا.</p>
 {review&&<div className="mt-5 space-y-2 rounded-[16px] border border-blue-200 p-4 text-sm dark:border-white/10"><h3 className="font-bold">مراجعة قبل التطبيق</h3><p>الخادم: {form.name} — <bdi>{form.api_host}</bdi></p><p>OpenVPN: <bdi>{form.ovpn_host}:{form.ovpn_port}</bdi></p><p>نطاق الأنفاق: <bdi>{form.tunnel_cidr}</bdi> · عنوان الخادم: <bdi>{form.server_tunnel_address}</bdi></p><p>Pool: <bdi>{form.pool_name}</bdi> · {form.pool_mode==="create"?"إنشاء":"استخدام الموجود"}</p><p>Profile: <bdi>{form.ppp_profile}</bdi> · {form.profile_mode==="create"?"إنشاء":"استخدام الموجود"}</p><p>الشهادة: <bdi>{form.certificate_name}</bdi> · {form.certificate_mode==="create"?"إنشاء CA وشهادة خادم":"استخدام الموجودة"}</p><p className="text-xs text-slate-500">سيُفعّل خادم OpenVPN المحدد بإعدادات TCP واشتراط شهادة العميل. تعديل خدمة موجودة قد يؤثر على اتصالاتها؛ التطبيق لا يغير API أو الجدار الناري.</p></div>}
 </>}
 </section>
 {connectionSaved&&step===1&&<p role="status" className="text-xs text-slate-500">بيانات الاتصال محفوظة في المنصة. إعداد MikroTik لم يكتمل بعد.</p>}
 {error&&<p ref={errorRef} key={error} role="alert" className="ui-field-warning rounded-[14px] bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}
 {completed&&<p role="status" className="rounded-[14px] bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">تم تطبيق إعدادات OpenVPN وقراءتها من الخادم وحفظها بنجاح.</p>}
 {!viewOnly&&<div data-scroll-section className="flex scroll-mt-4 flex-wrap justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={()=>router.push('/Dashboard/connection-servers')}>إغلاق</Button>{step===2&&<Button variant="secondary" disabled={busy} onClick={()=>{if(review){setReview(false);}else if(setupStep>0){setSetupStep(x=>x-1);}else{setStep(1);}setError("");}}>السابق</Button>}{step===1?<Button disabled={busy} onClick={inspect}>{busy?"جارٍ فحص الاتصال...":"فحص الاتصال والمتابعة"}</Button>:!verified?<Button disabled={busy} onClick={inspect}>{busy?"جارٍ فحص الاتصال...":"إعادة فحص الاتصال"}</Button>:review?<Button disabled={busy} onClick={apply}><Check/>{busy?"جارٍ التطبيق...":"تطبيق الإعدادات على الخادم"}</Button>:<Button disabled={busy} onClick={nextSetup}>{(setupMode==="automatic"&&setupStep===1)||setupStep===4?"مراجعة الإعدادات":"التالي"}</Button>}</div>}
 <FloatingContentGuide contentRef={contentRef}/>
 </div>;
}
