"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {Database,CalendarClock,FileArchive,ShieldCheck,FlaskConical,Download,RefreshCw,History,CheckCircle2,AlertTriangle,Clock3,ChevronDown,ChevronUp,Network} from "lucide-react";
import ProjectDialog from "@/components/ui/project-dialog";
import ProjectButton from "@/components/ui/project-button";
import ProjectDropdown from "@/components/ui/project-dropdown";
import {ProjectInfoCard,ProjectCardIcon,ProjectCardDetails} from "@/components/ui/project-info-card";
import {CollectionState} from "@/components/ui/collection-display";
import RestoreVerificationProgress,{type RestoreCheckView,checkError} from "@/components/restore-verification-progress";

type Version={id:string;name:string;database_name:string;batchId:string;createdAt:string;finishedAt:string|null;bytes:number;filename:string;timezone:string;verification:string;verifiedAt:string|null;isLatest?:boolean;isLastPassed?:boolean};
type Versions={items:Version[];total:number;page:number;timezone:string;latestId:string|null;lastPassedId:string|null};
type Checks={version:Version;latest:RestoreCheckView|null;items:RestoreCheckView[];total:number;page:number;timezone:string};
type Props={anchor:{id:string;name:string;database_name:string};api:(path:string,body?:unknown)=>Promise<any>;onClose:()=>void;onNotice:(message:string,error?:boolean,warning?:boolean)=>void;revision:number};
export default function BackupRestoreReview({anchor,api,onClose,onNotice,revision}:Props){
 const [versions,setVersions]=useState<Versions>(),[selectedId,setSelectedId]=useState(anchor.id),[checks,setChecks]=useState<Checks>(),[historyPage,setHistoryPage]=useState(1),[historyOpen,setHistoryOpen]=useState(false);
 const [loading,setLoading]=useState(true),[moreBusy,setMoreBusy]=useState(false),[submitting,setSubmitting]=useState(false),[versionsError,setVersionsError]=useState(""),[checkErrorText,setCheckErrorText]=useState("");
 const requests=useRef<Record<string,string>>({}),readSequence=useRef(0);
 useEffect(()=>{let live=true;setLoading(true);setVersionsError("");void api("/versions/"+anchor.id).then((value:Versions)=>{if(live){setVersions(value);if(!value.items.some(v=>v.id===anchor.id)&&!value.total)setSelectedId("");}}).catch(error=>{if(live)setVersionsError(error instanceof Error?error.message:"تعذّر تحميل النسخ.");}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[anchor.id,api]);
 const readChecks=useCallback(async()=>{
  if(!selectedId)return;
  const sequence=++readSequence.current;
  try{const value=await api("/versions/"+selectedId+"/checks?page="+historyPage) as Checks;if(sequence===readSequence.current){setChecks(value);setCheckErrorText("");}}
  catch(error){if(sequence===readSequence.current)setCheckErrorText(error instanceof Error?error.message:"تعذّر تحميل نتائج النسخة.");}
 },[selectedId,historyPage,api]);
 useEffect(()=>{void readChecks();return()=>{readSequence.current++;};},[readChecks,revision]);
 const current=checks?.version.id===selectedId?checks:undefined;
 useEffect(()=>{
  if(!["queued","running"].includes(current?.latest?.status??""))return;
  let inFlight=false;const timer=setInterval(async()=>{if(inFlight||document.visibilityState!=="visible")return;inFlight=true;try{await readChecks();}finally{inFlight=false;}},10000);
  return()=>clearInterval(timer);
 },[current?.latest?.status,readChecks]);
 useEffect(()=>{
  if(!["succeeded","failed"].includes(current?.latest?.status??""))return;
  let live=true;void api("/versions/"+anchor.id).then((value:Versions)=>{if(live)setVersions(previous=>previous?{...value,page:previous.page,items:[...value.items,...previous.items.filter(v=>!value.items.some(n=>n.id===v.id))]}:value);}).catch(()=>{});
  return()=>{live=false;};
 },[current?.latest?.id,current?.latest?.status,anchor.id,api]);
 function select(id:string){setSelectedId(id);setHistoryPage(1);setChecks(undefined);setCheckErrorText("");readSequence.current++;}
 async function moreVersions(){
  if(!versions||moreBusy)return;setMoreBusy(true);
  try{const value=await api("/versions/"+anchor.id+"?page="+(versions.page+1)) as Versions;setVersions(previous=>previous?{...value,items:[...previous.items,...value.items.filter(v=>!previous.items.some(p=>p.id===v.id))]}:value);}
  catch(error){onNotice(error instanceof Error?error.message:"تعذّر تحميل نسخ أقدم.",true);}finally{setMoreBusy(false);}
 }
 async function start(){
  if(!selectedId||submitting)return;setSubmitting(true);
  try{requests.current[selectedId]??=crypto.randomUUID();await api("/"+selectedId+"/verify-restore",{requestId:requests.current[selectedId],confirmed:true});delete requests.current[selectedId];setHistoryPage(1);await readChecks();onNotice("أُضيف فحص النسخة المحددة إلى الطابور.");}
  catch(error){onNotice(error instanceof Error?error.message:"تعذّر بدء الفحص.",true);}finally{setSubmitting(false);}
 }
 const all=[...(versions?.items??[])];
 if(current?.version){const index=all.findIndex(v=>v.id===current.version.id);if(index<0)all.push(current.version);else all[index]={...all[index],...current.version};}
 const selected=current?.version??all.find(v=>v.id===selectedId),timezone=selected?.timezone??versions?.timezone??"UTC";
 const fmt=(at:string)=>new Date(at).toLocaleString("ar",{timeZone:timezone});
 const size=(bytes:number)=>(bytes/1024**2).toFixed(2)+" MiB";
 const comparisons=[selected,all.find(v=>v.id===versions?.latestId),all.find(v=>v.id===versions?.lastPassedId)].filter((v,index,array):v is Version=>Boolean(v)&&array.findIndex(other=>other?.id===v?.id)===index);
 const active=["queued","running"].includes(current?.latest?.status??"");
 return <ProjectDialog open hostingerStyle title="اختيار نسخة وفحص استعادتها" busy={submitting} onClose={onClose} footer={<><ProjectButton variant="secondary" disabled={submitting} onClick={onClose}>رجوع</ProjectButton>{selected&&<ProjectButton variant="secondary" disabled={submitting||Boolean(checkErrorText)} onClick={()=>{const link=document.createElement("a");link.href="/api/admin/platform-settings/database-backups/"+selected.id+"/download";link.download=selected.filename;link.click();}}><Download className="text-emerald-500"/>تنزيل النسخة المختارة</ProjectButton>}<ProjectButton disabled={submitting||active||!selected||!current||Boolean(checkErrorText)} onClick={()=>void start()}><FlaskConical/>{submitting?"جارٍ إرسال الطلب…":active?"الفحص قيد المعالجة":current?.latest?"إعادة فحص النسخة المختارة":"بدء فحص النسخة المختارة"}</ProjectButton></>}>
 <div className="min-w-0 space-y-5">
 <ProjectInfoCard tone="info" className="space-y-2"><h3 className="flex items-center gap-2 text-sm font-medium"><Network className="size-5 text-blue-500"/>{anchor.name}</h3><bdi className="block break-all text-xs">{anchor.database_name}</bdi><p className="text-[11px] text-slate-500">فحص تجريبي معزول؛ لا يستبدل بيانات الشبكة العاملة.</p></ProjectInfoCard>
 {loading?<CollectionState loading>جارٍ تحميل النسخ المتاحة…</CollectionState>:versionsError?<ProjectInfoCard tone="danger">{versionsError}</ProjectInfoCard>:!versions?.total?<CollectionState>لا توجد نسخ ناجحة متاحة لهذه القاعدة.</CollectionState>:<>
 <div className="space-y-3"><label className="block space-y-2 text-xs"><span className="flex items-center gap-2"><FileArchive className="size-4 text-violet-500"/>اختر النسخة · {versions.total} نسخة متاحة</span><ProjectDropdown searchable disabled={submitting} value={selectedId} onChange={select} placeholder="اختر نسخة" searchPlaceholder="بحث بالتاريخ أو رقم الحزمة" options={all.map(v=>({value:v.id,label:fmt(v.createdAt)+" · "+size(v.bytes),hint:(v.id===versions.latestId?"الأحدث · ":"")+(v.id===versions.lastPassedId?"آخر نسخة اجتازت فحصًا · ":"")+"حزمة "+v.batchId,info:v.filename,icon:v.verification==="succeeded"?CheckCircle2:v.verification==="failed"?AlertTriangle:FileArchive,iconClassName:v.verification==="succeeded"?"text-emerald-500":v.verification==="failed"?"text-red-500":"text-violet-500"}))}/></label><div className="flex flex-wrap items-center gap-2">{versions.latestId&&<ProjectButton variant="ghost" disabled={submitting} onClick={()=>select(versions.latestId!)}><CalendarClock className="text-blue-500"/>الأحدث</ProjectButton>}{versions.lastPassedId&&<ProjectButton variant="ghost" disabled={submitting} onClick={()=>select(versions.lastPassedId!)}><ShieldCheck className="text-emerald-500"/>آخر نسخة اجتازت فحصًا</ProjectButton>}{versions.items.length<versions.total&&<ProjectButton variant="ghost" disabled={moreBusy||submitting} onClick={()=>void moreVersions()}><History className="text-violet-500"/>{moreBusy?"جارٍ التحميل…":"تحميل نسخ أقدم"}</ProjectButton>}</div></div>
 {selected&&<ProjectInfoCard tone="pending" className="space-y-2"><p className="flex items-center gap-2 text-xs"><ProjectCardIcon icon={FileArchive} tone="pending"/>النسخة المختارة</p><bdi dir="ltr" className="block break-all font-mono text-xs">{selected.filename}</bdi><div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px]"><time>{fmt(selected.createdAt)}</time><span>{size(selected.bytes)}</span><span>التوقيت · {timezone}</span></div><bdi className="block break-all text-[10px] text-slate-500">الحزمة · {selected.batchId}</bdi></ProjectInfoCard>}
 {comparisons.length>1&&<div className="grid items-start gap-4 sm:grid-cols-2">{comparisons.map(v=><ProjectInfoCard key={v.id} tone={v.id===selectedId?"info":"pending"} className="space-y-2"><p className="flex items-center gap-1.5 text-xs"><FileArchive className="size-4 text-violet-500"/>{v.id===selectedId?"المختارة":v.id===versions.latestId?"الأحدث":"آخر نسخة اجتازت فحصًا"}</p><time className="block text-[11px]">{fmt(v.createdAt)}</time><p className="text-xs">{size(v.bytes)}</p><p className="flex items-center gap-1.5 text-[11px]">{v.verification==="succeeded"?<CheckCircle2 className="size-4 text-emerald-500"/>:v.verification==="failed"?<AlertTriangle className="size-4 text-red-500"/>:<Clock3 className="size-4 text-violet-500"/>}{v.verification==="succeeded"?"آخر فحص ناجح":v.verification==="failed"?"آخر فحص متعذّر":["queued","running"].includes(v.verification)?"الفحص قيد المعالجة":"لم يُجر فحص"}</p></ProjectInfoCard>)}</div>}
 {checkErrorText?<ProjectInfoCard tone="warning"><p className="text-xs">{checkErrorText}</p><ProjectButton variant="ghost" onClick={()=>void readChecks()}><RefreshCw className="text-blue-500"/>إعادة التحميل</ProjectButton></ProjectInfoCard>:!current?<CollectionState loading>جارٍ تحميل نتيجة النسخة المختارة…</CollectionState>:<RestoreVerificationProgress check={current.latest} timezone={timezone}/>}
 {current&&<div className="space-y-3"><ProjectButton variant="ghost" onClick={()=>setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}><History className="text-violet-500"/>سجل فحوص النسخة ({current.total}){historyOpen?<ChevronUp/>:<ChevronDown/>}</ProjectButton><ProjectCardDetails open={historyOpen}><ProjectInfoCard tone="info" className="space-y-3">{current.items.length?current.items.map(check=><div key={check.id} className="space-y-2 border-b border-current/10 pb-3 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="flex items-center gap-1.5">{check.status==="succeeded"?<CheckCircle2 className="size-4 text-emerald-500"/>:check.status==="failed"?<AlertTriangle className="size-4 text-red-500"/>:<Clock3 className="size-4 text-violet-500"/>}{check.status==="succeeded"?"نجح الفحص":check.status==="failed"?"تعذّر الفحص":"قيد المعالجة"}</span><time>{check.createdAt?fmt(check.createdAt):"—"}</time></div><div className="flex flex-wrap gap-3 text-[11px] text-slate-500"><span>{check.durationSeconds===null||check.durationSeconds===undefined?"لم يبدأ":check.durationSeconds+" ثانية"}</span><span>{check.result.tables??"—"} جدولًا</span><span>{check.result.cleanupComplete?"حُذفت البيئة المؤقتة":"التنظيف غير مؤكّد"}</span></div>{check.result.error&&<p className="text-xs text-red-500">{checkError(check.result.error)}</p>}</div>):<p className="text-xs text-slate-500">لم تُجرَ فحوص لهذه النسخة.</p>}<div className="flex items-center justify-between"><ProjectButton variant="ghost" disabled={historyPage<=1} onClick={()=>setHistoryPage(p=>p-1)}>السابق</ProjectButton><span className="text-xs">{historyPage} / {Math.max(1,Math.ceil(current.total/10))}</span><ProjectButton variant="ghost" disabled={historyPage*10>=current.total} onClick={()=>setHistoryPage(p=>p+1)}>التالي</ProjectButton></div></ProjectInfoCard></ProjectCardDetails></div>}
 </>}
 <p className="text-[11px] leading-6 text-slate-500">الفحص يبدأ فقط عند الضغط على زر البدء. يستورد الملف في MySQL مؤقت، يفحص الجداول ثم يحذف بيئة الفحص.</p>
 </div>
 </ProjectDialog>;
}
