"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import ProjectTooltip from "@/components/ui/project-tooltip";

const months=Array.from({length:12},(_,month)=>new Intl.DateTimeFormat("ar-u-ca-gregory",{month:"long",timeZone:"UTC"}).format(new Date(Date.UTC(2026,month,1))));
const weekdays=["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"];
function keyOf(date:Date){return date.toISOString().slice(0,10);}
function todayValue(){const date=new Date();return keyOf(new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())));}
function validDate(value:string){const date=new Date(value+"T00:00:00Z");return Number.isNaN(date.getTime())||keyOf(date)!==value?null:date;}

export default function ProjectDatePicker({value,onChange,min="2000-01-01",max="9998-12-31",label="اختيار التاريخ",className=""}:{value:string;onChange:(value:string)=>void;min?:string;max?:string;label?:string;className?:string}){
  const [open,setOpen]=useState(false),[mode,setMode]=useState<"days"|"months"|"years">("days");
  const [cursor,setCursor]=useState(()=>validDate(value)||validDate(todayValue())!);
  const [position,setPosition]=useState({top:0,left:0,width:300,maxHeight:420});
  const button=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
  const year=cursor.getUTCFullYear(),month=cursor.getUTCMonth();
  const minYear=Number(min.slice(0,4)),maxYear=Number(max.slice(0,4));
  const yearPage=Math.floor((year-minYear)/12)*12+minYear;
  const choose=(date:string)=>{if(date<min||date>max)return;onChange(date);setOpen(false);button.current?.focus();};
  useEffect(()=>{
    if(!open)return;
    const place=()=>{const bounds=button.current?.getBoundingClientRect();if(!bounds)return;const width=Math.min(310,window.innerWidth-16),height=Math.min(panel.current?.offsetHeight||420,420);const above=window.innerHeight-bounds.bottom<height+16&&bounds.top>height+16;const top=above?Math.max(8,bounds.top-height-8):Math.min(bounds.bottom+8,Math.max(8,window.innerHeight-height-8));setPosition({top,left:Math.max(8,Math.min(window.innerWidth-width-8,bounds.right-width)),width,maxHeight:Math.max(180,window.innerHeight-top-8)});};
    const close=(event:MouseEvent)=>{const target=event.target as Node;if(!button.current?.contains(target)&&!panel.current?.contains(target))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);button.current?.focus();}};
    place();document.addEventListener("mousedown",close);document.addEventListener("keydown",escape);window.addEventListener("resize",place);window.addEventListener("scroll",place,true);
    return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",escape);window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);};
  },[open,mode,year,month]);
  const move=(direction:number)=>{
    const next=mode==="days"?new Date(Date.UTC(year,month+direction,1)):new Date(Date.UTC(year+direction*(mode==="years"?12:1),month,1));
    if(next.getUTCFullYear()>=minYear&&next.getUTCFullYear()<=maxYear)setCursor(next);
  };
  const count=new Date(Date.UTC(year,month+1,0)).getUTCDate(),offset=new Date(Date.UTC(year,month,1)).getUTCDay();
  const selected=validDate(value),today=todayValue();
  const navClass="grid h-8 w-8 place-items-center rounded-[10px] border border-[#d7e3ef] text-[#0758e9] transition hover:bg-[#edf4fb] dark:border-white/10 dark:text-[#8fc0ff] dark:hover:bg-white/5";
  return <div className={className} dir="rtl">
    <button ref={button} type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setCursor(selected||validDate(today)!);setMode("days");setOpen(current=>!current);}} className={`flex h-11 w-full items-center gap-2 rounded-[14px] border bg-[#f9fbfe] px-3 text-sm font-semibold text-slate-700 transition dark:bg-[#202f40] dark:text-slate-100 ${open?"border-[#6faaf0] ring-4 ring-[#1480ff]/10":"border-[#d7e3ef] dark:border-white/10"}`}><CalendarDays className="h-4 w-4 shrink-0 text-[#0758e9]"/><span className="min-w-0 flex-1 truncate">{selected?new Intl.DateTimeFormat("ar-u-ca-gregory",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(selected):"اختر التاريخ"}</span><ChevronLeft className="h-4 w-4 text-slate-400"/></button>
    {open&&typeof document!=="undefined"&&createPortal(<div ref={panel} role="dialog" aria-label={label} dir="rtl" style={position} className="ui-state-enter fixed z-[9999] overflow-y-auto rounded-[18px] border border-[#c7d8e8] bg-[#fbfdff] p-3 text-slate-700 shadow-[0_18px_45px_rgba(44,65,92,.24)] dark:border-white/[.14] dark:bg-[#223448] dark:text-slate-200">
      <div className="mb-3 flex items-center justify-between gap-2">
        <ProjectTooltip label="الفترة السابقة"><button type="button" aria-label="الفترة السابقة" onClick={()=>move(-1)} className={navClass}><ChevronRight className="h-4 w-4"/></button></ProjectTooltip>
        <div className="flex items-center gap-1"><button type="button" onClick={()=>setMode(mode==="months"?"days":"months")} className="rounded-xl px-2 py-1 text-xs font-semibold hover:bg-[#edf4fb] dark:hover:bg-white/5">{months[month]}</button><button type="button" onClick={()=>setMode(mode==="years"?"days":"years")} className="rounded-xl px-2 py-1 text-xs font-semibold hover:bg-[#edf4fb] dark:hover:bg-white/5">{year}</button></div>
        <ProjectTooltip label="الفترة التالية"><button type="button" aria-label="الفترة التالية" onClick={()=>move(1)} className={navClass}><ChevronLeft className="h-4 w-4"/></button></ProjectTooltip>
      </div>
      {mode==="days"?<><div className="mb-1 grid grid-cols-7 text-center text-[9px] text-slate-400">{weekdays.map(day=><span key={day}>{day}</span>)}</div><div className="grid grid-cols-7 gap-1">{Array.from({length:offset},(_,index)=><span key={`empty-${index}`}/>)}{Array.from({length:count},(_,index)=>{const date=keyOf(new Date(Date.UTC(year,month,index+1))),active=date===value;return <button key={date} type="button" disabled={date<min||date>max} aria-label={date} aria-pressed={active} onClick={()=>choose(date)} className={`h-9 rounded-[10px] text-xs transition disabled:opacity-25 ${active?"bg-[#0758e9] font-bold text-white":date===today?"border border-[#8bb9f0] text-[#0758e9] dark:text-[#8fc0ff]":"hover:bg-[#edf4fb] hover:text-[#0758e9] dark:hover:bg-white/5 dark:hover:text-[#8fc0ff]"}`}>{index+1}</button>;})}</div></>:mode==="months"?<div className="grid grid-cols-3 gap-2">{months.map((name,index)=><button key={name} type="button" onClick={()=>{setCursor(new Date(Date.UTC(year,index,1)));setMode("days");}} className={`h-10 rounded-xl text-xs hover:bg-[#edf4fb] dark:hover:bg-white/5 ${index===month?"bg-[#edf4fb] text-[#0758e9] dark:bg-blue-500/15 dark:text-[#8fc0ff]":""}`}>{name}</button>)}</div>:<div className="grid grid-cols-3 gap-2">{Array.from({length:12},(_,index)=>yearPage+index).filter(value=>value<=maxYear).map(value=><button key={value} type="button" onClick={()=>{setCursor(new Date(Date.UTC(value,month,1)));setMode("months");}} className={`h-10 rounded-xl text-xs hover:bg-[#edf4fb] dark:hover:bg-white/5 ${value===year?"bg-[#edf4fb] text-[#0758e9] dark:bg-blue-500/15 dark:text-[#8fc0ff]":""}`}>{value}</button>)}</div>}
      <div className="mt-3 flex items-center justify-between border-t border-[#dce6f0] pt-2 dark:border-white/10"><button type="button" onClick={()=>choose(today)} className="rounded-xl px-3 py-1.5 text-xs font-semibold text-[#0758e9] hover:bg-[#edf4fb] dark:text-[#8fc0ff] dark:hover:bg-white/5">اليوم</button><button type="button" onClick={()=>{setOpen(false);button.current?.focus();}} className="rounded-xl px-3 py-1.5 text-xs text-slate-500 dark:text-slate-300">إغلاق</button></div>
    </div>,document.body)}
  </div>;
}
