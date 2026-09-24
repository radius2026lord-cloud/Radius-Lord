"use client";

import { Check, Search } from "lucide-react";
import CollectionViewToggle,{type CollectionViewMode} from "@/components/ui/collection-view-toggle";
import { useCollectionState } from "@/components/ui/use-collection-state";

export function useCollectionDisplay<T extends string|number>(key:string,defaultView:CollectionViewMode="row"){return useCollectionState<T>(key,defaultView)}

export function CollectionDisplayControls({view,onViewChange,selectionMode,onSelectionModeChange,allSelected,onToggleAll}:{view:CollectionViewMode;onViewChange:(v:CollectionViewMode)=>void;selectionMode:boolean;onSelectionModeChange:(v:boolean)=>void;allSelected?:boolean;onToggleAll?:()=>void}){
 return <div className="flex shrink-0 items-center gap-1.5" dir="rtl">
  <CollectionViewToggle value={view} onChange={onViewChange}/>
  {view==="grid"&&<>
   {selectionMode&&onToggleAll&&<button type="button" onClick={onToggleAll} className={`h-11 whitespace-nowrap rounded-[16px] border px-3 text-xs font-semibold transition-all duration-300 ${allSelected?"border-[#8bb9f0] bg-[#e9f2ff] text-[#0758e9] dark:border-white/20 dark:bg-white/[.07] dark:text-[#e3dfe6]":"border-[#d7e3ef] bg-white text-[#17386d] hover:border-[#9fc4ec] hover:bg-[#edf4fb] dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#d6d1d9]"}`}>{allSelected?"إلغاء تحديد الكل":"تحديد الكل"}</button>}
   <button type="button" onClick={()=>onSelectionModeChange(!selectionMode)} className={`h-11 whitespace-nowrap rounded-[16px] border px-3 text-xs font-semibold transition-all duration-300 ${selectionMode?"border-[#8bb9f0] bg-[#e9f2ff] text-[#0758e9] dark:border-white/20 dark:bg-white/[.07] dark:text-[#e3dfe6]":"border-[#d7e3ef] bg-white text-[#17386d] hover:border-[#9fc4ec] hover:bg-[#edf4fb] dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#d6d1d9] dark:hover:bg-white/[.07]"}`}>{selectionMode?"إلغاء التحديد":"تحديد"}</button>
  </>}
 </div>
}

export function CollectionSelectionBox({checked,label,onChange}:{checked:boolean;label:string;onChange:()=>void}){return <label className="inline-grid cursor-pointer place-items-center" onClick={e=>e.stopPropagation()}><input type="checkbox" checked={checked} onChange={onChange} aria-label={label} className="peer sr-only"/><span className="grid h-[19px] w-[19px] place-items-center rounded-[6px] border-2 border-[#9bb4cf] bg-white text-white shadow-sm transition-all duration-200 peer-checked:scale-105 peer-checked:border-[#0758e9] peer-checked:bg-[#0758e9] peer-checked:shadow-[0_4px_10px_rgba(7,88,233,.28)] dark:border-white/30 dark:bg-[#38363c] dark:peer-checked:border-[#4c8dff] dark:peer-checked:bg-[#4c8dff]"><Check className={`h-3.5 w-3.5 transition-all duration-200 ${checked?"scale-100 opacity-100":"scale-50 opacity-0"}`} strokeWidth={3}/></span></label>}

export function CollectionGridSelectionMark({checked}:{checked:boolean}){return <span aria-hidden="true" className={`grid h-7 w-7 place-items-center rounded-[9px] border transition-all duration-250 ${checked?"border-[#0758e9] bg-[#0758e9] text-white shadow-[0_4px_10px_rgba(7,88,233,.22)]":"border-[#b8cadc] bg-[#f8fbfe] text-transparent dark:border-white/25 dark:bg-[#38363c]"}`}><Check className="h-4 w-4" strokeWidth={3}/></span>}

export function CollectionSelectionBar({count,noun="عنصر",onClear,children}:{count:number;noun?:string;onClear:()=>void;children?:React.ReactNode}){if(count<1)return null;return <section className="flex flex-col gap-2 rl-surface rounded-[18px] bg-[#f4f8fd] p-2.5 shadow-[0_8px_22px_rgba(58,84,112,.08)] animate-slideDown dark:border-white/[.12] dark:bg-white/[.045] sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-xs font-semibold text-[#17386d] dark:text-[#d8d2dc]"><span className="grid h-7 min-w-7 place-items-center rounded-full bg-[#0758e9] px-2 text-white">{count}</span><span>تم تحديد {count} من {noun}</span><button type="button" onClick={onClear} className="mr-1 rounded-[10px] border border-[#bfd4ea] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#0758e9] transition hover:bg-[#e9f2ff] dark:border-white/[.12] dark:bg-[#38363c] dark:text-[#d8d2dc] dark:hover:bg-white/[.08]">إلغاء التحديد</button></div>{children}</section>}


export function CollectionGrid({children,className=""}:{children:React.ReactNode;className?:string}){return <section className={`ui-state-enter grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 ${className}`}>{children}</section>}

export function collectionCardClass(selected=false){
 return `group relative min-w-0 cursor-pointer rounded-[22px] border p-4 shadow-[0_8px_22px_rgba(58,84,112,.08)] transition-[transform,box-shadow,border-color,background-color] duration-300 ease-[cubic-bezier(.22,.8,.25,1)] hover:-translate-y-1 hover:scale-[1.018] hover:shadow-[0_16px_34px_rgba(58,84,112,.16)] dark:hover:shadow-[0_18px_38px_rgba(0,0,0,.22)] ${selected?"border-[#6aaeff] ring-2 ring-[#1479ff]/15 dark:border-[#4c8dff]":"border-[#8da9c4] hover:border-[#78afe9] dark:border-white/[.12] dark:hover:border-white/[.20]"}`;
}


export function CollectionToolbar({icon:Icon,title,description,view,onViewChange,selectionMode,onSelectionModeChange,allSelected,onToggleAll,query,onQueryChange,searchPlaceholder="بحث...",filters,primaryAction}:{icon:any;title:string;description:string;view:CollectionViewMode;onViewChange:(v:CollectionViewMode)=>void;selectionMode:boolean;onSelectionModeChange:(v:boolean)=>void;allSelected?:boolean;onToggleAll?:()=>void;query:string;onQueryChange:(v:string)=>void;searchPlaceholder?:string;filters?:React.ReactNode;primaryAction?:React.ReactNode}){
 return <section className="rl-surface rounded-[22px] bg-white p-3 shadow-[0_8px_22px_rgba(58,84,112,.08)] dark:border-white/[.07] dark:bg-[#0d243b] sm:p-4">
  <div className="flex flex-col gap-3 xl:flex-row xl:items-center" dir="rtl">
   <div className="min-w-0 shrink-0 text-right xl:w-[270px]"><h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-[#ece8ee] sm:text-lg"><Icon className="h-5 w-5 text-[#0758e9]"/>{title}</h2><p className="mt-1 text-xs font-normal text-slate-500 dark:text-[#9f98a5]">{description}</p></div>
   <div className="flex min-w-0 flex-1 items-center overflow-x-auto xl:justify-center">{filters}</div>
   <div className="flex min-w-0 shrink-0 items-center gap-2 xl:w-[clamp(340px,29vw,490px)]" dir="ltr">
    {primaryAction&&<div className="shrink-0">{primaryAction}</div>}
    <CollectionDisplayControls view={view} onViewChange={onViewChange} selectionMode={selectionMode} onSelectionModeChange={onSelectionModeChange} allSelected={allSelected} onToggleAll={onToggleAll}/>
    <div className="relative min-w-[150px] flex-1" dir="rtl"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>onQueryChange(e.target.value)} placeholder={searchPlaceholder} className="h-11 w-full rounded-[16px] border border-[#d7e3ef] bg-[#f9fbfe] pr-10 pl-3 text-sm font-normal text-slate-700 outline-none focus:border-[#6aaeff] focus:ring-4 focus:ring-[#1480ff]/10 dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#e3dfe6]"/></div>
   </div>
  </div>
 </section>
}


export function CollectionStatusFilters<T extends string>({value,onChange,items}:{value:T;onChange:(value:T)=>void;items:Array<{value:T;label:string;count:number;dot:string}>}){
 return <div className="inline-flex shrink-0 items-center rl-surface-soft rounded-[16px] bg-[#f7faff] p-1 shadow-[0_4px_14px_rgba(58,84,112,.06)] dark:border-white/[.08] dark:bg-white/[.035]">{items.map(item=>{const active=value===item.value;return <button key={item.value} type="button" onClick={()=>onChange(item.value)} aria-pressed={active} className={`flex h-9 shrink-0 items-center gap-2 rounded-[12px] border px-3 text-xs font-medium transition-all duration-250 ${active?"border-[#9fc4ec] bg-white text-[#0758e9] shadow-[0_3px_10px_rgba(20,121,255,.10)] dark:border-white/[.14] dark:bg-white/[.08] dark:text-[#ddd7e1]":"border-transparent text-slate-500 hover:bg-white/80 hover:text-[#17386d] dark:text-[#aaa4af] dark:hover:bg-white/[.05] dark:hover:text-[#d6d0da]"}`}><span className={`h-2 w-2 rounded-full ${item.dot}`}/><span>{item.label}</span><span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-medium ${active?"bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.08] dark:text-[#d8d2dc]":"bg-[#edf2f7] text-slate-500 dark:bg-white/[.05] dark:text-[#96909b]"}`}>{item.count}</span></button>})}</div>
}
