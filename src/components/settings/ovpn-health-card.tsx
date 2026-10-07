"use client";
import { useEffect, useRef, useState } from "react";
import { Activity, Cpu, HardDrive, MemoryStick, RefreshCw, Thermometer } from "lucide-react";
import Button from "@/components/ui/project-button";
import ProjectTooltip from "@/components/ui/project-tooltip";

type Health={resource:Record<string,string>;temperatures:Array<{name:string;value:string}>;checked_at:string};
function bytes(value?:string){if(!value)return null;const n=Number(value);if(!Number.isFinite(n)||n<0)return null;return n;}
function size(value:number|null){if(value===null)return "غير متاح";return value>=1073741824?`${(value/1073741824).toFixed(2)} GiB`:`${(value/1048576).toFixed(1)} MiB`;}
export default function OvpnHealthCard({gatewayId}:{gatewayId:number}){
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
 const metrics=[{name:"CPU",icon:Cpu,value:cpu===null?"غير متاح":`${cpu}%`,detail:`${r.cpu||""}${r['cpu-count']?` · ${r['cpu-count']} أنوية`:""}`,percent:cpu},
 {name:"RAM",icon:MemoryStick,value:size(used(ram,freeRam)),detail:`متاح ${size(freeRam)} · إجمالي ${size(ram)}`,percent:ram&&freeRam!==null?100*(ram-freeRam)/ram:null},
 {name:"التخزين",icon:HardDrive,value:size(used(disk,freeDisk)),detail:`متاح ${size(freeDisk)} · إجمالي ${size(disk)}`,percent:disk&&freeDisk!==null?100*(disk-freeDisk)/disk:null},
 {name:"الحرارة",icon:Thermometer,value:data?.temperatures.length?data.temperatures.map(t=>`${t.value}°C`).join(" · "):"غير متاحة",detail:data?.temperatures.map(t=>t.name).join(" · ")||"لم يرسل الخادم بيانات حرارة",percent:null}];
 return <section className="rl-surface ui-state-enter rounded-[22px] bg-white p-4 sm:p-5 dark:bg-[#0d243b]" dir="rtl" aria-label="صحة الخادم">
 <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><Activity className="h-5 w-5 text-emerald-500"/>صحة الخادم</h2><ProjectTooltip label="تحديث قراءات الخادم"><Button variant="secondary" disabled={busy} onClick={()=>refreshRef.current()}><RefreshCw className={busy?"motion-safe:animate-spin":""}/>{busy?"جارٍ التحديث...":"تحديث"}</Button></ProjectTooltip></div>
 <p role="status" className={`mt-3 text-xs ${error?"text-amber-700 dark:text-amber-300":"text-slate-500 dark:text-slate-400"}`}>{error?`تعذر تحديث اتصال API. ${data?"القيم المعروضة هي آخر قراءة ناجحة وغير محدثة.":"لم تتوفر قراءة بعد."}`:data?"اتصال API متاح · تحديث كل 30 ثانية أثناء عرض الصفحة":"جارٍ قراءة موارد الخادم..."}</p>
 {error&&<p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
 <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({name,icon:Icon,value,detail,percent})=><div key={name} className="rl-surface-soft min-w-0 rounded-[18px] bg-[#f9fbfe] p-4 dark:bg-white/[.03]"><div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><Icon className="h-4 w-4 text-blue-500"/>{name}</div><p className="mt-2 break-words text-lg font-semibold" dir="ltr">{value}</p>{percent!==null&&<div role="progressbar" aria-label={`استخدام ${name}`} aria-valuenow={Math.round(Math.max(0,Math.min(100,percent)))} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className="h-full rounded-full bg-blue-500 transition-[width] duration-500 motion-reduce:transition-none" style={{width:`${Math.max(0,Math.min(100,percent))}%`}}/></div>}<p className="mt-2 break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p></div>)}</div>
 <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400"><span>مدة التشغيل: <bdi>{r.uptime||"غير متاحة"}</bdi></span><span>RouterOS: <bdi>{r.version||"غير متاح"}</bdi></span><span>الجهاز: <bdi>{r['board-name']||"غير متاح"}</bdi></span><span>آخر قراءة: {data?new Date(data.checked_at).toLocaleString("ar"):"—"}</span></div>
 <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">هذه قراءات الموارد واتصال الإدارة؛ حالة أنفاق OpenVPN تُراقب بشكل مستقل.</p>
 </section>;
}
