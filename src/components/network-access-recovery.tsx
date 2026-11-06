"use client";

import {useEffect,useState} from "react";
import {Copy,KeyRound,Link2,RefreshCw,ShieldCheck,UserRound,XCircle} from "lucide-react";
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

export default function NetworkAccessRecovery({slug,onClose,copy}:{slug:string;onClose:()=>void;copy:(value:string,message:string)=>Promise<void>}){
 const endpoint="/api/billing/admin/networks/"+encodeURIComponent(slug)+"/access-recovery";
 const [data,setData]=useState<Access|null>(null);
 const [username,setUsername]=useState("");
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
   if(!controller.signal.aborted){setData(current=>({...payload,url:payload.link?.status==='pending'&&current?.link?.expiresAt===payload.link.expiresAt?current?.url:undefined}));setUsername(payload.username);setNow(Date.now());}
  }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"تعذر تحميل بيانات الوصول.");});
  return ()=>controller.abort();
 },[endpoint,revision]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer);},[]);
 async function mutate(action:"rename"|"issue"|"revoke"){
  if(busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch(endpoint,{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(action==="rename"?{action,username}:{action})});
   const payload=await response.json();
   if(!response.ok)throw Error(payload.message);
   setData(current=>({...payload,url:action==="rename"?current?.url:payload.url}));
   setUsername(payload.username);setNow(Date.now());
   setMessage(action==="rename"?"تم حفظ اسم المستخدم.":action==="issue"?"تم إنشاء رابط الاستعادة.":"تم إلغاء رابط الاستعادة.");
  }catch(e){setError(e instanceof Error?e.message:"تعذر إكمال الإجراء.");}
  finally{setBusy(false);}
 }
 const pending=data?.link?.status==="pending"&&Date.parse(data.link.expiresAt)>now;
 const state=data?.link?states[data.link.status==="pending"&&!pending?"expired":data.link.status]:null;
 return <ProjectDialog open title="استعادة وصول مدير الشبكة" description="إدارة بيانات دخول المدير الرئيسي لهذه الشبكة." busy={busy} onClose={onClose}
  footer={<ProjectButton variant="secondary" disabled={busy} onClick={onClose}>إغلاق</ProjectButton>}>
  <FloatingNotice error={error} message={message} onDismiss={()=>{setError("");setMessage("");}}/>
  {!data?<div className="space-y-3"><p role={error?"alert":"status"}>{error||"جارٍ تحميل بيانات المدير…"}</p>{error&&<ProjectButton variant="secondary" onClick={()=>setRevision(value=>value+1)}>إعادة المحاولة</ProjectButton>}</div>:
  <div className="grid gap-4">
   <ProjectInfoCard tone="info" className="space-y-3">
    <h3 className="flex items-center gap-2 font-semibold"><ProjectCardIcon icon={UserRound}/>اسم مستخدم المدير</h3>
    <div className="flex flex-wrap items-center gap-2"><bdi className="font-mono">{data.username}</bdi><ProjectButton variant="ghost" onClick={()=>void copy(data.username,"تم نسخ اسم المستخدم.")}><Copy/>نسخ</ProjectButton></div>
    <form onSubmit={event=>{event.preventDefault();void mutate("rename");}} className="flex flex-wrap items-end gap-2">
     <label className="min-w-0 flex-1 text-sm">اسم المستخدم الجديد<ProjectInput dir="ltr" className="mt-2" value={username} onChange={event=>setUsername(event.target.value)} required minLength={3} maxLength={64} pattern="[a-zA-Z][a-zA-Z0-9_.-]{2,63}" disabled={busy}/></label>
     <ProjectButton type="submit" variant="secondary" disabled={busy||username.trim().toLowerCase()===data.username}>حفظ الاسم</ProjectButton>
    </form>
   </ProjectInfoCard>
   <ProjectInfoCard tone={state?.tone??"connections"} className="space-y-3">
    <h3 className="flex flex-wrap items-center gap-2 font-semibold"><ProjectCardIcon icon={KeyRound} tone={state?.tone??"connections"}/>رابط إعادة تعيين كلمة المرور {state&&<span className="text-xs font-normal">· {state.label}</span>}</h3>
    <p className="text-sm">يُستخدم مرة واحدة خلال 30 دقيقة. عند حفظ كلمة المرور الجديدة تُنهى جلسات المدير السابقة.</p>
    {pending&&data.link&&<p className="flex items-center gap-2 text-xs"><ShieldCheck className="size-4"/>ينتهي في {new Date(data.link.expiresAt).toLocaleString("ar")}</p>}
    {pending&&data.url&&<ProjectInput dir="ltr" aria-label="رابط الاستعادة المؤقت" readOnly value={data.url} onFocus={event=>event.target.select()}/>}
    <div className="flex flex-wrap gap-2">
     <ProjectButton variant="ghost" disabled={busy} onClick={()=>setRevision(value=>value+1)}><RefreshCw/>تحديث حالة الرابط</ProjectButton>
     <ProjectButton disabled={busy} onClick={()=>void mutate("issue")}><Link2/>{pending?"إصدار بديل وإلغاء السابق":"إنشاء رابط استعادة"}</ProjectButton>
     {pending&&data.url&&<ProjectButton variant="secondary" onClick={()=>void copy(data.url!,"تم نسخ رابط الاستعادة.")}><Copy/>نسخ الرابط</ProjectButton>}
     {pending&&<ProjectButton variant="secondary" disabled={busy} onClick={()=>void mutate("revoke")}><XCircle/>إلغاء الرابط</ProjectButton>}
    </div>
   </ProjectInfoCard>
  </div>}
 </ProjectDialog>;
}
