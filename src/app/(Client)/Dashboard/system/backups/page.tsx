"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {Cloud,Database,Download,HardDriveDownload,CalendarClock,History,Send,ShieldCheck,RefreshCw,Link2,TestTube2,CheckCircle2,AlertTriangle,Clock3} from "lucide-react";
import {useAuth} from "@/components/auth/auth-provider";
import {CollectionState} from "@/components/ui/collection-display";
import {ProjectCardIcon,ProjectInfoCard} from "@/components/ui/project-info-card";
import ProjectButton from "@/components/ui/project-button";
import ProjectInput from "@/components/ui/project-input";
import ProjectDropdown from "@/components/ui/project-dropdown";
import ProjectDialog from "@/components/ui/project-dialog";
import FloatingNotice from "@/components/ui/floating-notice";

import BackupHistory from "@/components/backup-history";

const endpoint="/api/admin/platform-settings/database-backups";
type Destination="telegram"|"drive";
type Policy={lastError?:string|null;enabled:boolean;intervalValue:number;intervalUnit:"hours"|"days";time:string;timezone:string;centralServerId:number|null;retentionEnabled:boolean;retentionDays:number;keepLast:number;destinations:Destination[];nextRunAt:string|null};
type CloudConfig={telegram:{enabled:boolean;configured:boolean;chatId:string;token?:string;lastTest?:{ok:boolean;at:string}};drive:{enabled:boolean;configured:boolean;connected:boolean;clientId:string;clientSecret?:string;folderId?:string;callbackUrl:string;lastTest?:{ok:boolean;at:string}}};
type Job={destinations:Destination[];id:string;name:string;kind:string;status:string;database_name:string;server_id:number;trigger_type:string;created_at:string;finished_at:string|null;removed_at:string|null;last_error:string|null;metadata:{bytes?:number;sha256?:string};deliveries:Partial<Record<Destination,{status:string;error?:string}>>};
type Data={policy:Policy;cloud:CloudConfig;options:{servers:{id:number;name:string}[];networks:{id:number;name:string}[]};items:Job[];counts:{status:string;count:number;attention:number}[];total:number;page:number};
const labels:Record<string,string>={queued:"بانتظار التنفيذ",running:"جارٍ النسخ",waiting_remote:"بانتظار اتصال الخادم",succeeded:"اكتمل النسخ والتحقق",failed:"تعذّر التنفيذ",pending:"بانتظار الرفع",uploading:"جارٍ الرفع",unknown:"الوصول غير مؤكد"};
const errors:Record<string,string>={MYSQL_SOURCE_CHECK_FAILED:"تعذّر فحص اتصال MySQL من خادم النسخ. تحقق من بيانات الدخول وإعدادات TLS والوصول إلى المصدر.",MYSQL_SOURCE_CHECK_TIMEOUT:"انتهت مهلة فحص MySQL من خادم النسخ.",TELEGRAM_TOO_LARGE:"تجاوز حجم النسخة حد تلجرام 50 MB",TELEGRAM_DELIVERY_UNKNOWN:"راجع المحادثة قبل إعادة الرفع",TELEGRAM_SETUP:"تلجرام يحتاج إعدادًا",DRIVE_SETUP:"Google Drive يحتاج ربطًا",BACKUP_ENGINE_MISMATCH:"خادم القاعدة لا يطابق المصدر",BACKUP_CENTRAL_SERVER_MISMATCH:"اختر خادم القاعدة المركزية الصحيح",MYSQL_TOOLS_REQUIRED:"جهّز mysql وmysqldump على الخادم",MYSQL_DUMP_FAILED:"تحقق من صلاحيات النسخ وإصدار mysqldump",BACKUP_DISK_SPACE:"مساحة الخادم غير كافية",BACKUP_REMOTE_UNAVAILABLE:"تعذّر الاتصال بخادم النسخ",WORKER_INTERRUPTED:"توقفت عملية النسخ على الخادم"};
async function request(path="",body?:unknown,method?:string){
 const response=await fetch(endpoint+path,{method:method??(body===undefined?"GET":"POST"),cache:"no-store",headers:body===undefined?undefined:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
 const value=await response.json();
 if(!response.ok)throw Error(value.message||"تعذر إكمال العملية.");
 return value;
}
function size(bytes?:number){return bytes===undefined?"—":(bytes/1024/1024).toFixed(2)+" MiB";}
export default function DatabaseBackupsPage(){
 const {isMasterAdmin,loading}=useAuth();
 const [tab,setTab]=useState("manual"),[data,setData]=useState<Data>(),[policy,setPolicy]=useState<Policy>(),[cloud,setCloud]=useState<CloudConfig>();
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState<{error?:string;message?:string}>({});
 const [scope,setScope]=useState("all"),[tenantId,setTenantId]=useState(""),[destinations,setDestinations]=useState<Destination[]>([]),[page,setPage]=useState(1);
 const [historyFilters,setHistoryFilters]=useState({q:"",status:"all",kind:"all",trigger:"all"});
 const [retry,setRetry]=useState<{job:Job;destination:Destination}>();
 const initialized=useRef(false),requestId=useRef(""),polling=useRef(false),loadSequence=useRef(0);
 const load=useCallback(async(reset=false)=>{
  const sequence=++loadSequence.current;
  const value=await request("?"+new URLSearchParams({page:String(page),...historyFilters})) as Data;if(sequence!==loadSequence.current)return;setData(value);
  if(reset||!initialized.current){setPolicy(value.policy);setCloud(value.cloud);setDestinations(value.policy.destinations);initialized.current=true;}
 },[page,historyFilters]);
 useEffect(()=>{if(isMasterAdmin)void load().catch(error=>setNotice({error:error.message}));},[isMasterAdmin,load]);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  if(params.get("tab")==="cloud")setTab("cloud");
  if(params.has("drive")){setNotice(params.get("drive")==="connected"?{message:"تم ربط Google Drive."}:{error:"تعذر ربط Google Drive. راجع إعدادات التطبيق وأعد الربط."});window.history.replaceState(null,"",window.location.pathname+"?tab=cloud");}
 },[]);
 useEffect(()=>{
  if(!data)return;
  const timer=setInterval(async()=>{
   if(polling.current||document.visibilityState!=="visible")return;
   polling.current=true;try{await load();}catch{}finally{polling.current=false;}
  },15000);
  return()=>clearInterval(timer);
 },[data,load]);
 async function operation(work:()=>Promise<unknown>,message?:string,reset=false){
  if(busy)return;setBusy(true);
  try{await work();if(message)setNotice({message});await load(reset);}
  catch(error){setNotice({error:error instanceof Error?error.message:"تعذر إكمال العملية."});}
  finally{setBusy(false);}
 }
 async function run(event:FormEvent){
  event.preventDefault();
  requestId.current||=crypto.randomUUID();
  await operation(async()=>{await request("/run",{requestId:requestId.current,scope,tenantId:Number(tenantId),destinations});requestId.current="";setPage(1);setTab("history");},"أُضيفت القواعد إلى طابور النسخ الاحتياطي.");
 }
 function ready(destination:Destination){
  return destination==="telegram"?Boolean(cloud?.telegram.enabled&&cloud.telegram.configured):Boolean(cloud?.drive.enabled&&cloud.drive.connected);
 }
 function destinationChoices(values:Destination[],change:(values:Destination[])=>void){
  return <div className="flex flex-wrap gap-4">{(["telegram","drive"] as Destination[]).map(destination=><label key={destination} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-blue-600" checked={values.includes(destination)} disabled={busy||!ready(destination)&&!values.includes(destination)} onChange={event=>change(event.target.checked?[...values,destination]:values.filter(value=>value!==destination))}/>{destination==="telegram"?<Send className="size-4 text-sky-500"/>:<Cloud className="size-4 text-emerald-500"/>}{destination==="telegram"?"تلجرام":"Google Drive"}</label>)}</div>;
 }
 const tabs=[{value:"manual",label:"نسخ يدوي",Icon:HardDriveDownload},{value:"schedule",label:"الجدولة والاحتفاظ",Icon:CalendarClock},{value:"cloud",label:"إعدادات الرفع السحابي",Icon:Cloud},{value:"history",label:"سجل النسخ والرفع",Icon:History}];
 if(loading)return <CollectionState loading>جارٍ التحميل…</CollectionState>;
 if(!isMasterAdmin)return <CollectionState>هذه الصفحة خاصة بالإدارة المركزية.</CollectionState>;
 return <div dir="rtl" className="min-w-0 space-y-4">
  <FloatingNotice {...notice} onDismiss={()=>setNotice({})}/>
  <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-lg font-semibold"><ProjectCardIcon icon={HardDriveDownload}/>النسخ الاحتياطي لقواعد البيانات</h1><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">نسخ متتابع للقواعد المركزية وقواعد الشبكات مع متابعة كل وجهة رفع.</p></div><ProjectButton variant="secondary" disabled={busy} onClick={()=>void operation(()=>load())}><RefreshCw/>تحديث</ProjectButton></header>
  <nav className="flex flex-wrap gap-2" aria-label="أقسام النسخ الاحتياطي">{tabs.map(({value,label,Icon})=><ProjectButton key={value} variant={tab===value?"primary":"secondary"} aria-pressed={tab===value} onClick={()=>setTab(value)}><Icon/>{label}</ProjectButton>)}</nav>
  {!data||!policy||!cloud?<CollectionState loading>جارٍ تحميل الإعدادات والسجل…</CollectionState>:<>
   {tab!=="history"&&<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{label:"عمليات نسخ مكتملة",value:data.counts.find(value=>value.status==="succeeded")?.count??0,Icon:CheckCircle2,tone:"success" as const},{label:"قيد الانتظار أو التنفيذ",value:data.counts.filter(value=>["queued","running","waiting_remote"].includes(value.status)).reduce((sum,value)=>sum+Number(value.count),0),Icon:Clock3,tone:"pending" as const},{label:"تعذّر تنفيذها",value:data.counts.find(value=>value.status==="failed")?.count??0,Icon:AlertTriangle,tone:"danger" as const},{label:"رفع يحتاج متابعة",value:data.counts.reduce((sum,value)=>sum+Number(value.attention??0),0),Icon:Cloud,tone:"warning" as const}].map(stat=><ProjectInfoCard key={stat.label} tone={stat.tone} className="flex items-center gap-3"><ProjectCardIcon icon={stat.Icon} tone={stat.tone}/><div><p className="text-xs">{stat.label}</p><p className="text-xl font-semibold tabular-nums">{stat.value}</p></div></ProjectInfoCard>)}</div>}
   {tab==="manual"&&<ProjectInfoCard className="space-y-4">
    <h2 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={Database}/>إنشاء نسخة الآن</h2>
    <form onSubmit={run} className="space-y-4">
     <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">القواعد المطلوبة<ProjectDropdown className="mt-2" value={scope} onChange={setScope} options={[{value:"all",label:"المركزية وجميع قواعد الشبكات",icon:Database},{value:"central",label:"القاعدة المركزية",icon:ShieldCheck},{value:"networks",label:"جميع قواعد الشبكات",icon:Database},{value:"network",label:"قاعدة شبكة محددة",icon:Database}]}/></label>{scope==="network"&&<label className="text-sm">الشبكة<ProjectDropdown className="mt-2" searchable value={tenantId} onChange={setTenantId} options={data.options.networks.map(value=>({value:String(value.id),label:value.name,icon:Database}))}/></label>}</div>
     <p className="flex items-center gap-2 text-sm"><Download className="size-4 text-blue-500"/>تظهر إمكانية التنزيل المحلي بعد اكتمال النسخة والتحقق منها.</p>
     {destinationChoices(destinations,setDestinations)}
     <ProjectButton type="submit" disabled={busy||scope==="network"&&!tenantId}><HardDriveDownload/>{busy?"جارٍ إرسال الطلب…":"إنشاء النسخة"}</ProjectButton>
    </form>
   </ProjectInfoCard>}
   {tab==="schedule"&&<ProjectInfoCard className="space-y-4">
    <h2 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={CalendarClock}/>الجدولة الدورية</h2>
    {data.policy.lastError&&<ProjectInfoCard tone="warning"><p role="status" className="text-sm">{data.policy.lastError}</p></ProjectInfoCard>}
    <form className="space-y-4" onSubmit={event=>{event.preventDefault();void operation(()=>request("/policy",policy,"PUT"),"تم حفظ الجدولة وسياسة الاحتفاظ.",true);}}>
     <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.enabled} onChange={event=>setPolicy({...policy,enabled:event.target.checked})} className="accent-blue-600"/>تفعيل النسخ الدوري للمركزية وجميع قواعد الشبكات</label>
     <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm">تكرار النسخ كل<ProjectInput type="number" min={1} max={policy.intervalUnit==="hours"?720:30} className="mt-2" value={policy.intervalValue} onChange={event=>setPolicy({...policy,intervalValue:Number(event.target.value)})} required/></label>
      <label className="text-sm">الوحدة<ProjectDropdown className="mt-2" value={policy.intervalUnit} onChange={value=>setPolicy({...policy,intervalUnit:value as "hours"|"days"})} options={[{value:"hours",label:"ساعات",icon:Clock3},{value:"days",label:"أيام",icon:CalendarClock}]}/></label>
      {policy.intervalUnit==="days"&&<label className="text-sm">التوقيت المحلي<ProjectInput type="time" className="mt-2" value={policy.time} onChange={event=>setPolicy({...policy,time:event.target.value})} required/></label>}
      <label className="text-sm">المنطقة الزمنية<ProjectDropdown className="mt-2" searchable value={policy.timezone} onChange={value=>setPolicy({...policy,timezone:value})} options={Array.from(new Set(["UTC","Asia/Damascus","Europe/Istanbul",...((Intl as any).supportedValuesOf?.("timeZone")??[])])).map(value=>({value:String(value),label:String(value)}))}/></label>
      <label className="text-sm">خادم القاعدة المركزية<ProjectDropdown className="mt-2" value={policy.centralServerId?String(policy.centralServerId):""} onChange={value=>setPolicy({...policy,centralServerId:Number(value)})} options={data.options.servers.map(value=>({value:String(value.id),label:value.name,icon:Database}))}/></label>
     </div>
     {policy.centralServerId&&<ProjectButton variant="secondary" disabled={busy} onClick={()=>void operation(async()=>{const result=await request("/inspect",{serverId:policy.centralServerId});if(!result.mysql||!result.mysqldump)throw Error("جهّز mysql وmysqldump على الخادم.");setNotice({message:"خادم النسخ جاهز · المساحة الحرة "+(result.freeBytes/1024**3).toFixed(1)+" GiB"});})}><TestTube2/>فحص خادم النسخ</ProjectButton>}
     {destinationChoices(policy.destinations,values=>setPolicy({...policy,destinations:values}))}
     <ProjectInfoCard tone="info" className="space-y-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-blue-600" checked={policy.retentionEnabled} onChange={event=>setPolicy({...policy,retentionEnabled:event.target.checked})}/>تفعيل حذف نسخ الخادم القديمة وفق سياسة الاحتفاظ</label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">مدة الاحتفاظ بالأيام<ProjectInput className="mt-2" type="number" min={1} max={365} required value={policy.retentionDays} onChange={event=>setPolicy({...policy,retentionDays:Number(event.target.value)})}/></label><label className="text-sm">الحد الأدنى للنسخ المحفوظة لكل قاعدة<ProjectInput className="mt-2" type="number" min={1} max={100} required value={policy.keepLast} onChange={event=>setPolicy({...policy,keepLast:Number(event.target.value)})}/></label></div></ProjectInfoCard>
     {data.policy.nextRunAt&&<p className="text-sm">موعد النسخة القادمة · {new Date(data.policy.nextRunAt).toLocaleString("ar",{timeZone:data.policy.timezone})} · {data.policy.timezone}</p>}
     <ProjectButton type="submit" disabled={busy}><CalendarClock/>حفظ الإعدادات</ProjectButton>
    </form>
   </ProjectInfoCard>}
   {tab==="cloud"&&<div className="space-y-4">
    <form className="grid items-start gap-4 lg:grid-cols-2" onSubmit={event=>{event.preventDefault();void operation(()=>request("/cloud",cloud,"PUT"),"تم حفظ إعدادات الرفع السحابي.",true);}}>
     <ProjectInfoCard tone="connections" className="space-y-4"><h2 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={Send} tone="connections"/>تلجرام</h2><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cloud.telegram.enabled} onChange={event=>setCloud({...cloud,telegram:{...cloud.telegram,enabled:event.target.checked}})}/>تفعيل الوجهة</label><label className="block text-sm">رمز البوت<ProjectInput className="mt-2" dir="ltr" type="password" autoComplete="new-password" value={cloud.telegram.token??""} placeholder={cloud.telegram.configured?"رمز محفوظ":"Bot Token"} onChange={event=>setCloud({...cloud,telegram:{...cloud.telegram,token:event.target.value}})}/></label><label className="block text-sm">معرّف المحادثة أو القناة<ProjectInput className="mt-2" dir="ltr" value={cloud.telegram.chatId} placeholder="-100…" onChange={event=>setCloud({...cloud,telegram:{...cloud.telegram,chatId:event.target.value}})}/></label><p className="text-xs">أضف البوت إلى المحادثة أو القناة ومنحه صلاحية إرسال الملفات. حد الرفع 50 MB لكل ملف.</p><ProjectButton variant="secondary" disabled={busy||!data.cloud.telegram.enabled||!data.cloud.telegram.configured} onClick={()=>void operation(()=>request("/cloud/telegram/test",{}),"نجح رفع ملف التجربة إلى تلجرام.",true)}><TestTube2/>تجربة رفع ملف</ProjectButton>{data.cloud.telegram.lastTest&&<p className="text-xs">آخر تجربة · {data.cloud.telegram.lastTest.ok?"نجحت":"تعذّرت"} · {new Date(data.cloud.telegram.lastTest.at).toLocaleString("ar")}</p>}</ProjectInfoCard>
     <ProjectInfoCard tone="success" className="space-y-4"><h2 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={Cloud} tone="success"/>Google Drive</h2><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cloud.drive.enabled} onChange={event=>setCloud({...cloud,drive:{...cloud.drive,enabled:event.target.checked}})}/>تفعيل الوجهة</label><label className="block text-sm">معرّف تطبيق Google<ProjectInput className="mt-2" dir="ltr" value={cloud.drive.clientId} onChange={event=>setCloud({...cloud,drive:{...cloud.drive,clientId:event.target.value}})}/></label><label className="block text-sm">سر التطبيق<ProjectInput className="mt-2" dir="ltr" type="password" autoComplete="new-password" value={cloud.drive.clientSecret??""} placeholder={cloud.drive.configured?"سر محفوظ":"Client Secret"} onChange={event=>setCloud({...cloud,drive:{...cloud.drive,clientSecret:event.target.value}})}/></label><label className="block text-xs">رابط العودة المعتمد في تطبيق Google<ProjectInput readOnly className="mt-2" dir="ltr" value={data.cloud.drive.callbackUrl} onFocus={event=>event.target.select()}/></label><div className="flex flex-wrap gap-2"><ProjectButton variant="secondary" disabled={busy||!data.cloud.drive.configured} onClick={()=>void operation(async()=>{const result=await request("/drive/connect",{});window.location.assign(result.url);})}><Link2/>{data.cloud.drive.connected?"إعادة ربط الحساب":"ربط حساب Google"}</ProjectButton><ProjectButton variant="secondary" disabled={busy||!data.cloud.drive.enabled||!data.cloud.drive.connected} onClick={()=>void operation(()=>request("/cloud/drive/test",{}),"نجح رفع ملف التجربة إلى Google Drive.",true)}><TestTube2/>تجربة رفع ملف</ProjectButton></div>{data.cloud.drive.folderId&&<a href={"https://drive.google.com/drive/folders/"+encodeURIComponent(data.cloud.drive.folderId)} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-blue-600 dark:text-blue-300">فتح مجلد Radius Lord Backups</a>}<p className="text-xs">{data.cloud.drive.connected?"الحساب مرتبط":"بانتظار ربط الحساب"}{data.cloud.drive.lastTest?" · آخر تجربة "+(data.cloud.drive.lastTest.ok?"ناجحة":"متعذرة")+" · "+new Date(data.cloud.drive.lastTest.at).toLocaleString("ar"):""}</p><p className="text-xs">احفظ بيانات التطبيق ثم اربط الحساب. يُنشأ مجلد مخصص للنسخ، وتجربة الرفع ترسل ملفًا صغيرًا إلى هذا المجلد.</p></ProjectInfoCard>
     <ProjectButton type="submit" disabled={busy} className="justify-self-start"><ShieldCheck/>حفظ إعدادات الوجهات</ProjectButton>
    </form>
   </div>}
   {tab==="history"&&<BackupHistory items={data.items} counts={data.counts} total={data.total} page={page} query={historyFilters.q} status={historyFilters.status} kind={historyFilters.kind} trigger={historyFilters.trigger} busy={busy} onPage={setPage} onFilter={(key,value)=>{setPage(1);setHistoryFilters(current=>key==="reset"?{q:"",status:"all",kind:"all",trigger:"all"}:{...current,[key]:value});}} errorText={code=>errors[code]??(code==="CalledProcessError"?"تعذّر اتصال أداة MySQL بالمصدر. تحقق من بيانات الوصول وTLS على خادم النسخ.":"تعذّر تنفيذ النسخ. راجع اتصال الخادم وصلاحيات حساب النسخ.")} onCheck={job=>void operation(()=>request("/"+job.id+"/check",{}),"تم تحديث حالة النسخة من الخادم.")} onRetry={(job,destination)=>setRetry({job,destination})} onDownload={job=>{const link=document.createElement("a");link.href=endpoint+"/"+job.id+"/download";link.download="radius-backup-"+job.id+".sql.gz";link.click();}}/>}
  </>}
  {retry&&<ProjectDialog open hostingerStyle title="إعادة رفع النسخة" onClose={()=>setRetry(undefined)} busy={busy} footer={<><ProjectButton variant="secondary" disabled={busy} onClick={()=>setRetry(undefined)}>رجوع</ProjectButton><ProjectButton disabled={busy} onClick={()=>void operation(async()=>{await request("/"+retry.job.id+"/retry",{destination:retry.destination});setRetry(undefined);},"أُضيفت محاولة الرفع إلى الطابور.")}>تأكيد إعادة الرفع</ProjectButton></>}><p className="text-sm">{retry.job.deliveries[retry.destination]?.status==="unknown"?"راجع محادثة تلجرام أولًا. قد يكون الملف وصل بالفعل، وإعادة المحاولة قد ترسل نسخة إضافية.":"ستُعاد محاولة رفع النسخة المحفوظة إلى الوجهة المحددة."}</p></ProjectDialog>}
 </div>;
}
