"use client";

import { ChevronDown, Eye, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ItemActionKey="view"|"edit"|"delete";
export type ItemActionTone="view"|"edit"|"danger"|"default";
export type ItemActionHandlers=Partial<Record<ItemActionKey,()=>void>>;
export type ItemActionVisibility=Partial<Record<ItemActionKey,boolean>>;

const actions:Record<ItemActionKey,{label:string;icon:LucideIcon;tone:ItemActionTone}>={
 view:{label:"عرض التفاصيل",icon:Eye,tone:"view"},
 edit:{label:"تعديل",icon:Pencil,tone:"edit"},
 delete:{label:"حذف",icon:Trash2,tone:"danger"},
};
const tone:Record<ItemActionTone,string>={
 view:"text-[#0758e9] hover:bg-[#edf4fb] dark:text-[#8ab5ff] dark:hover:bg-blue-500/10",
 edit:"text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10",
 danger:"text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10",
 default:"text-slate-600 hover:bg-[#edf4fb] dark:text-slate-200 dark:hover:bg-white/[.07]",
};

export default function ItemActionsDropdown({show={view:true,edit:true,delete:true},handlers={}}:{show?:ItemActionVisibility;handlers?:ItemActionHandlers}){
 const [open,setOpen]=useState(false);const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const close=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)},esc=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};document.addEventListener("mousedown",close);document.addEventListener("keydown",esc);return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",esc)}},[open]);
 const visible=(Object.keys(actions) as ItemActionKey[]).filter(key=>show[key]&&handlers[key]);
 return <div ref={ref} className="relative inline-flex" dir="rtl" onClick={e=>e.stopPropagation()}>
  <button type="button" aria-label="إجراءات العنصر" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className={`grid h-8 w-8 place-items-center rounded-[10px] border-2 shadow-[0_3px_9px_rgba(58,84,112,.08)] transition ${open?"border-[#8bb9f0] bg-[#e9f2ff] text-[#0758e9]":"border-[#c8d7e6] bg-white/80 text-slate-500 hover:border-[#8bb9f0] hover:bg-[#edf4fb] hover:text-[#0758e9] dark:border-white/[.12] dark:bg-white/[.04] dark:text-slate-300"}`}><ChevronDown className={`h-4 w-4 transition-transform ${open?"rotate-180":""}`}/></button>
  {open&&<div className="ui-state-enter absolute left-0 top-[calc(100%+7px)] z-[9999] w-[190px] overflow-hidden rounded-[16px] border-2 border-[#9fb8d2] bg-white p-1.5 text-right shadow-[0_14px_34px_rgba(37,64,92,.18)] dark:border-white/[.18] dark:bg-[#26394c]">
   {visible.map((key,i)=>{const a=actions[key],Icon=a.icon;return <div key={key} className={key==="delete"&&i>0?"mt-1 border-t border-[#dce6f0] pt-1 dark:border-white/[.10]":""}><button type="button" onClick={()=>{setOpen(false);handlers[key]?.()}} className={`flex min-h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-right text-xs font-semibold transition ${tone[a.tone]}`}><span className="min-w-0 flex-1">{a.label}</span><Icon className="h-4 w-4 shrink-0"/></button></div>})}
  </div>}
 </div>;
}
