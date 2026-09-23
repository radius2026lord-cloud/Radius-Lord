"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ChevronDown, ChevronUp, Clock3, FileClock, Search, ShieldCheck, UserRound } from "lucide-react";
import CollectionViewToggle, { CollectionViewMode } from "@/components/ui/collection-view-toggle";

type AuditLog = {
  id:number; adminId:number|null; adminName:string|null; adminUsername:string|null;
  actionCode:string; actionName:string; entityTypeCode:string; entityTypeName:string;
  entityId:number|null; entityName:string|null; description:string|null; ipAddress:string|null;
  userAgent:string|null; metadata:any; createdAt:string;
};
const actionTone:Record<string,string>={
  CREATE:"bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  UPDATE:"bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30",
  DELETE:"bg-red-100 text-red-700 ring-1 ring-inset ring-red-300 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30",
  SUSPEND:"bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  LOGIN:"bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-300 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30",
  LOGOUT:"bg-slate-200 text-slate-600 ring-1 ring-inset ring-slate-300 dark:bg-white/[.08] dark:text-slate-300 dark:ring-white/[.12]",
};
const filterTone:Record<string,string>={
  ALL:"bg-white text-[#0758e9] ring-1 ring-inset ring-[#b8d3f0] shadow-sm dark:bg-white/[.08] dark:text-[#9fc2ff] dark:ring-white/[.12]",
  CREATE:"bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-300 shadow-sm dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  UPDATE:"bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-300 shadow-sm dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30",
  DELETE:"bg-red-100 text-red-700 ring-1 ring-inset ring-red-300 shadow-sm dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30",
  LOGIN:"bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-300 shadow-sm dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30",
  LOGOUT:"bg-slate-200 text-slate-600 ring-1 ring-inset ring-slate-300 shadow-sm dark:bg-white/[.08] dark:text-slate-300 dark:ring-white/[.12]",
};
const fieldLabel:Record<string,string>={full_name:"الاسم الكامل",username:"اسم المستخدم",email:"البريد الإلكتروني",phone:"رقم الهاتف",country:"الدولة"};

export default function AdminActivityPage(){
  const [logs,setLogs]=useState<AuditLog[]>([]); const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState(""); const [filter,setFilter]=useState("ALL");
  const [view,setView]=useState<CollectionViewMode>("row"); const [open,setOpen]=useState<number|null>(null);
  useEffect(()=>{fetch("/api/admin/audit-logs",{credentials:"include",cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error();return r.json()}).then(d=>setLogs(d.logs??[])).finally(()=>setLoading(false))},[]);
  const filtered=useMemo(()=>logs.filter(log=>{
    if(filter!=="ALL"&&log.actionCode!==filter)return false;
    const q=query.trim().toLowerCase(); if(!q)return true;
    return [log.adminName,log.adminUsername,log.entityName,log.description,log.actionName,log.entityTypeName,String(log.entityId??"")].filter(Boolean).some(v=>String(v).toLowerCase().includes(q));
  }),[logs,query,filter]);
  const today=new Date().toDateString();
  const todayLogs=logs.filter(l=>new Date(l.createdAt).toDateString()===today);
  const summary=[["أحداث اليوم",todayLogs.length],["تعديلات اليوم",todayLogs.filter(l=>l.actionCode==="UPDATE").length],["عمليات الإضافة",logs.filter(l=>l.actionCode==="CREATE").length],["إجمالي السجل",logs.length]];
  return <div className="space-y-3 sm:space-y-4">
    <section className="rl-surface rounded-[22px] bg-white p-3 dark:bg-[#0d243b] sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center" dir="rtl">
        <div className="min-w-0 xl:w-[260px]"><h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-[#ece8ee]"><ShieldCheck className="h-5 w-5 text-[#0758e9]"/>نشاط الإدارة</h2><p className="mt-1 text-xs text-slate-500">سجل العمليات الإدارية في Radius Lord</p></div>
        <div className="flex min-w-0 flex-1 items-center overflow-x-auto xl:justify-center"><div className="rl-surface-soft inline-flex shrink-0 rounded-[16px] bg-[#f7faff] p-1 dark:bg-white/[.035]">{["ALL","CREATE","UPDATE","DELETE","LOGIN","LOGOUT"].map(v=><button key={v} onClick={()=>setFilter(v)} className={`h-9 rounded-[12px] px-3 text-xs font-medium transition ${filter===v?filterTone[v]:"text-slate-500 hover:bg-white/70 dark:text-slate-400 dark:hover:bg-white/[.05]"}`}>{v==="ALL"?"الكل":v==="CREATE"?"إضافة":v==="UPDATE"?"تعديل":v==="DELETE"?"حذف":v==="LOGIN"?"دخول":"خروج"}</button>)}</div></div>
        <div className="flex min-w-0 items-center gap-2 xl:w-[390px]" dir="ltr"><CollectionViewToggle value={view} onChange={setView}/><div className="relative flex-1" dir="rtl"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="بحث في السجل..." className="h-11 w-full rounded-[16px] border border-[#b5cbe0] bg-[#f9fbfe] pr-10 pl-3 text-sm outline-none focus:border-[#6aaeff] dark:border-white/[.12] dark:bg-[#38363c]"/></div></div>
      </div>
    </section>
    <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">{summary.map(([label,value])=><div key={String(label)} className="rl-surface-soft rounded-[18px] bg-white p-3 dark:bg-[#0d243b]"><div className="text-[11px] text-slate-400">{label}</div><div className="mt-1 text-xl font-semibold text-[#17386d] dark:text-slate-200">{value}</div></div>)}</section>
    {loading?<State>جارٍ تحميل سجل النشاط...</State>:filtered.length===0?<State>لا توجد سجلات مطابقة.</State>:view==="grid"?
      <section className="ui-state-enter grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(log=><LogCard key={log.id} log={log} open={open===log.id} onToggle={()=>setOpen(open===log.id?null:log.id)}/>)}</section>:
      <section className="ui-state-enter space-y-2">{filtered.map(log=><LogCard key={log.id} log={log} open={open===log.id} onToggle={()=>setOpen(open===log.id?null:log.id)} row/>)}</section>}
  </div>
}
function LogCard({log,open,onToggle,row=false}:{log:AuditLog;open:boolean;onToggle:()=>void;row?:boolean}){
  const changes=log.metadata?.changes??{}; return <article className="rl-surface rounded-[20px] bg-white dark:bg-[#0d243b]">
    <button type="button" onClick={onToggle} className={`flex w-full gap-3 p-3 text-right sm:p-4 ${row?"items-center":"flex-col"}`} dir="rtl">
      <span className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${actionTone[log.actionCode]??actionTone.LOGOUT}`}>{log.actionName}</span>
      <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{log.entityName||log.description||`${log.entityTypeName} #${log.entityId??"—"}`}</div><div className="mt-1 text-[11px] text-slate-400">بواسطة {log.adminName||log.adminUsername||"النظام"} · {formatDate(log.createdAt)}</div></div>
      {open?<ChevronUp className="h-4 w-4 text-slate-400"/>:<ChevronDown className="h-4 w-4 text-slate-400"/>}
    </button>
    {open&&<div className="ui-state-enter border-t border-[#c4d3e2] p-4 dark:border-white/[.13]" dir="rtl">
      <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4"><Info label="المنفذ" value={log.adminName||log.adminUsername||"—"}/><Info label="العنصر" value={`${log.entityTypeName} #${log.entityId??"—"}`}/><Info label="التاريخ والوقت" value={formatDate(log.createdAt)}/><Info label="IP" value={log.ipAddress||"—"} ltr/></div>
      {Object.keys(changes).length>0&&<div className="mt-4"><div className="mb-2 text-xs font-semibold text-[#17386d] dark:text-slate-200">التغييرات</div><div className="space-y-2">{Object.entries(changes).map(([field,v]:any)=><div key={field} className="rl-surface-soft rounded-[14px] bg-[#f9fbfe] p-3 dark:bg-white/[.035]"><div className="text-[11px] text-slate-400">{fieldLabel[field]||field}</div><div className="mt-2 grid gap-2 sm:grid-cols-2"><Info label="قبل" value={String(v.before??"—")}/><Info label="بعد" value={String(v.after??"—")}/></div></div>)}</div></div>}
    </div>}
  </article>
}
function Info({label,value,ltr=false}:{label:string;value:string;ltr?:boolean}){return <div><div className="text-[10px] text-slate-400">{label}</div><div className="allow-text-selection mt-1 truncate text-xs font-medium text-slate-600 dark:text-slate-300" dir={ltr?"ltr":"rtl"}>{value}</div></div>}
function State({children}:{children:React.ReactNode}){return <div className="rl-surface rounded-[22px] bg-white p-8 text-center text-sm text-slate-500 dark:bg-[#0d243b]">{children}</div>}
function formatDate(value:string){return new Intl.DateTimeFormat("ar",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(value))}
