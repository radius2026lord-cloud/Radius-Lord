"use client";
import {useEffect,useState} from 'react';
import {Archive,Building2,PanelsTopLeft,Server,ShieldCheck,Tags,Users,Gauge,Settings,Search,Phone,MapPin,Network,Clock,Coins,Activity,Layers} from 'lucide-react';
import ProjectTabs from '@/components/ui/project-tabs';
import ProjectDropdown from '@/components/ui/project-dropdown';
import NetworkCurrencySettings from '@/components/network-currency-settings';
import NetworkProfiles from '@/components/network-profiles';
import NetworkCategories from '@/components/network-categories';
import NetworkSettings from '@/components/network-settings';
import NetworkRadiusSettings from '@/components/network-radius-settings';
import NetworkManagers from '@/components/network-managers';
import UiPreferencesPanel from '@/components/settings/ui-preferences-panel';
import {ProjectInfoCard,ProjectCardIcon} from '@/components/ui/project-info-card';

type Tab='network'|'radius'|'system'|'archive';
export default function NetworkSettingsHub({endpoint,refresh,initialTab='network',canEditFollowUp=false}:{endpoint:string;refresh:number;initialTab?:Tab;canEditFollowUp?:boolean}){
 const [tab,setTab]=useState<Tab>(initialTab),[kind,setKind]=useState('users'),[networkSection,setNetworkSection]=useState('details'),[networkDetail,setNetworkDetail]=useState<'general'|'contact'|'location'|'areas'|'time'|'private'>('general'),[radiusSection,setRadiusSection]=useState<'accounting'|'grace'|'server'>('accounting'),[systemSection,setSystemSection]=useState<'footer'|'homepage'|'alerts'>('footer'),[jumpValue,setJumpValue]=useState(''),[jumpRevision,setJumpRevision]=useState(0);
 useEffect(()=>setTab(initialTab),[initialTab]);
 const quickSettings=[
  {value:'network-general',label:'بيانات الشبكة العامة',hint:'اسم الشبكة والوصف والترخيص',icon:Building2,iconClassName:'text-sky-600'},
  {value:'network-contact',label:'بيانات التواصل',hint:'البريد وأرقام الهاتف',icon:Phone,iconClassName:'text-teal-600'},
  {value:'network-location',label:'العنوان والموقع',hint:'العنوان والإحداثيات',icon:MapPin,iconClassName:'text-violet-600'},
  {value:'network-areas',label:'مناطق الخدمة',hint:'إضافة وإدارة مناطق الشبكة',icon:Network,iconClassName:'text-emerald-600'},
  {value:'network-time',label:'المنطقة الزمنية',hint:'التوقيت المستخدم في سجلات الشبكة',icon:Clock,iconClassName:'text-sky-600'},
  {value:'network-private',label:'البيانات الداخلية',hint:'الملاحظات والترخيص الداخلي',icon:ShieldCheck,iconClassName:'text-amber-600'},
  {value:'network-currency',label:'العملة الافتراضية',hint:'عملة البروفايلات الجديدة',icon:Coins,iconClassName:'text-amber-600'},
  {value:'radius-accounting',label:'محاسبة RADIUS',hint:'فترة تحديث المحاسبة',icon:Clock,iconClassName:'text-sky-600'},
  {value:'radius-grace',label:'مهلة السماح',hint:'سياسة السماح العامة أو حسب الباقة',icon:ShieldCheck,iconClassName:'text-violet-600'},
  {value:'radius-server',label:'خادم RADIUS',hint:'الخادم المرتبط بالخدمة',icon:Server,iconClassName:'text-emerald-600'},
  {value:'system-footer',label:'تخصيص الشريط السفلي',hint:'مؤشرات NAS والوقت',icon:Server,iconClassName:'text-sky-600'},
  {value:'system-homepage',label:'تخصيص الصفحة الرئيسية',hint:'إظهار البطاقات والاختصارات',icon:Layers,iconClassName:'text-violet-600'},
  {value:'system-alerts',label:'تنبيهات متابعة المشتركين',hint:'حدود انتهاء الاشتراك والاستهلاك',icon:Activity,iconClassName:'text-amber-600'},
  {value:'archive-users',label:'المستخدمون المؤرشفون',hint:'عرض واستعادة المستخدمين',icon:Users,iconClassName:'text-sky-600'},
  {value:'archive-groups',label:'المجموعات المؤرشفة',hint:'عرض واستعادة المجموعات',icon:ShieldCheck,iconClassName:'text-violet-600'},
  {value:'archive-categories',label:'التصنيفات المؤرشفة',hint:'عرض واستعادة التصنيفات',icon:Tags,iconClassName:'text-amber-600'},
  {value:'archive-profiles',label:'البروفايلات المؤرشفة',hint:'عرض واستعادة البروفايلات',icon:Gauge,iconClassName:'text-teal-600'}
 ];
 const jumpToSetting=(value:string)=>{setJumpValue('');setJumpRevision(revision=>revision+1);if(value.startsWith('network-')){setTab('network');if(value==='network-currency'){setNetworkSection('currency');return;}setNetworkSection('details');setNetworkDetail(value.slice('network-'.length) as typeof networkDetail);return;}if(value.startsWith('radius-')){setTab('radius');setRadiusSection(value.slice('radius-'.length) as typeof radiusSection);return;}if(value.startsWith('system-')){setTab('system');setSystemSection(value.slice('system-'.length) as typeof systemSection);return;}if(value.startsWith('archive-')){setTab('archive');setKind(value.slice('archive-'.length));}};
 const titles:Record<Tab,string>={network:'إعدادات الشبكة',radius:'إعدادات RADIUS',system:'إعدادات النظام والواجهة',archive:'الأرشيف'};
 const descriptions:Record<Tab,string>={network:'بيانات الشبكة ومعلومات التواصل والعملة الافتراضية.',radius:'سياسات المحاسبة ومهلة السماح والخادم المرتبط بخدمة RADIUS.',system:'تفضيلات الواجهة الرئيسية والشريط السفلي والتنبيهات الخاصة بحسابك.',archive:'إدارة السجلات المؤرشفة واستعادتها حسب نوعها.'};
 return <div dir="rtl" className="space-y-4">
  <ProjectInfoCard tone="info" className="!p-4 sm:!p-5">
   <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.52fr)]">
    <div className="flex min-w-0 items-start gap-3"><ProjectCardIcon icon={Settings} tone="info"/><div className="min-w-0"><p className="text-[10px] font-semibold text-sky-700 dark:text-sky-300">مركز إدارة الإعدادات</p><h1 className="mt-1 text-base font-bold text-[#17386d] dark:text-white"{titles[tab]}</h1><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">{descriptions[tab]}</p></div></div>
    <div className="min-w-0"><label className="mb-1.5 block text-[10px] font-semibold text-slate-600 dark:text-slate-300">انتقال سريع إلى إعداد</label><ProjectDropdown searchable value={jumpValue} onChange={jumpToSetting} options={quickSettings} icon={Search} placeholder="ابحث عن الإعداد أو اختره" searchPlaceholder="ابحث باسم الإعداد..." fieldStyle/></div>
   </div>
  </ProjectInfoCard>
  <ProjectTabs id="network-settings-hub" value={tab} onChange={value=>setTab(value as Tab)} items={[
   {value:'network',label:'الشبكة',icon:Building2,iconClassName:'text-sky-500'},
   {value:'radius',label:'RADIUS',icon:Server,iconClassName:'text-emerald-500'},
   {value:'system',label:'النظام والواجهة',icon:PanelsTopLeft,iconClassName:'text-violet-500'},
   {value:'archive',label:'الأرشيف',icon:Archive,iconClassName:'text-amber-500'}
  ]}/>
  <section id={`network-settings-hub-panel-${tab}`} role="tabpanel" aria-labelledby={`network-settings-hub-tab-${tab}`} className="min-w-0">
   {tab==='network'?<div className="space-y-4"><ProjectTabs id="network-setting-sections" value={networkSection} onChange={setNetworkSection} items={[{value:"details",label:"بيانات الشبكة",icon:Building2,iconClassName:"text-sky-500"},{value:"currency",label:"العملة الافتراضية",icon:Settings,iconClassName:"text-amber-500"}]}/><section id={`network-setting-sections-panel-${networkSection}`} role="tabpanel" aria-labelledby={`network-setting-sections-tab-${networkSection}`}>{networkSection==="details"?<NetworkSettings endpoint={endpoint} refresh={refresh} initialTab={networkDetail} navigationVersion={jumpRevision}/>:<NetworkCurrencySettings endpoint={endpoint}/>}</section></div>
    :tab==='radius'?<NetworkRadiusSettings endpoint={endpoint} initialSection={radiusSection} navigationVersion={jumpRevision}/>
    :tab==='system'?<UiPreferencesPanel endpoint={`${endpoint}/ui-preferences`} followUpEndpoint={`${endpoint}/follow-up-alerts`} canEditFollowUp={canEditFollowUp} initialSection={systemSection} navigationVersion={jumpRevision} network/>
    :<div className="space-y-4"><ProjectTabs id="archive-types" value={kind} onChange={setKind} items={[
      {value:'users',label:'المستخدمون المؤرشفون',icon:Users,iconClassName:'text-sky-500'},
      {value:'groups',label:'المجموعات المؤرشفة',icon:ShieldCheck,iconClassName:'text-violet-500'},
      {value:'categories',label:'التصنيفات المؤرشفة',icon:Tags,iconClassName:'text-amber-500'},
      {value:'profiles',label:'البروفايلات المؤرشفة',icon:Gauge,iconClassName:'text-teal-500'}
     ]}/><section id={`archive-types-panel-${kind}`} role="tabpanel" aria-labelledby={`archive-types-tab-${kind}`}>{kind==='profiles'?<NetworkProfiles endpoint={endpoint} archiveOnly/>:kind==='categories'?<NetworkCategories endpoint={endpoint} permissions={[]} principal archiveOnly/>:<NetworkManagers key={kind} endpoint={endpoint} groupsMode={kind==='groups'} refresh={refresh} archiveOnly/>}</section></div>}
  </section>
 </div>;
}
