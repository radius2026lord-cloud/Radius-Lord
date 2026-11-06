"use client";

import {useState} from "react";
import {ArrowLeft, CheckCircle2, FolderPlus, Layers, Settings2} from "lucide-react";
import NetworkCategories from "@/components/network-categories";
import NetworkProfiles from "@/components/network-profiles";
import NetworkSettings from "@/components/network-settings";
import FloatingNotice from "@/components/ui/floating-notice";
import ProjectButton from "@/components/ui/project-button";
import {ProjectCardIcon, ProjectInfoCard} from "@/components/ui/project-info-card";

type Step = 1 | 2 | 3 | 4;
const stages = {
  1: {title: "إعدادات الشبكة", description: "راجع بيانات الشبكة واحفظها قبل المتابعة.", icon: Settings2},
  2: {title: "إضافة أول تصنيف", description: "أضف تصنيفًا واحدًا على الأقل لتنظيم المشتركين.", icon: FolderPlus},
  3: {title: "بروفايلات الخدمة", description: "أضف بروفايل PPPoE الآن أو تخطَّ هذه الخطوة وأضفه لاحقًا.", icon: Layers},
};

export default function NetworkQuickSetup({endpoint,initialStep,networkName,onComplete}:{
  endpoint:string;initialStep:Step;networkName:string;onComplete:()=>void;
}){
  const [step,setStep]=useState(initialStep);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [profileTab,setProfileTab]=useState("");
  const stage=step===4?null:stages[step];

  async function advance(){
    if(busy)return;
    setBusy(true);
    setError("");
    try{
      const response=await fetch(endpoint+"/quick-setup",{
        method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({step}),
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.message);
      if(data.quickSetupStep===5){onComplete();return;}
      if(![2,3,4].includes(data.quickSetupStep)||data.quickSetupStep<=step)throw new Error("تعذر استكمال الإعداد.");
      setStep(data.quickSetupStep);
      window.scrollTo({top:0});
    }catch(e){setError(e instanceof Error?e.message:"تعذر حفظ تقدم الإعداد.");}
    finally{setBusy(false);}
  }

  return <main dir="rtl" className="min-h-dvh bg-[#edf3f8] p-4 text-[#102a63] dark:bg-[#061728] dark:text-slate-100 sm:p-8">
    <div className="mx-auto max-w-5xl space-y-4">
      <FloatingNotice error={error} onDismiss={()=>setError("")}/>
      {stage?<ProjectInfoCard>
        <p className="text-xs font-semibold text-blue-600 dark:text-blue-300">الإعداد السريع · الخطوة {(step+1).toLocaleString("ar")} من ٤</p>
        <h1 className="mt-2 flex items-center gap-2 text-lg font-bold"><ProjectCardIcon icon={stage.icon}/>{stage.title}</h1>
        <p className="mt-2 text-sm">{stage.description}</p>
      </ProjectInfoCard>:<ProjectInfoCard tone="success" className="text-center">
        <ProjectCardIcon icon={CheckCircle2} tone="success"/>
        <h1 className="mt-3 text-xl font-bold">أهلًا بك، شبكة {networkName} جاهزة</h1>
        <p className="mt-2 text-sm">اكتمل الإعداد السريع. يمكنك متابعة إدارة شبكتك من لوحة التحكم.</p>
      </ProjectInfoCard>}
      {step===1&&<NetworkSettings endpoint={endpoint} refresh={0}/>}
      {step===2&&<NetworkCategories endpoint={endpoint} permissions={[]} principal/>}
      {step===3&&profileTab&&<NetworkProfiles endpoint={endpoint} tab={profileTab} onTabChange={setProfileTab}/>}
      <div className="flex flex-wrap justify-end gap-2">
        {step===3&&!profileTab&&<ProjectButton variant="secondary" onClick={()=>setProfileTab("create")}>إضافة بروفايل</ProjectButton>}
        <ProjectButton disabled={busy} onClick={()=>void advance()}><ArrowLeft/>{busy?"جارٍ الحفظ…":step===4?"فتح لوحة التحكم":step===3?(profileTab?"إنهاء الإعداد":"تخطي الآن"):"متابعة"}</ProjectButton>
      </div>
    </div>
  </main>;
}
