"use client";
import {useClock24h} from "@/components/ui/project-clock-provider";


import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, CreditCard, RefreshCw, UserRound, Server, LoaderCircle, Package, CalendarClock, Cloud, Network, UsersRound, Router, Layers, Send, Database, ExternalLink, Mail, MessageCircle, ShieldCheck, TriangleAlert, Trash2, Copy, ChevronDown } from "lucide-react";
import { CollectionState } from "@/components/ui/collection-display";
import EnvironmentProgress from "@/components/environment-progress";
import ProjectInput from "@/components/ui/project-input";
import ProjectDialog from "@/components/ui/project-dialog";
import SubscriptionPaymentHistory from "@/components/subscription-payment-history";
import ProjectButton from "@/components/ui/project-button";
import FloatingNotice from "@/components/ui/floating-notice";
import {ProjectInfoCard,ProjectCardDetails,ProjectCardIcon} from "@/components/ui/project-info-card";
import {environmentAction,type EnvironmentAction} from "@/lib/environment-actions";
import ProjectTooltip from "@/components/ui/project-tooltip";

type Environment = {
  canDelete?:boolean;cleanupStatus?:string|null;archived?:boolean;registered:boolean;canRequest:boolean;canSendDetails?:boolean;blockedReason:string|null;tenantId?:number;subscriptionId?:number;
  networkName?:string;licenseNumber?:string;licenseStatus?:string;subscriptionStatus?:string;
  startsAt?:string|null;expiresAt?:string|null;status?:string;systemUrl?:string|null;readyAt?:string|null;
  health?:{databaseName:string|null;reportedAt:string|null;lastSeenAt:string|null;databaseStatus:string;radiusStatus:string};
  job?:{id:number;status:string;currentStep:string|null;attemptCount:number;errorCode:string|null;steps?:Array<{step_code:string;status:string;error_code:string|null}>}|null;
};
type Subscription = {
  environment:Environment;
  id:number; customerId:number; customerName:string; customerUsername:string|null; customerEmail:string;
  paymentCode:string; planName:string; durationMonths:number; deploymentName:string|null;
  basePrice:string; addonsTotal:string; totalAmount:string; currency:string;
  planLimits:{maxTenants:number;maxSubscribers:number;maxNas:number}|null;
  addons:{name:string;price:string|null}[]; status:string; requestedAt:string|null; paidAt:string|null; confirmedBy:string|null;
};

export default function SubscriptionDetailsPage(){
 const clock24h=useClock24h();

  const {id}=useParams<{id:string}>();
  const router=useRouter();
  const [detailsSection,setDetailsSection]=useState<"plan"|"history"|"technical"|null>(null),[optionsOpen,setOptionsOpen]=useState(false);
  const [reviewOpen,setReviewOpen]=useState(false),[actionCode,setActionCode]=useState("");
  const [deleteOpen,setDeleteOpen]=useState(false),[deleteName,setDeleteName]=useState("");
  const [requesting,setRequesting]=useState(false),[progressOpen,setProgressOpen]=useState(false);
  const [infrastructureWarning,setInfrastructureWarning]=useState("");
  const [delivery,setDelivery]=useState<{text:string;whatsappUrl:string|null;emailUrl:string|null}|null>(null);
  const [submitting,setSubmitting]=useState(false),[notice,setNotice]=useState(""),[actionError,setActionError]=useState("");
  const [item,setItem]=useState<Subscription|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError("");setItem(null);setDelivery(null);
    fetch(`/api/billing/admin/subscriptions/${encodeURIComponent(id)}`,{credentials:"include",cache:"no-store",signal:controller.signal})
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.message||"تعذر تحميل تفاصيل الاشتراك.");if(!controller.signal.aborted)setItem(data.subscription);})
      .catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"تعذر تحميل تفاصيل الاشتراك.");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[id,revision]);
  useEffect(()=>{if(!item?.environment.job||!["queued","running"].includes(item.environment.job.status))return;const controller=new AbortController();let active=false;const timer=setInterval(async()=>{if(active)return;active=true;try{const r=await fetch(`/api/billing/admin/subscriptions/${encodeURIComponent(id)}`,{credentials:"include",cache:"no-store",signal:controller.signal});if(r.ok){const j=await r.json();if(!controller.signal.aborted)setItem(j.subscription);}}catch{/* Keep last state; manual refresh remains available. */}finally{active=false;}},5000);return()=>{clearInterval(timer);controller.abort();};},[id,item?.environment.job?.status]);
  const infrastructureBlocked=Boolean(item?.environment.blockedReason?.startsWith('افحص صحة البنية التحتية')||item?.environment.job?.errorCode==='INFRASTRUCTURE_NOT_READY');
  useEffect(()=>{if(infrastructureBlocked)setInfrastructureWarning("لا يمكن توليد البيئة قبل نجاح فحوص البنية التحتية. افتح صفحة التحقق لمعالجة الخدمات غير الجاهزة ثم أعد المحاولة.");else setInfrastructureWarning("");},[infrastructureBlocked]);
  const guidance=item?environmentAction(item.environment,item.status):null;
  function openNetwork(){if(!item?.environment.systemUrl)return;const url=new URL(item.environment.systemUrl,window.location.origin);if(["http:","https:"].includes(url.protocol))window.open(url.href,"_blank","noopener,noreferrer");}
  function followAction(action:EnvironmentAction){
    if(action.kind==='purchase')setReviewOpen(true);
    else if(action.kind==='progress')setProgressOpen(true);
    else if(action.kind==='cleanup'){setDeleteName("");setDeleteOpen(true);}
    else if(action.href){const returnTo=`/Dashboard/subscriptions/${encodeURIComponent(id)}`;router.push(action.href+(action.href.includes('?')?'&':'?')+'returnTo='+encodeURIComponent(returnTo));}
  }
  const noticeGuidance=actionError?item&&actionCode?environmentAction(item.environment,item.status,actionCode):null:infrastructureWarning?environmentAction({canRequest:false,blockedReason:'صحة البنية التحتية'},item?.status??'paid'):notice&&item&&['queued','running'].includes(item.environment.job?.status??'')?guidance:null;
  async function copyDelivery(){if(!delivery)return;try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(delivery.text);else{const field=document.createElement('textarea');field.value=delivery.text;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);try{field.focus();field.select();if(!document.execCommand('copy'))throw new Error();}finally{field.remove();}}setNotice("نُسخت الرسالة بتنسيقها. الصقها مباشرة في واتساب.");}catch{setActionError("تعذر النسخ التلقائي؛ حدد نص الرسالة وانسخه يدويًا.");}}
  async function removeEnvironment(){if(submitting||!item?.environment.canDelete||deleteName!==item.environment.networkName)return;setSubmitting(true);setNotice("");setActionError("");setActionCode("");try{const r=await fetch(`/api/billing/admin/subscriptions/${encodeURIComponent(id)}/environment`,{method:"DELETE",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmName:deleteName})}),j=await r.json();if(!r.ok)throw new Error(j.message);setDeleteOpen(false);setDeleteName("");setDelivery(null);setNotice(j.message);setRevision(v=>v+1);}catch(e){setActionError(e instanceof Error?e.message:"تعذر حذف البيئة.");setRevision(v=>v+1);}finally{setSubmitting(false);}}
  async function sendDetails(){if(submitting||item?.environment.status!=="ready")return;setSubmitting(true);setActionError("");setActionCode("");setNotice("");try{const r=await fetch(`/api/billing/admin/subscriptions/${encodeURIComponent(id)}/environment/send-details`,{method:"POST",credentials:"include"}),j=await r.json();if(!r.ok)throw new Error(j.message);setNotice(j.message);setDelivery(j);}catch(e){setActionError(e instanceof Error?e.message:"تعذر طلب الإرسال.");}finally{setSubmitting(false);}}
  async function requestEnvironment(){
    if(submitting || !item?.environment.canRequest)return;
    setSubmitting(true);setRequesting(true);setProgressOpen(true);setNotice("");setActionError("");setActionCode("");
    try{
      const response=await fetch(`/api/billing/admin/subscriptions/${encodeURIComponent(id)}/environment`,{method:"POST",credentials:"include"});
      const data=await response.json();
      if(!response.ok){setActionCode(data.code||'');if(data.code==='INFRASTRUCTURE_NOT_READY'||data.message?.includes('صحة البنية التحتية')){setInfrastructureWarning(data.message||"البنية التحتية غير جاهزة للتوليد.");setProgressOpen(false);return;}throw new Error(data.message||"تعذر تسجيل طلب إنشاء البيئة.");}
      setItem(current=>current?{...current,environment:data.environment}:current);
      setNotice("تم تسجيل طلب إنشاء البيئة. مدة الاشتراك لم تبدأ بعد.");
    }catch(reason){setProgressOpen(false);setActionError(reason instanceof Error?reason.message:"تعذر تسجيل طلب إنشاء البيئة.");}
    finally{setSubmitting(false);setRequesting(false);}
  }
  return <div className="space-y-4">
    <FloatingNotice error={actionError} warning={infrastructureWarning} message={notice} action={noticeGuidance?{label:noticeGuidance.label,onClick:()=>followAction(noticeGuidance)}:undefined} onDismiss={()=>{setActionError("");setActionCode("");setInfrastructureWarning("");setNotice("");}}/>
    <ProjectDialog open={reviewOpen} title="بيانات الطلب المطلوبة للتجهيز" description="الدفع وبيانات التجهيز حالتان منفصلتان. يظهر هنا ما يحتاج إلى مراجعة." onClose={()=>setReviewOpen(false)} footer={<><ProjectButton variant="back" onClick={()=>setReviewOpen(false)}><ArrowRight/>رجوع</ProjectButton>{item&&!["paid","completed"].includes(item.status)&&<ProjectButton onClick={()=>router.push(`/Dashboard/payments?code=${encodeURIComponent(item.paymentCode)}`)}><CreditCard/>عرض عملية الدفع</ProjectButton>}</>}>
      {item&&<div className="space-y-4"><ProjectInfoCard tone="warning"><p className="text-xs leading-7">{guidance?.description||item.environment.blockedReason}</p></ProjectInfoCard><dl className="grid gap-4 sm:grid-cols-2"><Field label="كود الشراء"><bdi>{item.paymentCode}</bdi></Field><Field label="الخطة وقت الشراء">{item.planName}</Field><Field label="الاستضافة المحفوظة">{item.deploymentName||"غير محفوظة"}</Field><Field label="المدة المحفوظة">{item.durationMonths>0?`${item.durationMonths} شهر`:"غير محفوظة"}</Field><Field label="حدود الشراء">{item.planLimits?`شبكات: ${formatLimit(item.planLimits.maxTenants)} · حسابات: ${formatLimit(item.planLimits.maxSubscribers)} · NAS: ${formatLimit(item.planLimits.maxNas)}`:"غير محفوظة — يلزم مراجعة السجل الأصلي"}</Field></dl><p className="text-xs leading-7 text-slate-500">هذه مراجعة للطلب. فتح عملية الدفع لا يثبت حدودًا ناقصة ولا يغيّر الطلب. عند نقص الحدود، يلزم تثبيتها من بيانات الشراء الأصلية بواسطة المسؤول قبل إتاحة التوليد.</p></div>}
    </ProjectDialog>
    <ProjectDialog open={deleteOpen} title="حذف موارد البيئة التجريبية" description="حذف قاعدة الشبكة وحساباتها وإعداد FreeRADIUS الخاص بها نهائيًا. يبقى سجل الاشتراك والدفع محفوظًا. لا يمكن التراجع عن الحذف." danger busy={submitting} onClose={()=>setDeleteOpen(false)} footer={<><ProjectButton variant="secondary" disabled={submitting} onClick={()=>setDeleteOpen(false)}>إلغاء</ProjectButton><ProjectButton className="bg-red-600 hover:bg-red-700" disabled={submitting||!deleteName||deleteName!==item?.environment.networkName} onClick={()=>void removeEnvironment()}><Trash2/>{submitting?"جارٍ تنظيف الموارد...":"حذف البيئة نهائيًا"}</ProjectButton></>}><p className="mb-3 text-xs leading-6 text-slate-500">الدخول ورابط التفعيل يتوقفان عند بدء التنظيف. تُمنع العملية أثناء التجهيز أو عند وجود موارد غير مدارة. يشمل التنظيف أنفاق NAS المدارة وشهاداتها. عند فشل خطوة يمكن إعادة الحذف لاستكمال التنظيف.</p><label className="rl-field-label">اكتب اسم الشبكة: {item?.environment.networkName}<ProjectInput className="mt-2" value={deleteName} onChange={e=>setDeleteName(e.target.value)} autoComplete="off"/></label></ProjectDialog>
    <ProjectDialog open={progressOpen} title="متابعة تجهيز البيئة" description="تُحدّث المراحل تلقائيًا. يمكنك إغلاق النافذة ومتابعة التجهيز من صفحة الاشتراك." onClose={()=>setProgressOpen(false)} maxWidth="max-w-5xl" footer={<><ProjectButton variant="back" onClick={()=>setProgressOpen(false)}><ArrowRight/>العودة إلى الاشتراك</ProjectButton>{guidance&&["navigate","purchase"].includes(guidance.kind)&&<ProjectButton onClick={()=>{setProgressOpen(false);followAction(guidance);}}><ExternalLink/>{guidance.label}</ProjectButton>}</>}><EnvironmentProgress job={item?.environment.job} requesting={requesting}/></ProjectDialog>
    <section className="rl-surface flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-white p-4 dark:bg-[#0d243b]"><div className="min-w-0"><h1 className="flex items-center gap-2 text-base font-semibold text-[#17386d] dark:text-slate-200"><CreditCard className="h-5 w-5 shrink-0 text-[#0758e9]"/>تفاصيل الاشتراك</h1><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">بيانات العميل والخطة وعملية الدفع</p></div><div className="flex flex-wrap items-center gap-2">
      <ProjectTooltip label="العودة إلى عرض الاشتراكات"><ProjectButton variant="back" size="icon" aria-label="العودة إلى عرض الاشتراكات" onClick={()=>router.push("/Dashboard/subscriptions")}><ArrowRight/></ProjectButton></ProjectTooltip>
      <ProjectButton variant="secondary" disabled={loading||submitting} onClick={()=>setRevision(value=>value+1)}><RefreshCw/>تحديث</ProjectButton>
    </div></section>
    {loading?<CollectionState loading>جارٍ تحميل تفاصيل الاشتراك...</CollectionState>:error?<CollectionState><span role="alert">{error}</span></CollectionState>:item&&<>
      <ProjectDialog open={Boolean(delivery)} title="تسليم بيانات التفعيل" description="راجع المستلم والرابط المؤقت قبل إرسال الرسالة من حساب واتساب أو البريد." onClose={()=>setDelivery(null)} footer={<ProjectButton variant="back" onClick={()=>setDelivery(null)}><ArrowRight/>رجوع</ProjectButton>}>
       {delivery&&<div className="space-y-4"><ProjectInfoCard><p className="text-sm font-semibold">{item.customerName}</p><p className="mt-1 break-all text-xs text-slate-500">{item.customerEmail}</p><p className="mt-2 text-xs leading-6 text-slate-500">هذه رسالة جاهزة للإرسال اليدوي. فتح التطبيق لا يؤكد إرسالها أو استلامها.</p></ProjectInfoCard><pre className="[unicode-bidi:plaintext] whitespace-pre-wrap break-words rounded-[18px] border border-slate-200 bg-slate-50 p-4 text-xs leading-7 dark:border-white/10 dark:bg-white/5">{delivery.text}</pre><div className="grid gap-3 sm:grid-cols-3"><ProjectButton variant="secondary" onClick={()=>void copyDelivery()}><Copy className="text-violet-500"/>نسخ الرسالة</ProjectButton><ProjectButton disabled={!delivery.whatsappUrl} onClick={()=>{if(delivery.whatsappUrl)window.open(delivery.whatsappUrl,'_blank','noopener,noreferrer');}}><MessageCircle/>فتح رسالة واتساب</ProjectButton><ProjectButton variant="secondary" disabled={!delivery.emailUrl} onClick={()=>{if(delivery.emailUrl)window.location.href=delivery.emailUrl;}}><Mail className="text-blue-500"/>فتح رسالة البريد</ProjectButton></div><p className="text-xs leading-6 text-slate-500">إذا دمج واتساب الأسطر عند فتح الرابط، استخدم «نسخ الرسالة» والصقها مباشرة في المحادثة.</p>{!delivery.whatsappUrl&&<p className="text-xs text-amber-600">أضف رقم واتساب دوليًا صحيحًا إلى ملف العميل لتفعيل الزر.</p>}{!delivery.emailUrl&&<p className="text-xs text-amber-600">راجع البريد الإلكتروني في ملف العميل لتفعيل الزر.</p>}</div>}
      </ProjectDialog>
      <div className="grid gap-3 sm:grid-cols-3">
        <ProjectInfoCard tone={["paid","completed"].includes(item.status)?"success":"warning"}><div className="flex items-center gap-2"><ProjectCardIcon icon={CreditCard} tone={["paid","completed"].includes(item.status)?"success":"warning"}/><h2 className="text-xs font-semibold">الدفع</h2></div><p className="mt-3 text-sm font-bold">{paymentLabel(item.status)}</p><p className="mt-1 text-xs text-slate-500"><bdi>{item.totalAmount} {item.currency}</bdi></p></ProjectInfoCard>
        <ProjectInfoCard tone={item.environment.status==="ready"&&!item.environment.archived?"success":item.environment.job?.status==="failed"?"warning":"pending"}><div className="flex items-center gap-2"><ProjectCardIcon icon={Server} tone="connections"/><h2 className="text-xs font-semibold">البيئة</h2></div><p className="mt-3 text-sm font-bold">{environmentLabel(item.environment,item.status)}</p><p className="mt-1 text-xs text-slate-500">{item.deploymentName||"الاستضافة غير محفوظة"}</p></ProjectInfoCard>
        <ProjectInfoCard tone={item.environment.subscriptionStatus==="active"&&!item.environment.archived?"success":"pending"}><div className="flex items-center gap-2"><ProjectCardIcon icon={CalendarClock} tone="memory"/><h2 className="text-xs font-semibold">فترة الاشتراك</h2></div><p className="mt-3 text-sm font-bold">{item.environment.archived?"التشغيل متوقف":item.environment.startsAt?`بدأت ${formatDate(item.environment.startsAt,clock24h)}`:"تبدأ بعد جاهزية البيئة"}</p><p className="mt-1 text-xs text-slate-500">{item.environment.expiresAt?`تنتهي ${formatDate(item.environment.expiresAt,clock24h)}`:`المدة: ${item.durationMonths} شهر`}</p></ProjectInfoCard>
      </div>
      <Panel title="الخطوة التالية">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#17386d] dark:text-slate-200"><Server className="h-5 w-5 shrink-0 text-violet-500"/>{item.environment.archived?"راجع سجل البيئة":item.environment.status==="ready"?"يمكنك الدخول إلى شبكة العميل":!["paid","completed"].includes(item.status)?"أكد استلام الدفعة للمتابعة":guidance?.kind==="purchase"?"بيانات التجهيز تحتاج مراجعة":guidance?.kind==="progress"?"تابع تقدم تجهيز الشبكة":"تجهيز شبكة العميل"}</p>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-500 dark:text-slate-400">{item.environment.blockedReason&&item.environment.status!=="ready"?item.environment.blockedReason:environmentDescription(item.environment,item.status)}</p>
          </div>
          {item.environment.status==="ready"&&!item.environment.archived&&item.environment.systemUrl?<ProjectButton onClick={openNetwork}><ExternalLink/>فتح واجهة الشبكة</ProjectButton>:!item.environment.canRequest&&guidance?<ProjectButton variant="secondary" disabled={submitting} onClick={()=>followAction(guidance)} className="min-h-10 w-full sm:w-auto"><ExternalLink className="text-blue-500"/>{guidance.label}</ProjectButton>:item.environment.canRequest?<ProjectTooltip label="تسجيل طلب إنشاء البيئة">
            <ProjectButton disabled={submitting||!item.environment.canRequest} onClick={()=>void requestEnvironment()} className="min-h-10 w-full sm:w-auto">
              {submitting?<LoaderCircle className="animate-spin"/>:<Server/>}{submitting?"جارٍ تسجيل الطلب...":item.environment.job?.status==="failed"?"إعادة محاولة التجهيز":"إنشاء البيئة"}
            </ProjectButton>
          </ProjectTooltip>:null}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {item.environment.canRequest&&guidance&&<ProjectButton variant="secondary" disabled={submitting} onClick={()=>followAction(guidance)}><ExternalLink className="text-blue-500"/>{guidance.label}</ProjectButton>}
          {item.environment.canSendDetails&&<ProjectButton variant="secondary" disabled={submitting} onClick={()=>void sendDetails()}><Send className="text-emerald-500"/>تسليم رابط التفعيل</ProjectButton>}
          {(item.environment.canDelete||item.environment.job&&!item.environment.archived)&&<ProjectButton variant="ghost" aria-expanded={optionsOpen} disabled={submitting} onClick={()=>setOptionsOpen(v=>!v)}><ChevronDown className={optionsOpen?"rotate-180":""}/>خيارات البيئة</ProjectButton>}
        </div>
        <ProjectCardDetails open={optionsOpen}><ProjectInfoCard tone="pending" className="mt-3"><div className="flex flex-wrap gap-3">
          {item.environment.job&&!item.environment.archived&&<ProjectButton variant="secondary" onClick={()=>setProgressOpen(true)}><Layers className="text-blue-500"/>مراحل التجهيز</ProjectButton>}
          {item.environment.canDelete&&<ProjectButton variant="secondary" className="border-red-200 text-red-600 dark:text-red-400" disabled={submitting} onClick={()=>{setDeleteName("");setDeleteOpen(true);}}><Trash2/>{item.environment.cleanupStatus==='failed'?"استكمال حذف البيئة":"حذف البيئة التجريبية"}</ProjectButton>}
        </div></ProjectInfoCard></ProjectCardDetails>


      </Panel>

      <section className="space-y-3"><div className="flex flex-wrap gap-2" aria-label="تفاصيل إضافية للاشتراك">{([{key:'plan',label:'الخطة والعميل',icon:Package},{key:'history',label:'سجل الدفع',icon:CreditCard},{key:'technical',label:'التشخيص الفني',icon:Database}] as const).map(section=><ProjectButton key={section.key} variant={detailsSection===section.key?'primary':'secondary'} aria-expanded={detailsSection===section.key} onClick={()=>setDetailsSection(current=>current===section.key?null:section.key)}><section.icon/>{section.label}<ChevronDown className={detailsSection===section.key?'rotate-180':''}/></ProjectButton>)}</div>
      <ProjectCardDetails open={detailsSection==='plan'}><div className="space-y-3 pt-1">{item.environment.registered&&<Panel title="هوية الشبكة والرخصة"><dl className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 dark:border-white/10 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="الشبكة">{item.environment.networkName||"—"}</Field>
          <Field label="رقم الرخصة"><bdi className="font-mono">{item.environment.licenseNumber||"—"}</bdi></Field>
          <Field label="بداية الاشتراك">{item.environment.startsAt?formatDate(item.environment.startsAt,clock24h):"بعد جاهزية البيئة"}</Field>
          <Field label="انتهاء الاشتراك">{formatDate(item.environment.expiresAt||null,clock24h)}</Field>
        </dl></Panel>}<div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="الخطة المختارة">
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-[18px] bg-gradient-to-l from-blue-50 to-indigo-50/50 p-4 dark:from-blue-500/10 dark:to-indigo-500/5">
            <div className="flex min-w-0 flex-1 items-start gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"><Package className="h-6 w-6"/></span><div className="min-w-0"><h3 className="break-words text-base font-bold text-[#17386d] dark:text-slate-200">{item.planName}</h3><p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">بيانات الخطة المحفوظة عند الشراء</p></div></div>
            <div className="min-w-0"><p className="text-[10px] text-slate-500 dark:text-slate-400">قيمة الخطة</p><p className="mt-1 text-lg font-bold text-blue-600 dark:text-blue-300"><bdi>{item.basePrice} {item.currency}</bdi></p></div>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2"><PlanMetric label="الاستضافة" icon={<Cloud className="h-5 w-5 text-cyan-500"/>}>{item.deploymentName||"—"}</PlanMetric><PlanMetric label="مدة الاشتراك" icon={<CalendarClock className="h-5 w-5 text-amber-500"/>}>{item.durationMonths} شهر</PlanMetric></dl>
          <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/10"><h3 className="mb-3 text-xs font-semibold">السعة المشمولة</h3>
            {item.planLimits?<dl className="grid gap-3 sm:grid-cols-3"><PlanMetric label="الشبكات" icon={<Network className="h-5 w-5 text-blue-500"/>}>{formatLimit(item.planLimits.maxTenants)}</PlanMetric><PlanMetric label="حسابات PPPoE" icon={<UsersRound className="h-5 w-5 text-emerald-500"/>}>{formatLimit(item.planLimits.maxSubscribers)}</PlanMetric><PlanMetric label="أجهزة NAS" icon={<Router className="h-5 w-5 text-violet-500"/>}>{formatLimit(item.planLimits.maxNas)}</PlanMetric></dl>:<p className="text-xs leading-6 text-slate-500 dark:text-slate-400">لم تُحفظ حدود الخطة لهذا الطلب القديم.</p>}
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/10"><h3 className="mb-3 flex items-center gap-2 text-xs font-semibold"><Layers className="h-4 w-4 text-violet-500"/>الإضافات المختارة</h3>
            {item.addons.length?<ul className="divide-y divide-slate-100 text-xs dark:divide-white/10">{item.addons.map((addon,index)=><li key={index} className="flex flex-wrap items-start justify-between gap-2 py-2"><span className="min-w-0 break-words">{addon.name}</span>{addon.price!==null&&<bdi className="shrink-0">{addon.price} {item.currency}</bdi>}</li>)}</ul>:<p className="text-xs text-slate-500 dark:text-slate-400">لا توجد إضافات.</p>}
          </div>
        </Panel>
        <Panel title="بيانات العميل">
          <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-blue-50 text-blue-500 dark:bg-blue-500/10"><UserRound className="h-5 w-5"/></span><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-[#17386d] dark:text-slate-200">{item.customerName}</p>{item.customerUsername&&<p className="mt-1 text-xs text-slate-400"><bdi>@{item.customerUsername}</bdi></p>}</div></div>
          <dl className="mt-4 border-t border-slate-100 pt-4 dark:border-white/10"><Field label="البريد الإلكتروني">{item.customerEmail}</Field></dl>
          <ProjectButton variant="secondary" className="mt-4 w-full sm:w-auto" onClick={()=>router.push(`/Dashboard/customers/${item.customerId}?from=subscriptions`)}><UserRound className="text-blue-500"/>عرض ملف العميل</ProjectButton>
        </Panel>
      </div><ProjectButton variant="back" onClick={()=>setDetailsSection(null)}><ArrowRight/>إغلاق التفاصيل</ProjectButton></div></ProjectCardDetails>
      <ProjectCardDetails open={detailsSection==='history'}><div className="space-y-3 pt-1">{detailsSection==='history'&&<SubscriptionPaymentHistory orderId={item.id}/>}<ProjectButton variant="back" onClick={()=>setDetailsSection(null)}><ArrowRight/>إغلاق السجل</ProjectButton></div></ProjectCardDetails>
      <ProjectCardDetails open={detailsSection==='technical'}><Panel title="التشخيص الفني">{item.environment.registered&&<div className="mt-4 rounded-[14px] border border-slate-100 p-3 dark:border-white/10"><p className="flex items-center gap-2 text-sm font-semibold"><Database className={item.environment.health?.databaseStatus==="healthy"?"text-emerald-500":"text-amber-500"}/>اتصال قاعدة بيانات البيئة</p><p className="mt-2 text-xs text-slate-500">{item.environment.health?.databaseStatus==="healthy"?"آخر قراءة مسجلة: الاتصال سليم":item.environment.health?.databaseStatus==="unavailable"?"فشل اتصال البيئة بقاعدة البيانات؛ يحتاج إلى معالجة":item.environment.health?.databaseStatus==="degraded"?"آخر قراءة مسجلة: الاتصال يحتاج مراجعة":"لم يصل تحقق فعلي من اتصال البيئة بعد"}</p><p className="mt-1 text-xs text-slate-400">اسم القاعدة: <bdi>{item.environment.health?.databaseName||"لم تُنشأ بعد"}</bdi> · وقت آخر تقرير: {formatDate(item.environment.health?.reportedAt||null,clock24h)}</p></div>}{!item.environment.registered&&<p className="text-xs text-slate-500">تظهر قراءات الاتصال بعد تسجيل البيئة وتجهيز مواردها.</p>}{item.environment.job&&!item.environment.archived&&<ProjectButton variant="secondary" className="mt-3" onClick={()=>setProgressOpen(true)}><Layers/>عرض نتائج المراحل</ProjectButton>}<ProjectButton variant="back" className="mt-3 ms-2" onClick={()=>setDetailsSection(null)}><ArrowRight/>إغلاق التشخيص</ProjectButton></Panel></ProjectCardDetails>
      </section>

    </>}
  </div>;
}
function Panel({title,children}:{title:string;children:ReactNode}){return <section className="rl-surface min-w-0 rounded-[22px] bg-white p-4 sm:p-5 dark:bg-[#0d243b]"><h2 className="mb-4 text-sm font-semibold text-[#17386d] dark:text-slate-200">{title}</h2>{children}</section>}
function Field({label,children}:{label:string;children:ReactNode}){return <div className="min-w-0"><dt className="text-[11px] text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words text-xs font-semibold text-[#17386d] [overflow-wrap:anywhere] dark:text-slate-200">{children}</dd></div>}
function formatDate(value:string|null,clock24h:boolean=true){if(!value)return "—";const date=new Date(value);return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("ar",{dateStyle:"medium",timeStyle:"short",hour12:!clock24h}).format(date)}

function formatLimit(value:number){return value===0?"غير محدود":new Intl.NumberFormat("ar").format(value)}

function paymentLabel(status:string){return ["paid","completed"].includes(status)?"الدفع مكتمل":status==="cancelled"?"الدفع ملغى":status==="expired"?"طلب الدفع منتهي":status==="awaiting_confirmation"?"بانتظار تأكيد الاستلام":"بانتظار الدفع";}
function environmentLabel(environment:Environment,paymentStatus:string){
  if(environment.cleanupStatus==='complete')return "حُذفت موارد البيئة";
  if(environment.cleanupStatus==='failed')return "تنظيف البيئة غير مكتمل — أعد الحذف";
  if(environment.archived)return "البيئة مؤرشفة وغير متاحة";
  if(!["paid","completed"].includes(paymentStatus))return "التجهيز متاح بعد تأكيد الدفع";
  if(environment.job?.status==="queued")return "بانتظار التجهيز";
  if(environment.job?.status==="running")return "جارٍ تجهيز البيئة";
  if(environment.status==="ready")return "البيئة جاهزة";
  if(environment.job?.errorCode==="ENVIRONMENT_BOOTSTRAP_PENDING")return "بانتظار استكمال التهيئة";
  if(environment.job?.status==="failed"||environment.status==="failed")return "التجهيز يحتاج معالجة";
  return ["paid","completed"].includes(paymentStatus)?"بانتظار التجهيز":environment.registered?"بانتظار إنشاء البيئة":"لم يُثبت سجل البيئة بعد";
}

function environmentDescription(environment:Environment,paymentStatus:string){
  if(environment.cleanupStatus==='complete')return "أُزيلت موارد التشغيل ورابط التفعيل؛ احتُفظ بسجل الاشتراك والدفع للمراجعة.";
  if(environment.archived)return "الدخول إلى البيئة متوقف. راجع حالة التنظيف واستكمل الحذف عند الحاجة.";
  if(environment.job?.errorCode==="HOSTING_SETTINGS_REQUIRED")return "احفظ إعدادات الوصول للمخدم المحلي من إعدادات المنصة ثم أعد محاولة التجهيز. لم تبدأ مدة الاشتراك.";
  if(environment.job?.errorCode==="HOSTING_SETTINGS_INVALID")return "راجع IP المخدم ومنفذ التطبيق أو إعدادات الدومين المحفوظة، ثم أعد محاولة التجهيز. لم تبدأ مدة الاشتراك.";
  if(environment.job?.errorCode==="ENVIRONMENT_BOOTSTRAP_PENDING")return "أُنشئت قاعدة الشبكة وحسابا الاتصال وتم التحقق منهما. تبقى تهيئة حساب المدير وبيانات الاشتراك وخدمة RADIUS قبل التفعيل؛ مدة الاشتراك لم تبدأ.";
  if(environment.job?.errorCode)return `توقفت مرحلة التجهيز: ${environment.job.currentStep||"التحقق"} · رمز المشكلة: ${environment.job.errorCode}. لم تبدأ مدة الاشتراك.`;
  if(environment.status==="ready")return "البيئة جاهزة. يُتحقق من اتصال NAS بعد تطبيق سكربت الربط.";
  if(environment.job?.status==="queued")return "طلب الإنشاء مسجل وبانتظار بدء التنفيذ. مدة الاشتراك لم تبدأ بعد.";
  if(environment.job?.status==="running")return "يجري تجهيز البيئة وفق بيانات الشراء. تبدأ مدة الاشتراك بعد تحقق الجاهزية.";
  if(environment.blockedReason)return environment.blockedReason;
  if(!["paid","completed"].includes(paymentStatus))return "أكد استلام الدفعة أولًا للمتابعة.";
  return "الدفعة مؤكدة. يمكنك طلب إنشاء البيئة وفق الخطة المحفوظة عند الشراء.";
}

function PlanMetric({label,icon,children}:{label:string;icon:ReactNode;children:ReactNode}){
  return <div className="flex min-w-0 items-start gap-3 rounded-[14px] border border-slate-100 bg-slate-50/60 p-3 dark:border-white/[.06] dark:bg-white/[.025]"><span className="mt-0.5 shrink-0">{icon}</span><div className="min-w-0"><dt className="text-[10px] text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-[#17386d] dark:text-slate-200">{children}</dd></div></div>;
}
