"use client";

import {useEffect,useState} from "react";
import {Copy,KeyRound,Link2,Network,RefreshCw,Share2,ShieldCheck,UserRound,XCircle} from "lucide-react";
import FloatingNotice from "@/components/ui/floating-notice";
import ProjectButton from "@/components/ui/project-button";
import ProjectDialog from "@/components/ui/project-dialog";
import ProjectInput from "@/components/ui/project-input";
import {ProjectCardIcon,ProjectInfoCard,type InfoCardTone} from "@/components/ui/project-info-card";

type LinkStatus = "pending"|"used"|"expired"|"revoked";
type Access = {username:string;link:{status:LinkStatus;expiresAt:string}|null;url?:string};
const states:Record<LinkStatus,{label:string;tone:InfoCardTone}>={
 pending:{label:"بانتظار الاستخدام",tone:"pending"},used:{label:"مستخدم",tone:"success"},
 expired:{label:"منتهي",tone:"warning"},revoked:{label:"ملغى",tone:"danger"},
};

export default function NetworkAccessRecovery({slug,networkName,onClose,copy}:{slug:string;networkName:string;onClose:()=>void;copy:(value:string,message:string)=>Promise<void>}){
 const endpoint="/api/billing/admin/networks/"+encodeURIComponent(slug)+"/access-recovery";
 const [data,setData]=useState<Access|null>(null);
 const [busy,setBusy]=useState(false);
 const [revision,setRevision]=useState(0);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{
  const controller=new AbortController();
  setError("");
  fetch(endpoint,{credentials:"include",cache:"no-store",signal:controller.signal}).then(async response=>{
   const payload=await response.json();
   if(!response.ok)throw Error(payload.message);
   if(!controller.signal.aborted){setData(current=>({...payload,url:payload.link?.status==='pending'&&current?.link?.expiresAt===payload.link.expiresAt?current?.url:undefined}));setNow(Date.now());}
  }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"تعذر تحميل بيانات الوصول.");});
  return ()=>controller.abort();
 },[endpoint,revision]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer);},[]);
 async function mutate(action:"issue"|"revoke"){
  if(busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch(endpoint,{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})});
   const payload=await response.json();
   if(!response.ok)throw Error(payload.message);
   setData(payload);
   setNow(Date.now());
   setMessage(action==="issue"?"تم إنشاء رابط الاستعادة.":"تم إلغاء رابط الاستعادة.");
  }catch(e){setError(e instanceof Error?e.message:"تعذر إكمال الإجراء.");}
  finally{setBusy(false);}
 }
 async function share(url:string){
  try{
   await navigator.share({title:"تعيين بيانات دخول مدير الشبكة",text:networkName,url});
  }catch(error){
   if(!(error instanceof DOMException&&error.name==="AbortError"))setError("تعذرت المشاركة. يمكنك نسخ الرابط وإرساله.");
  }
 }
 const pending=data?.link?.status==="pending"&&Date.parse(data.link.expiresAt)>now;
 const state=data?.link?states[data.link.status==="pending"&&!pending?"expired":data.link.status]:null;
 return <ProjectDialog open hostingerStyle title="استعادة وصول مدير الشبكة" description="إدارة بيانات دخول المدير الرئيسي لهذه الشبكة." busy={busy} onClose={onClose}
  footer={<ProjectButton variant="secondary" disabled={busy} onClick={onClose}>إغلاق</ProjectButton>}>
  <FloatingNotice error={error} message={message} onDismiss={()=>{setError("");setMessage("");}}/>
  <ProjectInfoCard tone="info" className="mb-4 flex items-center gap-3"><ProjectCardIcon icon={Network}/><div className="min-w-0"><p className="text-xs">الشبكة المعنية بالاستعادة</p><p className="break-words font-semibold">{networkName}</p></div></ProjectInfoCard>
  {!data?<div className="space-y-3"><p role={error?"alert":"status"}>{error||"جارٍ تحميل بيانات المدير…"}</p>{error&&<ProjectButton variant="secondary" onClick={()=>setRevision(value=>value+1)}>إعادة المحاولة</ProjectButton>}</div>:
  <div className="grid gap-4">
   <ProjectInfoCard tone="info" className="space-y-3">
    <h3 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={UserRound}/>اسم مستخدم المدير</h3>
    <div className="flex flex-wrap items-center gap-2"><bdi className="font-mono">{data.username}</bdi><ProjectButton variant="ghost" onClick={()=>void copy(data.username,"تم نسخ اسم المستخدم.")}><Copy/>نسخ</ProjectButton></div>
   </ProjectInfoCard>
   <ProjectInfoCard tone={state?.tone??"connections"} className="space-y-3">
    <h3 className="flex flex-wrap items-center gap-2 font-semibold"><ProjectCardIcon icon={KeyRound} tone={state?.tone??"connections"}/>رابط تعيين بيانات الدخول {state&&<span className="text-xs font-normal">· {state.label}</span>}</h3>
    <p className="text-sm">أرسل الرابط لصاحب الشبكة ليختار اسم المستخدم وكلمة المرور. يُستخدم مرة واحدة خلال 30 دقيقة، وعند الحفظ تُنهى جلسات المدير السابقة.</p>
    {pending&&data.link&&<p className="flex items-center gap-2 text-xs"><ShieldCheck className="size-4"/>ينتهي في {new Date(data.link.expiresAt).toLocaleString("ar")}</p>}
    {pending&&data.url&&<ProjectInput dir="ltr" aria-label="رابط الاستعادة المؤقت" readOnly value={data.url} onFocus={event=>event.target.select()}/>}
    <div className="flex flex-wrap gap-2">
     <ProjectButton variant="ghost" disabled={busy} onClick={()=>setRevision(value=>value+1)}><RefreshCw/>تحديث حالة الرابط</ProjectButton>
     <ProjectButton disabled={busy} onClick={()=>void mutate("issue")}><Link2/>{pending?"إصدار بديل وإلغاء السابق":"إنشاء رابط استعادة"}</ProjectButton>
     {pending&&data.url&&typeof navigator!=="undefined"&&typeof navigator.share==="function"&&<ProjectButton variant="secondary" onClick={()=>void share(data.url!)}><Share2/>مشاركة الرابط</ProjectButton>}
     {pending&&data.url&&<ProjectButton variant="secondary" onClick={()=>void copy(data.url!,"تم نسخ رابط الاستعادة.")}><Copy/>نسخ الرابط</ProjectButton>}
     {pending&&<ProjectButton variant="secondary" disabled={busy} onClick={()=>void mutate("revoke")}><XCircle/>إلغاء الرابط</ProjectButton>}
    </div>
   </ProjectInfoCard>
  </div>}
 </ProjectDialog>;
}
