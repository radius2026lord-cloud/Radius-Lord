"use client";
import { useEffect, useMemo, useState } from "react";
import { CreditCard, Plus, Search, Server, Star, Users, Wifi } from "lucide-react";
import { useRouter } from "next/navigation";
import { CollectionDisplayControls, CollectionGrid, CollectionGridSelectionMark, CollectionSelectionBar, CollectionSelectionBox, collectionCardClass, useCollectionDisplay } from "@/components/ui/collection-display";

type Plan={id:number;name:string;durationMonths:number;maxTenants:number;maxSubscribers:number;maxNas:number;price:number;currency:string;description:string|null;isFeatured:boolean;status:"active"|"inactive"|"disabled"};
const empty={name:"",durationMonths:1,maxTenants:1,maxSubscribers:0,maxNas:0,price:0,currency:"USD",description:"",isFeatured:false,status:"active" as const};
export default function PlansPage(){
 const router=useRouter();
 const [plans,setPlans]=useState<Plan[]>([]),[loading,setLoading]=useState(true),[query,setQuery]=useState("");
 const {view,setView,selected,setSelected,selectionMode,setSelectionMode,toggle,setAll}=useCollectionDisplay<number>("payment-plans","grid");
 const load=()=>fetch("/api/admin/payment-plans",{credentials:"include",cache:"no-store"}).then(r=>r.json()).then(d=>setPlans(d.plans??[])).finally(()=>setLoading(false));
 useEffect(()=>{load()},[]);
 const filtered=useMemo(()=>plans.filter(p=>[p.name,p.currency,p.description].some(v=>String(v??"").toLowerCase().includes(query.toLowerCase()))),[plans,query]);
 const open=(p:Plan)=>router.push(`/Dashboard/plans/${p.id}`);
 const allSelected=filtered.length>0&&filtered.every(p=>selected.has(p.id));
 return <div className="space-y-4" dir="rtl">
  <section className="rl-surface rounded-[22px] bg-white p-3 shadow-[0_8px_22px_rgba(58,84,112,.08)] dark:border-white/[.07] dark:bg-[#0d243b] sm:p-4">
   <div className="flex flex-col gap-3 xl:flex-row xl:items-center" dir="rtl">
    <div className="min-w-0 shrink-0 text-right xl:w-[270px]"><h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-[#ece8ee] sm:text-lg"><CreditCard className="h-5 w-5 text-[#0758e9]"/>خطط الاشتراكات</h2><p className="mt-1 text-xs font-normal text-slate-500 dark:text-[#9f98a5]">إدارة خطط Radius Lord وحدود الموارد لكل Customer</p></div>
    <div className="hidden min-w-0 flex-1 xl:block"/>
    <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 xl:w-[clamp(430px,38vw,620px)]" dir="ltr">
     <button onClick={()=>router.push("/Dashboard/plans/add")} className="flex h-11 shrink-0 items-center gap-2 rounded-[15px] bg-[#0758e9] px-4 text-xs font-semibold text-white"><Plus className="h-4 w-4"/>إضافة خطة</button>
     <div className="relative min-w-[150px] flex-1" dir="rtl"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث عن خطة..." className="h-11 w-full rounded-[16px] border border-[#d7e3ef] bg-[#f9fbfe] pr-10 pl-3 text-sm font-normal text-slate-700 outline-none focus:border-[#6aaeff] focus:ring-4 focus:ring-[#1480ff]/10 dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#e3dfe6]"/></div>
     <CollectionDisplayControls view={view} onViewChange={setView} selectionMode={selectionMode} onSelectionModeChange={setSelectionMode} allSelected={allSelected} onToggleAll={()=>setAll(filtered.map(p=>p.id),!allSelected)}/>
    </div>
   </div>
  </section>
  <CollectionSelectionBar count={selected.size} noun="الخطط" onClear={()=>setSelected(new Set())}/>
  {loading?<div className="rl-surface rounded-[22px] bg-white p-8 text-center text-sm dark:bg-[#0d243b]">جارٍ تحميل الخطط...</div>:view==="grid"?<CollectionGrid>{filtered.map(p=><PlanCard key={p.id} p={p} onEdit={()=>open(p)} selectionMode={selectionMode} selected={selected.has(p.id)} onToggle={()=>toggle(p.id)}/>)}</CollectionGrid>:<section className="ui-state-enter overflow-x-auto rl-surface rounded-[22px] bg-white dark:bg-[#0d243b]"><table className="w-full min-w-[850px] text-right text-xs"><thead className="bg-[#d3e2f2] text-[#17386d] dark:bg-[#3b383e] dark:text-slate-200"><tr><th className="w-12 p-3 text-center"><CollectionSelectionBox checked={allSelected} onChange={()=>setAll(filtered.map(p=>p.id),!allSelected)} label="تحديد كل الخطط الظاهرة"/></th><th className="p-3">الخطة</th><th>السعر</th><th>المدة</th><th>الشبكات</th><th>المشتركون</th><th>NAS</th><th>الحالة</th></tr></thead><tbody className="divide-y divide-[#c4d3e2] dark:divide-white/10">{filtered.map(p=><tr key={p.id} onClick={()=>open(p)} className={`cursor-pointer hover:bg-[#e9f2ff] dark:hover:bg-white/[.04] ${selected.has(p.id)?"bg-[#dbe9f7] dark:bg-white/[.06]":""}`}><td className="w-12 p-3 text-center" onClick={e=>e.stopPropagation()}><CollectionSelectionBox checked={selected.has(p.id)} onChange={()=>toggle(p.id)} label={`تحديد ${p.name}`}/></td><td className="p-3 font-semibold">{p.name}{p.isFeatured&&<Star className="mr-2 inline h-3.5 w-3.5 fill-amber-400 text-amber-400"/>}</td><td>{p.price} {p.currency}</td><td>{p.durationMonths} شهر</td><td>{limit(p.maxTenants)}</td><td>{limit(p.maxSubscribers)}</td><td>{limit(p.maxNas)}</td><td><Status value={p.status}/></td></tr>)}</tbody></table></section>}

 </div>
}
function PlanCard({p,onEdit,selectionMode,selected,onToggle}:{p:Plan;onEdit:()=>void;selectionMode:boolean;selected:boolean;onToggle:()=>void}){return <article onClick={()=>selectionMode?onToggle():onEdit()} className={`${collectionCardClass(selected)} bg-[#e7eef6] hover:bg-[#dce9f7] dark:bg-[#243445] dark:hover:bg-[#2b4055]`}>{selectionMode&&<div className="mb-2 flex justify-end"><CollectionGridSelectionMark checked={selected}/></div>}<div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-base font-semibold">{p.name}{p.isFeatured&&<Star className="h-4 w-4 fill-amber-400 text-amber-400"/>}</div><div className="mt-1 text-xs text-slate-500">{p.durationMonths} شهر</div></div><Status value={p.status}/></div><div className="mt-5 text-2xl font-semibold text-[#0758e9]">{p.price} <span className="text-xs">{p.currency}</span></div><div className="mt-4 grid grid-cols-3 gap-2"><Metric icon={Wifi} label="الشبكات" value={limit(p.maxTenants)}/><Metric icon={Users} label="المشتركون" value={limit(p.maxSubscribers)}/><Metric icon={Server} label="NAS" value={limit(p.maxNas)}/></div>{p.description&&<p className="mt-3 line-clamp-2 text-xs text-slate-500">{p.description}</p>}</article>}
function Metric({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="rl-surface-soft rounded-[14px] bg-[#d8e3ee] p-2 text-center dark:bg-[#30465b]"><Icon className="mx-auto h-4 w-4 text-[#397bd5]"/><div className="mt-1 text-[10px] text-slate-400">{label}</div><div className="mt-1 text-xs font-semibold">{value}</div></div>}
function Status({value}:{value:Plan["status"]}){const t=value==="active"?"نشطة":value==="inactive"?"غير نشطة":"معطلة";return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${value==="active"?"bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10":value==="inactive"?"bg-amber-50 text-amber-600 dark:bg-amber-500/10":"bg-red-50 text-red-500 dark:bg-red-500/10"}`}>{t}</span>}
function limit(v:number){return v===0?"غير محدود":new Intl.NumberFormat("ar").format(v)}
