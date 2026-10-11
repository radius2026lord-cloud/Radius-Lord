"use client";

import {useEffect,useState,useRef,type ReactNode} from "react";
import {CheckCircle2,CalendarDays,CreditCard,ExternalLink,Package,Server,Users,Wifi,RotateCw} from "lucide-react";
import FloatingContentGuide from "@/components/ui/floating-content-guide";
import ProjectButton from "@/components/ui/project-button";
import ProjectLoading from "@/components/ui/project-loading";
import {ProjectInfoCard,ProjectCardIcon} from "@/components/ui/project-info-card";

type Subscription={id:number;paymentCode:string;planName:string;durationMonths:number;deploymentName:string;limits:{maxTenants:number;maxSubscribers:number;maxNas:number}|null;addons:{nameAr?:string;name_ar?:string;code?:string}[];totalAmount:string;currency:string;paidAt:string|null;subscriptionStatus:string|null;startsAt:string|null;expiresAt:string|null;networkName:string|null;environmentStatus:string;systemUrl:string|null};
const date=(value:string|null)=>{if(!value)return "لم تبدأ بعد";const d=new Date(value);return Number.isNaN(d.getTime())?"غير متاح":new Intl.DateTimeFormat("ar",{dateStyle:"medium"}).format(d);};
const limit=(value:unknown)=>typeof value==="number"&&Number.isSafeInteger(value)&&value>=0?(value===0?"غير محدود":String(value)):"بانتظار المراجعة";
function safeUrl(value:string|null){try{const url=new URL(value||"");return ["http:","https:"].includes(url.protocol)?url.href:null;}catch{return null;}}

export default function CustomerSubscriptionDashboard({welcome}:{welcome:ReactNode}){
 const contentRef=useRef<HTMLDivElement>(null);
 const [items,setItems]=useState<Subscription[]|null>(null),[error,setError]=useState(""),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let alive=true,busy=false;const controller=new AbortController();
  const load=async()=>{if(busy)return;busy=true;try{const response=await fetch("/api/billing/subscriptions/mine",{credentials:"include",cache:"no-store",signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.message||"تعذر تحميل معلومات الاشتراك.");if(alive){setItems(data.subscriptions||[]);setError("");}}catch(e){if(alive)setError(e instanceof Error?e.message:"تعذر تحميل معلومات الاشتراك.");}finally{busy=false;}};
  void load();const timer=window.setInterval(()=>{if(!document.hidden)void load();},15000);const focus=()=>void load();window.addEventListener("focus",focus);
  return()=>{alive=false;controller.abort();window.clearInterval(timer);window.removeEventListener("focus",focus);};
 },[refresh]);
 if(items===null)return <div className="p-6" dir="rtl">{error?<ProjectInfoCard tone="danger"><p role="alert">{error}</p><ProjectButton className="mt-4" onClick={()=>{setError("");setRefresh(x=>x+1);}}>إعادة المحاولة<RotateCw/></ProjectButton></ProjectInfoCard>:<ProjectLoading>جارٍ التحقق من حالة اشتراكك...</ProjectLoading>}</div>;
 if(!items.length)return <>{welcome}{error&&<p role="alert" className="p-4 text-center text-sm text-red-500">تعذر تحديث حالة الاشتراك؛ أعد تحميل الصفحة.</p>}</>;
 return <div ref={contentRef} dir="rtl" className="mx-auto w-full max-w-6xl space-y-5 p-4 text-[#17386d] dark:text-slate-100 sm:p-7">
  <ProjectInfoCard tone="success" className="flex items-start gap-4"><ProjectCardIcon icon={CheckCircle2} tone="success"/><div><h1 className="text-xl font-bold">تم تأكيد الدفع، شكرًا لاشتراكك</h1><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">هذه معلومات اشتراكك المعتمدة عند الشراء. تتحدث حالة تجهيز شبكتك تلقائيًا.</p></div></ProjectInfoCard>
  {error&&<ProjectInfoCard tone="warning"><p role="status" className="text-sm">تعذر تحديث المعلومات. نعرض آخر بيانات تم تحميلها.</p><ProjectButton variant="secondary" className="mt-3" onClick={()=>setRefresh(x=>x+1)}>تحديث<RotateCw/></ProjectButton></ProjectInfoCard>}
  {items.slice(0,1).map(item=>{
   const url=safeUrl(item.systemUrl),status=item.environmentStatus;
   const state=status==='archived'?'البيئة مؤرشفة':(item.subscriptionStatus==='expired'||Boolean(item.expiresAt&&new Date(item.expiresAt).getTime()<=Date.now()))?'انتهى الاشتراك':status==='failed'?'التجهيز يحتاج متابعة من الإدارة':status==='ready'?'تم تجهيز البيئة':status==='provisioning'?'جارٍ تجهيز بيئتك':'بانتظار تجهيز البيئة';
   return <section key={item.id} className="space-y-4 rounded-[24px] border border-white/90 bg-white p-4 shadow-[0_8px_22px_rgba(58,84,112,.08)] dark:border-white/[.07] dark:bg-[#302e33] sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{item.planName}</h2><p className="mt-1 text-xs text-slate-500">{item.networkName||"اشتراكك في Radius Lord"}</p></div><span className="rounded-full bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-300">الدفع مكتمل</span></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
     <ProjectInfoCard tone="success"><ProjectCardIcon icon={CreditCard} tone="success"/><h3 className="mt-2 text-xs text-slate-500">المبلغ المدفوع</h3><p className="mt-1 font-bold" dir="ltr">{item.totalAmount} {item.currency}</p><p className="mt-2 text-xs">تاريخ التأكيد: {item.paidAt?date(item.paidAt):"غير مسجل"}</p><p className="mt-2 break-all text-xs" dir="ltr">{item.paymentCode}</p></ProjectInfoCard>
     <ProjectInfoCard tone="memory"><ProjectCardIcon icon={CalendarDays} tone="memory"/><h3 className="mt-2 text-xs text-slate-500">مدة الاشتراك</h3><p className="mt-1 font-bold">{item.durationMonths?`${item.durationMonths} شهر`:"بانتظار المراجعة"}</p><p className="mt-2 text-xs">البداية: {date(item.startsAt)}</p><p className="mt-2 text-xs">النهاية: {date(item.expiresAt)}</p></ProjectInfoCard>
     <ProjectInfoCard tone="connections"><ProjectCardIcon icon={Server} tone="connections"/><h3 className="mt-2 text-xs text-slate-500">نوع الاستضافة</h3><p className="mt-1 font-bold">{item.deploymentName||"غير محدد"}</p></ProjectInfoCard>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">{[{label:"الشبكات",value:item.limits?.maxTenants,icon:Server},{label:"المشتركون",value:item.limits?.maxSubscribers,icon:Users},{label:"بوابات NAS",value:item.limits?.maxNas,icon:Wifi}].map(field=><ProjectInfoCard key={field.label}><div className="flex items-center gap-2"><ProjectCardIcon icon={field.icon}/><span className="text-sm">{field.label}</span></div><p className="mt-3 text-lg font-bold">{limit(field.value)}</p></ProjectInfoCard>)}</div>
    {item.addons.length>0&&<ProjectInfoCard tone="memory"><div className="flex items-center gap-2"><ProjectCardIcon icon={Package} tone="memory"/><h3 className="text-sm font-semibold">الإضافات المختارة</h3></div><ul className="mt-3 flex flex-wrap gap-2">{item.addons.map((addon,index)=><li key={index} className="rounded-lg bg-violet-500/10 px-3 py-2 text-xs">{addon.nameAr||addon.name_ar||addon.code}</li>)}</ul></ProjectInfoCard>}
    <ProjectInfoCard tone={status==='failed'?'warning':url?'success':'pending'}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{state}</h3><p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">{url?'شبكتك جاهزة. يمكنك الدخول باستخدام بيانات التفعيل المرسلة إليك.':status==='archived'?'تمت أرشفة هذه البيئة مع الاحتفاظ بسجل الدفع.':item.startsAt?'بيانات الفترة المعتمدة موضحة أعلاه.':'يبدأ احتساب فترة الاشتراك بعد اكتمال تجهيز البيئة وتفعيلها.'}</p></div>{url&&<a href={url} className="inline-flex items-center gap-2 rounded-[14px] bg-[#0758e9] px-5 py-3 text-xs font-semibold text-white">الدخول إلى شبكتي<ExternalLink className="h-4 w-4"/></a>}</div></ProjectInfoCard>
   </section>;
  })}
  <FloatingContentGuide contentRef={contentRef}/>
 </div>;
}
