"use client";
import {useEffect,useState} from 'react';
import {CalendarClock,PackagePlus,Network,CheckCircle2,RefreshCw} from 'lucide-react';
import Link from 'next/link';
import ProjectButton from './ui/project-button';
import ProjectDialog from './ui/project-dialog';
import ProjectInput from './ui/project-input';
import FloatingNotice from './ui/floating-notice';
import {ProjectCardIcon,ProjectInfoCard} from './ui/project-info-card';
import {CollectionState} from './ui/collection-display';

type Change={
 tenantId:number;networkName:string;kind:'renewal'|'upgrade';status:'requested'|'applying'|'applied';
 requestedAt:string;expiresAt:string;planName:string;durationMonths:number|null;includeRenewal?:boolean;
 currentPppoeLimit?:number;currentNasLimit?:number;requestedPppoeLimit?:number|null;requestedNasLimit?:number|null;
 applied?:{expiresAt:string;maxSubscribers:number;maxNas:number};
};
const endpoint='/api/billing/admin/subscription-changes';
const name=(item:Change)=>item.kind==='renewal'?'تجديد الاشتراك':item.includeRenewal?'ترقية السعة مع التجديد':'ترقية السعة';
const format=(value:string)=>new Intl.DateTimeFormat('ar',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(value))+' UTC';

export default function MasterSubscriptionChanges({kind}:{kind:'all'|'renewal'|'upgrade'}){
 const [items,setItems]=useState<Change[]>([]),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 const [status,setStatus]=useState<'open'|'applied'|'all'>('open'),[selected,setSelected]=useState<Change|null>(null);
 const [months,setMonths]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);
  fetch(endpoint,{credentials:'include',cache:'no-store',signal:controller.signal})
   .then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.message);if(!controller.signal.aborted)setItems(data.items??[]);})
   .catch(e=>{if(!controller.signal.aborted)setError(e.message||'تعذر تحميل الطلبات.');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[revision]);
 const filtered=items.filter(item=>(kind==='all'||item.kind===kind)&&(status==='all'||(status==='applied'?item.status==='applied':item.status!=='applied')));
 const needsMonths=selected?.status==='requested'&&(selected.kind==='renewal'||selected.includeRenewal);
 async function apply(){
  if(!selected||busy)return;
  setBusy(true);setError('');
  try{
   const response=await fetch(`${endpoint}/${selected.tenantId}/${selected.kind}/apply`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestedAt:selected.requestedAt,months:months?Number(months):null})});
   const data=await response.json();if(!response.ok)throw Error(data.message);
   setMessage('تم تطبيق الطلب على قاعدة العميل والتحقق من بيانات الاشتراك.');
  }catch(e){setError(e instanceof Error?e.message:'تعذر تطبيق الطلب.');}
  finally{setBusy(false);setSelected(null);setRevision(value=>value+1);}
 }
 return <section className="space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <h2 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={CalendarClock}/>طلبات التجديد والترقية</h2>
   <div className="flex flex-wrap gap-2">
    {([{key:'open',label:'بانتظار المعالجة'},{key:'applied',label:'مطبّقة'},{key:'all',label:'الكل'}] as const).map(option=><ProjectButton key={option.key} variant={status===option.key?'primary':'secondary'} aria-pressed={status===option.key} onClick={()=>setStatus(option.key)}>{option.label}</ProjectButton>)}
    <ProjectButton variant="ghost" size="icon" aria-label="تحديث الطلبات" disabled={loading} onClick={()=>setRevision(value=>value+1)}><RefreshCw/></ProjectButton>
   </div>
  </div>
  {loading?<CollectionState loading>جارٍ تحميل الطلبات…</CollectionState>:!filtered.length?<CollectionState>لا توجد طلبات مطابقة.</CollectionState>:<div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
   {filtered.map(item=><ProjectInfoCard key={`${item.tenantId}:${item.kind}`} tone={item.status==='applied'?'success':item.status==='applying'?'warning':'info'}>
    <h3 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={item.kind==='renewal'?CalendarClock:PackagePlus}/>{name(item)}</h3>
    <p className="mt-3 break-words text-sm">{item.networkName} · {item.planName}</p>
    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{item.status==='applied'?'تم التطبيق':item.status==='applying'?'بانتظار استكمال التطبيق':'بانتظار الاعتماد'} · <bdi>{format(item.requestedAt)}</bdi></p>
    <ProjectButton className="mt-4" variant="secondary" onClick={()=>{setMonths(item.durationMonths?String(item.durationMonths):'');setSelected(item);}}>عرض الطلب</ProjectButton>
   </ProjectInfoCard>)}
  </div>}
  {selected&&<ProjectDialog title={name(selected)} description={selected.networkName} onClose={()=>setSelected(null)} busy={busy} hostingerStyle compact footer={<>
   <ProjectButton variant="secondary" disabled={busy} onClick={()=>setSelected(null)}>إغلاق</ProjectButton>
   {selected.status!=='applied'&&<ProjectButton disabled={busy||Boolean(needsMonths&&(!/^[0-9]+$/.test(months)||Number(months)<1||Number(months)>120))} onClick={()=>void apply()}><CheckCircle2/>{busy?'جارٍ التطبيق…':selected.status==='applying'?'استكمال التطبيق':'اعتماد وتطبيق الطلب'}</ProjectButton>}
  </>}>
   <div className="space-y-4 text-sm">
    <Link className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-300" href={`/Dashboard/networks/${selected.tenantId}`}><Network className="h-4 w-4"/>فتح بيانات الشبكة</Link>
    <ProjectInfoCard><p>الخطة <strong>{selected.planName}</strong></p><p className="mt-2">موعد الانتهاء عند تقديم الطلب <bdi>{format(selected.expiresAt)}</bdi></p>
     {selected.requestedPppoeLimit!=null&&<p className="mt-2">حسابات PPPoE من {selected.currentPppoeLimit} إلى {selected.requestedPppoeLimit}</p>}
     {selected.requestedNasLimit!=null&&<p className="mt-2">أجهزة NAS من {selected.currentNasLimit} إلى {selected.requestedNasLimit}</p>}
    </ProjectInfoCard>
    {needsMonths&&<label className="block space-y-2"><span>مدة التمديد بالأشهر</span><ProjectInput inputMode="numeric" maxLength={3} value={months} disabled={busy} onChange={e=>{if(/^[0-9]*$/.test(e.target.value))setMonths(e.target.value);}}/><span className="block text-xs text-slate-600 dark:text-slate-300">تبدأ المدة من انتهاء الاشتراك الساري أو من وقت اعتماد الاشتراك المنتهي.</span></label>}
    {selected.applied&&<ProjectInfoCard tone="success"><p>موعد الانتهاء بعد التطبيق <bdi>{format(selected.applied.expiresAt)}</bdi></p><p className="mt-2">حد PPPoE {selected.applied.maxSubscribers||'غير محدود'} · حد NAS {selected.applied.maxNas||'غير محدود'}</p></ProjectInfoCard>}
    {selected.status!=='applied'&&<p className="text-xs leading-6 text-slate-600 dark:text-slate-300">يطبّق الاعتماد التغيير مباشرة على قاعدة العميل. تأكيد أي دفعة يتم من شاشة عمليات الدفع.</p>}
   </div>
  </ProjectDialog>}
  <FloatingNotice error={error} message={message} onDismiss={()=>{setError('');setMessage('');}}/>
 </section>;
}
