"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Server, Plus, Pencil, Eye } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import ProjectInput from "@/components/ui/project-input";
import ProjectDropdown from "@/components/ui/project-dropdown";
import ProjectTooltip from "@/components/ui/project-tooltip";
import { Button } from "@/components/ui/button";
import { CollectionTable, CollectionTableHead, CollectionTableBody, CollectionMobileList, CollectionMobileCard, CollectionState, collectionRowClass } from "@/components/ui/collection-display";

type Gateway={id:number;name:string;api_host:string;ovpn_host?:string;ovpn_port?:number;enabled:boolean;last_checked_at?:string;provision_state?:string};
const endpoint="/api/admin/platform-settings/ovpn-gateways";
export default function ConnectionServersPage(){
 const router=useRouter();
 const {isMasterAdmin,loading:authLoading}=useAuth();
 const [rows,setRows]=useState<Gateway[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[query,setQuery]=useState(""),[filter,setFilter]=useState("all");
 async function load(){setLoading(true);setError("");try{const r=await fetch(endpoint,{credentials:"include"}),j=await r.json();if(!r.ok)throw new Error(j.message);setRows(j.gateways);}catch(e){setError(e instanceof Error?e.message:"تعذر تحميل الخوادم.");}finally{setLoading(false);}}
 useEffect(()=>{if(isMasterAdmin)void load();},[isMasterAdmin]);
 function open(row:Gateway,view=false){router.push(row.id?`/Dashboard/connection-servers/${row.id}${view?"?view=1":""}`:"/Dashboard/connection-servers/add");}
 const visible=rows.filter(r=>(filter==="all"||String(r.enabled)===filter)&&`${r.name} ${r.ovpn_host??""} ${r.api_host}`.toLowerCase().includes(query.toLowerCase()));
 if(authLoading)return <CollectionState>جارٍ التحميل...</CollectionState>;
 if(!isMasterAdmin)return <CollectionState>هذه الصفحة خاصة بالمدير الرئيسي للمنصة.</CollectionState>;
 const actions=(r:Gateway)=><div className="flex gap-2" onClick={e=>e.stopPropagation()}><ProjectTooltip label="عرض الخادم"><Button variant="outline" size="icon" aria-label="عرض الخادم" onClick={()=>open(r,true)}><Eye className="text-blue-500"/></Button></ProjectTooltip><ProjectTooltip label="تعديل الخادم"><Button variant="outline" size="icon" aria-label="تعديل الخادم" onClick={()=>open(r)}><Pencil className="text-amber-500"/></Button></ProjectTooltip></div>;
 return <div dir="rtl" className="space-y-5 text-slate-800 dark:text-slate-200">
 <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><Server className="text-blue-500"/>خوادم الاتصال</h1><p className="mt-1 text-sm text-slate-500">بوابات OpenVPN المركزية لبيئات الكلاود.</p></div><Button onClick={()=>router.push("/Dashboard/connection-servers/add")}><Plus/>إضافة خادم</Button></div>
 <section className="rl-surface grid gap-3 rounded-[22px] bg-white p-4 dark:bg-[#0d243b] sm:grid-cols-[1fr_200px]"><ProjectInput aria-label="البحث عن خادم" placeholder="بحث بالاسم أو العنوان..." value={query} onChange={e=>setQuery(e.target.value)}/><ProjectDropdown value={filter} onChange={setFilter} options={[{value:"all",label:"جميع الخوادم"},{value:"true",label:"مفعّل"},{value:"false",label:"موقوف"}]}/></section>
 {loading?<CollectionState>جارٍ تحميل الخوادم...</CollectionState>:error?<CollectionState><p role="alert">{error}</p><Button variant="outline" className="mt-3" onClick={load}>إعادة المحاولة</Button></CollectionState>:!visible.length?<CollectionState>{rows.length?"لا توجد نتائج مطابقة.":"لم تتم إضافة خوادم اتصال بعد."}</CollectionState>:<><CollectionTable><CollectionTableHead><tr>{["الخادم","عنوان OpenVPN","التفعيل","اتصال الإدارة","الإجراءات"].map(h=><th key={h} className="p-4">{h}</th>)}</tr></CollectionTableHead><CollectionTableBody>{visible.map(r=><tr key={r.id} className={collectionRowClass()} onClick={()=>open(r,true)}><td className="p-4 font-semibold">{r.name}</td><td className="p-4"><bdi>{r.ovpn_host?`${r.ovpn_host??""}:${r.ovpn_port}`:"لم يُجهّز بعد"}</bdi></td><td className="p-4">{r.enabled?"مفعّل":"موقوف"}</td><td className="p-4 text-slate-400">{r.last_checked_at?`آخر فحص: ${new Date(r.last_checked_at).toLocaleString("ar")}`:"لم يُفحص"}</td><td className="p-4">{actions(r)}</td></tr>)}</CollectionTableBody></CollectionTable><CollectionMobileList>{visible.map(r=><CollectionMobileCard key={r.id} onOpen={()=>open(r,true)}><div className="flex items-center justify-between gap-2"><strong>{r.name}</strong>{actions(r)}</div><p className="mt-3 text-sm"><bdi>{r.ovpn_host?`${r.ovpn_host??""}:${r.ovpn_port}`:"لم يُجهّز بعد"}</bdi></p><p className="mt-2 text-xs text-slate-500">{r.enabled?"مفعّل":"موقوف"} · {r.last_checked_at?"تم الفحص سابقًا":"لم يُفحص"}</p></CollectionMobileCard>)}</CollectionMobileList></>}

 </div>;
}
