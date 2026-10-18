"use client";

import {useEffect,useRef,useState} from "react";
import {CircleCheck,TriangleAlert,X} from "lucide-react";
import {createPortal} from "react-dom";
import "./floating-notice.css";

export default function FloatingNotice({error,warning:warningMessage,message,onDismiss,action}:{error?:string;warning?:string;message?:string;onDismiss:()=>void;action?:{label:string;onClick:()=>void}}){
 const [mounted,setMounted]=useState(false),[paused,setPaused]=useState(false);
 const [visible,setVisible]=useState<{text:string;warning:boolean;caution:boolean}|null>(null),[closing,setClosing]=useState(false);
 const dismiss=useRef(onDismiss);
 dismiss.current=onDismiss;
 const text=error||warningMessage||message;
 const duration=error?9000:warningMessage?7000:5000;
 useEffect(()=>setMounted(true),[]);
 useEffect(()=>{
  if(text){setVisible({text,warning:Boolean(error),caution:!error&&Boolean(warningMessage)});setClosing(false);return;}
  setClosing(true);
  const timer=setTimeout(()=>setVisible(null),280);
  return()=>clearTimeout(timer);
 },[text,error,warningMessage]);
 useEffect(()=>{
  if(!text||paused)return;
  const timer=setTimeout(()=>dismiss.current(),duration);
  return()=>clearTimeout(timer);
 },[error,warningMessage,message,paused,duration,text]);
 if(!mounted||!visible)return null;
 const warning=visible.warning;
 const caution=visible.caution;
 return createPortal(<div dir="rtl" className="pointer-events-none fixed inset-x-0 bottom-6 z-[11000] flex justify-center px-3 sm:bottom-7">
  <div key={`${warning}:${caution}:${visible.text}`} data-state={closing?"closed":"open"} role={warning?"alert":"status"} aria-live={warning?"assertive":"polite"} aria-atomic="true" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false);}} className={`rl-floating-notice pointer-events-auto flex w-fit max-w-full items-center gap-3 rounded-[18px] border border-white/[.08] bg-[#171717] px-4 py-3 text-white shadow-[0_12px_36px_rgba(0,0,0,.32)] sm:min-h-[64px] sm:px-5`}>
   <span className="grid h-6 w-6 shrink-0 place-items-center">
    {warning||caution?<TriangleAlert className={`h-5 w-5 ${warning?"text-rose-400":"text-amber-400"}`}/>:<CircleCheck className="h-5 w-5 text-emerald-500"/>}
   </span>
   <div className="min-w-0 flex-1"><p className="max-w-[min(72vw,520px)] whitespace-pre-wrap break-words text-center text-sm font-medium leading-6 text-white">{visible.text}</p>{action&&<button type="button" onClick={action.onClick} className="mt-1 text-xs font-semibold text-sky-300 underline-offset-2 hover:underline">{action.label}</button>}</div>
   <span aria-hidden="true" className="h-8 shrink-0 border-r border-white/[.16]"/>
   <button type="button" aria-label="إغلاق الإشعار" onClick={()=>dismiss.current()} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white transition-colors hover:bg-white/[.10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"><X className="h-5 w-5"/></button>
  </div>
 </div>,document.body);
}
