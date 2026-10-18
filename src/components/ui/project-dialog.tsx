"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {PanelsTopLeft,TriangleAlert,X} from "lucide-react";
import ProjectButton from "@/components/ui/project-button";
import ProjectTooltip from "@/components/ui/project-tooltip";
import "./project-dialog.css";

export default function ProjectDialog({open=true,title,description,onClose,children,footer,maxWidth="max-w-2xl",danger=false,busy=false,headerAccessory,headerDetails,titleClassName="",hostingerStyle=false,compact=false,bodyClassName=""}:{open?:boolean;title:string;description?:string;onClose:()=>void;children:React.ReactNode;footer?:React.ReactNode;maxWidth?:string;danger?:boolean;busy?:boolean;headerAccessory?:React.ReactNode;headerDetails?:React.ReactNode;titleClassName?:string;hostingerStyle?:boolean;compact?:boolean;bodyClassName?:string}){
 return <Dialog.Root open={open} onOpenChange={value=>{if(!value&&!busy)onClose();}}><Dialog.Portal>
  <Dialog.Overlay className="rl-dialog-overlay fixed inset-0 z-[10000] bg-[#071525]/65 backdrop-blur-[8px]"/>
  <Dialog.Content data-project-dialog-content dir="rtl" {...(!description?{"aria-describedby":undefined}:{})} onEscapeKeyDown={e=>{if(busy)e.preventDefault();}} onPointerDownOutside={e=>{if(busy)e.preventDefault();}} className={`rl-dialog-panel ${hostingerStyle?"rl-hostinger-dialog-canvas":""} fixed left-1/2 top-1/2 z-[10001] flex max-h-[calc(100dvh-32px)] w-[calc(100%-24px)] ${maxWidth} -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden ${hostingerStyle?"rounded-[22px] border-[#e4e4e7] bg-[#f1f3f5] shadow-[0_24px_70px_-26px_rgba(32,33,36,.42)] dark:border-white/[.12] dark:bg-[#0b1b2a]":"rounded-[26px] border-slate-200 bg-white shadow-[0_36px_110px_-16px_rgba(0,0,0,.65)] dark:border-white/10 dark:bg-[#17263b]"} border text-slate-800 outline-none dark:text-slate-200 sm:w-[calc(100%-48px)]`}>
   <div className={`flex shrink-0 items-start gap-3 border-b ${hostingerStyle?"rl-hostinger-dialog-canvas":""} ${compact?"px-4 py-3 sm:px-5 sm:py-3.5":"px-5 py-5 sm:py-6 sm:px-6"} dark:border-white/10 ${hostingerStyle?"border-[#e4e4e7] bg-[#f1f3f5] dark:bg-[#0b1b2a]":"border-slate-100 bg-gradient-to-l from-blue-50/70 to-white dark:from-blue-500/10 dark:to-transparent"}`}>
    {!headerAccessory&&<span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] ${danger?"bg-red-50 text-red-500 dark:bg-red-500/15":"bg-blue-100/70 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"}`}>{danger?<TriangleAlert className="h-5 w-5"/>:<PanelsTopLeft className="h-5 w-5"/>}</span>}
    <div className="min-w-0 flex-1"><Dialog.Title className={`text-base font-bold leading-7 ${titleClassName}`}>{title}</Dialog.Title>{description&&<Dialog.Description className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">{description}</Dialog.Description>}{headerDetails}</div>
    {headerAccessory}
    <ProjectTooltip label="إغلاق النافذة"><ProjectButton variant="ghost" size="icon" disabled={busy} onClick={onClose} aria-label="إغلاق النافذة" className={`rounded-full ${hostingerStyle?"h-10 w-10 border border-[#e5e5e8] bg-[#f4f4f5] text-[#5f6268] shadow-[0_1px_3px_rgba(32,33,36,.08)] hover:bg-white hover:text-[#202124] dark:border-white/[.10] dark:bg-[#172b40] dark:text-slate-200 dark:hover:bg-[#29435d] dark:hover:text-white":"border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"}`}><X className={hostingerStyle?"h-[18px] w-[18px]":""} strokeWidth={hostingerStyle?2:undefined}/></ProjectButton></ProjectTooltip>
   </div>
   <div className={`min-h-0 overflow-y-auto overscroll-contain ${compact?"p-3 sm:p-4":"p-5 sm:p-6"} ${hostingerStyle?"rl-hostinger-dialog-canvas":""} ${hostingerStyle?"bg-[#f1f3f5] dark:bg-[#0b1b2a]":"bg-white dark:bg-[#17263b]"} ${bodyClassName}`}>{children}</div>
   {footer&&<div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-white/[.025] sm:px-6">{footer}</div>}
  </Dialog.Content>
 </Dialog.Portal></Dialog.Root>;
}
