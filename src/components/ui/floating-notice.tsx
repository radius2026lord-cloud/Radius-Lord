"use client";

import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {CircleCheck,TriangleAlert,X} from "lucide-react";
import ProjectButton from "@/components/ui/project-button";
import "./floating-notice.css";

export default function FloatingNotice({error,message,onDismiss}:{error?:string;message?:string;onDismiss:()=>void}){
 const [mounted,setMounted]=useState(false),[paused,setPaused]=useState(false);
 const [visible,setVisible]=useState<{text:string;warning:boolean}|null>(null),[closing,setClosing]=useState(false);
 const dismiss=useRef(onDismiss);
 dismiss.current=onDismiss;
 const text=error||message;
 const duration=error?9000:5000;
 useEffect(()=>setMounted(true),[]);
 useEffect(()=>{
  if(text){setVisible({text,warning:Boolean(error)});setClosing(false);return;}
  setClosing(true);
  const timer=setTimeout(()=>setVisible(null),280);
  return()=>clearTimeout(timer);
 },[text,error]);
 useEffect(()=>{
  if(!text||paused)return;
  const timer=setTimeout(()=>dismiss.current(),duration);
  return()=>clearTimeout(timer);
 },[error,message,paused,duration,text]);
 if(!mounted||!visible)return null;
 const warning=visible.warning;
 return createPortal(<div dir="rtl" className="pointer-events-none fixed inset-x-3 bottom-[110px] z-[11000] flex justify-center sm:inset-x-auto sm:left-6 sm:bottom-[110px] sm:w-[380px] sm:justify-start">
  <div key={`${warning}:${visible.text}`} data-state={closing?"closed":"open"} role={warning?"alert":"status"} aria-atomic="true" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setPaused(false);}} className={`rl-floating-notice pointer-events-auto relative w-full max-w-md overflow-hidden rounded-[20px] border bg-white shadow-[0_20px_60px_-10px_rgba(15,23,42,.4)] ring-[3px] ring-slate-200/60 dark:ring-slate-700/60 dark:bg-[#17263b] ${warning?"border-red-200 dark:border-red-400/25":"border-emerald-200 dark:border-emerald-400/25"}`}>
   <div className="flex max-h-[calc(100dvh-160px)] items-start gap-3.5 overflow-y-auto p-5">
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${warning?"bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-300":"bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"}`}>
     {warning?<TriangleAlert className="h-6 w-6"/>:<CircleCheck className="h-6 w-6"/>}
    </span>
    <div className="min-w-0 flex-1"><p className="mb-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">{warning?"تعذر إكمال العملية":"تمت العملية بنجاح"}</p><p className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-600 dark:text-slate-300">{visible.text}</p></div>
    <ProjectButton variant="ghost" size="icon" aria-label="إغلاق التنبيه" onClick={()=>dismiss.current()} className="h-8 w-8 rounded-full border border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5"><X/></ProjectButton>
   </div>
   <div aria-hidden="true" className={`h-1 ${warning?"bg-red-100 dark:bg-red-500/10":"bg-emerald-100 dark:bg-emerald-500/10"}`}><div key={String(paused)} className={`rl-notice-progress h-full origin-right ${warning?"bg-red-400":"bg-emerald-500"}`} style={{animationDuration:`${duration}ms`,animationPlayState:paused?"paused":"running"}}/></div>
  </div>
 </div>,document.body);
}
