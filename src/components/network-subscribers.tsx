"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { Activity, ArrowLeft, BadgeCheck, CalendarDays, Check, CheckCircle2, ChevronDown, CircleX, Clock3, CreditCard, FileText, Hash, Images, Laptop, ListFilter, MapPin, Phone, Plus, Radio, Router, ScanLine, Server, ShieldAlert, ShieldCheck, SlidersHorizontal, Tags, UserRound, Users, Wifi, WifiOff, X } from "lucide-react";
import { CollectionCard, CollectionGrid, CollectionMobileCard, CollectionMobileList, CollectionState, CollectionTable, CollectionTableBody, CollectionTableHead, CollectionToolbar, CollectionSelectionBox, useCollectionDisplay } from "@/components/ui/collection-display";
import { ProjectCardIcon, ProjectInfoCard } from "@/components/ui/project-info-card";
import ProjectButton from "@/components/ui/project-button";
import ProjectDropdown from "@/components/ui/project-dropdown";
import BulkSelectionBar from "@/components/ui/bulk-selection-bar";
import ProjectInput from "@/components/ui/project-input";
import ProjectTooltip from "@/components/ui/project-tooltip";
import ProjectDialog from "@/components/ui/project-dialog";
import SubscriberIdentityImport, { type IdentityDocumentDraft, type IdentityImagesDraft } from "@/components/subscriber-identity-import";

type Category = { id:number; name:string };
type SubscriberServer = { address:string; name:string };
type Subscriber = {
  id:number; manager_id:number; first_name:string; last_name:string; phone:string|null;
  address:string|null; latitude:string|number|null; longitude:string|number|null; notes:string|null;
  status:"active"|"suspended"; created_at:string; pppoe_count:number|string; hotspot_count:number|string;
  categories:string|null; category_ids?:string|null; server_addresses?:string|null;
  is_online?:boolean|number; has_current_subscription?:boolean|number; has_expired_subscription?:boolean|number;
  payment_code?:string; identity_verified:boolean|number;
};
type SubscriberDetail=Subscriber & {payment_code:string|null;manager_name:string|null;identity_verified:boolean|number;identity_front_image:boolean|number;identity_back_image:boolean|number};
type SubscriberLine={id:number;kind:"pppoe"|"hotspot";username:string;line_name?:string|null;service_name?:string|null;status:string;lifecycle?:string|null;upload_bytes:string|number;download_bytes:string|number;live_sessions:number|string;last_seen:string|null;framed_ip:string|null;calling_station:string|null;nas_ip:string|null};
// لاحقًا عند استيراد الهوية، تُملأ الحقول الفارغة فقط ولا تُستبدل القيم التي أدخلها المستخدم.
type Draft = { firstName:string; lastName:string; phone:string; address:string; notes:string; categoryId:string; status:"active"|"suspended" };
const blank:Draft={firstName:"",lastName:"",phone:"",address:"",notes:"",categoryId:"",status:"active"};
const statusLabel={active:"مفعّل",suspended:"غير مفعّل"} as const;
const inputClass="border-[#9fb8d2] bg-white text-[#17386d] placeholder:text-slate-400 focus:border-[#0758e9] dark:border-white/15 dark:bg-[#17263b] dark:text-[#dce8fa]";
const filterGroupTone={
 activation:"border-t-[#0b72e7]",
 connection:"border-t-[#0891b2]",
 subscription:"border-t-[#d97706]",
 category:"border-t-[#7c3aed]",
 server:"border-t-[#4f46e5]",
 identity:"border-t-[#059669]",
} as const;
const filterGroupIconTone={
 activation:"bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200",
 connection:"bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-200",
 subscription:"bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200",
 category:"bg-violet-50 text-violet-700 dark:bg-violet-400/10 dark:text-violet-200",
 server:"bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200",
 identity:"bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200",
} as const;
function SubscriberFilterGroup({icon:Icon,title,children,tone}:{icon:any;title:string;children:any;tone:keyof typeof filterGroupTone}){
 return <div className={`min-w-0 rounded-2xl border border-[#d7e2ee] border-t-[3px] bg-white p-4 shadow-[0_6px_18px_rgba(37,68,100,.07)] transition-shadow hover:shadow-[0_8px_22px_rgba(37,68,100,.10)] dark:border-white/10 dark:bg-[#1b2b3f] ${filterGroupTone[tone]}`}><h4 className="mb-3 flex items-center gap-2 text-[11px] font-bold text-[#17386d] dark:text-slate-100"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${filterGroupIconTone[tone]}`}><Icon className="h-3.5 w-3.5"/></span>{title}</h4>{children}</div>;
}
function SubscriberFilterChoices({value,onChange,items}:{value:string;onChange:(value:any)=>void;items:Array<{value:string;label:string;count:number;icon:any;accent:string}>}){
 return <div className="grid min-w-0 grid-cols-1 gap-1.5 min-[360px]:grid-cols-3">{items.map(item=>{const active=value===item.value;const Icon=item.icon;return <button key={item.value} type="button" aria-pressed={active} onClick={()=>onChange(item.value)} className={`flex min-h-10 min-w-0 items-center justify-between gap-1 rounded-xl border px-2 py-1.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${active?"border-[#8db9ed] bg-[#edf5ff] text-[#0758e9] shadow-[0_3px_10px_rgba(20,121,255,.12)] dark:border-blue-300/20 dark:bg-blue-500/[.12] dark:text-blue-100":"border-[#e3eaf2] bg-[#f6f8fb] text-slate-600 hover:border-[#cbd9e8] hover:bg-white dark:border-white/[.08] dark:bg-white/[.035] dark:text-slate-300 dark:hover:bg-white/[.07]"}`}><span className="flex min-w-0 items-center gap-1"><Icon className={`h-3.5 w-3.5 shrink-0 ${active?"text-blue-600":item.accent}`}/><span className="truncate">{item.label}</span></span><span className={`grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1 text-[9px] ${active?"bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200":"bg-white text-slate-500 dark:bg-white/[.06] dark:text-slate-400"}`}>{item.count}</span></button>})}</div>;
}
function subscriberTableRowClass(selected:boolean){
 return `cursor-pointer rounded-[12px] border border-[#e2e8f0] bg-white text-slate-600 transition-[background-color,border-color,box-shadow] duration-200 [&>td]:border-y [&>td]:border-[#e2e8f0] [&>td:first-child]:rounded-r-xl [&>td:first-child]:border-r [&>td:last-child]:rounded-l-xl [&>td:last-child]:border-l hover:border-[#cbd8e6] hover:bg-[#f8fafc] hover:shadow-[0_2px_8px_rgba(37,68,100,.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9bb5d1] dark:border-white/[.08] dark:bg-[#182b42] dark:text-slate-300 dark:[&>td]:border-white/[.07] dark:hover:border-white/[.14] dark:hover:bg-white/[.045] ${selected?"border-[#b9cce0] bg-[#f3f7fb] dark:border-blue-300/20 dark:bg-blue-500/[.08]":""}`;
}
function IdentityVerificationBadge({verified,onClick}:{verified:boolean|number;onClick?:()=>void}){
 const isVerified=verified===true||Number(verified)===1;
  const badgeClass=`inline-flex h-[22px] w-[76px] shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border px-1.5 text-[9px] leading-none font-medium ${isVerified?"border-emerald-200/80 bg-emerald-50/70 text-emerald-700 dark:border-emerald-300/15 dark:bg-emerald-500/[.07] dark:text-emerald-200":"border-red-200/80 bg-red-50/70 text-red-700 dark:border-red-300/15 dark:bg-red-500/[.07] dark:text-red-200"}`;
 const label=isVerified?"موثق":"غير موثق";
 return <ProjectTooltip label={isVerified?"تم حفظ بيانات المشترك بعد قراءة باركود الهوية":onClick?"انقر لبدء توثيق الحساب بالهوية":"لم تُحفظ بيانات الهوية لهذا المشترك بعد"}>{onClick&&!isVerified?<button type="button" aria-label="توثيق حساب المشترك بالهوية" onClick={event=>{event.stopPropagation();onClick();}} className={`${badgeClass} cursor-pointer transition-colors hover:border-red-300 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:hover:bg-red-500/15`}><BadgeCheck className="h-3 w-3"/>{label}</button>:<span className={badgeClass}><BadgeCheck className="h-3 w-3"/>{label}</span>}</ProjectTooltip>;
}

type SuggestField="firstName"|"lastName"|"address";
function SubscriberAutocomplete({endpoint,field,value,onChange,icon:Icon,placeholder}:{endpoint:string;field:SuggestField;value:string;onChange:(value:string)=>void;icon:any;placeholder:string}){
 const [suggestions,setSuggestions]=useState<string[]>([]),[open,setOpen]=useState(false),[active,setActive]=useState(0),[dismissedValue,setDismissedValue]=useState("");
 useEffect(()=>{const query=value.trim();if(query.length<2||query===dismissedValue){setSuggestions([]);setOpen(false);return;}let live=true;const timer=window.setTimeout(async()=>{try{const response=await fetch(`${endpoint}/subscribers/suggestions?field=${field}&q=${encodeURIComponent(query)}`,{credentials:"include",cache:"no-store"});if(!response.ok)throw new Error();const data=await response.json();if(live){setSuggestions(Array.isArray(data.items)?data.items.filter((item:any)=>typeof item==="string"):[]);setActive(0);setOpen(true);}}catch{if(live){setSuggestions([]);setOpen(false);}}},180);return()=>{live=false;window.clearTimeout(timer);};},[endpoint,field,value,dismissedValue]);
 const choose=(value:string)=>{setDismissedValue(value);onChange(value);setOpen(false);};
 const update=(value:string)=>{setDismissedValue("");onChange(value);};
 return <div className="relative min-w-0"><div className="relative"><Icon aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-sky-600"/><ProjectInput required className={`${inputClass} pr-10`} value={value} onChange={event=>update(event.target.value)} onFocus={()=>{if(suggestions.length)setOpen(true);}} onBlur={()=>window.setTimeout(()=>setOpen(false),120)} onKeyDown={event=>{if(!open||!suggestions.length)return;if(event.key==="ArrowDown"){event.preventDefault();setActive(index=>(index+1)%suggestions.length);}else if(event.key==="ArrowUp"){event.preventDefault();setActive(index=>(index-1+suggestions.length)%suggestions.length);}else if(event.key==="Tab"){choose(suggestions[active]||suggestions[0]);}else if(event.key==="Escape"){setOpen(false);}}} maxLength={field==="address"?10000:100} placeholder={placeholder} autoComplete="off" aria-autocomplete="list" aria-expanded={open&&suggestions.length>0}/></div>{open&&suggestions.length>0&&<div role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-52 overflow-y-auto rounded-xl border border-[#b8cde2] bg-white p-1.5 shadow-[0_14px_34px_rgba(31,56,86,.18)] dark:border-white/15 dark:bg-[#1b2b3f]">{suggestions.map((item,index)=><button key={item} type="button" role="option" aria-selected={active===index} tabIndex={-1} onMouseEnter={()=>setActive(index)} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(item)} className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-right text-xs transition ${active===index?"bg-blue-50 text-[#0758e9] dark:bg-blue-500/10 dark:text-blue-200":"text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"}`}><Icon className="h-4 w-4 shrink-0 text-sky-600"/><span className="truncate">{item}</span></button>)}</div>}</div>;
}


export default function NetworkSubscribers({endpoint,tab="list",onTabChange,canCreate=true,canChangeStatus=true,canVerifyIdentity=true,detailId=null,onOpenSubscriber,onBackToSubscribers}:{endpoint:string;tab?:"list"|"create";onTabChange:(value:"list"|"create")=>void;canCreate?:boolean;canChangeStatus?:boolean;canVerifyIdentity?:boolean;detailId:number|null;onOpenSubscriber:(id:number)=>void;onBackToSubscribers:()=>void}){
 const [items,setItems]=useState<Subscriber[]>([]);
 const [categories,setCategories]=useState<Category[]>([]);
 const [servers,setServers]=useState<SubscriberServer[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [query,setQuery]=useState("");
 const [statusFilter,setStatusFilter]=useState<"all"|"active"|"suspended">("all");
 const [verificationFilter,setVerificationFilter]=useState<"all"|"verified"|"unverified">("all");
 const [connectionFilter,setConnectionFilter]=useState<"all"|"online"|"offline">("all");
 const [subscriptionFilter,setSubscriptionFilter]=useState<"all"|"expired"|"current">("all");
 const [categoryFilter,setCategoryFilter]=useState("");
 const [serverFilter,setServerFilter]=useState("");
 const [filterPanelOpen,setFilterPanelOpen]=useState(false);
 const [stage,setStage]=useState<"form"|"review">("form");
 const [entryMode,setEntryMode]=useState<"manual"|"identity">("manual");
 const [identityAvailableOnDevice,setIdentityAvailableOnDevice]=useState<boolean|null>(null);
 const [selectionMode,setSelectionMode]=useState(false);
 const [selected,setSelected]=useState<number[]>([]);
 const [draft,setDraft]=useState<Draft>(blank);
 const [identityDocument,setIdentityDocument]=useState<IdentityDocumentDraft|null>(null);
 const [identityImages,setIdentityImages]=useState<IdentityImagesDraft>({front:null,back:null});
 const [fieldError,setFieldError]=useState("");
 const {view,setView}=useCollectionDisplay<number>("network-subscribers","row");
 const [detail,setDetail]=useState<SubscriberDetail|null>(null);
 const [detailLines,setDetailLines]=useState<SubscriberLine[]>([]);
 const [detailLoading,setDetailLoading]=useState(false);
 const [detailError,setDetailError]=useState("");
 const [detailTab,setDetailTab]=useState<"profile"|"lines">("profile");
 const [identityPhotosOpen,setIdentityPhotosOpen]=useState(false);
 const [identityPhotosLoading,setIdentityPhotosLoading]=useState(false);
 const [identityPhotosError,setIdentityPhotosError]=useState("");
 const [identityPhotos,setIdentityPhotos]=useState<{front:string|null;back:string|null}>({front:null,back:null});
 const [identityVerifyOpen,setIdentityVerifyOpen]=useState(false);
 const [identityCaptureDialogOpen,setIdentityCaptureDialogOpen]=useState(false);
 const [identityVerifyDocument,setIdentityVerifyDocument]=useState<IdentityDocumentDraft|null>(null);
 const [identityVerifyImages,setIdentityVerifyImages]=useState<IdentityImagesDraft>({front:null,back:null});
 const [identityVerifyNames,setIdentityVerifyNames]=useState({firstName:"",lastName:""});
 const [identityVerifyError,setIdentityVerifyError]=useState("");
 const lastOpenedId=useRef<number|null>(null);
 const pendingIdentityVerificationId=useRef<number|null>(null);
 useEffect(()=>()=>{Object.values(identityPhotos).forEach(url=>{if(url)URL.revokeObjectURL(url);});},[identityPhotos]);
 useEffect(()=>{
  const checkDevice=()=>{
   const mobileAgent=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
   const available=!mobileAgent;
   setIdentityAvailableOnDevice(available);
   if(!available)setEntryMode("manual");
  };
  checkDevice();
  window.addEventListener("resize",checkDevice);
  return()=>window.removeEventListener("resize",checkDevice);
 },[]);
 useEffect(()=>{if(!detailId){setDetail(null);setDetailLines([]);setDetailError("");return;}let live=true;setDetailLoading(true);setDetailError("");setDetailTab("profile");fetch(`${endpoint}/subscribers/${detailId}`,{credentials:"include",cache:"no-store"}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.message||"تعذر تحميل ملف المشترك.");if(live){const item=data.item||null;setDetail(item);setDetailLines(Array.isArray(data.accounts)?data.accounts:[]);if(pendingIdentityVerificationId.current===detailId){if(!canVerifyIdentity||identityAvailableOnDevice===false)pendingIdentityVerificationId.current=null;else if(identityAvailableOnDevice===true){pendingIdentityVerificationId.current=null;if(item&&Number(item.identity_verified)!==1){setIdentityVerifyNames({firstName:"",lastName:""});setIdentityVerifyDocument(null);setIdentityVerifyImages({front:null,back:null});setIdentityVerifyError("");setIdentityVerifyOpen(true);}}}}}).catch(error=>{if(live)setDetailError(error instanceof Error?error.message:"تعذر تحميل ملف المشترك.");}).finally(()=>{if(live)setDetailLoading(false);});return()=>{live=false;};},[endpoint,detailId,canVerifyIdentity,identityAvailableOnDevice]);
 useEffect(()=>{
  if(detailId!==null||loading)return;
  const storageKey="rl:network-subscribers:return-focus:"+endpoint;
  let id=lastOpenedId.current;
  if(id===null){try{const saved=Number(sessionStorage.getItem(storageKey));if(Number.isSafeInteger(saved)&&saved>0)id=saved;}catch{}}
  if(id===null)return;
  let frame=0,attempts=0,cancelled=false;
  const restoreFocus=()=>{
   if(cancelled)return;
   const targets=Array.from(document.querySelectorAll<HTMLElement>("[data-focus-target-id=\""+id+"\"]"));
   const target=targets.find(element=>element.getClientRects().length>0&&window.getComputedStyle(element).visibility!=="hidden");
   if(target){target.scrollIntoView({block:"center",behavior:"smooth"});target.focus({preventScroll:true});lastOpenedId.current=null;try{sessionStorage.removeItem(storageKey);}catch{};return;}
   if(++attempts<8)frame=requestAnimationFrame(restoreFocus);
  };
  frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(restoreFocus);});
  return()=>{cancelled=true;cancelAnimationFrame(frame);};
 },[detailId,loading,endpoint]);

 const load=async({silent=false}:{silent?:boolean}={})=>{
  if(!silent)setLoading(true);
  setError("");
  try{
   const response=await fetch(endpoint+"/subscribers",{credentials:"include",cache:"no-store"});
   const data=await response.json();
   if(!response.ok)throw new Error(data.message||"تعذر تحميل المشتركين.");
   setItems(data.items||[]);setCategories(data.categories||[]);setServers(data.servers||[]);
  }catch(e){setError(e instanceof Error?e.message:"تعذر تحميل المشتركين.");}
  finally{if(!silent)setLoading(false);}
 };
 useEffect(()=>{void load();},[endpoint]);

 const counts=useMemo(()=>({
  all:items.length,
  active:items.filter(x=>x.status==="active").length,
  suspended:items.filter(x=>x.status==="suspended").length
 }),[items]);
 const verificationCounts=useMemo(()=>({all:items.length,verified:items.filter(x=>Number(x.identity_verified)===1).length,unverified:items.filter(x=>Number(x.identity_verified)!==1).length}),[items]);
 const connectionCounts=useMemo(()=>({all:items.length,online:items.filter(x=>Number(x.is_online)===1).length,offline:items.filter(x=>Number(x.is_online)!==1).length}),[items]);
 const subscriptionCounts=useMemo(()=>({all:items.length,expired:items.filter(x=>Number(x.has_expired_subscription)===1).length,current:items.filter(x=>Number(x.has_current_subscription)===1).length}),[items]);
 const categoryOptions=useMemo(()=>[
  {value:"",label:"كل التصنيفات"},
  ...categories.map(category=>({value:String(category.id),label:category.name,hint:`${items.filter(item=>(item.category_ids||"").split(",").includes(String(category.id))).length.toLocaleString("ar")} مشترك`}))
 ],[categories,items]);
 const serverOptions=useMemo(()=>[
  {value:"",label:"كل السيرفرات"},
  ...servers.map(server=>({value:server.address,label:server.name,hint:`${items.filter(item=>(item.server_addresses||"").split(",").includes(server.address)).length.toLocaleString("ar")} مشترك`,dotClassName:"bg-sky-500"}))
 ],[servers,items]);
 const activeFilterCount=Number(statusFilter!=="all")+Number(verificationFilter!=="all")+Number(connectionFilter!=="all")+Number(subscriptionFilter!=="all")+Number(Boolean(categoryFilter))+Number(Boolean(serverFilter));
 const filtered=useMemo(()=>{
  const q=query.trim().toLowerCase();
  return items.filter(item=>(statusFilter==="all"||item.status===statusFilter)&&(verificationFilter==="all"||(verificationFilter==="verified"?Number(item.identity_verified)===1:Number(item.identity_verified)!==1))&&(connectionFilter==="all"||(connectionFilter==="online"?Number(item.is_online)===1:Number(item.is_online)!==1))&&(subscriptionFilter==="all"||(subscriptionFilter==="expired"?Number(item.has_expired_subscription)===1:Number(item.has_current_subscription)===1))&&(!categoryFilter||(item.category_ids||"").split(",").includes(categoryFilter))&&(!serverFilter||(item.server_addresses||"").split(",").includes(serverFilter))&&(!q||[
   item.first_name,item.last_name,item.phone,item.address,item.categories
  ].some(value=>String(value||"").toLowerCase().includes(q))));
 },[items,query,statusFilter,verificationFilter,connectionFilter,subscriptionFilter,categoryFilter,serverFilter]);

 const setField=<K extends keyof Draft,>(key:K,value:Draft[K])=>setDraft(old=>({...old,[key]:value}));
 const handleIdentityNameChange=useCallback((field:"firstName"|"lastName",value:string)=>setDraft(old=>({...old,[field]:value})),[]);
 const applyIdentityValues=(values:Partial<Pick<Draft,"firstName"|"lastName"|"phone"|"address">>)=>setDraft(old=>{
  const next={...old};
  if(!next.firstName.trim()&&values.firstName)next.firstName=values.firstName.slice(0,100);
  if(!next.lastName.trim()&&values.lastName)next.lastName=values.lastName.slice(0,100);
  if(!next.phone.trim()&&values.phone){const phone=values.phone.replace(/\D/g,"").slice(0,15);if(phone)next.phone=phone;}
  if(!next.address.trim()&&values.address)next.address=values.address.slice(0,10000);
  return next;
 });
 const allSelected=filtered.length>0&&filtered.every(item=>selected.includes(item.id));
 const toggleSelected=(id:number)=>setSelected(old=>old.includes(id)?old.filter(value=>value!==id):[...old,id]);
 const toggleAll=()=>setSelected(old=>allSelected?old.filter(id=>!filtered.some(item=>item.id===id)):Array.from(new Set([...old,...filtered.map(item=>item.id)])));
 const bulkStatus=async(status:"active"|"suspended")=>{
  const ids=[...selected];setBusy(true);setError("");
  try{
   for(const id of ids){
    const response=await fetch(endpoint+"/subscribers",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"status",id,status})});
    const data=await response.json();if(!response.ok)throw new Error(data.message||"تعذر تحديث حالة أحد المشتركين.");
    setItems(current=>current.map(row=>row.id===id?{...row,status}:row));
   }
   setSelected([]);setSelectionMode(false);
  }catch(e){setError(e instanceof Error?e.message:"تعذر تنفيذ العملية الجماعية.");}
  finally{await load({silent:true});setBusy(false);}
 };
 const startCreate=()=>{setDraft({...blank,categoryId:categories.length===1?String(categories[0].id):""});setIdentityDocument(null);setIdentityImages({front:null,back:null});setFieldError("");setStage("form");setEntryMode("manual");onTabChange("create");};
 const advanceOnEnter=(event:KeyboardEvent<HTMLDivElement>)=>{
  if(event.key!=="Enter"||event.defaultPrevented||event.nativeEvent.isComposing)return;
  const current=event.target;
  if(!(current instanceof HTMLInputElement)||current.disabled)return;
  if(!current.value.trim()){if(current.required)current.reportValidity();return;}
  if(!current.checkValidity()){event.preventDefault();current.reportValidity();return;}
  const fields=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input:not([type="hidden"]),textarea,button[aria-haspopup="listbox"]')).filter(field=>!field.hasAttribute("disabled")&&field.getClientRects().length>0);
  const index=fields.indexOf(current);
  if(index<0)return;
  event.preventDefault();
  fields.slice(index+1)[0]?.focus();
 };
 const changeEntryMode=(mode:"manual"|"identity")=>{
  if(mode===entryMode)return;
  setEntryMode(mode);setFieldError("");setIdentityDocument(null);setIdentityImages({front:null,back:null});
  setDraft(current=>mode==="identity"?{...current,firstName:"",lastName:"",phone:"",address:""}:{...current,phone:"",address:""});
 };
 const review=()=>{
  const firstName=draft.firstName.trim();
  const lastName=draft.lastName.trim();
  if(!firstName||!lastName){setFieldError("تحقق من حقلي الاسم والكنية في بيانات الهوية.");return;}
  if(!draft.categoryId){setFieldError("اختر تصنيفًا لإتمام حفظ المشترك.");document.querySelector<HTMLElement>("[data-subscriber-category]")?.scrollIntoView({behavior:"smooth",block:"center"});return;}
  if(entryMode==="identity"){
   setDraft(current=>({...current,firstName,lastName}));
   if(identityDocument?.captureMethod!=="qr"){setFieldError("اقرأ باركود الهوية قبل متابعة الحفظ.");return;}
   if(!identityDocument.nationalNumber.trim()){setFieldError("أكمل الرقم الوطني المستخرج من الهوية قبل الحفظ.");return;}
   if(!draft.phone.trim()||!draft.address.trim()){setFieldError("في إدخال الهوية، أكمل رقم الهاتف والعنوان يدويًا.");return;}
  }
  if(draft.phone.trim()&&!/^[0-9]{1,15}$/.test(draft.phone)){setFieldError("رقم الهاتف يجب أن يتكوّن من أرقام فقط، وبحد أقصى 15 رقمًا.");return;}
  setFieldError("");setStage("review");
 };
 const save=async()=>{
  setBusy(true);setFieldError("");
  try{
   const response=await fetch(`${endpoint}/subscribers`,{
    method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({...draft,entryMode,categoryId:draft.categoryId||null,identityDocument:entryMode==="identity"&&identityDocument?.captureMethod==="qr"?identityDocument:null,identityImages:entryMode==="identity"?identityImages:null})
   });
   const data=await response.json();
   if(!response.ok){
    const backendFields=data.fields&&typeof data.fields==="object"?Object.values(data.fields).filter((value):value is string=>typeof value==="string"):[];
    throw new Error(backendFields.length?backendFields.join(" "):data.message||"تعذر حفظ المشترك.");
   }
   setDraft(blank);setIdentityDocument(null);setIdentityImages({front:null,back:null});setSelected([]);onTabChange("list");await load();
  }catch(e){setFieldError(e instanceof Error?e.message:"تعذر حفظ المشترك.");setStage("form");}
  finally{setBusy(false);}
 };
 const openIdentityPhotos=async()=>{
  if(!detail)return;
  setIdentityPhotosOpen(true);setIdentityPhotosLoading(true);setIdentityPhotosError("");setIdentityPhotos(current=>{Object.values(current).forEach(url=>{if(url)URL.revokeObjectURL(url);});return {front:null,back:null};});
  const next:{front:string|null;back:string|null}={front:null,back:null};
  try{
   for(const side of ["front","back"] as const){
    if(!Number(side==="front"?detail.identity_front_image:detail.identity_back_image))continue;
    const response=await fetch(`${endpoint}/subscribers/${detail.id}/identity-images/${side}`,{credentials:"include",cache:"no-store"});
    if(!response.ok)throw new Error("تعذر تحميل صور الهوية المحفوظة.");
    next[side]=URL.createObjectURL(await response.blob());
   }
   setIdentityPhotos(current=>{Object.values(current).forEach(url=>{if(url)URL.revokeObjectURL(url);});return next;});
  }catch(error){Object.values(next).forEach(url=>{if(url)URL.revokeObjectURL(url);});setIdentityPhotosError(error instanceof Error?error.message:"تعذر تحميل صور الهوية.");}
  finally{setIdentityPhotosLoading(false);}
 };
 const closeIdentityPhotos=()=>{setIdentityPhotosOpen(false);setIdentityPhotos(current=>{Object.values(current).forEach(url=>{if(url)URL.revokeObjectURL(url);});return {front:null,back:null};});};
 const startIdentityVerification=()=>{setIdentityVerifyNames({firstName:"",lastName:""});setIdentityVerifyDocument(null);setIdentityVerifyImages({front:null,back:null});setIdentityVerifyError("");setIdentityCaptureDialogOpen(false);setIdentityVerifyOpen(true);};
 const saveIdentityVerification=async()=>{
  if(!detail)return;
  if(identityVerifyDocument?.captureMethod!=="qr"||!identityVerifyDocument?.nationalNumber.trim()){
   setIdentityVerifyError("اقرأ باركود الهوية وتأكد من استخراج الرقم الوطني قبل الحفظ.");return;
  }
  if(!identityVerifyNames.firstName.trim()||!identityVerifyNames.lastName.trim()){
   setIdentityVerifyError("تعذر استخراج الاسم والكنية من الباركود. أعد قراءة الهوية بوضوح.");return;
  }
  setBusy(true);setIdentityVerifyError("");
  try{
   const response=await fetch(`${endpoint}/subscribers`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"identity-verify",id:detail.id,firstName:identityVerifyNames.firstName,lastName:identityVerifyNames.lastName,identityDocument:identityVerifyDocument,identityImages:identityVerifyImages})});
   const data=await response.json();
   if(!response.ok){const fields=data.fields&&typeof data.fields==="object"?Object.values(data.fields).filter((value):value is string=>typeof value==="string"):[];throw new Error(fields.length?fields.join(" "):data.message||"تعذر توثيق حساب المشترك.");}
   setDetail(current=>current?{...current,identity_verified:1,identity_front_image:identityVerifyImages.front?1:current.identity_front_image,identity_back_image:identityVerifyImages.back?1:current.identity_back_image}:current);
   setItems(current=>current.map(item=>item.id===detail.id?{...item,identity_verified:1}:item));
   setIdentityVerifyOpen(false);setIdentityVerifyDocument(null);setIdentityVerifyImages({front:null,back:null});
   void load({silent:true});
  }catch(caught){setIdentityVerifyError(caught instanceof Error?caught.message:"تعذر توثيق حساب المشترك.");}
  finally{setBusy(false);}
 };
 const changeStatus=async(item:Subscriber)=>{
  const nextStatus=item.status==="active"?"suspended":"active";
  setBusy(true);setError("");
  try{
   const response=await fetch(endpoint+"/subscribers",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"status",id:item.id,status:nextStatus})});
   const data=await response.json();if(!response.ok)throw new Error(data.message||"تعذر تحديث حالة المشترك.");
   setItems(current=>current.map(row=>row.id===item.id?{...row,status:nextStatus}:row));
   await load({silent:true});
  }catch(e){setError(e instanceof Error?e.message:"تعذر تحديث حالة المشترك.");}
  finally{setBusy(false);}
 };
 const openSubscriber=(id:number)=>{if(selectionMode){toggleSelected(id);return;}lastOpenedId.current=id;try{sessionStorage.setItem("rl:network-subscribers:return-focus:"+endpoint,String(id));}catch{}onOpenSubscriber(id);};
 const openSubscriberForVerification=(id:number)=>{if(selectionMode){toggleSelected(id);return;}if(canVerifyIdentity&&identityAvailableOnDevice===true)pendingIdentityVerificationId.current=id;openSubscriber(id);};
 const bytesLabel=(value:string|number)=>{let n=Number(value||0);if(!Number.isFinite(n)||n<0)n=0;const units=["بايت","KB","MB","GB","TB"];let u=0;while(n>=1024&&u<units.length-1){n/=1024;u++;}return n.toLocaleString("ar",{maximumFractionDigits:2})+" "+units[u];};
 const detailDate=(value:string|null)=>{if(!value)return "—";const date=new Date(value);return Number.isNaN(date.getTime())?"—":date.toLocaleString("ar",{dateStyle:"medium",timeStyle:"short"});};
 const subscriberIdBadge=(id:number)=><span dir="ltr" aria-label={`معرّف المشترك ${id}`} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[#d2deea] bg-[#f0f5fa] px-2 text-[9px] font-medium tracking-wide text-[#45627f] shadow-[inset_0_1px_0_rgba(255,255,255,.9)] dark:border-white/10 dark:bg-white/[.045] dark:text-slate-300"><span className="grid h-4 w-4 place-items-center rounded-full bg-white text-[#55728f] dark:bg-white/[.08]"><Hash className="h-2.5 w-2.5"/></span><span className="text-slate-500 dark:text-slate-400">ID</span><strong className="font-semibold text-[#294c70] dark:text-slate-200">{id}</strong></span>;
 const statusPill=(item:Subscriber)=>{const active=item.status==="active",Icon=active?CheckCircle2:CircleX;return <span className={active?"inline-flex items-center gap-1 rounded-full border border-emerald-200/70 bg-emerald-50/60 px-2 py-1 text-[9px] font-medium text-emerald-700 dark:border-emerald-300/15 dark:bg-emerald-500/[.06] dark:text-emerald-300":"inline-flex items-center gap-1 rounded-full border border-red-200/70 bg-red-50/60 px-2 py-1 text-[9px] font-medium text-red-700 dark:border-red-300/15 dark:bg-red-500/[.06] dark:text-red-300"}><Icon className="h-3 w-3"/>{statusLabel[item.status]}</span>;};
 const serviceCounts=(item:Subscriber)=><div className="flex flex-wrap items-center gap-2">
  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200/80 bg-slate-50/70 px-2 py-1 text-[10px] text-slate-600 dark:border-white/[.08] dark:bg-white/[.035] dark:text-slate-300"><Users className="h-3 w-3 text-slate-500"/>{Number(item.pppoe_count||0).toLocaleString("ar")} PPPoE</span>
  <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200/80 bg-slate-50/70 px-2 py-1 text-[10px] text-slate-600 dark:border-white/[.08] dark:bg-white/[.035] dark:text-slate-300"><Wifi className="h-3 w-3 text-slate-500"/>{Number(item.hotspot_count||0).toLocaleString("ar")} Hotspot</span>
 </div>;
 const identityContactFields=entryMode==="identity"?<section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.025]" aria-label="بيانات التواصل قبل تصوير الهوية"><h3 className="mb-3 flex items-center gap-2 text-xs font-bold text-[#17386d]"><Phone className="h-4 w-4 text-emerald-600"/>بيانات التواصل</h3><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-[11px] font-medium">رقم الهاتف *<ProjectInput required type="tel" inputMode="numeric" pattern="[0-9]{1,15}" title="أرقام فقط، بحد أقصى 15 رقمًا" autoComplete="tel" className={inputClass} value={draft.phone} onChange={e=>setField("phone",e.target.value.replace(/\D/g,"").slice(0,15))} maxLength={15}/></label><label data-subscriber-field="address" className="block space-y-1 text-[11px] font-medium">العنوان *<SubscriberAutocomplete endpoint={endpoint} field="address" value={draft.address} onChange={value=>setField("address",value)} icon={MapPin} placeholder="اكتب حرفين لعرض العناوين المحفوظة"/></label></div></section>:null;
 const actions=(item:Subscriber)=>{if(!canChangeStatus)return null;const enabled=item.status==="active";return <ProjectTooltip label={enabled?"إيقاف حساب المشترك":"تفعيل حساب المشترك"} disabled={busy}><button type="button" role="switch" aria-checked={enabled} aria-label={"ملف "+item.first_name+" "+item.last_name+": "+(enabled?"مفعّل":"غير مفعّل")+"، اضغط لتبديل الحالة"} disabled={busy} onClick={event=>{event.stopPropagation();void changeStatus(item)}} className={`inline-flex min-h-[25px] items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${enabled?"border-emerald-200/80 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-50 focus-visible:ring-emerald-400 dark:border-emerald-300/15 dark:bg-emerald-500/[.06] dark:text-emerald-200":"border-rose-200/80 bg-rose-50/50 text-rose-700 hover:bg-rose-50 focus-visible:ring-rose-400 dark:border-rose-300/15 dark:bg-rose-500/[.06] dark:text-rose-200"}`}><span className="min-w-[2.8rem] text-center">{enabled?"مفعّل":"غير مفعّل"}</span><span className={`relative h-3 w-5 shrink-0 rounded-full p-0.5 transition-colors duration-200 motion-reduce:transition-none ${enabled?"bg-emerald-600/70":"bg-rose-600/70"}`}><i className={`block h-2 w-2 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${enabled?"translate-x-0":"-translate-x-2"}`}/></span></button></ProjectTooltip>};

 return <div className="space-y-3 sm:space-y-4 text-[13px]">
{detailId?(detailLoading?<CollectionState loading>جارٍ تحميل ملف المشترك وخطوطه...</CollectionState>:detailError?<CollectionState>{detailError}<div className="mt-3"><ProjectButton variant="secondary" onClick={onBackToSubscribers}><ArrowLeft/>العودة للقائمة</ProjectButton></div></CollectionState>:detail?<section className="space-y-4">
 <div className="flex flex-wrap items-center justify-end gap-2">{Number(detail.identity_verified)===1&&<ProjectButton type="button" variant="secondary" onClick={()=>void openIdentityPhotos()}><Images/>عرض صور الهوية</ProjectButton>}<ProjectButton variant="secondary" onClick={onBackToSubscribers}><ArrowLeft/>العودة للقائمة</ProjectButton></div>
 <article className="overflow-hidden rounded-2xl border border-[#c5d7e9] bg-gradient-to-br from-white via-[#f8fbff] to-[#eef5fc] p-4 shadow-[0_5px_18px_rgba(58,84,112,.07)] dark:border-white/[.12] dark:from-[#142b43] dark:via-[#10263d] dark:to-[#0d2238]">
  <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><ProjectCardIcon icon={UserRound}/><div className="min-w-0"><h2 className="break-words text-sm font-bold text-[#17386d] dark:text-slate-100">{detail.first_name} {detail.last_name}</h2><p className="mt-1 text-[10px] text-slate-500">ملف المشترك #{detail.id}</p></div></div><div className="flex flex-wrap items-center gap-2">{statusPill(detail)}<IdentityVerificationBadge verified={detail.identity_verified} onClick={Number(detail.identity_verified)!==1&&canVerifyIdentity&&identityAvailableOnDevice===true?startIdentityVerification:undefined}/></div></div>
  {Number(detail.identity_verified)!==1&&<div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-300/15 dark:bg-amber-500/[.06]"><div className="flex min-w-0 items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"/><div><p className="text-xs font-semibold text-amber-800 dark:text-amber-200">هذا الحساب غير موثق</p><p className="mt-1 text-[10px] leading-5 text-amber-800/80 dark:text-amber-100/70">وثّق بيانات المشترك بقراءة باركود الهوية من القارئ المتصل.</p></div></div><ProjectButton disabled={!canVerifyIdentity||identityAvailableOnDevice!==true||busy} onClick={startIdentityVerification}><ScanLine/>توثيق الحساب بالهوية</ProjectButton>{identityAvailableOnDevice===false&&<p className="w-full text-[10px] text-amber-800 dark:text-amber-200">التوثيق بالهوية متاح من متصفح اللابتوب فقط.</p>}{!canVerifyIdentity&&<p className="w-full text-[10px] text-amber-800 dark:text-amber-200">لا تملك صلاحية تعديل ملفات المشتركين.</p>}</div>}
  {Number(detail.identity_verified)===1&&<p className="mt-3 flex items-center gap-2 border-t border-blue-100 pt-3 text-[10px] text-blue-700 dark:border-white/10 dark:text-blue-200"><BadgeCheck className="h-4 w-4"/>تم التحقق من بيانات الهوية لهذا الحساب.</p>}
 </article>
 <div className="relative isolate grid w-full max-w-[420px] grid-cols-2 overflow-hidden rounded-[16px] border border-[#c5d7e9] bg-[#e8f0f8] p-1 shadow-inner dark:border-white/[.12] dark:bg-[#071b2f]" role="tablist" aria-label="أقسام ملف المشترك">
 <span aria-hidden="true" className={`pointer-events-none absolute inset-y-1 right-1 z-0 w-[calc(50%_-_4px)] rounded-[12px] bg-gradient-to-br from-[#0758e9] to-[#2879f5] shadow-[0_5px_14px_rgba(7,88,233,.28)] transition-transform duration-[420ms] ease-[cubic-bezier(.22,.8,.25,1)] motion-reduce:transition-none ${detailTab==="lines"?"-translate-x-full":"translate-x-0"}`}/>
 <button type="button" role="tab" aria-selected={detailTab==="profile"} onClick={()=>setDetailTab("profile")} className={`relative z-10 flex min-h-11 items-center justify-center gap-2 rounded-[12px] px-3 text-xs font-semibold transition-colors duration-[420ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90 motion-reduce:transition-none sm:px-4 ${detailTab==="profile"?"text-white":"text-slate-600 hover:text-[#0758e9] dark:text-slate-300 dark:hover:text-white"}`}><UserRound className={`h-4 w-4 transition-colors duration-[420ms] motion-reduce:transition-none ${detailTab==="profile"?"text-white":"text-blue-600"}`}/>بيانات المشترك</button>
 <button type="button" role="tab" aria-selected={detailTab==="lines"} onClick={()=>setDetailTab("lines")} className={`relative z-10 flex min-h-11 items-center justify-center gap-2 rounded-[12px] px-3 text-xs font-semibold transition-colors duration-[420ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90 motion-reduce:transition-none sm:px-4 ${detailTab==="lines"?"text-white":"text-slate-600 hover:text-[#0758e9] dark:text-slate-300 dark:hover:text-white"}`}><Router className={`h-4 w-4 transition-colors duration-[420ms] motion-reduce:transition-none ${detailTab==="lines"?"text-white":"text-cyan-600"}`}/>الخطوط المفعّلة <span className={`rounded-full px-2 py-0.5 text-[10px] transition-colors duration-[420ms] motion-reduce:transition-none ${detailTab==="lines"?"bg-white/20 text-white":"bg-white/80 text-blue-700 dark:bg-white/[.08] dark:text-blue-200"}`}>{detailLines.length.toLocaleString("ar")}</span></button>
</div>
 {detailTab==="profile"?<div className="space-y-3 ui-state-enter"><h3 className="flex items-center gap-2 px-1 text-xs font-bold text-[#17386d] dark:text-slate-100"><ProjectCardIcon icon={FileText}/>بيانات الملف</h3><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
 {[{label:"رقم الهاتف",value:detail.phone||"—",icon:Phone,tone:"text-emerald-600"},{label:"العنوان",value:detail.address||"—",icon:MapPin,tone:"text-rose-500"},{label:"التصنيف",value:detail.categories||"بلا تصنيف",icon:Tags,tone:"text-violet-600"},{label:"كود الدفع",value:detail.payment_code||"—",icon:CreditCard,tone:"text-amber-600"},{label:"المدير المسؤول",value:detail.manager_name||"—",icon:Users,tone:"text-cyan-600"},{label:"تاريخ إضافة الملف",value:detailDate(detail.created_at),icon:CalendarDays,tone:"text-blue-600"}].map(field=><div key={field.label} className="rounded-xl border border-[#b8cce0] bg-[#f3f8fd] p-3 shadow-[0_3px_10px_rgba(55,85,115,.06)] transition-colors hover:border-[#8fb5dc] dark:border-white/[.12] dark:bg-[#142b43] dark:hover:border-white/[.20]"><div className="flex items-center gap-2 text-[10px] text-slate-500"><span className="grid h-8 w-8 place-items-center rounded-[10px] bg-white shadow-sm dark:bg-white/[.06]"><field.icon className={`h-4 w-4 ${field.tone}`}/></span>{field.label}</div><div className="mt-2 break-words text-xs font-bold text-[#19395e] dark:text-slate-100">{field.value}</div></div>)}</div>{detail.notes&&<div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-300/10 dark:bg-blue-500/[.06]"><div className="flex items-center gap-2 text-[10px] text-slate-500"><FileText className="h-4 w-4 text-blue-600"/>ملاحظات</div><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5">{detail.notes}</p></div>}</div>
 :detailLines.length?<div className="grid gap-3 xl:grid-cols-2 ui-state-enter">{detailLines.map(line=><article key={`${line.kind}-${line.id}`} className="overflow-hidden rounded-2xl border border-[#a9c2da] bg-white shadow-[0_6px_18px_rgba(58,84,112,.08)] dark:border-white/[.14] dark:bg-[#10263d] dark:shadow-none"><header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ccdae8] bg-[#f1f7fd] px-4 py-3 dark:border-white/[.10] dark:bg-white/[.035]"><div className="flex min-w-0 items-center gap-2.5"><ProjectCardIcon icon={line.kind==="pppoe"?Radio:Wifi}/><div className="min-w-0"><h3 className="text-xs font-bold text-[#17386d] dark:text-slate-100">{line.kind==="pppoe"?"PPPoE":"Hotspot"} · {line.service_name||line.line_name||"خدمة مفعّلة"}</h3><p dir="ltr" className="mt-1 break-all text-[11px] text-slate-500">{line.username}</p></div></div><span className={Number(line.live_sessions)>0?"inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300":"inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-white/[.06] dark:text-slate-300"}><i className={`h-1.5 w-1.5 rounded-full ${Number(line.live_sessions)>0?"bg-emerald-500 animate-pulse":"bg-slate-400"}`}/>{Number(line.live_sessions)>0?"متصل":"غير متصل"}</span></header><div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3"><div className="rounded-xl bg-blue-50/70 p-2.5 dark:bg-blue-500/[.06]"><div className="text-[10px] text-slate-500">السحب الصادر</div><div className="mt-1 text-xs font-bold">{bytesLabel(line.upload_bytes)}</div></div><div className="rounded-xl bg-cyan-50/70 p-2.5 dark:bg-cyan-500/[.06]"><div className="text-[10px] text-slate-500">السحب الوارد</div><div className="mt-1 text-xs font-bold">{bytesLabel(line.download_bytes)}</div></div><div className="rounded-xl bg-violet-50/70 p-2.5 dark:bg-violet-500/[.06]"><div className="text-[10px] text-slate-500">الجلسات الحالية</div><div className="mt-1 text-xs font-bold">{Number(line.live_sessions).toLocaleString("ar")}</div></div></div>{Number(line.live_sessions)>0&&<div className="grid gap-2 border-t border-slate-200/80 px-4 py-3 text-[10px] dark:border-white/[.08] sm:grid-cols-2"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-600"/>آخر تحديث: {detailDate(line.last_seen)}</div><div className="flex items-center gap-2"><Router className="h-4 w-4 text-blue-600"/>NAS: <span dir="ltr">{line.nas_ip||"—"}</span></div><div className="flex items-center gap-2"><Radio className="h-4 w-4 text-violet-600"/>IP الجلسة: <span dir="ltr">{line.framed_ip||"—"}</span></div><div className="flex items-center gap-2"><Wifi className="h-4 w-4 text-cyan-600"/>MAC: <span dir="ltr">{line.calling_station||"—"}</span></div></div>}</article>)}</div>:<CollectionState>لا توجد خطوط خدمة مفعّلة مرتبطة بهذا المشترك.</CollectionState>}
 <ProjectDialog open={identityVerifyOpen} title="توثيق حساب المشترك" description="اقرأ باركود الهوية ثم التقط وجهيها اختياريًا لحفظهما مع الملف." onClose={()=>{if(!busy&&!identityCaptureDialogOpen)setIdentityVerifyOpen(false);}} busy={busy||identityCaptureDialogOpen} maxWidth="max-w-4xl" footer={<><ProjectButton variant="secondary" disabled={busy||identityCaptureDialogOpen} onClick={()=>setIdentityVerifyOpen(false)}><X/>إلغاء</ProjectButton><ProjectButton disabled={busy||identityCaptureDialogOpen||identityVerifyDocument?.captureMethod!=="qr"||!identityVerifyDocument?.nationalNumber.trim()||!identityVerifyNames.firstName.trim()||!identityVerifyNames.lastName.trim()} onClick={()=>void saveIdentityVerification()}><BadgeCheck/>حفظ التوثيق</ProjectButton></>}>{identityVerifyError&&<p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{identityVerifyError}</p>}<SubscriberIdentityImport currentValues={{}} onApply={values=>setIdentityVerifyNames(current=>({...current,...values}))} onNameChange={(field,value)=>setIdentityVerifyNames(current=>({...current,[field]:value}))} onIdentityDocumentChange={setIdentityVerifyDocument} onIdentityImagesChange={setIdentityVerifyImages} onBackToList={()=>setIdentityVerifyOpen(false)} onCaptureDialogChange={setIdentityCaptureDialogOpen}/></ProjectDialog>
 <ProjectDialog open={identityPhotosOpen} title="صور هوية المشترك" description="الصور المحفوظة عند إضافة ملف المشترك." onClose={closeIdentityPhotos} maxWidth="max-w-4xl" footer={<ProjectButton variant="secondary" onClick={closeIdentityPhotos}><X/>إغلاق</ProjectButton>}>{(Number(detail.identity_front_image)||Number(detail.identity_back_image))===0?<div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-white/[.03]">لم تُحفظ صور وجهي الهوية لهذا المشترك.</div>:<div className="grid gap-4 sm:grid-cols-2">{([ ["front","الوجه الأمامي",detail.identity_front_image], ["back","الوجه الخلفي",detail.identity_back_image] ] as const).filter(([, , available])=>Number(available)>0).map(([side,label])=><figure key={side} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[.03]"><figcaption className="mb-2 text-xs font-bold">{label}</figcaption>{identityPhotos[side]?<Image src={identityPhotos[side]!} alt={label} width={1200} height={800} unoptimized className="max-h-[65vh] w-full rounded-xl object-contain"/>:<div className="grid min-h-48 place-items-center rounded-xl bg-white text-xs text-slate-500 dark:bg-white/[.03]">{identityPhotosLoading?"جارٍ تحميل الصورة…":identityPhotosError||"الصورة غير متاحة."}</div>}</figure>)}</div>}</ProjectDialog></section>:<CollectionState>تعذر العثور على ملف المشترك.</CollectionState>):tab==="create"?<section className="space-y-4">{fieldError&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{fieldError}</p>}
{stage==="form"?<div className="space-y-4" onKeyDown={advanceOnEnter}><section className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[.025]">
<div className="flex flex-wrap items-center gap-2"><div className={`relative isolate grid min-w-0 flex-1 ${identityAvailableOnDevice?"grid-cols-2":"grid-cols-1"} rounded-[14px] border border-[#c5d7e9] bg-[#e8f0f8] p-1 dark:border-white/[.12] dark:bg-[#071b2f]`} role="tablist" aria-label="طريقة إدخال بيانات المشترك">
<span aria-hidden="true" className={`pointer-events-none absolute inset-y-1 rounded-[11px] bg-[#0758e9] shadow-sm transition-[left,right,width] duration-300 ease-out motion-reduce:transition-none ${identityAvailableOnDevice?"w-[calc(50%-4px)]":"right-1 w-[calc(100%-8px)]"} ${entryMode==="manual"?"right-1":"left-1"}`}/>
<button type="button" role="tab" aria-selected={entryMode==="manual"} onClick={()=>changeEntryMode("manual")} className={`relative z-10 flex min-h-11 items-center justify-center gap-2 rounded-[11px] px-2 text-[11px] font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 motion-reduce:transition-none sm:text-xs ${entryMode==="manual"?"text-white":"text-slate-600 hover:text-[#0758e9] dark:text-slate-300 dark:hover:text-white"}`}><UserRound className={`h-4 w-4 ${entryMode==="manual"?"text-white":"text-blue-600"}`}/>إدخال يدوي</button>
{identityAvailableOnDevice&&<button type="button" role="tab" aria-selected={entryMode==="identity"} onClick={()=>changeEntryMode("identity")} className={`relative z-10 flex min-h-11 items-center justify-center gap-2 rounded-[11px] px-2 text-[11px] font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 motion-reduce:transition-none sm:text-xs ${entryMode==="identity"?"text-white":"text-slate-600 hover:text-[#0758e9] dark:text-slate-300 dark:hover:text-white"}`}><span className="relative grid h-5 w-5 place-items-center"><span aria-hidden="true" className={`absolute inset-0 rounded-full ${entryMode==="identity"?"bg-white/25":"bg-blue-400/20"} ${entryMode==="identity"?"animate-ping motion-reduce:animate-none":""}`}/><ScanLine className={`relative h-4 w-4 ${entryMode==="identity"?"text-white":"text-blue-600"}`}/></span>عن طريق الهوية</button>}
</div>{entryMode==="manual"&&<ProjectButton type="button" variant="secondary" onClick={()=>onTabChange("list")}><ArrowLeft/>العودة للقائمة</ProjectButton>}</div>
{!identityAvailableOnDevice&&<ProjectInfoCard tone="warning" className="mt-3"><div className="flex items-start gap-2.5"><ProjectCardIcon icon={Laptop} tone="warning"/><p className="text-[10px] leading-5 text-amber-900 dark:text-amber-100">إضافة بيانات المشترك عن طريق الهوية متاحة من متصفح اللابتوب فقط بعد تثبيت إضافة Lord Radius وربط قارئ الهوية. استخدم الإدخال اليدوي على الهاتف.</p></div></ProjectInfoCard>}
<p key={entryMode} className="ui-state-enter mt-2 text-center text-[10px] text-slate-500">{entryMode==="manual"?"الاسم والكنية":"التقاط بيانات الهوية"}</p>
</section>{entryMode==="identity"&&<div className="ui-state-enter"><SubscriberIdentityImport currentValues={{firstName:draft.firstName,lastName:draft.lastName}} onApply={applyIdentityValues} onNameChange={handleIdentityNameChange} onIdentityDocumentChange={setIdentityDocument} onIdentityImagesChange={setIdentityImages} onBackToList={()=>onTabChange("list")} renderBeforeCapture={identityContactFields}/></div>}{entryMode==="manual"&&<section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.025]"><h3 className="mb-1 flex items-center gap-2 text-xs font-bold text-[#17386d]"><UserRound className="h-4 w-4 text-blue-600"/>الاسم والكنية</h3><p className="mb-3 text-[10px] text-slate-500">أدخل اسم المشترك وكنيته فقط في هذا القسم. اكتب حرفين لعرض الاقتراحات. Tab يختار الاقتراح، وEnter ينتقل للحقل التالي بعد إدخال قيمة صحيحة.</p><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-[11px] font-medium">الاسم *<SubscriberAutocomplete endpoint={endpoint} field="firstName" value={draft.firstName} onChange={value=>setField("firstName",value)} icon={UserRound} placeholder="اكتب حرفين لعرض الاقتراحات"/></label><label className="space-y-1 text-[11px] font-medium">الكنية *<SubscriberAutocomplete endpoint={endpoint} field="lastName" value={draft.lastName} onChange={value=>setField("lastName",value)} icon={UserRound} placeholder="اكتب حرفين لعرض الاقتراحات"/></label></div></section>}<section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.025]"><h3 className="mb-3 flex items-center gap-2 text-xs font-bold text-[#17386d]"><Tags className="h-4 w-4 text-violet-600"/>تفاصيل إضافية</h3><div data-subscriber-category className="space-y-1 text-[11px] font-medium">التصنيف *<ProjectDropdown icon={Tags} value={draft.categoryId} onChange={value=>{setField("categoryId",value);if(value)requestAnimationFrame(()=>{const button=document.querySelector<HTMLElement>("[data-subscriber-review] button");button?.scrollIntoView({behavior:"smooth",block:"center"});button?.focus({preventScroll:true});});}} options={[{value:"",label:"بلا تصنيف"},...categories.map(category=>({value:String(category.id),label:category.name}))]} placeholder="اختر تصنيفًا"/></div><label className="mt-3 block space-y-1 text-[11px] font-medium">ملاحظات إضافية<textarea className={`min-h-20 w-full rounded-xl border p-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 ${inputClass}`} value={draft.notes} onChange={e=>setField("notes",e.target.value)} maxLength={10000}/></label></section><section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.025]"><h3 className="mb-2 flex items-center gap-2 text-xs font-bold"><ShieldCheck className="h-4 w-4 text-emerald-600"/>حالة ملف المشترك</h3><div className="grid grid-cols-2 gap-2">{(["active","suspended"] as const).map(value=><button key={value} type="button" onClick={()=>setField("status",value)} className={`h-9 rounded-xl border text-xs font-semibold ${draft.status===value?value==="active"?"border-emerald-300 bg-emerald-50 text-emerald-700":"border-red-300 bg-red-50 text-red-600":"border-slate-200 text-slate-500"}`}>{statusLabel[value]}</button>)}</div></section><div data-subscriber-review className="flex justify-end"><ProjectButton onClick={review}><BadgeCheck/>مراجعة البيانات</ProjectButton></div></div>:<ProjectDialog open={stage==="review"} title="مراجعة بيانات المشترك" description="راجع المعلومات المستخرجة والمدخلة قبل الحفظ." onClose={()=>setStage("form")} busy={busy} maxWidth="max-w-3xl" footer={<><ProjectButton variant="secondary" disabled={busy} onClick={()=>setStage("form")}>رجوع للتعديل</ProjectButton><ProjectButton disabled={busy} onClick={()=>void save()}><Check/>تأكيد الحفظ</ProjectButton></>}><div className="space-y-4"><section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-slate-50 p-4 shadow-sm dark:border-white/10 dark:from-[#17263b] dark:via-[#142338] dark:to-[#122033]"><div className="mb-4"><h3 className="flex items-center gap-2 text-xs font-bold text-[#17386d] dark:text-slate-100"><BadgeCheck className="h-4 w-4 text-blue-600"/>البيانات المدخلة</h3></div><dl className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">{[{k:"الاسم والكنية",v:draft.firstName+" "+draft.lastName,icon:UserRound,tone:"text-blue-600",iconBg:"bg-blue-50 dark:bg-blue-500/10"},{k:"رقم الهاتف",v:draft.phone,icon:Phone,tone:"text-emerald-600",iconBg:"bg-emerald-50 dark:bg-emerald-500/10"},{k:"العنوان",v:draft.address,icon:MapPin,tone:"text-rose-600",iconBg:"bg-rose-50 dark:bg-rose-500/10"},{k:"الحالة",v:statusLabel[draft.status],icon:ShieldCheck,tone:"text-emerald-600",iconBg:"bg-emerald-50 dark:bg-emerald-500/10"},{k:"التصنيف",v:categories.find(x=>String(x.id)===draft.categoryId)?.name||"بلا تصنيف",icon:Tags,tone:"text-violet-600",iconBg:"bg-violet-50 dark:bg-violet-500/10"}].map(field=>{const Icon=field.icon;return <div key={field.k} className="min-w-0 rounded-xl border border-slate-200/80 bg-white/90 p-3 shadow-[0_2px_8px_rgba(31,56,86,.04)] dark:border-white/10 dark:bg-white/[.035]"><div className="flex items-center gap-2"><span className={"grid h-8 w-8 shrink-0 place-items-center rounded-lg "+field.iconBg}><Icon className={"h-4 w-4 "+field.tone}/></span><dt className="text-[10px] font-medium text-slate-500">{field.k}</dt></div><dd className="mt-2 break-words text-xs font-semibold text-[#17386d] dark:text-slate-100">{field.v||"—"}</dd></div>})}</dl>{identityDocument?.captureMethod==="qr"&&<section className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-300/10 dark:bg-emerald-500/[.06]"><div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-emerald-800 dark:text-emerald-200"><BadgeCheck className="h-4 w-4"/>بيانات الهوية التي ستُحفظ<IdentityVerificationBadge verified={1}/></div><dl className="mt-3 grid gap-2 text-[10px] sm:grid-cols-2"><div><dt className="text-slate-500">اسم الأب</dt><dd className="mt-1 font-semibold">{identityDocument.fatherName||"—"}</dd></div><div><dt className="text-slate-500">اسم الأم</dt><dd className="mt-1 font-semibold">{identityDocument.motherName||"—"}</dd></div><div><dt className="text-slate-500">محل وتاريخ الولادة</dt><dd className="mt-1 font-semibold">{identityDocument.birthPlaceDate||"—"}</dd></div><div><dt className="text-slate-500">الرقم الوطني</dt><dd className="mt-1 font-semibold" dir="ltr">{identityDocument.nationalNumber||"—"}</dd></div></dl></section>}{draft.notes&&<div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/70 p-3 dark:border-amber-300/10 dark:bg-amber-500/[.06]"><div className="flex items-center gap-2 text-[10px] font-semibold text-amber-700 dark:text-amber-200"><FileText className="h-4 w-4"/>ملاحظات إضافية</div><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-700 dark:text-slate-200">{draft.notes}</p></div>}</section><p className="text-[11px] leading-5 text-slate-500">سيُسند الملف تلقائيًا إلى مديرك الحالي. عند الاستيراد من الهوية تُحفظ بيانات الهوية وحالة مصدرها؛ تُحفظ صور الوجهين الملتقطة اختياريًا مع ملف المشترك.</p></div></ProjectDialog>}</section>:<>
 <CollectionToolbar icon={Users} title="المشتركون" description="ملفات الأشخاص وحسابات الخدمة المرتبطة بهم" view={view} onViewChange={setView} selectionMode={selectionMode} onSelectionModeChange={setSelectionMode} allSelected={allSelected} onToggleAll={toggleAll} selectionAcrossViews showSelectionControl query={query} onQueryChange={setQuery} searchPlaceholder="بحث بالاسم أو الهاتف أو التصنيف" searchAction={<button type="button" aria-label="تصفية المشتركين" aria-expanded={filterPanelOpen} aria-controls="subscriber-filter-panel" onClick={()=>setFilterPanelOpen(open=>!open)} className={`group inline-flex h-8 items-center gap-1.5 rounded-l-none rounded-r-md border-0 border-r border-slate-200 px-2 text-[10px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 dark:border-white/10 ${filterPanelOpen?"bg-[#eaf1f8] text-[#315d8b] dark:bg-blue-500/[.10] dark:text-blue-200":"bg-transparent text-slate-600 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-white/[.06]"}`}><ListFilter className={`h-3.5 w-3.5 text-[#547493] transition-transform duration-300 motion-reduce:transition-none dark:text-slate-400 ${filterPanelOpen?"rotate-90":"group-hover:rotate-[-6deg]"}`}/><span className="hidden min-[380px]:inline">تصفية</span>{activeFilterCount>0&&<span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#6684a3] px-1 text-[9px] text-white">{activeFilterCount}</span>}<ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${filterPanelOpen?"rotate-180":""}`}/></button>} primaryAction={canCreate?<ProjectButton onClick={startCreate}><Plus/>إضافة بيانات مشترك</ProjectButton>:undefined}/>
{filterPanelOpen&&<section id="subscriber-filter-panel" aria-label="خيارات تصفية المشتركين" className="ui-state-enter min-w-0 rounded-2xl border border-[#c7d5e4] bg-[#eef3f9] p-4 shadow-[0_10px_26px_rgba(31,56,86,.09)] dark:border-white/10 dark:bg-[#14243a]"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-xs font-bold text-[#17386d] dark:text-slate-100"><SlidersHorizontal className="h-4 w-4 text-blue-600"/>خيارات التصفية</h3><button type="button" onClick={()=>setFilterPanelOpen(false)} aria-label="إغلاق خيارات التصفية" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:hover:bg-white/5"><X className="h-4 w-4"/></button></div><div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3"><SubscriberFilterGroup icon={ShieldCheck} title="حالة التفعيل" tone="activation"><SubscriberFilterChoices value={statusFilter} onChange={setStatusFilter} items={[{value:"all",label:"الكل",count:counts.all,icon:Users,accent:"text-blue-500"},{value:"active",label:"مفعّل",count:counts.active,icon:CheckCircle2,accent:"text-emerald-600"},{value:"suspended",label:"غير مفعّل",count:counts.suspended,icon:CircleX,accent:"text-red-500"}]}/></SubscriberFilterGroup><SubscriberFilterGroup icon={Wifi} title="حالة الاتصال" tone="connection"><SubscriberFilterChoices value={connectionFilter} onChange={setConnectionFilter} items={[{value:"all",label:"الكل",count:connectionCounts.all,icon:Router,accent:"text-blue-500"},{value:"online",label:"متصل",count:connectionCounts.online,icon:Wifi,accent:"text-emerald-600"},{value:"offline",label:"غير متصل",count:connectionCounts.offline,icon:WifiOff,accent:"text-slate-500"}]}/></SubscriberFilterGroup><SubscriberFilterGroup icon={Clock3} title="حالة الاشتراك" tone="subscription"><SubscriberFilterChoices value={subscriptionFilter} onChange={setSubscriptionFilter} items={[{value:"all",label:"الكل",count:subscriptionCounts.all,icon:Clock3,accent:"text-blue-500"},{value:"expired",label:"منتهي",count:subscriptionCounts.expired,icon:CircleX,accent:"text-red-500"},{value:"current",label:"ساري",count:subscriptionCounts.current,icon:CheckCircle2,accent:"text-emerald-600"}]}/></SubscriberFilterGroup><SubscriberFilterGroup icon={Tags} title="التصنيف" tone="category"><ProjectDropdown value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} compact searchable searchPlaceholder="ابحث عن تصنيف" placeholder="كل التصنيفات"/></SubscriberFilterGroup><SubscriberFilterGroup icon={Server} title="السيرفر" tone="server"><ProjectDropdown value={serverFilter} onChange={setServerFilter} options={serverOptions} compact searchable searchPlaceholder="ابحث عن سيرفر" placeholder="كل السيرفرات"/></SubscriberFilterGroup><SubscriberFilterGroup icon={BadgeCheck} title="حالة التوثيق" tone="identity"><SubscriberFilterChoices value={verificationFilter} onChange={setVerificationFilter} items={[{value:"all",label:"الكل",count:verificationCounts.all,icon:Users,accent:"text-blue-500"},{value:"verified",label:"موثق",count:verificationCounts.verified,icon:BadgeCheck,accent:"text-emerald-600"},{value:"unverified",label:"غير موثق",count:verificationCounts.unverified,icon:ShieldAlert,accent:"text-red-500"}]}/></SubscriberFilterGroup></div>{activeFilterCount>0&&<div className="mt-4 flex justify-end border-t border-slate-100 pt-3 dark:border-white/10"><button type="button" onClick={()=>{setStatusFilter("all");setVerificationFilter("all");setConnectionFilter("all");setSubscriptionFilter("all");setCategoryFilter("");setServerFilter("");}} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-blue-700 transition hover:bg-blue-50 hover:text-blue-900 dark:text-blue-300 dark:hover:bg-white/[.05]">مسح جميع الفلاتر</button></div>}</section>}
<BulkSelectionBar count={selected.length} noun="مشترك" allSelected={allSelected} onToggleAll={toggleAll} onClearSelection={()=>setSelected([])} show={{activate:true,suspend:true}} handlers={{activate:()=>void bulkStatus("active"),suspend:()=>void bulkStatus("suspended")}}/>
<div className="text-left text-[11px] text-slate-500">{filtered.length.toLocaleString("ar")} مشترك</div>{error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
{loading?<CollectionState loading>جارٍ تحميل المشتركين...</CollectionState>:!filtered.length?<CollectionState>{query||activeFilterCount>0?"لا توجد نتائج مطابقة.":"لا يوجد مشتركين بعد."}</CollectionState>:view==="grid"?<CollectionGrid>{filtered.map(item=><CollectionCard key={item.id} focusTargetId={item.id} selected={selected.includes(item.id)} selectionMode={selectionMode} onToggle={()=>toggleSelected(item.id)} onOpen={()=>openSubscriber(item.id)}><div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 dark:border-blue-300/10 dark:bg-blue-500/[.06]"><span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400"><Hash className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300"/>معرّف المشترك</span>{subscriberIdBadge(item.id)}</div><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-2.5"><ProjectCardIcon icon={UserRound}/><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><h3 className="break-words text-sm font-semibold text-[#17386d]">{item.first_name} {item.last_name}</h3><IdentityVerificationBadge verified={item.identity_verified} onClick={Number(item.identity_verified)!==1&&canVerifyIdentity&&identityAvailableOnDevice===true?()=>openSubscriberForVerification(item.id):undefined}/></div></div></div>{statusPill(item)}</div><div className="mt-3 space-y-2 border-t border-slate-200 pt-3">{item.phone&&<div className="flex items-center gap-2 text-xs"><Phone className="h-4 w-4 text-emerald-500"/><span dir="ltr">{item.phone}</span></div>}{item.address&&<div className="flex items-start gap-2 text-xs"><MapPin className="mt-0.5 h-4 w-4 text-rose-500"/><span className="break-words">{item.address}</span></div>}{item.categories&&<div className="text-[11px] text-slate-500">{item.categories}</div>}{serviceCounts(item)}</div>{canChangeStatus&&!selectionMode&&<div className="mt-3 flex justify-end border-t border-slate-200 pt-2">{actions(item)}</div>}</CollectionCard>)}</CollectionGrid>:<><CollectionTable minWidth="1000px" rowCards><CollectionTableHead rowCards><tr>{selectionMode&&<th className="w-10 p-2"><CollectionSelectionBox checked={allSelected} label="تحديد كل النتائج" onChange={toggleAll}/></th>}<th className="p-3 text-xs">المعرّف</th><th className="p-3 text-xs">المشترك</th><th className="p-3 text-xs">الهاتف</th><th className="p-3 text-xs">التصنيف</th><th className="p-3 text-xs">الحسابات</th><th className="p-3 text-xs">الحالة</th><th className="p-3 text-xs">التوثيق</th>{!selectionMode&&<th className="p-3 text-center text-xs">إجراء</th>}</tr></CollectionTableHead><CollectionTableBody rowCards>{filtered.map(item=><tr key={item.id} data-focus-target-id={item.id} tabIndex={-1} onClick={()=>openSubscriber(item.id)} className={subscriberTableRowClass(selected.includes(item.id))}>{selectionMode&&<td className="p-2" onClick={e=>e.stopPropagation()}><CollectionSelectionBox checked={selected.includes(item.id)} label={`تحديد ${item.first_name} ${item.last_name}`} onChange={()=>toggleSelected(item.id)}/></td>}<td className="p-3 text-xs">{subscriberIdBadge(item.id)}</td><td className="p-3 text-xs font-semibold text-[#17386d]"><span className="inline-flex flex-wrap items-center gap-1.5">{item.first_name} {item.last_name}</span></td><td className="p-3 text-xs" dir="ltr">{item.phone||"—"}</td><td className="p-3 text-xs">{item.categories||"—"}</td><td className="p-3">{serviceCounts(item)}</td><td className="p-3">{statusPill(item)}</td><td className="p-3"><IdentityVerificationBadge verified={item.identity_verified} onClick={Number(item.identity_verified)!==1&&canVerifyIdentity&&identityAvailableOnDevice===true?()=>openSubscriberForVerification(item.id):undefined}/></td>{!selectionMode&&<td className="p-3 text-center" onClick={event=>event.stopPropagation()}>{actions(item)}</td>}</tr>)}</CollectionTableBody></CollectionTable><CollectionMobileList>{filtered.map(item=><CollectionMobileCard key={item.id} focusTargetId={item.id} onOpen={()=>openSubscriber(item.id)}><div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 dark:border-blue-300/10 dark:bg-blue-500/[.06]"><span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400"><Hash className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300"/>معرّف المشترك</span>{subscriberIdBadge(item.id)}</div><div className="flex items-center justify-between gap-2"><div className="flex min-w-0 flex-col items-start gap-1"><span className="inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#17386d]"><strong>{item.first_name} {item.last_name}</strong><IdentityVerificationBadge verified={item.identity_verified} onClick={Number(item.identity_verified)!==1&&canVerifyIdentity&&identityAvailableOnDevice===true?()=>openSubscriberForVerification(item.id):undefined}/></span></div>{selectionMode?<CollectionSelectionBox checked={selected.includes(item.id)} label="تحديد المشترك" onChange={()=>toggleSelected(item.id)}/>:statusPill(item)}</div><div className="mt-3 space-y-2 text-xs">{item.phone&&<div dir="ltr" className="text-right">{item.phone}</div>}{item.categories&&<div>التصنيفات: {item.categories}</div>}{serviceCounts(item)}</div>{!selectionMode&&<div className="mt-3 flex justify-end">{actions(item)}</div>}</CollectionMobileCard>)}</CollectionMobileList></>}
</>}
</div>;
}
