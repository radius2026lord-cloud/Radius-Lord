"use client";
import {useEffect,useMemo,useState} from "react";
import {Network,RefreshCw,Filter,Database,Users,Activity} from "lucide-react";
import {CollectionToolbar,CollectionGrid,CollectionCard,CollectionState,CollectionStatusFilters,useCollectionDisplay} from "@/components/ui/collection-display";
import ProjectButton from "@/components/ui/project-button";
import ProjectDialog from "@/components/ui/project-dialog";
import {ProjectInfoCard} from "@/components/ui/project-info-card";
type NetworkRow={id:number;name:string;slug:string;status:string;licenseNumber:string;ownerName:string;environmentId:number|null;environmentStatus:string|null;databaseName:string|null;databaseServerName:string|null;subscriptionStatus:string|null;expiresAt:string|null;reportedAt:string|null;lastSeenAt:string|null;onlineUsers:number|null;activeSessions:number|null;databaseStatus:string|null;radiusStatus:string|null};
const labels:Record<string,string>={ready:"جاهزة",provisioning:"جارٍ التجهيز",pending:"بانتظار التجهيز",failed:"تحتاج معالجة",active:"نشط",disabled:"غير مفعّل",expired:"منتهي",healthy:"سليم",unknown:"غير معروف"};
const label=(value:string|null)=>value?labels[value]||"غير محدد":"غير متاح";
function date(value:string|null){if(!value)return "لم تصل قراءة";const d=new Date(value);return Number.isNaN(d.getTime())?"غير متاح":d.toLocaleString("ar");}
export default function MasterNetworks(){
 const [items,setItems]=useState<NetworkRow[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
 const [query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[filtersOpen,setFiltersOpen]=useState(false),[selected,setSelected]=useState<NetworkRow|null>(null);
 const {view,setView}=useCollectionDisplay<number>("master-networks","row");
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError("");fetch("/api/billing/admin/networks",{credentials:"include",cache:"no-store",signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.message||"تعذر تحميل الشبكات.");if(!controller.signal.aborted)setItems(body.items||[]);}).catch(reason=>{if(!controller.signal.aborted)setError(reason.message||"تعذر تحميل الشبكات.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[revision]);
 const filtered=useMemo(()=>items.filter(item=>(filter==="all"||item.environmentStatus===filter)&&[item.id,item.name,item.ownerName,item.licenseNumber,item.databaseName].some(value=>String(value??"").toLowerCase().includes(query.trim().toLowerCase()))),[items,filter,query]);
 return <div dir="rtl" className="space-y-4">
 <CollectionToolbar hostingerStyle responsive title="الشبكات" description="متابعة الشبكات وقواعد بياناتها وآخر حالة محفوظة للبيئة" icon={Network} view={view} onViewChange={setView} query={query} onQueryChange={setQuery} searchPlaceholder="بحث بالشبكة، المالك، المعرّف أو الرخصة" searchAction={<ProjectButton variant="secondary" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(value=>!value)}><Filter/>تصفية</ProjectButton>} primaryAction={<ProjectButton variant="secondary" disabled={loading} onClick={()=>setRevision(value=>value+1)}><RefreshCw/>تحديث</ProjectButton>} filters={filtersOpen&&<CollectionStatusFilters value={filter} onChange={setFilter} items={[{value:"all",label:"كل الشبكات",count:items.length,dot:"bg-blue-500"},...["pending","provisioning","ready","failed"].map(value=>({value,label:labels[value],count:items.filter(item=>item.environmentStatus===value).length,dot:value==="ready"?"bg-emerald-500":value==="failed"?"bg-rose-500":"bg-amber-500"}))]}/>}/>
 {loading?<CollectionState loading>جارٍ تحميل الشبكات…</CollectionState>:error?<CollectionState><p role="alert">{error}</p><ProjectButton onClick={()=>setRevision(value=>value+1)}>إعادة المحاولة</ProjectButton></CollectionState>:!filtered.length?<CollectionState>لا توجد شبكات مطابقة.</CollectionState>:<CollectionGrid className={view==="row"?"!grid-cols-1":""}>{filtered.map(item=><CollectionCard hostingerStyle key={item.id} onOpen={()=>setSelected(item)}>
 <div className={view==="row"?"grid items-center gap-4 sm:grid-cols-2 xl:grid-cols-5":"space-y-3"}>
 <div><h3 className="font-semibold"><Network className="ml-2 inline h-4 w-4 text-blue-500"/>#{item.id} · {item.name}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.ownerName}</p></div>
 <div className="text-sm">البيئة · {label(item.environmentStatus)}<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">الاشتراك · {label(item.subscriptionStatus)}</p></div>
 <div className="text-xs"><Database className="ml-1 inline h-4 w-4 text-violet-500"/><bdi>{item.databaseName||"لم تُجهّز قاعدة البيانات"}</bdi><p className="mt-1">{item.databaseServerName}</p></div>
 <div className="text-xs"><Users className="ml-1 inline h-4 w-4 text-emerald-500"/>المتصلون · {item.onlineUsers??"—"}<p className="mt-1"><Activity className="ml-1 inline h-4 w-4 text-sky-500"/>الجلسات · {item.activeSessions??"—"}</p></div>
 <div className="text-xs text-slate-500 dark:text-slate-400">آخر تقرير<p className="mt-1">{date(item.reportedAt)}</p><p className="mt-1">قراءة محفوظة</p></div>
 </div></CollectionCard>)}</CollectionGrid>}
 <ProjectDialog open={Boolean(selected)} onClose={()=>setSelected(null)} title={selected?"ملف الشبكة · "+selected.name:"ملف الشبكة"} maxWidth="max-w-4xl">
 {selected&&<div className="grid gap-4 sm:grid-cols-2">{[
 ["بيانات الشبكة",[["المعرّف",selected.id],["المالك",selected.ownerName],["الرخصة",selected.licenseNumber],["الحالة",label(selected.status)]]],
 ["الاشتراك والبيئة",[["الاشتراك",label(selected.subscriptionStatus)],["البيئة",label(selected.environmentStatus)],["انتهاء الاشتراك",date(selected.expiresAt)]]],
 ["قاعدة البيانات المستقلة",[["القاعدة",selected.databaseName||"لم تُجهّز"],["الخادم",selected.databaseServerName||"غير محدد"],["الصحة",label(selected.databaseStatus)]]],
 ["آخر مؤشرات التشغيل",[["المتصلون",selected.onlineUsers??"غير متاح"],["الجلسات النشطة",selected.activeSessions??"غير متاح"],["صحة RADIUS",label(selected.radiusStatus)],["آخر تقرير",date(selected.reportedAt)],["آخر ظهور",date(selected.lastSeenAt)]]]
 ].map(([title,fields])=><ProjectInfoCard key={String(title)}><h3 className="mb-3 font-semibold">{String(title)}</h3><dl className="space-y-3">{(fields as Array<[string,string|number]>).map(([name,value])=><div key={name}><dt className="text-xs text-slate-500 dark:text-slate-400">{name}</dt><dd className="mt-1 break-words text-sm"><bdi>{value}</bdi></dd></div>)}</dl></ProjectInfoCard>)}</div>}
 </ProjectDialog>
 </div>;
}
