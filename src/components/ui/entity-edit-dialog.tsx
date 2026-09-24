"use client";

import { X } from "lucide-react";

export default function EntityEditDialog({title,description,onClose,children,footer,maxWidth="max-w-2xl"}:{title:string;description?:string;onClose:()=>void;children:React.ReactNode;footer?:React.ReactNode;maxWidth?:string}){
 return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-3 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={title} onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className={`ui-state-enter rl-surface w-full ${maxWidth} max-h-[calc(100vh-24px)] overflow-y-auto rounded-[22px] bg-white p-5 shadow-2xl dark:bg-[#0d243b]`}>
   <div className="flex items-start justify-between gap-4 border-b border-[#dbe5ef] pb-4 dark:border-white/[.08]">
    <div><h3 className="text-base font-semibold text-[#17386d] dark:text-[#e3dee6]">{title}</h3>{description&&<p className="mt-1 text-xs text-slate-500 dark:text-[#9f98a5]">{description}</p>}</div>
    <button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] border border-[#c5d5e5] bg-[#f7faff] text-slate-500 transition hover:border-[#78afe9] hover:bg-[#e9f2ff] hover:text-[#0758e9] dark:border-white/[.10] dark:bg-white/[.04] dark:text-[#bdb6c1]"><X className="h-4 w-4"/></button>
   </div>
   <div className="pt-4">{children}</div>
   {footer&&<div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#dbe5ef] pt-4 dark:border-white/[.08]">{footer}</div>}
  </div>
 </div>
}
