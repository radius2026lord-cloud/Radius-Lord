"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, Check, MapPin, Phone, Plus, ShieldCheck, Tags, UserRound, Users, Wifi } from "lucide-react";
import { CollectionCard, CollectionGrid, CollectionMobileCard, CollectionMobileList, CollectionState, CollectionStatusFilters, CollectionTable, CollectionTableBody, CollectionTableHead, CollectionToolbar, CollectionSelectionBox, collectionRowClass, useCollectionDisplay } from "@/components/ui/collection-display";
import { ProjectCardIcon } from "@/components/ui/project-info-card";
import ProjectButton from "@/components/ui/project-button";
import ProjectDropdown from "@/components/ui/project-dropdown";
import BulkSelectionBar from "@/components/ui/bulk-selection-bar";
import ProjectInput from "@/components/ui/project-input";

type Category = { id:number; name:string };
type Subscriber = {
  id:number; manager_id:number; first_name:string; last_name:string; phone:string|null;
  address:string|null; latitude:string|number|null; longitude:string|number|null; notes:string|null;
  status:"active"|"suspended"; created_at:string; pppoe_count:number|string; hotspot_count:number|string;
  categories:string|null; payment_code?:string;
};
// لاحقًا عند استيراد الهوية، تُملأ الحقول الفارغة فقط ولا تُستبدل القيم التي أدخلها المستخدم.
type Draft = { firstName:string; lastName:string; phone:string; address:string; notes:string; categoryId:string; status:"active"|"suspended" };
const blank:Draft={firstName:"",lastName:"",phone:"",address:"",notes:"",categoryId:"",status:"active"};
const statusLabel={active:"نشط",suspended:"موقوف"} as const;
const inputClass="border-[#9fb8d2] bg-white text-[#17386d] placeholder:text-slate-400 focus:border-[#0758e9] dark:border-white/15 dark:bg-[#17263b] dark:text-[#dce8fa]";

type SuggestField="firstName"|"lastName"|"address";
function SubscriberAutocomplete({endpoint,field,value,onChange,icon:Icon,placeholder}:{endpoint:string;field:SuggestField;value:string;onChange:(value:string)=>void;icon:any;placeholder:string}){
 const [suggestions,setSuggestions]=useState<string[]>([]),[open,setOpen]=useState(false),[active,setActive]=useState(0),[dismissedValue,setDismissedValue]=useState("");
 useEffect(()=>{const query=value.trim();if(query.length<2||query===dismissedValue){setSuggestions([]);setOpen(false);return;}let live=true;const timer=window.setTimeout(async()=>{try{const response=await fetch(`${endpoint}/subscribers/suggestions?field=${field}&q=${encodeURIComponent(query)}`,{credentials:"include",cache:"no-store"});if(!response.ok)throw new Error();const data=await response.json();if(live){setSuggestions(Array.isArray(data.items)?data.items.filter((item:any)=>typeof item==="string"):[]);setActive(0);setOpen(true);}}catch{if(live){setSuggestions([]);setOpen(false);}}},180);return()=>{live=false;window.clearTimeout(timer);};},[endpoint,field,value,dismissedValue]);
 const choose=(value:string)=>{setDismissedValue(value);onChange(value);setOpen(false);};
 const update=(value:string)=>{setDismissedValue("");onChange(value);};
 return <div className="relative min-w-0"><div className="relative"><Icon aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-sky-600"/><ProjectInput required className={`${inputClass} pr-10`} value={value} onChange={event=>update(event.target.value)} onFocus={()=>{if(suggestions.length)setOpen(true);}} onBlur={()=>window.setTimeout(()=>setOpen(false),120)} onKeyDown={event=>{if(!open||!suggestions.length)return;if(event.key==="ArrowDown"){event.preventDefault();setActive(index=>(index+1)%suggestions.length);}else if(event.key==="ArrowUp"){event.preventDefault();setActive(index=>(index-1+suggestions.length)%suggestions.length);}else if(event.key==="Tab"){choose(suggestions[active]||suggestions[0]);}else if(event.key==="Escape"){setOpen(false);}}} maxLength={field==="address"?10000:100} placeholder={placeholder} autoComplete="off" aria-autocomplete="list" aria-expanded={open&&suggestions.length>0}/></div>{open&&suggestions.length>0&&<div role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-52 overflow-y-auto rounded-xl border border-[#b8cde2] bg-white p-1.5 shadow-[0_14px_34px_rgba(31,56,86,.18)] dark:border-white/15 dark:bg-[#1b2b3f]">{suggestions.map((item,index)=><button key={item} type="button" role="option" aria-selected={active===index} tabIndex={-1} onMouseEnter={()=>setActive(index)} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(item)} className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-right text-xs transition ${active===index?"bg-blue-50 text-[#0758e9] dark:bg-blue-500/10 dark:text-blue-200":"text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"}`}><Icon className="h-4 w-4 shrink-0 text-sky-600"/><span className="truncate">{item}</span></button>)}</div>}</div>;
}


export default function NetworkSubscribers({endpoint,tab="list",onTabChange,canCreate=true,canChangeStatus=true}:{endpoint:string;tab?:"list"|"create";onTabChange:(value:"list"|"create")=>void;canCreate?:boolean;canChangeStatus?:boolean}){
 const [items,setItems]=useState<Subscriber[]>([]);
 const [categories,setCategories]=useState<Category[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [query,setQuery]=useState("");
 const [statusFilter,setStatusFilter]=useState<"all"|"active"|"suspended">("all");
 const [stage,setStage]=useState<"form"|"review">("form");
 const [selectionMode,setSelectionMode]=useState(false);
 const [selected,setSelected]=useState<number[]>([]);
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
 const allSelected=filtered.length>0&&filtered.every(item=>selected.includes(item.id));
 const toggleSelected=(id:number)=>setSelected(old=>old.includes(id)?old.filter(value=>value!==id):[...old,id]);
 const toggleAll=()=>setSelected(old=>allSelected?old.filter(id=>!filtered.some(item=>item.id===id)):Array.from(new Set([...old,...filtered.map(item=>item.id)])));
 const bulkStatus=async(status:"active"|"suspended")=>{setBusy(true);setError("");try{for(const id of selected){const response=await fetch(`${endpoint}/subscribers`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"status",id,status})});const data=await response.json();if(!response.ok)throw new Error(data.message||"تعذر تحديث حالة أحد المشتركين.");}setSelected([]);setSelectionMode(false);await load();}catch(e){setError(e instanceof Error?e.message:"تعذر تنفيذ العملية الجماعية.");}finally{setBusy(false);}};
 const startCreate=()=>{setDraft({...blank,categoryId:categories.length===1?String(categories[0].id):""});setFieldError("");setStage("form");onTabChange("create");};
 const review=()=>{
  if(!draft.firstName.trim()||!draft.lastName.trim()||!draft.phone.trim()||!draft.address.trim()){setFieldError("الاسم والكنية ورقم الهاتف والعنوان حقول مطلوبة.");return;}
  setFieldError("");setStage("review");
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
   setDraft(blank);setSelected([]);onTabChange("list");await load();
  }catch(e){setFieldError(e instanceof Error?e.message:"تعذر حفظ المشترك.");setStage("form");}
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

 return <div className="space-y-3 sm:space-y-4 text-[13px]">
{tab==="create"?<section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-bold text-[#17386d] dark:text-slate-100">{stage==="review"?"مراجعة بيانات المشترك":"إضافة بيانات مشترك"}</h2><p className="mt-1 text-[11px] text-slate-500">{stage==="review"?"تأكد من المعلومات قبل حفظ الملف.":"موقع العميل يُحدد عند إضافة خط الخدمة."}</p></div><ProjectButton variant="secondary" onClick={()=>onTabChange("list")}><ArrowLeft/>العودة للقائمة</ProjectButton></div>{fieldError&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{fieldError}</p>}
{stage==="form"?<div className="space-y-4"><section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.025]"><h3 className="mb-1 flex items-center gap-2 text-xs font-bold text-[#17386d]"><UserRound className="h-4 w-4 text-blue-600"/>البيانات الشخصية</h3><p className="mb-3 text-[10px] text-slate-500">اكتب حرفين لعرض الاقتراحات، ثم اضغط Tab لإكمال الاقتراح المحدد.</p><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-[11px] font-medium">الاسم *<SubscriberAutocomplete endpoint={endpoint} field="firstName" value={draft.firstName} onChange={value=>setField("firstName",value)} icon={UserRound} placeholder="اكتب حرفين لعرض الاقتراحات"/></label><label className="space-y-1 text-[11px] font-medium">الكنية *<SubscriberAutocomplete endpoint={endpoint} field="lastName" value={draft.lastName} onChange={value=>setField("lastName",value)} icon={UserRound} placeholder="اكتب حرفين لعرض الاقتراحات"/></label><label className="space-y-1 text-[11px] font-medium">رقم الهاتف *<ProjectInput required className={inputClass} value={draft.phone} onChange={e=>setField("phone",e.target.value)} maxLength={40} inputMode="tel"/></label><div className="space-y-1 text-[11px] font-medium">التصنيف<ProjectDropdown icon={Tags} value={draft.categoryId} onChange={value=>setField("categoryId",value)} options={[{value:"",label:"بلا تصنيف"},...categories.map(category=>({value:String(category.id),label:category.name}))]} placeholder="اختر تصنيفًا"/></div></div><label className="mt-3 block space-y-1 text-[11px] font-medium">العنوان *<SubscriberAutocomplete endpoint={endpoint} field="address" value={draft.address} onChange={value=>setField("address",value)} icon={MapPin} placeholder="اكتب حرفين لعرض العناوين المحفوظة"/></label><label className="mt-3 block space-y-1 text-[11px] font-medium">ملاحظات إضافية<textarea className={`min-h-20 w-full rounded-xl border p-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 ${inputClass}`} value={draft.notes} onChange={e=>setField("notes",e.target.value)} maxLength={10000}/></label></section><section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.025]"><h3 className="mb-2 flex items-center gap-2 text-xs font-bold"><ShieldCheck className="h-4 w-4 text-emerald-600"/>حالة ملف المشترك</h3><div className="grid grid-cols-2 gap-2">{(["active","suspended"] as const).map(value=><button key={value} type="button" onClick={()=>setField("status",value)} className={`h-9 rounded-xl border text-xs font-semibold ${draft.status===value?value==="active"?"border-emerald-300 bg-emerald-50 text-emerald-700":"border-red-300 bg-red-50 text-red-600":"border-slate-200 text-slate-500"}`}>{statusLabel[value]}</button>)}</div></section><div className="flex justify-end"><ProjectButton onClick={review}><BadgeCheck/>مراجعة البيانات</ProjectButton></div></div>:<div className="space-y-4"><section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><h3 className="mb-3 flex items-center gap-2 text-xs font-bold text-[#17386d]"><UserRound className="h-4 w-4 text-blue-600"/>ملخص البيانات</h3><dl className="grid gap-3 text-xs sm:grid-cols-2">{[{k:"الاسم والكنية",v:draft.firstName+" "+draft.lastName},{k:"رقم الهاتف",v:draft.phone},{k:"العنوان",v:draft.address},{k:"الحالة",v:statusLabel[draft.status]},{k:"التصنيف",v:categories.find(x=>String(x.id)===draft.categoryId)?.name||"بلا تصنيف"}].map(x=><div key={x.k}><dt className="text-slate-500">{x.k}</dt><dd className="mt-1 break-words font-semibold">{x.v}</dd></div>)}</dl>{draft.notes&&<p className="mt-3 border-t border-blue-100 pt-3 text-xs">ملاحظات: {draft.notes}</p>}</section><p className="text-[11px] leading-5 text-slate-500">سيُسند الملف تلقائيًا إلى مديرك الحالي. توثيق الهوية سيظهر عند توفر قراءة الباركود وتصوير وجهي الهوية.</p><div className="flex justify-end gap-2"><ProjectButton variant="secondary" disabled={busy} onClick={()=>setStage("form")}>رجوع للتعديل</ProjectButton><ProjectButton disabled={busy} onClick={()=>void save()}><Check/>تأكيد الحفظ</ProjectButton></div></div>}</section>:<>
<CollectionToolbar icon={Users} title="المشتركون" description="ملفات الأشخاص وحسابات الخدمة المرتبطة بهم" view={view} onViewChange={setView} selectionMode={selectionMode} onSelectionModeChange={setSelectionMode} allSelected={allSelected} onToggleAll={toggleAll} selectionAcrossViews showSelectionControl query={query} onQueryChange={setQuery} searchPlaceholder="بحث بالاسم أو الهاتف أو التصنيف" filters={<CollectionStatusFilters value={statusFilter} onChange={setStatusFilter} items={[{value:"all",label:"الكل",count:counts.all,dot:"bg-[#0758e9]"},{value:"active",label:"نشط",count:counts.active,dot:"bg-emerald-500"},{value:"suspended",label:"موقوف",count:counts.suspended,dot:"bg-red-500"}]} />} primaryAction={canCreate?<ProjectButton onClick={startCreate}><Plus/>إضافة بيانات مشترك</ProjectButton>:undefined}/>
<BulkSelectionBar count={selected.length} noun="مشترك" allSelected={allSelected} onToggleAll={toggleAll} onClearSelection={()=>setSelected([])} show={{activate:true,suspend:true}} handlers={{activate:()=>void bulkStatus("active"),suspend:()=>void bulkStatus("suspended")}}/>
<div className="text-left text-[11px] text-slate-500">{filtered.length.toLocaleString("ar")} مشترك</div>{error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
{loading?<CollectionState loading>جارٍ تحميل المشتركين...</CollectionState>:!filtered.length?<CollectionState>{query||statusFilter!=="all"?"لا توجد نتائج مطابقة.":"لا يوجد مشتركين بعد."}</CollectionState>:view==="grid"?<CollectionGrid>{filtered.map(item=><CollectionCard key={item.id} selected={selected.includes(item.id)} selectionMode={selectionMode} onToggle={()=>toggleSelected(item.id)} onOpen={()=>{}}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-2.5"><ProjectCardIcon icon={UserRound}/><div className="min-w-0"><h3 className="break-words text-sm font-semibold text-[#17386d]">{item.first_name} {item.last_name}</h3><div className="mt-1 text-[10px] text-slate-500">#{item.id}</div></div></div>{statusPill(item)}</div><div className="mt-3 space-y-2 border-t border-slate-200 pt-3">{item.phone&&<div className="flex items-center gap-2 text-xs"><Phone className="h-4 w-4 text-emerald-500"/><span dir="ltr">{item.phone}</span></div>}{item.address&&<div className="flex items-start gap-2 text-xs"><MapPin className="mt-0.5 h-4 w-4 text-rose-500"/><span className="break-words">{item.address}</span></div>}{item.categories&&<div className="text-[11px] text-slate-500">{item.categories}</div>}{serviceCounts(item)}</div>{canChangeStatus&&!selectionMode&&<div className="mt-3 flex justify-end border-t border-slate-200 pt-2">{actions(item)}</div>}</CollectionCard>)}</CollectionGrid>:<><CollectionTable minWidth="900px"><CollectionTableHead><tr>{selectionMode&&<th className="w-10 p-2"><CollectionSelectionBox checked={allSelected} label="تحديد كل النتائج" onChange={toggleAll}/></th>}<th className="p-3 text-xs">المشترك</th><th className="p-3 text-xs">الهاتف</th><th className="p-3 text-xs">التصنيف</th><th className="p-3 text-xs">الحسابات</th><th className="p-3 text-xs">الحالة</th>{!selectionMode&&<th className="p-3 text-center text-xs">إجراء</th>}</tr></CollectionTableHead><CollectionTableBody>{filtered.map(item=><tr key={item.id} onClick={()=>selectionMode&&toggleSelected(item.id)} className={collectionRowClass(selected.includes(item.id))}>{selectionMode&&<td className="p-2" onClick={e=>e.stopPropagation()}><CollectionSelectionBox checked={selected.includes(item.id)} label={`تحديد ${item.first_name} ${item.last_name}`} onChange={()=>toggleSelected(item.id)}/></td>}<td className="p-3 text-xs font-semibold text-[#17386d]">{item.first_name} {item.last_name}<div className="mt-1 text-[10px] font-normal text-slate-500">#{item.id}</div></td><td className="p-3 text-xs" dir="ltr">{item.phone||"—"}</td><td className="p-3 text-xs">{item.categories||"—"}</td><td className="p-3">{serviceCounts(item)}</td><td className="p-3">{statusPill(item)}</td>{!selectionMode&&<td className="p-3 text-center">{actions(item)}</td>}</tr>)}</CollectionTableBody></CollectionTable><CollectionMobileList>{filtered.map(item=><CollectionMobileCard key={item.id} onOpen={()=>selectionMode&&toggleSelected(item.id)}><div className="flex items-center justify-between gap-2"><strong className="text-xs text-[#17386d]">{item.first_name} {item.last_name}</strong>{selectionMode?<CollectionSelectionBox checked={selected.includes(item.id)} label="تحديد المشترك" onChange={()=>toggleSelected(item.id)}/>:statusPill(item)}</div><div className="mt-3 space-y-2 text-xs">{item.phone&&<div dir="ltr" className="text-right">{item.phone}</div>}{item.categories&&<div>التصنيفات: {item.categories}</div>}{serviceCounts(item)}</div>{!selectionMode&&<div className="mt-3 flex justify-end">{actions(item)}</div>}</CollectionMobileCard>)}</CollectionMobileList></>}
</>}
</div>;
}