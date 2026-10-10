"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, CreditCard, RefreshCw, UserRound, Server, LoaderCircle, Package, CalendarClock, Cloud, Network, UsersRound, Router, Layers, Send, Database, ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";
import { CollectionState } from "@/components/ui/collection-display";
import SubscriptionPaymentHistory from "@/components/subscription-payment-history";
import ProjectButton from "@/components/ui/project-button";
import FloatingNotice from "@/components/ui/floating-notice";
import {ProjectInfoCard} from "@/components/ui/project-info-card";
import ProjectTooltip from "@/components/ui/project-tooltip";

type Environment = {
  registered:boolean;canRequest:boolean;canSendDetails?:boolean;blockedReason:string|null;tenantId?:number;subscriptionId?:number;
  networkName?:string;licenseNumber?:string;licenseStatus?:string;subscriptionStatus?:string;
  startsAt?:string|null;expiresAt?:string|null;status?:string;systemUrl?:string|null;readyAt?:string|null;
  health?:{databaseName:string|null;reportedAt:string|null;lastSeenAt:string|null;databaseStatus:string;radiusStatus:string};
  job?:{id:number;status:string;currentStep:string|null;attemptCount:number;errorCode:string|null;steps?:Array<{step_code:string;status:string;error_code:string|null}>}|null;
};
type Subscription = {
  environment:Environment;
  id:number; customerId:number; customerName:string; customerUsername:string|null; customerEmail:string;
  paymentCode:string; planName:string; durationMonths:number; deploymentName:string|null;
  basePrice:string; addonsTotal:string; totalAmount:string; currency:string;
  planLimits:{maxTenants:number;maxSubscribers:number;maxNas:number}|null;
  addons:{name:string;price:string|null}[]; status:string; requestedAt:string|null; paidAt:string|null; confirmedBy:string|null;
};

export default function SubscriptionDetailsPage(){
  const {id}=useParams<{id:string}>();
  const router=useRouter();
  const [infrastructureWarning,setInfrastructureWarning]=useState("");
  const [delivery,setDelivery]=useState<{text:string;whatsappUrl:string|null;emailUrl:string|null}|null>(null);
  const [submitting,setSubmitting]=useState(false),[notice,setNotice]=useState(""),[actionError,setActionError]=useState("");
  const [item,setItem]=useState<Subscription|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError("");setItem(null);setDelivery(null);
    fetch(`/api/billing/admin/subscriptions/${encodeURIComponent(id)}`,{credentials:"include",cache:"no-store",signal:controller.signal})
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.message||"تعذر تحميل تفاصيل الاشتراك.");if(!controller.signal.aborted)setItem(data.subscription);})
      .catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"تعذر تحميل تفاصيل الاشتراك.");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[id,revision]);
  useEffect(()=>{if(!item?.environment.job||!["queued","running"].includes(item.environment.job.status))return;const controller=new AbortController();let active=false;const timer=setInterval(async()=>{if(active)return;active=true;try{const r=await fetch(`/api/billing/admin/subscriptions/${encodeURIComponent(id)}`,{credentials:"include",cache:"no-store",signal:controller.signal});if(r.ok){const j=await r.json();if(!controller.signal.aborted)setItem(j.subscription);}}catch{/* Keep last state; manual refresh remains available. */}finally{active=false;}},5000);return()=>{clearInterval(timer);controller.abort();};},[id,item?.environment.job?.status]);
  const infrastructureBlocked=Boolean(item?.environment.blockedReason?.startsWith('افحص صحة البنية التحتية')||item?.environment.job?.errorCode==='INFRASTRUCTURE_NOT_READY');
  useEffect(()=>{if(infrastructureBlocked)setInfrastructureWarning("لا يمكن توليد البيئة قبل نجاح فحوص البنية التحتية. افتح صفحة التحقق لمعالجة الخدمات غير الجاهزة ثم أعد المحاولة.");else setInfrastructureWarning("");},[infrastructureBlocked]);
  async function sendDetails(){if(submitting||item?.environment.status!=="ready")return;setSubmitting(true);setActionError("");setNotice("");try{const r=await fetch(`/api/billing/admin/subscriptions/${encodeURIComponent(id)}/environment/send-details`,{method:"POST",credentials:"include"}),j=await r.json();if(!r.ok)throw new Error(j.message);setNotice(j.message);setDelivery(j);}catch(e){setActionError(e instanceof Error?e.message:"تعذر طلب الإرسال.");}finally{setSubmitting(false);}}
  async function requestEnvironment(){
    if(submitting || !item?.environment.canRequest)return;
    setSubmitting(true);setNotice("");setActionError("");
    try{
      const response=await fetch(`/api/billing/admin/subscriptions/${encodeURIComponent(id)}/environment`,{method:"POST",credentials:"include"});
      const data=await response.json();
      if(!response.ok){if(data.code==='INFRASTRUCTURE_NOT_READY'||data.message?.includes('صحة البنية التحتية')){setInfrastructureWarning(data.message||"البنية التحتية غير جاهزة للتوليد.");return;}throw new Error(data.message||"تعذر تسجيل طلب إنشاء البيئة.");}
      setItem(current=>current?{...current,environment:data.environment}:current);
      setNotice("تم تسجيل طلب إنشاء البيئة. مدة الاشتراك لم تبدأ بعد.");
    }catch(reason){setActionError(reason instanceof Error?reason.message:"تعذر تسجيل طلب إنشاء البيئة.");}
    finally{setSubmitting(false);}
  }
  return <div className="space-y-4">
    <FloatingNotice error={actionError} warning={infrastructureWarning} message={notice} action={infrastructureWarning?{label:"فتح صحة البنية التحتية",onClick:()=>router.push('/Dashboard/infrastructure-health')}:undefined} onDismiss={()=>{setActionError("");setInfrastructureWarning("");setNotice("");}}/>
    <section className="rl-surface flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-white p-4 dark:bg-[#0d243b]"><div className="min-w-0"><h1 className="flex items-center gap-2 text-base font-semibold text-[#17386d] dark:text-slate-200"><CreditCard className="h-5 w-5 shrink-0 text-[#0758e9]"/>تفاصيل الاشتراك</h1><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">بيانات العميل والخطة وعملية الدفع</p></div><div className="flex flex-wrap items-center gap-2">
      <ProjectTooltip label="العودة إلى عرض الاشتراكات"><ProjectButton variant="back" size="icon" aria-label="العودة إلى عرض الاشتراكات" onClick={()=>router.push("/Dashboard/subscriptions")}><ArrowRight/></ProjectButton></ProjectTooltip>
      <ProjectButton variant="secondary" disabled={loading||submitting} onClick={()=>setRevision(value=>value+1)}><RefreshCw/>تحديث</ProjectButton>
    </div></section>
    {loading?<CollectionState loading>جارٍ تحميل تفاصيل الاشتراك...</CollectionState>:error?<CollectionState><span role="alert">{error}</span></CollectionState>:item&&<>
      {delivery&&<Panel title="بيانات التسليم اليدوي"><p className="mb-3 text-xs text-slate-500">راجع المستلم قبل الإرسال؛ فتح الرابط لا يثبت تسليم الرسالة.</p><pre className="whitespace-pre-wrap break-words rounded-xl bg-slate-500/5 p-3 text-sm">{delivery.text}</pre><div className="mt-3 flex flex-wrap gap-3">{delivery.whatsappUrl&&<a className="text-sm text-blue-500" href={delivery.whatsappUrl} target="_blank" rel="noopener noreferrer">فتح مسودة واتساب</a>}{delivery.emailUrl&&<a className="text-sm text-blue-500" href={delivery.emailUrl}>فتح مسودة البريد</a>}<ProjectButton variant="secondary" onClick={()=>setDelivery(null)}>إخفاء البيانات</ProjectButton></div></Panel>}
      {Boolean(item.environment.job?.steps?.length)&&<Panel title="مراحل تجهيز البيئة"><div className="grid gap-2 sm:grid-cols-2">{item.environment.job!.steps!.map(step=><div key={step.step_code} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-500/5 p-3 text-xs"><span>{stepLabels[step.step_code]??step.step_code}</span><span className={step.status==="success"?"text-emerald-600":step.status==="failed"?"text-red-500":"text-blue-500"}>{step.status==="success"?"نجحت":step.status==="failed"?"فشلت":step.status==="running"?"جارٍ التنفيذ":"بانتظار التنفيذ"}</span></div>)}</div></Panel>}
      <Panel title="حالة البيئة">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#17386d] dark:text-slate-200"><Server className="h-5 w-5 shrink-0 text-violet-500"/>{environmentLabel(item.environment,item.status)}</p>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-500 dark:text-slate-400">{environmentDescription(item.environment,item.status)}</p>
          </div>
          <ProjectTooltip label={item.environment.blockedReason?"راجع حالة البيئة":"تسجيل طلب إنشاء البيئة"}>
            <ProjectButton disabled={submitting||!item.environment.canRequest} onClick={()=>void requestEnvironment()} className="min-h-10 w-full sm:w-auto">
              {submitting?<LoaderCircle className="animate-spin"/>:<Server/>}{submitting?"جارٍ تسجيل الطلب...":item.environment.job?.status==="failed"?"معالجة فشل التجهيز وإعادة المحاولة":"إنشاء البيئة"}
            </ProjectButton>
          </ProjectTooltip>
        </div>
        {(infrastructureBlocked||infrastructureWarning)&&<ProjectInfoCard tone="warning" className="mt-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 flex-1"><p className="flex items-center gap-2 text-sm font-semibold"><TriangleAlert className="h-5 w-5 shrink-0 text-amber-500"/>التوليد متوقف حتى اكتمال التحقق</p><p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">تحقق من الخدمات في صفحة صحة البنية التحتية، ثم عد إلى الاشتراك وحدّث الحالة لإعادة المحاولة.</p></div><ProjectButton variant="secondary" onClick={()=>router.push('/Dashboard/infrastructure-health')}><ShieldCheck className="text-amber-500"/>فتح صفحة التحقق</ProjectButton></div></ProjectInfoCard>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {item.environment.canSendDetails&&<ProjectTooltip label="إرسال رابط واجهة العميل وبيانات الدخول والخطة والرخصة بعد التفعيل"><ProjectButton variant="secondary" disabled={submitting||item.environment.status!=="ready"||item.environment.subscriptionStatus!=="active"||!item.environment.systemUrl} onClick={()=>void sendDetails()}><Send className="text-emerald-500"/>إرسال بيانات التفعيل للعميل</ProjectButton></ProjectTooltip>}
          {item.environment.status==="ready"&&item.environment.systemUrl&&<ProjectButton variant="secondary" onClick={()=>{const u=new URL(item.environment.systemUrl!,window.location.origin);if(["http:","https:"].includes(u.protocol))window.open(u.href,"_blank","noopener,noreferrer");}}><ExternalLink className="text-blue-500"/>فتح واجهة الشبكة</ProjectButton>}
        </div>
        {item.environment.registered&&<div className="mt-4 rounded-[14px] border border-slate-100 p-3 dark:border-white/10"><p className="flex items-center gap-2 text-sm font-semibold"><Database className={item.environment.health?.databaseStatus==="healthy"?"text-emerald-500":"text-amber-500"}/>اتصال قاعدة بيانات البيئة</p><p className="mt-2 text-xs text-slate-500">{item.environment.health?.databaseStatus==="healthy"?"آخر قراءة مسجلة: الاتصال سليم":item.environment.health?.databaseStatus==="unavailable"?"فشل اتصال البيئة بقاعدة البيانات؛ يحتاج إلى معالجة":item.environment.health?.databaseStatus==="degraded"?"آخر قراءة مسجلة: الاتصال يحتاج مراجعة":"لم يصل تحقق فعلي من اتصال البيئة بعد"}</p><p className="mt-1 text-xs text-slate-400">اسم القاعدة: <bdi>{item.environment.health?.databaseName||"لم تُنشأ بعد"}</bdi> · وقت آخر تقرير: {formatDate(item.environment.health?.reportedAt||null)}</p></div>}
        {item.environment.registered&&<dl className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 dark:border-white/10 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="الشبكة">{item.environment.networkName||"—"}</Field>
          <Field label="رقم الرخصة"><bdi className="font-mono">{item.environment.licenseNumber||"—"}</bdi></Field>
          <Field label="بداية الاشتراك">{item.environment.startsAt?formatDate(item.environment.startsAt):"بعد جاهزية البيئة"}</Field>
          <Field label="انتهاء الاشتراك">{formatDate(item.environment.expiresAt||null)}</Field>
        </dl>}

      </Panel>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="الخطة المختارة">
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-[18px] bg-gradient-to-l from-blue-50 to-indigo-50/50 p-4 dark:from-blue-500/10 dark:to-indigo-500/5">
            <div className="flex min-w-0 flex-1 items-start gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"><Package className="h-6 w-6"/></span><div className="min-w-0"><h3 className="break-words text-base font-bold text-[#17386d] dark:text-slate-200">{item.planName}</h3><p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">بيانات الخطة المحفوظة عند الشراء</p></div></div>
            <div className="min-w-0"><p className="text-[10px] text-slate-500 dark:text-slate-400">قيمة الخطة</p><p className="mt-1 text-lg font-bold text-blue-600 dark:text-blue-300"><bdi>{item.basePrice} {item.currency}</bdi></p></div>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2"><PlanMetric label="الاستضافة" icon={<Cloud className="h-5 w-5 text-cyan-500"/>}>{item.deploymentName||"—"}</PlanMetric><PlanMetric label="مدة الاشتراك" icon={<CalendarClock className="h-5 w-5 text-amber-500"/>}>{item.durationMonths} شهر</PlanMetric></dl>
          <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/10"><h3 className="mb-3 text-xs font-semibold">السعة المشمولة</h3>
            {item.planLimits?<dl className="grid gap-3 sm:grid-cols-3"><PlanMetric label="الشبكات" icon={<Network className="h-5 w-5 text-blue-500"/>}>{formatLimit(item.planLimits.maxTenants)}</PlanMetric><PlanMetric label="حسابات PPPoE" icon={<UsersRound className="h-5 w-5 text-emerald-500"/>}>{formatLimit(item.planLimits.maxSubscribers)}</PlanMetric><PlanMetric label="أجهزة NAS" icon={<Router className="h-5 w-5 text-violet-500"/>}>{formatLimit(item.planLimits.maxNas)}</PlanMetric></dl>:<p className="text-xs leading-6 text-slate-500 dark:text-slate-400">لم تُحفظ حدود الخطة لهذا الطلب القديم.</p>}
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/10"><h3 className="mb-3 flex items-center gap-2 text-xs font-semibold"><Layers className="h-4 w-4 text-violet-500"/>الإضافات المختارة</h3>
            {item.addons.length?<ul className="divide-y divide-slate-100 text-xs dark:divide-white/10">{item.addons.map((addon,index)=><li key={index} className="flex flex-wrap items-start justify-between gap-2 py-2"><span className="min-w-0 break-words">{addon.name}</span>{addon.price!==null&&<bdi className="shrink-0">{addon.price} {item.currency}</bdi>}</li>)}</ul>:<p className="text-xs text-slate-500 dark:text-slate-400">لا توجد إضافات.</p>}
          </div>
        </Panel>
        <Panel title="بيانات العميل">
          <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-blue-50 text-blue-500 dark:bg-blue-500/10"><UserRound className="h-5 w-5"/></span><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-[#17386d] dark:text-slate-200">{item.customerName}</p>{item.customerUsername&&<p className="mt-1 text-xs text-slate-400"><bdi>@{item.customerUsername}</bdi></p>}</div></div>
          <dl className="mt-4 border-t border-slate-100 pt-4 dark:border-white/10"><Field label="البريد الإلكتروني">{item.customerEmail}</Field></dl>
          <ProjectButton variant="secondary" className="mt-4 w-full sm:w-auto" onClick={()=>router.push(`/Dashboard/customers/${item.customerId}?from=subscriptions`)}><UserRound className="text-blue-500"/>عرض ملف العميل</ProjectButton>
        </Panel>
      </div>
      <SubscriptionPaymentHistory orderId={item.id}/>
    </>}
  </div>;
}
function Panel({title,children}:{title:string;children:ReactNode}){return <section className="rl-surface min-w-0 rounded-[22px] bg-white p-4 sm:p-5 dark:bg-[#0d243b]"><h2 className="mb-4 text-sm font-semibold text-[#17386d] dark:text-slate-200">{title}</h2>{children}</section>}
function Field({label,children}:{label:string;children:ReactNode}){return <div className="min-w-0"><dt className="text-[11px] text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words text-xs font-semibold text-[#17386d] [overflow-wrap:anywhere] dark:text-slate-200">{children}</dd></div>}
function formatDate(value:string|null){if(!value)return "—";const date=new Date(value);return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("ar",{dateStyle:"medium",timeStyle:"short"}).format(date)}

function formatLimit(value:number){return value===0?"غير محدود":new Intl.NumberFormat("ar").format(value)}

const stepLabels:Record<string,string>={infrastructure_preflight:"صحة البنية التحتية",hosting_preflight:"الوصول للمنصة",database_create:"إنشاء قاعدة الشبكة",database_template:"تهيئة جداول الشبكة",database_users:"حسابات اتصال القاعدة",database_verify:"التحقق من القاعدة",network_manager:"إنشاء مدير الشبكة",network_license:"الرخصة وحدود الخطة",network_radius:"ربط RADIUS بقاعدة الشبكة",network_radius_verify:"المصادقة والمحاسبة",network_database_isolation:"عزل قاعدة الشبكة",network_application_verify:"دخول المدير عبر المنصة",environment_activation:"تفعيل البيئة وبدء الاشتراك"};
function environmentLabel(environment:Environment,paymentStatus:string){
  if(!["paid","completed"].includes(paymentStatus))return "التجهيز متاح بعد تأكيد الدفع";
  if(environment.job?.status==="queued")return "تم الدفع — بانتظار تجهيز البيئة";
  if(environment.job?.status==="running")return "جارٍ تجهيز البيئة";
  if(environment.status==="ready")return "البيئة جاهزة";
  if(environment.job?.errorCode==="ENVIRONMENT_BOOTSTRAP_PENDING")return "تم الدفع — قاعدة البيئة جاهزة وبانتظار استكمال التهيئة";
  if(environment.job?.status==="failed"||environment.status==="failed")return "تم الدفع — التجهيز يحتاج معالجة";
  return ["paid","completed"].includes(paymentStatus)?"تم الدفع — بانتظار تجهيز البيئة":environment.registered?"بانتظار إنشاء البيئة":"لم يُثبت سجل البيئة بعد";
}

function environmentDescription(environment:Environment,paymentStatus:string){
  if(environment.job?.errorCode==="HOSTING_SETTINGS_REQUIRED")return "احفظ إعدادات الوصول للمخدم المحلي من إعدادات المنصة ثم أعد محاولة التجهيز. لم تبدأ مدة الاشتراك.";
  if(environment.job?.errorCode==="HOSTING_SETTINGS_INVALID")return "راجع IP المخدم ومنفذ التطبيق أو إعدادات الدومين المحفوظة، ثم أعد محاولة التجهيز. لم تبدأ مدة الاشتراك.";
  if(environment.job?.errorCode==="ENVIRONMENT_BOOTSTRAP_PENDING")return "أُنشئت قاعدة الشبكة وحسابا الاتصال وتم التحقق منهما. تبقى تهيئة حساب المدير وبيانات الاشتراك وخدمة RADIUS قبل التفعيل؛ مدة الاشتراك لم تبدأ.";
  if(environment.job?.errorCode)return `توقفت مرحلة التجهيز: ${environment.job.currentStep||"التحقق"} · رمز المشكلة: ${environment.job.errorCode}. لم تبدأ مدة الاشتراك.`;
  if(environment.status==="ready")return "البيئة جاهزة. يُتحقق من اتصال NAS بعد تطبيق سكربت الربط.";
  if(environment.job?.status==="queued")return "طلب الإنشاء مسجل وبانتظار بدء التنفيذ. مدة الاشتراك لم تبدأ بعد.";
  if(environment.job?.status==="running")return "يجري تجهيز البيئة وفق بيانات الشراء. تبدأ مدة الاشتراك بعد تحقق الجاهزية.";
  if(environment.blockedReason)return environment.blockedReason;
  if(!["paid","completed"].includes(paymentStatus))return "أكد استلام الدفعة أولًا للمتابعة.";
  return "الدفعة مؤكدة. يمكنك طلب إنشاء البيئة وفق الخطة المحفوظة عند الشراء.";
}

function PlanMetric({label,icon,children}:{label:string;icon:ReactNode;children:ReactNode}){
  return <div className="flex min-w-0 items-start gap-3 rounded-[14px] border border-slate-100 bg-slate-50/60 p-3 dark:border-white/[.06] dark:bg-white/[.025]"><span className="mt-0.5 shrink-0">{icon}</span><div className="min-w-0"><dt className="text-[10px] text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-[#17386d] dark:text-slate-200">{children}</dd></div></div>;
}
