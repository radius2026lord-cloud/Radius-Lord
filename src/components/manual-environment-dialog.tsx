"use client";
import {useEffect,useRef,useState} from 'react';
import {CreditCard,Mail,Network,Server,UserRound} from 'lucide-react';
import ProjectButton from './ui/project-button';
import ProjectDialog from './ui/project-dialog';
import ProjectDropdown from './ui/project-dropdown';
import ProjectInput from './ui/project-input';
import {ProjectCardIcon,ProjectInfoCard} from './ui/project-info-card';

type Plan={id:number;name:string;duration_months:number;max_subscribers:number;max_nas:number};
const endpoint='/api/billing/admin/manual-environment';
const empty={networkName:'',fullName:'',email:'',phone:'',country:'',password:'',planId:'',duration:'',maxPppoe:'',maxNas:''};

export default function ManualEnvironmentDialog({onClose,onCreated}:{onClose:()=>void;onCreated:(orderId:number)=>void}){
 const [form,setForm]=useState(empty),[plans,setPlans]=useState<Plan[]>([]);
 const [customerMode,setCustomerMode]=useState('new'),[planMode,setPlanMode]=useState('plan');
 const [busy,setBusy]=useState(false),[loadingPlans,setLoadingPlans]=useState(true),[error,setError]=useState(''),[planError,setPlanError]=useState(''),[revision,setRevision]=useState(0);
 const requestId=useRef('');
 const set=(key:keyof typeof empty,value:string)=>setForm(current=>({...current,[key]:value}));
 useEffect(()=>{
  const controller=new AbortController();
  setLoadingPlans(true);setPlanError('');
  fetch(endpoint+'/plans',{credentials:'include',cache:'no-store',signal:controller.signal})
   .then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.message);if(!controller.signal.aborted)setPlans(data.plans??[]);})
   .catch(e=>{if(!controller.signal.aborted)setPlanError(e.message||'تعذر تحميل الخطط.');})
   .finally(()=>{if(!controller.signal.aborted)setLoadingPlans(false);});
  return ()=>controller.abort();
 },[revision]);
 const plan=plans.find(item=>String(item.id)===form.planId);
 const digits=(value:string)=>/^[0-9]+$/.test(value)&&Number.isSafeInteger(Number(value));
 const planValid=planMode==='plan'?Boolean(plan):
  digits(form.duration)&&Number(form.duration)>=1&&Number(form.duration)<=120&&digits(form.maxPppoe)&&digits(form.maxNas)&&Number(form.maxNas)<=1024;
 const accountValid=Boolean(form.networkName.trim()&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))&&
  (customerMode==='existing'||Boolean(form.fullName.trim()&&/^\+?[0-9]{7,15}$/.test(form.phone)&&form.country.trim()&&form.password.length>=8&&new TextEncoder().encode(form.password).length<=72));
 async function submit(){
  if(busy||!accountValid||!planValid)return;
  if(!requestId.current)requestId.current=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
  setBusy(true);setError('');
  try{
   const response=await fetch(endpoint,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    ...form,customerMode,planMode,requestId:requestId.current,
    duration:Number(form.duration),maxPppoe:Number(form.maxPppoe),maxNas:Number(form.maxNas),
   })});
   const data=await response.json();if(!response.ok)throw Error(data.message||'تعذر تسجيل طلب التجهيز.');
   onCreated(Number(data.orderId));
  }catch(e){setError(e instanceof Error?e.message:'تعذر تسجيل طلب التجهيز.');}
  finally{setBusy(false);}
 }
 return <ProjectDialog title="توليد بيئة جديدة" description="اعتماد إداري لبيئة على الاستضافة المشتركة. يبدأ الاشتراك بعد اكتمال التجهيز." onClose={onClose} busy={busy} hostingerStyle footer={<>
  <ProjectButton variant="secondary" disabled={busy} onClick={onClose}>إلغاء</ProjectButton>
  <ProjectButton disabled={busy||!accountValid||!planValid} onClick={()=>void submit()}><Server/>{busy?'جارٍ فحص الجاهزية وتسجيل الطلب…':'توليد البيئة'}</ProjectButton>
 </>}>
  <div className="space-y-4">
   <ProjectInfoCard>
    <h2 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={UserRound}/>العميل والشبكة</h2>
    <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
     <div className="min-w-0 space-y-2"><p className="text-xs font-semibold">حساب العميل</p><ProjectDropdown fieldStyle value={customerMode} disabled={busy} onChange={setCustomerMode} icon={UserRound} options={[{value:'new',label:'إنشاء عميل جديد'},{value:'existing',label:'عميل موجود'}]}/></div>
     <label className="min-w-0 space-y-2 text-xs font-semibold"><span className="flex items-center gap-2"><ProjectCardIcon icon={Network}/>اسم الشبكة</span><ProjectInput maxLength={150} disabled={busy} value={form.networkName} onChange={e=>set('networkName',e.target.value)}/></label>
     <label className="min-w-0 space-y-2 text-xs font-semibold"><span className="flex items-center gap-2"><ProjectCardIcon icon={Mail}/>البريد الإلكتروني</span><ProjectInput type="email" dir="ltr" maxLength={254} disabled={busy} value={form.email} onChange={e=>set('email',e.target.value)}/>{customerMode==='existing'&&<span className="block font-normal text-slate-600 dark:text-slate-300">أدخل البريد المسجل للعميل.</span>}</label>
     {customerMode==='new'&&<>
      <label className="min-w-0 space-y-2 text-xs font-semibold"><span>اسم العميل الكامل</span><ProjectInput maxLength={150} disabled={busy} value={form.fullName} onChange={e=>set('fullName',e.target.value)}/></label>
      <label className="min-w-0 space-y-2 text-xs font-semibold"><span>رقم الهاتف الدولي</span><ProjectInput type="tel" dir="ltr" maxLength={16} disabled={busy} value={form.phone} onChange={e=>{if(/^\+?[0-9]*$/.test(e.target.value))set('phone',e.target.value);}}/></label>
      <label className="min-w-0 space-y-2 text-xs font-semibold"><span>الدولة</span><ProjectInput maxLength={100} disabled={busy} value={form.country} onChange={e=>set('country',e.target.value)}/></label>
      <label className="min-w-0 space-y-2 text-xs font-semibold sm:col-span-2"><span>كلمة مرور حساب العميل</span><ProjectInput type="password" autoComplete="new-password" dir="ltr" minLength={8} maxLength={72} disabled={busy} value={form.password} onChange={e=>set('password',e.target.value)}/><span className="block font-normal text-slate-600 dark:text-slate-300">ثمانية أحرف على الأقل. بيانات دخول مدير الشبكة تُنشأ بعد التجهيز.</span></label>
     </>}
    </div>
   </ProjectInfoCard>
   <ProjectInfoCard tone="pending">
    <h2 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={CreditCard} tone="pending"/>الاشتراك والسعة</h2>
    <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
     <div className="min-w-0 space-y-2"><p className="text-xs font-semibold">نوع الاشتراك</p><ProjectDropdown fieldStyle value={planMode} disabled={busy} onChange={setPlanMode} options={[{value:'plan',label:'خطة معتمدة'},{value:'custom',label:'اشتراك مخصص خارج الخطط'}]}/></div>
     {planMode==='plan'?<div className="min-w-0 space-y-2"><p className="text-xs font-semibold">الخطة</p><ProjectDropdown fieldStyle searchable value={form.planId} disabled={busy||loadingPlans} onChange={value=>set('planId',value)} placeholder={loadingPlans?'جارٍ تحميل الخطط…':'اختر الخطة'} options={plans.map(item=>({value:String(item.id),label:item.name}))}/>
      {planError&&<><p className="text-xs text-red-600 dark:text-red-300">{planError}</p><ProjectButton variant="ghost" onClick={()=>setRevision(n=>n+1)}>إعادة تحميل الخطط</ProjectButton></>}
      {plan&&<p className="text-xs leading-6 text-slate-600 dark:text-slate-300">{plan.duration_months} شهرًا · PPPoE {plan.max_subscribers||'غير محدود'} · NAS {plan.max_nas||'غير محدود'}</p>}
     </div>:<>
      {([{key:'duration',label:'المدة بالأشهر (1–120)'},{key:'maxPppoe',label:'حد حسابات PPPoE'},{key:'maxNas',label:'حد أجهزة NAS (0–1024)'}] as const).map(field=><label className="min-w-0 space-y-2 text-xs font-semibold" key={field.key}><span>{field.label}</span><ProjectInput inputMode="numeric" dir="ltr" maxLength={field.key==='duration'?3:field.key==='maxNas'?4:16} disabled={busy} value={form[field.key]} onChange={e=>{if(/^[0-9]*$/.test(e.target.value))set(field.key,e.target.value);}}/></label>)}
      <p className="text-xs text-slate-600 dark:text-slate-300 sm:col-span-2">الصفر في حد PPPoE أو NAS يعني سعة غير محدودة.</p>
     </>}
    </div>
   </ProjectInfoCard>
   {error&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  </div>
 </ProjectDialog>;
}
