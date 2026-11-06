"use client";
import {useEffect,useState} from 'react';
import {KeyRound,Save,Wallet} from 'lucide-react';
import FloatingNotice from '@/components/ui/floating-notice';
import ProjectButton from '@/components/ui/project-button';
import {ProjectCardIcon,ProjectInfoCard} from '@/components/ui/project-info-card';
import ProjectInput from '@/components/ui/project-input';
import ProjectLoading from '@/components/ui/project-loading';

const endpoint='/api/billing/admin/subscription-changes/payment-settings';

export default function UpgradePaymentSettings(){
 const [form,setForm]=useState({currency:'',transferCode:''});
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[loaded,setLoaded]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError('');
  fetch(endpoint,{credentials:'include',cache:'no-store',signal:controller.signal})
   .then(async response=>{
    const data=await response.json();if(!response.ok)throw Error(data.message);
    if(!controller.signal.aborted){setForm(data.paymentSettings);setLoaded(true);}
   })
   .catch(e=>{if(!controller.signal.aborted)setError(e.message||'تعذر تحميل طرق الدفع.');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[revision]);
 async function save(){
  if(saving)return;
  setSaving(true);setError('');setMessage('');
  try{
   const response=await fetch(endpoint,{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
   const data=await response.json();if(!response.ok)throw Error(data.message);
   setForm(data.paymentSettings);setMessage('تم حفظ طريقة تحويل قيمة الترقية.');
  }catch(e){setError(e instanceof Error?e.message:'تعذر حفظ طريقة التحويل.');}
  finally{setSaving(false);}
 }
 return <div className="space-y-4 p-4 sm:p-6">
  {loading?<ProjectLoading>جارٍ تحميل طرق الدفع…</ProjectLoading>:!loaded?<ProjectButton variant="secondary" onClick={()=>setRevision(n=>n+1)}>إعادة المحاولة</ProjectButton>:<ProjectInfoCard>
   <h2 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={Wallet}/>تحويل قيمة الترقية</h2>
   <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">يظهر رمز التحويل والعملة للعميل مع القيمة التي يحددها المدير في طلب الترقية.</p>
   <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
    <label className="block min-w-0 space-y-2 text-sm"><span className="flex items-center gap-2"><ProjectCardIcon icon={Wallet}/>رمز العملة</span><ProjectInput dir="ltr" maxLength={3} placeholder="USD" value={form.currency} disabled={saving} onChange={e=>setForm({...form,currency:e.target.value.toUpperCase()})}/></label>
    <label className="block min-w-0 space-y-2 text-sm"><span className="flex items-center gap-2"><ProjectCardIcon icon={KeyRound}/>رمز التحويل</span><ProjectInput dir="ltr" maxLength={100} value={form.transferCode} disabled={saving} onChange={e=>setForm({...form,transferCode:e.target.value})}/></label>
   </div>
   <ProjectButton className="mt-4" disabled={saving||!form.transferCode.trim()||!/^[A-Z]{3}$/.test(form.currency)} onClick={()=>void save()}><Save/>{saving?'جارٍ الحفظ…':'حفظ طريقة التحويل'}</ProjectButton>
  </ProjectInfoCard>}
  <FloatingNotice error={error} message={message} onDismiss={()=>{setError('');setMessage('');}}/>
 </div>;
}
