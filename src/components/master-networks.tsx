"use client";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {Network,RefreshCw,Filter,Database,Users,Activity,Clock3,CheckCircle2,AlertTriangle,Layers,ListFilter,ChevronDown,ArrowUpDown,Hash,Eye,X,UserRound,Server,Wifi,WifiOff,Router,CalendarClock,ShieldCheck,Power,Package,Rows3} from "lucide-react";
import {CollectionToolbar,CollectionGrid,CollectionCard,CollectionState,useCollectionDisplay} from "@/components/ui/collection-display";
import {useClock24h} from "@/components/ui/project-clock-provider";
import ProjectDropdown from "@/components/ui/project-dropdown";
import {ProjectFilterGroup,ProjectFilterChoices} from "@/components/ui/project-filter-panel";
import BulkSelectionBar from "@/components/ui/bulk-selection-bar";
import ProjectButton from "@/components/ui/project-button";
import {ProjectInfoCard} from "@/components/ui/project-info-card";
type Metrics={totalSubscribers:number;connectedSubscribers:number;disconnectedSubscribers:number;newSubscribers24h:number;activeSessions:number;totalNas:number;connectedNas:number};
type NetworkRow={planName:string|null;startsAt:string|null;metrics:Metrics|null;metricsReadAt:string|null;metricsStatus:string;metricsStale:boolean;id:number;name:string;slug:string;status:string;licenseNumber:string;ownerName:string;environmentId:number|null;environmentStatus:string|null;databaseName:string|null;databaseServerName:string|null;subscriptionStatus:string|null;expiresAt:string|null;reportedAt:string|null;lastSeenAt:string|null;onlineUsers:number|null;activeSessions:number|null;databaseStatus:string|null;radiusStatus:string|null};
const labels:Record<string,string>={ready:"جاهزة",provisioning:"جارٍ التجهيز",pending:"بانتظار التجهيز",failed:"تحتاج معالجة",active:"نشط",disabled:"غير مفعّل",expired:"منتهي",healthy:"سليم",unknown:"غير معروف"};
const label=(value:string|null)=>value?labels[value]||"غير محدد":"غير متاح";
function date(value:string|null){if(!value)return "لم تصل قراءة";const d=new Date(value);return Number.isNaN(d.getTime())?"غير متاح":d.toLocaleString("ar");}
function expiryState(item:NetworkRow,days:number,now:number){
 const end=item.expiresAt?Date.parse(item.expiresAt):NaN;
 const start=item.startsAt?Date.parse(item.startsAt):NaN;
 if(item.subscriptionStatus==="expired"||(Number.isFinite(end)&&end<=now))return "expired";
 if(!Number.isFinite(start)||start>now)return "pending";
 if(item.subscriptionStatus!=="active"||!Number.isFinite(end))return "other";
 return end-now<=days*86400000?"soon":"current";
}
function operationalState(item:NetworkRow,days:number,now:number){
 const expiry=expiryState(item,days,now);
 if(expiry==="expired")return "expired";
 if(item.status!=="active"||item.subscriptionStatus!=="active")return "suspended";
 return expiry==="soon"?"soon":"active";
}
function networkState(item:NetworkRow,days:number,now:number){
 const expiry=expiryState(item,days,now);
 if(expiry==="expired")return {label:"اشتراك منتهٍ",tone:"border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200",Icon:CalendarClock};
 if(expiry==="soon"&&item.status==="active")return {label:"قريب من الانتهاء",tone:"border-orange-400 bg-orange-50 text-orange-800 dark:border-orange-400/40 dark:bg-orange-500/10 dark:text-orange-200",Icon:CalendarClock};
 if(item.status==="disabled")return {label:"غير مفعّلة",tone:"border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-500 dark:bg-slate-500/10 dark:text-slate-300",Icon:Power};
 if(item.subscriptionStatus==="expired")return {label:"اشتراك منتهٍ",tone:"border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200",Icon:CalendarClock};
 if(item.environmentStatus==="failed")return {label:"تحتاج معالجة",tone:"border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200",Icon:AlertTriangle};
 if(item.environmentStatus==="provisioning")return {label:"جارٍ التجهيز",tone:"border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-400/40 dark:bg-violet-500/10 dark:text-violet-200",Icon:Activity};
 if(item.environmentStatus==="ready"&&item.status==="active")return {label:"مفعّلة",tone:"border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200",Icon:CheckCircle2};
 return {label:"بانتظار التجهيز",tone:"border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-300/40 dark:bg-blue-500/10 dark:text-blue-200",Icon:Clock3};
}
function ConnectionChart({title,connected,total,Icon,tone}:{title:string;connected?:number;total?:number;Icon:typeof Users;tone:string}){
 const available=connected!==undefined&&total!==undefined;
 const percent=available&&total>0?Math.max(0,Math.min(100,Math.round(100*connected/total))):0;
 return <div className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-slate-200/80 p-3 text-center dark:border-white/10">
 <div className={`relative h-16 w-16 shrink-0 ${tone}`} role="img" aria-label={title+" · "+(available?connected+" من "+total:"لم تصل قراءة")}>
 <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-15"/>{available&&<circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" pathLength="100" strokeDasharray={percent+" 100"}/>}</svg>
 <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">{available?percent+"%":"—"}</span></div>
 <div className="w-full min-w-0"><p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><Icon className={`h-4 w-4 shrink-0 ${tone}`}/>{title}</p><p className="mt-1 text-sm font-semibold tabular-nums">{available?<>{connected} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">من {total}</span></> :<span className="font-normal text-slate-500 dark:text-slate-400">بانتظار القراءة</span>}</p></div>
 </div>;
}
function DateStamp({value,empty}:{value:string|null;empty:string}){
 const clock24h=useClock24h();
 const parsed=value?new Date(value):null;
 if(!parsed||Number.isNaN(parsed.getTime()))return <span className="text-slate-500 dark:text-slate-400">{empty}</span>;
 return <time dateTime={parsed.toISOString()} className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
 <bdi dir="ltr" className="text-sm font-semibold tabular-nums">{new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"}).format(parsed)}</bdi>
 <bdi className="whitespace-nowrap text-xs tabular-nums text-slate-500 dark:text-slate-400">{new Intl.DateTimeFormat("ar",{hour:"2-digit",minute:"2-digit",hour12:!clock24h}).format(parsed)}</bdi>
 </time>;
}
function SubscriptionDates({item,days}:{item:NetworkRow;days:number}){
 const expiry=item.expiresAt?Date.parse(item.expiresAt):NaN;
 const remaining=expiry-Date.now();
 const expired=Number.isFinite(expiry)&&remaining<=0;
 const approaching=Number.isFinite(expiry)&&remaining>0&&remaining<=days*86400000;
 return <div className={`min-w-0 space-y-3 rounded-2xl border p-4 text-xs shadow-sm ${expired||approaching?"border-amber-300 bg-amber-50/70 dark:border-amber-400/30 dark:bg-amber-500/[.07]":"border-blue-200 bg-[#f3f7fd] dark:border-blue-300/20 dark:bg-blue-400/[.06]"}`}>
 <p className="flex min-w-0 items-start gap-2 font-semibold"><Package className="h-4 w-4 shrink-0 text-violet-500"/><span className="break-words leading-5">{item.planName||"الخطة غير محددة"}</span></p>
 <div><p className="text-slate-500 dark:text-slate-400">بدء الاشتراك</p><DateStamp value={item.startsAt} empty="لم يبدأ"/></div>
 <div className="border-t border-blue-200/70 pt-3 dark:border-white/10"><p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><CalendarClock className="h-4 w-4 shrink-0 text-amber-500"/>انتهاء الاشتراك</p><DateStamp value={item.expiresAt} empty="لم يُحدد"/>{Number.isFinite(expiry)&&remaining>0&&<p className="mt-2 text-slate-500 dark:text-slate-400">متبقٍ {Math.ceil(remaining/86400000)} يوم</p>}</div>
 {(approaching||expired)&&<p role="status" className="flex items-start gap-1.5 border-t border-amber-200 pt-2 leading-5 text-amber-700 dark:border-amber-400/20 dark:text-amber-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>{expired?"انتهى الاشتراك، يلزم التجديد":"بادر بتجديد الخطة"}</p>}
 </div>;
}
export default function MasterNetworks({networkId}:{networkId?:number}){
 const router=useRouter();
 const [items,setItems]=useState<NetworkRow[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
 const [now,setNow]=useState(()=>Date.now());
 const [validityFilter,setValidityFilter]=useState("all");
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
 const [reminderDays,setReminderDays]=useState(7);
 const [query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[filtersOpen,setFiltersOpen]=useState(false),[selected,setSelected]=useState<NetworkRow|null>(null);
 const [subscriptionFilter,setSubscriptionFilter]=useState("all"),[readingFilter,setReadingFilter]=useState("all"),[serverFilter,setServerFilter]=useState("all");
 const [sort,setSort]=useState("name"),[descending,setDescending]=useState(false),[pageSize,setPageSize]=useState("50"),[page,setPage]=useState(1);
 const {view,setView,selected:selection,setSelected:setSelection,toggle,setAll,selectionMode,setSelectionMode}=useCollectionDisplay<number>("master-networks","row");
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError("");fetch("/api/billing/admin/networks",{credentials:"include",cache:"no-store",signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.message||"تعذر تحميل الشبكات.");if(!controller.signal.aborted){setItems(body.items||[]);setReminderDays(body.reminderSettings?.expiryDays??7);}}).catch(reason=>{if(!controller.signal.aborted)setError(reason.message||"تعذر تحميل الشبكات.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[revision]);
 useEffect(()=>{if(networkId)setSelected(items.find(item=>Number(item.id)===networkId)||null);},[networkId,items]);
 const matchesFilters=(item:NetworkRow)=>(subscriptionFilter==="all"||item.subscriptionStatus===subscriptionFilter)
 &&(validityFilter==="all"||expiryState(item,reminderDays,now)===validityFilter)
 &&(serverFilter==="all"||item.databaseServerName===serverFilter)
 &&(readingFilter==="all"||(readingFilter==="fresh"?item.metricsStatus==="ok"&&!item.metricsStale:readingFilter==="failed"?item.metricsStatus==="unavailable":item.metricsStale))
 &&[item.id,item.name,item.ownerName,item.licenseNumber,item.databaseName].some(value=>String(value??"").toLowerCase().includes(query.trim().toLowerCase()));
 const baseItems=useMemo(()=>items.filter(matchesFilters),[items,query,subscriptionFilter,readingFilter,serverFilter,validityFilter,reminderDays,now]);
 const filtered=useMemo(()=>baseItems.filter(item=>filter==="all"||operationalState(item,reminderDays,now)===filter).sort((a,b)=>{
 if(sort==="expiry"){
 const left=a.expiresAt?Date.parse(a.expiresAt):NaN,right=b.expiresAt?Date.parse(b.expiresAt):NaN;
 if(!Number.isFinite(left)||!Number.isFinite(right))return Number.isFinite(left)?-1:Number.isFinite(right)?1:a.id-b.id;
 return (descending?right-left:left-right)||a.id-b.id;
 }
 const comparison=sort==="id"?a.id-b.id:sort==="subscribers"?(a.metrics?.totalSubscribers??-1)-(b.metrics?.totalSubscribers??-1):a.name.localeCompare(b.name,"ar");
 return descending?-comparison:comparison;
 }),[baseItems,filter,sort,descending,reminderDays,now]);
 const activeFilters=Number(subscriptionFilter!=="all")+Number(readingFilter!=="all")+Number(serverFilter!=="all")+Number(validityFilter!=="all");
 const effectivePageSize=pageSize==="all"?Math.max(1,filtered.length):Number(pageSize);
 const pageCount=Math.max(1,Math.ceil(filtered.length/effectivePageSize));
 const currentPage=Math.min(page,pageCount);
 const visible=filtered.slice((currentPage-1)*effectivePageSize,currentPage*effectivePageSize);
 const allVisibleSelected=visible.length>0&&visible.every(item=>selection.has(item.id));
 useEffect(()=>{setPage(1);setSelection(new Set());},[query,filter,subscriptionFilter,readingFilter,serverFilter,validityFilter,pageSize,setSelection]);
 const serverOptions=[{value:"all",label:"كل الخوادم"},...Array.from(new Set(items.map(item=>item.databaseServerName).filter((name):name is string=>Boolean(name)))).map(name=>({value:name,label:name}))];
 const states=[
 {value:"all",title:"كل الشبكات",Icon:Layers,tone:"info" as const,ink:"text-blue-700 dark:text-blue-200"},
 {value:"active",title:"نشطة",Icon:CheckCircle2,tone:"success" as const,ink:"text-emerald-700 dark:text-emerald-200"},
 {value:"soon",title:"قريبة من الانتهاء",Icon:CalendarClock,tone:"warning" as const,ink:"text-orange-700 dark:text-orange-200"},
 {value:"expired",title:"منتهية",Icon:Clock3,tone:"warning" as const,ink:"text-amber-700 dark:text-amber-200"},
 {value:"suspended",title:"موقوفة",Icon:Power,tone:"danger" as const,ink:"text-rose-700 dark:text-rose-200"}];
 return <div dir="rtl" className="space-y-4">
 {networkId&&<Link href="/Dashboard/networks" className="inline-flex text-sm text-blue-600">العودة إلى الشبكات</Link>}
 {!networkId&&<>
 <CollectionToolbar hostingerStyle responsive title="الشبكات" description="الشبكات التي اكتمل تفعيل بيئتها، مع حالة اشتراكها وآخر مؤشرات التشغيل" icon={Network} view={view} onViewChange={setView} selectionMode={selectionMode} onSelectionModeChange={value=>{setSelectionMode(value);if(!value)setSelection(new Set());}} selectionAcrossViews selectionLabel="تحديد الشبكات" allSelected={allVisibleSelected} onToggleAll={()=>setAll(visible.map(item=>item.id),!allVisibleSelected)} query={query} onQueryChange={setQuery} searchPlaceholder="بحث بالشبكة، المالك، المعرّف أو الرخصة" searchAction={<button type="button" aria-label="تصفية الشبكات" aria-expanded={filtersOpen} aria-controls="master-network-filters" onClick={()=>setFiltersOpen(value=>!value)} className={`group inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${filtersOpen?"bg-[#eaf1f8] text-[#315d8b] dark:bg-blue-500/10 dark:text-blue-200":"text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"}`}><ListFilter className="h-3.5 w-3.5 text-[#547493]"/><span>تصفية</span>{activeFilters>0&&<span className="rounded-full bg-[#6684a3] px-1.5 text-white">{activeFilters}</span>}<ChevronDown className={`h-3 w-3 ${filtersOpen?"rotate-180":""}`}/></button>} primaryAction={<ProjectButton variant="secondary" disabled={loading} onClick={()=>setRevision(value=>value+1)}><RefreshCw/>تحديث</ProjectButton>}/>
 {filtersOpen&&<div id="master-network-filters" className="grid items-start gap-3 rounded-2xl border border-slate-200 p-3 dark:border-white/10 sm:grid-cols-2 xl:grid-cols-3">
 <ProjectFilterGroup icon={CheckCircle2} title="الاشتراك" tone="subscription"><ProjectFilterChoices value={subscriptionFilter} onChange={setSubscriptionFilter} items={[{value:"all",label:"الكل",icon:Layers,accent:"text-blue-500"},{value:"active",label:"نشط",icon:CheckCircle2,accent:"text-emerald-600"},{value:"expired",label:"منتهي",icon:Clock3,accent:"text-amber-600"}]}/></ProjectFilterGroup>
 <ProjectFilterGroup icon={CalendarClock} title="صلاحية الاشتراك" tone="subscription"><ProjectDropdown compact bareOptionIcons value={validityFilter} onChange={setValidityFilter} options={[{value:"all",label:"كل الاشتراكات"},{value:"current",label:"ساري"},{value:"soon",label:"قريب من الانتهاء"},{value:"expired",label:"منتهي"},{value:"pending",label:"لم يبدأ"},{value:"other",label:"حالة أخرى أو موعد غير محدد"}]}/></ProjectFilterGroup>
 <ProjectFilterGroup icon={Activity} title="حداثة مؤشرات التشغيل" tone="connection"><ProjectDropdown compact bareOptionIcons value={readingFilter} onChange={setReadingFilter} options={[{value:"all",label:"كل القراءات"},{value:"fresh",label:"قراءة حديثة"},{value:"stale",label:"قديمة أو لم تصل"},{value:"failed",label:"تعذرت آخر قراءة"}]}/></ProjectFilterGroup>
 <ProjectFilterGroup icon={Database} title="خادم قاعدة البيانات" tone="server"><ProjectDropdown compact bareOptionIcons searchable value={serverFilter} onChange={setServerFilter} options={serverOptions}/></ProjectFilterGroup>
 {activeFilters>0&&<ProjectButton variant="ghost" onClick={()=>{setSubscriptionFilter("all");setReadingFilter("all");setServerFilter("all");setValidityFilter("all");}}>مسح التصفية</ProjectButton>}
 </div>}
 <div className="grid gap-3 sm:grid-cols-2" aria-label="متابعة صلاحية الاشتراكات">
 {[{value:"soon",title:"قريبة من الانتهاء",Icon:CalendarClock},{value:"expired",title:"اشتراكات منتهية",Icon:AlertTriangle}].map(({value,title,Icon})=><button key={value} type="button" aria-pressed={validityFilter===value} onClick={()=>setValidityFilter(current=>current===value?"all":value)} className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-right ${validityFilter===value?"border-amber-400 bg-amber-50 dark:bg-amber-500/10":"border-slate-200 bg-white dark:border-white/10 dark:bg-[var(--oneui-surface)]"}`}><span className="flex items-center gap-2 text-sm"><Icon className="h-5 w-5 text-amber-500"/>{title}</span><b className="text-xl tabular-nums">{items.filter(item=>expiryState(item,reminderDays,now)===value).length}</b></button>)}
 </div>
 <div role="group" aria-label="حالة الشبكات المفعّلة سابقًا" className="grid items-stretch gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
 {states.map(({value,title,Icon,tone,ink})=>{const count=value==="all"?baseItems.length:baseItems.filter(item=>operationalState(item,reminderDays,now)===value).length,percent=baseItems.length?Math.round(count/baseItems.length*100):0;
 return <ProjectButton key={value} variant="secondary" aria-pressed={filter===value} onClick={()=>setFilter(current=>current===value?"all":value)} className="group !h-auto !min-h-0 !w-full !justify-start !rounded-[18px] !border-0 !bg-transparent !p-0 !shadow-none">
 <ProjectInfoCard tone={tone} className={`!min-h-[130px] !w-full !border-t-[3px] !p-4 text-right transition-transform group-hover:-translate-y-1 motion-reduce:transform-none ${ink} ${filter===value?"ring-2 ring-blue-400 shadow-md":""}`}>
 <span className="flex items-start justify-between gap-2"><span className="text-[11px] font-semibold">{title}</span><Icon className="h-5 w-5"/></span>
 <span className="mt-3 flex items-baseline gap-1.5"><b className="text-3xl tabular-nums">{count}</b><span className="text-xs">شبكة</span></span>
 <span className="mt-3 block h-1 rounded-full bg-slate-200 dark:bg-white/10"><span className="block h-full rounded-full bg-current" style={{width:percent+"%"}}/></span><span className="mt-1 block text-[10px]">{percent}% من نتائج البحث</span>
 </ProjectInfoCard></ProjectButton>})}
 </div>
 <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[var(--oneui-surface)]">
 <span className="text-sm"><Users className="ml-2 inline h-4 w-4 text-blue-500"/>إجمالي الشبكات · {filtered.length}</span>
 <div className="flex items-center gap-2"><span className="text-xs">الترتيب</span><ProjectDropdown compact value={sort} onChange={setSort} options={[{value:"expiry",label:"موعد انتهاء الاشتراك"},{value:"name",label:"اسم الشبكة"},{value:"id",label:"معرّف الشبكة"},{value:"subscribers",label:"عدد مشتركي PPPoE"}]}/><ProjectButton variant="secondary" size="icon" aria-label={descending?"ترتيب تصاعدي":"ترتيب تنازلي"} onClick={()=>setDescending(value=>!value)}><ArrowUpDown className="h-4 w-4"/></ProjectButton></div>
 <div className="flex min-w-0 items-center justify-between gap-2 border-t border-slate-200/70 pt-3 dark:border-white/10 lg:border-r lg:border-t-0 lg:pr-3 lg:pt-0"><span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-slate-600 dark:text-slate-300"><Rows3 aria-hidden="true" className="h-4 w-4 shrink-0"/>عدد العناصر</span><ProjectDropdown bareOptionIcons value={pageSize} onChange={setPageSize} compact className="w-[124px] max-w-full" placeholder="العدد" options={[{value:"50",label:"50 عنصرًا"},{value:"100",label:"100 عنصر"},{value:"150",label:"150 عنصر"},{value:"all",label:"كل النتائج"}]}/></div>
 </div>
 <BulkSelectionBar count={selection.size} noun="الشبكات" allSelected={allVisibleSelected} onToggleAll={()=>setAll(visible.map(item=>item.id),!allVisibleSelected)} onClearSelection={()=>setSelection(new Set())}/>
 {loading?<CollectionState loading>جارٍ تحميل الشبكات…</CollectionState>:error?<CollectionState><p role="alert">{error}</p><ProjectButton onClick={()=>setRevision(value=>value+1)}>إعادة المحاولة</ProjectButton></CollectionState>:!filtered.length?<CollectionState>لا توجد شبكات مطابقة.</CollectionState>:<CollectionGrid className={view==="row"?"!grid-cols-1":""}>{visible.map(item=>{const state=networkState(item,reminderDays,now),StateIcon=state.Icon;return <CollectionCard hostingerStyle key={item.id} selectionMode={selectionMode} selected={selection.has(item.id)} onToggle={()=>toggle(item.id)} onOpen={()=>router.push("/Dashboard/networks/"+item.id)}>
 <div className={view==="row"?"grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)_minmax(290px,1.4fr)]":"space-y-4"}>
 <div className="min-w-0">
 <div className="flex flex-wrap items-center gap-2"><span aria-label={"معرّف الشبكة "+item.id+" · "+state.label} className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-xs font-semibold ${state.tone}`}><Hash className="h-3.5 w-3.5"/>{item.id}</span><h3 className="min-w-0 break-words text-sm font-semibold">{item.name}</h3></div>
 <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><UserRound className="h-4 w-4 shrink-0 text-violet-500"/>{item.ownerName||"غير محدد"}</p>
 <p className={`mt-2 flex items-center gap-1.5 text-xs ${state.tone.split(" ").filter(token=>token.startsWith("text-")||token.startsWith("dark:text-")).join(" ")}`}><StateIcon className="h-4 w-4"/>{state.label}</p>
 <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><ShieldCheck className="h-4 w-4 text-blue-500"/>الاشتراك · {label(item.subscriptionStatus)}</p>
 </div>
 <div className="min-w-0"><SubscriptionDates item={item} days={reminderDays}/></div>
 <div className="grid min-w-0 items-start gap-3 sm:grid-cols-2">
 <ConnectionChart title="متصلو PPPoE" connected={item.metrics?.connectedSubscribers} total={item.metrics?.totalSubscribers} Icon={Wifi} tone="text-emerald-600 dark:text-emerald-300"/>
 <ConnectionChart title="NAS المرتبطة · المتصلة" connected={item.metrics?.connectedNas} total={item.metrics?.totalNas} Icon={Router} tone="text-sky-600 dark:text-sky-300"/>
 <p className="flex items-center gap-1.5 text-xs"><WifiOff className="h-4 w-4 text-blue-500"/>غير المتصلين · {item.metrics?.disconnectedSubscribers??"—"}</p>
 <p className="flex items-center gap-1.5 text-xs"><Activity className="h-4 w-4 text-violet-500"/>الجلسات · {item.metrics?.activeSessions??"—"}</p>
 <p className="flex items-center gap-1.5 text-xs sm:col-span-2"><Users className="h-4 w-4 text-teal-500"/>مشتركون جدد خلال 24 ساعة · {item.metrics?.newSubscribers24h??"—"}</p>
 </div>
 </div>
 <footer className="mt-4 space-y-3 border-t border-slate-200 pt-3 dark:border-white/10">
 <details onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()} className="rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-white/10">
 <summary className="cursor-pointer text-slate-600 dark:text-slate-300"><Database className="mx-1 inline h-4 w-4 text-violet-500"/>التفاصيل التقنية</summary>
 <dl className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2"><div><dt className="text-slate-500 dark:text-slate-400">قاعدة البيانات</dt><dd className="mt-1 break-all"><bdi>{item.databaseName||"لم تُجهّز"}</bdi></dd></div><div><dt className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><Server className="h-3.5 w-3.5 text-sky-500"/>الخادم</dt><dd className="mt-1 break-words">{item.databaseServerName||"غير محدد"}</dd></div></dl>
 </details>
 <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]"><p className="flex items-start gap-1.5 text-slate-500 dark:text-slate-400"><CalendarClock className="h-3.5 w-3.5 shrink-0"/><span>آخر قراءة · {date(item.metricsReadAt)}</span></p><p className={item.metricsStatus==="unavailable"||item.metricsStale?"text-amber-700 dark:text-amber-300":"text-slate-500 dark:text-slate-400"}>{item.metricsStatus==="unavailable"?"تعذرت آخر قراءة":item.metricsStale?"قديمة أو بانتظار التحديث":"قراءة حديثة"}</p></div>
 </footer>
 </CollectionCard>})}</CollectionGrid>}
 <div className="flex items-center justify-between"><ProjectButton variant="secondary" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>السابق</ProjectButton><span className="text-xs">{currentPage} / {pageCount}</span><ProjectButton variant="secondary" disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>التالي</ProjectButton></div>
 </>}
 {networkId&&!loading&&!error&&!selected&&<CollectionState>الشبكة غير موجودة أو غير متاحة.</CollectionState>}
 {networkId&&selected&&<h2 className="text-lg font-semibold">ملف الشبكة · {selected.name}</h2>}
 <section aria-label="ملف الشبكة" className="space-y-4">
 {selected&&<SubscriptionDates item={selected} days={reminderDays}/>}
 {selected&&<div className="grid gap-4 sm:grid-cols-2">{[
 ["بيانات الشبكة",[["المعرّف",selected.id],["المالك",selected.ownerName],["الرخصة",selected.licenseNumber],["الحالة",label(selected.status)]]],
 ["الاشتراك والبيئة",[["الخطة",selected.planName||"غير محددة"],["بدء الاشتراك",selected.startsAt?date(selected.startsAt):"لم يبدأ"],["الاشتراك",label(selected.subscriptionStatus)],["البيئة",label(selected.environmentStatus)],["انتهاء الاشتراك",date(selected.expiresAt)]]],
 ["قاعدة البيانات المستقلة",[["القاعدة",selected.databaseName||"لم تُجهّز"],["الخادم",selected.databaseServerName||"غير محدد"],["الصحة",label(selected.databaseStatus)]]],
 ["آخر مؤشرات التشغيل",[["إجمالي مشتركي PPPoE",selected.metrics?.totalSubscribers??"غير متاح"],["المتصلون",selected.metrics?.connectedSubscribers??"غير متاح"],["غير المتصلين",selected.metrics?.disconnectedSubscribers??"غير متاح"],["الجدد خلال 24 ساعة",selected.metrics?.newSubscribers24h??"غير متاح"],["الجلسات النشطة",selected.metrics?.activeSessions??"غير متاح"],["NAS المتصلة",selected.metrics?.connectedNas??"غير متاح"],["إجمالي NAS",selected.metrics?.totalNas??"غير متاح"],["وقت قراءة المؤشرات",date(selected.metricsReadAt)],["صحة RADIUS",label(selected.radiusStatus)],["آخر تقرير",date(selected.reportedAt)],["آخر ظهور",date(selected.lastSeenAt)]]]
 ].map(([title,fields])=><ProjectInfoCard key={String(title)}><h3 className="mb-3 font-semibold">{String(title)}</h3><dl className="space-y-3">{(fields as Array<[string,string|number]>).map(([name,value])=><div key={name}><dt className="text-xs text-slate-500 dark:text-slate-400">{name}</dt><dd className="mt-1 break-words text-sm"><bdi>{value}</bdi></dd></div>)}</dl></ProjectInfoCard>)}</div>}
 </section>
 </div>;
}
