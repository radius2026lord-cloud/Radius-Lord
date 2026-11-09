"use client";
import {useState} from 'react';
import {Cable,KeyRound,Network,ShieldCheck,UserRound} from 'lucide-react';
import ProjectInput from './ui/project-input';
import {ProjectCardIcon} from './ui/project-info-card';
export const emptyDirectNas={managementAddress:'',radiusAddress:'',apiSourceAddress:'',apiUsername:'',apiPassword:''};
export function validDirectNas(value:typeof emptyDirectNas){
 const ip=(s:string)=>{const parts=s.split('.');return parts.length===4&&parts.every(p=>/^(0|[1-9][0-9]{0,2})$/.test(p)&&Number(p)<=255)&&Number(parts[0])>0&&Number(parts[0])<224&&Number(parts[0])!==127;};
 return ip(value.managementAddress)&&(!value.radiusAddress||ip(value.radiusAddress))&&ip(value.apiSourceAddress)&&Boolean(value.apiUsername&&value.apiPassword)&&! /[^\x21-\x7e]/.test(value.apiUsername+value.apiPassword)&&value.apiUsername.length<=64&&value.apiPassword.length<=128;
}
export default function NasDirectFields({value,onChange,disabled=false,passwordOptional=false}:{value:typeof emptyDirectNas;onChange:(key:keyof typeof emptyDirectNas,value:string)=>void;disabled?:boolean;passwordOptional?:boolean}){
 const [blocked,setBlocked]=useState('');
 return <section className="space-y-3">
  <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">يجب أن يصل الباك إند إلى عنوان إدارة NAS مباشرة. عنوان RADIUS هو عنوان المصدر الذي يراه خادم RADIUS؛ اتركه فارغًا إن كان مطابقًا لعنوان الإدارة. لا يُنشأ نفق OVPN.</p>
  <div className="grid items-start gap-4 sm:grid-cols-2">
   {([{key:'managementAddress',label:'عنوان إدارة NAS · IPv4',icon:Network},{key:'radiusAddress',label:'عنوان مصدر NAS لدى RADIUS (اختياري)',icon:Cable},{key:'apiSourceAddress',label:'عنوان الباك إند المسموح لدى NAS · IPv4',icon:ShieldCheck},{key:'apiUsername',label:'اسم مستخدم API مخصص',icon:UserRound},{key:'apiPassword',label:'كلمة مرور API',icon:KeyRound}] as const).map(field=><label key={field.key} className="min-w-0 space-y-2 text-xs font-semibold">
    <span className="flex items-center gap-2"><ProjectCardIcon icon={field.icon}/>{field.label}</span>
    <ProjectInput required={field.key!=='radiusAddress'&&!(passwordOptional&&field.key==='apiPassword')} dir="ltr" disabled={disabled} type={field.key==='apiPassword'?'password':'text'} autoComplete={field.key==='apiPassword'?'new-password':'off'} maxLength={field.key==='apiPassword'?128:field.key==='apiUsername'?64:15} value={value[field.key]} onChange={e=>{if(/\p{Script=Arabic}/u.test(e.target.value)){setBlocked(field.key);return;}setBlocked('');onChange(field.key,e.target.value);}}/>
    {blocked===field.key&&<span role="status" className="block text-red-700 dark:text-red-300">الأحرف العربية غير مسموحة. بدّل لغة لوحة المفاتيح.</span>}
   </label>)}
  </div>
  <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">مصدر API هو عنوان الباك إند كما يراه الجهاز بعد أي NAT. سيُقيَّد الوصول بهذا العنوان فقط. استخدم حسابًا مخصصًا؛ لا يستبدل السكربت حساب إدارة موجودًا.</p>
 </section>;
}
