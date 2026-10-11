"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {PanelsTopLeft,TriangleAlert,X} from "lucide-react";
import ProjectButton from "@/components/ui/project-button";
import "./project-dialog.css";

export default function ProjectDialog({open=true,title,description,onClose,children,footer,maxWidth="max-w-2xl",danger=false,busy=false,headerAccessory,headerDetails,titleClassName=""}:{open?:boolean;title:string;description?:string;onClose:()=>void;children:React.ReactNode;footer?:React.ReactNode;maxWidth?:string;danger?:boolean;busy?:boolean;headerAccessory?:React.ReactNode;headerDetails?:React.ReactNode;titleClassName?:string}){
 return <Dialog.Root open={open} onOpenChange={value=>{if(!value&&!busy)onClose();}}><Dialog.Portal>
  <Dialog.Overlay className="rl-dialog-overlay fixed inset-0 z-[10000] bg-[#071525]/65 backdrop-blur-[8px]"/>
  <Dialog.Content dir="rtl" {...(!description?{"aria-describedby":undefined}:{})} onEscapeKeyDown={e=>{if(busy)e.preventDefault();}} onPointerDownOutside={e=>{if(busy)e.preventDefault();}} className={`rl-dialog-panel fixed left-1/2 top-1/2 z-[10001] flex max-h-[calc(100dvh-32px)] w-[calc(100%-24px)] ${maxWidth} -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white text-slate-800 shadow-[0_36px_110px_-16px_rgba(0,0,0,.65)] outline-none dark:border-white/10 dark:bg-[#17263b] dark:text-slate-200 sm:w-[calc(100%-48px)]`}>
   <div className="flex shrink-0 items-start gap-4 border-b border-slate-100 bg-gradient-to-l from-blue-50/70 to-white px-5 py-5 sm:py-6 dark:border-white/10 dark:from-blue-500/10 dark:to-transparent sm:px-6">
    {!headerAccessory&&<span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] ${danger?"bg-red-50 text-red-500 dark:bg-red-500/15":"bg-blue-100/70 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"}`}>{danger?<TriangleAlert className="h-5 w-5"/>:<PanelsTopLeft className="h-5 w-5"/>}</span>}
    <div className="min-w-0 flex-1"><Dialog.Title className={`text-base font-bold leading-7 ${titleClassName}`}>{title}</Dialog.Title>{description&&<Dialog.Description className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">{description}</Dialog.Description>}{headerDetails}</div>
    {headerAccessory}
    <ProjectButton variant="ghost" size="icon" disabled={busy} onClick={onClose} aria-label="إغلاق النافذة" className="rounded-full border border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/5"><X/></ProjectButton>
   </div>
   <div className="min-h-0 overflow-y-auto overscroll-contain bg-white p-5 dark:bg-[#17263b] sm:p-6">{children}</div>
   {footer&&<div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-white/[.025] sm:px-6">{footer}</div>}
  </Dialog.Content>
 </Dialog.Portal></Dialog.Root>;
}
