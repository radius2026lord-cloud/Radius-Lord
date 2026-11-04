"use client";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {Network,RefreshCw,Filter,Database,Users,Activity,Clock3,CheckCircle2,AlertTriangle,Layers,ListFilter,ChevronDown,ArrowUpDown,Hash,Eye,X} from "lucide-react";
import {CollectionToolbar,CollectionGrid,CollectionCard,CollectionState,useCollectionDisplay} from "@/components/ui/collection-display";
import ProjectDropdown from "@/components/ui/project-dropdown";
import {ProjectFilterGroup,ProjectFilterChoices} from "@/components/ui/project-filter-panel";
import BulkSelectionBar from "@/components/ui/bulk-selection-bar";
import ProjectButton from "@/components/ui/project-button";
import {ProjectInfoCard} from "@/components/ui/project-info-card";
type Metrics={totalSubscribers:number;connectedSubscribers:number;disconnectedSubscribers:number;newSubscribers24h:number;activeSessions:number;totalNas:number;connectedNas:number};
type NetworkRow={metrics:Metrics|null;metricsReadAt:string|null;metricsStatus:string;metricsStale:boolean;id:number;name:string;slug:string;status:string;licenseNumber:string;ownerName:string;environmentId:number|null;environmentStatus:string|null;databaseName:string|null;databaseServerName:string|null;subscriptionStatus:string|null;expiresAt:string|null;reportedAt:string|null;lastSeenAt:string|null;onlineUsers:number|null;activeSessions:number|null;databaseStatus:string|null;radiusStatus:string|null};
const labels:Record<string,string>={ready:"جاهزة",provisioning:"جارٍ التجهيز",pending:"بانتظار التجهيز",failed:"تحتاج معالجة",active:"نشط",disabled:"غير مفعّل",expired:"منتهي",healthy:"سليم",unknown:"غير معروف"};
const label=(value:string|null)=>value?labels[value]||"غير محدد":"غير متاح";
function date(value:string|null){if(!value)return "لم تصل قراءة";const d=new Date(value);return Number.isNaN(d.getTime())?"غير متاح":d.toLocaleString("ar");}
export default function MasterNetworks({networkId}:{networkId?:number}){
 const router=useRouter();
 const [items,setItems]=useState<NetworkRow[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
 const [query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[filtersOpen,setFiltersOpen]=useState(false),[selected,setSelected]=useState<NetworkRow|null>(null);
 const [subscriptionFilter,setSubscriptionFilter]=useState("all"),[readingFilter,setReadingFilter]=useState("all"),[serverFilter,setServerFilter]=useState("all");
 const [sort,setSort]=useState("name"),[descending,setDescending]=useState(false),[pageSize,setPageSize]=useState("50"),[page,setPage]=useState(1);
 const {view,setView,selected:selection,setSelected:setSelection,toggle,setAll,selectionMode,setSelectionMode}=useCollectionDisplay<number>("master-networks","row");
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError("");fetch("/api/billing/admin/networks",{credentials:"include",cache:"no-store",signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.message||"تعذر تحميل الشبكات.");if(!controller.signal.aborted)setItems(body.items||[]);}).catch(reason=>{if(!controller.signal.aborted)setError(reason.message||"تعذر تحميل الشبكات.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[revision]);
 useEffect(()=>{if(networkId)setSelected(items.find(item=>Number(item.id)===networkId)||null);},[networkId,items]);
 const matchesFilters=(item:NetworkRow)=>(subscriptionFilter==="all"||item.subscriptionStatus===subscriptionFilter)
 &&(serverFilter==="all"||item.databaseServerName===serverFilter)
 &&(readingFilter==="all"||(readingFilter==="fresh"?item.metricsStatus==="ok"&&!item.metricsStale:readingFilter==="failed"?item.metricsStatus==="unavailable":item.metricsStale))
 &&[item.id,item.name,item.ownerName,item.licenseNumber,item.databaseName].some(value=>String(value??"").toLowerCase().includes(query.trim().toLowerCase()));
 const baseItems=useMemo(()=>items.filter(matchesFilters),[items,query,subscriptionFilter,readingFilter,serverFilter]);
 const filtered=useMemo(()=>baseItems.filter(item=>filter==="all"||item.environmentStatus===filter).sort((a,b)=>{
 const comparison=sort==="id"?a.id-b.id:sort==="subscribers"?(a.metrics?.totalSubscribers??-1)-(b.metrics?.totalSubscribers??-1):a.name.localeCompare(b.name,"ar");
 return descending?-comparison:comparison;
 }),[baseItems,filter,sort,descending]);
 const activeFilters=Number(subscriptionFilter!=="all")+Number(readingFilter!=="all")+Number(serverFilter!=="all");
 const pageCount=Math.max(1,Math.ceil(filtered.length/Number(pageSize)));
 const currentPage=Math.min(page,pageCount);
 const visible=filtered.slice((currentPage-1)*Number(pageSize),currentPage*Number(pageSize));
 const allVisibleSelected=visible.length>0&&visible.every(item=>selection.has(item.id));
 useEffect(()=>{setPage(1);setSelection(new Set());},[query,filter,subscriptionFilter,readingFilter,serverFilter,pageSize,setSelection]);
 const serverOptions=[{value:"all",label:"كل الخوادم"},...Array.from(new Set(items.map(item=>item.databaseServerName).filter((name):name is string=>Boolean(name)))).map(name=>({value:name,label:name}))];
 const states=[
 {value:"all",title:"كل الشبكات",Icon:Layers,tone:"info" as const,ink:"text-blue-700 dark:text-blue-200"},
 {value:"pending",title:"بانتظار التجهيز",Icon:Clock3,tone:"warning" as const,ink:"text-amber-700 dark:text-amber-200"},
 {value:"provisioning",title:"جارٍ التجهيز",Icon:Activity,tone:"memory" as const,ink:"text-violet-700 dark:text-violet-200"},
 {value:"ready",title:"البيئة جاهزة",Icon:CheckCircle2,tone:"success" as const,ink:"text-emerald-700 dark:text-emerald-200"},
 {value:"failed",title:"تحتاج معالجة",Icon:AlertTriangle,tone:"danger" as const,ink:"text-rose-700 dark:text-rose-200"}];
 return <div dir="rtl" className="space-y-4">
 {networkId&&<Link href="/Dashboard/networks" className="inline-flex text-sm text-blue-600">العودة إلى الشبكات</Link>}
 {!networkId&&<>
 <CollectionToolbar hostingerStyle responsive title="الشبكات" description="متابعة الشبكات وقواعد بياناتها وآخر حالة محفوظة للبيئة" icon={Network} view={view} onViewChange={setView} selectionMode={selectionMode} onSelectionModeChange={value=>{setSelectionMode(value);if(!value)setSelection(new Set());}} selectionAcrossViews selectionLabel="تحديد الشبكات" allSelected={allVisibleSelected} onToggleAll={()=>setAll(visible.map(item=>item.id),!allVisibleSelected)} query={query} onQueryChange={setQuery} searchPlaceholder="بحث بالشبكة، المالك، المعرّف أو الرخصة" searchAction={<button type="button" aria-label="تصفية الشبكات" aria-expanded={filtersOpen} aria-controls="master-network-filters" onClick={()=>setFiltersOpen(value=>!value)} className={`group inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${filtersOpen?"bg-[#eaf1f8] text-[#315d8b] dark:bg-blue-500/10 dark:text-blue-200":"text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"}`}><ListFilter className="h-3.5 w-3.5 text-[#547493]"/><span>تصفية</span>{activeFilters>0&&<span className="rounded-full bg-[#6684a3] px-1.5 text-white">{activeFilters}</span>}<ChevronDown className={`h-3 w-3 ${filtersOpen?"rotate-180":""}`}/></button>} primaryAction={<ProjectButton variant="secondary" disabled={loading} onClick={()=>setRevision(value=>value+1)}><RefreshCw/>تحديث</ProjectButton>}/>
 {filtersOpen&&<div id="master-network-filters" className="grid items-start gap-3 rounded-2xl border border-slate-200 p-3 dark:border-white/10 sm:grid-cols-2 xl:grid-cols-3">
 <ProjectFilterGroup icon={CheckCircle2} title="الاشتراك" tone="subscription"><ProjectFilterChoices value={subscriptionFilter} onChange={setSubscriptionFilter} items={[{value:"all",label:"الكل",icon:Layers,accent:"text-blue-500"},{value:"active",label:"نشط",icon:CheckCircle2,accent:"text-emerald-600"},{value:"expired",label:"منتهي",icon:Clock3,accent:"text-amber-600"}]}/></ProjectFilterGroup>
 <ProjectFilterGroup icon={Activity} title="حداثة مؤشرات التشغيل" tone="connection"><ProjectDropdown compact bareOptionIcons value={readingFilter} onChange={setReadingFilter} options={[{value:"all",label:"كل القراءات"},{value:"fresh",label:"قراءة حديثة"},{value:"stale",label:"قديمة أو لم تصل"},{value:"failed",label:"تعذرت آخر قراءة"}]}/></ProjectFilterGroup>
 <ProjectFilterGroup icon={Database} title="خادم قاعدة البيانات" tone="server"><ProjectDropdown compact bareOptionIcons searchable value={serverFilter} onChange={setServerFilter} options={serverOptions}/></ProjectFilterGroup>
 {activeFilters>0&&<ProjectButton variant="ghost" onClick={()=>{setSubscriptionFilter("all");setReadingFilter("all");setServerFilter("all");}}>مسح التصفية</ProjectButton>}
 </div>}
 <div role="group" aria-label="حالة تجهيز الشبكات" className="grid items-stretch gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
 {states.map(({value,title,Icon,tone,ink})=>{const count=value==="all"?baseItems.length:baseItems.filter(item=>item.environmentStatus===value).length,percent=baseItems.length?Math.round(count/baseItems.length*100):0;
 return <ProjectButton key={value} variant="secondary" aria-pressed={filter===value} onClick={()=>setFilter(current=>current===value?"all":value)} className="group !h-auto !min-h-0 !w-full !justify-start !rounded-[18px] !border-0 !bg-transparent !p-0 !shadow-none">
 <ProjectInfoCard tone={tone} className={`!min-h-[110px] !w-full !border-t-[3px] !p-3 text-right transition-transform group-hover:-translate-y-1 motion-reduce:transform-none ${ink} ${filter===value?"ring-2 ring-blue-400 shadow-md":""}`}>
 <span className="flex items-start justify-between gap-2"><span className="text-[11px] font-semibold">{title}</span><Icon className="h-5 w-5"/></span>
 <span className="mt-2 flex items-baseline gap-1.5"><b className="text-2xl tabular-nums">{count}</b><span className="text-xs">شبكة</span></span>
 <span className="mt-3 block h-1 rounded-full bg-slate-200 dark:bg-white/10"><span className="block h-full rounded-full bg-current" style={{width:percent+"%"}}/></span><span className="mt-1 block text-[10px]">{percent}% من نتائج البحث</span>
 </ProjectInfoCard></ProjectButton>})}
 </div>
 <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[var(--oneui-surface)]">
 <span className="text-sm"><Users className="ml-2 inline h-4 w-4 text-blue-500"/>إجمالي الشبكات · {filtered.length}</span>
 <div className="flex items-center gap-2"><span className="text-xs">الترتيب</span><ProjectDropdown compact value={sort} onChange={setSort} options={[{value:"name",label:"اسم الشبكة"},{value:"id",label:"معرّف الشبكة"},{value:"subscribers",label:"عدد مشتركي PPPoE"}]}/><ProjectButton variant="secondary" size="icon" aria-label={descending?"ترتيب تصاعدي":"ترتيب تنازلي"} onClick={()=>setDescending(value=>!value)}><ArrowUpDown className="h-4 w-4"/></ProjectButton></div>
 <ProjectDropdown compact value={pageSize} onChange={setPageSize} options={["25","50","100"].map(value=>({value,label:value+" عنصرًا"}))}/>
 </div>
 <BulkSelectionBar count={selection.size} noun="الشبكات" allSelected={allVisibleSelected} onToggleAll={()=>setAll(visible.map(item=>item.id),!allVisibleSelected)} onClearSelection={()=>setSelection(new Set())}/>
 {loading?<CollectionState loading>جارٍ تحميل الشبكات…</CollectionState>:error?<CollectionState><p role="alert">{error}</p><ProjectButton onClick={()=>setRevision(value=>value+1)}>إعادة المحاولة</ProjectButton></CollectionState>:!filtered.length?<CollectionState>لا توجد شبكات مطابقة.</CollectionState>:<CollectionGrid className={view==="row"?"!grid-cols-1":""}>{visible.map(item=><CollectionCard hostingerStyle key={item.id} selectionMode={selectionMode} selected={selection.has(item.id)} onToggle={()=>toggle(item.id)} onOpen={()=>router.push("/Dashboard/networks/"+item.id)}>
 <div className={view==="row"?"grid items-center gap-4 sm:grid-cols-2 xl:grid-cols-5":"space-y-3"}>
 <div><h3 className="font-semibold"><Network className="ml-2 inline h-4 w-4 text-blue-500"/><span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:border-blue-300/30 dark:bg-blue-500/10 dark:text-blue-200"><Hash className="h-3 w-3"/>{item.id}</span> · {item.name}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.ownerName}</p></div>
 <div className="text-sm">البيئة · {label(item.environmentStatus)}<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">الاشتراك · {label(item.subscriptionStatus)}</p></div>
 <div className="text-xs"><Database className="ml-1 inline h-4 w-4 text-violet-500"/><bdi>{item.databaseName||"لم تُجهّز قاعدة البيانات"}</bdi><p className="mt-1">{item.databaseServerName}</p></div>
 <div className="text-xs"><p className="mb-1">إجمالي مشتركي PPPoE · {item.metrics?.totalSubscribers??"—"}</p><Users className="ml-1 inline h-4 w-4 text-emerald-500"/>متصلو PPPoE · {item.metrics?.connectedSubscribers??"—"}<p className="mt-1"><Activity className="ml-1 inline h-4 w-4 text-sky-500"/>الجلسات · {item.metrics?.activeSessions??"—"}</p></div>
 <div className="text-xs text-slate-500 dark:text-slate-400">آخر تقرير<p className="mt-1">{date(item.metricsReadAt)}</p><p className="mt-1">{item.metricsStatus==="unavailable"?"تعذرت آخر قراءة":item.metricsStale?"قراءة قديمة أو بانتظار التحديث":"قراءة محفوظة حديثة"}</p></div>
 </div><div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 text-xs dark:border-white/10 sm:grid-cols-3"><p>غير المتصلين · {item.metrics?.disconnectedSubscribers??"—"}</p><p>الجدد خلال 24 ساعة · {item.metrics?.newSubscribers24h??"—"}</p><p>NAS المتصلة / الإجمالي · {item.metrics?`${item.metrics.connectedNas} / ${item.metrics.totalNas}`:"—"}</p></div>{item.metrics&&<div className="mt-3"><p className="mb-1 text-xs">نسبة اتصال مشتركي PPPoE · {item.metrics.totalSubscribers?Math.round(100*item.metrics.connectedSubscribers/item.metrics.totalSubscribers):0}%</p><div role="progressbar" aria-label="نسبة اتصال مشتركي PPPoE" aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.metrics.totalSubscribers?Math.round(100*item.metrics.connectedSubscribers/item.metrics.totalSubscribers):0} className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full bg-emerald-500" style={{width:`${item.metrics.totalSubscribers?100*item.metrics.connectedSubscribers/item.metrics.totalSubscribers:0}%`}}/></div></div>}</CollectionCard>)}</CollectionGrid>}
 <div className="flex items-center justify-between"><ProjectButton variant="secondary" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>السابق</ProjectButton><span className="text-xs">{currentPage} / {pageCount}</span><ProjectButton variant="secondary" disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>التالي</ProjectButton></div>
 </>}
 {networkId&&!loading&&!error&&!selected&&<CollectionState>الشبكة غير موجودة أو غير متاحة.</CollectionState>}
 {networkId&&selected&&<h2 className="text-lg font-semibold">ملف الشبكة · {selected.name}</h2>}
 <section aria-label="ملف الشبكة" className="space-y-4">
 {selected&&<div className="grid gap-4 sm:grid-cols-2">{[
 ["بيانات الشبكة",[["المعرّف",selected.id],["المالك",selected.ownerName],["الرخصة",selected.licenseNumber],["الحالة",label(selected.status)]]],
 ["الاشتراك والبيئة",[["الاشتراك",label(selected.subscriptionStatus)],["البيئة",label(selected.environmentStatus)],["انتهاء الاشتراك",date(selected.expiresAt)]]],
 ["قاعدة البيانات المستقلة",[["القاعدة",selected.databaseName||"لم تُجهّز"],["الخادم",selected.databaseServerName||"غير محدد"],["الصحة",label(selected.databaseStatus)]]],
 ["آخر مؤشرات التشغيل",[["إجمالي مشتركي PPPoE",selected.metrics?.totalSubscribers??"غير متاح"],["المتصلون",selected.metrics?.connectedSubscribers??"غير متاح"],["غير المتصلين",selected.metrics?.disconnectedSubscribers??"غير متاح"],["الجدد خلال 24 ساعة",selected.metrics?.newSubscribers24h??"غير متاح"],["الجلسات النشطة",selected.metrics?.activeSessions??"غير متاح"],["NAS المتصلة",selected.metrics?.connectedNas??"غير متاح"],["إجمالي NAS",selected.metrics?.totalNas??"غير متاح"],["وقت قراءة المؤشرات",date(selected.metricsReadAt)],["صحة RADIUS",label(selected.radiusStatus)],["آخر تقرير",date(selected.reportedAt)],["آخر ظهور",date(selected.lastSeenAt)]]]
 ].map(([title,fields])=><ProjectInfoCard key={String(title)}><h3 className="mb-3 font-semibold">{String(title)}</h3><dl className="space-y-3">{(fields as Array<[string,string|number]>).map(([name,value])=><div key={name}><dt className="text-xs text-slate-500 dark:text-slate-400">{name}</dt><dd className="mt-1 break-words text-sm"><bdi>{value}</bdi></dd></div>)}</dl></ProjectInfoCard>)}</div>}
 </section>
 </div>;
}
