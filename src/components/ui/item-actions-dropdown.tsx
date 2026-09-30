"use client";

import { CheckCircle2, CreditCard, ChevronDown, Eye, Pencil, Trash2, type LucideIcon } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

export type ItemActionKey="view"|"edit"|"delete"|"payment"|"confirmPayment";
export type ItemActionTone="view"|"edit"|"danger"|"default"|"success";
export type ItemActionHandlers=Partial<Record<ItemActionKey,()=>void>>;
export type ItemActionVisibility=Partial<Record<ItemActionKey,boolean>>;

const actions:Record<ItemActionKey,{label:string;icon:LucideIcon;tone:ItemActionTone}>={
 payment:{label:"عرض عملية الدفع",icon:CreditCard,tone:"view"},confirmPayment:{label:"تأكيد الدفع",icon:CheckCircle2,tone:"success"},
 view:{label:"عرض التفاصيل",icon:Eye,tone:"view"},edit:{label:"تعديل",icon:Pencil,tone:"edit"},delete:{label:"حذف",icon:Trash2,tone:"danger"},
};
const tone:Record<ItemActionTone,string>={
 success:"text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10",
 view:"text-[#0758e9] hover:bg-[#edf4fb] dark:text-[#8ab5ff] dark:hover:bg-blue-500/10",
 edit:"text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10",
 danger:"text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10",
 default:"text-slate-600 hover:bg-[#edf4fb] dark:text-slate-200 dark:hover:bg-white/[.07]",
};

export default function ItemActionsDropdown({show={view:true,edit:true,delete:true},handlers={}}:{show?:ItemActionVisibility;handlers?:ItemActionHandlers}){
 const [open,setOpen]=useState(false),[pos,setPos]=useState({top:0,left:0,openUp:false,arrowLeft:150});
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
 const visible=(Object.keys(actions) as ItemActionKey[]).filter(key=>show[key]&&handlers[key]);
 const place=()=>{const el=trigger.current;if(!el)return;const r=el.getBoundingClientRect(),w=190,h=Math.max(116,visible.length*42+16),gap=9,pad=8;const openUp=window.innerHeight-r.bottom<h+20&&r.top>h;const left=Math.max(pad,Math.min(window.innerWidth-w-pad,r.left+r.width/2-w/2));const center=r.left+r.width/2;setPos({top:openUp?Math.max(pad,r.top-h-gap):Math.min(window.innerHeight-h-pad,r.bottom+gap),left,openUp,arrowLeft:Math.max(18,Math.min(w-18,center-left))})};
 useEffect(()=>{if(!open)return;place();const close=(e:MouseEvent)=>{const n=e.target as Node;if(!root.current?.contains(n)&&!menu.current?.contains(n))setOpen(false)},esc=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)},reposition=()=>place();document.addEventListener("mousedown",close);document.addEventListener("keydown",esc);window.addEventListener("resize",reposition);window.addEventListener("scroll",reposition,true);return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",esc);window.removeEventListener("resize",reposition);window.removeEventListener("scroll",reposition,true)}},[open,visible.length]);
 const dropdown=open&&typeof document!=="undefined"?createPortal(<div ref={menu} className="ui-state-enter fixed z-[9999] w-[190px] overflow-visible rounded-[16px] border-2 border-[#9fb8d2] bg-white p-1.5 text-right shadow-[0_14px_34px_rgba(37,64,92,.22)] dark:border-white/[.18] dark:bg-[#26394c]" style={{top:pos.top,left:pos.left}} dir="rtl">
  <span aria-hidden="true" className={`absolute h-3 w-3 -translate-x-1/2 rotate-45 border-[#9fb8d2] bg-white dark:border-white/[.18] dark:bg-[#26394c] ${pos.openUp?"-bottom-[7px] border-b-2 border-r-2":"-top-[7px] border-l-2 border-t-2"}`} style={{left:pos.arrowLeft}}/>
  <div className="relative z-10 overflow-hidden rounded-[12px]">{visible.map((key,i)=>{const a=actions[key],Icon=a.icon;return <div key={key} className={key==="delete"&&i>0?"mt-1 border-t border-[#dce6f0] pt-1 dark:border-white/[.10]":""}><button type="button" onClick={()=>{setOpen(false);handlers[key]?.()}} className={`flex min-h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-right text-xs font-semibold transition ${tone[a.tone]}`}><span className="min-w-0 flex-1">{a.label}</span><Icon className="h-4 w-4 shrink-0"/></button></div>})}</div>
 </div>,document.body):null;
 return <div ref={root} className="relative inline-flex" dir="rtl" onClick={e=>e.stopPropagation()}>
  <button ref={trigger} type="button" aria-label="إجراءات العنصر" aria-expanded={open} onClick={()=>{if(!open)place();setOpen(v=>!v)}} className={`grid h-8 w-8 place-items-center rounded-[10px] border-2 shadow-[0_3px_9px_rgba(58,84,112,.08)] transition ${open?"border-[#8bb9f0] bg-[#e9f2ff] text-[#0758e9]":"border-[#c8d7e6] bg-white/80 text-slate-500 hover:border-[#8bb9f0] hover:bg-[#edf4fb] hover:text-[#0758e9] dark:border-white/[.12] dark:bg-white/[.04] dark:text-slate-300"}`}><ChevronDown className={`h-4 w-4 transition-transform ${open?"rotate-180":""}`}/></button>
  {dropdown}
 </div>;
}
