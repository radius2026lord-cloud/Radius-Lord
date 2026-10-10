"use client";

import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import {CircleCheck,TriangleAlert,X} from "lucide-react";
import ProjectButton from "@/components/ui/project-button";

/** Portal keeps feedback visible even inside scrolling or transformed layouts. */
export default function FloatingNotice({error,message,onDismiss}:{error?:string;message?:string;onDismiss:()=>void}){
 const [mounted,setMounted]=useState(false);
 useEffect(()=>setMounted(true),[]);
 if(!mounted||(!error&&!message))return null;
 const warning=Boolean(error);
 return createPortal(<div dir="rtl" className="pointer-events-none fixed inset-x-3 top-[110px] z-[100] flex justify-center sm:inset-x-6">
  <div role={warning?"alert":"status"} aria-atomic="true" className={`pointer-events-auto flex max-h-[calc(100dvh-150px)] w-full max-w-xl items-start gap-3 overflow-y-auto rounded-[18px] border p-4 shadow-xl ${warning?"border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-slate-900 dark:text-red-300":"border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-300"}`}>
   {warning?<TriangleAlert className="mt-1 h-5 w-5 shrink-0"/>:<CircleCheck className="mt-1 h-5 w-5 shrink-0"/>}
   <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-6">{error||message}</p>
   <ProjectButton variant="ghost" size="icon" aria-label="إغلاق التنبيه" onClick={onDismiss}><X/></ProjectButton>
  </div>
 </div>,document.body);
}
