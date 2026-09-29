"use client";

import { useEffect,useState } from "react";
import { MessageCircle,Save,Settings2,ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Form={contact_name:string;whatsapp_number:string;whatsapp_enabled:boolean;whatsapp_button_text:string;whatsapp_message_template:string;payment_instructions:string};
const empty:Form={contact_name:"",whatsapp_number:"",whatsapp_enabled:true,whatsapp_button_text:"التواصل عبر واتساب لإتمام الدفع",whatsapp_message_template:"مرحبًا، أرغب بإتمام اشتراكي في Radius Lord. كود الدفع: {{payment_code}}",payment_instructions:""};

export default function PlatformSettingsPage(){
 const [form,setForm]=useState<Form>(empty),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{(async()=>{try{const r=await fetch("/api/billing/settings",{credentials:"include"}),j=await r.json();if(!r.ok)throw new Error(j.message);const m=Object.fromEntries((j.settings??[]).map((x:any)=>[x.setting_key,x.value_type==="boolean"?x.setting_value==="1":x.setting_value??""]));setForm({...empty,...m});}catch(e:any){setMessage(e.message||"تعذر تحميل الإعدادات.");}finally{setLoading(false)}})()},[]);
 const set=(k:keyof Form,v:string|boolean)=>setForm(x=>({...x,[k]:v}));
 const save=async()=>{setSaving(true);setMessage("");try{const number=form.whatsapp_number.replace(/[^0-9]/g,"");if(form.whatsapp_enabled&&!number)throw new Error("أدخل رقم واتساب بصيغة دولية.");const r=await fetch("/api/billing/settings",{method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,whatsapp_number:number})}),j=await r.json();if(!r.ok)throw new Error(j.message);setForm(x=>({...x,whatsapp_number:number}));setMessage("تم حفظ إعدادات التواصل والدفع بنجاح.");}catch(e:any){setMessage(e.message||"تعذر حفظ الإعدادات.");}finally{setSaving(false)}};
 return <div dir="rtl" className="mx-auto w-full max-w-6xl space-y-5">
  <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">إعدادات المنصة</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">الإعدادات العامة التي تظهر للعملاء أثناء الدفع والتفعيل.</p></div>
  <section className="rl-surface overflow-hidden rounded-[26px] border border-slate-200/80 bg-white dark:border-white/10 dark:bg-white/[.035]">
   <div className="flex items-center gap-3 border-b border-slate-200/70 px-6 py-5 dark:border-white/10"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"><MessageCircle className="h-5 w-5"/></span><div><h2 className="font-bold text-slate-900 dark:text-white">التواصل والدفع المحلي</h2><p className="text-xs text-slate-500 dark:text-slate-400">بيانات مركزية تستخدم في صفحة الدفع ورسالة WhatsApp.</p></div></div>
   {loading?<div className="p-8 text-sm text-slate-500">جارٍ تحميل الإعدادات...</div>:<div className="grid gap-5 p-6 md:grid-cols-2">
    <label className="space-y-2"><span className="text-sm font-semibold">اسم جهة التواصل</span><Input value={form.contact_name} onChange={e=>set("contact_name",e.target.value)} placeholder="Radius Lord"/></label>
    <label className="space-y-2"><span className="text-sm font-semibold">رقم WhatsApp الدولي</span><Input dir="ltr" value={form.whatsapp_number} onChange={e=>set("whatsapp_number",e.target.value)} placeholder="9639XXXXXXXX"/></label>
    <label className="space-y-2 md:col-span-2"><span className="text-sm font-semibold">نص زر التواصل</span><Input value={form.whatsapp_button_text} onChange={e=>set("whatsapp_button_text",e.target.value)}/></label>
    <label className="space-y-2 md:col-span-2"><span className="text-sm font-semibold">قالب رسالة WhatsApp</span><Textarea className="min-h-28" value={form.whatsapp_message_template} onChange={e=>set("whatsapp_message_template",e.target.value)}/><span className="text-xs text-slate-500">استخدم <bdi>{"{{payment_code}}"}</bdi> داخل النص ليتم استبداله بكود الدفع تلقائيًا.</span></label>
    <label className="space-y-2 md:col-span-2"><span className="text-sm font-semibold">تعليمات الدفع</span><Textarea className="min-h-24" value={form.payment_instructions} onChange={e=>set("payment_instructions",e.target.value)} placeholder="تعليمات تظهر للعميل قبل التواصل..."/></label>
    <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-slate-200/80 p-4 dark:border-white/10"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-green-500"/><div><div className="text-sm font-bold">تفعيل الدفع عبر WhatsApp</div><div className="text-xs text-slate-500">عند تعطيله لن يظهر زر التواصل للعميل.</div></div></div><button type="button" onClick={()=>set("whatsapp_enabled",!form.whatsapp_enabled)} className={`relative h-7 w-12 rounded-full transition ${form.whatsapp_enabled?"bg-green-500":"bg-slate-300 dark:bg-slate-700"}`} aria-label="تفعيل واتساب"><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${form.whatsapp_enabled?"right-6":"right-1"}`}/></button></div>
   </div>}
   <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 px-6 py-4 dark:border-white/10"><span className={`text-sm ${message.startsWith("تم ")?"text-green-600 dark:text-green-400":"text-red-500"}`}>{message}</span><button type="button" disabled={loading||saving} onClick={save} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#0758e9] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#064fd1] disabled:opacity-50"><Save className="h-4 w-4"/>{saving?"جارٍ الحفظ...":"حفظ الإعدادات"}</button></div>
  </section>
  <div className="flex items-start gap-3 rounded-[22px] border border-blue-200/70 bg-blue-50/70 p-4 text-sm text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200"><Settings2 className="mt-0.5 h-5 w-5 shrink-0"/><p>هذه البيانات عامة على منصة Radius Lord وليست مرتبطة بخطة محددة. كود الدفع والخطة والإجمالي سيضافان إلى رسالة العميل عند إنشاء طلب الدفع.</p></div>
 </div>;
}
