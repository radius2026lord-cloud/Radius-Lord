"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, CreditCard, RefreshCw, UserRound, Server, LoaderCircle } from "lucide-react";
import { CollectionState } from "@/components/ui/collection-display";
import ProjectButton from "@/components/ui/project-button";
import ProjectTooltip from "@/components/ui/project-tooltip";

type Environment = {
  registered:boolean;canRequest:boolean;blockedReason:string|null;tenantId?:number;subscriptionId?:number;
  networkName?:string;licenseNumber?:string;licenseStatus?:string;subscriptionStatus?:string;
  startsAt?:string|null;expiresAt?:string|null;status?:string;systemUrl?:string|null;readyAt?:string|null;
  job?:{id:number;status:string;currentStep:string|null;attemptCount:number;errorCode:string|null}|null;
};
type Subscription = {
  environment:Environment;
  id:number; customerId:number; customerName:string; customerUsername:string|null; customerEmail:string;
  paymentCode:string; planName:string; durationMonths:number; deploymentName:string|null;
  basePrice:string; addonsTotal:string; totalAmount:string; currency:string;
  planLimits:{maxTenants:number;maxSubscribers:number;maxNas:number}|null;
  addons:{name:string;price:string|null}[]; status:string; requestedAt:string|null; paidAt:string|null; confirmedBy:string|null;
};
const labels:Record<string,string>={pending:"بانتظار الدفع",awaiting_confirmation:"بانتظار تأكيد الدفع",paid:"تم الدفع",completed:"مكتمل",cancelled:"ملغي",expired:"منتهي"};

export default function SubscriptionDetailsPage(){
  const {id}=useParams<{id:string}>();
  const router=useRouter();
  const [submitting,setSubmitting]=useState(false),[notice,setNotice]=useState(""),[actionError,setActionError]=useState("");
  const [item,setItem]=useState<Subscription|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError("");setItem(null);
    fetch(`/api/billing/admin/subscriptions/${encodeURIComponent(id)}`,{credentials:"include",cache:"no-store",signal:controller.signal})
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.message||"تعذر تحميل تفاصيل الاشتراك.");if(!controller.signal.aborted)setItem(data.subscription);})
      .catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"تعذر تحميل تفاصيل الاشتراك.");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[id,revision]);
  async function requestEnvironment(){
    if(submitting || !item?.environment.canRequest)return;
    setSubmitting(true);setNotice("");setActionError("");
    try{
      const response=await fetch(`/api/billing/admin/subscriptions/${encodeURIComponent(id)}/environment`,{method:"POST",credentials:"include"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.message||"تعذر تسجيل طلب إنشاء البيئة.");
      setItem(current=>current?{...current,environment:data.environment}:current);
      setNotice("تم تسجيل طلب إنشاء البيئة. مدة الاشتراك لم تبدأ بعد.");
    }catch(reason){setActionError(reason instanceof Error?reason.message:"تعذر تسجيل طلب إنشاء البيئة.");}
    finally{setSubmitting(false);}
  }
  return <div className="space-y-4">
    <section className="rl-surface flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-white p-4 dark:bg-[#0d243b]"><div className="min-w-0"><h1 className="flex items-center gap-2 text-base font-semibold text-[#17386d] dark:text-slate-200"><CreditCard className="h-5 w-5 shrink-0 text-[#0758e9]"/>تفاصيل الاشتراك</h1><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">بيانات العميل والخطة وعملية الدفع</p></div><div className="flex flex-wrap items-center gap-2">
      <ProjectTooltip label="العودة إلى عرض الاشتراكات"><ProjectButton variant="back" size="icon" aria-label="العودة إلى عرض الاشتراكات" onClick={()=>router.push("/Dashboard/subscriptions")}><ArrowRight/></ProjectButton></ProjectTooltip>
      <ProjectButton variant="secondary" disabled={loading||submitting} onClick={()=>setRevision(value=>value+1)}><RefreshCw/>تحديث</ProjectButton>
    </div></section>
    {loading?<CollectionState>جارٍ تحميل تفاصيل الاشتراك...</CollectionState>:error?<CollectionState><span role="alert">{error}</span></CollectionState>:item&&<>
      <Panel title="حالة البيئة">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#17386d] dark:text-slate-200"><Server className="h-5 w-5 shrink-0 text-violet-500"/>{environmentLabel(item.environment,item.status)}</p>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-500 dark:text-slate-400">{environmentDescription(item.environment,item.status)}</p>
          </div>
          <ProjectTooltip label={item.environment.blockedReason?"راجع حالة البيئة":"تسجيل طلب إنشاء البيئة"}>
            <ProjectButton disabled={submitting||!item.environment.canRequest} onClick={()=>void requestEnvironment()} className="min-h-10 w-full sm:w-auto">
              {submitting?<LoaderCircle className="animate-spin"/>:<Server/>}{submitting?"جارٍ تسجيل الطلب...":item.environment.job?.status==="failed"?"إعادة طلب إنشاء البيئة":"إنشاء البيئة"}
            </ProjectButton>
          </ProjectTooltip>
        </div>
        {item.environment.registered&&<dl className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 dark:border-white/10 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="الشبكة">{item.environment.networkName||"—"}</Field>
          <Field label="رقم الرخصة"><bdi className="font-mono">{item.environment.licenseNumber||"—"}</bdi></Field>
          <Field label="بداية الاشتراك">{item.environment.startsAt?formatDate(item.environment.startsAt):"بعد جاهزية البيئة"}</Field>
          <Field label="انتهاء الاشتراك">{formatDate(item.environment.expiresAt||null)}</Field>
        </dl>}
        {notice&&<p role="status" className="mt-3 rounded-[14px] bg-emerald-50 p-3 text-xs leading-6 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</p>}
        {actionError&&<p role="alert" className="mt-3 rounded-[14px] bg-red-50 p-3 text-xs leading-6 text-red-600 dark:bg-red-500/10 dark:text-red-300">{actionError}</p>}
      </Panel>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="الخطة والاستضافة">
          <dl className="grid gap-4 sm:grid-cols-3"><Field label="الخطة">{item.planName}</Field><Field label="الاستضافة">{item.deploymentName||"—"}</Field><Field label="المدة">{item.durationMonths} شهر</Field></dl>
          <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/10">
            <h3 className="mb-3 text-xs font-semibold">حدود الخطة وقت الشراء</h3>
            {item.planLimits?<dl className="grid gap-4 sm:grid-cols-3"><Field label="الشبكات">{formatLimit(item.planLimits.maxTenants)}</Field><Field label="حسابات PPPoE">{formatLimit(item.planLimits.maxSubscribers)}</Field><Field label="أجهزة NAS">{formatLimit(item.planLimits.maxNas)}</Field></dl>:<p className="text-xs leading-6 text-slate-500 dark:text-slate-400">لم تُحفظ حدود الخطة لهذا الطلب القديم.</p>}
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/10"><h3 className="mb-3 text-xs font-semibold">الإضافات</h3>
            {item.addons.length?<ul className="divide-y divide-slate-100 text-xs dark:divide-white/10">{item.addons.map((addon,index)=><li key={index} className="flex flex-wrap items-start justify-between gap-2 py-2"><span className="min-w-0 break-words">{addon.name}</span>{addon.price!==null&&<bdi className="shrink-0">{addon.price} {item.currency}</bdi>}</li>)}</ul>:<p className="text-xs text-slate-500 dark:text-slate-400">لا توجد إضافات.</p>}
          </div>
        </Panel>
        <Panel title="العميل والدفع">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-[#17386d] dark:text-slate-200">{item.customerName}</p><p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{item.customerEmail}</p>{item.customerUsername&&<p className="mt-1 text-xs text-slate-400"><bdi>@{item.customerUsername}</bdi></p>}</div><ProjectTooltip label="عرض ملف العميل"><ProjectButton variant="ghost" size="icon" aria-label="عرض ملف العميل" onClick={()=>router.push(`/Dashboard/customers/${item.customerId}?from=subscriptions`)}><UserRound className="text-blue-500"/></ProjectButton></ProjectTooltip></div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/10"><div><p className="text-[11px] text-slate-500">إجمالي الدفعة</p><p className="mt-1 text-lg font-bold text-[#17386d] dark:text-slate-200"><bdi>{item.totalAmount} {item.currency}</bdi></p></div><span className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${["paid","completed"].includes(item.status)?"bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300":"bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"}`}>{labels[item.status]||item.status}</span></div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="قيمة الخطة"><bdi>{item.basePrice} {item.currency}</bdi></Field><Field label="قيمة الإضافات"><bdi>{item.addonsTotal} {item.currency}</bdi></Field><Field label="كود الدفع"><bdi className="font-mono">{item.paymentCode}</bdi></Field><Field label="تاريخ الطلب">{formatDate(item.requestedAt)}</Field><Field label="تأكيد الدفع">{formatDate(item.paidAt)}</Field><Field label="مسؤول التأكيد">{item.confirmedBy||"—"}</Field></dl>
          <ProjectButton variant="secondary" className="mt-4 w-full sm:w-auto" onClick={()=>router.push(`/Dashboard/payments?code=${encodeURIComponent(item.paymentCode)}`)}><CreditCard className="text-emerald-500"/>عرض عملية الدفع</ProjectButton>
        </Panel>
      </div>
    </>}
  </div>;
}
function Panel({title,children}:{title:string;children:ReactNode}){return <section className="rl-surface min-w-0 rounded-[22px] bg-white p-4 sm:p-5 dark:bg-[#0d243b]"><h2 className="mb-4 text-sm font-semibold text-[#17386d] dark:text-slate-200">{title}</h2>{children}</section>}
function Field({label,children}:{label:string;children:ReactNode}){return <div className="min-w-0"><dt className="text-[11px] text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words text-xs font-semibold text-[#17386d] [overflow-wrap:anywhere] dark:text-slate-200">{children}</dd></div>}
function formatDate(value:string|null){if(!value)return "—";const date=new Date(value);return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("ar",{dateStyle:"medium",timeStyle:"short"}).format(date)}

function formatLimit(value:number){return value===0?"غير محدود":new Intl.NumberFormat("ar").format(value)}

function environmentLabel(environment:Environment,paymentStatus:string){
  if(!["paid","completed"].includes(paymentStatus))return "التجهيز متاح بعد تأكيد الدفع";
  if(environment.job?.status==="queued")return "طلب الإنشاء بانتظار التنفيذ";
  if(environment.job?.status==="running")return "جارٍ تجهيز البيئة";
  if(environment.status==="ready")return "البيئة جاهزة";
  if(environment.job?.status==="failed"||environment.status==="failed")return "تعذر تجهيز البيئة";
  return environment.registered?"بانتظار إنشاء البيئة":"لم يُثبت سجل البيئة بعد";
}

function environmentDescription(environment:Environment,paymentStatus:string){
  if(environment.status==="ready")return "البيئة جاهزة. يُتحقق من اتصال NAS بعد تطبيق سكربت الربط.";
  if(environment.job?.status==="queued")return "طلب الإنشاء مسجل وبانتظار بدء التنفيذ. مدة الاشتراك لم تبدأ بعد.";
  if(environment.job?.status==="running")return "يجري تجهيز البيئة وفق بيانات الشراء. تبدأ مدة الاشتراك بعد تحقق الجاهزية.";
  if(environment.blockedReason)return environment.blockedReason;
  if(!["paid","completed"].includes(paymentStatus))return "أكد استلام الدفعة أولًا للمتابعة.";
  return "الدفعة مؤكدة. يمكنك طلب إنشاء البيئة وفق الخطة المحفوظة عند الشراء.";
}
