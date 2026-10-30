"use client";

import {useEffect,useId,useRef,useState} from "react";
import {CalendarDays} from "lucide-react";
import ProjectInput from "@/components/ui/project-input";
import ProjectButton from "@/components/ui/project-button";
import ProjectDialog from "@/components/ui/project-dialog";
import ProjectDropdown from "@/components/ui/project-dropdown";
import ProjectDatePicker from "@/components/ui/project-date-picker";
import ProjectTooltip from "@/components/ui/project-tooltip";
import ProjectFieldNotice from "@/components/ui/project-field-notice";
import {useClock24h} from "@/components/ui/project-clock-provider";

type Mode="datetime"|"time";
const pad=(value:number)=>String(value).padStart(2,"0");
const digits=(value:string)=>value.replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776));
function validDay(year:number,month:number,day:number){return year>=1900&&year<=9998&&month>=1&&month<=12&&day>=1&&day<=new Date(Date.UTC(year,month,0)).getUTCDate();}

// These are wall-clock strings. Never apply the browser's timezone or change
// the API's ISO/24-hour value merely because a user changes display format.
export function formatLocalDateTime(value:string,clock24h:boolean,mode:Mode="datetime"){
 const match=(mode==="datetime"?/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/:/^(\d{2}):(\d{2})(?::\d{2})?$/).exec(value);
 if(!match)return "";
 const hour=Number(match[mode==="datetime"?4:1]),minute=match[mode==="datetime"?5:2];
 return (mode==="datetime"?`${match[3]}/${match[2]}/${match[1]} `:"")+`${pad(clock24h?hour:hour%12||12)}:${minute}`+(clock24h?"":hour<12?" ص":" م");
}
export function parseLocalDateTime(value:string,clock24h:boolean,mode:Mode="datetime"){
 const text=digits(value).trim(),datePattern=mode==="datetime"?"(\\d{2})/(\\d{2})/(\\d{4})\\s+":"";
 const match=new RegExp("^"+datePattern+"(\\d{1,2}):(\\d{2})"+(clock24h?"":"\\s*(ص|م|am|pm)")+"$","i").exec(text);
 if(!match)return null;
 const offset=mode==="datetime"?3:0;let hour=Number(match[offset+1]);const minute=Number(match[offset+2]);
 if(minute>59||hour<(clock24h?0:1)||hour>(clock24h?23:12))return null;
 if(!clock24h)hour=hour%12+(/^(م|pm)$/i.test(match[offset+3])?12:0);
 if(mode==="time")return `${pad(hour)}:${pad(minute)}`;
 const [,day,month,year]=match;if(!validDay(Number(year),Number(month),Number(day)))return null;
 return `${year}-${month}-${day}T${pad(hour)}:${pad(minute)}`;
}
function localNow(timeZone?:string){
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{...(timeZone?{timeZone}:{}),year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export default function ProjectDateTimeInput({value,onChange,mode="datetime",timeZone,disabled=false,required=false,id,className="",invalid=false,onValidityChange}:{value:string;onChange:(value:string)=>void;mode?:Mode;timeZone?:string;disabled?:boolean;required?:boolean;id?:string;className?:string;invalid?:boolean;onValidityChange?:(valid:boolean)=>void}){
 const clock24h=useClock24h(),generatedId=useId(),input=useRef<HTMLInputElement>(null);
 const fieldId=id||generatedId,lastEmitted=useRef(value),lastClock=useRef(clock24h);
 const [text,setText]=useState(()=>formatLocalDateTime(value,clock24h,mode)),[error,setError]=useState(""),[open,setOpen]=useState(false),[picker,setPicker]=useState("");
 const hint=mode==="datetime"?`يوم/شهر/سنة — ساعة:دقيقة${clock24h?" (24 ساعة)":" ص/م"}`:`ساعة:دقيقة${clock24h?" (24 ساعة)":" ص/م"}`;
 useEffect(()=>{
  if(value!==lastEmitted.current||clock24h!==lastClock.current){setText(formatLocalDateTime(value,clock24h,mode));setError("");lastEmitted.current=value;lastClock.current=clock24h;}
 },[value,clock24h,mode]);
 const parsed=parseLocalDateTime(text,clock24h,mode),valid=Boolean(parsed)||!text&&!required;
 useEffect(()=>{input.current?.setCustomValidity(valid?"":"أكمل التاريخ والوقت بالصيغة الموضحة.");onValidityChange?.(valid);},[valid,onValidityChange]);
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 const change=(next:string)=>{setText(next);setError("");const iso=parseLocalDateTime(next,clock24h,mode)||"";lastEmitted.current=iso;onChange(iso);};
 const select=(iso:string)=>{lastEmitted.current=iso;onChange(iso);setText(formatLocalDateTime(iso,clock24h,mode));setError("");setOpen(false);input.current?.focus();};
 const hour=Number(picker.slice(11,13))||0,minute=picker.slice(14,16)||"00",today=open?localNow(timeZone).slice(0,10):"";
 const setHour=(next:number)=>setPicker(old=>old.slice(0,11)+pad(next)+old.slice(13));
 return <>
  <div className="min-w-0 space-y-1.5">
   <div className="flex min-w-0 items-center gap-2">
    <ProjectInput ref={input} id={fieldId} type="text" dir="ltr" autoComplete="off" value={text} required={required} disabled={disabled} maxLength={mode==="datetime"?19:8} placeholder={mode==="datetime"?(clock24h?"DD/MM/YYYY HH:mm":"DD/MM/YYYY hh:mm ص/م"):(clock24h?"HH:mm":"hh:mm ص/م")} aria-invalid={invalid||Boolean(error)} aria-describedby={`${fieldId}-format${error?` ${fieldId}-error`:""}`} onChange={event=>change(digits(event.target.value))} onBlur={()=>{if(text&&!parsed)setError("أكمل الموعد بالصيغة الموضحة.");}} className={`min-w-0 flex-1 ${className}`}/>
    {mode==="datetime"&&<ProjectTooltip label="اختيار التاريخ والوقت"><ProjectButton variant="secondary" size="icon" disabled={disabled} aria-label="اختيار التاريخ والوقت" onClick={event=>{event.preventDefault();setPicker(parsed||localNow(timeZone));setOpen(true);}}><CalendarDays className="h-4 w-4"/></ProjectButton></ProjectTooltip>}
   </div>
   <p id={`${fieldId}-format`} className="text-[11px] font-normal text-slate-500 dark:text-slate-300">{hint}</p>
   {error&&<ProjectFieldNotice id={`${fieldId}-error`}>{error}</ProjectFieldNotice>}
  </div>
  {open&&<ProjectDialog title="التاريخ والوقت" open maxWidth="max-w-sm" compact onClose={()=>setOpen(false)} description={timeZone?`بتوقيت ${timeZone}`:undefined} footer={<><ProjectButton variant="secondary" onClick={()=>setOpen(false)}>إلغاء</ProjectButton><ProjectButton onClick={()=>select(picker)}>اعتماد الموعد</ProjectButton></>}>
   <ProjectDatePicker inline value={picker.slice(0,10)} today={today} min="1900-01-01" onChange={date=>setPicker(old=>date+old.slice(10))}/>
   <div className={`mt-3 grid gap-2 ${clock24h?"grid-cols-2":"grid-cols-3"}`}>
    <div><p className="mb-1 text-[11px]">الساعة</p><ProjectDropdown fieldStyle value={String(clock24h?hour:hour%12||12)} onChange={value=>setHour(clock24h?Number(value):Number(value)%12+(hour>=12?12:0))} options={Array.from({length:clock24h?24:12},(_,i)=>({value:String(clock24h?i:i+1),label:pad(clock24h?i:i+1)}))}/></div>
    <div><p className="mb-1 text-[11px]">الدقيقة</p><ProjectDropdown fieldStyle value={minute} onChange={value=>setPicker(old=>old.slice(0,14)+value)} options={Array.from({length:60},(_,i)=>({value:pad(i),label:pad(i)}))}/></div>
    {!clock24h&&<div><p className="mb-1 text-[11px]">الفترة</p><ProjectDropdown fieldStyle value={hour>=12?"pm":"am"} onChange={value=>setHour(hour%12+(value==="pm"?12:0))} options={[{value:"am",label:"صباحًا"},{value:"pm",label:"مساءً"}]}/></div>}
   </div>
  </ProjectDialog>}
 </>;
}
