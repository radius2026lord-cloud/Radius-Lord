"use client";

import { Check } from "lucide-react";
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
