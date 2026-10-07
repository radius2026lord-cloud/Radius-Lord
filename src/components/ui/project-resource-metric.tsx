"use client";
import type { LucideIcon } from "lucide-react";

const tones={
 blue:{icon:"bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",ring:"text-blue-500",surface:"from-blue-50/80 to-white dark:from-blue-500/10 dark:to-[#10263c]"},
 violet:{icon:"bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",ring:"text-violet-500",surface:"from-violet-50/80 to-white dark:from-violet-500/10 dark:to-[#10263c]"},
 cyan:{icon:"bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300",ring:"text-cyan-500",surface:"from-cyan-50/80 to-white dark:from-cyan-500/10 dark:to-[#10263c]"},
 amber:{icon:"bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",ring:"text-amber-500",surface:"from-amber-50/80 to-white dark:from-amber-500/10 dark:to-[#10263c]"},
};
export default function ProjectResourceMetric({name,icon:Icon,value,detail,percent,tone="blue",refreshing=false,stale=false}:{name:string;icon:LucideIcon;value:string;detail:string;percent:number|null;tone?:keyof typeof tones;refreshing?:boolean;stale?:boolean}){
 const color=tones[tone],usage=percent===null?null:Math.max(0,Math.min(100,percent));
 return <div className={`rl-surface-soft ui-state-enter group min-w-0 rounded-[18px] bg-gradient-to-bl p-4 ${color.surface} motion-safe:transition-shadow motion-safe:duration-300 hover:shadow-[0_8px_24px_rgba(54,86,120,.10)]`}>
 <div className="flex items-center gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] ${color.icon} motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-6 ${refreshing?"motion-safe:animate-pulse":""}`}><Icon className="h-5 w-5" aria-hidden="true"/></span><span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{name}</span></div>
 <div className="mt-3 flex items-center justify-between gap-3"><div className="min-w-0"><p className={`break-words text-right text-2xl font-semibold tabular-nums ${stale?"text-slate-500 dark:text-slate-400":"text-slate-800 dark:text-slate-100"}`} dir="ltr">{value}</p><p className="mt-2 break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p></div>
 {usage!==null&&<div role="progressbar" aria-label={`استخدام ${name}`} aria-valuenow={Number(usage.toFixed(1))} aria-valuemin={0} aria-valuemax={100} className={`relative h-20 w-20 shrink-0 ${color.ring} ${stale?"opacity-45":""}`}><svg viewBox="0 0 80 80" aria-hidden="true" className="h-full w-full -rotate-90"><circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" strokeWidth="6" opacity=".12"/><circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap={usage>0?"round":"butt"} strokeDasharray={2*Math.PI*32} strokeDashoffset={2*Math.PI*32*(1-usage/100)} className="transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none"/></svg><span className="absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums"><bdi>{usage>0&&usage<1?usage.toFixed(1):Math.round(usage)}%</bdi></span></div>}
 </div>
 </div>;
}
