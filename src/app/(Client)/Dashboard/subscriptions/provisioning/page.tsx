"use client";

import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {AlertTriangle,ArrowLeft,CheckCircle2,Clock3,ListFilter,RefreshCw,Server,UserRound} from 'lucide-react';
import {CollectionGrid,CollectionState} from '@/components/ui/collection-display';
import {ProjectCardIcon,ProjectInfoCard} from '@/components/ui/project-info-card';
import {ProjectFilterGroup} from '@/components/ui/project-filter-panel';
import ProjectButton from '@/components/ui/project-button';
import ProjectDropdown from '@/components/ui/project-dropdown';
import ProjectInput from '@/components/ui/project-input';

type Order={id:number;customerName:string;planName:string;deploymentName:string|null;paymentCode:string;environmentStatus:string|null;environmentArchived:boolean};
const stages=[
 {value:'waiting',label:'بانتظار التجهيز',icon:Clock3,tone:'pending'},
 {value:'running',label:'جارٍ التجهيز',icon:Server,tone:'info'},
 {value:'failed',label:'تحتاج مراجعة',icon:AlertTriangle,tone:'warning'},
 {value:'ready',label:'البيئة جاهزة',icon:CheckCircle2,tone:'success'},
 {value:'archived',label:'البيئة مؤرشفة',icon:Server,tone:'pending'},
] as const;
function stageFor(order:Order){
 if(order.environmentArchived)return stages[4];
 if(order.environmentStatus==='ready')return stages[3];
 if(order.environmentStatus==='failed')return stages[2];
 if(order.environmentStatus==='provisioning')return stages[1];
 return stages[0];
}

export default function ManualProvisioningPage(){
 const router=useRouter();
 const [items,setItems]=useState<Order[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const [query,setQuery]=useState(''),[status,setStatus]=useState('work'),[filtersOpen,setFiltersOpen]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError('');
  fetch('/api/billing/admin/subscriptions?view=provisioning',{credentials:'include',cache:'no-store',signal:controller.signal})
   .then(async response=>{
    const data=await response.json();if(!response.ok)throw Error(data.message);
    if(!controller.signal.aborted)setItems(data.subscriptions??[]);
   })
   .catch(reason=>{if(!controller.signal.aborted)setError(reason.message||'تعذر تحميل قائمة التجهيز.');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[revision]);
 const needle=query.trim().toLowerCase();
 const visible=items.filter(item=>{
  const stage=stageFor(item).value;
  const matchesStatus=status==='all'||status===stage||(status==='work'&&stage!=='ready'&&stage!=='archived');
  return matchesStatus&&[item.customerName,item.planName,item.paymentCode].some(value=>value?.toLowerCase().includes(needle));
 });
 return <section className="space-y-5" dir="rtl">
  <ProjectInfoCard>
   <div className="flex flex-wrap items-start justify-between gap-4">
    <div className="min-w-0">
     <h1 className="flex items-center gap-2 text-base font-semibold"><ProjectCardIcon icon={Server}/>تجهيز البيئة يدويًا</h1>
     <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">اختر طلبًا مؤكد الدفع، ثم راجع بياناته والبنية التحتية قبل بدء التجهيز.</p>
    </div>
    <ProjectButton variant="secondary" disabled={loading} onClick={()=>setRevision(value=>value+1)}><RefreshCw/>تحديث</ProjectButton>
   </div>
  </ProjectInfoCard>
  <div className="flex flex-wrap items-center gap-3">
   <ProjectInput className="min-w-0 flex-1 basis-52" aria-label="بحث في طلبات التجهيز" placeholder="بحث بالعميل أو الخطة أو كود الدفع" value={query} onChange={e=>setQuery(e.target.value)}/>
   <ProjectButton variant="secondary" aria-expanded={filtersOpen} aria-controls="manual-provisioning-filters" onClick={()=>setFiltersOpen(open=>!open)}><ListFilter/>تصفية{status!=='work'?' · 1':''}</ProjectButton>
  </div>
  {filtersOpen&&<div id="manual-provisioning-filters" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
   <ProjectFilterGroup icon={Server} title="حالة التجهيز" tone="activation">
    <ProjectDropdown compact bareOptionIcons value={status} onChange={setStatus} options={[
     {value:'work',label:'تحتاج متابعة'},{value:'all',label:'كل الطلبات'},...stages.map(stage=>({value:stage.value,label:stage.label,icon:stage.icon})),
    ]}/>
   </ProjectFilterGroup>
  </div>}
  {loading?<CollectionState loading>جارٍ تحميل طلبات التجهيز…</CollectionState>:error?<CollectionState>
   <p role="alert">{error}</p><ProjectButton variant="secondary" onClick={()=>setRevision(value=>value+1)}>إعادة المحاولة</ProjectButton>
  </CollectionState>:!visible.length?<CollectionState>لا توجد طلبات تجهيز مطابقة.</CollectionState>:<CollectionGrid>
   {visible.map(item=>{
    const stage=stageFor(item);
    return <ProjectInfoCard key={item.id} tone={stage.tone}>
     <h2 className="flex items-start gap-2 text-sm font-semibold"><ProjectCardIcon icon={UserRound}/><span className="min-w-0 break-words">{item.customerName}</span></h2>
     <p className="mt-2 break-words text-xs text-slate-600 dark:text-slate-300">{item.planName}{item.deploymentName?' · '+item.deploymentName:''}</p>
     <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-current/10 pt-3 text-xs">
      <span className="flex items-center gap-2"><ProjectCardIcon icon={stage.icon} tone={stage.tone}/>{stage.label}</span>
      <bdi className="break-all font-mono">{item.paymentCode}</bdi>
     </div>
     <ProjectButton className="mt-4" variant="secondary" onClick={()=>router.push(`/Dashboard/subscriptions/${item.id}?from=provisioning#environment-provisioning`)}><ArrowLeft/>{stage.value==='waiting'?'مراجعة وبدء التجهيز':'عرض حالة التجهيز'}</ProjectButton>
    </ProjectInfoCard>;
   })}
  </CollectionGrid>}
 </section>;
}
