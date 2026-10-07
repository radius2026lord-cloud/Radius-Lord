"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ArrowDown } from "lucide-react";
import Button from "@/components/ui/project-button";
import ProjectTooltip from "@/components/ui/project-tooltip";

export default function FloatingContentGuide({contentRef}:{contentRef:RefObject<HTMLElement|null>}){
 const [position,setPosition]=useState<{left:number;bottom:number}|null>(null);
 const nextRef=useRef<()=>void>(()=>{});
 useEffect(()=>{
  const content=contentRef.current;if(!content)return;
  let parent=content.parentElement;
  while(parent&&!/(auto|scroll)/.test(getComputedStyle(parent).overflowY))parent=parent.parentElement;
  const scroller=parent;let frame=0;
  const viewport=()=>scroller?scroller.getBoundingClientRect():{top:0,bottom:window.innerHeight,left:0,width:window.innerWidth};
  const update=()=>{
   const view=viewport(),bounds=content.getBoundingClientRect();
   const editing=content.contains(document.activeElement)&&document.activeElement?.matches('input,textarea,[aria-expanded="true"]');
   const bottom=Math.min(view.bottom,window.innerHeight);
   const available=scroller?scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight:document.documentElement.scrollHeight-window.scrollY-window.innerHeight;
   setPosition(!editing&&available>28&&bounds.bottom>bottom+24&&bounds.top<bottom&&bottom>view.top+100?{left:view.left+view.width/2,bottom:window.innerHeight-bottom+12}:null);
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};
  nextRef.current=()=>{
   const behavior:ScrollBehavior=window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
   // One action reveals the end of this form, including its final controls.
   if(scroller){const bounds=content.getBoundingClientRect(),view=scroller.getBoundingClientRect();scroller.scrollTo({top:scroller.scrollTop+bounds.bottom-view.bottom+12,behavior});}
   else window.scrollTo({top:window.scrollY+content.getBoundingClientRect().bottom-window.innerHeight+12,behavior});
  };
  const resize=new ResizeObserver(schedule);resize.observe(content);if(scroller)resize.observe(scroller);
  document.addEventListener('scroll',schedule,true);document.addEventListener('focusin',schedule);document.addEventListener('focusout',schedule);window.addEventListener('resize',schedule);schedule();
  return()=>{resize.disconnect();cancelAnimationFrame(frame);document.removeEventListener('scroll',schedule,true);document.removeEventListener('focusin',schedule);document.removeEventListener('focusout',schedule);window.removeEventListener('resize',schedule);};
 },[contentRef]);
 if(!position)return null;
 return createPortal(<div dir="rtl" className="fixed z-40 -translate-x-1/2" style={position}><ProjectTooltip label="عرض بقية المعلومات"><Button onClick={()=>nextRef.current()} className="max-w-[calc(100vw-32px)] rounded-full border border-white/30 !bg-[#0758e9]/65 backdrop-blur-[2px] shadow-[0_4px_14px_rgba(7,88,233,.16)] hover:!bg-[#0758e9]/85"><ArrowDown className="motion-safe:animate-bounce"/><span>المزيد بالأسفل</span></Button></ProjectTooltip></div>,document.body);
}
