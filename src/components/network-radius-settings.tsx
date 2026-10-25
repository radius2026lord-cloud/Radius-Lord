"use client";
import {useEffect,useState} from 'react';
import {Clock,ShieldCheck,Server,Save} from 'lucide-react';
import {ProjectInfoCard,ProjectCardIcon} from '@/components/ui/project-info-card';
import ProjectInput from '@/components/ui/project-input';
import ProjectDropdown from '@/components/ui/project-dropdown';
import ProjectButton from '@/components/ui/project-button';
import ProjectTabs from '@/components/ui/project-tabs';
import FloatingNotice from '@/components/ui/floating-notice';
type Settings={configured:boolean;serverAddress:string;interimSeconds:number;gracePolicy:string;graceDays:number;version:string};
type Section='accounting'|'grace'|'server';
export default function NetworkRadiusSettings({endpoint,initialSection='accounting',navigationVersion=0}:{endpoint:string;initialSection?:Section;navigationVersion?:number}){
 const [data,setData]=useState<Settings|null>(null),[savedData,setSavedData]=useState<Settings|null>(null),[section,setSection]=useState<Section>(initialSection),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>setSection(initialSection),[initialSection,navigationVersion]);
 useEffect(()=>{let live=true;fetch(endpoint+'/radius-settings',{credentials:'include',cache:'no-store'}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.message);if(live){setData(body);setSavedData(body);}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[endpoint]);
 const dirty=Boolean(data&&savedData&&JSON.stringify(data)!==JSON.stringify(savedData));
 const save=async()=>{if(!data||busy)return;setBusy(true);setError('');setMessage('');try{const response=await fetch(endpoint+'/radius-settings',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const body=await response.json();if(!response.ok)throw new Error(body.message);setData(body);setSavedData(body);setMessage('تم حفظ إعدادات RADIUS.');}catch(e){setError(e instanceof Error?e.message:'تعذر الحفظ.');}finally{setBusy(false);}};
 return <div className="space-y-4">
  <FloatingNotice error={error} message={message} onDismiss={()=>{setError('');setMessage('');}}/>
  {data?<><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500 dark:text-slate-400">إعدادات خدمة المصادقة والمحاسبة</p><span role="status" className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${dirty?"border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-200":"border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-200"}`}>{dirty?"تعديلات غير محفوظة":"الإعدادات محفوظة"}</span></div><ProjectTabs id="radius-setting-sections" value={section} onChange={value=>setSection(value as Section)} items={[
   {value:'accounting',label:'المحاسبة',icon:Clock,iconClassName:'text-sky-500'},
   {value:'grace',label:'مهلة السماح',icon:ShieldCheck,iconClassName:'text-violet-500'},
   {value:'server',label:'خادم RADIUS',icon:Server,iconClassName:'text-emerald-500'}
  ]}/><form className="space-y-4" onSubmit={e=>{e.preventDefault();void save();}}>
   <section id={`radius-setting-sections-panel-${section}`} role="tabpanel" aria-labelledby={`radius-setting-sections-tab-${section}`}>
    {section==='accounting'?<ProjectInfoCard><ProjectCardIcon icon={Clock}/><label className="mt-3 block text-sm font-semibold">فترة تحديث محاسبة RADIUS (ثانية)<ProjectInput className="mt-2 max-w-sm" type="number" required min={60} max={86400} value={data.interimSeconds} onChange={e=>setData({...data,interimSeconds:Number(e.target.value)})}/></label><p className="mt-2 text-xs text-slate-500">من دقيقة إلى 24 ساعة؛ تُستخدم القيمة عند إعداد خدمات الشبكة.</p></ProjectInfoCard>
     :section==='grace'?<ProjectInfoCard><ProjectCardIcon icon={ShieldCheck} tone="memory"/><label className="mt-3 block text-sm font-semibold">سياسة مهلة السماح<ProjectDropdown className="mt-2 max-w-sm" value={data.gracePolicy} onChange={gracePolicy=>setData({...data,gracePolicy})} options={[{value:'package',label:'حسب الباقة'},{value:'global',label:'عامة للشبكة'}]}/></label>{data.gracePolicy==='global'&&<label className="mt-3 block max-w-sm text-sm font-semibold">عدد الأيام<ProjectInput type="number" className="mt-2" required min={0} max={3650} value={data.graceDays} onChange={e=>setData({...data,graceDays:Number(e.target.value)})}/></label>}<p className="mt-3 text-xs text-slate-500">حدد ما إذا كانت مهلة السماح تتبع الباقة أو تُطبق كسياسة عامة للشبكة.</p></ProjectInfoCard>
     :<ProjectInfoCard><ProjectCardIcon icon={Server} tone="connections"/><h3 className="mt-3 text-sm font-semibold">خادم RADIUS المرتبط</h3><p className="mt-2 text-sm" dir="ltr">{data.serverAddress||'يُحدد أثناء تجهيز البيئة'}</p><p className="mt-2 text-xs text-slate-500">تُدار بيانات الاتصال الأساسية أثناء تجهيز البيئة لضمان تطابق الخادم مع إعدادات الشبكة.</p></ProjectInfoCard>}
   </section>
   {!data.configured&&<p className="text-sm text-amber-600">احفظ بيانات الشبكة أولًا لتفعيل هذه الإعدادات.</p>}
   <ProjectButton type="submit" disabled={busy||!data.configured}><Save/>{busy?'جارٍ الحفظ…':'حفظ إعدادات RADIUS'}</ProjectButton>
  </form></>:<p className="text-sm text-slate-500">{error?'تعذر تحميل الإعدادات.':'جارٍ تحميل إعدادات RADIUS…'}</p>}
 </div>;
}
