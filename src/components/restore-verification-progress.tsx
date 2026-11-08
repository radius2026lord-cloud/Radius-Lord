"use client";
import {Settings2,Database,ShieldCheck,Trash2,CheckCircle2,AlertTriangle,LoaderCircle,Clock3,Timer,CalendarCheck} from "lucide-react";
import {ProjectInfoCard,ProjectCardIcon} from "@/components/ui/project-info-card";
import CircularProgress from "@/components/ui/circular-progress";

export type RestoreCheckView={id?:string;status:string;result:{status?:string;error?:string;tables?:number;views?:number;cleanupComplete?:boolean};createdAt?:string;startedAt?:string|null;finishedAt?:string|null;durationSeconds?:number|null};
export function checkError(code?:string){
 const messages:Record<string,string>={RESTORE_SERVER_TOOLS_REQUIRED:"أدوات خادم MySQL غير متوفرة.",RESTORE_MYSQL8_REQUIRED:"يلزم MySQL 8 للفحص.",RESTORE_INITIALIZE_FAILED:"تعذّرت تهيئة MySQL المؤقت؛ راجع صلاحيات المسار وAppArmor.",RESTORE_SANDBOX_START_FAILED:"تعذّر تشغيل البيئة المؤقتة.",RESTORE_IMPORT_FAILED:"لم يكتمل استيراد النسخة.",RESTORE_SOURCE_CHECKSUM:"بصمة الملف غير مطابقة.",RESTORE_DISK_SPACE:"المساحة المؤقتة غير كافية.",RESTORE_TABLE_CHECK_FAILED:"لم يجتز أحد الجداول فحص السلامة.",RESTORE_CLEANUP_FAILED:"لم يكتمل تنظيف البيئة المؤقتة؛ يلزم مراجعة الخادم.",RESTORE_TIMEOUT:"انتهت مهلة الفحص.",RESTORE_REMOTE_UNAVAILABLE:"تعذّر التحقق من المهمة على الخادم.",RESTORE_WORKER_INTERRUPTED:"توقّف عامل الفحص.",RESTORE_ISOLATION_FAILED:"أُوقف الفحص لعدم اجتياز تحقق العزل.",RESTORE_NO_TABLES:"لم توجد جداول مستعادة.",RESTORE_QUERY_FAILED:"تعذّر فحص الجداول."};
 return code?messages[code]??"تعذّر إكمال الفحص المعزول. راجع اتصال الخادم.":"";
}
export default function RestoreVerificationProgress({check,timezone}:{check:RestoreCheckView|null|undefined;timezone:string}){
 const done=check?.status==="succeeded"&&check.result.cleanupComplete===true,failed=check?.status==="failed",running=["queued","running"].includes(check?.status??"");
 const state=check?.result.status??"queued";
 const stages=[{name:"التهيئة",value:"initializing",Icon:Settings2},{name:"الاستيراد",value:"importing",Icon:Database},{name:"فحص الجداول",value:"checking",Icon:ShieldCheck},{name:"التنظيف",value:"cleaning",Icon:Trash2}];
 const phase=done?4:failed?-1:Math.max(0,stages.findIndex(s=>s.value===state));
 const waiting=!check||check.status==="queued"||state==="queued"||state==="waiting_remote";
 const caption=!check?"لم يبدأ":done?"اكتمل الفحص":failed?"تعذّر الفحص":waiting?"بانتظار الفحص":stages[phase]?.name??"جارٍ الفحص";
 const seconds=check?.durationSeconds;
 return <ProjectInfoCard tone={done?"success":failed?"danger":"pending"} className="space-y-4">
 <div className="flex flex-wrap items-center gap-4"><CircularProgress value={failed||!check?null:phase/4*100} valueText={failed?"!":!check?"—":phase+"/4"} label="المراحل المكتملة في فحص الاستعادة" caption={caption} tone={done?"success":failed?"danger":"pending"} size="md"/><div className="min-w-0 flex-1"><h3 className="flex items-center gap-2 text-sm font-medium"><ProjectCardIcon icon={done?CheckCircle2:failed?AlertTriangle:running&&!waiting?LoaderCircle:Clock3} tone={done?"success":failed?"danger":"pending"}/>{done?"نجح فحص الاستعادة المعزول":failed?"تعذّر فحص الاستعادة":!check?"اختر النسخة وابدأ الفحص":waiting?"بانتظار بدء الفحص":"جارٍ "+caption}</h3><p className="mt-2 text-xs leading-6 text-slate-500">الدائرة تبيّن المراحل المكتملة، وليست نسبة حجم البيانات المستوردة.</p>{check?.result.error&&<p role="status" className="mt-2 text-xs leading-6 text-red-600 dark:text-red-400">{checkError(check.result.error)}</p>}</div></div>
 <ol className="grid gap-3 sm:grid-cols-2">{stages.map((stage,index)=>{
  const complete=done||phase>index,active=running&&!waiting&&index===phase;
  return <li key={stage.value} aria-current={active?"step":undefined} className="flex min-w-0 items-center gap-2 rounded-xl border border-current/10 p-3 text-xs"><stage.Icon className={"size-4 shrink-0 "+(complete?"text-emerald-500":active?"text-violet-500":"text-slate-400")}/><span className="min-w-0 flex-1">{stage.name}</span>{complete?<CheckCircle2 className="size-3.5 text-emerald-500"/>:active?<LoaderCircle className="size-3.5 animate-spin text-violet-500 motion-reduce:animate-none"/>:<Clock3 className="size-3.5 text-slate-400"/>}</li>;
 })}</ol>
 {check&&<div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4"><div><p className="flex gap-1.5 text-[11px] text-slate-500"><Database className="size-4 text-teal-500"/>الجداول المستعادة</p><p className="mt-2 text-sm">{check.result.tables??"—"}</p></div><div><p className="flex gap-1.5 text-[11px] text-slate-500"><Timer className="size-4 text-cyan-500"/>{running?"المدة حتى آخر تحديث":"مدة الفحص"}</p><p className="mt-2 text-sm tabular-nums">{seconds===null||seconds===undefined?"—":Math.floor(seconds/60)+" د · "+seconds%60+" ث"}</p></div><div><p className="flex gap-1.5 text-[11px] text-slate-500"><CalendarCheck className="size-4 text-indigo-500"/>انتهاء الفحص</p><time className="mt-2 block text-xs">{check.finishedAt?new Date(check.finishedAt).toLocaleString("ar",{timeZone:timezone}):"—"}</time></div><div><p className="flex gap-1.5 text-[11px] text-slate-500"><Trash2 className="size-4 text-emerald-500"/>تنظيف البيئة المؤقتة</p><p className={"mt-2 text-xs "+(check.result.cleanupComplete?"text-emerald-600 dark:text-emerald-400":"text-slate-500")}>{check.result.cleanupComplete?"تم الحذف":running?"بانتظار الاكتمال":"غير مؤكّد"}</p></div></div>}
 </ProjectInfoCard>;
}
