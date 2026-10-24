"use client";
import {useEffect,useState} from 'react';
import {Activity,ArrowLeft,ArrowRight,Clock3,Cpu,HardDrive,Layers,Server,ShieldCheck,Users} from 'lucide-react';
import ProjectTooltip from './project-tooltip';

type Nas={id:number;name:string;routerosVersion?:string|null;boardName?:string|null;uptime?:string|null;connectedAccounts?:number;status?:string;metricsUpdatedAt?:string|null;metrics?:Array<{receivedAt:string;cpu:number;freeMemory:number;totalMemory:number;uptime:string}>};
type Prefs={footer:{showNetwork:boolean;showNas:boolean;showStatus:boolean;showCpu:boolean;showRam:boolean;showUptime:boolean;showConnected:boolean;showClock:boolean;showExpiry:boolean;rotateNas:boolean;rotateSeconds:number;clock24h:boolean}};
const defaults:Prefs={footer:{showNetwork:true,showNas:true,showStatus:true,showCpu:true,showRam:true,showUptime:true,showConnected:true,showClock:true,showExpiry:true,rotateNas:false,rotateSeconds:15,clock24h:true}};
export default function NetworkStatusFooter({endpoint,networkName,expiresAt}:{endpoint:string;networkName:string;expiresAt:string}){
 const [prefs,setPrefs]=useState(defaults),[nas,setNas]=useState<Nas[]>([]),[nasError,setNasError]=useState(false),[selected,setSelected]=useState(0),[now,setNow]=useState(()=>new Date()),[updated,setUpdated]=useState('');
 useEffect(()=>{let live=true;const controller=new AbortController();const prefEndpoint=`${endpoint}/ui-preferences`;async function load(){
  const results=await Promise.allSettled([
   fetch(prefEndpoint,{credentials:'include',cache:'no-store',signal:controller.signal}),
   fetch(`${endpoint}/nas`,{credentials:'include',cache:'no-store',signal:controller.signal}),
  ]);
  if(!live)return;
  const [prefResult,nasResult]=results;
  if(prefResult.status==='fulfilled'&&prefResult.value.ok){try{const data=await prefResult.value.json();if(data?.preferences)setPrefs({...defaults,...data.preferences,footer:{...defaults.footer,...data.preferences.footer}});}catch{}}
  if(nasResult.status==='fulfilled'&&nasResult.value.ok){try{const data=await nasResult.value.json();const rows:Nas[]=(data.items||[]).filter((x:any)=>x.isEnabled);setNas(rows);setNasError(false);setSelected(i=>Math.min(i,Math.max(0,rows.length-1)));}catch{setNasError(true);}}
  else setNasError(true);
 }
 const onPreferences=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.endpoint===prefEndpoint&&detail.preferences)setPrefs({...defaults,...detail.preferences,footer:{...defaults.footer,...detail.preferences.footer}});};
 void load();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},30000);const tick=window.setInterval(()=>setNow(new Date()),1000);const visible=()=>{if(document.visibilityState==='visible')void load();};window.addEventListener('rl-ui-preferences-updated',onPreferences);document.addEventListener('visibilitychange',visible);return()=>{live=false;controller.abort();clearInterval(timer);clearInterval(tick);window.removeEventListener('rl-ui-preferences-updated',onPreferences);document.removeEventListener('visibilitychange',visible);};},[endpoint]);
 useEffect(()=>{if(!prefs.footer.rotateNas||nas.length<2)return;const timer=window.setInterval(()=>setSelected(i=>(i+1)%nas.length),Math.max(5,prefs.footer.rotateSeconds||15)*1000);return()=>clearInterval(timer);},[prefs.footer.rotateNas,prefs.footer.rotateSeconds,nas.length]);
 const item=nas[selected],sample=item?.metrics?.[item.metrics.length-1],cpu=sample?.cpu,ram=sample&&sample.totalMemory>0?Math.round((1-sample.freeMemory/sample.totalMemory)*100):null,uptime=sample?.uptime||item?.uptime||null;
 useEffect(()=>setUpdated(item?.metricsUpdatedAt||''),[item?.id,item?.metricsUpdatedAt]);
 const time=now.toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:!prefs.footer.clock24h});const date=now.toLocaleDateString('ar',{day:'numeric',month:'short'});
 const statusLabel=item?.status==='connected'?'متصل':item?.status==='disconnected'?'غير متصل':'بانتظار أول اتصال',statusColor=item?.status==='connected'?'text-emerald-600 dark:text-emerald-300':item?.status==='disconnected'?'text-rose-700 dark:text-rose-300':'text-amber-600 dark:text-amber-300';
 const expiry=new Date(expiresAt),expiryLabel=Number.isNaN(expiry.getTime())?'—':expiry.toLocaleDateString('ar',{day:'numeric',month:'short',year:'numeric'});
 const prev=()=>setSelected(i=>(i-1+nas.length)%nas.length),next=()=>setSelected(i=>(i+1)%nas.length);
 return <div dir="rtl" className="flex min-h-[42px] flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] border border-[#c9dced]/80 bg-[#f9fbfe]/95 px-3 py-1.5 text-[10px] text-slate-600 shadow-[0_10px_28px_rgba(60,88,116,.09)] backdrop-blur-xl dark:border-white/10 dark:bg-[#302e33]/95 dark:text-slate-300">
  {prefs.footer.showNetwork&&<span className="flex min-w-0 items-center gap-1.5"><Layers className="h-3.5 w-3.5 shrink-0 text-blue-500"/><b className="max-w-36 truncate">{networkName}</b></span>}
  {prefs.footer.showNas&&<div className="flex min-w-0 items-center gap-1.5"><Server className="h-3.5 w-3.5 shrink-0 text-cyan-500"/><span className="max-w-32 truncate font-semibold">{item?.name||(nasError?'تعذر تحميل NAS':'لا يوجد NAS مضاف')}</span>{nas.length>1&&<><button type="button" onClick={prev} title="NAS السابق" aria-label="NAS السابق" className="grid h-6 w-6 place-items-center rounded-md hover:bg-blue-50 dark:hover:bg-white/10"><ArrowRight className="h-3.5 w-3.5"/></button><span className="tabular-nums text-[9px] text-slate-400">{selected+1}/{nas.length}</span><button type="button" onClick={next} title="NAS التالي" aria-label="NAS التالي" className="grid h-6 w-6 place-items-center rounded-md hover:bg-blue-50 dark:hover:bg-white/10"><ArrowLeft className="h-3.5 w-3.5"/></button></>}</div>}
  {prefs.footer.showStatus&&item&&<span className={`flex items-center gap-1 ${statusColor}`}><i className={`h-1.5 w-1.5 rounded-full ${item.status==='connected'?'bg-emerald-500':item.status==='disconnected'?'bg-rose-600':'bg-amber-500'}`}/>{statusLabel}</span>}
  {prefs.footer.showCpu&&item&&<Metric icon={Cpu} label="CPU" value={cpu===undefined?'—':`${Math.round(cpu)}%`} tone="text-amber-500"/>}
  {prefs.footer.showRam&&item&&<Metric icon={HardDrive} label="RAM" value={ram===null?'—':`${ram}%`} tone="text-violet-500"/>}
  {prefs.footer.showUptime&&item&&<Metric icon={Clock3} label="مدة التشغيل" value={uptime||'—'} tone="text-sky-500"/>}
  {prefs.footer.showConnected&&item&&<Metric icon={Users} label="المتصلون" value={String(item.connectedAccounts??'—')} tone="text-emerald-500"/>}
  <span className="mr-auto flex items-center gap-1.5 text-slate-500"><Clock3 className="h-3.5 w-3.5 text-cyan-500"/><bdi className="tabular-nums">{time}</bdi><span className="hidden sm:inline">· {date}</span></span>
  {prefs.footer.showExpiry&&<span className="hidden items-center gap-1 text-slate-400 lg:flex"><ShieldCheck className="h-3.5 w-3.5 text-violet-500"/>الاشتراك حتى {expiryLabel}</span>}
  {updated&&<ProjectTooltip label={`وقت آخر عينة موارد من الجهاز: ${new Date(updated).toLocaleTimeString('ar')}`}><span className="hidden items-center gap-1 text-[9px] text-slate-400 xl:flex"><Activity className="h-3 w-3"/>آخر قراءة</span></ProjectTooltip>}
 </div>;
}
function Metric({icon:Icon,label,value,tone}:{icon:any;label:string;value:string;tone:string}){return <span className="flex min-w-0 items-center gap-1"><Icon className={`h-3.5 w-3.5 shrink-0 ${tone}`}/><span className="text-slate-500 dark:text-slate-400">{label}</span><bdi className="max-w-24 truncate font-semibold text-[#17386d] dark:text-slate-200">{value}</bdi></span>}
