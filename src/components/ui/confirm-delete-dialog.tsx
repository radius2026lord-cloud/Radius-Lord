"use client";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function ConfirmDeleteDialog({open,title="تأكيد الحذف",description,items=[],busy=false,onConfirm,onCancel}:{open:boolean;title?:string;description?:string;items?:string[];busy?:boolean;onConfirm:()=>void;onCancel:()=>void}){
 useEffect(()=>{if(!open)return;const esc=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!busy)onCancel()};document.addEventListener("keydown",esc);return()=>document.removeEventListener("keydown",esc)},[open,busy,onCancel]);
 if(!open||typeof document==="undefined")return null;
 return createPortal(<div className="fixed inset-0 z-[10000] grid place-items-center bg-[#071525]/45 p-4 backdrop-blur-[3px]" dir="rtl" role="dialog" aria-modal="true">
  <div className="ui-state-enter w-full max-w-md overflow-hidden rounded-[24px] border border-white/70 bg-white shadow-[0_24px_70px_rgba(10,31,54,.28)] dark:border-white/[.12] dark:bg-[#26394c]">
   <div className="flex items-start gap-3 p-5"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"><AlertTriangle className="h-5 w-5"/></span><div className="min-w-0 flex-1"><h3 className="text-base font-bold text-[#17386d] dark:text-white">{title}</h3><p className="mt-1.5 text-xs leading-6 text-slate-500 dark:text-slate-300">{description??"سيتم حذف العناصر المحددة نهائيًا. لا يمكن التراجع عن هذه العملية."}</p></div><button type="button" disabled={busy} onClick={onCancel} className="grid h-8 w-8 place-items-center rounded-[10px] text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[.07]"><X className="h-4 w-4"/></button></div>
   {items.length>0&&<div className="mx-5 max-h-56 overflow-y-auto rounded-[16px] border border-red-100 bg-red-50/45 p-2.5 dark:border-red-500/15 dark:bg-red-500/[.05]"><div className="mb-2 text-[10px] font-semibold text-red-500">المحدد للحذف ({items.length})</div><div className="space-y-1.5">{items.map((item,i)=><div key={i} className="rounded-[10px] bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm dark:bg-white/[.05] dark:text-slate-100">{item}</div>)}</div></div>}
   <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 p-4 dark:border-white/[.08] dark:bg-black/[.08]"><button type="button" disabled={busy} onClick={onCancel} className="h-10 rounded-[13px] border border-[#cbd9e7] px-4 text-xs font-semibold dark:border-white/[.12]">إلغاء</button><button type="button" disabled={busy} onClick={onConfirm} className="flex h-10 items-center gap-2 rounded-[13px] bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"><Trash2 className="h-4 w-4"/>{busy?"جارٍ الحذف...":"حذف"}</button></div>
  </div>
 </div>,document.body);
}
