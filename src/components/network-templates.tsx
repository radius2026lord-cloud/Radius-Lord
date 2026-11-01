"use client";
import {ArrowLeft,ArrowRight,CreditCard,FileText,Layers,MessageSquare,Receipt,ScrollText,Settings2,Users} from "lucide-react";
import HotspotCardTemplates from "@/components/hotspot-card-templates";
import {SubscriberCardDesigner} from "@/components/subscriber-card-designer";
import ProjectButton from "@/components/ui/project-button";
import ProjectTabs from "@/components/ui/project-tabs";
import {ProjectInfoCard} from "@/components/ui/project-info-card";

type TemplateGroup='cards'|'documents'|'messages';
const groups=[
 {value:'cards',label:'البطاقات',icon:CreditCard,iconClassName:'text-blue-600'},
 {value:'documents',label:'المستندات',icon:FileText,iconClassName:'text-violet-600'},
 {value:'messages',label:'الرسائل',icon:MessageSquare,iconClassName:'text-emerald-600'}
];
const templates=[
 {id:'subscriber-card',group:'cards',name:'بطاقة المشترك',description:'تصميم البطاقة وبياناتها ووجهيها، ثم اعتمادها للطباعة من ملف المشترك.',icon:CreditCard,color:'text-blue-600 dark:text-blue-300',ready:true},
 {id:'hotspot-card',group:'cards',name:'بطاقات الهوتسبوت',description:'قوالب مقاسات الكروت وبيانات الدخول وترتيب الطباعة.',icon:Layers,color:'text-cyan-600 dark:text-cyan-300',ready:true},
 {id:'invoice',group:'documents',name:'الفواتير',description:'الشعار وبيانات المشترك وبنود الفاتورة ورأس الصفحة وتذييلها.',icon:Receipt,color:'text-violet-600 dark:text-violet-300',ready:false},
 {id:'contract',group:'documents',name:'عقد المشترك',description:'بيانات المشترك والخدمة وشروط العقد والتوقيع.',icon:ScrollText,color:'text-amber-600 dark:text-amber-300',ready:false},
 {id:'sms',group:'messages',name:'رسائل SMS',description:'نصوص الرسائل ومتغيرات المشترك والباقة وموعد الانتهاء.',icon:MessageSquare,color:'text-sky-600 dark:text-sky-300',ready:false},
 {id:'whatsapp',group:'messages',name:'رسائل واتساب',description:'نصوص التواصل والتذكير ومعاينة بيانات الرسالة.',icon:MessageSquare,color:'text-emerald-600 dark:text-emerald-300',ready:false}
];
export default function NetworkTemplates({endpoint,basePath,networkName,canEdit,group,designing,onNavigate,onSubscribers}:{endpoint:string;basePath:string;networkName:string;canEdit:boolean;group:TemplateGroup;designing:'subscriber-card'|'hotspot-card'|null;onNavigate:(group:TemplateGroup,design?:'subscriber-card'|'hotspot-card')=>void;onSubscribers:()=>void}){
 if(designing)return <section dir="rtl" className="min-w-0 space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><ProjectButton variant="back" onClick={()=>onNavigate('cards')}><ArrowRight/>القوالب والمراسلات</ProjectButton><ProjectButton variant="ghost" onClick={onSubscribers}><Users/>المشتركون</ProjectButton></div>{designing==='hotspot-card'?(canEdit?<HotspotCardTemplates endpoint={endpoint} networkName={networkName}/>:<ProjectInfoCard tone="warning">إدارة قوالب الهوتسبوت متاحة لمدير الشبكة الرئيسي.</ProjectInfoCard>):<SubscriberCardDesigner endpoint={endpoint} basePath={basePath} networkName={networkName} canEdit={canEdit}/>}</section>;
 return <section dir="rtl" className="min-w-0 space-y-4">
  <ProjectInfoCard className="!border-slate-200 !bg-white dark:!border-white/10 dark:!bg-[#0d243b]"><div className="flex items-start gap-3"><FileText aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-300"/><div className="min-w-0"><h1 className="text-base font-bold text-[#17386d] dark:text-white">القوالب والمراسلات</h1><p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-300">إدارة تصاميم البطاقات والمستندات ونصوص الرسائل الخاصة بشبكتك.</p></div></div></ProjectInfoCard>
  <ProjectTabs id="network-template-groups" value={group} onChange={value=>onNavigate(value as TemplateGroup)} items={groups}/>
  <div id={`network-template-groups-panel-${group}`} role="tabpanel" aria-labelledby={`network-template-groups-tab-${group}`} className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
   {templates.filter(template=>template.group===group).map(template=><ProjectInfoCard key={template.id} className="!border-slate-200 !bg-white dark:!border-white/10 dark:!bg-[#0d243b]"><div className="flex items-start justify-between gap-3"><template.icon aria-hidden="true" className={`h-6 w-6 shrink-0 ${template.color}`}/><span className={`text-[10px] font-semibold ${template.ready?'text-emerald-700 dark:text-emerald-300':'text-slate-500 dark:text-slate-400'}`}>{template.ready?'متاح':'غير مفعّل بعد'}</span></div><h2 className="mt-4 text-sm font-bold text-[#17386d] dark:text-slate-100">{template.name}</h2><p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-300">{template.description}</p><div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">{template.ready?<ProjectButton variant="secondary" disabled={template.id==='hotspot-card'&&!canEdit} onClick={()=>onNavigate('cards',template.id==='hotspot-card'?'hotspot-card':'subscriber-card')}><Settings2/>{template.id==='hotspot-card'?'تصميم بطاقات الهوتسبوت':canEdit?'تصميم بطاقة المشترك':'معاينة بطاقة المشترك'}<ArrowLeft/></ProjectButton>:<p className="text-[10px] text-slate-500 dark:text-slate-400">سيُضاف المصمّم الخاص بهذا النوع في مرحلة لاحقة.</p>}</div></ProjectInfoCard>)}
  </div>
 </section>;
}

