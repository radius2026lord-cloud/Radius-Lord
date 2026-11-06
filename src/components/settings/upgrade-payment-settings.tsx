"use client";
import {useEffect,useState} from 'react';
import {KeyRound,Save,Wallet,Plus,Trash2} from 'lucide-react';
import FloatingNotice from '@/components/ui/floating-notice';
import ProjectButton from '@/components/ui/project-button';
import {ProjectCardIcon,ProjectInfoCard} from '@/components/ui/project-info-card';
import ProjectInput from '@/components/ui/project-input';
import ProjectLoading from '@/components/ui/project-loading';

const endpoint='/api/billing/admin/subscription-changes/payment-settings';

export default function UpgradePaymentSettings(){
 const [methods,setMethods]=useState<Array<{name:string;transferCode:string}>>([]);
 const names=methods.map(method=>method.name.trim().toLowerCase());
 const valid=methods.every(method=>method.name.trim()&&method.transferCode.trim())&&new Set(names).size===names.length;
 const update=(index:number,field:'name'|'transferCode',value:string)=>setMethods(rows=>rows.map((row,i)=>i===index?{...row,[field]:value}:row));
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[loaded,setLoaded]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError('');
  fetch(endpoint,{credentials:'include',cache:'no-store',signal:controller.signal})
   .then(async response=>{
    const data=await response.json();if(!response.ok)throw Error(data.message);
    if(!controller.signal.aborted){setMethods(data.paymentSettings.methods);setLoaded(true);}
   })
   .catch(e=>{if(!controller.signal.aborted)setError(e.message||'تعذر تحميل طرق الدفع.');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[revision]);
 async function save(){
  if(saving||!valid)return;
  setSaving(true);setError('');setMessage('');
  try{
   const response=await fetch(endpoint,{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({methods})});
   const data=await response.json();if(!response.ok)throw Error(data.message);
   setMethods(data.paymentSettings.methods);setMessage('تم حفظ طرق التحويل.');
  }catch(e){setError(e instanceof Error?e.message:'تعذر حفظ طريقة التحويل.');}
  finally{setSaving(false);}
 }
 return <div className="space-y-4 p-4 sm:p-6">
  {loading?<ProjectLoading>جارٍ تحميل طرق الدفع…</ProjectLoading>:!loaded?<ProjectButton variant="secondary" onClick={()=>setRevision(n=>n+1)}>إعادة المحاولة</ProjectButton>:<ProjectInfoCard>
   <h2 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={Wallet}/>تحويل قيمة الترقية</h2>
   <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">أضف طرق التحويل التي يمكن للمدير اختيارها عند اعتماد ترقية.</p>
   <div className="mt-4 space-y-4">
    {methods.length===0&&<p className="text-sm text-slate-600 dark:text-slate-300">لا توجد طرق تحويل محفوظة.</p>}
    {methods.map((method,index)=><ProjectInfoCard key={index}>
     <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <label className="block min-w-0 space-y-2 text-sm"><span className="flex items-center gap-2"><ProjectCardIcon icon={Wallet}/>اسم الطريقة</span><ProjectInput maxLength={80} value={method.name} disabled={saving} onChange={e=>update(index,'name',e.target.value)}/></label>
      <label className="block min-w-0 space-y-2 text-sm"><span className="flex items-center gap-2"><ProjectCardIcon icon={KeyRound}/>رمز التحويل</span><ProjectInput dir="ltr" maxLength={100} value={method.transferCode} disabled={saving} onChange={e=>update(index,'transferCode',e.target.value)}/></label>
      <ProjectButton variant="secondary" disabled={saving} onClick={()=>setMethods(rows=>rows.filter((_,i)=>i!==index))}><Trash2/>إزالة</ProjectButton>
     </div>
    </ProjectInfoCard>)}
   </div>
   {!valid&&<p className="mt-3 text-xs text-amber-700 dark:text-amber-300">أدخل اسمًا مختلفًا ورمز تحويل لكل طريقة.</p>}
   <div className="mt-4 flex flex-wrap gap-2">
    <ProjectButton variant="secondary" disabled={saving||methods.length>=30} onClick={()=>setMethods(rows=>[...rows,{name:'',transferCode:''}])}><Plus/>إضافة طريقة تحويل</ProjectButton>
    <ProjectButton disabled={saving||!valid} onClick={()=>void save()}><Save/>{saving?'جارٍ الحفظ…':'حفظ طرق التحويل'}</ProjectButton>
   </div>
  </ProjectInfoCard>}
  <FloatingNotice error={error} message={message} onDismiss={()=>{setError('');setMessage('');}}/>
 </div>;
}
