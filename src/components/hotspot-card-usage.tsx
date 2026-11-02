"use client";
import {Clock3,Database} from 'lucide-react';
import ProjectTooltip from '@/components/ui/project-tooltip';
import CircularProgress from '@/components/ui/circular-progress';

type UsageCard={state:string;lifecycle?:string;activated_at:string|null;expires_at:string|null;duration_mode:string|null;quota_allowance_bytes:string|null;time_allowance_seconds:string|null;carried_seconds:string|null;upload_bytes:string;download_bytes:string;used_seconds:string};
export function hotspotBytes(n:number){return n>=1073741824?(n/1073741824).toFixed(2)+' GB':n>=1048576?(n/1048576).toFixed(2)+' MB':Math.round(n/1024)+' KB';}
function duration(seconds:number){const minutes=Math.ceil(Math.max(0,seconds)/60),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),rest=minutes%60;return days?`${days} يوم · ${hours} ساعة`:hours?`${hours} ساعة · ${rest} دقيقة`:`${rest} دقيقة`;}
function clamp(n:number){return Math.max(0,Math.min(100,n));}
export default function HotspotCardUsage({card,now,expanded=false,compact=false,metric}:{card:UsageCard;now:number;expanded?:boolean;compact?:boolean;metric?:'volume'|'time'}){
 const hasPeriod=Boolean(card.lifecycle);
 const used=Math.max(0,Number(card.upload_bytes)+Number(card.download_bytes)),quota=card.quota_allowance_bytes==null?null:Number(card.quota_allowance_bytes),volumePercent=quota&&quota>0?clamp(used/quota*100):null;
 const pending=card.lifecycle==='pending'||!card.activated_at,closed=card.lifecycle==='ended'||card.lifecycle==='cancelled';
 let total:number|null=null,remaining:number|null=null;
 if(card.duration_mode==='connected_time'&&card.time_allowance_seconds!=null){total=Number(card.time_allowance_seconds)+Number(card.carried_seconds||0);remaining=closed?0:Math.max(0,total-Number(card.used_seconds));}
 if(card.duration_mode==='continuous'&&card.activated_at&&card.expires_at){const start=new Date(card.activated_at).getTime(),end=new Date(card.expires_at).getTime();if(Number.isFinite(start)&&Number.isFinite(end)&&end>start){total=(end-start)/1000;remaining=closed?0:Math.max(0,(end-now)/1000);}}
 const timePercent=total&&total>0&&remaining!=null&&!pending?clamp(remaining/total*100):null;
 const volumeTone=volumePercent!=null&&volumePercent>=100?'danger':volumePercent!=null&&volumePercent>=80?'warning':'success';
 const timeTone=closed||remaining===0?'danger':remaining!=null&&(card.duration_mode==='continuous'&&remaining<=86400||card.duration_mode==='connected_time'&&timePercent!=null&&timePercent<=20)?'warning':'success';
 const timeText=!hasPeriod?'لا توجد فترة خدمة':closed?'انتهت الفترة':pending?'لم تبدأ بعد':remaining==null?'غير محدد':remaining===0?'انتهت الفترة':duration(remaining);
 const remainingText=!hasPeriod?'غير محدد':quota==null?'غير محدود':hotspotBytes(Math.max(0,quota-used));
 const usedColor=volumeTone==='danger'?'text-red-500':volumeTone==='warning'?'text-amber-500':'text-cyan-500';
 const ringSize=compact?'xs':expanded?'md':'sm';
 const volumeTooltip=`المستهلك: ${hotspotBytes(used)} · المتبقي: ${remainingText}${quota!=null?' · الحجم الكلي: '+hotspotBytes(quota):''}`;
 const timeTooltip=`${card.duration_mode==='connected_time'?'رصيد وقت الاستخدام':'الوقت حتى الانتهاء'}: ${timeText}${timePercent!=null?' · '+Math.round(timePercent)+'% متبقٍ':''}`;
 const volumePanel=<section className={compact?'flex min-w-0 items-center gap-3':"flex min-w-0 flex-col items-center gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/20 p-3 dark:border-cyan-400/15 dark:bg-cyan-400/[.025]"}>
  {!compact&&<p className="flex items-center justify-center gap-2 text-xs font-semibold"><Database className="h-4 w-4 text-cyan-500"/>حجم البيانات</p>}
  <ProjectTooltip label={volumeTooltip}><div tabIndex={0} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"><CircularProgress value={volumePercent} valueText={volumePercent==null?(hasPeriod&&quota==null?'∞':'—'):undefined} label={volumePercent==null?'حجم البيانات':'نسبة البيانات المستهلكة'} caption={volumePercent==null?(hasPeriod?'غير محدود':'غير محدد'):'مستخدم'} size={ringSize} tone={volumeTone==='success'?'info':volumeTone} trackClassName={volumePercent==null?undefined:'text-emerald-200 dark:text-emerald-400/25'}/></div></ProjectTooltip>
  <div className={compact?'min-w-0 space-y-1 text-[11px]':'w-full min-w-0 space-y-2 text-[11px]'}><p className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"><span className="inline-flex items-center gap-1.5 text-slate-500"><span aria-hidden="true" className={'h-1.5 w-1.5 rounded-full bg-current '+usedColor}/>مستهلك</span><strong dir="ltr" className="text-slate-700 dark:text-slate-100">{hotspotBytes(used)}</strong></p><p className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"><span className="inline-flex items-center gap-1.5 text-slate-500"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-300"/>متبقٍ</span><strong dir={quota==null?undefined:'ltr'} className="text-slate-700 dark:text-slate-100">{remainingText}</strong></p>{expanded&&quota!=null&&<p className="border-t border-cyan-100 pt-2 text-[10px] text-slate-500 dark:border-white/10">الحجم الكلي: <span dir="ltr">{hotspotBytes(quota)}</span></p>}</div>
 </section>;
 const timePanel=<section className={compact?'flex min-w-0 items-center gap-3':"flex min-w-0 flex-col items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/20 p-3 dark:border-violet-400/15 dark:bg-violet-400/[.025]"}>
  {!compact&&<p className="flex items-center justify-center gap-2 text-xs font-semibold"><Clock3 className="h-4 w-4 text-violet-500"/>{card.duration_mode==='connected_time'?'وقت الاستخدام':'الوقت المتبقي'}</p>}
  <ProjectTooltip label={timeTooltip}><div tabIndex={0} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-violet-400"><CircularProgress value={timePercent} label="نسبة الوقت المتبقي" caption={closed?'انتهت':pending?'لم تبدأ':'متبقٍ'} tone={timePercent==null?'neutral':timeTone} size={ringSize}/></div></ProjectTooltip>
  <div className={compact?'min-w-0 space-y-1':'w-full min-w-0 space-y-1 text-center'}><p className={compact?'text-[11px] font-semibold':'text-xs font-bold'}>{timeText}</p><p className="text-[10px] text-slate-500">{card.duration_mode==='connected_time'?'رصيد وقت اتصال':pending?'يبدأ عند أول استخدام':timePercent!=null?Math.round(timePercent)+'% متبقٍ':'—'}</p>{expanded&&<p className="text-[10px] leading-5 text-slate-500">{card.duration_mode==='connected_time'?'حسب آخر بيانات المحاسبة المستلمة':'بتوقيت الشبكة · العداد يتحدث محليًا'}</p>}</div>
 </section>;
 if(metric)return metric==='volume'?volumePanel:timePanel;
 return <div className={'grid items-stretch gap-3 '+(expanded?'grid-cols-1 min-[360px]:grid-cols-2':'grid-cols-2')}>{volumePanel}{timePanel}</div>;
}
