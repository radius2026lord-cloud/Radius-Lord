"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, ExternalLink, RefreshCw } from "lucide-react";
import { CollectionMobileCard, CollectionMobileList, CollectionState, CollectionStatusFilters, CollectionTable, CollectionTableBody, CollectionTableHead, CollectionToolbar, collectionRowClass, useCollectionDisplay } from "@/components/ui/collection-display";

type Status = "awaiting_confirmation" | "paid" | "completed" | "cancelled" | "expired";
type Order = {
  id:number; paymentCode:string; purpose:string; planName:string; deploymentName:string|null;
  totalAmount:number; currency:string; status:Status|"pending"; requestedAt:string; paidAt:string|null;
  customerName:string; customerEmail:string;
};

const meta:Record<Status,{label:string;tone:string}> = {
  awaiting_confirmation:{label:"بانتظار التأكيد",tone:"bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"},
  paid:{label:"تم الدفع",tone:"bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"},
  completed:{label:"مكتمل",tone:"bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"},
  cancelled:{label:"ملغي",tone:"bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"},
  expired:{label:"منتهي",tone:"bg-slate-100 text-slate-600 dark:bg-white/[.06] dark:text-slate-300"},
};

export default function SubscriptionsPage(){
  const router=useRouter();
  const [orders,setOrders]=useState<Order[]>([]);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<"all"|Status>("all");
  const [busy,setBusy]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const {view,setView,selectionMode,setSelectionMode}=useCollectionDisplay<number>("subscriptions","row");

  const load=()=>{
    setLoading(true); setMessage("");
    fetch("/api/billing/admin/orders",{credentials:"include",cache:"no-store"})
      .then(async r=>{const j=await r.json(); if(!r.ok)throw new Error(j.message||"تعذر تحميل الاشتراكات."); setOrders((j.paymentOrders??[]).filter((x:Order)=>x.purpose==="initial_subscription"&&x.status!=="pending"));})
      .catch(e=>setMessage(e.message||"تعذر تحميل الاشتراكات."))
      .finally(()=>setLoading(false));
  };
  useEffect(()=>{load()},[]);

  const counts=useMemo(()=>({
    all:orders.length,
    awaiting_confirmation:orders.filter(x=>x.status==="awaiting_confirmation").length,
    paid:orders.filter(x=>x.status==="paid").length,
    completed:orders.filter(x=>x.status==="completed").length,
  }),[orders]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return orders.filter(x=>{
      if(filter!=="all"&&x.status!==filter)return false;
      if(!q)return true;
      return [x.customerName,x.customerEmail,x.paymentCode,x.planName,x.deploymentName].filter(Boolean).some(v=>String(v).toLowerCase().includes(q));
    });
  },[orders,query,filter]);

  const confirm=async(o:Order)=>{
    if(busy)return;
    setBusy(o.paymentCode); setMessage("");
    try{
      const r=await fetch("/api/billing/admin/orders/"+encodeURIComponent(o.paymentCode)+"/confirm",{method:"POST",credentials:"include"});
      const j=await r.json(); if(!r.ok)throw new Error(j.message||"تعذر تأكيد الدفع.");
      setOrders(xs=>xs.map(x=>x.id===o.id?{...x,status:"paid",paidAt:new Date().toISOString()}:x));
      setMessage("تم تأكيد استلام الدفعة "+o.paymentCode+".");
    }catch(e:any){setMessage(e.message||"تعذر تأكيد الدفع.");}
    finally{setBusy(null);}
  };

  const openPayment=(o:Order)=>router.push("/Dashboard/payments?code="+encodeURIComponent(o.paymentCode));

  return <div className="space-y-3 sm:space-y-4">
    <CollectionToolbar
      icon={CreditCard}
      title="عرض الاشتراكات"
      description="طلبات الاشتراك التي انتقل أصحابها فعليًا إلى مرحلة إتمام الدفع"
      view={view}
      onViewChange={setView}
      selectionMode={selectionMode}
      onSelectionModeChange={setSelectionMode}
      query={query}
      onQueryChange={setQuery}
      searchPlaceholder="بحث بالعميل، الخطة أو كود الدفع..."
      filters={<CollectionStatusFilters value={filter} onChange={setFilter} items={[
        {value:"all",label:"الكل",count:counts.all,dot:"bg-[#0758e9]"},
        {value:"awaiting_confirmation",label:"بانتظار التأكيد",count:counts.awaiting_confirmation,dot:"bg-amber-500"},
        {value:"paid",label:"تم الدفع",count:counts.paid,dot:"bg-emerald-500"},
        {value:"completed",label:"مكتمل",count:counts.completed,dot:"bg-blue-500"},
      ]}/>}
      primaryAction={<button type="button" onClick={load} className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#bfd4ea] bg-white px-3 text-xs font-semibold text-[#17386d] hover:bg-[#edf4fb] dark:border-white/[.12] dark:bg-[#30353d] dark:text-white"><RefreshCw className="h-4 w-4"/>تحديث</button>}
    />

    {message&&<div className="rounded-[16px] border border-[#c8d7e6] bg-white px-4 py-3 text-xs dark:border-white/[.10] dark:bg-[#0d243b]">{message}</div>}

    {loading?<CollectionState>جارٍ تحميل الاشتراكات...</CollectionState>:filtered.length===0?<CollectionState>لا توجد طلبات اشتراك مطابقة.</CollectionState>:<>
      <CollectionTable minWidth="980px">
        <CollectionTableHead><tr><th className="p-3">العميل</th><th>الخطة</th><th>الاستضافة</th><th>كود الدفع</th><th>الإجمالي</th><th>الحالة</th><th>التاريخ</th><th className="p-3 text-center">إجراء</th></tr></CollectionTableHead>
        <CollectionTableBody>{filtered.map(o=><tr key={o.id} onClick={()=>openPayment(o)} className={collectionRowClass(false)}>
          <td className="p-3"><b className="block text-[#17386d] dark:text-[#d8d2dc]">{o.customerName}</b><span className="text-[10px] text-slate-400">{o.customerEmail}</span></td>
          <td><b>{o.planName}</b></td>
          <td>{o.deploymentName||"—"}</td>
          <td className="font-mono text-[11px] font-bold text-[#0758e9]" dir="ltr">{o.paymentCode}</td>
          <td className="font-bold">{o.totalAmount} {o.currency}</td>
          <td><StatusBadge status={o.status as Status}/></td>
          <td>{formatDate(o.requestedAt)}</td>
          <td className="p-3 text-center" onClick={e=>e.stopPropagation()}><div className="inline-flex gap-2">
            {o.status==="awaiting_confirmation"&&<button disabled={busy===o.paymentCode} onClick={()=>confirm(o)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-[10px] font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4"/>{busy===o.paymentCode?"جارٍ التأكيد...":"تأكيد الدفع"}</button>}
            <button onClick={()=>openPayment(o)} className="grid h-9 w-9 place-items-center rounded-xl border border-[#bfd4ea] bg-white text-[#0758e9] dark:border-white/[.12] dark:bg-white/[.04]" aria-label="عرض عملية الدفع"><ExternalLink className="h-4 w-4"/></button>
          </div></td>
        </tr>)}</CollectionTableBody>
      </CollectionTable>
      <CollectionMobileList>{filtered.map(o=><CollectionMobileCard key={o.id} onOpen={()=>openPayment(o)}><div className="flex items-center gap-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{o.customerName}</div><div className="mt-1 truncate text-[10px] text-slate-500">{o.planName} · {o.paymentCode}</div></div><StatusBadge status={o.status as Status}/></div><div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-white/[.07]"><span>{o.totalAmount} {o.currency}</span><span>{formatDate(o.requestedAt)}</span></div></CollectionMobileCard>)}</CollectionMobileList>
    </>}
  </div>;
}

function StatusBadge({status}:{status:Status}){const m=meta[status]||meta.awaiting_confirmation;return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${m.tone}`}><i className="h-1.5 w-1.5 rounded-full bg-current"/>{m.label}</span>}
function formatDate(value:string){return new Intl.DateTimeFormat("ar",{year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value))}
