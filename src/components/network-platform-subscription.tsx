"use client";
import {useEffect,useRef,useState} from 'react';
import NetworkSubscriptionUpgradeDialog,{type UpgradeRequest} from './network-subscription-upgrade-dialog';
import ProjectTooltip from './ui/project-tooltip';
import {Wallet,KeyRound,Globe,ChevronDown,FileText,Hourglass,CalendarCheck,Copy,ArrowUpRight,CalendarDays,Clock3,Users,Server,Wifi,ShieldCheck,MessageCircle,Send,RefreshCw,CheckCircle2,AlertTriangle,Mail,Phone} from 'lucide-react';
import CircularProgress from './ui/circular-progress';
import {ProjectCardDetails,ProjectCardIcon,ProjectInfoCard} from './ui/project-info-card';
import ProjectButton from './ui/project-button';
import ProjectLoading from './ui/project-loading';
import FloatingNotice from './ui/floating-notice';
import {useClock24h} from './ui/project-clock-provider';
export type SubscriptionMeta={restricted?:boolean;tenantId:number;subscriptionId:number;timezone:string;startsAt:string|null;expiresAt:string|null;serverNow:string;reminderDays:number;reminder:'soon'|'expired'|null;contact:{whatsapp:string|null;email:string|null;phone:string|null}};
type Capacity={used:number;limit:number;available:number|null;overLimit:boolean};
type UpgradePayment={amount:string;currency:string;transferCode:string;methodName?:string};
type Details=SubscriptionMeta&{upgradeReceipt?:UpgradePayment&{appliedAt:string};recentChange?:{appliedAt:string;renewed:boolean;upgraded:boolean;upgradePayment?:UpgradePayment|null};planName:string;license:string;status:string;durationMonths:number;syncVersion:number;upgradeRequest:UpgradeRequest|null;pppoe:Capacity;nas:Capacity;hotspotAccounts:number;renewalRequest:{status:string;requestedAt:string}|null};
export function useSubscriptionNow(serverNow?:string){
 const anchor=useRef({server:0,local:0});const [now,setNow]=useState<number|null>(null);
 useEffect(()=>{const server=serverNow?Date.parse(serverNow):NaN;if(!Number.isFinite(server)){setNow(null);return;}anchor.current={server,local:performance.now()};const update=()=>setNow(anchor.current.server+performance.now()-anchor.current.local);update();const timer=setInterval(update,30000);return()=>clearInterval(timer);},[serverNow]);
 return now;
}
export function subscriptionIsDue(meta:SubscriptionMeta|undefined,now:number|null){return Boolean(meta?.restricted||meta?.expiresAt&&now!==null&&Date.parse(meta.expiresAt)-now<=meta.reminderDays*86400000);}
function CapacityCard({title,data,Icon}:{title:string;data:Capacity;Icon:typeof Users}){
 const ratio=data.limit>0?data.used/data.limit*100:null,tone=data.overLimit?'danger':ratio!==null&&ratio>=85?'warning':Icon===Server?'connections':'info';
 const progressTone=tone==='connections'?'info':tone;
 return <ProjectInfoCard tone={tone}><h3 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={Icon} tone={tone}/>{title}</h3><div className="mt-4 flex flex-wrap items-center justify-between gap-4"><CircularProgress value={ratio} label={`المستخدم من ${title}`} caption={data.limit===0?'غير محدود':'من سعة الخطة'} tone={progressTone} valueText={data.limit===0?'∞':undefined}/><dl className="min-w-0 flex-1 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">المستخدم</dt><dd className="font-semibold tabular-nums">{data.used.toLocaleString('ar')}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">حد الخطة</dt><dd>{data.limit===0?'غير محدود':data.limit.toLocaleString('ar')}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">المتاح للإضافة</dt><dd className="font-semibold">{data.available===null?'غير محدود':data.available.toLocaleString('ar')}</dd></div></dl></div>{data.overLimit&&<p className="mt-3 text-xs text-red-600 dark:text-red-300">الاستخدام يتجاوز الحد الحالي؛ الإضافة متوقفة دون حذف الحسابات الموجودة.</p>}</ProjectInfoCard>;
}
export default function NetworkPlatformSubscription({endpoint,networkName}:{endpoint:string;networkName:string}){
 const [data,setData]=useState<Details|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[revision,setRevision]=useState(0),[upgradeOpen,setUpgradeOpen]=useState(false);
 const [detailsOpen,setDetailsOpen]=useState(false);
 const clock24h=useClock24h(),now=useSubscriptionNow(data?.serverNow);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');fetch(`${endpoint}/platform-subscription`,{credentials:'include',cache:'no-store',signal:controller.signal}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.message||'تعذر تحميل الاشتراك.');if(!controller.signal.aborted)setData(j);}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل الاشتراك.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[endpoint,revision]);
 useEffect(()=>{
  const change=data?.recentChange;
  if(!data||!change)return;
  const key=`radius:subscription-change:${data.tenantId}:${change.appliedAt}`;
  try{if(localStorage.getItem(key))return;localStorage.setItem(key,'seen');}catch{}
  if(change.upgradePayment){
   const payment=change.upgradePayment;
   setMessage(`تمت ترقية سعة خطتك. قيمة الترقية ${payment.amount} ${payment.currency}، ورمز التحويل ${payment.transferCode}${payment.methodName?` عبر ${payment.methodName}`:''}.`);
   return;
  }
  setMessage(change.renewed&&change.upgraded?'تم تجديد اشتراكك وترقية سعة خطتك.':change.renewed?'تم تجديد اشتراكك. يظهر موعد الانتهاء الجديد في بيانات الاشتراك.':'تمت ترقية سعة خطتك. تظهر الحدود الجديدة في بطاقة استخدام السعة.');
 },[data?.tenantId,data?.recentChange?.appliedAt,data?.recentChange?.renewed,data?.recentChange?.upgraded]);
 async function requestRenewal(){if(busy)return;setBusy(true);setError('');try{const r=await fetch(`${endpoint}/platform-subscription/renewal-request`,{method:'POST',credentials:'include'}),j=await r.json();if(!r.ok)throw Error(j.message||'تعذر تسجيل الطلب.');setData(d=>d?{...d,renewalRequest:j}:d);setMessage('تم تسجيل طلب التجديد لدى الإدارة المركزية. يمكنك التواصل لاستكمال الإجراءات.');}catch(e){setError(e instanceof Error?e.message:'تعذر تسجيل الطلب.');}finally{setBusy(false);}}
 async function copyLicense(){if(!data)return;try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(data.license);else{const input=document.createElement('textarea');input.value=data.license;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);try{input.select();if(!document.execCommand('copy'))throw Error('copy');}finally{input.remove();}}setMessage('تم نسخ رقم الرخصة.');}catch{setError('تعذر النسخ التلقائي؛ يمكنك تحديد رقم الرخصة ونسخه يدويًا.');}}
 if(!data)return <div className="space-y-3">{loading?<ProjectLoading/>:<ProjectInfoCard tone="danger"><p>{error}</p><ProjectButton className="mt-3" onClick={()=>setRevision(v=>v+1)}><RefreshCw/>إعادة المحاولة</ProjectButton></ProjectInfoCard>}</div>;
 const format=(value:string|null)=>{if(!value)return 'غير متاح';try{return new Intl.DateTimeFormat('en-GB',{timeZone:data.timezone,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:!clock24h}).format(new Date(value));}catch{return 'تعذر عرض الموعد';}};
 const start=data.startsAt?Date.parse(data.startsAt):NaN,end=data.expiresAt?Date.parse(data.expiresAt):NaN,valid=Number.isFinite(start)&&Number.isFinite(end)&&end>start&&now!==null;
 const expired=data.status==='expired'||valid&&now>=end,pending=valid&&now<start,due=subscriptionIsDue(data,now),total=valid?Math.ceil((end-start)/86400000):null,elapsed=valid?Math.floor(Math.max(0,Math.min(now,end)-start)/86400000):null,remaining=valid?Math.ceil(Math.max(0,end-Math.max(now,start))/86400000):null,percent=valid?Math.max(0,Math.min(100,(now-start)/(end-start)*100)):null;
 const state=expired?'منتهٍ':pending?'لم يبدأ بعد':due?'يقترب من الانتهاء':'مفعّل',tone=expired?'danger':due?'warning':'success';
 const text=data.upgradeRequest?`مرحبًا، أتابع طلب ترقية شبكة ${networkName} رقم ${data.tenantId}. ${data.upgradeRequest.requestedPppoeLimit!==null?`حد PPPoE المطلوب: ${data.upgradeRequest.requestedPppoeLimit}.`:''} ${data.upgradeRequest.requestedNasLimit!==null?`حد NAS المطلوب: ${data.upgradeRequest.requestedNasLimit}.`:''}${data.upgradeRequest.includeRenewal?' مع طلب تجديد الاشتراك.':''}`:!due?`مرحبًا، أود الاستفسار عن خطة شبكة ${networkName} رقم ${data.tenantId} (${data.planName}).`:`مرحبًا، أود تجديد اشتراك شبكة ${networkName}. رقم الشبكة: ${data.tenantId}، رقم الاشتراك: ${data.subscriptionId}، الخطة: ${data.planName}، موعد الانتهاء: ${format(data.expiresAt)} (${data.timezone}).`;
 const whatsapp=data.contact.whatsapp?`https://wa.me/${data.contact.whatsapp}?text=${encodeURIComponent(text)}`:null;
 return <div className="space-y-5"><ProjectInfoCard className="sm:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="mb-2 text-xs text-slate-500 dark:text-slate-400">اشتراكي · {networkName}</p><h2 className="flex items-center gap-2 text-lg font-semibold"><ProjectCardIcon icon={ShieldCheck}/>{data.planName}</h2></div><div className="flex items-center gap-3"><span className={`rounded-full border px-3 py-1 text-xs font-medium ${expired?'border-red-300 text-red-700 dark:border-red-400/30 dark:text-red-300':due?'border-amber-300 text-amber-700 dark:border-amber-400/30 dark:text-amber-300':'border-emerald-300 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-300'}`}>{state}</span><ProjectTooltip label="تحديث بيانات الاشتراك"><ProjectButton variant="ghost" size="icon" aria-label="تحديث بيانات الاشتراك" disabled={loading} onClick={()=>setRevision(v=>v+1)}><RefreshCw className={loading?'animate-spin':''}/></ProjectButton></ProjectTooltip></div></div>
 <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-current/10 py-4"><div className="min-w-0 flex-1"><p className="mb-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><KeyRound className="h-4 w-4 text-blue-500" aria-hidden="true"/>رقم الرخصة</p><p dir="ltr" className="allow-text-selection select-text break-all text-right font-mono text-sm font-medium tracking-wide sm:text-base">{data.license}</p></div><ProjectTooltip label="نسخ رقم الرخصة"><ProjectButton variant="secondary" onClick={()=>void copyLicense()}><Copy/>نسخ الرخصة</ProjectButton></ProjectTooltip></div>
 <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><p className="text-xs text-slate-500 dark:text-slate-400">الشبكة #{data.tenantId} · اشتراك {data.durationMonths} شهرًا</p><div className="flex flex-wrap gap-2">{due&&<ProjectButton disabled={busy||Boolean(data.renewalRequest)||Boolean(data.upgradeRequest?.includeRenewal)} onClick={()=>void requestRenewal()}>{data.renewalRequest||data.upgradeRequest?.includeRenewal?<CheckCircle2/>:<Send/>}{busy?'جارٍ التسجيل…':data.renewalRequest||data.upgradeRequest?.includeRenewal?'طلب التجديد مسجل':'تجديد الاشتراك'}</ProjectButton>}<ProjectButton variant={due?'secondary':undefined} disabled={Boolean(data.upgradeRequest)||data.pppoe.limit===0&&data.nas.limit===0} onClick={()=>setUpgradeOpen(true)}><ArrowUpRight/>{data.upgradeRequest?'طلب الترقية قيد المراجعة':'ترقية الخطة والسعة'}</ProjectButton></div></div>{due&&<p className="mt-4 flex items-start gap-2 text-xs leading-6"><AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-500"/>{expired?'انتهى اشتراك الشبكة. يمكنك طلب التجديد من هنا.':`متبقٍ ${remaining??'—'} يوم؛ بادر بالتجديد لاستمرار صلاحية البوابة.`}</p>}</ProjectInfoCard>
 <section aria-label="صلاحية الاشتراك" className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
  <ProjectInfoCard tone={tone}>
   <h3 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={CalendarDays} tone={tone}/>موعد الانتهاء</h3>
   <p dir="ltr" className="mt-3 break-words text-right text-xl font-semibold tabular-nums sm:text-2xl">{format(data.expiresAt)}</p>
   <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><Globe className="h-4 w-4 text-blue-500" aria-hidden="true"/>المنطقة الزمنية <bdi>{data.timezone}</bdi></p>
   <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">تُعرض المواعيد حسب المنطقة الزمنية للشبكة.</p>
   <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-current/10 pt-3 text-xs">
    <span className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-emerald-500" aria-hidden="true"/>بداية الاشتراك</span>
    <bdi className="tabular-nums">{format(data.startsAt)}</bdi>
   </div>
  </ProjectInfoCard>
  <ProjectInfoCard tone="pending">
   <h3 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={Clock3} tone="pending"/>مدة الاشتراك</h3>
   <div className="mt-4 flex flex-wrap items-center gap-4">
    <CircularProgress size="sm" value={percent} label="المدة المنقضية من الاشتراك" caption="مدة منقضية" tone={tone}/>
    <dl className="grid min-w-0 basis-48 flex-1 grid-cols-3 gap-2 text-center text-xs">
     {[{label:'متبقية',value:remaining,highlight:true},{label:'منقضية',value:elapsed},{label:'الإجمالي',value:total}].map(({label,value,highlight})=>
      <div key={label} className="min-w-0"><dt className="text-slate-600 dark:text-slate-300">{label}</dt><dd className={`mt-2 text-xl font-semibold tabular-nums ${highlight?'text-indigo-700 dark:text-indigo-300':''}`}>{value?.toLocaleString('ar')??'—'}</dd></div>
     )}
    </dl>
   </div>
   <p className="mt-4 text-xs leading-6 text-slate-500 dark:text-slate-400">الأعداد بالأيام، والمتبقي يشمل جزء اليوم. العدّاد يعتمد على وقت الخادم.</p>
  </ProjectInfoCard>
 </section>
 <section aria-labelledby="subscription-capacity-heading" className="space-y-3">
  <h3 id="subscription-capacity-heading" className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={Users}/>استخدام سعة الخطة</h3>
  <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
   <CapacityCard title="حسابات PPPoE" data={data.pppoe} Icon={Users}/>
   <CapacityCard title="أجهزة NAS" data={data.nas} Icon={Server}/>
  </div>
  <ProjectInfoCard tone="pending">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <span className="flex items-center gap-2 text-sm"><ProjectCardIcon icon={Wifi} tone="pending"/>حسابات الهوتسبوت <bdi className="font-semibold">{data.hotspotAccounts.toLocaleString('ar')}</bdi></span>
    <span className="text-xs text-slate-600 dark:text-slate-300">خارج حد حسابات PPPoE</span>
   </div>
  </ProjectInfoCard>
 </section>
 {data.upgradeReceipt&&<ProjectInfoCard tone="success">
  <h3 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={CheckCircle2} tone="success"/>بيانات تحويل آخر ترقية بقيمة مالية</h3>
  <dl className="mt-4 grid min-w-0 gap-4 text-sm sm:grid-cols-2">
   <div className="min-w-0"><dt className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><ProjectCardIcon icon={Wallet} tone="success"/>قيمة الترقية</dt><dd className="mt-2 font-semibold"><bdi>{data.upgradeReceipt.amount} {data.upgradeReceipt.currency}</bdi></dd></div>
   <div className="min-w-0"><dt className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><ProjectCardIcon icon={KeyRound} tone="success"/>رمز التحويل {data.upgradeReceipt.methodName&&<bdi>· {data.upgradeReceipt.methodName}</bdi>}</dt><dd className="mt-2 select-text break-all font-mono"><bdi>{data.upgradeReceipt.transferCode}</bdi></dd></div>
  </dl>
  <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">تاريخ التطبيق <bdi>{format(data.upgradeReceipt.appliedAt)}</bdi></p>
 </ProjectInfoCard>}
 <ProjectInfoCard tone="info"><h3 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={MessageCircle} tone="connections"/>التواصل مع الإدارة المركزية</h3><div className="mt-4 flex flex-wrap items-center gap-3">{whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-emerald-300 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-300"><MessageCircle className="h-4 w-4"/>تواصل عبر واتساب</a>}{data.contact.email&&<a href={`mailto:${data.contact.email}?subject=${encodeURIComponent('طلب تجديد اشتراك شبكة '+data.tenantId)}&body=${encodeURIComponent(text)}`} className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-blue-500"/>البريد الإلكتروني</a>}{data.contact.phone&&<a href={`tel:${data.contact.phone}`} className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-sky-500"/><bdi>{data.contact.phone}</bdi></a>}</div>{data.renewalRequest&&<p className="mt-3 text-xs text-slate-500 dark:text-slate-400">تاريخ الطلب: <bdi>{format(data.renewalRequest.requestedAt)}</bdi> · بانتظار متابعة الإدارة المركزية.</p>}<p className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">تسجيل الطلب أو فتح واتساب لا يعني تأكيد الدفع أو تنفيذ التجديد.</p>{!whatsapp&&!data.contact.email&&!data.contact.phone&&<p className="mt-2 text-xs text-amber-600 dark:text-amber-300">لم تضبط الإدارة المركزية وسيلة تواصل عامة بعد؛ يبقى طلبك مسجلًا لديها.</p>}</ProjectInfoCard>
 {data.upgradeRequest&&<ProjectInfoCard tone="pending"><h3 className="flex items-center gap-2 text-sm font-semibold"><ProjectCardIcon icon={Hourglass} tone="pending"/>طلب ترقية قيد المراجعة</h3><div className="mt-3 flex flex-wrap gap-4 text-sm">{data.upgradeRequest.requestedPppoeLimit!==null&&<span>PPPoE: {data.upgradeRequest.currentPppoeLimit.toLocaleString('ar')} ← {data.upgradeRequest.requestedPppoeLimit.toLocaleString('ar')}</span>}{data.upgradeRequest.requestedNasLimit!==null&&<span>NAS: {data.upgradeRequest.currentNasLimit.toLocaleString('ar')} ← {data.upgradeRequest.requestedNasLimit.toLocaleString('ar')}</span>}</div><p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{format(data.upgradeRequest.requestedAt)}{data.upgradeRequest.includeRenewal?' · يشمل طلب تجديد الاشتراك':''}</p><p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">تُطبّق الزيادة بعد اعتماد الإدارة المركزية. يمكنك التواصل لمتابعة الطلب.</p></ProjectInfoCard>}
 <ProjectInfoCard>
  <ProjectButton variant="ghost" className="w-full justify-start" aria-expanded={detailsOpen} aria-controls="subscription-verification" onClick={()=>setDetailsOpen(open=>!open)}>
   <FileText aria-hidden="true"/>تفاصيل الاشتراك والتحقق
   <ChevronDown aria-hidden="true" className={`ms-auto transition-transform motion-reduce:transition-none ${detailsOpen?'rotate-180':''}`}/>
  </ProjectButton>
  <div id="subscription-verification">
   <ProjectCardDetails open={detailsOpen}>
    <dl className="grid gap-3 border-t border-current/10 pt-4 text-xs sm:grid-cols-3">
     <div><dt className="text-slate-600 dark:text-slate-300">رقم الاشتراك</dt><dd className="mt-2 font-semibold"><bdi>{data.subscriptionId}</bdi></dd></div>
     <div><dt className="text-slate-600 dark:text-slate-300">إصدار المزامنة</dt><dd className="mt-2 font-semibold"><bdi>{data.syncVersion}</bdi></dd></div>
     <div><dt className="text-slate-600 dark:text-slate-300">آخر تحقق</dt><dd className="mt-2 font-semibold"><bdi>{format(data.serverNow)}</bdi></dd></div>
    </dl>
   </ProjectCardDetails>
  </div>
 </ProjectInfoCard>
 {upgradeOpen&&<NetworkSubscriptionUpgradeDialog endpoint={endpoint} pppoeLimit={data.pppoe.limit} nasLimit={data.nas.limit} renewalDue={due} onClose={()=>setUpgradeOpen(false)} onSaved={request=>{setData(d=>d?{...d,upgradeRequest:request}:d);setUpgradeOpen(false);setMessage('تم تسجيل طلب الترقية لدى الإدارة المركزية.');}}/>}<FloatingNotice error={error} message={message} onDismiss={()=>{setError('');setMessage('');}}/></div>;
}

