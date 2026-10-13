"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, MapPin, Phone, Plus, RefreshCw, ShieldCheck, UserRound, Users, Wifi, X } from "lucide-react";
import { CollectionCard, CollectionGrid, CollectionMobileCard, CollectionMobileList, CollectionState, CollectionStatusFilters, CollectionTable, CollectionTableBody, CollectionTableHead, CollectionToolbar, useCollectionDisplay } from "@/components/ui/collection-display";
import { ProjectCardIcon } from "@/components/ui/project-info-card";
import ProjectButton from "@/components/ui/project-button";
import ProjectDialog from "@/components/ui/project-dialog";
import ProjectInput from "@/components/ui/project-input";

type Category = { id:number; name:string };
type Subscriber = {
  id:number; manager_id:number; first_name:string; last_name:string; phone:string|null;
  address:string|null; latitude:string|number|null; longitude:string|number|null; notes:string|null;
  status:"active"|"suspended"; created_at:string; pppoe_count:number|string; hotspot_count:number|string;
  categories:string|null; payment_code?:string;
};
type Draft = {
  firstName:string; lastName:string; phone:string; address:string; latitude:string; longitude:string;
  notes:string; categoryId:string; status:"active"|"suspended";
};
const blank:Draft={firstName:"",lastName:"",phone:"",address:"",latitude:"",longitude:"",notes:"",categoryId:"",status:"active"};
const statusLabel={active:"نشط",suspended:"موقوف"} as const;
const inputClass="border-[#9fb8d2] bg-white text-[#17386d] placeholder:text-slate-400 focus:border-[#0758e9] dark:border-white/15 dark:bg-[#17263b] dark:text-[#dce8fa]";

export default function NetworkSubscribers({endpoint,canCreate=true,canChangeStatus=true}:{endpoint:string;canCreate?:boolean;canChangeStatus?:boolean}){
 const [items,setItems]=useState<Subscriber[]>([]);
 const [categories,setCategories]=useState<Category[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [query,setQuery]=useState("");
 const [statusFilter,setStatusFilter]=useState<"all"|"active"|"suspended">("all");
 const [dialog,setDialog]=useState<"closed"|"form"|"review">("closed");
 const [draft,setDraft]=useState<Draft>(blank);
 const [fieldError,setFieldError]=useState("");
 const {view,setView}=useCollectionDisplay<number>("network-subscribers","row");

 const load=async()=>{
  setLoading(true);setError("");
  try{
   const response=await fetch(`${endpoint}/subscribers`,{credentials:"include",cache:"no-store"});
   const data=await response.json();
   if(!response.ok)throw new Error(data.message||"تعذر تحميل المشتركين.");
   setItems(data.items||[]);setCategories(data.categories||[]);
  }catch(e){setError(e instanceof Error?e.message:"تعذر تحميل المشتركين.");}
  finally{setLoading(false);}
 };
 useEffect(()=>{void load();},[endpoint]);

 const counts=useMemo(()=>({
  all:items.length,
  active:items.filter(x=>x.status==="active").length,
  suspended:items.filter(x=>x.status==="suspended").length
 }),[items]);
 const filtered=useMemo(()=>{
  const q=query.trim().toLowerCase();
  return items.filter(item=>(statusFilter==="all"||item.status===statusFilter)&&(!q||[
   item.first_name,item.last_name,item.phone,item.address,item.categories
  ].some(value=>String(value||"").toLowerCase().includes(q))));
 },[items,query,statusFilter]);

 const setField=<K extends keyof Draft,>(key:K,value:Draft[K])=>setDraft(old=>({...old,[key]:value}));
 const startCreate=()=>{setDraft({...blank,categoryId:categories.length===1?String(categories[0].id):""});setFieldError("");setDialog("form");};
 const review=()=>{
  if(!draft.firstName.trim()||!draft.lastName.trim()){setFieldError("أدخل الاسم الأول والكنية قبل المراجعة.");return;}
  if((draft.latitude&&!draft.longitude)||(!draft.latitude&&draft.longitude)){setFieldError("أدخل خطي العرض والطول معًا.");return;}
  setFieldError("");setDialog("review");
 };
 const save=async()=>{
  setBusy(true);setFieldError("");
  try{
   const response=await fetch(`${endpoint}/subscribers`,{
    method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({...draft,categoryId:draft.categoryId||null})
   });
   const data=await response.json();
   if(!response.ok)throw new Error(data.message||"تعذر حفظ المشترك.");
   setDialog("closed");setDraft(blank);await load();
  }catch(e){setFieldError(e instanceof Error?e.message:"تعذر حفظ المشترك.");setDialog("form");}
  finally{setBusy(false);}
 };
 const changeStatus=async(item:Subscriber)=>{
  setBusy(true);setError("");
  try{
   const response=await fetch(`${endpoint}/subscribers`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"status",id:item.id,status:item.status==="active"?"suspended":"active"})});
   const data=await response.json();if(!response.ok)throw new Error(data.message||"تعذر تحديث حالة المشترك.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"تعذر تحديث حالة المشترك.");}
  finally{setBusy(false);}
 };

 const statusPill=(item:Subscriber)=><span className={item.status==="active"?"inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300":"inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-300"}><i className="h-1.5 w-1.5 rounded-full bg-current"/>{statusLabel[item.status]}</span>;
 const serviceCounts=(item:Subscriber)=><div className="flex flex-wrap items-center gap-2">
  <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"><Users className="h-3.5 w-3.5"/>{Number(item.pppoe_count||0).toLocaleString("ar")} PPPoE</span>
  <span className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-50 px-2.5 py-1.5 text-[11px] text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300"><Wifi className="h-3.5 w-3.5"/>{Number(item.hotspot_count||0).toLocaleString("ar")} Hotspot</span>
 </div>;
 const actions=(item:Subscriber)=>canChangeStatus?<ProjectButton variant="secondary" disabled={busy} onClick={()=>void changeStatus(item)}>{item.status==="active"?"تغيير حالة الملف إلى موقوف":"إعادة تفعيل الملف"}</ProjectButton>:null;
 const card=(item:Subscriber)=><CollectionCard key={item.id} onOpen={()=>{}}>
  <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-2.5"><ProjectCardIcon icon={UserRound}/><div className="min-w-0"><h3 className="break-words font-semibold text-[#17386d] dark:text-slate-100">{item.first_name} {item.last_name}</h3><div className="mt-1 text-[11px] text-slate-500">رقم المشترك #{item.id}</div></div></div>{statusPill(item)}</div>
  <div className="mt-4 space-y-3 border-t border-slate-200 pt-3 dark:border-white/10">{item.phone&&<div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Phone className="h-4 w-4 text-emerald-500"/><span dir="ltr">{item.phone}</span></div>}{item.address&&<div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"/><span className="break-words">{item.address}</span></div>}{item.categories&&<div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"><BadgeCheck className="h-4 w-4 shrink-0 text-violet-500"/><span>{item.categories}</span></div>}{serviceCounts(item)}</div>
  <div className="mt-4 flex justify-end border-t border-slate-200 pt-3 dark:border-white/10">{actions(item)}</div>
 </CollectionCard>;

 return <div className="space-y-3 sm:space-y-4">
  <CollectionToolbar icon={Users} title="المشتركون" description="ملفات الأشخاص وحسابات الخدمة المرتبطة بهم" view={view} onViewChange={setView} selectionMode={false} onSelectionModeChange={()=>{}} showSelectionControl={false} query={query} onQueryChange={setQuery} searchPlaceholder="بحث بالاسم أو الهاتف أو التصنيف" filters={<CollectionStatusFilters value={statusFilter} onChange={setStatusFilter} items={[{value:"all",label:"الكل",count:counts.all,dot:"bg-[#0758e9]"},{value:"active",label:"نشط",count:counts.active,dot:"bg-emerald-500"},{value:"suspended",label:"موقوف",count:counts.suspended,dot:"bg-red-500"}]} />} primaryAction={canCreate?<ProjectButton onClick={startCreate}><Plus/>إضافة مشترك</ProjectButton>:undefined}/>
  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{filtered.length.toLocaleString("ar")} مشترك</span><ProjectButton variant="ghost" disabled={loading} onClick={()=>void load()}><RefreshCw/>تحديث</ProjectButton></div>
  {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
  {loading?<CollectionState loading>جارٍ تحميل المشتركين...</CollectionState>:!filtered.length?<CollectionState>{query||statusFilter!=="all"?"لا توجد نتائج مطابقة.":"لا يوجد مشتركين بعد."}</CollectionState>:view==="grid"?<CollectionGrid>{filtered.map(card)}</CollectionGrid>:<><CollectionTable minWidth="900px"><CollectionTableHead><tr><th className="p-3">المشترك</th><th className="p-3">الهاتف</th><th className="p-3">التصنيف</th><th className="p-3">الحسابات</th><th className="p-3">الحالة</th><th className="p-3 text-center">إجراء</th></tr></CollectionTableHead><CollectionTableBody>{filtered.map(item=><tr key={item.id} className="text-slate-600 transition hover:bg-[#f4f8fc] dark:text-slate-300 dark:hover:bg-white/[.035]"><td className="p-3 font-semibold text-[#17386d] dark:text-slate-100">{item.first_name} {item.last_name}<div className="mt-1 text-[10px] font-normal text-slate-500">#{item.id}</div></td><td className="p-3" dir="ltr">{item.phone||"—"}</td><td className="p-3">{item.categories||"—"}</td><td className="p-3">{serviceCounts(item)}</td><td className="p-3">{statusPill(item)}</td><td className="p-3 text-center">{actions(item)}</td></tr>)}</CollectionTableBody></CollectionTable><CollectionMobileList>{filtered.map(item=><CollectionMobileCard key={item.id} onOpen={()=>{}}><div className="flex items-center justify-between gap-2"><strong className="text-sm text-[#17386d] dark:text-slate-100">{item.first_name} {item.last_name}</strong>{statusPill(item)}</div><div className="mt-3 space-y-2 text-xs">{item.phone&&<div dir="ltr" className="text-right">{item.phone}</div>}{item.categories&&<div>التصنيفات: {item.categories}</div>}{serviceCounts(item)}</div><div className="mt-3 flex justify-end">{actions(item)}</div></CollectionMobileCard>)}</CollectionMobileList></>}
  <ProjectDialog open={dialog!=="closed"} title={dialog==="review"?"مراجعة بيانات المشترك":"إضافة مشترك"} description={dialog==="review"?"راجع البيانات قبل حفظ ملف المشترك.":"أدخل بيانات الشخص، ثم راجعها قبل الحفظ."} onClose={()=>{if(!busy)setDialog("closed");}} busy={busy} footer={dialog==="review"?<><ProjectButton variant="secondary" disabled={busy} onClick={()=>setDialog("form")}><X/>رجوع للتعديل</ProjectButton><ProjectButton disabled={busy} onClick={()=>void save()}><ShieldCheck/>تأكيد الحفظ</ProjectButton></>:<><ProjectButton variant="secondary" disabled={busy} onClick={()=>setDialog("closed")}>إلغاء</ProjectButton><ProjectButton disabled={busy} onClick={review}><BadgeCheck/>مراجعة البيانات</ProjectButton></>}>
   {dialog==="review"?<div className="space-y-4">
    {fieldError&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{fieldError}</p>}
    <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-500/15 dark:bg-blue-500/[.06]"><h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#17386d] dark:text-blue-200"><UserRound className="h-4 w-4 text-blue-600"/>بيانات الشخص</h3><dl className="grid gap-3 text-xs sm:grid-cols-2">{[{k:"الاسم",v:draft.firstName+" "+draft.lastName},{k:"الهاتف",v:draft.phone||"غير مدخل"},{k:"العنوان",v:draft.address||"غير مدخل"},{k:"الإحداثيات",v:draft.latitude&&draft.longitude?draft.latitude+", "+draft.longitude:"غير محددة"},{k:"الحالة",v:statusLabel[draft.status]},{k:"التصنيف",v:categories.find(x=>String(x.id)===draft.categoryId)?.name||"بلا تصنيف"}].map(x=><div key={x.k}><dt className="text-slate-500">{x.k}</dt><dd className="mt-1 break-words font-semibold text-slate-800 dark:text-slate-100">{x.v}</dd></div>)}</dl>{draft.notes&&<p className="mt-3 border-t border-blue-100 pt-3 text-xs leading-5 text-slate-700 dark:border-white/10 dark:text-slate-300">الملاحظات: {draft.notes}</p>}</section>
    <p className="text-xs leading-5 text-slate-500">سيُسند الملف تلقائيًا إلى مديرك الحالي. عند اختيار تصنيف، ستسجل العضوية على المدير نفسه.</p>
   </div>:<div className="space-y-4">
    {fieldError&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{fieldError}</p>}
    <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-medium">الاسم الأول *<ProjectInput className={inputClass} value={draft.firstName} onChange={e=>setField("firstName",e.target.value)} maxLength={100}/></label><label className="space-y-1.5 text-xs font-medium">الكنية *<ProjectInput className={inputClass} value={draft.lastName} onChange={e=>setField("lastName",e.target.value)} maxLength={100}/></label><label className="space-y-1.5 text-xs font-medium">رقم الهاتف<ProjectInput className={inputClass} value={draft.phone} onChange={e=>setField("phone",e.target.value)} maxLength={40} inputMode="tel"/></label><label className="space-y-1.5 text-xs font-medium">التصنيف<select className={`h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${inputClass}`} value={draft.categoryId} onChange={e=>setField("categoryId",e.target.value)}><option value="">بلا تصنيف</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>
    <label className="block space-y-1.5 text-xs font-medium">العنوان<ProjectInput className={inputClass} value={draft.address} onChange={e=>setField("address",e.target.value)} maxLength={10000}/></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-medium">خط العرض<ProjectInput className={inputClass} value={draft.latitude} onChange={e=>setField("latitude",e.target.value)} inputMode="decimal"/></label><label className="space-y-1.5 text-xs font-medium">خط الطول<ProjectInput className={inputClass} value={draft.longitude} onChange={e=>setField("longitude",e.target.value)} inputMode="decimal"/></label></div>
    <label className="block space-y-1.5 text-xs font-medium">ملاحظات<textarea className={`min-h-24 w-full rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${inputClass}`} value={draft.notes} onChange={e=>setField("notes",e.target.value)} maxLength={10000}/></label>
    <div className="space-y-2"><p className="text-xs font-medium">حالة المشترك</p><div className="grid grid-cols-2 gap-2">{(["active","suspended"] as const).map(value=><button key={value} type="button" onClick={()=>setField("status",value)} className={`h-10 rounded-xl border text-xs font-semibold ${draft.status===value?value==="active"?"border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10":"border-red-300 bg-red-50 text-red-600 dark:bg-red-500/10":"border-slate-200 text-slate-500 dark:border-white/10"}`}>{statusLabel[value]}</button>)}</div></div>
   </div>}
  </ProjectDialog>
 </div>;
}
