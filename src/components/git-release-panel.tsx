"use client";

import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {ArrowUpFromLine,CheckCircle2,GitBranch,GitCommitHorizontal,History,Loader2,Server,ShieldCheck,XCircle} from "lucide-react";
import FloatingNotice from "@/components/ui/floating-notice";
import ProjectButton from "@/components/ui/project-button";
import ProjectDialog from "@/components/ui/project-dialog";
import ProjectInput from "@/components/ui/project-input";
import {Textarea} from "@/components/ui/textarea";
import {ProjectCardIcon,ProjectInfoCard,type InfoCardTone} from "@/components/ui/project-info-card";

const endpoint="/api/admin/platform-settings/system-updates/git";
const activeStates=["sending","received","queued","preflight","backup","build","migrate","activate","verify","rollback"];
const labels:Record<string,string>={
 prepared:"جاهز للمراجعة",sending:"جارٍ الإرسال",received:"وصل إلى الاستضافة",queued:"بانتظار التنفيذ",
 preflight:"فحص الجاهزية",backup:"النسخ الاحتياطي",build:"بناء التطبيق",migrate:"ترحيل قواعد البيانات",
 activate:"تشغيل الإصدار",verify:"التحقق من التشغيل",succeeded:"اكتمل النشر",failed:"تعذّر النشر",
 failed_rolled_back:"تعذّر النشر وعاد التطبيق للإصدار السابق",recovery_required:"يحتاج معالجة قبل متابعة النشر",
 delivery_unknown:"يلزم التحقق من نتيجة الإرسال",rollback:"استعادة إصدار التطبيق السابق",
};
type Release={
 schemaChanges?:string[];version:string;commit:string;changes:string;status:string;createdAt:string;updatedAt:string;
 stages?:{name:string;at:string}[];networkResults?:{tenantId:number;name?:string;status:string;schemaVersion?:string}[];
 remote?:{stages?:{name:string;at:string}[];networkResults?:Release["networkResults"];backupId?:string};
};
type Preflight={ready:boolean;checks:{name:string;ok:boolean}[];currentVersion:string|null;currentCommit:string|null;migrationReady:boolean;schemaChanges?:string[]};
type Data={enabled:boolean;sourceError?:string;source:{commit:string;branch:string;dirty:string[];dirtyCount:number;target:string}|null;releases:Release[];hostedReleases:Release[]};
const tone=(status:string):InfoCardTone=>status==="succeeded"?"success":["failed","recovery_required","delivery_unknown"].includes(status)?"danger":status==="failed_rolled_back"?"warning":"pending";

async function request(path="",body?:unknown){
 const response=await fetch(endpoint+path,{method:body===undefined?"GET":"POST",cache:"no-store",headers:body===undefined?undefined:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
 const result=await response.json();
 if(!response.ok)throw Error(result.message||"تعذر إكمال الإجراء.");
 return result;
}

export default function GitReleasePanel(){
 const [data,setData]=useState<Data>();
 const polling=useRef(false);
 const [preflight,setPreflight]=useState<Preflight>();
 const [review,setReview]=useState<Release>();
 const [version,setVersion]=useState(""),[changes,setChanges]=useState(""),[tested,setTested]=useState(false);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState<{error?:string;message?:string}>({});
 const load=useCallback(async()=>{const payload=await request();setData(payload as Data);},[]);
 useEffect(()=>{void load().catch(error=>setNotice({error:error.message}));},[load]);
 const poll=useCallback(async()=>{
  if(polling.current||!data)return;
  polling.current=true;
  try{
   if(!data.enabled){await load();return;}
   const active=data.releases.filter(release=>activeStates.includes(release.status));
   const results=await Promise.allSettled(active.map(release=>request("/"+release.version+"/status")));
   const refreshed=results.flatMap(result=>result.status==="fulfilled"?[result.value as Release]:[]);
   if(refreshed.length)setData(current=>current?{...current,releases:current.releases.map(release=>refreshed.find(item=>item.version===release.version)??release)}:current);
  }catch{/* Keep the last confirmed display during an interrupted connection. */}
  finally{polling.current=false;}
 },[data,load]);
 useEffect(()=>{
  const records=data?.enabled?data.releases:data?.hostedReleases??[];
  if(!records.some(release=>activeStates.includes(release.status)))return;
  const timer=setInterval(()=>{if(document.visibilityState==="visible")void poll();},10000);
  return()=>clearInterval(timer);
 },[data,poll]);
 async function inspect(){
  setBusy(true);
  try{setPreflight(await request("/inspect",{}));await load();}
  catch(error){setNotice({error:error instanceof Error?error.message:"تعذر فحص الاستضافة."});}
  finally{setBusy(false);}
 }
 async function prepare(event:FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);
  try{const result=await request("/prepare",{version,changes,tested});setPreflight(result.preflight);setReview(result.release);await load();}
  catch(error){setNotice({error:error instanceof Error?error.message:"تعذر تجهيز الإصدار."});}
  finally{setBusy(false);}
 }
 async function send(release:Release){
  if(busy)return;setBusy(true);
  try{await request("/"+release.version+"/send",{commit:release.commit});setReview(undefined);setNotice({message:"بدأ إرسال الإصدار. تابع مراحل التطبيق في السجل."});await load();}
  catch(error){setNotice({error:error instanceof Error?error.message:"تعذر إرسال الإصدار."});}
  finally{setBusy(false);}
 }
 async function refresh(release:Release){
  setBusy(true);
  try{await request("/"+release.version+"/status");await load();}
  catch(error){setNotice({error:error instanceof Error?error.message:"تعذر قراءة نتيجة النشر."});}
  finally{setBusy(false);}
 }
 const records=data?.enabled?data.releases:data?.hostedReleases??[];
 return <section className="min-w-0 space-y-4" aria-label="النشر من جهاز التطوير عبر Git">
  <FloatingNotice {...notice} onDismiss={()=>setNotice({})}/>
  <ProjectInfoCard tone="info" className="space-y-4">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={GitBranch}/>النشر من النسخة المحلية إلى الاستضافة</h2>{data?.enabled&&<ProjectButton variant="secondary" disabled={busy} onClick={()=>void inspect()}><ShieldCheck/>فحص جاهزية الاستضافة</ProjectButton>}</div>
   {!data?.enabled?<p className="text-sm">يتاح إرسال الإصدارات بعد إعداد جهاز التطوير واتصال Git بالاستضافة. تظهر نتائج التطبيق هنا على النسخة المستضافة.</p>:
    <>
     {data.sourceError&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{data.sourceError}</p>}
     {data.source&&<div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <ProjectInfoCard className="min-w-0 space-y-2"><p className="flex items-center gap-2 text-xs"><GitCommitHorizontal className="size-4 text-blue-500"/>معرّف المصدر المحلي</p><bdi dir="ltr" className="block break-all font-mono text-xs">{data.source.commit}</bdi><p className="break-words text-xs">{data.source.branch}</p></ProjectInfoCard>
      <ProjectInfoCard tone={data.source.dirtyCount?"warning":"success"} className="min-w-0 space-y-2"><p className="flex items-center gap-2 text-xs"><Server className="size-4"/>{data.source.dirtyCount?"تعديلات محلية تحتاج حفظًا":"المجلد جاهز للمراجعة"}</p><bdi dir="ltr" className="block break-all text-xs">{data.source.target}</bdi>{data.source.dirtyCount>0&&<details className="text-xs"><summary>عرض الملفات المعدلة · {data.source.dirtyCount}</summary><ul className="mt-2 space-y-1">{data.source.dirty.map(path=><li key={path} dir="ltr" className="break-all font-mono">{path}</li>)}</ul></details>}</ProjectInfoCard>
     </div>}
     <form onSubmit={prepare} className="space-y-4">
      <div className="grid items-start gap-4 sm:grid-cols-[minmax(180px,.6fr)_minmax(0,1.4fr)]">
       <label className="min-w-0 text-sm">رقم الإصدار<ProjectInput className="mt-2" dir="ltr" value={version} onChange={event=>setVersion(event.target.value)} placeholder="v1.4.0" required maxLength={32} disabled={busy}/></label>
       <label className="min-w-0 text-sm">سجل التغييرات<Textarea className="mt-2 min-h-24" value={changes} onChange={event=>setChanges(event.target.value)} required maxLength={4000} disabled={busy}/></label>
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={tested} onChange={event=>setTested(event.target.checked)} required disabled={busy} className="mt-1 accent-blue-600"/>جرّبت هذا الإصدار محليًا وأريد تجهيزه للمراجعة.</label>
      <ProjectButton type="submit" disabled={busy||!data.source||Boolean(data.source?.dirtyCount)}>{busy?<Loader2 className="animate-spin"/>:<GitBranch/>}تجهيز ومراجعة الإصدار</ProjectButton>
     </form>
    </>}
   {preflight&&<div className="space-y-3 border-t border-slate-200 pt-3 dark:border-white/10"><p className="text-sm font-semibold">الإصدار على الاستضافة · {preflight.currentVersion??"غير مسجل"}</p><p className="text-xs">ترحيل قواعد البيانات · {preflight.migrationReady?"مسار الترحيل جاهز":"بانتظار التهيئة على الخادم"}</p><ul className="grid gap-2 sm:grid-cols-2">{preflight.checks.map(check=><li key={check.name} className="flex items-center gap-2 text-xs">{check.ok?<CheckCircle2 className="size-4 text-emerald-500"/>:<XCircle className="size-4 text-rose-500"/>}{check.name}</li>)}</ul></div>}
  </ProjectInfoCard>
  <ProjectInfoCard className="space-y-4">
   <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={History} tone="connections"/>سجل إصدارات Git</h2><ProjectButton variant="ghost" disabled={busy} onClick={()=>void load().catch(error=>setNotice({error:error.message}))}>تحديث السجل</ProjectButton></div>
   {!records.length?<p className="text-sm">لا توجد إصدارات Git مسجلة.</p>:<ul className="space-y-4">{records.map(release=>{
    const stages=release.remote?.stages??release.stages??[];
    const networks=release.remote?.networkResults??release.networkResults??[];
    return <li key={release.version}><ProjectInfoCard tone={tone(release.status)} className="space-y-3">
     <div className="flex flex-wrap items-center justify-between gap-2"><bdi className="font-semibold">{release.version}</bdi><span className="text-xs">{labels[release.status]??release.status}</span></div>
     <bdi dir="ltr" className="block break-all font-mono text-xs">{release.commit}</bdi><p className="whitespace-pre-wrap break-words text-sm">{release.changes}</p>
     <p className="text-xs">{new Date(release.updatedAt).toLocaleString("ar")}</p>
     {stages.length>0&&<ol className="flex flex-wrap gap-2 text-xs">{stages.map((stage,index)=><li key={index} className="rounded-full border border-current/20 px-2 py-1">{labels[stage.name]??stage.name}</li>)}</ol>}
     {networks.length>0&&<details><summary className="cursor-pointer text-sm">نتائج تحديث قواعد الشبكات · {networks.length}</summary><ul className="mt-3 grid gap-3 sm:grid-cols-2">{networks.map(network=><li key={network.tenantId} className="rounded-xl border border-current/20 p-3 text-xs"><p className="break-words">{network.name??"شبكة #"+network.tenantId}</p><p>{labels[network.status]??network.status}</p><bdi>{network.schemaVersion}</bdi></li>)}</ul></details>}
     {data?.enabled&&<div className="flex flex-wrap gap-2">{["prepared","delivery_unknown"].includes(release.status)&&<ProjectButton variant="secondary" disabled={busy} onClick={()=>setReview(release)}><ArrowUpFromLine/>مراجعة الإرسال</ProjectButton>}{release.status!=="prepared"&&<ProjectButton variant="ghost" disabled={busy} onClick={()=>void refresh(release)}>التحقق من نتيجة الاستضافة</ProjectButton>}</div>}
    </ProjectInfoCard></li>;
   })}</ul>}
  </ProjectInfoCard>
  {review&&<ProjectDialog open hostingerStyle title="مراجعة الإصدار قبل الإرسال" description="سيُرسل معرّف المصدر المحدد إلى Git على الاستضافة." onClose={()=>setReview(undefined)} busy={busy}
   footer={<><ProjectButton variant="secondary" disabled={busy} onClick={()=>setReview(undefined)}>رجوع</ProjectButton><ProjectButton disabled={busy} onClick={()=>void send(review)}><ArrowUpFromLine/>{busy?"جارٍ الإرسال…":"تأكيد وإرسال الإصدار"}</ProjectButton></>}>
   <div className="space-y-4"><ProjectInfoCard tone="info" className="space-y-2"><p className="font-semibold">{review.version}</p><bdi dir="ltr" className="block break-all font-mono text-xs">{review.commit}</bdi><p className="whitespace-pre-wrap break-words text-sm">{review.changes}</p></ProjectInfoCard>
    <p className="text-sm">{review.schemaChanges?.length?"يتضمن الإصدار تغييرات قاعدة بيانات وتُطبّق عبر عامل الترحيل بعد النسخ الاحتياطي.":"يتحقق الخادم من تغييرات قاعدة البيانات قبل تطبيق الإصدار."}</p>
    <p className="text-xs text-slate-500 dark:text-slate-400">تابع الاستلام والبناء والترحيل والتحقق من التشغيل من سجل الإصدارات.</p>
   </div>
  </ProjectDialog>}
 </section>;
}
