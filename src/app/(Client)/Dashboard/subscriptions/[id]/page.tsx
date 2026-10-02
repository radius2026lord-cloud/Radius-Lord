"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, CheckCircle2, CreditCard, RefreshCw, UserRound } from "lucide-react";
import { CollectionState } from "@/components/ui/collection-display";
import ProjectTooltip from "@/components/ui/project-tooltip";

type Subscription = {
  id:number; customerId:number; customerName:string; customerUsername:string|null; customerEmail:string;
  paymentCode:string; planName:string; durationMonths:number; deploymentName:string|null;
  basePrice:string; addonsTotal:string; totalAmount:string; currency:string;
  planLimits:{maxTenants:number;maxSubscribers:number;maxNas:number}|null;
  addons:{name:string;price:string|null}[]; status:string; requestedAt:string|null; paidAt:string|null; confirmedBy:string|null;
};
const labels:Record<string,string>={pending:"بانتظار الدفع",awaiting_confirmation:"بانتظار تأكيد الدفع",paid:"تم الدفع",completed:"مكتمل",cancelled:"ملغي",expired:"منتهي"};
const button="inline-flex min-h-10 items-center justify-center gap-2 rounded-[14px] border border-[#bfd4ea] bg-white px-3 text-xs font-semibold text-[#17386d] hover:bg-[#edf4fb] disabled:opacity-50 dark:border-white/[.12] dark:bg-[#30353d] dark:text-white";

export default function SubscriptionDetailsPage(){
  const {id}=useParams<{id:string}>();
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
  return <div className="space-y-4">
    <section className="rl-surface flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-white p-4 dark:bg-[#0d243b]"><div className="min-w-0"><h1 className="flex items-center gap-2 text-base font-semibold text-[#17386d] dark:text-slate-200"><CreditCard className="h-5 w-5 shrink-0 text-[#0758e9]"/>تفاصيل الاشتراك</h1><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">بيانات العميل والخطة وعملية الدفع</p></div><div className="flex flex-wrap items-center gap-2">
      <ProjectTooltip label="العودة إلى عرض الاشتراكات"><Link href="/Dashboard/subscriptions" aria-label="العودة إلى عرض الاشتراكات" className={button}><ArrowRight className="h-4 w-4"/></Link></ProjectTooltip>
      <button type="button" disabled={loading} onClick={()=>setRevision(value=>value+1)} className={button}><RefreshCw className="h-4 w-4"/>تحديث</button>
    </div></section>
    {loading?<CollectionState>جارٍ تحميل تفاصيل الاشتراك...</CollectionState>:error?<CollectionState><span role="alert">{error}</span></CollectionState>:item&&<>
      <section className="rl-surface rounded-[22px] bg-white p-4 sm:p-5 dark:bg-[#0d243b]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3"><CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${item.status==="paid"||item.status==="completed"?"text-emerald-600 dark:text-emerald-300":"text-slate-400"}`}/><div className="min-w-0"><h2 className="text-sm font-semibold text-[#17386d] dark:text-slate-200">{item.status==="paid"?"تم استلام الدفعة — بانتظار تجهيز البيئة":labels[item.status]||item.status}</h2>{item.status==="paid"&&<p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">تُجهّز البيئة وفق الخطة المختارة. تبدأ مدة الاشتراك عند جاهزية البيئة.</p>}</div></div>
          <span className="break-all font-mono text-xs text-[#0758e9] dark:text-[#8fc0ff]" dir="ltr">{item.paymentCode}</span>
        </div>
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel title="بيانات العميل"><dl className="grid gap-4 sm:grid-cols-2"><Field label="الاسم">{item.customerName}</Field><Field label="اسم المستخدم">{item.customerUsername||"—"}</Field><Field label="البريد الإلكتروني">{item.customerEmail}</Field></dl><Link href={`/Dashboard/customers/${item.customerId}?from=subscriptions`} className={`${button} mt-4`}><UserRound className="h-4 w-4"/>عرض ملف العميل</Link></Panel>
        <Panel title="الخطة والاستضافة"><dl className="grid gap-4 sm:grid-cols-2"><Field label="الخطة">{item.planName}</Field><Field label="الاستضافة">{item.deploymentName||"—"}</Field><Field label="مدة الاشتراك">{item.durationMonths} شهر</Field></dl><div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/10"><h3 className="mb-3 text-xs font-semibold">حدود الخطة وقت الشراء</h3>{item.planLimits?<dl className="grid gap-4 sm:grid-cols-3"><Field label="الشبكات">{formatLimit(item.planLimits.maxTenants)}</Field><Field label="المشتركون">{formatLimit(item.planLimits.maxSubscribers)}</Field><Field label="أجهزة NAS">{formatLimit(item.planLimits.maxNas)}</Field></dl>:<p className="text-xs leading-6 text-slate-500 dark:text-slate-400">لم تُحفظ حدود الخطة لهذا الطلب القديم وقت الشراء.</p>}</div><div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/10"><h3 className="mb-3 text-xs font-semibold">الإضافات المختارة</h3>{item.addons.length?<ul className="space-y-3 text-xs">{item.addons.map((addon,index)=><li key={index} className="flex flex-wrap justify-between gap-2"><span className="min-w-0 break-words">{addon.name}</span>{addon.price!==null&&<span dir="ltr">{addon.price} {item.currency}</span>}</li>)}</ul>:<p className="text-xs text-slate-500 dark:text-slate-400">لا توجد إضافات.</p>}</div></Panel>
        <Panel title="تفاصيل الدفع"><dl className="grid gap-4 sm:grid-cols-2"><Field label="قيمة الخطة"><span dir="ltr">{item.basePrice} {item.currency}</span></Field><Field label="قيمة الإضافات"><span dir="ltr">{item.addonsTotal} {item.currency}</span></Field><Field label="الإجمالي"><span dir="ltr">{item.totalAmount} {item.currency}</span></Field><Field label="الحالة">{labels[item.status]||item.status}</Field><Field label="تاريخ الطلب">{formatDate(item.requestedAt)}</Field><Field label="تاريخ تأكيد الدفع">{formatDate(item.paidAt)}</Field><Field label="مسؤول تأكيد الدفع">{item.confirmedBy||"—"}</Field></dl><Link href={`/Dashboard/payments?code=${encodeURIComponent(item.paymentCode)}`} className={`${button} mt-4`}><CreditCard className="h-4 w-4"/>عرض عملية الدفع</Link></Panel>
      </div>
    </>}
  </div>;
}
function Panel({title,children}:{title:string;children:ReactNode}){return <section className="rl-surface min-w-0 rounded-[22px] bg-white p-4 sm:p-5 dark:bg-[#0d243b]"><h2 className="mb-4 text-sm font-semibold text-[#17386d] dark:text-slate-200">{title}</h2>{children}</section>}
function Field({label,children}:{label:string;children:ReactNode}){return <div className="min-w-0"><dt className="text-[11px] text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words text-xs font-semibold text-[#17386d] [overflow-wrap:anywhere] dark:text-slate-200">{children}</dd></div>}
function formatDate(value:string|null){if(!value)return "—";const date=new Date(value);return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("ar",{dateStyle:"medium",timeStyle:"short"}).format(date)}

function formatLimit(value:number){return value===0?"غير محدود":new Intl.NumberFormat("ar").format(value)}
