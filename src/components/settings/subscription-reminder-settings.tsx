"use client";
import {useEffect,useState} from "react";
import {CalendarClock} from "lucide-react";
import ProjectButton from "@/components/ui/project-button";
import ProjectInput from "@/components/ui/project-input";
import FloatingNotice from "@/components/ui/floating-notice";
export default function SubscriptionReminderSettings(){
 const [days,setDays]=useState("7"),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 useEffect(()=>{const c=new AbortController();fetch("/api/billing/admin/subscription-reminders",{credentials:"include",cache:"no-store",signal:c.signal}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.message);if(!c.signal.aborted)setDays(String(j.expiryDays));}).catch(e=>{if(!c.signal.aborted)setError(e.message||"تعذر تحميل الإعداد.");}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[]);
 async function save(){setSaving(true);setError("");setMessage("");try{const r=await fetch("/api/billing/admin/subscription-reminders",{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({expiryDays:Number(days)})});const j=await r.json();if(!r.ok)throw Error(j.message);setMessage("تم حفظ مدة تنبيه تجديد الاشتراكات.");}catch(e){setError(e instanceof Error?e.message:"تعذر الحفظ.");}finally{setSaving(false);}}
 return <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[var(--oneui-surface)]"><FloatingNotice error={error} message={message} onDismiss={()=>{setError("");setMessage("");}}/><h2 className="flex items-center gap-2 font-semibold"><CalendarClock className="h-5 w-5 text-amber-500"/>تنبيه تجديد اشتراكات الشبكات</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">إظهار تنبيه قرب الانتهاء قبل الموعد بالمدة المحددة لجميع الشبكات.</p><div className="mt-3 flex flex-wrap items-end gap-3"><label className="text-xs">عدد الأيام<ProjectInput type="number" min={1} max={90} step={1} value={days} disabled={loading||saving} onChange={e=>setDays(e.target.value)}/></label><ProjectButton disabled={loading||saving||!Number.isInteger(Number(days))||Number(days)<1||Number(days)>90} onClick={()=>void save()}>{saving?"جارٍ الحفظ…":"حفظ مدة التنبيه"}</ProjectButton></div></section>;
}
