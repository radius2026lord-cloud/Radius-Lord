"use client";

import {useEffect,useId,useRef,useState} from "react";
import {CalendarDays,Clock3,X} from "lucide-react";
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
 const clock24h=useClock24h(),generatedId=useId(),input=useRef<HTMLInputElement|null>(null),sectionInputs=useRef<(HTMLInputElement|null)[]>([]);
 const [period,setPeriod]=useState<"am"|"pm">(()=>Number((mode==="time"?value:value.slice(11)).slice(0,2))>=12?"pm":"am");
 const fieldId=id||generatedId,lastEmitted=useRef(value),lastClock=useRef(clock24h);
 const [text,setText]=useState(()=>formatLocalDateTime(value,clock24h,mode)),[error,setError]=useState(""),[open,setOpen]=useState(false),[picker,setPicker]=useState("");
 const hint=mode==="datetime"?`يوم/شهر/سنة — ساعة:دقيقة${clock24h?" (24 ساعة)":" ص/م"}`:`ساعة:دقيقة${clock24h?" (24 ساعة)":" ص/م"}`;
 useEffect(()=>{
  if(value!==lastEmitted.current||clock24h!==lastClock.current){setText(formatLocalDateTime(value,clock24h,mode));setPeriod(Number((mode==="time"?value:value.slice(11)).slice(0,2))>=12?"pm":"am");setError("");lastEmitted.current=value;lastClock.current=clock24h;}
 },[value,clock24h,mode]);
 const parsed=parseLocalDateTime(text,clock24h,mode),valid=Boolean(parsed)||!text&&!required;
 useEffect(()=>{input.current?.setCustomValidity(valid?"":"أكمل التاريخ والوقت بالصيغة الموضحة.");onValidityChange?.(valid);},[valid,onValidityChange]);
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 const change=(next:string)=>{setText(next);setError("");const iso=parseLocalDateTime(next,clock24h,mode)||"";lastEmitted.current=iso;onChange(iso);};
 const select=(iso:string)=>{setPeriod(Number((mode==="time"?iso:iso.slice(11)).slice(0,2))>=12?"pm":"am");lastEmitted.current=iso;onChange(iso);setText(formatLocalDateTime(iso,clock24h,mode));setError("");setOpen(false);input.current?.focus();};
 // Each numeric section is editable; separators are ordinary text nodes.
 const dateText=mode==="datetime"?text.split(" ")[0]||"":"",timeText=mode==="datetime"?text.split(" ")[1]||"":text.split(" ")[0]||"";
 const [day="",month="",year=""]=dateText.split("/"),[hours="",minutes=""]=timeText.split(":");
 const sections=mode==="datetime"?[day,month,year,hours,minutes]:[hours,minutes];
 const lengths=mode==="datetime"?[2,2,4,2,2]:[2,2];
 const compose=(values:string[],nextPeriod=period)=>{
  if(values.every(value=>!value))return "";
  const date=mode==="datetime"?`${values[0]}/${values[1]}/${values[2]} `:"",offset=mode==="datetime"?3:0;
  return date+`${values[offset]}:${values[offset+1]}`+(clock24h?"":nextPeriod==="pm"?" م":" ص");
 };
 const maxDay=(m:string,y:string)=>{const monthNumber=Number(m);if(monthNumber<1||monthNumber>12)return 31;return new Date(Date.UTC(y.length===4?Number(y):2025,monthNumber,0)).getUTCDate();};
 const dayLimit=mode==="datetime"?maxDay(month,year):31;
 const setSection=(index:number,value:string)=>{
  const values=[...sections],next=digits(value).replace(/\D/g,"").slice(0,lengths[index]),isYear=mode==="datetime"&&index===2;
  const upper=mode==="datetime"&&index===0?dayLimit:mode==="datetime"&&index===1?12:index===sections.length-1?59:clock24h?23:12;
  if(next&&(isYear?next.length===4&&(Number(next)<1900||Number(next)>9998):Number(next)>upper||next.length===2&&Number(next)<(mode==="datetime"&&index<2||!clock24h&&index===sections.length-2?1:0))){setError(isYear?"السنة من 1900 إلى 9998.":mode==="datetime"&&index===1?"الشهر من 01 إلى 12.":mode==="datetime"&&index===0?`هذا الشهر يقبل الأيام من 01 إلى ${dayLimit}.`:`الحد الأعلى لهذه الخانة ${upper}.`);return false;}
  values[index]=next;
  const clearDay=mode==="datetime"&&(index===1||index===2&&next.length===4)&&Number(values[0])>maxDay(values[1],values[2]);
  if(clearDay)values[0]="";
  change(compose(values));if(clearDay)setError("اختر يومًا مناسبًا للشهر والسنة المحددين.");return true;
 };

 const labels=mode==="datetime"?["اليوم","الشهر","السنة","الساعة","الدقيقة"]:["الساعة","الدقيقة"];
 const placeholders=mode==="datetime"?["DD","MM","YYYY","HH","mm"]:["HH","mm"];
 const focusSection=(index:number)=>{sectionInputs.current[index]?.focus();sectionInputs.current[index]?.select();};
 const segment=(index:number)=><ProjectInput key={index} ref={element=>{sectionInputs.current[index]=element;if(index===0)input.current=element;}} id={index===0?fieldId:`${fieldId}-${index}`} type="text" inputMode="numeric" dir="ltr" autoComplete="off" aria-label={labels[index]} aria-describedby={`${fieldId}-format`} aria-invalid={invalid||Boolean(error)} value={sections[index]} required={required} disabled={disabled} maxLength={lengths[index]} placeholder={placeholders[index]} onFocus={event=>event.currentTarget.select()} onChange={event=>{const next=digits(event.target.value).replace(/\D/g,"");if(setSection(index,next)&&next.length===lengths[index]&&index<sections.length-1)focusSection(index+1);}} onBlur={event=>{const current=digits(event.currentTarget.value);if(current.length===1&&lengths[index]===2)setSection(index,pad(Number(current)));}} onKeyDown={event=>{
  if(["/",":"," "].includes(event.key)||event.key==="Enter"&&index<sections.length-1){event.preventDefault();event.stopPropagation();const current=digits(event.currentTarget.value);if(current.length===1&&lengths[index]===2)setSection(index,pad(Number(current)));focusSection(Math.min(index+1,sections.length-1));}
  else if(event.key==="Backspace"&&!event.currentTarget.value&&index>0){event.preventDefault();focusSection(index-1);}
  else if(event.key==="ArrowRight"&&event.currentTarget.selectionEnd===event.currentTarget.value.length&&index<sections.length-1){event.preventDefault();focusSection(index+1);}
  else if(event.key==="ArrowLeft"&&event.currentTarget.selectionStart===0&&index>0){event.preventDefault();focusSection(index-1);}
  else if(event.key==="ArrowUp"||event.key==="ArrowDown"){event.preventDefault();event.stopPropagation();const step=event.key==="ArrowUp"?1:-1,current=Number(sections[index]||0);if(current+step>=0)setSection(index,String(current+step).padStart(lengths[index],"0"));}
 }} className={`!h-11 !min-w-0 !rounded-lg !border-0 !bg-transparent !px-0 !text-center !text-base !font-semibold tabular-nums focus:!bg-blue-50 focus:!ring-2 focus:!ring-blue-200 dark:focus:!bg-blue-400/10 dark:focus:!ring-blue-400/30 ${lengths[index]===4?"!w-[54px]":"!w-[30px]"}`}/>;
 const paste=(event:React.ClipboardEvent<HTMLDivElement>)=>{
  const pasted=digits(event.clipboardData.getData("text")).trim(),iso=parseLocalDateTime(pasted,clock24h,mode)||parseLocalDateTime(pasted,!clock24h,mode);
  if(iso){event.preventDefault();select(iso);return;}
  const match=mode==="datetime"?/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(pasted):null;
  if(match&&validDay(Number(match[3]),Number(match[2]),Number(match[1]))){event.preventDefault();change(compose([pad(Number(match[1])),pad(Number(match[2])),match[3],hours,minutes]));focusSection(3);}
 };
 const frame=`flex min-w-0 items-center justify-center gap-0.5 rounded-[14px] border bg-white px-2 transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:bg-[#203247] dark:focus-within:ring-blue-400/15 ${invalid||error?"border-amber-500 dark:border-amber-400":"border-[#d7e3ef] dark:border-white/10"}`;
 useEffect(()=>{if(valid)setError("");},[valid]);
 const hour=Number(picker.slice(11,13))||0,minute=picker.slice(14,16)||"00",today=open?localNow(timeZone).slice(0,10):"";
 const setHour=(next:number)=>setPicker(old=>old.slice(0,11)+pad(next)+old.slice(13));
 return <>
  <div className="min-w-0 space-y-1.5">
   <div onPaste={paste} className={`grid min-w-0 gap-3 ${mode==="datetime"?"grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))]":"grid-cols-1"} ${className}`}>
    {mode==="datetime"&&<div className="min-w-0 space-y-1.5"><p className="text-xs font-semibold">التاريخ</p><div className={frame} dir="ltr" role="group" aria-label="اليوم والشهر والسنة">
     {segment(0)}<span aria-hidden="true" className="px-0.5 text-base text-slate-400">/</span>{segment(1)}<span aria-hidden="true" className="px-0.5 text-base text-slate-400">/</span>{segment(2)}
     <ProjectTooltip label="اختيار التاريخ والوقت"><ProjectButton variant="ghost" size="icon" className="!h-9 !w-8 !shrink-0 !rounded-lg !text-blue-600 dark:!text-blue-300" disabled={disabled} aria-label="اختيار التاريخ والوقت" onClick={event=>{event.preventDefault();setPicker(parsed||localNow(timeZone));setOpen(true);}}><CalendarDays className="h-4 w-4"/></ProjectButton></ProjectTooltip>
    </div></div>}
    <div className="min-w-0 space-y-1.5"><p className="flex items-center gap-1.5 text-xs font-semibold"><Clock3 className="h-3.5 w-3.5 text-slate-400"/>الوقت</p><div className="flex min-w-0 items-center gap-1.5"><div className={`${frame} flex-1`} dir="ltr" role="group" aria-label="الساعة والدقيقة">
     {segment(sections.length-2)}<span aria-hidden="true" className="px-1 text-lg text-slate-400">:</span>{segment(sections.length-1)}
    </div>{!clock24h&&<ProjectDropdown disabled={disabled} fieldStyle triggerClassName="!h-[46px]" className="!w-[66px] !shrink-0" nowrapLabel value={period} onChange={value=>{const next=value==="pm"?"pm":"am";setPeriod(next);change(compose(sections,next));}} options={[{value:"am",label:"ص"},{value:"pm",label:"م"}]}/>}</div></div>
   </div>
   {!required&&text&&<ProjectButton variant="ghost" className="!h-8 !text-xs" disabled={disabled} onClick={()=>change("")}><X className="h-3 w-3"/>مسح الموعد</ProjectButton>}
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
