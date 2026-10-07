"use client";
import { useEffect, useRef, useState } from "react";
import { Activity, Clock, ShieldCheck, Server, Cpu, HardDrive, MemoryStick, RefreshCw, Thermometer } from "lucide-react";
import ProjectResourceMetric from "@/components/ui/project-resource-metric";
import Button from "@/components/ui/project-button";
import ProjectTooltip from "@/components/ui/project-tooltip";

type Health={resource:Record<string,string>;temperatures:Array<{name:string;value:string}>;checked_at:string};
function bytes(value?:string){if(!value)return null;const n=Number(value);if(!Number.isFinite(n)||n<0)return null;return n;}
function size(value:number|null){if(value===null)return "غير متاح";return value>=1073741824?`${(value/1073741824).toFixed(2)} GiB`:`${(value/1048576).toFixed(1)} MiB`;}
export default function OvpnHealthCard({gatewayId,gatewayName}:{gatewayId:number;gatewayName?:string}){
 const [data,setData]=useState<Health|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const refreshRef=useRef<()=>void>(()=>{});
 useEffect(()=>{
  let disposed=false,pending=false;const controller=new AbortController();setData(null);setError("");
  async function refresh(){if(pending||disposed)return;pending=true;setBusy(true);try{const r=await fetch(`/api/admin/platform-settings/ovpn-gateways/${gatewayId}/health`,{credentials:"include",cache:"no-store",signal:controller.signal});const j=await r.json();if(!r.ok)throw new Error(j.message||"تعذر الاتصال بالخادم.");if(!disposed){setData(j);setError("");}}catch(e){if(!disposed)setError(e instanceof Error?e.message:"تعذر تحديث القراءة.");}finally{pending=false;if(!disposed)setBusy(false);}}
  refreshRef.current=()=>void refresh();void refresh();
  const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void refresh();},30000);
  const visible=()=>{if(document.visibilityState==="visible")void refresh();};document.addEventListener("visibilitychange",visible);
  return()=>{disposed=true;controller.abort();window.clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
 },[gatewayId]);
 const r=data?.resource??{},ram=bytes(r['total-memory']),freeRam=bytes(r['free-memory']),disk=bytes(r['total-hdd-space']),freeDisk=bytes(r['free-hdd-space']);
 const used=(total:number|null,free:number|null)=>total!==null&&free!==null?Math.max(0,total-free):null;
 const cpu=r['cpu-load']!==undefined&&Number.isFinite(Number(r['cpu-load']))?Math.min(100,Math.max(0,Number(r['cpu-load']))):null;
 const metrics=[{name:"CPU",tone:"blue" as const,icon:Cpu,value:cpu===null?"غير متاح":`${cpu}%`,detail:`${r.cpu||""}${r['cpu-count']?` · ${r['cpu-count']} أنوية`:""}`,percent:cpu},
 {name:"RAM",tone:"violet" as const,icon:MemoryStick,value:size(used(ram,freeRam)),detail:`متاح ${size(freeRam)} · إجمالي ${size(ram)}`,percent:ram&&freeRam!==null?100*(ram-freeRam)/ram:null},
 {name:"التخزين",tone:"cyan" as const,icon:HardDrive,value:size(used(disk,freeDisk)),detail:`متاح ${size(freeDisk)} · إجمالي ${size(disk)}`,percent:disk&&freeDisk!==null?100*(disk-freeDisk)/disk:null},
 {name:"الحرارة",tone:"amber" as const,icon:Thermometer,value:data?.temperatures.length?data.temperatures.map(t=>`${t.value}°C`).join(" · "):"غير متاحة",detail:data?.temperatures.map(t=>t.name).join(" · ")||"لم يرسل الخادم بيانات حرارة",percent:null}];
 return <section className="rl-surface ui-state-enter rounded-[22px] bg-white p-3 sm:p-4 dark:bg-[#0d243b]" dir="rtl" aria-label="صحة الخادم">
 <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><span className="grid h-10 w-10 place-items-center rounded-[13px] bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"><Activity className={`h-5 w-5 ${busy?"motion-safe:animate-pulse":""}`}/></span>صحة الخادم{gatewayName&&<span className="text-sm text-slate-500 dark:text-slate-400">· {gatewayName}</span>}</h2><ProjectTooltip label="تحديث قراءات الخادم"><Button variant="secondary" disabled={busy} onClick={()=>refreshRef.current()}><RefreshCw className={busy?"motion-safe:animate-spin text-blue-500":"text-blue-500"}/>{busy?"جارٍ التحديث...":"تحديث"}</Button></ProjectTooltip></div>
 <p role="status" className={`mt-2 text-xs ${error?"text-amber-700 dark:text-amber-300":"text-slate-500 dark:text-slate-400"}`}>{error?`تعذر تحديث اتصال API. ${data?"القيم المعروضة هي آخر قراءة ناجحة وغير محدثة.":"لم تتوفر قراءة بعد."}`:data?"اتصال API متاح · تحديث كل 30 ثانية أثناء عرض الصفحة":"جارٍ قراءة موارد الخادم..."}</p>
 {error&&<p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
 <div className={`mt-3 grid gap-3 ${data?.temperatures.length?"sm:grid-cols-2 xl:grid-cols-4":"md:grid-cols-3"}`}>{metrics.filter(metric=>metric.name!=="الحرارة"||Boolean(data?.temperatures.length)).map(metric=><ProjectResourceMetric key={metric.name} {...metric} refreshing={busy} stale={Boolean(error)}/>)}</div>
 <div className="mt-3 grid gap-3 rounded-[18px] bg-[#f4f8fd] p-3 text-xs dark:bg-white/[.03] sm:grid-cols-2 xl:grid-cols-4">
 {[{label:"مدة التشغيل",value:r.uptime||"غير متاحة",icon:Clock,color:"text-emerald-500"},{label:"RouterOS",value:r.version||"غير متاح",icon:ShieldCheck,color:"text-violet-500"},{label:"الجهاز",value:r['board-name']||"غير متاح",icon:Server,color:"text-cyan-500"},{label:"آخر قراءة",value:data?new Date(data.checked_at).toLocaleString("ar"):"—",icon:RefreshCw,color:"text-blue-500"}].map(({label,value,icon:Icon,color})=><div key={label} className="flex min-w-0 items-start gap-2"><Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${color}`}/><div className="min-w-0"><p className="text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 break-words font-medium text-slate-700 dark:text-slate-200"><bdi>{value}</bdi></p></div></div>)}
 </div>
 <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">الحالة تخص اتصال API وموارد الخادم.</p>
 </section>;
}
