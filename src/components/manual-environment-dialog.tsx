"use client";
import NasDirectFields,{emptyDirectNas,validDirectNas} from './nas-direct-fields';
import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {CalendarClock,CreditCard,Database,Globe,KeyRound,Mail,Network,Phone,Server,UserRound,Users} from 'lucide-react';
import {arabCountries,defaultArabCountry} from '@/components/auth/auth-content';
import {CountryPhoneInput} from './ui/country-phone-input';
import ProjectButton from './ui/project-button';
import ProjectDialog from './ui/project-dialog';
import ProjectDropdown from './ui/project-dropdown';
import ProjectInput from './ui/project-input';
import {ProjectCardIcon,ProjectInfoCard} from './ui/project-info-card';

type Plan={id:number;name:string;duration_months:number;max_subscribers:number;max_nas:number};
const endpoint='/api/billing/admin/manual-environment';
const empty={networkName:'',fullName:'',email:'',phone:'',customerId:'',planId:'',duration:'',maxPppoe:'',maxNas:''};

export default function ManualEnvironmentDialog({onClose,onCreated}:{onClose:()=>void;onCreated:(orderId:number)=>void}){
 const [connectionMode,setConnectionMode]=useState('ovpn'),[directNas,setDirectNas]=useState({...emptyDirectNas}),[apiPort,setApiPort]=useState('8728');
 const linkValid=connectionMode==='ovpn'||validDirectNas(directNas)&&Number.isInteger(Number(apiPort))&&Number(apiPort)>0&&Number(apiPort)<=65535;
 const [form,setForm]=useState(empty),[plans,setPlans]=useState<Plan[]>([]);
 const [customerMode,setCustomerMode]=useState('new'),[planMode,setPlanMode]=useState('plan');
 const [busy,setBusy]=useState(false),[loadingPlans,setLoadingPlans]=useState(true),[error,setError]=useState(''),[planError,setPlanError]=useState(''),[revision,setRevision]=useState(0);
 const requestId=useRef('');
 const fieldsRef=useRef<HTMLDivElement>(null);
 const [customers,setCustomers]=useState<{id:number;fullName:string;email:string|null;phone:string|null;status:string}[]>([]);
 const [customerError,setCustomerError]=useState('');
 const [availability,setAvailability]=useState<{name:string;status:'available'|'taken'|'error'}>();
 const [nameRetry,setNameRetry]=useState(0);
 const [country,setCountry]=useState(defaultArabCountry),[review,setReview]=useState(false);
 const phoneLimit=15-country.code.replace(/\D/g,'').length;
 const internationalPhone=form.phone?country.code+form.phone:'';
 const emailValid=!form.email.trim()||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())&&/^[!-~]+$/.test(form.email.trim());
 const phoneValid=!internationalPhone||/^\+[0-9]{7,15}$/.test(internationalPhone);
 const name=form.networkName.trim();
 const nameValid=/^[A-Za-z0-9][A-Za-z0-9 -]{0,14}$/.test(name);
 const nameStatus=nameValid&&availability?.name===name?availability.status:undefined;
 const nameError=/\p{Script=Arabic}/u.test(form.networkName)?'الأحرف العربية غير مسموحة في اسم الشبكة.':name&&!nameValid?'استخدم حتى 15 محرفًا من الأحرف الإنكليزية والأرقام والمسافات والشرطات، وابدأ بحرف أو رقم.':nameStatus==='taken'?'اسم الشبكة مستخدم. اختر اسمًا آخر.':nameStatus==='error'?'تعذر التحقق من الاسم.':'';
 const customer=customers.find(item=>String(item.id)===form.customerId);
 useEffect(()=>{
  if(!nameValid)return;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   try{
    const response=await fetch(endpoint+'/name-availability?'+new URLSearchParams({name}),{credentials:'include',cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error();
    const data=await response.json();
    if(!controller.signal.aborted)setAvailability({name,status:data.available?'available':'taken'});
   }catch{if(!controller.signal.aborted)setAvailability({name,status:'error'});}
  },300);
  return ()=>{clearTimeout(timer);controller.abort();};
 },[name,nameValid,nameRetry]);
 useEffect(()=>{
  if(customerMode!=='existing')return;
  const controller=new AbortController();
  fetch('/api/admin/customers',{credentials:'include',cache:'no-store',signal:controller.signal})
   .then(async response=>{if(!response.ok)throw Error();return response.json();})
   .then(data=>{if(!controller.signal.aborted){setCustomers((data.customers??[]).filter((item:{status:string})=>item.status==='active'));setCustomerError('');}})
   .catch(()=>{if(!controller.signal.aborted)setCustomerError('تعذر تحميل العملاء. أعد اختيار نوع الحساب للمحاولة.');});
  return ()=>controller.abort();
 },[customerMode]);
 function advance(event:KeyboardEvent<HTMLDivElement>){
  if(event.key!=='Enter'||event.nativeEvent.isComposing||!(event.target instanceof HTMLInputElement)||event.target.closest('[role="listbox"]'))return;
  const input=event.target;
  const fields=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input:not([disabled]):not([type=search]):not([type=hidden]),button[aria-haspopup]:not([disabled])'));
  if(input.type==='search'||input.closest('[role="combobox"]'))return;
  event.preventDefault();
  if(!input.reportValidity()||input.getAttribute('aria-invalid')==='true')return;
  if(input.name==='networkName'&&nameStatus!=='available')return;
  const next=fields[fields.indexOf(input)+1];
  if(next)next.focus();
  else openReview();
 }

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
 const accountValid=nameStatus==='available'&&(customerMode==='existing'?Boolean(customer):Boolean(form.fullName.trim())&&emailValid&&phoneValid);
 function openReview(){
  const invalid=fieldsRef.current?.querySelector<HTMLElement>('input:not([type=hidden]):invalid,[aria-invalid="true"]');
  if(invalid){
   invalid.focus();
   if(invalid instanceof HTMLInputElement)invalid.reportValidity();
   return;
  }
  if(!accountValid||!planValid||!linkValid){
   const field=nameStatus!=='available'?'[name="networkName"]':!accountValid?'[data-existing-customer] button[aria-haspopup]':!linkValid?'[data-nas-fields] input':'[data-plan-fields] button[aria-haspopup], [data-plan-fields] input';
   fieldsRef.current?.querySelector<HTMLElement>(field)?.focus();
   setError(!accountValid?'تحقق من توفر اسم الشبكة وأكمل بيانات العميل.':!linkValid?'راجع بيانات ربط NAS.':'راجع بيانات الاشتراك والسعة.');
   return;
  }
  setError('');
  setReview(true);
 }
 async function submit(){
  if(busy||!accountValid||!planValid||!linkValid)return;
  if(!requestId.current)requestId.current=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
  setBusy(true);setError('');
  try{
   const response=await fetch(endpoint,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    ...form,networkName:name,nasLink:connectionMode==='direct'?{...directNas,mode:'direct',apiPort:Number(apiPort)}:{mode:'ovpn'},phone:internationalPhone,country:country.name,customerMode,planMode,requestId:requestId.current,
    duration:Number(form.duration),maxPppoe:Number(form.maxPppoe),maxNas:Number(form.maxNas),
   })});
   const data=await response.json();if(!response.ok){
    if(data.code==='NETWORK_NAME_TAKEN'){setAvailability({name,status:'taken'});setReview(false);}
    throw Error(data.message||'تعذر تسجيل طلب التجهيز.');
   }
   onCreated(Number(data.orderId));
  }catch(e){setError(e instanceof Error?e.message:'تعذر تسجيل طلب التجهيز.');}
  finally{setBusy(false);}
 }
 return <ProjectDialog title={review?"مراجعة بيانات التوليد":"توليد بيئة جديدة"} description="اعتماد إداري لبيئة على الاستضافة المشتركة. يبدأ الاشتراك بعد اكتمال التجهيز." onClose={onClose} busy={busy} hostingerStyle footer={<>
  <ProjectButton variant="secondary" disabled={busy} onClick={()=>{if(review){setReview(false);setError('');}else onClose();}}>{review?"تعديل البيانات":"إلغاء"}</ProjectButton>
  <ProjectButton disabled={busy} onClick={()=>review?void submit():openReview()}><Server/>{busy?'جارٍ فحص الجاهزية وتسجيل الطلب…':review?'تأكيد وتوليد البيئة':'مراجعة البيانات'}</ProjectButton>
 </>}>
  <div className="space-y-4">
  {review?<div className="space-y-4">
   <ProjectInfoCard>
    <h2 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={Network}/>هوية الشبكة والعميل</h2>
    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
     <ReviewField label="اسم الشبكة" icon={Network} value={form.networkName}/>
     <ReviewField label="حساب العميل" icon={UserRound} value={customerMode==='new'?form.fullName:customer?.fullName}/>
     <ReviewField label="البريد الإلكتروني" icon={Mail} value={(customerMode==='new'?form.email:customer?.email)||undefined}/>
     {customerMode==='new'&&<>
      <ReviewField label="الهاتف" icon={Phone} value={internationalPhone||undefined}/>
      <ReviewField label="الدولة" icon={Globe} value={country.name}/>
     </>}
    </dl>
   </ProjectInfoCard>
   <ProjectInfoCard tone="pending">
    <h2 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={CreditCard} tone="pending"/>الخطة والسعة</h2>
    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
     <ReviewField label="الخطة" icon={CreditCard} value={planMode==='custom'?'اشتراك مخصص':plan?.name}/>
     <ReviewField label="المدة بالأشهر" icon={CalendarClock} value={planMode==='custom'?form.duration:plan?.duration_months}/>
     <ReviewField label="حد PPPoE" icon={Users} value={(planMode==='custom'?Number(form.maxPppoe):plan?.max_subscribers)||'غير محدود'}/>
     <ReviewField label="حد NAS" icon={Server} value={(planMode==='custom'?Number(form.maxNas):plan?.max_nas)||'غير محدود'}/>
    </dl>
   </ProjectInfoCard>
   <ProjectInfoCard>
    <h2 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={Network}/>طريقة اتصال NAS</h2>
    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
     <ReviewField label="الربط" icon={Network} value={connectionMode==='direct'?'مباشر · دون OVPN':'OVPN · تجهيز تلقائي'}/>
     {connectionMode==='direct'&&<><ReviewField label="عنوان الإدارة" icon={Server} value={directNas.managementAddress}/><ReviewField label="مصدر NAS لدى RADIUS" icon={Network} value={directNas.radiusAddress||directNas.managementAddress}/><ReviewField label="مصدر API المسموح" icon={Globe} value={directNas.apiSourceAddress}/><ReviewField label="مستخدم API" icon={UserRound} value={directNas.apiUsername}/><ReviewField label="منفذ API" icon={KeyRound} value={apiPort}/></>}
    </dl>
   </ProjectInfoCard>
   <ProjectInfoCard>
    <h2 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={Database}/>قاعدة بيانات الشبكة</h2>
    <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">سينشئ عامل التجهيز قاعدة مستقلة على الاستضافة المشتركة. يُحدَّد اسمها من رقم الشبكة بعد تسجيل الطلب، وتُحفظ حدود الخطة في رخصتها المحلية.</p>
   </ProjectInfoCard>
  </div>:<div ref={fieldsRef} className="space-y-4" onKeyDown={advance}>
   <ProjectInfoCard>
    <h2 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={UserRound}/>العميل والشبكة</h2>
    <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
     <div className="min-w-0 space-y-2"><p className="text-xs font-semibold">حساب العميل</p><ProjectDropdown fieldStyle value={customerMode} disabled={busy} onChange={setCustomerMode} icon={UserRound} options={[{value:'new',label:'إنشاء عميل جديد'},{value:'existing',label:'عميل موجود'}]}/></div>
     <div className="min-w-0 space-y-2 text-xs font-semibold">
      <label htmlFor="manual-network-name" className="flex items-center gap-2"><ProjectCardIcon icon={Network}/>اسم الشبكة (إلزامي)</label>
      <ProjectInput id="manual-network-name" name="networkName" required dir="ltr" maxLength={15} disabled={busy} value={form.networkName} onChange={e=>{if(e.target.value.trim()!==name)setAvailability(undefined);set('networkName',e.target.value);}} aria-invalid={Boolean(nameError)} aria-describedby="manual-network-status"/>
      <p id="manual-network-status" role="status" className={nameError?'text-red-700 dark:text-red-300':nameStatus==='available'?'text-emerald-700 dark:text-emerald-300':'text-slate-600 dark:text-slate-300'}>{nameError||(nameStatus==='available'?'الاسم متاح':nameValid?'جارٍ التحقق من الاسم…':'أحرف إنكليزية، حتى 15 محرفًا.')}</p>
      {nameStatus==='error'&&<ProjectButton variant="ghost" onClick={()=>{setAvailability(undefined);setNameRetry(n=>n+1);}}>إعادة التحقق</ProjectButton>}
     </div>
     {customerMode==='existing'?<div data-existing-customer className="min-w-0 space-y-2 sm:col-span-2">
      <p className="text-xs font-semibold">العميل المسجل (إلزامي)</p>
      <ProjectDropdown fieldStyle searchable value={form.customerId} disabled={busy} onChange={value=>set('customerId',value)} placeholder="اختر عميلًا نشطًا" options={customers.map(item=>({value:String(item.id),label:[item.fullName,item.email||item.phone].filter(Boolean).join(' · ')}))}/>
      {customerError&&<p role="alert" className="text-xs text-red-700 dark:text-red-300">{customerError}</p>}
     </div>:<>
      <label className="min-w-0 space-y-2 text-xs font-semibold"><span className="flex items-center gap-2"><ProjectCardIcon icon={UserRound} tone="pending"/>اسم العميل الكامل (إلزامي)</span><ProjectInput name="fullName" required maxLength={100} disabled={busy} value={form.fullName} onChange={e=>set('fullName',e.target.value)} aria-invalid={Boolean(form.fullName&&!form.fullName.trim())}/></label>
      <label className="min-w-0 space-y-2 text-xs font-semibold"><span className="flex items-center gap-2"><ProjectCardIcon icon={Mail} tone="success"/>البريد الإلكتروني (اختياري)</span><ProjectInput name="email" type="email" dir="ltr" maxLength={100} disabled={busy} value={form.email} onChange={e=>set('email',e.target.value)} aria-invalid={!emailValid}/>{!emailValid&&<span className="block text-red-700 dark:text-red-300">أدخل بريدًا إلكترونيًا صالحًا.</span>}</label>
      <div className="sm:col-span-2">
       <CountryPhoneInput countries={arabCountries} country={country} label="رقم الهاتف (اختياري)" name="phone"
        onCountryChange={value=>{setCountry(value);set('phone',form.phone.slice(0,15-value.code.replace(/\D/g,'').length));}}
        phone={form.phone} onPhoneChange={value=>set('phone',value)} maxLength={phoneLimit} minLength={Math.max(1,7-country.code.replace(/\D/g,'').length)} subtle/>
       {!phoneValid&&<p className="text-xs text-red-700 dark:text-red-300">أدخل رقم هاتف دوليًا صالحًا.</p>}
      </div>
     </>}
    </div>
   </ProjectInfoCard>
   <ProjectInfoCard>
    <h2 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={Network}/>ربط أجهزة الشبكة</h2>
    <div className="mt-4 space-y-4" data-nas-fields>
     <ProjectDropdown fieldStyle value={connectionMode} disabled={busy} onChange={setConnectionMode} icon={Network} options={[{value:'ovpn',label:'عبر OVPN · تجهيز تلقائي'},{value:'direct',label:'مباشر · IP محلي أو موجّه دون OVPN'}]}/>
     <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">طريقة الربط مستقلة عن نوع الخطة وموقع استضافة البوابة. تجهز البيئة أولًا ويبقى اتصال الجهاز بانتظار تطبيق السكربت.</p>
     {connectionMode==='direct'&&<><NasDirectFields value={directNas} disabled={busy} onChange={(key,value)=>setDirectNas(current=>({...current,[key]:value}))}/><label className="block space-y-2 text-xs font-semibold"><span>منفذ API</span><ProjectInput required type="number" dir="ltr" min={1} max={65535} disabled={busy} value={apiPort} onChange={e=>setApiPort(e.target.value)}/></label></>}
    </div>
   </ProjectInfoCard>
   <ProjectInfoCard tone="pending">
    <h2 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={CreditCard} tone="pending"/>الاشتراك والسعة</h2>
    <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
     <div className="min-w-0 space-y-2"><p className="text-xs font-semibold">نوع الاشتراك</p><ProjectDropdown fieldStyle value={planMode} disabled={busy} onChange={setPlanMode} options={[{value:'plan',label:'خطة معتمدة'},{value:'custom',label:'اشتراك مخصص خارج الخطط'}]}/></div>
     {planMode==='plan'?<div data-plan-fields className="min-w-0 space-y-2"><p className="text-xs font-semibold">الخطة</p><ProjectDropdown fieldStyle searchable value={form.planId} disabled={busy||loadingPlans} onChange={value=>set('planId',value)} placeholder={loadingPlans?'جارٍ تحميل الخطط…':'اختر الخطة'} options={plans.map(item=>({value:String(item.id),label:item.name}))}/>
      {planError&&<><p className="text-xs text-red-600 dark:text-red-300">{planError}</p><ProjectButton variant="ghost" onClick={()=>setRevision(n=>n+1)}>إعادة تحميل الخطط</ProjectButton></>}
      {plan&&<p className="text-xs leading-6 text-slate-600 dark:text-slate-300">{plan.duration_months} شهرًا · PPPoE {plan.max_subscribers||'غير محدود'} · NAS {plan.max_nas||'غير محدود'}</p>}
     </div>:<>
      {([{key:'duration',label:'المدة بالأشهر (1–120)'},{key:'maxPppoe',label:'حد حسابات PPPoE'},{key:'maxNas',label:'حد أجهزة NAS (0–1024)'}] as const).map(field=><label className="min-w-0 space-y-2 text-xs font-semibold" key={field.key} data-plan-fields><span>{field.label}</span><ProjectInput required inputMode="numeric" dir="ltr" maxLength={field.key==='duration'?3:field.key==='maxNas'?4:16} disabled={busy} value={form[field.key]} onChange={e=>{if(/^[0-9]*$/.test(e.target.value))set(field.key,e.target.value);}}/></label>)}
      <p className="text-xs text-slate-600 dark:text-slate-300 sm:col-span-2">الصفر في حد PPPoE أو NAS يعني سعة غير محدودة.</p>
     </>}
    </div>
   </ProjectInfoCard>
  </div>}
   {error&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  </div>
 </ProjectDialog>;
}

function ReviewField({label,icon,value}:{label:string;icon:Parameters<typeof ProjectCardIcon>[0]['icon'];value?:string|number}){
 return <div className="min-w-0">
  <dt className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><ProjectCardIcon icon={icon}/>{label}</dt>
  <dd className="mt-1 break-words text-sm font-semibold"><bdi>{value??'—'}</bdi></dd>
 </div>;
}
