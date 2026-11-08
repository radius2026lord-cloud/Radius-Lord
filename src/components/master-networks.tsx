"use client";
import {useRouter} from "next/navigation";
import {useEffect,useMemo,useRef,useState} from "react";
import {ArrowRight,History,Network,RefreshCw,Filter,Database,Users,Activity,Clock3,CheckCircle2,AlertTriangle,Layers,ListFilter,ChevronDown,ArrowUpDown,Hash,Eye,X,UserRound,Server,Wifi,WifiOff,Router,CalendarClock,ShieldCheck,Power,Package,Rows3,Copy,ExternalLink,KeyRound,Radio} from "lucide-react";
import {CollectionToolbar,CollectionGrid,CollectionCard,CollectionState,useCollectionDisplay} from "@/components/ui/collection-display";
import {useClock24h} from "@/components/ui/project-clock-provider";
import CircularProgress from "@/components/ui/circular-progress";
import ProjectTooltip from "@/components/ui/project-tooltip";
import ProjectDropdown from "@/components/ui/project-dropdown";
import {ProjectFilterGroup,ProjectFilterChoices} from "@/components/ui/project-filter-panel";
import BulkSelectionBar from "@/components/ui/bulk-selection-bar";
import ProjectButton from "@/components/ui/project-button";
import NetworkAccessRecovery from "@/components/network-access-recovery";
import FloatingNotice from "@/components/ui/floating-notice";
import {ProjectInfoCard,ProjectCardIcon,type InfoCardTone} from "@/components/ui/project-info-card";
type Metrics={totalPppoeAccounts?:number;connectedPppoeAccounts?:number;totalHotspotAccounts?:number;connectedHotspotAccounts?:number;hotspotSessions?:number;totalSubscribers:number;connectedSubscribers:number;disconnectedSubscribers:number;newSubscribers24h:number;activeSessions:number;totalNas:number;connectedNas:number};
type TunnelState="connected"|"disconnected"|"partial"|"pending"|"unavailable"|"stale"|"unlinked";
type ConnectionEvent={at:string;state:"connected"|"disconnected"|"unknown";previousState:"connected"|"disconnected"|"unknown"|null;durationSeconds:number|null;baseline:boolean;tunnelId:number;nasId:number;gatewayId:number};
type Tunnel={since?:string|null;tunnelId:number;nasId:number;name:string;gatewayId:number;gateway:string;state:TunnelState;readAt:string|null;lastSeenAt:string|null};
type GatewayHealth={id:number;name:string;total:number;connected:number;disconnected:number;unavailable:boolean;stale:boolean;pending:boolean;attemptedAt:string|null;readAt:string|null};
function gatewayAffected(gateway:GatewayHealth){
 return gateway.unavailable||gateway.stale||gateway.disconnected>0;
}
function matchesGateway(item:NetworkRow,filter:string){
 if(filter==="all")return true;
 const affected=filter.startsWith("affected:");
 const id=Number(affected?filter.slice(9):filter);
 return Boolean(item.ovpn?.gateways?.some(gateway=>gateway.id===id&&(!affected||gatewayAffected(gateway))));
}
type NetworkRow={ovpn?:{gateways?:GatewayHealth[];state:TunnelState;total:number;connected:number;disconnected:number;readAt:string|null;history?:ConnectionEvent[];tunnels?:Tunnel[]};systemUrl?:string|null;planLimits?:{pppoe:number;nas:number}|null;upgradeRequest?:{requestedAt:string;requestedPppoeLimit:number|null;requestedNasLimit:number|null;includeRenewal:boolean}|null;renewalRequest?:{status:string;requestedAt:string;subscriptionId:number;expiresAt:string}|null;planName:string|null;startsAt:string|null;metrics:Metrics|null;metricsReadAt:string|null;metricsStatus:string;metricsStale:boolean;id:number;name:string;slug:string;status:string;licenseNumber:string;ownerName:string;environmentId:number|null;environmentStatus:string|null;databaseName:string|null;databaseServerName:string|null;subscriptionStatus:string|null;expiresAt:string|null;reportedAt:string|null;lastSeenAt:string|null;onlineUsers:number|null;activeSessions:number|null;databaseStatus:string|null;radiusStatus:string|null};
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
const subscriptionLabels={expired:"منتهٍ",pending:"لم يبدأ",soon:"قريب من الانتهاء",current:"ساري",other:"غير ساري أو غير محدد"};
const tunnelLabels:Record<TunnelState,{label:string;tone:InfoCardTone}>={
 connected:{label:"متصل",tone:"success"},partial:{label:"متصلة مع انقطاع بعض أجهزة NAS",tone:"warning"},
 disconnected:{label:"انقطاع كامل",tone:"danger"},unavailable:{label:"تعذّر الفحص",tone:"warning"},
 stale:{label:"قراءة قديمة",tone:"warning"},pending:{label:"بانتظار الفحص",tone:"pending"},
 unlinked:{label:"غير مربوط",tone:"info"},
};
function hasTunnelReading(state:TunnelState){
 return state==="connected"||state==="disconnected"||state==="partial";
}

function NetworkTunnelBadge({ovpn}:{ovpn:NetworkRow["ovpn"]}){
 const state=ovpn?.state??"pending",display=tunnelLabels[state];
 const known=hasTunnelReading(state);
 return <ProjectInfoCard tone={display.tone} className="flex flex-wrap items-center gap-2 !p-2 text-xs">
  <Router className="size-4 shrink-0"/><span>OpenVPN · {display.label}</span>
  {known&&ovpn&&<bdi className="font-semibold tabular-nums">{ovpn.connected}/{ovpn.total}</bdi>}
 </ProjectInfoCard>;
}

function operationalState(item:NetworkRow,days:number,now:number){
 const expiry=expiryState(item,days,now);
 if(expiry==="expired")return "expired";
 if(item.status!=="active"||item.environmentStatus!=="ready"||expiry==="other")return "suspended";
 if(expiry==="pending")return "pending";
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
function ConnectionRing({label,percent,tone,className=""}:{label:string;percent:number|null;tone:string;className?:string}){
 const color=tone.includes("rose")?"danger":tone.includes("amber")?"warning":tone.includes("emerald")?"success":tone.includes("violet")?"pending":"info";
 return <CircularProgress value={percent} label={label} caption="متصل" size={className?"md":"xs"} tone={color}/>;
}

function ConnectionChart({title,connected,total,Icon,tone,sessions}:{title:string;connected?:number;total?:number;Icon:typeof Users;tone:string;sessions?:number}){
 const available=typeof connected==="number"&&typeof total==="number";
 const percent=available&&total>0?Math.max(0,Math.min(100,Math.round(100*connected/total))):0;
 return <div className="flex h-full min-w-0 flex-col gap-3 rounded-2xl border border-slate-200/80 p-3 dark:border-white/10">
 <p className="flex items-center gap-2 text-xs font-semibold"><Icon className={`h-4 w-4 shrink-0 ${tone}`}/>{title}</p>
 <div className="flex min-w-0 items-center gap-3">
 <ConnectionRing label={title} percent={available?percent:null} tone={tone}/>
 <dl className="min-w-0 flex-1 space-y-1 text-xs"><div className="flex flex-wrap justify-between gap-x-2"><dt className="text-slate-500 dark:text-slate-400">الإجمالي</dt><dd className="font-semibold tabular-nums">{total??"—"}</dd></div><div className="flex flex-wrap justify-between gap-x-2"><dt className="text-slate-500 dark:text-slate-400">متصل</dt><dd className={`font-semibold tabular-nums ${tone}`}>{connected??"—"}</dd></div><div className="flex flex-wrap justify-between gap-x-2"><dt className="text-slate-500 dark:text-slate-400">غير متصل</dt><dd className="tabular-nums">{available?Math.max(0,total-connected):"—"}</dd></div></dl>
 </div>
 <p className="mt-auto border-t border-slate-200 pt-2 text-[10px] text-slate-500 dark:border-white/10 dark:text-slate-400">{!available?"بانتظار القراءة":sessions!==undefined?"الجلسات النشطة · "+sessions:"نسبة الاتصال · "+percent+"%"}</p>
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
function SubscriptionDates({item,days,now}:{item:NetworkRow;days:number;now:number}){
 const expiry=item.expiresAt?Date.parse(item.expiresAt):NaN;
 const remaining=expiry-now;
 const start=item.startsAt?Date.parse(item.startsAt):NaN;
 const valid=Number.isFinite(start)&&Number.isFinite(expiry)&&expiry>start;
 const elapsed=Number.isFinite(start)?Math.max(0,Math.floor((now-start)/86400000)):null;
 const percent=valid?Math.max(0,Math.min(100,Math.round(100*(now-start)/(expiry-start)))):0;
 const remainingText=remaining<=0?"انتهى الاشتراك":remaining<86400000?Math.floor(remaining/3600000)+" ساعة و "+Math.floor(remaining%3600000/60000)+" دقيقة":Math.ceil(remaining/86400000)+" يوم";
 const expired=Number.isFinite(expiry)&&remaining<=0;
 const approaching=Number.isFinite(expiry)&&remaining>0&&remaining<=days*86400000;
 return <div className={`min-w-0 space-y-3 rounded-2xl border p-4 text-xs shadow-sm ${expired||approaching?"border-amber-300 bg-amber-50/70 dark:border-amber-400/30 dark:bg-amber-500/[.07]":"border-blue-200 bg-[#f3f7fd] dark:border-blue-300/20 dark:bg-blue-400/[.06]"}`}>
 <p className="flex min-w-0 items-start gap-2 font-semibold"><Package className="h-4 w-4 shrink-0 text-violet-500"/><span className="break-words leading-5">{item.planName||"الخطة غير محددة"}</span></p>{item.upgradeRequest&&<div className="mt-2 space-y-1 text-xs text-violet-700 dark:text-violet-300"><p className="flex items-center gap-2"><Package className="h-4 w-4 shrink-0"/>طلب ترقية السعة</p><p className="leading-6">{item.upgradeRequest.requestedPppoeLimit!==null?`PPPoE المطلوب: ${item.upgradeRequest.requestedPppoeLimit.toLocaleString('ar')}`:''}{item.upgradeRequest.requestedPppoeLimit!==null&&item.upgradeRequest.requestedNasLimit!==null?' · ':''}{item.upgradeRequest.requestedNasLimit!==null?`NAS المطلوب: ${item.upgradeRequest.requestedNasLimit.toLocaleString('ar')}`:''}{item.upgradeRequest.includeRenewal?' · مع تجديد الاشتراك':''}</p></div>}{item.renewalRequest&&<p className="mt-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300"><CalendarClock className="h-4 w-4 shrink-0"/>طلب تجديد مسجل · {date(item.renewalRequest.requestedAt)}</p>}
 <div><p className="text-slate-500 dark:text-slate-400">بدء الاشتراك</p><DateStamp value={item.startsAt} empty="لم يبدأ"/></div>
 <div className="border-t border-blue-200/70 pt-3 dark:border-white/10"><p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><CalendarClock className="h-4 w-4 shrink-0 text-amber-500"/>انتهاء الاشتراك</p><DateStamp value={item.expiresAt} empty="لم يُحدد"/>{Number.isFinite(expiry)&&remaining>0&&<p className="mt-2 text-slate-500 dark:text-slate-400">متبقٍ {Math.ceil(remaining/86400000)} يوم</p>}</div>
 <div className="grid grid-cols-2 gap-3 border-t border-blue-200/70 pt-3 dark:border-white/10"><div><p className="text-slate-500 dark:text-slate-400">مضى على التفعيل</p><p className="mt-1 text-base font-semibold tabular-nums">{elapsed===null?"—":elapsed+" يوم"}</p></div><div><p className="text-slate-500 dark:text-slate-400">المتبقي</p><p className="mt-1 break-words text-base font-semibold tabular-nums">{Number.isFinite(expiry)?remainingText:"—"}</p></div></div>
 {valid&&<div><div role="progressbar" aria-label="المدة المنقضية من الاشتراك" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1.5 overflow-hidden rounded-full bg-blue-100 dark:bg-white/10"><div className={`h-full rounded-full ${approaching||expired?"bg-amber-500":"bg-blue-500"}`} style={{width:percent+"%"}}/></div><p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{percent}% من مدة الاشتراك انقضت</p></div>}
 {(approaching||expired)&&<p role="status" className="flex items-start gap-1.5 border-t border-amber-200 pt-2 leading-5 text-amber-700 dark:border-amber-400/20 dark:text-amber-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>{expired?"انتهى الاشتراك، يلزم التجديد":"بادر بتجديد الخطة"}</p>}
 </div>;
}
function readingLabel(item:NetworkRow){
 return item.metricsStatus==="unavailable"?"تعذرت آخر قراءة":!item.metricsReadAt?"بانتظار أول قراءة":item.metricsStale?"قراءة قديمة":"قراءة حديثة";
}

const networkReturnKey="lord-radius:master-networks:return";

type NetworkListReturn = {
 query:string; filter:string; filtersOpen:boolean; subscriptionFilter:string; readingFilter:string;
 serverFilter:string; validityFilter:string; requestFilter:string; tunnelFilter?:string; gatewayFilter?:string; sort:string; descending:boolean;
 pageSize:string; page:number; scrollTop:number;
};

function networkFilterKey(state:Pick<NetworkListReturn,"query"|"filter"|"subscriptionFilter"|"readingFilter"|"serverFilter"|"validityFilter"|"requestFilter"|"tunnelFilter"|"gatewayFilter"|"pageSize">){
 return JSON.stringify([state.query,state.filter,state.subscriptionFilter,state.readingFilter,state.serverFilter,state.validityFilter,state.requestFilter,state.tunnelFilter??"all",state.gatewayFilter??"all",state.pageSize]);
}

export default function MasterNetworks({networkId}:{networkId?:number}){
 const router=useRouter();
 const listRoot=useRef<HTMLDivElement>(null);
 const lastFilterKey=useRef<string|null>(null);
 const [returnScroll,setReturnScroll]=useState<number|null>(null);
 const [items,setItems]=useState<NetworkRow[]>([]),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(""),[revision,setRevision]=useState(0);
 const [now,setNow]=useState(()=>Date.now());
 const [validityFilter,setValidityFilter]=useState("all");
 const [requestFilter,setRequestFilter]=useState("all");
 const [tunnelFilter,setTunnelFilter]=useState("all");
 const [gatewayFilter,setGatewayFilter]=useState("all");
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
 const [reminderDays,setReminderDays]=useState(7);
 const [hasLoaded,setHasLoaded]=useState(false);
 const [query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[filtersOpen,setFiltersOpen]=useState(false);
 const [subscriptionFilter,setSubscriptionFilter]=useState("all"),[readingFilter,setReadingFilter]=useState("all"),[serverFilter,setServerFilter]=useState("all");
 const [sort,setSort]=useState("name"),[descending,setDescending]=useState(false),[pageSize,setPageSize]=useState("50"),[page,setPage]=useState(1);
 const {view,setView,selected:selection,setSelected:setSelection,toggle,setAll,selectionMode,setSelectionMode,hydrated}=useCollectionDisplay<number>("master-networks","row");
 useEffect(()=>{
  const controller=new AbortController();
  let inFlight=false;
  async function read(){
   if(inFlight||controller.signal.aborted)return;
   inFlight=true;setRefreshing(true);
   try{
    const response=await fetch("/api/billing/admin/networks"+(networkId?`?networkId=${networkId}`:""),{credentials:"include",cache:"no-store",signal:controller.signal});
    const body=await response.json();
    if(!response.ok)throw Error(body.message||"تعذر تحميل الشبكات.");
    if(controller.signal.aborted)return;
    setItems(body.items||[]);setReminderDays(body.reminderSettings?.expiryDays??7);
    setError("");setHasLoaded(true);
   }catch(reason){
    if(controller.signal.aborted)return;
    const message=reason instanceof Error?reason.message:"تعذر تحميل الشبكات.";
    setError(message);
   }finally{
    inFlight=false;
    if(!controller.signal.aborted){setLoading(false);setRefreshing(false);}
   }
  }
  const refreshVisible=()=>{if(document.visibilityState==="visible")void read();};
  void read();
  const timer=setInterval(refreshVisible,60000);
  document.addEventListener("visibilitychange",refreshVisible);
  return()=>{controller.abort();clearInterval(timer);document.removeEventListener("visibilitychange",refreshVisible);};
 },[revision,networkId]);
 const selected=networkId?items.find(item=>Number(item.id)===networkId):undefined;
 const matchesFilters=(item:NetworkRow)=>(subscriptionFilter==="all"||(subscriptionFilter==="active"?["current","soon"].includes(expiryState(item,reminderDays,now)):expiryState(item,reminderDays,now)==="expired"))
 &&matchesGateway(item,gatewayFilter)
 &&(tunnelFilter==="all"||(item.ovpn?.state??"pending")===tunnelFilter)
 &&(requestFilter==="all"||(requestFilter==="renewal"?Boolean(item.renewalRequest||item.upgradeRequest?.includeRenewal):Boolean(item.upgradeRequest)))
 &&(validityFilter==="all"||expiryState(item,reminderDays,now)===validityFilter)
 &&(serverFilter==="all"||item.databaseServerName===serverFilter)
 &&(readingFilter==="all"||(readingFilter==="fresh"?item.metricsStatus==="ok"&&!item.metricsStale:readingFilter==="failed"?item.metricsStatus==="unavailable":item.metricsStale))
 &&[item.id,item.name,item.ownerName,item.licenseNumber,item.databaseName].some(value=>String(value??"").toLowerCase().includes(query.trim().toLowerCase()));
 const baseItems=useMemo(()=>items.filter(matchesFilters),[items,query,subscriptionFilter,readingFilter,serverFilter,validityFilter,requestFilter,tunnelFilter,gatewayFilter,reminderDays,now]);
 const filtered=useMemo(()=>baseItems.filter(item=>filter==="all"||operationalState(item,reminderDays,now)===filter).sort((a,b)=>{
 if(sort==="expiry"){
 const left=a.expiresAt?Date.parse(a.expiresAt):NaN,right=b.expiresAt?Date.parse(b.expiresAt):NaN;
 if(!Number.isFinite(left)||!Number.isFinite(right))return Number.isFinite(left)?-1:Number.isFinite(right)?1:a.id-b.id;
 return (descending?right-left:left-right)||a.id-b.id;
 }
 const comparison=sort==="id"?a.id-b.id:sort==="subscribers"?(a.metrics?.totalSubscribers??-1)-(b.metrics?.totalSubscribers??-1):a.name.localeCompare(b.name,"ar");
 return descending?-comparison:comparison;
 }),[baseItems,filter,sort,descending,reminderDays,now]);
 const activeFilters=Number(subscriptionFilter!=="all")+Number(readingFilter!=="all")+Number(serverFilter!=="all")+Number(validityFilter!=="all")+Number(requestFilter!=="all")+Number(tunnelFilter!=="all")+Number(gatewayFilter!=="all");
 const effectivePageSize=pageSize==="all"?Math.max(1,filtered.length):Number(pageSize);
 const pageCount=Math.max(1,Math.ceil(filtered.length/effectivePageSize));
 const currentPage=Math.min(page,pageCount);
 const visible=filtered.slice((currentPage-1)*effectivePageSize,currentPage*effectivePageSize);
 const allVisibleSelected=visible.length>0&&visible.every(item=>selection.has(item.id));
 const filterKey=networkFilterKey({query,filter,subscriptionFilter,readingFilter,serverFilter,validityFilter,requestFilter,tunnelFilter,gatewayFilter,pageSize});
 useEffect(()=>{
  if(lastFilterKey.current!==null&&lastFilterKey.current!==filterKey){
   setPage(1);
   setSelection(new Set());
  }
  lastFilterKey.current=filterKey;
 },[filterKey,setSelection]);

 useEffect(()=>{
  if(networkId)return;
  try{
   const raw=sessionStorage.getItem(networkReturnKey);
   if(!raw)return;
   const saved=JSON.parse(raw) as NetworkListReturn;
   lastFilterKey.current=networkFilterKey(saved);
   setQuery(saved.query);setFilter(saved.filter);setFiltersOpen(saved.filtersOpen);
   setSubscriptionFilter(saved.subscriptionFilter);setReadingFilter(saved.readingFilter);setServerFilter(saved.serverFilter);
   setValidityFilter(saved.validityFilter);setRequestFilter(saved.requestFilter);setTunnelFilter(saved.tunnelFilter??"all");setGatewayFilter(saved.gatewayFilter??"all");
   setSort(saved.sort);setDescending(saved.descending);setPageSize(saved.pageSize);setPage(saved.page);
   setReturnScroll(saved.scrollTop);
  }catch{/* List navigation still works when session storage is unavailable. */}
 },[networkId]);

 useEffect(()=>{
  if(networkId||!hasLoaded||!hydrated||returnScroll===null)return;
  const frame=requestAnimationFrame(()=>{
   const workspace=listRoot.current?.closest<HTMLElement>(".workspace-scroll");
   workspace?.scrollTo({top:returnScroll,behavior:"instant"});
   try{sessionStorage.removeItem(networkReturnKey);}catch{}
   setReturnScroll(null);
  });
  return()=>cancelAnimationFrame(frame);
 },[networkId,hasLoaded,hydrated,returnScroll]);

 function openNetwork(id:number){
  const saved:NetworkListReturn={
   query,filter,filtersOpen,subscriptionFilter,readingFilter,serverFilter,validityFilter,requestFilter,tunnelFilter,gatewayFilter,
   sort,descending,pageSize,page:currentPage,
   scrollTop:listRoot.current?.closest<HTMLElement>(".workspace-scroll")?.scrollTop??0,
  };
  try{sessionStorage.setItem(networkReturnKey,JSON.stringify(saved));}catch{}
  router.push("/Dashboard/networks/"+id);
 }
 const serverOptions=[{value:"all",label:"كل الخوادم"},...Array.from(new Set(items.map(item=>item.databaseServerName).filter((name):name is string=>Boolean(name)))).map(name=>({value:name,label:name}))];
 const gatewayGroups=useMemo(()=>{
  const groups=new Map<number,{id:number;name:string;networks:number;affectedNetworks:number;total:number;disconnected:number;unknown:number;unavailable:boolean;stale:boolean}>();
  for(const item of items){
   for(const gateway of item.ovpn?.gateways??[]){
    const current=groups.get(gateway.id)??{id:gateway.id,name:gateway.name,networks:0,affectedNetworks:0,total:0,disconnected:0,unknown:0,unavailable:false,stale:false};
    current.networks++;
    current.total+=gateway.total;
    current.affectedNetworks+=Number(gatewayAffected(gateway));
    current.disconnected+=gateway.disconnected;
    current.unknown+=gateway.unavailable||gateway.stale||gateway.pending?gateway.total:0;
    current.unavailable||=gateway.unavailable;
    current.stale||=gateway.stale;
    groups.set(gateway.id,current);
   }
  }
  return [...groups.values()].sort((a,b)=>b.affectedNetworks-a.affectedNetworks||a.name.localeCompare(b.name,"ar"));
 },[items]);
 function openGatewayAlert(id:number){
  setQuery("");setFilter("all");setSubscriptionFilter("all");setReadingFilter("all");setServerFilter("all");setValidityFilter("all");setRequestFilter("all");setTunnelFilter("all");
  setGatewayFilter("affected:"+id);setFiltersOpen(true);
 }
 const states=[
 {value:"all",title:"كل الشبكات",Icon:Layers,tone:"info" as const,ink:"text-blue-700 dark:text-blue-200"},
 {value:"active",title:"نشطة",Icon:CheckCircle2,tone:"success" as const,ink:"text-emerald-700 dark:text-emerald-200"},
 {value:"soon",title:"قريبة من الانتهاء",Icon:CalendarClock,tone:"warning" as const,ink:"text-orange-700 dark:text-orange-200"},
 {value:"expired",title:"منتهية",Icon:Clock3,tone:"warning" as const,ink:"text-amber-700 dark:text-amber-200"},
 {value:"pending",title:"لم يبدأ الاشتراك",Icon:Clock3,tone:"pending" as const,ink:"text-violet-700 dark:text-violet-300"},
 {value:"suspended",title:"موقوفة",Icon:Power,tone:"danger" as const,ink:"text-rose-700 dark:text-rose-200"}];
 return <div ref={listRoot} dir="rtl" className="space-y-4">
 {networkId&&<div className="flex justify-end"><ProjectButton variant="back" onClick={()=>router.push("/Dashboard/networks")}><ArrowRight aria-hidden="true"/>العودة إلى الشبكات</ProjectButton></div>}
 {!networkId&&<>
 <CollectionToolbar hostingerStyle responsive title="الشبكات" description="الشبكات التي اكتمل تفعيل بيئتها، مع حالة اشتراكها وآخر مؤشرات التشغيل" icon={Network} view={view} onViewChange={setView} selectionMode={selectionMode} onSelectionModeChange={value=>{setSelectionMode(value);if(!value)setSelection(new Set());}} selectionAcrossViews showSelectionControl selectionLabel="تحديد الشبكات" allSelected={allVisibleSelected} onToggleAll={()=>setAll(visible.map(item=>item.id),!allVisibleSelected)} query={query} onQueryChange={setQuery} searchPlaceholder="بحث بالشبكة، المالك، المعرّف أو الرخصة" searchAction={<button type="button" aria-label="تصفية الشبكات" aria-expanded={filtersOpen} aria-controls="master-network-filters" onClick={()=>setFiltersOpen(value=>!value)} className={`group inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${filtersOpen?"bg-[#eaf1f8] text-[#315d8b] dark:bg-blue-500/10 dark:text-blue-200":"text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"}`}><ListFilter className="h-3.5 w-3.5 text-[#547493]"/><span>تصفية</span>{activeFilters>0&&<span className="rounded-full bg-[#6684a3] px-1.5 text-white">{activeFilters}</span>}<ChevronDown className={`h-3 w-3 ${filtersOpen?"rotate-180":""}`}/></button>} primaryAction={<ProjectButton variant="secondary" disabled={refreshing} onClick={()=>setRevision(value=>value+1)}><RefreshCw className={refreshing?'animate-spin':''}/>تحديث</ProjectButton>}/>
 {gatewayGroups.some(gateway=>gateway.affectedNetworks>0)&&<section aria-label="تنبيهات خوادم CHR" className="grid items-start gap-4 md:grid-cols-2">
  {gatewayGroups.filter(gateway=>gateway.affectedNetworks>0).map(gateway=><ProjectInfoCard key={gateway.id} tone={gateway.unavailable||gateway.stale?"warning":"danger"} className="min-w-0 space-y-3">
   <h2 className="flex min-w-0 items-center gap-2 font-semibold"><ProjectCardIcon icon={Server} tone={gateway.unavailable||gateway.stale?"warning":"danger"}/><span className="break-words">{gateway.name}</span></h2>
   <p className="text-sm">{gateway.unavailable?"تعذّر فحص خادم CHR":gateway.stale?"قراءة CHR قديمة":"انقطاع أنفاق OpenVPN"}</p>
   <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs"><span className="flex items-center gap-1"><Network className="size-4 text-blue-500"/>{gateway.affectedNetworks} شبكات متأثرة</span>{gateway.disconnected>0&&<span className="flex items-center gap-1"><WifiOff className="size-4 text-rose-500"/>{gateway.disconnected} أجهزة NAS منقطعة</span>}{gateway.unknown>0&&<span className="flex items-center gap-1"><AlertTriangle className="size-4 text-amber-500"/>{gateway.unknown} أجهزة تحتاج تحققًا</span>}</div>
   <ProjectButton variant="secondary" onClick={()=>openGatewayAlert(gateway.id)}><Eye/>عرض الشبكات المتأثرة</ProjectButton>
  </ProjectInfoCard>)}
 </section>}
 {filtersOpen&&<div id="master-network-filters" className="grid items-start gap-3 rounded-2xl border border-slate-200 p-3 dark:border-white/10 sm:grid-cols-2 xl:grid-cols-3">
 <ProjectFilterGroup icon={CheckCircle2} title="الاشتراك" tone="subscription"><ProjectFilterChoices value={subscriptionFilter} onChange={setSubscriptionFilter} items={[{value:"all",label:"الكل",icon:Layers,accent:"text-blue-500"},{value:"active",label:"نشط",icon:CheckCircle2,accent:"text-emerald-600"},{value:"expired",label:"منتهي",icon:Clock3,accent:"text-amber-600"}]}/></ProjectFilterGroup>
 <ProjectFilterGroup icon={CalendarClock} title="صلاحية الاشتراك" tone="subscription"><ProjectDropdown compact bareOptionIcons value={validityFilter} onChange={setValidityFilter} options={[{value:"all",label:"كل الاشتراكات"},{value:"current",label:"ساري"},{value:"soon",label:"قريب من الانتهاء"},{value:"expired",label:"منتهي"},{value:"pending",label:"لم يبدأ"},{value:"other",label:"حالة أخرى أو موعد غير محدد"}]}/></ProjectFilterGroup>
 <ProjectFilterGroup icon={Activity} title="حداثة مؤشرات التشغيل" tone="connection"><ProjectDropdown compact bareOptionIcons value={readingFilter} onChange={setReadingFilter} options={[{value:"all",label:"كل القراءات"},{value:"fresh",label:"قراءة حديثة"},{value:"stale",label:"قديمة أو لم تصل"},{value:"failed",label:"تعذرت آخر قراءة"}]}/></ProjectFilterGroup>
 <ProjectFilterGroup icon={Router} title="اتصال OpenVPN" tone="connection">
  <ProjectDropdown compact bareOptionIcons value={tunnelFilter} onChange={setTunnelFilter} options={[{value:"all",label:"كل حالات الاتصال"},...Object.entries(tunnelLabels).map(([value,status])=>({value,label:status.label,icon:Router}))]}/>
 </ProjectFilterGroup>
 <ProjectFilterGroup icon={Server} title="خادم اتصال CHR" tone="server">
  <ProjectDropdown compact searchable value={gatewayFilter} onChange={setGatewayFilter} options={[{value:"all",label:"كل خوادم CHR"},...gatewayGroups.flatMap(gateway=>[{value:String(gateway.id),label:gateway.name,icon:Server},{value:"affected:"+gateway.id,label:"المتأثرة على "+gateway.name,icon:AlertTriangle}])]}/>
 </ProjectFilterGroup>
 <ProjectFilterGroup icon={Package} title="طلبات الاشتراك" tone="subscription">
  <ProjectDropdown compact bareOptionIcons value={requestFilter} onChange={setRequestFilter} options={[
   {value:"all",label:"كل الشبكات"},
   {value:"renewal",label:"لديها طلب تجديد"},
   {value:"upgrade",label:"لديها طلب ترقية"},
  ]}/>
 </ProjectFilterGroup>
 <ProjectFilterGroup icon={Database} title="خادم قاعدة البيانات" tone="server"><ProjectDropdown compact bareOptionIcons searchable value={serverFilter} onChange={setServerFilter} options={serverOptions}/></ProjectFilterGroup>
 {activeFilters>0&&<ProjectButton variant="ghost" onClick={()=>{setSubscriptionFilter("all");setReadingFilter("all");setServerFilter("all");setValidityFilter("all");setRequestFilter("all");setTunnelFilter("all");setGatewayFilter("all");}}>مسح التصفية</ProjectButton>}
 </div>}
 <div role="group" aria-label="تصفية حسب حالة الشبكة" className="grid items-stretch gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
 {states.map(({value,title,Icon,tone,ink})=>{const count=value==="all"?baseItems.length:baseItems.filter(item=>operationalState(item,reminderDays,now)===value).length,percent=baseItems.length?Math.round(count/baseItems.length*100):0;
 return <ProjectButton key={value} variant="secondary" aria-pressed={filter===value} onClick={()=>setFilter(current=>current===value?"all":value)} className="group !h-auto !min-h-0 !w-full !justify-start !rounded-[18px] !border-0 !bg-transparent !p-0 !shadow-none">
 <ProjectInfoCard tone={tone} className={`!min-h-[130px] !w-full !border-t-[3px] !p-4 text-right transition-transform group-hover:-translate-y-1 motion-reduce:transform-none ${ink} ${filter===value?"ring-2 ring-slate-400 shadow-md dark:ring-blue-300/70":""}`}>
 <span className="flex items-start justify-between gap-2"><span className="text-[11px] font-semibold">{title}</span><Icon className="h-5 w-5"/></span>
 <span className="mt-3 flex items-baseline gap-1.5"><b className="text-2xl tabular-nums">{count.toLocaleString("ar")}</b><span className="text-xs">شبكة</span>{filter===value&&<span className="mr-auto flex items-center gap-1 text-[10px]"><CheckCircle2 className="size-3.5"/>محدد</span>}</span>
 <span className="mt-3 block h-1 rounded-full bg-slate-200 dark:bg-white/10"><span className="block h-full rounded-full bg-current" style={{width:percent+"%"}}/></span><span className="mt-1 block text-[10px]">{percent.toLocaleString("ar")}٪</span>
 </ProjectInfoCard></ProjectButton>})}
 </div>
 <div className="grid min-w-0 items-center gap-3 rounded-2xl border border-[#d7e2ed] bg-white p-3 dark:border-white/[.12] dark:bg-[#10243a] lg:grid-cols-[minmax(180px,.8fr)_minmax(0,1.4fr)_minmax(180px,.8fr)]">
 <div role="status" className="flex min-w-0 items-center gap-3"><Network className="size-5 shrink-0 text-slate-500"/><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold">ملفات الشبكات</p><p className="text-[10px] text-slate-500 dark:text-slate-400">{filtered.length!==items.length?`من أصل ${items.length.toLocaleString("ar")} شبكة`:"الشبكات التي اكتمل تجهيزها"}</p></div><strong className="text-2xl tabular-nums">{filtered.length.toLocaleString("ar")}</strong></div>
 <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-slate-200/70 pt-3 dark:border-white/10 lg:border-r lg:border-t-0 lg:pr-3 lg:pt-0"><span className="flex items-center gap-1.5 text-[11px]"><ArrowUpDown className="size-4"/>الترتيب</span><ProjectDropdown compact bareOptionIcons className="min-w-0 flex-1 lg:max-w-[260px]" value={sort} onChange={setSort} options={[{value:"expiry",label:"موعد انتهاء الاشتراك",icon:CalendarClock},{value:"name",label:"اسم الشبكة",icon:Network},{value:"id",label:"معرّف الشبكة",icon:Hash},{value:"subscribers",label:"عدد مشتركي PPPoE",icon:Users}]}/><ProjectButton variant="secondary" size="icon" aria-label={descending?"ترتيب تصاعدي":"ترتيب تنازلي"} onClick={()=>setDescending(value=>!value)}><ArrowUpDown className="h-4 w-4"/></ProjectButton></div>
 <div className="flex min-w-0 items-center justify-between gap-2 border-t border-slate-200/70 pt-3 dark:border-white/10 lg:border-r lg:border-t-0 lg:pr-3 lg:pt-0"><span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-slate-600 dark:text-slate-300"><Rows3 aria-hidden="true" className="h-4 w-4 shrink-0"/>عدد العناصر</span><ProjectDropdown bareOptionIcons value={pageSize} onChange={setPageSize} compact className="w-[124px] max-w-full" placeholder="العدد" options={[{value:"50",label:"50 عنصرًا"},{value:"100",label:"100 عنصر"},{value:"150",label:"150 عنصر"},{value:"all",label:"كل النتائج"}]}/></div>
 </div>
 {gatewayFilter!=="all"&&<div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-400/20 dark:bg-amber-500/10"><Server className="size-4 text-amber-600"/><span>{gatewayFilter.startsWith("affected:")?"الشبكات المتأثرة على ":"الشبكات المرتبطة بـ "}{gatewayGroups.find(gateway=>gateway.id===Number(gatewayFilter.replace("affected:","")))?.name??"CHR"}</span><ProjectButton variant="ghost" onClick={()=>setGatewayFilter("all")}><X/>مسح</ProjectButton></div>}
 <BulkSelectionBar count={selection.size} noun="الشبكات" allSelected={allVisibleSelected} onToggleAll={()=>setAll(visible.map(item=>item.id),!allVisibleSelected)} onClearSelection={()=>setSelection(new Set())}/>
 {hasLoaded&&error&&<ProjectInfoCard tone="warning" role="status">تعذر تحديث القائمة. تُعرض آخر بيانات متاحة.</ProjectInfoCard>}
 {loading?<CollectionState loading>جارٍ تحميل الشبكات…</CollectionState>:error&&!hasLoaded?<CollectionState><p role="alert">{error}</p><ProjectButton onClick={()=>setRevision(value=>value+1)}>إعادة المحاولة</ProjectButton></CollectionState>:!filtered.length?<CollectionState>لا توجد شبكات مطابقة.</CollectionState>:<CollectionGrid className={view==="row"?"!grid-cols-1":""}>{visible.map(item=>{const state=networkState(item,reminderDays,now),StateIcon=state.Icon;return <CollectionCard hostingerStyle key={item.id} selectionMode={selectionMode} selected={selection.has(item.id)} onToggle={()=>toggle(item.id)} onOpen={()=>openNetwork(item.id)}>
 <div className={view==="row"?"grid min-w-0 items-stretch gap-3 lg:grid-cols-[minmax(210px,260px)_minmax(0,1fr)]":"space-y-4"}>
 <section aria-label="هوية الشبكة" className="min-w-0 space-y-3 rounded-[20px] border border-[#e4e4e7] p-3 dark:border-white/[.12] dark:bg-[#0d243b]">
 <div className="flex flex-wrap items-center gap-2"><span aria-label={"معرّف الشبكة "+item.id+" · "+state.label} className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-xs font-semibold ${state.tone}`}><Hash className="h-3.5 w-3.5"/>{item.id}</span><h3 className="min-w-0 break-words text-sm font-semibold">{item.name}</h3></div>
 <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${state.tone}`}><StateIcon className="size-4 shrink-0"/>{state.label}</span>
 <dl className="grid min-w-0 grid-cols-2 gap-2 border-t border-slate-200 pt-3 text-xs dark:border-white/10">
  <div className="min-w-0"><dt className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><UserRound className="size-4 shrink-0 text-violet-500"/>المالك</dt><dd className="mt-1 break-words">{item.ownerName||"غير محدد"}</dd></div>
  <div className="min-w-0"><dt className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><ShieldCheck className="size-4 shrink-0 text-blue-500"/>الاشتراك</dt><dd className="mt-1 break-words">{subscriptionLabels[expiryState(item,reminderDays,now)]}</dd></div>
 </dl>
 <NetworkTunnelBadge ovpn={item.ovpn}/>
 </section>
 <section aria-label="اشتراك الشبكة ومؤشرات التشغيل" className="min-w-0 space-y-3 rounded-[20px] border border-[#e4e4e7] p-3 dark:border-white/[.12] dark:bg-[#0d243b]">
 <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
  <span className="flex items-center gap-2 font-semibold"><Activity className="size-4 text-blue-500"/>اشتراك الشبكة ومؤشرات التشغيل</span>
  <span className={item.metricsStatus==="unavailable"||item.metricsStale?"text-amber-700 dark:text-amber-300":"text-slate-500 dark:text-slate-400"}>{readingLabel(item)}</span>
 </div>
 <SubscriptionDates item={item} days={reminderDays} now={now}/>
 <div className={view==="row"?"grid min-w-0 items-stretch gap-3 xl:grid-cols-3":"grid min-w-0 items-stretch gap-3"}>
 <ConnectionChart title="حسابات PPPoE" connected={item.metrics?.connectedPppoeAccounts} total={item.metrics?.totalPppoeAccounts} sessions={item.metrics?.activeSessions} Icon={Wifi} tone="text-emerald-600 dark:text-emerald-300"/>
 <ConnectionChart title="حسابات الهوتسبوت" connected={item.metrics?.connectedHotspotAccounts} total={item.metrics?.totalHotspotAccounts} sessions={item.metrics?.hotspotSessions} Icon={Wifi} tone="text-violet-600 dark:text-violet-300"/>
 <ConnectionChart title="NAS عبر OpenVPN" connected={item.ovpn&&hasTunnelReading(item.ovpn.state)?item.ovpn.connected:undefined} total={item.ovpn?.total} Icon={Router} tone="text-sky-600 dark:text-sky-300"/>
 </div>
 <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-white/[.03]"><p className="flex items-center gap-1.5"><Users className="h-4 w-4 text-blue-500"/>ملفات مشتركي PPPoE · {item.metrics?.totalSubscribers??"—"}</p><p>الجدد خلال 24 ساعة · {item.metrics?.newSubscribers24h??"—"}</p></div>
 </section>
 </div>
 <footer className="mt-4 space-y-3 border-t border-slate-200 pt-3 dark:border-white/10">
 <details onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()} className="rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-white/10">
 <summary className="cursor-pointer text-slate-600 dark:text-slate-300"><Database className="mx-1 inline h-4 w-4 text-violet-500"/>التفاصيل التقنية</summary>
 <dl className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2"><div><dt className="text-slate-500 dark:text-slate-400">قاعدة البيانات</dt><dd className="mt-1 break-all"><bdi>{item.databaseName||"لم تُجهّز"}</bdi></dd></div><div><dt className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><Server className="h-3.5 w-3.5 text-sky-500"/>الخادم</dt><dd className="mt-1 break-words">{item.databaseServerName||"غير محدد"}</dd></div></dl>
 </details>
 <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]"><p className="flex items-start gap-1.5 text-slate-500 dark:text-slate-400"><CalendarClock className="h-3.5 w-3.5 shrink-0"/><span>آخر قراءة · {date(item.metricsReadAt)}</span></p><p className={item.metricsStatus==="unavailable"||item.metricsStale?"text-amber-700 dark:text-amber-300":"text-slate-500 dark:text-slate-400"}>{readingLabel(item)}</p></div>
 </footer>
 </CollectionCard>})}</CollectionGrid>}
 <div className="flex items-center justify-between"><ProjectButton variant="secondary" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>السابق</ProjectButton><span className="text-xs">{currentPage} / {pageCount}</span><ProjectButton variant="secondary" disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>التالي</ProjectButton></div>
 </>}
 {networkId&&loading&&<CollectionState loading>جارٍ تحميل ملف الشبكة…</CollectionState>}
 {networkId&&!loading&&!selected&&<CollectionState>{error?<><p role="alert">{error}</p><ProjectButton onClick={()=>setRevision(value=>value+1)}>إعادة المحاولة</ProjectButton></>:"الشبكة غير موجودة أو غير متاحة."}</CollectionState>}
 {selected&&<NetworkDetails item={selected} days={reminderDays} now={now} error={error} refreshing={refreshing} onRefresh={()=>setRevision(value=>value+1)}/>}
 </div>;
}

function UsageBar({title,used,limit}:{title:string;used?:number;limit?:number}){
 const fraction=typeof used==="number"&&typeof limit==="number"&&limit>0?Math.min(100,Math.round(used/limit*100)):null;
 return <div className="space-y-2">
  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
   <h4 className="font-semibold">{title}</h4>
   <span>{used?.toLocaleString("ar")??"القراءة غير متاحة"}{limit===0?" · غير محدود":typeof limit==="number"?" / "+limit.toLocaleString("ar"):" · الحد غير متاح"}</span>
  </div>
  {fraction!==null&&<div role="progressbar" aria-label={title} aria-valuenow={fraction} aria-valuetext={used+" من "+limit} className="h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-white/10"><div className={`h-full rounded-full ${fraction>=100?"bg-amber-500":"bg-blue-600"}`} style={{width:fraction+"%"}}/></div>}
 </div>;
}

function observedDuration(seconds:number){
 const minutes=Math.floor(Math.max(0,seconds)/60);
 return minutes<1?"أقل من دقيقة":minutes<60?minutes+" دقيقة":Math.floor(minutes/60)+" ساعة"+(minutes%60?" و "+minutes%60+" دقيقة":"");
}

const observedLabels={connected:"متصل",disconnected:"منقطع",unknown:"تعذّر التحقق"};
function TunnelTimeline({tunnel,events,now}:{tunnel:Tunnel;events:ConnectionEvent[];now:number}){
 const start=now-86400000;
 const ordered=events.filter(event=>event.tunnelId===tunnel.tunnelId&&Date.parse(event.at)<=now).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 const marks:Array<{at:number;state:ConnectionEvent["state"]}>=[{at:start,state:"unknown"}];
 for(const event of ordered){
  const at=Date.parse(event.at);
  if(at<=start)marks[0]={at:start,state:event.state};
  else marks.push({at,state:event.state});
 }
 // A successful observation is evidence only until the monitoring freshness limit.
 const readAt=Date.parse(tunnel.readAt??"");
 if(Number.isFinite(readAt)&&readAt+180000<now){
  marks.push({at:Math.max(start,readAt+180000),state:"unknown"});
  marks.sort((a,b)=>a.at-b.at);
 }
 const segments=marks.map((mark,index)=>({...mark,end:marks[index+1]?.at??now})).filter(mark=>mark.end>mark.at);
 return <div className="space-y-1.5">
  <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" dir="ltr" aria-label={"سجل اتصال "+tunnel.name+" خلال 24 ساعة"}>
   {segments.map((segment,index)=><span key={index} className="block h-full min-w-0 shrink-0 [&>span]:h-full [&>span]:w-full" style={{width:((segment.end-segment.at)/86400000*100)+"%"}}>
    <ProjectTooltip label={observedLabels[segment.state]+" · "+date(new Date(segment.at).toISOString())+" — "+date(new Date(segment.end).toISOString())}>
     <span className={"block h-full w-full "+(segment.state==="connected"?"bg-emerald-500":segment.state==="disconnected"?"bg-rose-500":"bg-slate-300 dark:bg-slate-600")}/>
    </ProjectTooltip>
   </span>)}

  </div>
  <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400"><span>منذ 24 ساعة</span><span>الآن</span></div>
 </div>;
}

function NetworkDetails({item,days,now,error,refreshing,onRefresh}:{item:NetworkRow;days:number;now:number;error:string;refreshing:boolean;onRefresh:()=>void}){
 const [notice,setNotice]=useState({message:"",error:"",warning:""});
 const [checking,setChecking]=useState(false);
 const [checkSummary,setCheckSummary]=useState("");
 const [checkWaitUntil,setCheckWaitUntil]=useState(0);
 const [checkClock,setCheckClock]=useState(()=>Date.now());
 useEffect(()=>{
  if(!checkWaitUntil)return;
  const timer=setInterval(()=>{const current=Date.now();setCheckClock(current);if(current>=checkWaitUntil)clearInterval(timer);},1000);
  return ()=>clearInterval(timer);
 },[checkWaitUntil]);
 const checkWait=Math.max(0,Math.ceil((checkWaitUntil-checkClock)/1000));
 const [recoveryOpen,setRecoveryOpen]=useState(false);
 const [historyNas,setHistoryNas]=useState("all");
 const [historyLimit,setHistoryLimit]=useState(20);
 const expiry=expiryState(item,days,now);
 const ovpn=item.ovpn;
 const tunnelStatus=ovpn?.state??"pending";
 const tunnelDisplay=tunnelLabels[tunnelStatus];
 const connectionPercent=ovpn&&ovpn.total>0&&hasTunnelReading(tunnelStatus)?Math.round(100*ovpn.connected/ovpn.total):null;
 const connectionInk=tunnelStatus==="connected"?"text-emerald-600 dark:text-emerald-300":tunnelStatus==="disconnected"?"text-rose-600 dark:text-rose-300":tunnelDisplay.tone==="warning"?"text-amber-700 dark:text-amber-300":"text-sky-600 dark:text-sky-300";
 const ConnectionIcon=tunnelStatus==="connected"?CheckCircle2:tunnelStatus==="disconnected"?WifiOff:tunnelDisplay.tone==="warning"?AlertTriangle:Router;
 const tunnels=[...(ovpn?.tunnels??[])].sort((left,right)=>Number(left.state==="connected")-Number(right.state==="connected"));
 const history=ovpn?.history??[];
 const filteredHistory=history.filter(event=>historyNas==="all"||String(event.tunnelId)===historyNas);
 const affectedGateways=Array.from(new Set(tunnels.filter(tunnel=>tunnel.state==="disconnected").map(tunnel=>tunnel.gateway)));

 const environment=item.status!=="active"?"موقوفة":label(item.environmentStatus);
 const readAt=Date.parse(item.metricsReadAt??"");
 const elapsed=Number.isFinite(readAt)?Math.max(0,Math.floor((now-readAt)/60000)):null;
 const reading=elapsed===null?readingLabel(item):`${readingLabel(item)} · آخر قراءة منذ ${elapsed.toLocaleString("ar")} دقيقة`;
 const stale=item.metricsStale||item.metricsStatus==="unavailable";
 const metrics=item.metrics;
 const limit=item.planLimits;
 const alerts=[
  ...(expiry==="expired"||expiry==="soon"?[{text:expiry==="expired"?"انتهى اشتراك الشبكة":"اقترب موعد انتهاء الاشتراك",href:"#network-subscription"}]:[]),
  ...(!stale&&limit&&limit.nas>0&&metrics&&metrics.totalNas>=limit.nas?[{text:"بلغت الشبكة حد أجهزة NAS",href:"#network-subscription"}]:[]),
  ...(!stale&&limit&&limit.pppoe>0&&typeof metrics?.totalPppoeAccounts==="number"&&metrics.totalPppoeAccounts>=limit.pppoe?[{text:"بلغت الشبكة حد حسابات PPPoE",href:"#network-subscription"}]:[]),
  ...(item.metricsReadAt&&stale||item.metricsStatus==="unavailable"?[{text:"تأخرت مؤشرات التشغيل أو تعذرت قراءتها",href:"#network-overview"}]:[]),
 ];
 let portal:string|undefined;
 try{const url=new URL(item.systemUrl??"");if(item.environmentStatus==="ready"&&["https:","http:"].includes(url.protocol)&&!url.username&&!url.password)portal=url.href;}catch{/* Missing or invalid environment URL. */}
 const healthSummary=[
  ["قاعدة البيانات",label(item.databaseStatus)],["FreeRADIUS",label(item.radiusStatus)],["خادم البيانات",item.databaseServerName||"غير محدد"],
  ["اسم القاعدة",item.databaseName||"غير متاح"],["آخر تقرير",date(item.reportedAt)],["آخر ظهور",date(item.lastSeenAt)],
 ];
 async function checkConnection(){
  if(checking||checkWait)return;
  setChecking(true);setCheckSummary("");setNotice({message:"",error:"",warning:""});
  try{
   const response=await fetch("/api/billing/admin/networks/"+encodeURIComponent(item.slug)+"/connection-check",{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},body:"{}"});
   const payload=await response.json();
   const wait=Number(payload.retryAfter);
   if(Number.isFinite(wait)&&wait>0){setCheckWaitUntil(Date.now()+wait*1000);setCheckClock(Date.now());}
   if(!response.ok){
    if(response.status===429){setNotice({message:"",error:"",warning:payload.message});return;}
    throw Error(payload.message||"تعذر فحص الاتصال.");
   }
   const unavailable=payload.results?.filter((result:{status:string})=>result.status==="unavailable").length??0;
   const message="اكتمل فحص الاتصال · "+date(payload.completedAt);
   const checked=payload.results?.filter((result:{cached:boolean})=>!result.cached).length??0;
   setCheckSummary(message+" · فُحص "+checked+" خوادم"+(unavailable?" · تعذّر فحص "+unavailable:""));
   setNotice(unavailable?{message:"",error:"",warning:"تعذّر فحص "+unavailable+" من خوادم CHR. راجع حالة الاتصال المحدّثة."}:{message,error:"",warning:""});
  }catch(error){setNotice({message:"",warning:"",error:error instanceof Error?error.message:"تعذر فحص الاتصال."});}
  finally{setChecking(false);onRefresh();}
 }
 async function copy(value:string,message:string){
  try{
   if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
   else{
    const field=document.createElement("textarea");field.value=value;field.readOnly=true;field.style.position="fixed";field.style.opacity="0";
    const focused=document.activeElement;
    document.body.appendChild(field);field.select();
    try{if(!document.execCommand("copy"))throw Error("COPY_FAILED");}finally{field.remove();if(focused instanceof HTMLElement)focused.focus();}
   }
   setNotice({message,error:"",warning:""});
  }catch{setNotice({message:"",error:"تعذر النسخ في هذا المتصفح.",warning:""});}
 }
 const summary=[`الشبكة: ${item.name}`,`الرخصة: ${item.licenseNumber||"غير متاحة"}`,`الاشتراك: ${subscriptionLabels[expiry]}`,`البيئة: ${environment}`,`OpenVPN: ${tunnelDisplay.label}`,`قاعدة البيانات: ${label(item.databaseStatus)}`,`FreeRADIUS: ${label(item.radiusStatus)}`,`آخر قراءة: ${date(item.metricsReadAt)} · ${readingLabel(item)}`].join("\n");
 return <section aria-label="ملف الشبكة" className="space-y-4">
  <FloatingNotice {...notice} onDismiss={()=>setNotice({message:"",error:"",warning:""})}/>
  {recoveryOpen&&<NetworkAccessRecovery slug={item.slug} networkName={item.name} copy={copy} onClose={()=>setRecoveryOpen(false)}/>}
  <ProjectInfoCard tone="info" className="flex flex-wrap items-start justify-between gap-4">
   <div className="min-w-0 space-y-2">
    <div className="flex flex-wrap items-center gap-2"><ProjectCardIcon icon={Network}/><h1 className="break-words text-xl font-bold">{item.name}</h1></div>
    <div className="flex flex-wrap items-center gap-3 text-sm"><span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold ${connectionInk}`}><Hash className="size-4"/>{item.id}</span><span className="flex items-center gap-1.5"><UserRound className="size-4 text-violet-500"/>{item.ownerName||"المالك غير محدد"}</span></div>
    {item.licenseNumber&&<div className="flex flex-wrap items-center gap-2 text-xs">الرخصة <bdi className="break-all font-mono">{item.licenseNumber}</bdi><ProjectButton variant="ghost" aria-label="نسخ الرخصة" onClick={()=>void copy(item.licenseNumber,"تم نسخ رقم الرخصة.")}><Copy className="size-4"/></ProjectButton></div>}
   </div>
   <div className="flex flex-wrap items-center gap-2">
    {portal&&<ProjectButton onClick={()=>window.open(portal,"_blank","noopener,noreferrer")}><ExternalLink className="size-4"/>فتح واجهة الشبكة</ProjectButton>}
    {item.environmentStatus==="ready"&&<ProjectButton variant="secondary" onClick={()=>setRecoveryOpen(true)}><KeyRound className="size-4 text-violet-600 dark:text-violet-300"/>استعادة وصول مدير الشبكة</ProjectButton>}
    <ProjectButton variant="secondary" onClick={()=>void copy(summary,"تم نسخ ملخص الشبكة.")}><Copy className="size-4"/>نسخ ملخص الشبكة</ProjectButton>
    <ProjectButton variant="ghost" disabled={refreshing} onClick={onRefresh}><RefreshCw className={`size-4 ${refreshing?"animate-spin":""}`}/>تحديث</ProjectButton>
   </div>
  </ProjectInfoCard>
  <nav aria-label="أقسام ملف الشبكة" className="flex flex-wrap gap-2">
   {[{href:"#network-connection",label:"الاتصال",Icon:Router},{href:"#network-overview",label:"الحسابات",Icon:Users},{href:"#network-subscription",label:"الاشتراك",Icon:Package},{href:"#network-ovpn",label:"أجهزة NAS",Icon:Server},{href:"#network-history",label:"سجل الاتصال",Icon:History}].map(({href,label,Icon})=><a key={href} href={href} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-white/10 dark:bg-white/[.03] dark:hover:text-blue-300"><Icon className="size-4 text-blue-500"/>{label}</a>)}
  </nav>
  <div id="network-connection" aria-label="حالة الشبكة" className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(230px,1fr)]">
   <ProjectInfoCard tone={tunnelDisplay.tone} className="flex min-w-0 flex-wrap items-center gap-4 sm:flex-nowrap sm:gap-5">
    <ConnectionRing label="نسبة أجهزة NAS المتصلة" percent={connectionPercent} tone={connectionInk} className="sm:size-24"/>
    <div className="min-w-0 flex-1 space-y-2">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-xs"><ConnectionIcon className={`size-4 shrink-0 ${connectionInk}`}/>اتصال الشبكة عبر OpenVPN</p>
      {item.environmentStatus==="ready"&&(ovpn?.total??0)>0&&<ProjectButton variant="secondary" disabled={checking||checkWait>0} onClick={()=>void checkConnection()}><RefreshCw className={checking?"animate-spin":""}/>{checking?"جارٍ الفحص…":checkWait>0?"إعادة الفحص بعد "+checkWait+" ث":"فحص الاتصال الآن"}</ProjectButton>}
     </div>
     <h2 className={`text-lg font-bold ${connectionInk}`}>{tunnelDisplay.label}</h2>
     {checkSummary&&<p role="status" className="text-xs">{checkSummary}</p>}
     {connectionPercent!==null&&ovpn&&<p className="text-sm"><bdi className="font-semibold">{ovpn.connected} / {ovpn.total}</bdi> أجهزة NAS متصلة</p>}
     {ovpn&&hasTunnelReading(tunnelStatus)&&<div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">متصل {ovpn.connected}</span><span className="rounded-full bg-rose-500/10 px-2 py-1 text-rose-700 dark:text-rose-300">منقطع {ovpn.disconnected}</span></div>}
     {tunnelStatus==="partial"&&affectedGateways.length>0&&<p className="break-words text-xs">أجهزة متأثرة على خوادم الاتصال · {affectedGateways.join("، ")}</p>}
     {ovpn?.readAt&&<p className="text-xs">آخر فحص ناجح · {date(ovpn.readAt)}</p>}
     {tunnels.length>0&&<a href="#network-ovpn" className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-4"><Router className="size-3.5"/>عرض تفاصيل أجهزة NAS</a>}
    </div>
   </ProjectInfoCard>
   <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1">
    <ProjectInfoCard tone={expiry==="current"?"success":expiry==="expired"?"danger":expiry==="soon"?"warning":"pending"} className="flex items-center gap-3"><ProjectCardIcon icon={CalendarClock} tone={expiry==="current"?"success":"warning"}/><div><p className="text-xs">الاشتراك</p><p className="font-semibold">{subscriptionLabels[expiry]}</p></div></ProjectInfoCard>
    <ProjectInfoCard tone={item.status!=="active"?"warning":item.environmentStatus==="ready"?"success":"pending"} className="flex items-center gap-3"><ProjectCardIcon icon={Server} tone="connections"/><div><p className="text-xs">البيئة</p><p className="font-semibold">{environment}</p></div></ProjectInfoCard>
   </div>
  </div>
  {error&&<ProjectInfoCard tone="warning"><p role="alert">{error} · تُعرض آخر بيانات متاحة.</p></ProjectInfoCard>}
  {alerts.length>0&&<ProjectInfoCard tone="warning">
   <h2 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={AlertTriangle} tone="warning"/>تنبيهات تحتاج متابعة</h2>
   <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">{alerts.map(alert=><li key={alert.text}><a className="underline underline-offset-4" href={alert.href}>{alert.text}</a></li>)}</ul>
  </ProjectInfoCard>}
  <section id="network-overview" className="scroll-mt-4">
   <ProjectInfoCard className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={Activity} tone="info"/>الحسابات والجلسات</h2><span className={`text-xs ${stale?"text-amber-700 dark:text-amber-300":"text-slate-500 dark:text-slate-400"}`}>{reading}</span></div>
    <div className="grid gap-3 sm:grid-cols-2">
     <ConnectionChart title="حسابات PPPoE" connected={metrics?.connectedPppoeAccounts} total={metrics?.totalPppoeAccounts} sessions={metrics?.activeSessions} Icon={Radio} tone="text-emerald-600 dark:text-emerald-300"/>
     <ConnectionChart title="حسابات الهوتسبوت" connected={metrics?.connectedHotspotAccounts} total={metrics?.totalHotspotAccounts} sessions={metrics?.hotspotSessions} Icon={Wifi} tone="text-violet-600 dark:text-violet-300"/>
    </div>
    {metrics&&<dl className="grid gap-3 sm:grid-cols-3">{[
     {title:"ملفات مشتركي PPPoE",value:metrics.totalSubscribers,Icon:Users,tone:"info"},
     {title:"المشتركون المتصلون",value:metrics.connectedSubscribers,Icon:Wifi,tone:"success"},
     {title:"مشتركون جدد خلال 24 ساعة",value:metrics.newSubscribers24h,Icon:Activity,tone:"connections"},
    ].map(({title,value,Icon,tone})=><div key={title} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 p-2 dark:border-white/10"><ProjectCardIcon icon={Icon} tone={tone as InfoCardTone}/><div><dt className="text-xs">{title}</dt><dd className="font-semibold tabular-nums">{value?.toLocaleString("ar")??"—"}</dd></div></div>)}</dl>}
   </ProjectInfoCard>
  </section>
  <div className="grid items-start gap-4 lg:grid-cols-2">
   <section id="network-subscription" className="scroll-mt-4"><ProjectInfoCard className="space-y-4">
    <h2 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={Package}/>الاشتراك وحدود الخطة</h2>
    <SubscriptionDates item={item} days={days} now={now}/>
    <UsageBar title="حسابات PPPoE" used={metrics?.totalPppoeAccounts} limit={limit?.pppoe}/>
    <UsageBar title="أجهزة NAS" used={metrics?.totalNas} limit={limit?.nas}/>
   </ProjectInfoCard></section>
   <section><ProjectInfoCard tone="connections" className="space-y-4">
    <h2 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={ShieldCheck}/>صحة البيئة</h2><p className="text-xs text-slate-500 dark:text-slate-400">آخر تقرير · {date(item.reportedAt)}</p>
    <div className="grid gap-2 sm:grid-cols-2">{[{name:"قاعدة البيانات",value:item.databaseStatus,icon:Database},{name:"FreeRADIUS",value:item.radiusStatus,icon:Radio}].map(service=>{const tone=service.value==="healthy"?"success":!service.value||service.value==="unknown"?"pending":"warning";return <ProjectInfoCard key={service.name} tone={tone} className="flex flex-wrap items-center justify-between gap-2 !p-3 text-sm"><span className="flex items-center gap-2"><ProjectCardIcon icon={service.icon} tone={tone}/>{service.name}</span><span className="font-semibold">{label(service.value)}</span></ProjectInfoCard>;})}</div>
    <dl className="grid grid-cols-2 gap-3">{healthSummary.slice(2).map(([name,value])=><div key={name} className="min-w-0"><dt className="text-xs text-slate-500 dark:text-slate-400">{name}</dt><dd className="mt-1 break-words text-sm"><bdi>{value}</bdi></dd></div>)}</dl>
   </ProjectInfoCard></section>
  </div>
  <section id="network-ovpn" className="scroll-mt-4">
   <ProjectInfoCard className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={Router}/>تشخيص اتصال أجهزة NAS</h2><span className="text-xs text-slate-500 dark:text-slate-400">سجل مرئي لآخر 24 ساعة</span></div>
    <div className="flex flex-wrap gap-3 text-[11px]"><span className="text-emerald-700 dark:text-emerald-300">● متصل</span><span className="text-rose-700 dark:text-rose-300">● منقطع</span><span className="text-slate-500 dark:text-slate-400">● غير مؤكد أو لم يُرصد</span></div>
    {!tunnels.length?<p className="text-sm">{ovpn?.state==="unlinked"?"لا توجد أجهزة NAS مرتبطة عبر OpenVPN.":"بانتظار بيانات أجهزة NAS."}</p>:
     <ul className="grid gap-3 sm:grid-cols-2">{tunnels.map(tunnel=><li key={tunnel.nasId+":"+tunnel.gatewayId}>
      <ProjectInfoCard tone={tunnelLabels[tunnel.state].tone} className="min-w-0 space-y-3">
       <div className="flex flex-wrap items-center justify-between gap-2"><strong className="break-words">{tunnel.name}</strong><span className="text-xs">{tunnel.state==="disconnected"?"غير متصل":tunnelLabels[tunnel.state].label}</span></div>
       <p className="flex items-center gap-2 text-xs"><Server className="size-4"/>خادم الاتصال · {tunnel.gateway}</p>
       <p className="flex items-center gap-2 text-xs"><Clock3 className="size-4"/>آخر ظهور متصل · {date(tunnel.lastSeenAt)}</p>
       <dl className="grid gap-2 border-t border-slate-200/70 pt-2 text-xs dark:border-white/10">
        {hasTunnelReading(tunnel.state)&&tunnel.since&&<div className="flex flex-wrap justify-between gap-2"><dt>الحالة مرصودة منذ</dt><dd>{date(tunnel.since)}</dd></div>}
        <div className="flex flex-wrap justify-between gap-2"><dt>آخر فحص ناجح</dt><dd>{date(tunnel.readAt)}</dd></div>
       </dl>
       <TunnelTimeline tunnel={tunnel} events={history} now={now}/>
      </ProjectInfoCard>
     </li>)}</ul>}
   </ProjectInfoCard>
  </section>
  <section id="network-history" className="scroll-mt-4">
   <ProjectInfoCard className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div><h2 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={History} tone="connections"/>سجل انقطاع الاتصال وعودته</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">توقيت اكتشاف الحالة حسب الفحص الدوري. المدد تقريبية، ويبدأ السجل من تفعيل المراقبة.</p></div>
     <ProjectDropdown compact value={historyNas} onChange={value=>{setHistoryNas(value);setHistoryLimit(20);}} options={[{value:"all",label:"كل أجهزة NAS"},...tunnels.map(tunnel=>({value:String(tunnel.tunnelId),label:tunnel.name,icon:Router}))]}/>
    </div>
    <div className="flex flex-wrap gap-3 text-[11px]"><span className="text-emerald-700 dark:text-emerald-300">● متصل</span><span className="text-rose-700 dark:text-rose-300">● منقطع</span><span className="text-slate-500 dark:text-slate-400">● غير مؤكد أو لم يُرصد</span></div>
    {!filteredHistory.length?<p className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-white/[.03]">بانتظار أول رصد لحالة الاتصال.</p>:
     <ol className="divide-y divide-slate-200 dark:divide-white/10">{filteredHistory.slice(0,historyLimit).map(event=>{
      const tunnel=tunnels.find(tunnel=>tunnel.tunnelId===event.tunnelId);
      const connected=event.state==="connected",unknown=event.state==="unknown";
      const Icon=unknown?AlertTriangle:connected?CheckCircle2:WifiOff;
      const title=unknown?"تعذّر التحقق من الاتصال":event.baseline?(connected?"رُصد اتصال الجهاز":"رُصد الجهاز غير متصل"):connected?"عودة الاتصال":"اكتشاف انقطاع";
      return <li key={event.at+":"+event.tunnelId+":"+event.state} className="grid min-w-0 items-start gap-3 py-3 sm:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(180px,1fr)]">
       <div className="flex min-w-0 items-start gap-2"><Icon className={`mt-0.5 size-4 shrink-0 ${unknown?"text-amber-600":connected?"text-emerald-600":"text-rose-600"}`}/><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{date(event.at)}</p></div></div>
       <div className="min-w-0 text-xs"><p className="break-words font-semibold">{tunnel?.name||"NAS #"+event.nasId}</p><p className="mt-1 break-words text-slate-500 dark:text-slate-400">{tunnel?.gateway||"CHR #"+event.gatewayId}</p></div>
       <p className="text-xs">{event.durationSeconds!==null?(event.previousState==="disconnected"?"مدة الانقطاع المرصود · ":"مدة الاتصال المرصود · ")+observedDuration(event.durationSeconds):unknown?"تحتاج الحالة إلى فحص ناجح جديد":"بدء رصد الحالة"}</p>
      </li>;
     })}</ol>}
    {filteredHistory.length>historyLimit&&<ProjectButton variant="secondary" onClick={()=>setHistoryLimit(value=>value+20)}>عرض أحداث أقدم</ProjectButton>}
    {history.length>=200&&<p className="text-xs text-slate-500 dark:text-slate-400">تُعرض أحدث 200 واقعة للشبكة.</p>}
   </ProjectInfoCard>
  </section>
 </section>;
}
