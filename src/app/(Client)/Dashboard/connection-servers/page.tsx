"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Server, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import ProjectButton from "@/components/ui/project-button";
import ItemActionsDropdown from "@/components/ui/item-actions-dropdown";
import CollectionViewToggle from "@/components/ui/collection-view-toggle";
import { CollectionCard, CollectionToolbar, CollectionStatusFilters, CollectionTable, CollectionTableHead, CollectionTableBody, CollectionMobileList, CollectionMobileCard, CollectionState, collectionRowClass } from "@/components/ui/collection-display";

type Gateway={id:number;name:string;api_host:string;ovpn_host?:string;ovpn_port?:number;enabled:boolean;last_checked_at?:string;provision_state?:string};
const endpoint="/api/admin/platform-settings/ovpn-gateways";
export default function ConnectionServersPage(){
 const router=useRouter(),{isMasterAdmin,loading:authLoading}=useAuth();
 const [rows,setRows]=useState<Gateway[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[query,setQuery]=useState(""),[filter,setFilter]=useState<"all"|"active"|"inactive">("all"),[view,setView]=useState<"grid"|"row">("grid");
 async function load(){setLoading(true);setError("");try{const r=await fetch(endpoint,{credentials:"include"}),j=await r.json();if(!r.ok)throw new Error(j.message);setRows(j.gateways);}catch(e){setError(e instanceof Error?e.message:"تعذر تحميل الخوادم.");}finally{setLoading(false);}}
 useEffect(()=>{if(isMasterAdmin)void load();},[isMasterAdmin]);
 const open=(r:Gateway,edit=false)=>router.push(`/Dashboard/connection-servers/${r.id}${edit?"":"?view=1"}`);
 const visible=rows.filter(r=>(filter==="all"||(filter==="active")===Boolean(r.enabled))&&`${r.name} ${r.ovpn_host??""} ${r.api_host}`.toLowerCase().includes(query.toLowerCase()));
 const actions=(r:Gateway)=><ItemActionsDropdown handlers={{view:()=>open(r),edit:()=>open(r,true)}}/>;
 const status=(r:Gateway)=><span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${r.enabled?"bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300":"bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"}`}>{r.enabled?"مفعّل":"موقوف"}</span>;
 const address=(r:Gateway)=>r.ovpn_host?`${r.ovpn_host}:${r.ovpn_port}`:"لم يُجهّز بعد";
 const card=(r:Gateway)=><><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-base font-semibold">{r.name}</h3><p className="mt-1 break-all text-xs text-slate-500"><bdi>{r.api_host}</bdi></p></div><div className="flex shrink-0 items-center gap-2">{status(r)}{actions(r)}</div></div><div className="mt-4 space-y-2 rounded-[14px] bg-[#f6f9fd] p-3 text-xs dark:bg-white/[.04]"><p className="text-slate-500">عنوان OpenVPN</p><p className="break-all font-semibold"><bdi>{address(r)}</bdi></p></div><p className="mt-3 text-[11px] text-slate-500">{r.last_checked_at?`آخر فحص: ${new Date(r.last_checked_at).toLocaleString("ar")}`:"لم يُفحص"}</p></>;
 if(authLoading)return <CollectionState>جارٍ التحميل...</CollectionState>;
 if(!isMasterAdmin)return <CollectionState>هذه الصفحة خاصة بالمدير الرئيسي للمنصة.</CollectionState>;
 return <div dir="rtl" className="space-y-3 text-slate-800 dark:text-slate-200">
 <CollectionToolbar responsive icon={Server} title="خوادم الاتصال" description="بوابات OpenVPN لبيئات الكلاود" query={query} onQueryChange={setQuery} searchPlaceholder="بحث عن خادم..." filters={<div className="flex items-center gap-2"><CollectionStatusFilters value={filter} onChange={setFilter} items={[{value:"all",label:"الكل",count:rows.length,dot:"bg-[#0758e9]"},{value:"active",label:"مفعّل",count:rows.filter(r=>r.enabled).length,dot:"bg-emerald-500"},{value:"inactive",label:"موقوف",count:rows.filter(r=>!r.enabled).length,dot:"bg-amber-500"}]}/><CollectionViewToggle value={view} onChange={setView}/></div>} primaryAction={<ProjectButton className="h-11 rounded-[15px] px-4" onClick={()=>router.push("/Dashboard/connection-servers/add")}><Plus/>إضافة خادم</ProjectButton>}/>
 {loading?<CollectionState>جارٍ تحميل الخوادم...</CollectionState>:error?<CollectionState><p role="alert">{error}</p><ProjectButton variant="secondary" className="mt-3" onClick={load}>إعادة المحاولة</ProjectButton></CollectionState>:!visible.length?<CollectionState>{rows.length?"لا توجد نتائج مطابقة.":"لم تتم إضافة خوادم اتصال بعد."}</CollectionState>:view==="grid"?<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map(r=><CollectionCard key={r.id} onOpen={()=>open(r)}>{card(r)}</CollectionCard>)}</div>:<><CollectionTable><CollectionTableHead><tr>{["الخادم","عنوان OpenVPN","التفعيل","آخر فحص","الإجراءات"].map(h=><th key={h} className="p-4">{h}</th>)}</tr></CollectionTableHead><CollectionTableBody>{visible.map(r=><tr key={r.id} className={collectionRowClass()} onClick={()=>open(r)}><td className="p-4 font-semibold">{r.name}</td><td className="p-4"><bdi>{address(r)}</bdi></td><td className="p-4">{status(r)}</td><td className="p-4 text-slate-400">{r.last_checked_at?new Date(r.last_checked_at).toLocaleString("ar"):"لم يُفحص"}</td><td className="p-4">{actions(r)}</td></tr>)}</CollectionTableBody></CollectionTable><CollectionMobileList>{visible.map(r=><CollectionMobileCard key={r.id} onOpen={()=>open(r)}>{card(r)}</CollectionMobileCard>)}</CollectionMobileList></>}
 </div>;
}
