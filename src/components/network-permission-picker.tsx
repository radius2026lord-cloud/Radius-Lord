"use client";
import {useEffect,useRef,useState} from 'react';
import ProjectButton from '@/components/ui/project-button';
import {createPortal} from 'react-dom';
import {Users,Contact,Tags,History,Network,KeyRound,Activity,Gauge,Layers,Wifi,Server,ShieldCheck,Eye,Plus,Pencil,Archive,Download,RotateCcw,Power,Unplug,X,ChevronDown,type LucideIcon} from 'lucide-react';
import {ProjectInfoCard,ProjectCardIcon,type InfoCardTone} from '@/components/ui/project-info-card';
import ProjectCheckbox from '@/components/ui/project-checkbox';
export type NetworkPermission={id:number;code:string;name_ar:string;module:string};
const modules:Record<string,{label:string;icon:LucideIcon;tone:InfoCardTone}>={
 customers:{label:'المشتركون',icon:Users,tone:'info'},identity:{label:'بيانات الهوية',icon:Contact,tone:'memory'},categories:{label:'التصنيفات',icon:Tags,tone:'warning'},activity:{label:'سجل النشاط',icon:History,tone:'pending'},lines:{label:'خطوط الاتصال',icon:Network,tone:'connections'},credentials:{label:'بيانات الدخول',icon:KeyRound,tone:'warning'},sessions:{label:'الجلسات',icon:Activity,tone:'success'},usage:{label:'الاستهلاك',icon:Gauge,tone:'cpu'},pppoe:{label:'خدمات PPPoE',icon:Layers,tone:'memory'},hotspot:{label:'الهوتسبوت',icon:Wifi,tone:'connections'},nas:{label:'خوادم NAS',icon:Server,tone:'cpu'},profiles:{label:'البروفايلات',icon:Layers,tone:'memory'},
};
function actionIcon(code:string){const action=code.split('.').pop();return action==='view'?Eye:action==='create'||action==='issue'?Plus:action==='archive'?Archive:action==='export'||action==='download'?Download:action==='restore'||action==='renew'?RotateCcw:action==='enable'||action==='disable'?Power:action==='disconnect'?Unplug:action==='change_password'||action==='change_username'?KeyRound:Pencil;}
export default function NetworkPermissionPicker({permissions,selected,onChange,disabled}:{permissions:NetworkPermission[];selected:number[];onChange:(ids:number[])=>void;disabled:boolean}){

 const modulesPresent=Array.from(new Set(permissions.map(p=>p.module)));
 const count=permissions.filter(p=>selected.includes(Number(p.id))).length;
 const root=useRef<HTMLElement>(null);
 const [mounted,setMounted]=useState(false),[visible,setVisible]=useState(false),[compact,setCompact]=useState(false),[position,setPosition]=useState({left:56,bottom:110,width:280});
 useEffect(()=>{
  const workspace=root.current?.closest('.workspace-scroll');if(!workspace)return;
  const place=()=>{const rect=workspace.getBoundingClientRect();const inset=window.innerWidth<640?24:40;setPosition({left:Math.max(12,rect.left+inset),bottom:Math.max(90,window.innerHeight-rect.bottom+20),width:Math.min(280,Math.max(180,rect.width-inset-24))});};
  place();const observer=new ResizeObserver(place);observer.observe(workspace);window.addEventListener('resize',place);return()=>{observer.disconnect();window.removeEventListener('resize',place);};
 },[]);
 const show=count>1;
 useEffect(()=>{
  let frame:number|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  if(show){setCompact(false);setMounted(true);frame=requestAnimationFrame(()=>setVisible(true));}
  else {setVisible(false);timer=setTimeout(()=>setMounted(false),300);}
  return()=>{if(frame!==undefined)cancelAnimationFrame(frame);if(timer)clearTimeout(timer);};
 },[show]);
 const renderRows=(chosen:number[],change:(ids:number[])=>void)=>(<div data-permission-list className="space-y-4">{modulesPresent.map(module=>{
   const meta=modules[module]||{label:'صلاحيات إضافية',icon:ShieldCheck,tone:'info' as InfoCardTone};
   const items=permissions.filter(p=>p.module===module),ids=items.map(p=>Number(p.id)),picked=ids.filter(id=>chosen.includes(id)).length;
   return <div key={module} className="overflow-hidden rounded-[18px] border border-[#b6c7d9] bg-[#edf2f7] transition-[border-color,box-shadow,background-color] duration-200 hover:border-[#7da4ce] hover:bg-[#e6edf5] focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/15 dark:border-white/15 dark:bg-[#243449] dark:hover:bg-[#2b3c52] dark:focus-within:border-blue-400"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-white/10"><div className="flex items-center gap-2.5"><ProjectCardIcon icon={meta.icon} tone={meta.tone}/><div><h5 className="text-sm font-bold">{meta.label}</h5><p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{picked} / {ids.length} محددة</p></div></div><label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold"><ProjectCheckbox disabled={disabled} checked={picked===ids.length} indeterminate={picked>0&&picked<ids.length} onChange={e=>change(e.target.checked?Array.from(new Set([...chosen,...ids])):chosen.filter(id=>!ids.includes(id)))}/>تحديد القسم</label></div>
    <div className="grid gap-2 p-3">{items.map(p=>{const checked=chosen.includes(Number(p.id));return <label key={p.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/25 transition-colors duration-200 ${checked?'border-slate-300 bg-slate-50 dark:border-white/20 dark:bg-white/[.06]':'border-transparent bg-white/40 hover:border-slate-200 hover:bg-white/80 dark:bg-white/[.025] dark:hover:border-white/15 dark:hover:bg-white/[.06]'} ${disabled?'cursor-not-allowed opacity-60':''}`}><ProjectCheckbox checked={checked} disabled={disabled} onChange={e=>{change(e.target.checked?Array.from(new Set([...chosen,Number(p.id)])):chosen.filter(id=>id!==Number(p.id)));if(e.target.checked){const inputs=Array.from(e.target.closest('[data-permission-list]')?.querySelectorAll<HTMLInputElement>('input[data-permission-option]')||[]);const next=inputs[inputs.indexOf(e.target)+1];next?.focus({preventScroll:true});next?.closest('label')?.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}} data-permission-option/><ProjectCardIcon icon={actionIcon(p.code)} tone={meta.tone}/><span className="flex-1 text-xs font-medium leading-5">{p.name_ar}</span></label>;})}</div>
   </div>;
  })}</div>);
 return <section ref={root} className="space-y-4" aria-label="تحديد صلاحيات المجموعة">
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-900/20"><div className="flex items-center gap-3"><ProjectCardIcon icon={ShieldCheck} tone="success"/><div><h4 className="text-sm font-bold">صلاحيات المجموعة</h4><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">اختر العمليات المسموحة لكل قسم.</p></div></div><span className="rounded-xl bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-600 dark:text-blue-300">{count} من {permissions.length} صلاحية محددة</span></div>
  <div className="flex flex-wrap gap-2"><ProjectButton variant="secondary" disabled={disabled||!permissions.length} onClick={()=>onChange(permissions.map(p=>Number(p.id)))}><ShieldCheck/>كل صلاحيات المستخدم الفرعي</ProjectButton></div>
  <p className="text-xs text-slate-500 dark:text-slate-400">الإعداد الكامل يشمل الصلاحيات المتاحة فقط؛ صلاحيات المدير الرئيسي مستثناة. تُحفظ الاختيارات عند حفظ المجموعة.</p>
  {renderRows(selected,onChange)}
  {mounted&&typeof document!=='undefined'&&createPortal(<aside dir="rtl" aria-label="الصلاحيات المحددة" aria-hidden={!visible} inert={!visible} style={position} className={`fixed z-[9000] flex max-h-[36dvh] flex-col overflow-hidden rounded-[18px] border border-[#95b1cd] bg-[#f4f7fb]/95 backdrop-blur-md text-slate-800 shadow-[0_12px_32px_rgba(37,64,92,.18)] transition-[opacity,transform] duration-300 ease-in-out motion-reduce:transition-none dark:border-white/20 dark:bg-[#243449] dark:text-slate-100 ${visible?'translate-x-0 opacity-100':'-translate-x-4 opacity-0 pointer-events-none'}`}>
   <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 p-3 dark:border-white/10"><ProjectCardIcon icon={ShieldCheck} tone="success"/><h4 className="flex-1 text-sm font-bold">الصلاحيات المحددة</h4><span aria-live="polite" aria-atomic="true" className="rounded-lg bg-blue-500/10 px-2 py-1 text-xs font-bold text-blue-600 dark:text-blue-300">{count}</span><ProjectButton variant="ghost" size="icon" aria-expanded={!compact} aria-label={compact?'عرض الصلاحيات المحددة':'طي القائمة'} onClick={()=>setCompact(value=>!value)}><ChevronDown className={`h-4 w-4 transition-transform duration-300 ${compact?'rotate-180':''}`}/></ProjectButton></div>
   <div className={`min-h-0 overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out motion-reduce:transition-none ${compact?'max-h-0 opacity-0':'max-h-[25dvh] opacity-100'}`} inert={compact} aria-hidden={compact}><div dir="ltr" className="max-h-[25dvh] space-y-1 overflow-y-auto overscroll-contain p-2 [scrollbar-width:thin]">{permissions.filter(p=>selected.includes(Number(p.id))).map(p=><div dir="rtl" key={p.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-2 py-2 dark:border-white/10 dark:bg-white/[.04]"><ProjectCardIcon icon={actionIcon(p.code)} tone={modules[p.module]?.tone||'info'}/><div className="min-w-0 flex-1"><p className="text-xs font-semibold leading-5">{p.name_ar}</p><p className="text-[10px] text-slate-500 dark:text-slate-400">{modules[p.module]?.label||'صلاحيات إضافية'}</p></div><ProjectButton variant="ghost" size="icon" disabled={disabled} aria-label={`إزالة ${p.name_ar}`} onClick={()=>onChange(selected.filter(id=>id!==Number(p.id)))}><X className="h-3.5 w-3.5"/></ProjectButton></div>)}</div></div>
   <p className="shrink-0 border-t border-slate-200 px-3 py-2 text-[10px] text-slate-500 dark:border-white/10 dark:text-slate-400">تُحفظ اختياراتك عند حفظ المجموعة.</p>
  </aside>,document.body)}
  {!permissions.length&&<ProjectInfoCard tone="pending">لا توجد صلاحيات متاحة للاختيار.</ProjectInfoCard>}
 </section>;
}
