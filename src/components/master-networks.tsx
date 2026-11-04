"use client";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {Network,RefreshCw,Filter,Database,Users,Activity,Clock3,CheckCircle2,AlertTriangle,Layers} from "lucide-react";
import {CollectionToolbar,CollectionGrid,CollectionCard,CollectionState,useCollectionDisplay} from "@/components/ui/collection-display";
import ProjectButton from "@/components/ui/project-button";
import {ProjectInfoCard} from "@/components/ui/project-info-card";
type NetworkRow={id:number;name:string;slug:string;status:string;licenseNumber:string;ownerName:string;environmentId:number|null;environmentStatus:string|null;databaseName:string|null;databaseServerName:string|null;subscriptionStatus:string|null;expiresAt:string|null;reportedAt:string|null;lastSeenAt:string|null;onlineUsers:number|null;activeSessions:number|null;databaseStatus:string|null;radiusStatus:string|null};
const labels:Record<string,string>={ready:"جاهزة",provisioning:"جارٍ التجهيز",pending:"بانتظار التجهيز",failed:"تحتاج معالجة",active:"نشط",disabled:"غير مفعّل",expired:"منتهي",healthy:"سليم",unknown:"غير معروف"};
const label=(value:string|null)=>value?labels[value]||"غير محدد":"غير متاح";
function date(value:string|null){if(!value)return "لم تصل قراءة";const d=new Date(value);return Number.isNaN(d.getTime())?"غير متاح":d.toLocaleString("ar");}
export default function MasterNetworks({networkId}:{networkId?:number}){
 const router=useRouter();
 const [items,setItems]=useState<NetworkRow[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
 const [query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[filtersOpen,setFiltersOpen]=useState(false),[selected,setSelected]=useState<NetworkRow|null>(null);
 const {view,setView}=useCollectionDisplay<number>("master-networks","row");
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError("");fetch("/api/billing/admin/networks",{credentials:"include",cache:"no-store",signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.message||"تعذر تحميل الشبكات.");if(!controller.signal.aborted)setItems(body.items||[]);}).catch(reason=>{if(!controller.signal.aborted)setError(reason.message||"تعذر تحميل الشبكات.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[revision]);
 useEffect(()=>{if(networkId)setSelected(items.find(item=>Number(item.id)===networkId)||null);},[networkId,items]);
 const filtered=useMemo(()=>items.filter(item=>(filter==="all"||item.environmentStatus===filter)&&[item.id,item.name,item.ownerName,item.licenseNumber,item.databaseName].some(value=>String(value??"").toLowerCase().includes(query.trim().toLowerCase()))),[items,filter,query]);
 return <div dir="rtl" className="space-y-4">
 {networkId&&<Link href="/Dashboard/networks" className="inline-flex text-sm text-blue-600">العودة إلى الشبكات</Link>}
 {!networkId&&<>
 <CollectionToolbar hostingerStyle responsive title="الشبكات" description="متابعة الشبكات وقواعد بياناتها وآخر حالة محفوظة للبيئة" icon={Network} view={view} onViewChange={setView} query={query} onQueryChange={setQuery} searchPlaceholder="بحث بالشبكة، المالك، المعرّف أو الرخصة" searchAction={<ProjectButton variant="secondary" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(value=>!value)}><Filter/>تصفية</ProjectButton>} primaryAction={<ProjectButton variant="secondary" disabled={loading} onClick={()=>setRevision(value=>value+1)}><RefreshCw/>تحديث</ProjectButton>} filters={filtersOpen&&<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
 {value:"all",title:"كل الشبكات",Icon:Layers,tone:"text-blue-600"},
 {value:"pending",title:"بانتظار التجهيز",Icon:Clock3,tone:"text-amber-600"},
 {value:"provisioning",title:"جارٍ التجهيز",Icon:Activity,tone:"text-violet-500"},
 {value:"ready",title:"البيئة جاهزة",Icon:CheckCircle2,tone:"text-emerald-600"},
 {value:"failed",title:"تحتاج معالجة",Icon:AlertTriangle,tone:"text-rose-500"}
 ].map(({value,title,Icon,tone})=>{const count=value==="all"?items.length:items.filter(item=>item.environmentStatus===value).length;return <button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)} className={`rounded-2xl border p-4 text-right transition-colors ${filter===value?"border-blue-500 bg-blue-50 dark:bg-blue-500/10":"border-slate-200 bg-white dark:border-white/10 dark:bg-[var(--oneui-surface)]"}`}><span className="flex items-center gap-2 text-sm"><Icon className={`h-4 w-4 ${tone}`}/>{title}</span><span className="mt-3 block text-xl font-semibold">{count}</span><span className="mt-2 block h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><span className="block h-full bg-blue-500" style={{width:`${items.length?count/items.length*100:0}%`}}/></span></button>})}</div>}/> 
 {loading?<CollectionState loading>جارٍ تحميل الشبكات…</CollectionState>:error?<CollectionState><p role="alert">{error}</p><ProjectButton onClick={()=>setRevision(value=>value+1)}>إعادة المحاولة</ProjectButton></CollectionState>:!filtered.length?<CollectionState>لا توجد شبكات مطابقة.</CollectionState>:<CollectionGrid className={view==="row"?"!grid-cols-1":""}>{filtered.map(item=><CollectionCard hostingerStyle key={item.id} onOpen={()=>router.push("/Dashboard/networks/"+item.id)}>
 <div className={view==="row"?"grid items-center gap-4 sm:grid-cols-2 xl:grid-cols-5":"space-y-3"}>
 <div><h3 className="font-semibold"><Network className="ml-2 inline h-4 w-4 text-blue-500"/>#{item.id} · {item.name}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.ownerName}</p></div>
 <div className="text-sm">البيئة · {label(item.environmentStatus)}<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">الاشتراك · {label(item.subscriptionStatus)}</p></div>
 <div className="text-xs"><Database className="ml-1 inline h-4 w-4 text-violet-500"/><bdi>{item.databaseName||"لم تُجهّز قاعدة البيانات"}</bdi><p className="mt-1">{item.databaseServerName}</p></div>
 <div className="text-xs"><Users className="ml-1 inline h-4 w-4 text-emerald-500"/>المتصلون · {item.onlineUsers??"—"}<p className="mt-1"><Activity className="ml-1 inline h-4 w-4 text-sky-500"/>الجلسات · {item.activeSessions??"—"}</p></div>
 <div className="text-xs text-slate-500 dark:text-slate-400">آخر تقرير<p className="mt-1">{date(item.reportedAt)}</p><p className="mt-1">قراءة محفوظة</p></div>
 </div></CollectionCard>)}</CollectionGrid>}
 </>}
 {networkId&&!loading&&!error&&!selected&&<CollectionState>الشبكة غير موجودة أو غير متاحة.</CollectionState>}
 {networkId&&selected&&<h2 className="text-lg font-semibold">ملف الشبكة · {selected.name}</h2>}
 <section aria-label="ملف الشبكة" className="space-y-4">
 {selected&&<div className="grid gap-4 sm:grid-cols-2">{[
 ["بيانات الشبكة",[["المعرّف",selected.id],["المالك",selected.ownerName],["الرخصة",selected.licenseNumber],["الحالة",label(selected.status)]]],
 ["الاشتراك والبيئة",[["الاشتراك",label(selected.subscriptionStatus)],["البيئة",label(selected.environmentStatus)],["انتهاء الاشتراك",date(selected.expiresAt)]]],
 ["قاعدة البيانات المستقلة",[["القاعدة",selected.databaseName||"لم تُجهّز"],["الخادم",selected.databaseServerName||"غير محدد"],["الصحة",label(selected.databaseStatus)]]],
 ["آخر مؤشرات التشغيل",[["المتصلون",selected.onlineUsers??"غير متاح"],["الجلسات النشطة",selected.activeSessions??"غير متاح"],["صحة RADIUS",label(selected.radiusStatus)],["آخر تقرير",date(selected.reportedAt)],["آخر ظهور",date(selected.lastSeenAt)]]]
 ].map(([title,fields])=><ProjectInfoCard key={String(title)}><h3 className="mb-3 font-semibold">{String(title)}</h3><dl className="space-y-3">{(fields as Array<[string,string|number]>).map(([name,value])=><div key={name}><dt className="text-xs text-slate-500 dark:text-slate-400">{name}</dt><dd className="mt-1 break-words text-sm"><bdi>{value}</bdi></dd></div>)}</dl></ProjectInfoCard>)}</div>}
 </section>
 </div>;
}
