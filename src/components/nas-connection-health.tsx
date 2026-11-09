"use client";
import {useEffect,useState} from 'react';
import {Cable,Clock3,Network,ShieldCheck,Wifi} from 'lucide-react';
import {currentNasSignal,type NasDiagnostics,type NasDiagnosticSignal,type NasDiagnosticState} from '@/lib/nas-diagnostics';
import {ProjectCardIcon,ProjectInfoCard} from './ui/project-info-card';

const reasons:Record<string,string>={
 direct_connection:'هذا الجهاز يستخدم عنوان إدارة مباشرًا دون نفق.',nas_disabled:'الجهاز متوقف من الإعدادات.',
 link_connected:'رُصد النفق على CHR.',link_disconnected:'لم يظهر النفق في آخر فحص ناجح لـ CHR.',link_check_unavailable:'تعذر فحص CHR؛ لا يعني ذلك انقطاع النفق.',link_not_checked:'بحسب آخر إشارة مسجلة؛ أعد تحديث الحالة.',
 api_disabled:'الجهاز أو خدمة API غير مفعّلين.',api_not_checked:'لم يُسجّل اختبار API بعد.',api_connected:'نجح الدخول وقراءة البيانات عبر API.',
 NAS_API_TCP_TIMEOUT:'انتهت مهلة TCP قبل تسجيل الدخول.',NAS_API_TCP_REFUSED:'رُفض الاتصال بمنفذ API.',NAS_API_ROUTE_UNAVAILABLE:'تعذر الوصول عبر المسار المحدد.',NAS_API_LOGIN_FAILED:'وصل الاتصال لكن رُفضت بيانات الدخول أو الصلاحيات.',NAS_OVPN_TUNNEL_NOT_CONNECTED:'نفق الجهاز غير متصل بحسب CHR.',
 NAS_API_SNAT_VERIFY_FAILED:'لم يُعتمد تحويل المصدر أو ترتيب قاعدته على CHR.',NAS_API_SNAT_CONFLICT:'توجد إعدادات متعارضة في قاعدة تحويل المصدر.',NAS_API_SNAT_AMBIGUOUS:'توجد قواعد تحويل مكررة للبيئة والجهاز.',
 radius_not_configured:'لم يكتمل حفظ إعداد RADIUS.',radius_no_observation:'لم تُقرأ عدادات خادم RADIUS الخاص بهذه البيئة.',radius_no_recent_response:'الإعداد محفوظ، لكن لم تُرصد زيادة حديثة في عدادات الردود.',radius_monitor_unavailable:'تعذر قراءة عدادات RADIUS؛ ليست هذه نتيجة فشل مصادقة.',radius_clients_disabled:'خادم RADIUS المحدد معطّل على الجهاز.',radius_response:'رُصد رد قبول أو رفض فعلي؛ لا يعني ذلك نجاح كل عمليات الدخول.',radius_timeout:'زادت مهلات RADIUS في فترة الرصد الأخيرة.',radius_bad_reply:'رُصدت ردود RADIUS غير صالحة.',
 reading_available:'آخر قراءة موارد محفوظة لهذا الجهاز.',reading_missing:'لم تصل قراءة موارد بعد.',
};
const labels:Record<'link'|'api'|'radius'|'readings',Partial<Record<NasDiagnosticState,string>>>={
 link:{ok:'متصل',failed:'غير متصل',unknown:'تعذر التحقق',not_applicable:'ربط مباشر'},
 api:{ok:'نجح آخر فحص',failed:'فشل آخر فحص',unknown:'بانتظار الفحص'},
 radius:{ok:'رُصدت استجابة',failed:'رد غير صالح',warning:'يحتاج مراجعة',unknown:'لم تُثبت استجابة حديثة'},
 readings:{ok:'قراءة حديثة',unknown:'بانتظار القراءة'},
};

export default function NasConnectionHealth({diagnostics,timeZone,clock24h}:{diagnostics?:NasDiagnostics;timeZone:string;clock24h:boolean}){
 const [clock,setClock]=useState({generatedAt:'',elapsed:0});
 const generatedAt=diagnostics?.generatedAt||'';
 useEffect(()=>{
  const start=performance.now();setClock({generatedAt,elapsed:0});
  const timer=window.setInterval(()=>setClock({generatedAt,elapsed:performance.now()-start}),15000);
  return ()=>window.clearInterval(timer);
 },[generatedAt]);
 if(!diagnostics)return <ProjectInfoCard tone="pending"><p className="text-xs">بانتظار تحميل تشخيص الجهاز.</p></ProjectInfoCard>;
 const serverNow=Date.parse(generatedAt)+(clock.generatedAt===generatedAt?clock.elapsed:0);
 const format=(value:string|null)=>value?new Date(value).toLocaleString('ar',{timeZone,hour12:!clock24h,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'لم يُسجّل بعد';
 const definitions=[{key:'link',title:'ربط OVPN',icon:Wifi},{key:'api',title:'اتصال API',icon:Cable},{key:'radius',title:'استجابة RADIUS',icon:ShieldCheck},{key:'readings',title:'حداثة القراءة',icon:Clock3}] as const;
 return <section className="min-w-0 space-y-3" aria-label="تشخيص اتصال NAS">
  {diagnostics.scope&&<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300"><ProjectCardIcon icon={Network}/><bdi>ENV-{diagnostics.scope.environmentId} · NAS-{diagnostics.scope.nasId}</bdi>{diagnostics.scope.gatewayId&&<bdi>CHR #{diagnostics.scope.gatewayId}</bdi>}<span>التوقيت: <bdi>{timeZone}</bdi></span></p>}
  <div className="grid min-w-0 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">{definitions.map(item=>{
   const signal:NasDiagnosticSignal=currentNasSignal(diagnostics[item.key],serverNow),state=signal.state;
   const tone=state==='ok'?'success':state==='failed'?'danger':state==='warning'||state==='stale'?'warning':state==='unknown'?'pending':'info';
   const label=state==='stale'?'قراءة قديمة':state==='disabled'?'غير مفعّل':labels[item.key][state]||'بانتظار الفحص';
   const reason=state==='stale'?'انتهت حداثة آخر نتيجة؛ حدّث الفحص قبل اعتماد الحالة.':reasons[signal.reason]||(item.key==='api'?'تعذر فحص API؛ راجع تفاصيل نتيجة الفحص.':'لم تتوفر نتيجة مؤكدة.');
   return <ProjectInfoCard key={item.key} tone={tone} className="min-w-0 !rounded-[16px] !p-3">
    <div className="flex items-center gap-2 text-xs"><ProjectCardIcon icon={item.icon} tone={tone}/><span>{item.title}</span></div>
    <p className="mt-2 text-sm font-semibold">{label}</p><p className="mt-1 text-[11px] leading-5">{reason}</p>
    <dl className="mt-3 space-y-2 border-t border-current/10 pt-3 text-[10px] leading-5"><div><dt>آخر فحص</dt><dd><bdi>{format(signal.checkedAt)}</bdi></dd></div><div><dt>{item.key==='readings'?'آخر قراءة':item.key==='radius'?'آخر استجابة مؤكدة':'آخر نجاح مسجل'}</dt><dd><bdi>{format(signal.lastSuccessAt)}</bdi></dd></div></dl>
   </ProjectInfoCard>;
  })}</div>
 </section>;
}
