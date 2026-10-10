"use client";
import {Trash2} from "lucide-react";
import ProjectDialog from "@/components/ui/project-dialog";
import ProjectButton from "@/components/ui/project-button";

export default function ConfirmDeleteDialog({open,title="تأكيد الحذف",description,items=[],busy=false,onConfirm,onCancel}:{open:boolean;title?:string;description?:string;items?:string[];busy?:boolean;onConfirm:()=>void;onCancel:()=>void}){
 return <ProjectDialog open={open} title={title} description={description??"سيتم حذف العناصر المحددة نهائيًا. لا يمكن التراجع عن هذه العملية."} onClose={onCancel} danger busy={busy} maxWidth="max-w-md" footer={<><ProjectButton variant="secondary" disabled={busy} onClick={onCancel}>إلغاء</ProjectButton><ProjectButton disabled={busy} onClick={onConfirm} className="bg-red-600 hover:bg-red-700"><Trash2/>{busy?"جارٍ الحذف...":"تأكيد الحذف"}</ProjectButton></>}>
   {items.length>0&&<div className="max-h-56 overflow-y-auto rounded-[16px] border border-red-100 bg-red-50/45 p-2.5 dark:border-white/[.10] dark:bg-[#10151c]"><div className="mb-2 text-[10px] font-semibold text-red-500">المحدد للحذف ({items.length})</div><div className="space-y-1.5">{items.map((item,i)=><div key={i} className="rounded-[10px] bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm dark:border dark:border-white/[.08] dark:bg-[#222833] dark:text-[#f3f5f8]">{item}</div>)}</div></div>}
 </ProjectDialog>;
}
