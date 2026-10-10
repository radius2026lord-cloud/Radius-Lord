"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Activity,ShieldCheck} from "lucide-react";
import {useAuth} from "@/components/auth/auth-provider";
import {CollectionState} from "@/components/ui/collection-display";
import ProjectButton from "@/components/ui/project-button";
import ProjectDropdown from "@/components/ui/project-dropdown";
type Selection={databaseServerId:string;radiusServerId:string;gatewayId:string;radiusSshServerId:string};
type Choice={id:number;name:string};
type Check={key:string;label:string;status:"ready"|"failed"|"not_checked";message:string;checkedAt:string};
type Report={checkedAt:string;ready:boolean;stale?:boolean;checks:Check[]};
const endpoint="/api/admin/platform-settings/infrastructure-health";
const empty:Selection={databaseServerId:"",radiusServerId:"",gatewayId:"",radiusSshServerId:""};
const expected=[{key:"hosting",label:"استضافة المنصة"},{key:"database",label:"MySQL والصلاحيات والسعة"},{key:"radius_service",label:"خدمة FreeRADIUS وإعداداتها"},{key:"radius",label:"مصادقة ومحاسبة FreeRADIUS"},{key:"ovpn",label:"بوابة OpenVPN وإعداداتها وسعتها"}];
export default function InfrastructureHealthPage(){
 const {isMasterAdmin,loading:authLoading}=useAuth();
 const [selection,setSelection]=useState<Selection>(empty),[choices,setChoices]=useState<{databases:Choice[];radius:Choice[];gateways:Choice[]}>({databases:[],radius:[],gateways:[]});
 const [report,setReport]=useState<Report|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[dirty,setDirty]=useState(false),[now,setNow]=useState(Date.now());
 async function load(){setLoading(true);setError("");try{const r=await fetch(endpoint,{credentials:"include",cache:"no-store"}),j=await r.json();if(!r.ok)throw new Error(j.message);setChoices(j);setSelection(j.selection?Object.fromEntries(Object.entries(j.selection).map(([k,v])=>[k,String(v)])) as Selection:empty);setReport(j.report);setDirty(false);}catch(e){setError(e instanceof Error?e.message:"تعذر تحميل الفحص.");}finally{setLoading(false);}}
 useEffect(()=>{if(isMasterAdmin)void load();},[isMasterAdmin]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 async function run(){if(busy)return;setBusy(true);setError("");setReport(null);try{
  if(dirty){const saved=await fetch(endpoint,{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(selection)});const j=await saved.json();if(!saved.ok)throw new Error(j.message);setDirty(false);}
  const r=await fetch(`${endpoint}/check`,{method:"POST",credentials:"include"}),j=await r.json();if(!r.ok)throw new Error(j.message);setReport(j.report);setNow(Date.now());
 }catch(e){setError(e instanceof Error?e.message:"تعذر إكمال الفحص.");}finally{setBusy(false);}}
 const age=report?now-new Date(report.checkedAt).getTime():Infinity;
 const ready=Boolean(report?.ready&&!report.stale&&!dirty&&age>=0&&age<60000);
 if(authLoading||loading&&isMasterAdmin)return <CollectionState loading>جارٍ تحميل البنية التحتية...</CollectionState>;
 if(!isMasterAdmin)return <CollectionState>هذه الصفحة خاصة بالمدير الرئيسي.</CollectionState>;
 const fields:Array<{key:keyof Selection;label:string;options:Choice[]}>= [{key:"databaseServerId",label:"خادم قواعد البيانات للتوليد",options:choices.databases},{key:"radiusServerId",label:"خادم FreeRADIUS للاختبار",options:choices.radius},{key:"radiusSshServerId",label:"اتصال SSH المحفوظ لمخدم FreeRADIUS",options:choices.databases},{key:"gatewayId",label:"بوابة OpenVPN",options:choices.gateways}];
 return <div dir="rtl" className="mx-auto max-w-6xl space-y-4 text-slate-800 dark:text-slate-200">
  <section className="rl-surface space-y-4 rounded-[22px] border border-slate-200 bg-white p-4 sm:p-6 dark:border-white/10 dark:bg-white/[.035]">
   <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5 text-blue-500"/>صحة البنية التحتية</h1><p className="mt-2 text-sm text-slate-500">فحص إلزامي قبل توليد بيئات الكلاود المشتركة. الخلفية تعيد الفحص عند الطلب وقبل إنشاء الموارد.</p></div><span role="status" className={`rounded-full px-3 py-1.5 text-xs font-semibold ${ready?"bg-emerald-500/10 text-emerald-600":"bg-amber-500/10 text-amber-600"}`}>{ready?"جاهزة للتوليد":busy?"جارٍ الفحص":"التوليد غير متاح"}</span></div>
   <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">{fields.map(f=><div key={f.key}><p className="mb-2 text-sm font-medium">{f.label}</p><ProjectDropdown value={selection[f.key]} onChange={value=>{if(busy)return;setSelection(s=>({...s,[f.key]:value}));setDirty(true);setReport(null);}} options={f.options.map(o=>({value:String(o.id),label:o.name}))}/></div>)}</fieldset>
   <p className="text-xs leading-6 text-slate-500">اختر اتصال SSH الذي حفظته لمخدم Ubuntu الذي يعمل عليه FreeRADIUS. فحص الإعدادات يحتاج صلاحية sudo دون طلب كلمة مرور. حساب RADIUS وقاعدة الاختبار المستقلة يُحددان في صفحة خوادم FreeRADIUS؛ استخدم حسابًا مخصصًا للفحص.</p>
   <div className="flex flex-wrap items-center gap-3"><ProjectButton disabled={busy||Object.values(selection).some(v=>!v)} onClick={()=>void run()}><Activity/>{busy?"جارٍ فحص الخدمات...":dirty?"حفظ الاختيار وفحص البنية التحتية":"فحص البنية التحتية"}</ProjectButton><ProjectButton variant="secondary" disabled={busy} onClick={()=>void load()}>تحديث الحالة</ProjectButton><Link className="text-sm text-blue-500" href="/Dashboard/radius-servers">إعداد اختبار FreeRADIUS</Link></div>
   {error&&<p role="alert" className="rounded-[14px] bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
   {report&&<p className="text-xs text-slate-500">آخر فحص: {new Date(report.checkedAt).toLocaleString("ar")} — {ready?`صالح لمدة ${Math.max(0,Math.ceil((60000-age)/1000))} ثانية`:report.stale||age>=60000?"انتهت صلاحية النتيجة؛ أعد الفحص.":"أكمل الشروط الفاشلة ثم أعد الفحص."}</p>}
  </section>
  <div className="grid gap-3 sm:grid-cols-2">{expected.map(item=>{const check=report?.checks.find(c=>c.key===item.key);const status=check?.status??"not_checked";return <section key={item.key} className="rl-surface rounded-[18px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.035]"><div className="flex items-start justify-between gap-3"><h2 className="text-sm font-semibold">{item.label}</h2><span className={`shrink-0 rounded-full px-2 py-1 text-xs ${status==="ready"?"bg-emerald-500/10 text-emerald-600":status==="failed"?"bg-red-500/10 text-red-600":"bg-slate-500/10 text-slate-500"}`}>{status==="ready"?"جاهزة":status==="failed"?"فاشلة":"لم تُفحص"}</span></div><p className="mt-3 text-sm leading-6 text-slate-500">{check?.message??"تظهر نتيجة الخدمة بعد تنفيذ الفحص."}</p>{check&&<p className="mt-2 text-xs text-slate-400">{new Date(check.checkedAt).toLocaleString("ar")}</p>}</section>;})}</div>
  <p className="text-xs leading-6 text-slate-500">نجاح البنية التحتية يتيح بدء التجهيز. تفعيل الزبون وبدء مدة اشتراكه وإرسال بياناته يتطلب فحص بيئته وربطها وعزلها وتجربة نفق OpenVPN بعد التجهيز.</p>
 </div>;
}
