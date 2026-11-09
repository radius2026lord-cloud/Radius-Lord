"use client";
import {CheckCircle2, Circle, LoaderCircle, TriangleAlert, Server, ShieldCheck, Database, UserRound, KeyRound, Radio, Globe} from "lucide-react";
import CircularProgress from "@/components/ui/circular-progress";
import {ProjectInfoCard} from "@/components/ui/project-info-card";

export const environmentStages=[
 {code:"infrastructure_preflight",label:"فحص البنية التحتية",icon:ShieldCheck,color:"text-emerald-500 bg-emerald-500/10"},
 {code:"hosting_preflight",label:"التحقق من الوصول للمنصة",icon:Globe,color:"text-sky-500 bg-sky-500/10"},
 {code:"database_create",label:"إنشاء قاعدة الشبكة",icon:Database,color:"text-blue-500 bg-blue-500/10"},
 {code:"database_template",label:"تهيئة جداول الشبكة",icon:Database,color:"text-blue-500 bg-blue-500/10"},
 {code:"database_users",label:"تجهيز حسابات الاتصال",icon:KeyRound,color:"text-amber-500 bg-amber-500/10"},
 {code:"database_verify",label:"التحقق من قاعدة البيانات",icon:ShieldCheck,color:"text-emerald-500 bg-emerald-500/10"},
 {code:"network_manager",label:"إنشاء مدير الشبكة",icon:UserRound,color:"text-violet-500 bg-violet-500/10"},
 {code:"network_license",label:"تجهيز الرخصة وحدود الخطة",icon:KeyRound,color:"text-amber-500 bg-amber-500/10"},
 {code:"network_ovpn",label:"تجهيز ربط أول NAS",icon:Globe,color:"text-cyan-500 bg-cyan-500/10"},
 {code:"network_radius",label:"ربط خدمة RADIUS",icon:Radio,color:"text-teal-500 bg-teal-500/10"},
 {code:"network_radius_verify",label:"اختبار المصادقة والمحاسبة",icon:ShieldCheck,color:"text-emerald-500 bg-emerald-500/10"},
 {code:"network_database_isolation",label:"التحقق من عزل قاعدة الشبكة",icon:Database,color:"text-blue-500 bg-blue-500/10"},
 {code:"network_application_verify",label:"اختبار دخول المدير",icon:Globe,color:"text-sky-500 bg-sky-500/10"},
 {code:"environment_activation",label:"تفعيل البيئة والاشتراك",icon:Server,color:"text-indigo-500 bg-indigo-500/10"},
];
const provisioningErrors: Record<string,string> = {
 "23":"انتهت مهلة اختبار الدخول إلى المنصة.",
 NETWORK_APPLICATION_PAGE_TIMEOUT:"انتهت مهلة تحميل صفحة الشبكة.",
 NETWORK_APPLICATION_PAGE_UNREACHABLE:"تعذر الوصول إلى عنوان صفحة الشبكة.",
 NETWORK_PAGE_NOT_AVAILABLE:"صفحة الشبكة غير متاحة على عنوان المنصة.",
 NETWORK_APPLICATION_LOGIN_TIMEOUT:"انتهت مهلة استجابة خدمة اختبار دخول المدير.",
 NETWORK_APPLICATION_LOGIN_UNREACHABLE:"تعذر الاتصال بخدمة اختبار دخول المدير.",
 NETWORK_APPLICATION_LOGIN_FAILED:"لم يؤكّد التطبيق دخول مدير الشبكة.",
 NETWORK_APPLICATION_LOGIN_INVALID_RESPONSE:"أعادت خدمة اختبار الدخول استجابة غير صالحة.",
 OVPN_CERTIFICATE_EXPORT_MISMATCH:"تعذر التحقق من تصدير الشهادة بالمحاولة السابقة. أعد محاولة التجهيز لإظهار السبب المحدد.",
 OVPN_EXPORT_FILE_INCOMPLETE:"لم يكتمل ملف الشهادة أو المفتاح بعد انتظار التصدير. أعد المحاولة.",
 OVPN_EXPORT_FILE_TOO_LARGE:"حجم ملف الشهادة أو المفتاح يتجاوز حد التصدير المدعوم.",
 OVPN_EXPORT_FILE_AMBIGUOUS:"وجدت ملفات تصدير متعارضة على CHR؛ لم يُعتمد أي منها.",
 OVPN_EXPORT_CLEANUP_FAILED:"تعذر حذف ملفات التصدير المؤقتة من CHR. أعد المحاولة لاستكمال تنظيفها والتجهيز.",
 OVPN_EXPORT_CA_PARSE_FAILED:"تعذر قراءة شهادة جهة الإصدار المصدرة من CHR.",
 OVPN_EXPORT_CLIENT_PARSE_FAILED:"تعذر قراءة شهادة اتصال NAS المصدرة.",
 OVPN_EXPORT_CA_FINGERPRINT_MISMATCH:"بصمة شهادة جهة الإصدار المصدرة تختلف عن الشهادة المحددة على CHR.",
 OVPN_EXPORT_CLIENT_FINGERPRINT_MISMATCH:"بصمة شهادة NAS المصدرة تختلف عن الشهادة المحددة على CHR.",
 OVPN_EXPORT_KEY_CIPHER_UNSUPPORTED:"تشفير المفتاح المصدر غير مدعوم بإصدار Node.js/OpenSSL الحالي. راجع سجل الباك إند.",
 OVPN_EXPORT_KEY_DECRYPT_FAILED:"تعذر فك المفتاح المصدر بعبارة التصدير المحددة. راجع سجل الباك إند.",
 OVPN_EXPORT_PRIVATE_KEY_MISMATCH:"المفتاح المصدر لا يطابق شهادة اتصال NAS.",
 OVPN_EXPORT_SIGNATURE_INVALID:"توقيع شهادة NAS لا يطابق جهة الإصدار المحددة.",
 OVPN_EXPORT_CERTIFICATE_DATES_INVALID:"تواريخ الشهادة المصدرة غير صالحة للقراءة.",
 OVPN_CERTIFICATE_CLOCK_MISMATCH:"تاريخ بدء صلاحية الشهادة في المستقبل. راجع تزامن ساعة CHR وجهاز تشغيل الباك إند ثم أعد المحاولة.",
 OVPN_EXPORT_CERTIFICATE_EXPIRED:"انتهت صلاحية شهادة NAS أو جهة إصدارها. يلزم تجديد الشهادة المنتهية.",

};

type Step={step_code:string;status:string;error_code:string|null};
export default function EnvironmentProgress({job,requesting=false}:{job?:{status:string;currentStep:string|null;errorCode:string|null;steps?:Step[]}|null;requesting?:boolean}){
 const stages=job?.status==='success'&&!job.steps?.some(s=>s.step_code==='network_ovpn')?environmentStages.filter(s=>s.code!=='network_ovpn'):environmentStages;
 const active=requesting||job?.status==='queued'||job?.status==='running';
 const completed=stages.filter(stage=>job?.steps?.some(s=>s.step_code===stage.code&&s.status==='success')).length;
 const percent=Math.round(completed/stages.length*100);
 const failed=job?.status==='failed',done=job?.status==='success';
 const current=stages.find(stage=>stage.code===job?.currentStep);
 return <section className="rl-surface rounded-[24px] bg-white p-5 dark:bg-[#0d243b] sm:p-6">
  <div className="flex flex-wrap items-center gap-5"><CircularProgress value={requesting?null:percent} label="نسبة المراحل المكتملة" tone={failed?'danger':done?'success':'neutral'}/><div className="min-w-0 flex-1"><h2 className="flex items-center gap-2 text-base font-bold text-[#17386d] dark:text-slate-200">{active?<LoaderCircle className="h-5 w-5 animate-spin text-blue-500 motion-reduce:animate-none"/>:failed?<TriangleAlert className="h-5 w-5 text-red-500"/>:<CheckCircle2 className="h-5 w-5 text-emerald-500"/>}{requesting?'التحقق قبل بدء التجهيز':done?'اكتمل تجهيز البيئة':failed?'توقف التجهيز ويحتاج معالجة':'يجري تجهيز البيئة'}</h2><p role="status" className="mt-2 text-xs leading-6 text-slate-500">{requesting?'جارٍ إرسال الطلب والتحقق من المتطلبات.':job?.status==='queued'?'تم تسجيل الطلب وبانتظار العامل.':current?.label??'متابعة مراحل التجهيز'}</p><p className="mt-1 text-xs text-slate-500">{completed} من {stages.length} مراحل مكتملة · النسبة تعتمد على نتائج التنفيذ الفعلية.</p></div></div>
  <ol className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">{stages.map((stage,index)=>{const saved=job?.steps?.find(s=>s.step_code===stage.code),status=saved?.status??'pending',running=active&&!requesting&&status==='running',passed=status==='success',failure=status==='failed',Icon=stage.icon;return <li key={stage.code}><ProjectInfoCard tone={passed?'success':failure?'danger':running?'info':'pending'} className={`flex h-full items-start gap-3 transition-colors duration-300 ${running?'ring-2 ring-blue-500/15':''}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${stage.color}`}><Icon className="h-5 w-5"/></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold leading-6">{stage.label}</p><p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">{running?<LoaderCircle className="h-3.5 w-3.5 animate-spin text-blue-500 motion-reduce:animate-none"/>:passed?<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500"/>:failure?<TriangleAlert className="h-3.5 w-3.5 text-red-500"/>:<Circle className="h-3.5 w-3.5 text-slate-400"/>}{passed?'اكتملت':failure?'فشلت':running?'جارٍ المعالجة':'بانتظار التنفيذ'}</p>{failure&&saved?.error_code&&<p className="mt-1 break-words text-[11px] leading-5 text-red-600 dark:text-red-300">{provisioningErrors[saved.error_code]??saved.error_code}</p>}</div><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-[10px] tabular-nums text-slate-400 dark:bg-white/5">{index+1}</span></ProjectInfoCard></li>;})}</ol>
 </section>;
}
