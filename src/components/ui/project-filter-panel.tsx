"use client";
const filterGroupIconTone={
 activation:"bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200",
 connection:"bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-200",
 subscription:"bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200",
 category:"bg-violet-50 text-violet-700 dark:bg-violet-400/10 dark:text-violet-200",
 server:"bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200",
 identity:"bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200",
} as const;
export function ProjectFilterGroup({icon:Icon,title,children,tone}:{icon:any;title:string;children:any;tone:"activation"|"connection"|"subscription"|"category"|"server"|"identity"}){
 return <div className="flex h-full min-w-0 flex-col gap-2.5 rounded-2xl border border-[#e3e6ea] bg-white p-3 transition-colors hover:border-[#cfd6dd] dark:border-white/10 dark:bg-[#10243a] dark:hover:border-white/20"><h4 className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-[#17386d] dark:text-slate-100"><Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${filterGroupIconTone[tone].split(/\s+/).filter(token=>/^(dark:)?text-/.test(token)).join(" ")}`}/><span>{title}</span></h4><div className="mt-auto min-w-0">{children}</div></div>;
}
export function ProjectFilterChoices({value,onChange,items}:{value:string;onChange:(value:any)=>void;items:Array<{value:string;label:string;icon:any;accent:string}>}){
 return <div className="grid min-w-0 grid-cols-3 gap-1">{items.map(item=>{const active=value===item.value;const Icon=item.icon;return <button key={item.value} type="button" aria-pressed={active} onClick={()=>onChange(item.value)} className={`flex min-h-9 min-w-0 items-center justify-center gap-1 rounded-xl border px-1.5 py-1.5 text-[10px] font-semibold transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${active?"border-[#8db9ed] bg-[#edf5ff] text-[#0758e9] shadow-[0_2px_7px_rgba(20,121,255,.12)] dark:border-blue-300/20 dark:bg-blue-500/[.12] dark:text-blue-100":"border-[#e3eaf2] bg-[#f6f8fb] text-slate-600 hover:border-[#cbd9e8] hover:bg-white dark:border-white/[.08] dark:bg-white/[.035] dark:text-slate-300 dark:hover:bg-white/[.07]"}`}><Icon className={`h-3.5 w-3.5 shrink-0 ${active?"text-blue-600":item.accent}`}/><span className="whitespace-normal break-words leading-4">{item.label}</span></button>})}</div>;
}
