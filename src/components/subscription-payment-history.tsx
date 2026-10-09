"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, ReceiptText, ChevronDown, LoaderCircle } from "lucide-react";
import { CollectionTable, CollectionTableHead, CollectionTableBody, CollectionMobileList, CollectionMobileCard, CollectionState, collectionRowClass } from "@/components/ui/collection-display";
import ProjectButton from "@/components/ui/project-button";
import ProjectTooltip from "@/components/ui/project-tooltip";

type Payment={id:number;paymentCode:string;purpose:string;planName:string;basePrice:string;addonsTotal:string;totalAmount:string;currency:string;status:string;requestedAt:string|null;paidAt:string|null;confirmedBy:string|null};
const purposes:Record<string,string>={initial_subscription:"اشتراك جديد",renewal:"تجديد اشتراك",upgrade:"تغيير الخطة",addon_purchase:"شراء إضافة"};
const labels:Record<string,string>={pending:"بانتظار الدفع",awaiting_confirmation:"بانتظار التأكيد",paid:"تم الدفع",completed:"مكتمل",cancelled:"ملغي",expired:"منتهي"};
export default function SubscriptionPaymentHistory({orderId}:{orderId:number}){
  const router=useRouter(),request=useRef<AbortController|null>(null);
  const [payments,setPayments]=useState<Payment[]>([]),[cursor,setCursor]=useState<number|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(""),[scope,setScope]=useState("order");
  async function load(before?:number){
    request.current?.abort();const controller=new AbortController();request.current=controller;setBusy(true);setError("");
    try{
      const response=await fetch(`/api/billing/admin/subscriptions/${orderId}/payments${before?`?before=${before}`:""}`,{credentials:"include",cache:"no-store",signal:controller.signal});
      const data=await response.json();if(!response.ok)throw new Error(data.message||"تعذر تحميل سجل الدفعات.");
      if(controller.signal.aborted)return;
      setPayments(current=>before?[...current,...data.payments.filter((p:Payment)=>!current.some(old=>old.id===p.id))]:data.payments);
      setCursor(data.nextCursor);setScope(data.scope);
    }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"تعذر تحميل سجل الدفعات.");}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  useEffect(()=>{setPayments([]);setCursor(null);void load();return()=>request.current?.abort();},[orderId]);
  const open=(p:Payment)=>router.push(`/Dashboard/payments?code=${encodeURIComponent(p.paymentCode)}`);
  const action=(p:Payment)=><ProjectTooltip label="عرض عملية الدفع"><ProjectButton variant="ghost" size="icon" aria-label={`عرض عملية الدفع ${p.paymentCode}`} onClick={e=>{e.stopPropagation();open(p);}}><ReceiptText className="text-emerald-500"/></ProjectButton></ProjectTooltip>;
  return <section className="min-w-0 space-y-3">
    <div className="flex items-start gap-3 px-1"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"><CreditCard className="h-5 w-5"/></span><div><h2 className="text-sm font-semibold text-[#17386d] dark:text-slate-200">سجل عمليات الدفع</h2><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{scope==="network"?"دفعات هذه الشبكة، من الأحدث إلى الأقدم.":"دفعات هذا الطلب؛ تظهر بقية دفعات الشبكة بعد تثبيت الربط."}</p></div></div>
    {busy&&!payments.length?<CollectionState loading>جارٍ تحميل سجل الدفعات...</CollectionState>:!payments.length&&!error?<CollectionState>لا توجد عمليات دفع.</CollectionState>:payments.length>0&&<>
      <CollectionTable minWidth="800px"><CollectionTableHead><tr>{["العملية","الخطة","المبلغ","الحالة","التاريخ والتأكيد","عرض"].map(label=><th key={label} className="p-3">{label}</th>)}</tr></CollectionTableHead><CollectionTableBody>{payments.map(p=><tr key={p.id} className={collectionRowClass()} onClick={()=>open(p)}><td className="p-3"><b className="block">{purposes[p.purpose]||p.purpose}</b><bdi className="mt-1 block font-mono text-[10px] text-slate-400">{p.paymentCode}</bdi></td><td className="max-w-48 break-words p-3">{p.planName}</td><td className="p-3"><bdi className="block font-semibold">{p.totalAmount} {p.currency}</bdi><span className="mt-1 block text-[10px] text-slate-400">الخطة <bdi>{p.basePrice}</bdi> · الإضافات <bdi>{p.addonsTotal}</bdi></span></td><td className="p-3"><PaymentStatus status={p.status}/></td><td className="p-3"><span className="block">{formatDate(p.paidAt||p.requestedAt)}</span><span className="mt-1 block text-[10px] text-slate-400">{p.confirmedBy||"لم يؤكد الدفع بعد"}</span></td><td className="p-3">{action(p)}</td></tr>)}</CollectionTableBody></CollectionTable>
      <CollectionMobileList>{payments.map(p=><CollectionMobileCard key={p.id} onOpen={()=>open(p)}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold">{purposes[p.purpose]||p.purpose}</p><p className="mt-1 break-words text-xs text-slate-500">{p.planName}</p></div>{action(p)}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><bdi className="text-sm font-semibold">{p.totalAmount} {p.currency}</bdi><PaymentStatus status={p.status}/></div><p className="mt-2 text-[10px] text-slate-400">الخطة <bdi>{p.basePrice}</bdi> · الإضافات <bdi>{p.addonsTotal}</bdi></p><div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-400 dark:border-white/10"><bdi className="break-all font-mono">{p.paymentCode}</bdi><span>{formatDate(p.paidAt||p.requestedAt)}</span></div><p className="mt-1 text-[10px] text-slate-400">{p.confirmedBy||"لم يؤكد الدفع بعد"}</p></CollectionMobileCard>)}</CollectionMobileList>
    </>}
    {error&&<div role="alert" className="rounded-[14px] bg-red-50 p-3 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}<ProjectButton variant="ghost" disabled={busy} className="ms-2" onClick={()=>void load(payments.length&&cursor?cursor:undefined)}>إعادة المحاولة</ProjectButton></div>}
    {cursor&&payments.length>0&&!error&&<div className="flex justify-center"><ProjectButton variant="secondary" disabled={busy} onClick={()=>void load(cursor)}>{busy?<LoaderCircle className="animate-spin"/>:<ChevronDown/>}{busy?"جارٍ التحميل...":"عرض دفعات أقدم"}</ProjectButton></div>}
  </section>;
}
function PaymentStatus({status}:{status:string}){const tone=["paid","completed"].includes(status)?"bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300":status==="cancelled"?"bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300":status==="expired"?"bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400":"bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${tone}`}>{labels[status]||status}</span>}
function formatDate(value:string|null){if(!value)return "—";const date=new Date(value);return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("ar",{dateStyle:"medium",timeStyle:"short"}).format(date)}
