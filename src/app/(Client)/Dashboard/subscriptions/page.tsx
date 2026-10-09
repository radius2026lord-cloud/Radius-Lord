"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, RefreshCw, UserRound } from "lucide-react";
import { CollectionSelectionBox, CollectionCard, CollectionGrid, CollectionMobileCard, CollectionMobileList, CollectionState, CollectionStatusFilters, CollectionTable, CollectionTableBody, CollectionTableHead, CollectionToolbar, collectionRowClass, useCollectionDisplay } from "@/components/ui/collection-display";

import ProjectButton from "@/components/ui/project-button";
import BulkSelectionBar from "@/components/ui/bulk-selection-bar";
import ItemActionsDropdown from "@/components/ui/item-actions-dropdown";

type Status = "awaiting_confirmation" | "paid" | "completed" | "cancelled" | "expired";
type Order = {
  id:number; customerId:number; paymentCode:string; planName:string; deploymentName:string|null;
  totalAmount:number; currency:string; status:Status|"pending"; requestedAt:string; paidAt:string|null;
  environmentStatus?:string|null;customerName:string; customerUsername:string|null; customerEmail:string;
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
  const {view,setView,selected,setSelected,toggle,setAll,selectionMode,setSelectionMode}=useCollectionDisplay<number>("subscriptions","row");

  const load=()=>{
    setLoading(true); setMessage("");
    fetch("/api/billing/admin/subscriptions",{credentials:"include",cache:"no-store"})
      .then(async r=>{const j=await r.json(); if(!r.ok)throw new Error(j.message||"تعذر تحميل الاشتراكات."); setOrders(j.subscriptions??[]);})
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
      return [x.customerName,x.customerUsername,x.customerEmail,x.paymentCode,x.planName,x.deploymentName].filter(Boolean).some(v=>String(v).toLowerCase().includes(q));
    });
  },[orders,query,filter]);

  const allVisibleSelected=filtered.length>0&&filtered.every(o=>selected.has(o.id));
  const toggleAllVisible=()=>setAll(filtered.map(o=>o.id),!allVisibleSelected);

  const confirm=async(o:Order)=>{
    if(busy)return;
    setBusy(o.paymentCode); setMessage("");
    try{
      const r=await fetch("/api/billing/admin/orders/"+encodeURIComponent(o.paymentCode)+"/confirm",{method:"POST",credentials:"include"});
      const j=await r.json(); if(!r.ok)throw new Error(j.message||"تعذر تأكيد الدفع.");
      setOrders(xs=>xs.map(x=>x.id===o.id?{...x,status:"paid",paidAt:j.paidAt}:x));
      setMessage("تم تأكيد استلام الدفعة "+o.paymentCode+".");
    }catch(e:any){setMessage(e.message||"تعذر تأكيد الدفع.");}
    finally{setBusy(null);}
  };

  const openSubscription=(o:Order)=>router.push(`/Dashboard/subscriptions/${o.id}`);
  const openPayment=(o:Order)=>router.push("/Dashboard/payments?code="+encodeURIComponent(o.paymentCode));

  return <div className="space-y-3 sm:space-y-4">
    <CollectionToolbar
      responsive
      icon={CreditCard}
      title="عرض الاشتراكات"
      description="متابعة طلبات الاشتراك والدفع"
      view={view}
      onViewChange={setView}
      selectionMode={selectionMode}
      onSelectionModeChange={enabled=>{setSelectionMode(enabled);if(!enabled)setSelected(new Set());}}
      allSelected={allVisibleSelected}
      onToggleAll={toggleAllVisible}
      query={query}
      onQueryChange={setQuery}
      searchPlaceholder="بحث بالعميل، الخطة أو كود الدفع..."
      filters={<CollectionStatusFilters value={filter} onChange={setFilter} items={[
        {value:"all",label:"الكل",count:counts.all,dot:"bg-[#0758e9]"},
        {value:"awaiting_confirmation",label:"بانتظار التأكيد",count:counts.awaiting_confirmation,dot:"bg-amber-500"},
        {value:"paid",label:"تم الدفع",count:counts.paid,dot:"bg-emerald-500"},
        {value:"completed",label:"مكتمل",count:counts.completed,dot:"bg-blue-500"},
      ]}/>}
      primaryAction={<ProjectButton variant="secondary" disabled={loading||busy!==null} onClick={load}><RefreshCw/>تحديث</ProjectButton>}
    />

    {message&&<div className="rounded-[16px] border border-[#c8d7e6] bg-white px-4 py-3 text-xs dark:border-white/[.10] dark:bg-[#0d243b]">{message}</div>}

    <BulkSelectionBar count={selected.size} noun="الاشتراكات" allSelected={allVisibleSelected} onToggleAll={toggleAllVisible} onClearSelection={()=>setSelected(new Set())}/>

    {loading?<CollectionState loading>جارٍ تحميل الاشتراكات...</CollectionState>:filtered.length===0?<CollectionState>لا توجد طلبات اشتراك مطابقة.</CollectionState>:view==="grid"?<CollectionGrid>{filtered.map(o=><CollectionCard key={o.id} selectionMode={selectionMode} selected={selected.has(o.id)} onToggle={()=>toggle(o.id)} onOpen={()=>openSubscription(o)}>
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.06] dark:text-[#8ab5ff]"><UserRound className="h-5 w-5"/></div>
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{o.customerName}</div><div className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">@{o.customerUsername||"—"}</div></div>
        <div className="flex shrink-0 items-center gap-2">{!selectionMode&&<SubscriptionActions order={o} busy={busy!==null} onOpen={()=>openSubscription(o)} onPayment={()=>openPayment(o)} onConfirm={()=>confirm(o)}/>}</div>
      </div>
      <div className="mt-3"><StatusBadge status={o.status as Status} environmentStatus={o.environmentStatus}/></div>
      <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-white/[.07] dark:text-slate-400">
        <div className="flex items-center justify-between gap-3"><b className="min-w-0 break-words text-slate-700 dark:text-slate-200">{o.planName}</b><span className="shrink-0">{o.deploymentName||"—"}</span></div>
        <div className="flex items-center justify-between gap-3"><span className="break-all font-mono text-[10px] text-[#0758e9]" dir="ltr">{o.paymentCode}</span><b className="text-[#17386d] dark:text-white">{o.totalAmount} {o.currency}</b></div>
        <div className="flex items-center justify-between gap-3"><span>تاريخ الطلب</span><span>{formatDate(o.requestedAt)}</span></div>
      </div>
    </CollectionCard>)}</CollectionGrid>:<>
      <CollectionTable minWidth="760px">
        <CollectionTableHead><tr><th className="w-12 p-3 text-center"><CollectionSelectionBox checked={allVisibleSelected} onChange={toggleAllVisible} label="تحديد كل الاشتراكات الظاهرة"/></th><th className="p-3">العميل</th><th>الخطة</th><th>الإجمالي</th><th>الحالة</th><th>التاريخ</th><th className="w-14 text-center">إجراء</th></tr></CollectionTableHead>
        <CollectionTableBody>{filtered.map(o=><tr key={o.id} onClick={()=>openSubscription(o)} className={collectionRowClass(selected.has(o.id))}>
          <td className="w-12 p-3 text-center" onClick={e=>e.stopPropagation()}><CollectionSelectionBox checked={selected.has(o.id)} onChange={()=>toggle(o.id)} label={`تحديد اشتراك ${o.customerName}`}/></td>
          <td className="p-3"><b className="block text-[#17386d] dark:text-[#d8d2dc]">{o.customerName}</b><span className="text-[10px] text-slate-400"><bdi>{o.paymentCode}</bdi></span></td>
          <td className="p-3"><b className="block">{o.planName}</b><span className="mt-1 block text-[11px] text-slate-400">{o.deploymentName||"—"}</span></td>
          <td className="font-bold">{o.totalAmount} {o.currency}</td><td><StatusBadge status={o.status as Status} environmentStatus={o.environmentStatus}/></td><td>{formatDate(o.requestedAt)}</td>
          <td className="w-14 text-center"><SubscriptionActions order={o} busy={busy!==null} onOpen={()=>openSubscription(o)} onPayment={()=>openPayment(o)} onConfirm={()=>confirm(o)}/></td>
        </tr>)}</CollectionTableBody>
      </CollectionTable>
      <CollectionMobileList>{filtered.map(o=><CollectionMobileCard key={o.id} onOpen={()=>openSubscription(o)}>
        <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.06]"><UserRound className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="break-words text-sm font-semibold">{o.customerName}</div><div className="mt-1 text-[11px] text-slate-500">{o.planName}</div></div><SubscriptionActions order={o} busy={busy!==null} onOpen={()=>openSubscription(o)} onPayment={()=>openPayment(o)} onConfirm={()=>confirm(o)}/></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><StatusBadge status={o.status as Status} environmentStatus={o.environmentStatus}/><bdi className="text-xs font-semibold">{o.totalAmount} {o.currency}</bdi></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-400 dark:border-white/10"><bdi className="break-all font-mono">{o.paymentCode}</bdi><span>{formatDate(o.requestedAt)}</span></div>
      </CollectionMobileCard>)}</CollectionMobileList>
    </>}

  </div>;
}

function SubscriptionActions({order,busy,onOpen,onPayment,onConfirm}:{order:Order;busy:boolean;onOpen:()=>void;onPayment:()=>void;onConfirm:()=>void}){
  return <ItemActionsDropdown show={{view:true,payment:true,confirmPayment:order.status==="awaiting_confirmation"&&!busy}} handlers={{view:onOpen,payment:onPayment,confirmPayment:onConfirm}}/>;
}

function StatusBadge({status,environmentStatus}:{status:Status;environmentStatus?:string|null}){const m=meta[status]||meta.awaiting_confirmation;return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${m.tone}`}><i className="h-1.5 w-1.5 rounded-full bg-current"/>{["paid","completed"].includes(status)?environmentStatus==="ready"?"تم الدفع — البيئة جاهزة":environmentStatus==="failed"?"تم الدفع — التجهيز يحتاج معالجة":environmentStatus==="provisioning"?"تم الدفع — جارٍ تجهيز البيئة":"تم الدفع — بانتظار تجهيز البيئة":m.label}</span>}
function formatDate(value:string){return new Intl.DateTimeFormat("ar",{year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value))}
