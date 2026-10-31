import {Activity,CalendarDays,CircleX,Clock3,Database,Gauge,Layers,Plus,Radio,Router,Server,ShieldCheck,UserPlus,Users,Wifi,WifiOff} from "lucide-react";
import type {HomepageShortcutId} from "@/lib/homepage-shortcuts";
export const homepageShortcutGroups=[{value:'all',label:'كل التصنيفات'},{value:'subscribers',label:'المشتركون'},{value:'services',label:'الخدمات'},{value:'management',label:'الإدارة والمتابعة'}] as const;
export const homepageShortcutOptions=[
 {id:'add-subscriber',label:'إضافة مشترك',icon:Plus,group:'subscribers',target:'subscribers&subscriberTab=create',permission:'customers.create',color:'text-blue-700 dark:text-blue-200'},
 {id:'subscribers',label:'المشتركون',icon:Users,group:'subscribers',target:'subscribers',permission:'customers.view',color:'text-emerald-700 dark:text-emerald-200'},
 {id:'profiles',label:'بروفايلات الخدمة',icon:Radio,group:'services',target:'profiles',permission:'principal',color:'text-violet-700 dark:text-violet-200'},
 {id:'servers',label:'خوادم NAS',icon:Server,group:'management',target:'servers',permission:'principal',color:'text-sky-700 dark:text-sky-200'},
 {id:'connected',label:'الخطوط المتصلة',icon:Wifi,group:'subscribers',target:'subscribers&dashboardOrigin=overview&dashboardFilter=connected',permission:'customers.view',color:'text-emerald-700 dark:text-emerald-200'},
 {id:'disconnected',label:'المفعّلة غير المتصلة',icon:WifiOff,group:'subscribers',target:'subscribers&dashboardOrigin=overview&dashboardFilter=active_disconnected',permission:'customers.view',color:'text-blue-700 dark:text-blue-200'},
 {id:'expired',label:'الاشتراكات المنتهية',icon:CalendarDays,group:'subscribers',target:'subscribers&dashboardOrigin=overview&dashboardFilter=expired',permission:'customers.view',color:'text-amber-700 dark:text-amber-200'},
 {id:'pending',label:'الخطوط غير المفعّلة',icon:Clock3,group:'subscribers',target:'subscribers&dashboardOrigin=overview&dashboardFilter=pending',permission:'customers.view',color:'text-violet-700 dark:text-violet-200'},
 {id:'suspended',label:'الموقوفة إداريًا',icon:CircleX,group:'subscribers',target:'subscribers&dashboardOrigin=overview&dashboardFilter=suspended',permission:'customers.view',color:'text-red-700 dark:text-red-200'},
 {id:'quota',label:'نفاد حجم الباقة',icon:Gauge,group:'subscribers',target:'subscribers&dashboardOrigin=overview&dashboardFilter=quota_exhausted',permission:'customers.view',color:'text-orange-700 dark:text-orange-200'},
 {id:'hotspot-packages',label:'باقات الهوتسبوت',icon:Wifi,group:'services',target:'hotspot&hotspotTab=packages',permission:'principal',color:'text-cyan-700 dark:text-cyan-200'},
 {id:'hotspot-batches',label:'دفعات كروت الهوتسبوت',icon:Layers,group:'services',target:'hotspot&hotspotTab=batches',permission:'principal',color:'text-violet-700 dark:text-violet-200'},
 {id:'hotspot-standalone',label:'حسابات الهوتسبوت الفردية',icon:UserPlus,group:'services',target:'hotspot&hotspotTab=standalone',permission:'principal',color:'text-blue-700 dark:text-blue-200'},
 {id:'equipment',label:'إدارة القطع',icon:Router,group:'management',target:'equipment',permission:'principal',color:'text-cyan-700 dark:text-cyan-200'},
 {id:'activity',label:'سجل العمليات',icon:Activity,group:'management',target:'activity',permission:'activity.view',color:'text-blue-700 dark:text-blue-200'},
 {id:'data',label:'إدارة البيانات',icon:Database,group:'management',target:'data',permission:'principal',color:'text-violet-700 dark:text-violet-200'},
 {id:'subscription',label:'معلومات الاشتراك',icon:ShieldCheck,group:'management',target:'subscription',permission:'principal',color:'text-emerald-700 dark:text-emerald-200'},
] as const satisfies readonly {id:HomepageShortcutId;label:string;icon:any;group:string;target:string;permission:string;color:string}[];
