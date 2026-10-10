"use client";
import {useAuth} from "@/components/auth/auth-provider";
import {CollectionState} from "@/components/ui/collection-display";
import LocalHostingSettings from "@/components/settings/local-hosting-settings";
export default function HostingPage(){
 const {isMasterAdmin,loading}=useAuth();
 if(loading)return <CollectionState loading>جارٍ التحميل...</CollectionState>;
 if(!isMasterAdmin)return <CollectionState>هذه الصفحة خاصة بالمدير الرئيسي.</CollectionState>;
 return <div dir="rtl" className="mx-auto max-w-6xl space-y-4"><h1 className="font-bold">استضافة المنصة</h1><section className="rl-surface rounded-[22px] border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[.035]"><LocalHostingSettings/></section></div>;
}
