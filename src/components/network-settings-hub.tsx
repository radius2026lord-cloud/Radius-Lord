"use client";
import {useState} from 'react';
import {Archive,Building2,Database,PanelsTopLeft,Server,ShieldCheck,Tags,Users,Gauge,Settings} from 'lucide-react';
import ProjectTabs from '@/components/ui/project-tabs';
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
 const [tab,setTab]=useState<Tab>(initialTab),[kind,setKind]=useState('users');
 const descriptions:Record<Tab,string>={network:'بيانات الشبكة ومعلومات التواصل والعملة الافتراضية.',radius:'سياسات المحاسبة ومهلة السماح والخادم المرتبط بخدمة RADIUS.',system:'تفضيلات الواجهة الرئيسية والشريط السفلي والتنبيهات الخاصة بحسابك.',archive:'إدارة السجلات المؤرشفة واستعادتها حسب نوعها.'};
 return <div dir="rtl" className="space-y-4">
  <ProjectInfoCard tone="info" className="!p-4 sm:!p-5">
   <div className="flex items-start gap-3"><ProjectCardIcon icon={Settings} tone="info"/><div className="min-w-0"><h1 className="text-base font-bold text-[#17386d] dark:text-white">إعدادات الشبكة</h1><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">{descriptions[tab]}</p></div></div>
  </ProjectInfoCard>
  <ProjectTabs id="network-settings-hub" value={tab} onChange={value=>setTab(value as Tab)} items={[
   {value:'network',label:'الشبكة',icon:Building2,iconClassName:'text-sky-500'},
   {value:'radius',label:'RADIUS',icon:Server,iconClassName:'text-emerald-500'},
   {value:'system',label:'النظام والواجهة',icon:PanelsTopLeft,iconClassName:'text-violet-500'},
   {value:'archive',label:'الأرشيف',icon:Archive,iconClassName:'text-amber-500'}
  ]}/>
  <section id={`network-settings-hub-panel-${tab}`} role="tabpanel" aria-labelledby={`network-settings-hub-tab-${tab}"} className="min-w-0">
   {tab==='network'?<div className="space-y-4"><NetworkSettings endpoint={endpoint} refresh={refresh}/><NetworkCurrencySettings endpoint={endpoint}/></div>
    :tab==='radius'?<NetworkRadiusSettings endpoint={endpoint}/>
    :tab==='system'?<UiPreferencesPanel endpoint={`${endpoint}/ui-preferences`} followUpEndpoint={`${endpoint}/follow-up-alerts`} canEditFollowUp={canEditFollowUp} network/>
    :<div className="space-y-4"><ProjectTabs id="archive-types" value={kind} onChange={setKind} items={[
      {value:'users',label:'المستخدمون المؤرشفون',icon:Users,iconClassName:'text-sky-500'},
      {value:'groups',label:'المجموعات المؤرشفة',icon:ShieldCheck,iconClassName:'text-violet-500'},
      {value:'categories',label:'التصنيفات المؤرشفة',icon:Tags,iconClassName:'text-amber-500'},
      {value:'profiles',label:'البروفايلات المؤرشفة',icon:Gauge,iconClassName:'text-teal-500'}
     ]}/><section id={`archive-types-panel-${kind}`} role="tabpanel" aria-labelledby={`archive-types-tab-${kind}`}>{kind==='profiles'?<NetworkProfiles endpoint={endpoint} archiveOnly/>:kind==='categories'?<NetworkCategories endpoint={endpoint} permissions={[]} principal archiveOnly/>:<NetworkManagers key={kind} endpoint={endpoint} groupsMode={kind==='groups'} refresh={refresh} archiveOnly/>}</section></div>}
  </section>
 </div>;
}
