"use client";
import {useEffect,useRef,useState} from "react";
import {Database,Server,RefreshCw} from "lucide-react";
import ProjectButton from "./project-button";
import ProjectDropdown from "./project-dropdown";
import ProjectTooltip from "./project-tooltip";

type Kind="database"|"ovpn";
type Target={id:number;name:string;host?:string;api_host?:string;display_health?:boolean};
type Health={version?:string;checkedAt?:string;checked_at?:string;maxConnections?:number;networkDatabases?:number;metrics?:Record<string,number>;resource?:Record<string,string>};
const paths={database:"database-servers",ovpn:"ovpn-gateways"};
const storageKey="radius-lord-footer";
function percentage(value:unknown){const n=Number(value);return value!==undefined&&value!==null&&Number.isFinite(n)?Math.max(0,Math.min(100,n)):null;}

export default function ServerStatusFooter(){
 const [kind,setKind]=useState<Kind>("database"),[targets,setTargets]=useState<Target[]>([]),[id,setId]=useState(""),[data,setData]=useState<Health|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const refreshRef=useRef(()=>{});
 useEffect(()=>{try{const saved=localStorage.getItem(storageKey+"-kind");if(saved==="ovpn")setKind(saved);}catch{}},[]);
 useEffect(()=>{
  let disposed=false;const controller=new AbortController();setTargets([]);setId("");setData(null);setError("");setLoading(true);
  void(async()=>{try{
   const r=await fetch(`/api/admin/platform-settings/${paths[kind]}`,{credentials:"include",cache:"no-store",signal:controller.signal}),j=await r.json();if(!r.ok)throw new Error(j.message||"تعذر تحميل الخوادم.");
   if(disposed)return;const rows:Target[]=kind==="database"?j.servers:j.gateways;setTargets(rows);
   let saved="";try{saved=localStorage.getItem(`${storageKey}-${kind}`)||"";}catch{}
   const selected=rows.find(row=>String(row.id)===saved)||rows.find(row=>row.display_health)||rows[0];setId(selected?String(selected.id):"");
  }catch(e){if(!disposed)setError(e instanceof Error?e.message:"تعذر تحميل الخوادم.");}finally{if(!disposed)setLoading(false);}})();
  return()=>{disposed=true;controller.abort();};
 },[kind]);
 useEffect(()=>{
  setData(null);if(!id)return;
  let disposed=false,pending=false;const controller=new AbortController();setError("");
  async function refresh(){if(disposed||pending)return;pending=true;setBusy(true);try{
   const r=await fetch(`/api/admin/platform-settings/${paths[kind]}/${id}/health`,{credentials:"include",cache:"no-store",signal:controller.signal}),j=await r.json();if(!r.ok)throw new Error(j.message||"تعذر قراءة حالة الخادم.");
   if(!disposed){setData(j);setError("");}
  }catch(e){if(!disposed)setError(e instanceof Error?e.message:"تعذر تحديث الحالة.");}finally{pending=false;if(!disposed)setBusy(false);}}
  refreshRef.current=()=>void refresh();void refresh();
  const timer=setInterval(()=>{if(document.visibilityState==="visible")void refresh();},30000);
  const visible=()=>{if(document.visibilityState==="visible")void refresh();};document.addEventListener("visibilitychange",visible);
  return()=>{disposed=true;controller.abort();clearInterval(timer);document.removeEventListener("visibilitychange",visible);refreshRef.current=()=>{};setBusy(false);};
 },[kind,id]);
 function switchKind(next:Kind){if(next===kind)return;setKind(next);setTargets([]);setId("");setData(null);setError("");setLoading(true);try{localStorage.setItem(storageKey+"-kind",next);}catch{}}
 function select(next:string){setId(next);setData(null);setError("");try{localStorage.setItem(`${storageKey}-${kind}`,next);}catch{}}
 const target=targets.find(row=>String(row.id)===id),resource=data?.resource||{},cpu=percentage(resource["cpu-load"]);
 const total=Number(resource["total-memory"]),free=Number(resource["free-memory"]);
 const ram=resource["free-memory"]!==undefined&&Number.isFinite(free)&&Number.isFinite(total)&&total>0?percentage(100*(total-free)/total):null;
 const checked=data?.checkedAt||data?.checked_at;
 const status=error?data?"قراءة قديمة":"تعذر الاتصال":loading||busy&&!data?"جارٍ القراءة":data?"متصل":targets.length?"بانتظار القراءة":"لا توجد خوادم";
 return <div dir="rtl" aria-label="حالة الخادم المحدد" className="flex min-h-[46px] flex-wrap items-center gap-2 rounded-[12px] border border-white/80 bg-[#f9fbfe]/95 px-3 py-1.5 text-xs text-slate-600 shadow-[0_10px_28px_rgba(60,88,116,.09)] backdrop-blur-xl dark:border-white/10 dark:bg-[#302e33]/95 dark:text-slate-300">
  <div role="group" aria-label="نوع الخادم" className="flex shrink-0 gap-1 rounded-[10px] bg-blue-100/60 p-0.5 dark:bg-white/5">{(["database","ovpn"] as const).map(value=><ProjectButton key={value} variant="ghost" aria-pressed={kind===value} onClick={()=>switchKind(value)} className={`h-8 rounded-[8px] px-2 ${kind===value?"bg-white shadow-sm dark:bg-blue-500/20":""}`}>{value==="database"?<Database/>:<Server/>}{value==="database"?"قواعد البيانات":"OVPN"}</ProjectButton>)}</div>
  <div className="min-w-[130px] max-w-[220px] flex-1">{targets.length?<ProjectDropdown compact value={id} onChange={select} options={targets.map(row=>({value:String(row.id),label:row.name}))}/>:<span>{loading?"تحميل الخوادم...":error?"تعذر تحميل الخوادم":"لا توجد خوادم محفوظة"}</span>}</div>
  {target&&<span dir="ltr" className="hidden max-w-[160px] truncate text-slate-500 2xl:block">{target.host||target.api_host}</span>}
  <div key={`${kind}-${id}`} className="ui-state-enter order-last flex w-full min-w-0 items-center gap-3 overflow-x-auto whitespace-nowrap rounded-[10px] border border-blue-200/70 bg-blue-50/70 px-3 py-1.5 text-[#17386d] dark:border-blue-300/10 dark:bg-blue-400/5 dark:text-blue-200 xl:order-none xl:w-auto">{kind==="database"?<><span className="max-w-[160px] shrink-0 truncate">MySQL <bdi>{data?.version||"—"}</bdi></span><span>الاتصالات <bdi>{data?.metrics?.Threads_connected??"—"}/{data?.maxConnections??"—"}</bdi></span></>:<><span>RouterOS <bdi>{resource.version||"—"}</bdi></span><Metric label="CPU" value={cpu}/><Metric label="RAM" value={ram}/></>}</div>
  <ProjectTooltip label={error||"تُقرأ حالة MySQL أو API للخادم المحدد؛ تُحدّث كل 30 ثانية"}><span role="status" className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 ${error?"bg-amber-100/70 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200":data?"bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300":"bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-300"}`}><span className={`h-2 w-2 rounded-full ${error?"bg-amber-500":data?"bg-emerald-500":"bg-slate-400"}`}/>{status}</span></ProjectTooltip>
  {checked&&<span className="mr-auto hidden text-slate-500 2xl:block"><bdi>{new Date(checked).toLocaleTimeString("ar")}</bdi></span>}
  <ProjectTooltip label="تحديث حالة الخادم"><ProjectButton variant="ghost" size="icon" disabled={!id||busy} aria-label="تحديث حالة الخادم" className="h-8 w-8" onClick={()=>refreshRef.current()}><RefreshCw className={busy?"motion-safe:animate-spin":""}/></ProjectButton></ProjectTooltip>
 </div>;
}
function Metric({label,value}:{label:string;value:number|null}){return <span className="flex items-center gap-1.5"><span>{label}</span>{value!==null&&<span className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><span className="block h-full rounded-full bg-[#1479ff]" style={{width:`${value}%`}}/></span>}<bdi>{value===null?"—":`${Math.round(value)}%`}</bdi></span>;}
