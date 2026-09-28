"use client";

import BulkActionsDropdown, { type BulkActionHandlers, type BulkActionVisibility } from "@/components/ui/bulk-actions-dropdown";

export default function BulkSelectionBar({
 count,
 noun="عنصر",
 allSelected,
 onToggleAll,
 onClearSelection,
 show={},
 handlers={},
}:{
 count:number;
 noun?:string;
 allSelected:boolean;
 onToggleAll:()=>void;
 onClearSelection:()=>void;
 show?:BulkActionVisibility;
 handlers?:BulkActionHandlers;
}){
 if(count<1)return null;
 return <section className="flex items-center justify-between gap-2 rl-surface rounded-[18px] bg-[#f4f8fd] p-2.5 shadow-[0_8px_22px_rgba(58,84,112,.08)] animate-slideDown dark:border-white/[.12] dark:bg-white/[.045]" dir="rtl">
  <div className="flex items-center gap-2 text-xs font-semibold text-[#17386d] dark:text-[#d8d2dc]">
   <span className="grid h-7 min-w-7 place-items-center rounded-full bg-[#0758e9] px-2 text-white">{count}</span>
   <span>تم تحديد {count} من {noun}</span>
  </div>
  <BulkActionsDropdown allSelected={allSelected} onToggleAll={onToggleAll} onClearSelection={onClearSelection} show={show} handlers={handlers}/>
 </section>;
}
