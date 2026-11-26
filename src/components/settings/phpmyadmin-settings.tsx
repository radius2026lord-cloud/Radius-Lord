"use client";
import {useEffect,useState,type FormEvent} from "react";
import {Database} from "lucide-react";
import FloatingNotice from "@/components/ui/floating-notice";
import ProjectButton from "@/components/ui/project-button";
import ProjectInput from "@/components/ui/project-input";

const endpoint="/api/billing/admin/phpmyadmin-settings";

export default function PhpMyAdminSettings(){
 const [url,setUrl]=useState("");
 const [loaded,setLoaded]=useState(false);
 const [saving,setSaving]=useState(false);
 const [notice,setNotice]=useState({message:"",error:""});
 useEffect(()=>{
  const controller=new AbortController();
  async function load(){
   try{
    const response=await fetch(endpoint,{credentials:"include",cache:"no-store",signal:controller.signal});
    const result=await response.json();
    if(!response.ok)throw new Error(result.message);
    if(!controller.signal.aborted){setUrl(result.url);setLoaded(true);}
   }catch{
    if(!controller.signal.aborted)setNotice({message:"",error:"تعذر تحميل عنوان phpMyAdmin."});
   }
  }
  void load();
  return()=>controller.abort();
 },[]);

 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!loaded||saving)return;
  setSaving(true);
  setNotice({message:"",error:""});
  try{
   const response=await fetch(endpoint,{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({url})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.message);
   setUrl(result.url);
   setNotice({message:"تم حفظ إعداد phpMyAdmin.",error:""});
  }catch(error){
   setNotice({message:"",error:error instanceof Error?error.message:"تعذر حفظ عنوان phpMyAdmin."});
  }finally{setSaving(false);}
 }

 return <form onSubmit={save} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[var(--oneui-surface)]">
  <FloatingNotice {...notice} onDismiss={()=>setNotice({message:"",error:""})}/>
  <h2 className="flex items-center gap-2 font-semibold"><Database className="size-5 text-violet-500"/>phpMyAdmin</h2>
  <div className="flex flex-wrap items-end gap-3">
   <label className="min-w-0 flex-1 basis-64 text-xs">عنوان phpMyAdmin
    <ProjectInput className="mt-2" type="url" dir="ltr" maxLength={2048} placeholder="https://example.com/phpmyadmin/" value={url} disabled={!loaded||saving} onChange={event=>setUrl(event.target.value)}/>
   </label>
   <ProjectButton type="submit" disabled={!loaded||saving}>{saving?"جارٍ الحفظ…":"حفظ العنوان"}</ProjectButton>
  </div>
 </form>;
}
