"use client";

import { Ban, CheckCheck, CirclePause, CirclePlay, Trash2, X, ChevronDown, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type BulkActionTone="primary"|"success"|"warning"|"danger"|"default";
export type BulkActionKey="activate"|"suspend"|"disable"|"delete";
export type BulkActionHandlers=Partial<Record<BulkActionKey,()=>void>>;
export type BulkActionVisibility=Partial<Record<BulkActionKey,boolean>>;

const definitions:Record<BulkActionKey,{label:string;icon:LucideIcon;tone:BulkActionTone}>={
 activate:{label:"تفعيل المحدد",icon:CirclePlay,tone:"success"},
 suspend:{label:"تعليق المحدد",icon:CirclePause,tone:"warning"},
 disable:{label:"تعطيل المحدد",icon:Ban,tone:"danger"},
 delete:{label:"حذف المحدد",icon:Trash2,tone:"danger"},
};

const toneClass:Record<BulkActionTone,string>={
 primary:"text-[#0758e9] hover:bg-[#edf4fb] dark:text-[#8ab5ff] dark:hover:bg-blue-500/10",
 success:"text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10",
 warning:"text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10",
 danger:"text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10",
 default:"text-slate-600 hover:bg-[#edf4fb] dark:text-slate-200 dark:hover:bg-white/[.07]",
};

function Row({label,Icon,tone,onClick}:{label:string;Icon:LucideIcon;tone:BulkActionTone;onClick:()=>void}){
 return <button type="button" onClick={onClick} className={`flex min-h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-right text-xs font-semibold transition ${toneClass[tone]}`}><span className="min-w-0 flex-1">{label}</span><Icon className="h-4 w-4 shrink-0"/></button>;
}

export default function BulkActionsDropdown({allSelected,onToggleAll,onClearSelection,show={},handlers={}}:{allSelected:boolean;onToggleAll:()=>void;onClearSelection:()=>void;show?:BulkActionVisibility;handlers?:BulkActionHandlers}){
 const [open,setOpen]=useState(false);const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const close=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[open]);
 const run=(fn:()=>void)=>{setOpen(false);fn()};
 const visible=(Object.keys(definitions) as BulkActionKey[]).filter(key=>show[key]&&handlers[key]);
 return <div ref={ref} className="relative inline-flex" dir="rtl">
  <button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} className="flex h-9 items-center gap-2 rounded-[12px] border border-[#bfd4ea] bg-white px-3 text-xs font-semibold text-[#17386d] shadow-sm transition hover:bg-[#edf4fb] dark:border-white/[.12] dark:bg-[#30353d] dark:text-white dark:hover:bg-[#383e48]"><span>تطبيق إجراء</span><ChevronDown className={`h-4 w-4 transition-transform ${open?"rotate-180":""}`}/></button>
  {open&&<div className="ui-state-enter absolute left-0 top-[calc(100%+7px)] z-[9999] w-[230px] overflow-hidden rounded-[16px] border-2 border-[#9fb8d2] bg-white p-1.5 text-right shadow-[0_14px_34px_rgba(37,64,92,.18)] dark:border-white/[.18] dark:bg-[#26394c]">
   <div className="mb-1 border-b border-[#dce6f0] pb-1 dark:border-white/[.10]">
    <Row label={allSelected?"إلغاء تحديد الكل":"تحديد الكل"} Icon={allSelected?X:CheckCheck} tone="primary" onClick={()=>run(onToggleAll)}/>
    <Row label="إلغاء التحديد" Icon={X} tone="default" onClick={()=>run(onClearSelection)}/>
   </div>
   {visible.map(key=>{const d=definitions[key];return <Row key={key} label={d.label} Icon={d.icon} tone={d.tone} onClick={()=>run(handlers[key]!)}/>})}
  </div>}
 </div>;
}
