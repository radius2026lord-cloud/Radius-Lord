"use client";
import {useEffect,useRef,useState} from "react";
import {Activity,Database,Radio,Server,ShieldCheck,RefreshCw,ChevronDown,Clock3} from "lucide-react";
import {useAuth} from "@/components/auth/auth-provider";
import ProjectButton from "@/components/ui/project-button";
import ProjectDropdown from "@/components/ui/project-dropdown";
import FloatingNotice from "@/components/ui/floating-notice";
import {CollectionState} from "@/components/ui/collection-display";

type Row={key:string;kind:string;name:string;host:string;status:string;percent:number|null;checkedAt:string|null;responseMs:number|null;stale:boolean;version?:string;checks:{label:string;passed:boolean;message:string}[];metrics:Record<string,number>};
type Report={rows:Row[];checking:boolean;schedule:{intervalMinutes:number};checkedAt:string|null;nextCheckAt:string|null};
const endpoint="/api/admin/platform-settings/server-readiness";
const labels:Record<string,string>={ready:"جاهز",degraded:"متدهور",unavailable:"تعذر التحقق",not_checked:"لم يُفحص"};
const kinds:Record<string,{label:string;icon:typeof Server}>={database:{label:"MySQL",icon:Database},ssh:{label:"Ubuntu / SSH",icon:Server},radius:{label:"FreeRADIUS",icon:Radio},ovpn:{label:"OpenVPN",icon:ShieldCheck}};
export default function ServerReadinessPage(){
 const {isMasterAdmin,loading}=useAuth();
 const [report,setReport]=useState<Report|null>(null),[error,setError]=useState(""),[message,setMessage]=useState(""),[filter,setFilter]=useState("all"),[busy,setBusy]=useState(false),[expanded,setExpanded]=useState<string[]>([]),[interval,setIntervalValue]=useState("5");
 const refresh=useRef(()=>{}),scheduleDirty=useRef(false);
 useEffect(()=>{if(!isMasterAdmin)return;let disposed=false,pending=false;const controller=new AbortController();
  const read=async()=>{if(pending)return;pending=true;try{const r=await fetch(endpoint,{credentials:"include",cache:"no-store",signal:controller.signal}),j=await r.json();if(!r.ok)throw Error(j.message);if(!disposed){setReport(j);if(!scheduleDirty.current)setIntervalValue(String(j.schedule.intervalMinutes));}}catch(e){if(!disposed)setError(e instanceof Error?e.message:"تعذر قراءة الجاهزية.");}finally{pending=false;}};
  refresh.current=()=>void read();void read();const timer=setInterval(()=>{if(document.visibilityState==="visible")void read();},5000);const focus=()=>{if(document.visibilityState==="visible")void read();};document.addEventListener("visibilitychange",focus);
  return()=>{disposed=true;controller.abort();clearInterval(timer);document.removeEventListener("visibilitychange",focus);refresh.current=()=>{};};
 },[isMasterAdmin]);
 async function action(path:string,body?:unknown){if(busy)return;setBusy(true);setError("");try{const r=await fetch(endpoint+path,{method:body?"PUT":"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined}),j=await r.json();if(!r.ok)throw Error(j.message);if(path==='/schedule')scheduleDirty.current=false;setMessage(j.message??"تم حفظ الفاصل التلقائي.");refresh.current();}catch(e){setError(e instanceof Error?e.message:"تعذر إكمال العملية.");}finally{setBusy(false);}}
 if(loading)return <CollectionState loading>جارٍ التحميل...</CollectionState>;
 if(!isMasterAdmin)return <CollectionState>هذه الصفحة خاصة بالمدير الرئيسي.</CollectionState>;
 const rows=report?.rows??[];
 return <div dir="rtl" className="mx-auto max-w-7xl space-y-5 text-slate-800 dark:text-slate-200">
  <FloatingNotice error={error} message={message} onDismiss={()=>{setError("");setMessage("");}}/>
  <section className="rl-surface rounded-[24px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[.035] sm:p-6">
   <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="flex items-center gap-2 text-lg font-bold"><Activity className="h-5 w-5 text-blue-500"/>جاهزية الخوادم</h1><p className="mt-2 text-xs leading-6 text-slate-500">فحوص تلقائية للخدمات المحفوظة. نسبة اجتياز الفحوص منفصلة عن استهلاك الموارد؛ فحص التوليد الشامل يبقى في صحة البنية التحتية.</p></div><ProjectButton disabled={busy||report?.checking} onClick={()=>void action('/check')}><RefreshCw className={report?.checking?"animate-spin":""}/>{report?.checking?"جارٍ فحص الخوادم...":"فحص الجميع"}</ProjectButton></div>
   <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[{label:"الخدمات المسجلة",count:rows.length,color:"text-blue-500"},{label:"جاهزة",count:rows.filter(r=>r.status==='ready'&&!r.stale).length,color:"text-emerald-500"},{label:"تحتاج متابعة",count:rows.filter(r=>r.status==='degraded'||r.status==='unavailable').length,color:"text-amber-500"},{label:"بانتظار فحص حديث",count:rows.filter(r=>r.stale).length,color:"text-slate-500"}].map(x=><div key={x.label} className="rounded-[17px] bg-slate-50 p-4 dark:bg-white/5"><p className={`text-2xl font-bold ${x.color}`}>{x.count}</p><p className="mt-2 text-xs text-slate-500">{x.label}</p></div>)}</div>
   <div className="mt-5 flex flex-wrap items-end gap-3"><label className="min-w-[160px] flex-1 space-y-2 text-xs"><span>نوع الخدمة</span><ProjectDropdown value={filter} onChange={setFilter} options={[{value:"all",label:"جميع الخدمات"},...Object.entries(kinds).map(([value,k])=>({value,label:k.label}))]}/></label><label className="min-w-[160px] flex-1 space-y-2 text-xs"><span>الفحص التلقائي</span><ProjectDropdown value={interval} onChange={value=>{scheduleDirty.current=true;setIntervalValue(value);}} options={[1,5,10,15,30,60].map(n=>({value:String(n),label:`كل ${n} دقيقة`}))}/></label><ProjectButton variant="secondary" disabled={busy||!report||interval===String(report.schedule.intervalMinutes)} onClick={()=>void action('/schedule',{intervalMinutes:Number(interval)})}>حفظ الفاصل</ProjectButton></div>
   <p className="mt-4 flex items-center gap-2 text-xs leading-6 text-slate-500"><Clock3 className="h-4 w-4"/>{report?.nextCheckAt?`الفحص التالي: ${new Date(report.nextCheckAt).toLocaleString('ar')}`:"سيبدأ الفحص تلقائيًا من الخلفية."}</p>
   <p className="mt-2 text-xs leading-6 text-slate-500">يستمر الفحص مع تشغيل الخلفية حتى عند إغلاق الصفحة. فحص RADIUS يرسل مصادقة ومحاسبة لحساب الاختبار المخصص وقد يظهر في سجلات الخدمة. يشمل الملخص خدمات MySQL وSSH منفصلة حتى لو كانت على الجهاز نفسه.</p>
  </section>
  {!report?<CollectionState loading>جارٍ قراءة نتائج الخوادم...</CollectionState>:!rows.length?<CollectionState>أضف الخوادم واحفظ اتصالاتها لبدء المراقبة التلقائية.</CollectionState>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.filter(r=>filter==='all'||r.kind===filter).map(row=>{
   const kind=kinds[row.kind],Icon=kind.icon,good=row.status==='ready'&&!row.stale,tone=good?'text-emerald-600 bg-emerald-500/10':row.status==='unavailable'?'text-red-500 bg-red-500/10':'text-amber-600 bg-amber-500/10';
   return <article key={row.key} className="rl-surface overflow-hidden rounded-[23px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[.035]">
    <div className="flex items-start gap-3"><span className="rounded-[14px] bg-blue-500/10 p-3 text-blue-500"><Icon className="h-5 w-5"/></span><div className="min-w-0 flex-1"><h2 className="break-words font-bold">{row.name}</h2><p className="mt-1 text-xs text-slate-500">{kind.label}</p><p dir="ltr" className="mt-1 break-all text-xs text-slate-500">{row.host}</p></div><span className={`rounded-full px-2.5 py-1.5 text-[11px] ${tone}`}>{row.stale?'بانتظار التحديث':labels[row.status]}</span></div>
    <div className="mt-5 flex items-center justify-between text-xs"><span>اجتياز الفحوص</span><strong className="text-lg">{row.percent===null?'—':`${row.percent}%`}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className={`h-full rounded-full transition-all ${good?'bg-emerald-500':'bg-amber-500'}`} style={{width:`${row.percent??0}%`}}/></div><p className="mt-2 text-xs text-slate-500">{row.checks.filter(c=>c.passed).length} من {row.checks.length} فحوص ناجحة{row.stale&&' — النتيجة تحتاج تحديثًا'}</p>
    <div className="mt-4 grid grid-cols-2 gap-2">{Object.entries({cpu:'المعالج',memory:'الذاكرة',disk:'القرص',connections:'اتصالات MySQL'}).map(([key,label])=>{const value=row.metrics[key];return <div key={key} className="rounded-xl bg-slate-50 p-2.5 dark:bg-white/5"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-xs font-semibold">{Number.isFinite(value)?`${Math.round(value)}%`:'غير متاح'}</p></div>;})}</div>
    <div className="mt-4 space-y-1 text-[11px] leading-6 text-slate-500"><p>آخر فحص: {row.checkedAt?new Date(row.checkedAt).toLocaleString('ar'):'لم يُفحص'}</p><p>مدة الفحص: {row.responseMs===null?'—':`${row.responseMs} ms`}{row.version&&` · ${row.version}`}</p></div>
    <ProjectButton variant="ghost" className="mt-2 w-full" aria-expanded={expanded.includes(row.key)} onClick={()=>setExpanded(old=>old.includes(row.key)?old.filter(k=>k!==row.key):[...old,row.key])}><ChevronDown className={expanded.includes(row.key)?'rotate-180':''}/>تفاصيل الفحص</ProjectButton>
    {expanded.includes(row.key)&&<ul className="mt-3 space-y-3 border-t border-slate-200 pt-3 dark:border-white/10">{row.checks.map((check,i)=><li key={i} className="text-xs leading-6"><p className={check.passed?'text-emerald-600':'text-red-500'}>{check.passed?'✓':'!'} {check.label}</p><p className="text-slate-500">{check.message}</p></li>)}</ul>}
   </article>;
  })}</div>}
 </div>;
}
