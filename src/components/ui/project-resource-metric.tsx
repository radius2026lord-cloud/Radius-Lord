"use client";
import type { LucideIcon } from "lucide-react";

const tones={
 blue:{icon:"bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",bar:"bg-blue-500"},
 violet:{icon:"bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",bar:"bg-violet-500"},
 cyan:{icon:"bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300",bar:"bg-cyan-500"},
 amber:{icon:"bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",bar:"bg-amber-500"},
};
export default function ProjectResourceMetric({name,icon:Icon,value,detail,percent,tone="blue",refreshing=false,stale=false}:{name:string;icon:LucideIcon;value:string;detail:string;percent:number|null;tone?:keyof typeof tones;refreshing?:boolean;stale?:boolean}){
 const color=tones[tone],usage=percent===null?null:Math.max(0,Math.min(100,percent));
 return <div className="rl-surface-soft ui-state-enter group min-w-0 rounded-[18px] bg-[#f9fbfe] p-4 transition-colors duration-300 hover:bg-white dark:bg-white/[.03] dark:hover:bg-white/[.05]">
 <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-slate-600 dark:text-slate-300">{name}</span><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] ${color.icon} motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-6 ${refreshing?"motion-safe:animate-pulse":""}`}><Icon className="h-5 w-5" aria-hidden="true"/></span></div>
 <p className={`mt-3 break-words text-right text-2xl font-semibold tabular-nums ${stale?"text-slate-500 dark:text-slate-400":"text-slate-800 dark:text-slate-100"}`} dir="ltr">{value}</p>
 {usage!==null&&<div className="mt-3 flex items-center gap-2"><div role="progressbar" aria-label={`استخدام ${name}`} aria-valuenow={Math.round(usage)} aria-valuemin={0} aria-valuemax={100} className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className={`h-full rounded-full ${color.bar} transition-[width] duration-500 motion-reduce:transition-none ${stale?"opacity-40":""}`} style={{width:`${usage}%`}}/></div><span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400"><bdi>{Math.round(usage)}%</bdi></span></div>}
 <p className="mt-3 break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
 </div>;
}
