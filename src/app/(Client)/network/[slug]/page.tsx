"use client";
import {ProjectClockProvider} from "@/components/ui/project-clock-provider";
import ProjectLoading from "@/components/ui/project-loading";
import LordAuth from "@/components/auth/lord-auth";
import "@/components/auth/auth-transition-fix.css";
import loginStyles from "../../login/Login.module.css";
import NetworkQuickSetup from "@/components/network-quick-setup";
import NetworkFirstLogin from "@/components/network-first-login";
import NetworkDashboard from "@/components/network-dashboard";
import FloatingNotice from "@/components/ui/floating-notice";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import {AlertTriangle,KeyRound,Network as NetworkIcon,Radio,UserRound} from "lucide-react";
import ProjectInput from "@/components/ui/project-input";
import {ProjectInfoCard,ProjectCardIcon} from "@/components/ui/project-info-card";
import ProjectButton from "@/components/ui/project-button";
type Network={quickSetupStep?:1|2|3|4|null;mustChangeCredentials?:boolean;manager:{full_name:string;manager_type:string};networkName:string;license:string;expiresAt:string;maxSubscribers:number;maxNas:number;planName:string;durationMonths:number;startsAt:string};
export default function NetworkPage(){
 const {slug}=useParams<{slug:string}>();const endpoint=`/api/network/${encodeURIComponent(slug)}`;
 const [activationToken,setActivationToken]=useState(""),[recovering,setRecovering]=useState(false),[confirmPassword,setConfirmPassword]=useState(""),[success,setSuccess]=useState("");
 useEffect(()=>{const params=new URLSearchParams(window.location.hash.slice(1)),recovery=params.get("recover"),token=recovery||params.get("activate");if(token){setRecovering(Boolean(recovery));setActivationToken(token);window.history.replaceState(null,"",window.location.pathname+window.location.search);}},[]);
 const [network,setNetwork]=useState<Network|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[password,setPassword]=useState(""),[error,setError]=useState("");
 useEffect(()=>{let live=true;const controller=new AbortController();async function read(){try{const r=await fetch(`${endpoint}/me`,{credentials:"include",cache:"no-store",signal:controller.signal});if(!live)return;if(r.ok)setNetwork(await r.json());else if(r.status===401)setNetwork(null);}catch{/* Keep last display during a network interruption. */}finally{if(live)setLoading(false);}}
 void read();const timer=setInterval(()=>void read(),30000);const onFocus=()=>void read();window.addEventListener("focus",onFocus);return()=>{live=false;controller.abort();clearInterval(timer);window.removeEventListener("focus",onFocus);};},[endpoint]);
 const [recoveryNetwork,setRecoveryNetwork]=useState("");
 const [recoveryUsername,setRecoveryUsername]=useState("");
 const [blockedField,setBlockedField]=useState("");
 useEffect(()=>{
  if(!recovering||!activationToken)return;
  const controller=new AbortController();
  fetch(`${endpoint}/access-recovery`,{method:"POST",cache:"no-store",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"preview",token:activationToken})})
   .then(async response=>{
    const body=await response.json();
    if(!response.ok)throw new Error(body.message);
    setRecoveryNetwork(body.networkName||slug);
   }).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:"تعذر التحقق من رابط الاستعادة.");});
  return ()=>controller.abort();
 },[activationToken,endpoint,recovering,slug]);

 function editRecoveryField(field:string,value:string,update:(value:string)=>void){
  if(recovering&&/\p{Script=Arabic}/u.test(value)){setBlockedField(field);return;}
  setBlockedField(current=>current===field?"":current);
  update(value);
 }
 function arabicWarning(field:string){
  return blockedField===field&&<span role="alert" className="mt-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle className="size-4"/>الأحرف العربية غير مسموحة في هذا الحقل.</span>;
 }
 async function activate(e:React.FormEvent){e.preventDefault();if(busy)return;if(password!==confirmPassword){setError("كلمتا المرور غير متطابقتين.");return;}setBusy(true);setError("");try{const r=await fetch(`${endpoint}/${recovering?"access-recovery":"activate"}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:activationToken,password,...(recovering?{username:recoveryUsername}:{})})}),j=await r.json();if(!r.ok)throw new Error(j.message);if(recovering)setNetwork(null);setActivationToken("");setRecovering(false);setPassword("");setConfirmPassword("");setSuccess(j.message);}catch(e){setError(e instanceof Error?e.message:"تعذر التفعيل.");}finally{setBusy(false);}}
 async function logout(){setBusy(true);try{const response=await fetch(`${endpoint}/logout`,{method:"POST",credentials:"include"});if(!response.ok)return;setNetwork(null);setPassword("");}finally{setBusy(false);}}

 if(network?.mustChangeCredentials&&!activationToken&&!loading)return <NetworkFirstLogin quickSetup={Boolean(network.quickSetupStep)} endpoint={endpoint} onLogout={logout} onComplete={async()=>{const response=await fetch(`${endpoint}/me`,{credentials:'include',cache:'no-store'});if(!response.ok)throw new Error('تم الحفظ؛ أعد تسجيل الدخول ببياناتك الجديدة.');setNetwork(await response.json());}}/>;
 if(network?.quickSetupStep&&!activationToken&&!loading)return <NetworkQuickSetup key={endpoint} endpoint={endpoint} initialStep={network.quickSetupStep} networkName={network.networkName} onComplete={()=>setNetwork(current=>current?{...current,quickSetupStep:null}:current)}/>;
 if(network&&!activationToken&&!loading)return <ProjectClockProvider key={endpoint} endpoint={`${endpoint}/ui-preferences`}><NetworkDashboard network={network} endpoint={endpoint} slug={slug} onLogout={logout}/></ProjectClockProvider>;
 if(!activationToken&&!loading)return <><div className={loginStyles.loginScope}><LordAuth mode="login" networkLogin={{endpoint:`${endpoint}/login`,onSuccess:async()=>{const response=await fetch(`${endpoint}/me`,{credentials:"include",cache:"no-store"});if(!response.ok)throw new Error("NETWORK_SESSION_UNAVAILABLE");setNetwork(await response.json());}}}/></div><FloatingNotice error={error} message={success} onDismiss={()=>{setError("");setSuccess("");}}/></>;
 if(!activationToken&&loading)return <main dir="rtl" className="grid min-h-[100dvh] place-items-center bg-[#edf3f8] px-4 py-8 text-[#102a63] dark:bg-[#061728] dark:text-slate-200"><section aria-busy="true" className="rl-surface w-full max-w-md rounded-[26px] border border-[#a9c8e8] bg-white p-7 shadow-[0_18px_48px_rgba(36,72,112,.10)] dark:border-white/10 dark:bg-[#0d243b] sm:p-9"><div className="flex flex-col items-center text-center"><span className="grid h-14 w-14 place-items-center rounded-[18px] bg-gradient-to-br from-[#1479ff] to-[#0758e9] text-white shadow-[0_10px_26px_rgba(20,121,255,.25)]"><Radio className="h-7 w-7"/></span><h1 className="mt-4 text-xl font-extrabold tracking-tight">Radius Lord</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">جارٍ التحقق من جلسة مدير الشبكة</p><div className="mt-5 w-full rounded-[18px] bg-[#f5f9ff] py-4 dark:bg-white/[.04]"><ProjectLoading compact>لحظة واحدة، نجهّز لوحة التحكم...</ProjectLoading></div></div><FloatingNotice error={error} message={success} onDismiss={()=>{setError("");setSuccess("");}}/></section></main>;
 return <main dir="rtl" className="grid min-h-[100dvh] place-items-center bg-slate-50 px-4 py-8 text-slate-800 dark:bg-[#061728] dark:text-slate-200">
  <ProjectInfoCard className="w-full max-w-xl space-y-5 !p-5 sm:!p-8">
   <h1 className="flex items-center gap-3 text-lg font-bold"><ProjectCardIcon icon={KeyRound} tone="connections"/>{recovering?"تعيين بيانات دخول مدير الشبكة":"تعيين كلمة المرور لمدير الشبكة"}</h1>
   {recovering&&<ProjectInfoCard tone="info" className="flex items-center gap-3"><ProjectCardIcon icon={NetworkIcon}/><div className="min-w-0"><p className="text-xs">شبكة الراديوس</p><p className="break-words font-semibold">{recoveryNetwork||(error?"تعذر التحقق من الشبكة":"جارٍ التحقق من الرابط…")}</p></div></ProjectInfoCard>}
   {recovering&&!recoveryNetwork&&error&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
   {(!recovering||recoveryNetwork)&&<form onSubmit={activate} className="space-y-4">
    <p className="text-sm text-slate-600 dark:text-slate-300">{recovering?"رابط مؤقت للاستخدام مرة واحدة. ستُنهى جلسات المدير السابقة بعد الحفظ.":"رابط مؤقت للاستخدام مرة واحدة. اختر كلمة مرور من 8 إلى 128 محرفًا."}</p>
    {recovering&&<label className="rl-field-label block"><span className="flex items-center gap-2"><UserRound className="size-4 text-blue-500"/>اسم المستخدم الجديد</span><ProjectInput className="mt-2" dir="ltr" autoComplete="username" value={recoveryUsername} onChange={e=>editRecoveryField("username",e.target.value,setRecoveryUsername)} required minLength={3} maxLength={64} pattern={"[A-Za-z][A-Za-z0-9_.\\-]{2,63}"} disabled={busy}/><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">من 3 إلى 64 محرفًا. ابدأ بحرف إنجليزي، ويمكنك استخدام الأرقام والنقطة والشرطة والشرطة السفلية.</span>{arabicWarning("username")}</label>}
    <label className="rl-field-label block">كلمة المرور الجديدة<ProjectInput className="mt-2" dir="ltr" type="password" autoComplete="new-password" value={password} onChange={e=>editRecoveryField("password",e.target.value,setPassword)} required minLength={8} maxLength={recovering?72:128} disabled={busy}/>{recovering&&<span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">8 محارف على الأقل وبحد أقصى 72 بايت.</span>}{arabicWarning("password")}</label>
    <label className="rl-field-label block">تأكيد كلمة المرور<ProjectInput className="mt-2" dir="ltr" type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>editRecoveryField("confirm",e.target.value,setConfirmPassword)} required minLength={8} maxLength={recovering?72:128} disabled={busy}/>{arabicWarning("confirm")}</label>
    <ProjectButton type="submit" disabled={busy}>{busy?"جارٍ الحفظ…":recovering?"حفظ بيانات الدخول":"تفعيل وتعيين كلمة المرور"}</ProjectButton>
   </form>}
   <FloatingNotice error={recoveryNetwork||!recovering?error:""} message={success} onDismiss={()=>{setError("");setSuccess("");}}/>
  </ProjectInfoCard>
 </main>;
}
