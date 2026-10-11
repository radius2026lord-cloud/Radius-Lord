"use client";
import {CheckCircle2, Circle, LoaderCircle, TriangleAlert, Server, ShieldCheck, Database, UserRound, KeyRound, Radio, Globe} from "lucide-react";
import CircularProgress from "@/components/ui/circular-progress";
import {ProjectInfoCard} from "@/components/ui/project-info-card";

export const environmentStages=[
 {code:"infrastructure_preflight",label:"فحص البنية التحتية",icon:ShieldCheck},
 {code:"hosting_preflight",label:"التحقق من الوصول للمنصة",icon:Globe},
 {code:"database_create",label:"إنشاء قاعدة الشبكة",icon:Database},
 {code:"database_template",label:"تهيئة جداول الشبكة",icon:Database},
 {code:"database_users",label:"تجهيز حسابات الاتصال",icon:KeyRound},
 {code:"database_verify",label:"التحقق من قاعدة البيانات",icon:ShieldCheck},
 {code:"network_manager",label:"إنشاء مدير الشبكة",icon:UserRound},
 {code:"network_license",label:"تجهيز الرخصة وحدود الخطة",icon:KeyRound},
 {code:"network_radius",label:"ربط خدمة RADIUS",icon:Radio},
 {code:"network_radius_verify",label:"اختبار المصادقة والمحاسبة",icon:ShieldCheck},
 {code:"network_database_isolation",label:"التحقق من عزل قاعدة الشبكة",icon:Database},
 {code:"network_application_verify",label:"اختبار دخول المدير",icon:Globe},
 {code:"environment_activation",label:"تفعيل البيئة والاشتراك",icon:Server},
];
type Step={step_code:string;status:string;error_code:string|null};
export default function EnvironmentProgress({job,requesting=false}:{job?:{status:string;currentStep:string|null;errorCode:string|null;steps?:Step[]}|null;requesting?:boolean}){
 const active=requesting||job?.status==='queued'||job?.status==='running';
 const completed=environmentStages.filter(stage=>job?.steps?.some(s=>s.step_code===stage.code&&s.status==='success')).length;
 const percent=Math.round(completed/environmentStages.length*100);
 const failed=job?.status==='failed',done=job?.status==='success';
 const current=environmentStages.find(stage=>stage.code===job?.currentStep);
 return <section className="rl-surface rounded-[24px] bg-white p-5 dark:bg-[#0d243b] sm:p-6">
  <div className="flex flex-wrap items-center gap-5"><CircularProgress value={requesting?null:percent} label="نسبة المراحل المكتملة" tone={failed?'danger':done?'success':'neutral'}/><div className="min-w-0 flex-1"><h2 className="flex items-center gap-2 text-base font-bold text-[#17386d] dark:text-slate-200">{active?<LoaderCircle className="h-5 w-5 animate-spin text-blue-500 motion-reduce:animate-none"/>:failed?<TriangleAlert className="h-5 w-5 text-red-500"/>:<CheckCircle2 className="h-5 w-5 text-emerald-500"/>}{requesting?'التحقق قبل بدء التجهيز':done?'اكتمل تجهيز البيئة':failed?'توقف التجهيز ويحتاج معالجة':'يجري تجهيز البيئة'}</h2><p role="status" className="mt-2 text-xs leading-6 text-slate-500">{requesting?'جارٍ إرسال الطلب والتحقق من المتطلبات.':job?.status==='queued'?'تم تسجيل الطلب وبانتظار العامل.':current?.label??'متابعة مراحل التجهيز'}</p><p className="mt-1 text-xs text-slate-500">{completed} من {environmentStages.length} مراحل مكتملة · النسبة تعتمد على نتائج التنفيذ الفعلية.</p></div></div>
  <ol className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">{environmentStages.map((stage,index)=>{const saved=job?.steps?.find(s=>s.step_code===stage.code),status=saved?.status??'pending',running=active&&!requesting&&status==='running',passed=status==='success',failure=status==='failed',Icon=stage.icon;return <li key={stage.code}><ProjectInfoCard tone={passed?'success':failure?'danger':running?'info':'pending'} className={`flex h-full items-start gap-3 transition-colors duration-300 ${running?'ring-2 ring-blue-500/15':''}`}><span className="relative mt-0.5 shrink-0">{running?<LoaderCircle className="h-5 w-5 animate-spin text-blue-500 motion-reduce:animate-none"/>:passed?<CheckCircle2 className="h-5 w-5 text-emerald-500"/>:failure?<TriangleAlert className="h-5 w-5 text-red-500"/>:<Circle className="h-5 w-5 text-slate-300 dark:text-slate-600"/>}</span><div className="min-w-0 flex-1"><p className="flex items-start gap-1.5 text-xs font-semibold leading-5"><Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${passed?'text-emerald-500':failure?'text-red-500':running?'text-blue-500':'text-slate-400'}`}/>{stage.label}</p><p className="mt-1 text-[11px] text-slate-500">{passed?'اكتملت':failure?'فشلت':running?'جارٍ المعالجة':'بانتظار التنفيذ'}</p>{failure&&saved?.error_code&&<p className="mt-1 break-all text-[10px] text-red-500">{saved.error_code}</p>}</div><span className="text-[10px] tabular-nums text-slate-400">{index+1}</span></ProjectInfoCard></li>;})}</ol>
 </section>;
}
