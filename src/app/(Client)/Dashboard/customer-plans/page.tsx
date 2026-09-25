"use client";

import { useEffect,useState } from "react";
import { ArrowRight,Check,Crown,Server,Star,Users,Wifi } from "lucide-react";
import { useRouter } from "next/navigation";

type Plan={id:number;name:string;durationMonths:number;maxTenants:number;maxSubscribers:number;maxNas:number;price:number;currency:string;description:string|null;isFeatured:boolean;status:"active"|"inactive"|"disabled"};

export default function CustomerPlansPage(){
 const router=useRouter(),[plans,setPlans]=useState<Plan[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{fetch("/api/admin/payment-plans",{credentials:"include",cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error();return r.json()}).then(d=>setPlans((d.plans??[]).filter((p:Plan)=>p.status==="active"))).catch(()=>setError("تعذر تحميل الخطط المتاحة حالياً.")).finally(()=>setLoading(false))},[]);
 return <div className="plans-stage relative -m-3 min-h-[calc(100dvh-110px)] overflow-hidden rounded-[22px] p-5 sm:-m-4 sm:p-8" dir="rtl">
  <div className="plans-grid absolute inset-0"/><div className="plans-glow absolute inset-0"/><div className="relative z-10 mx-auto max-w-[1180px]">
   <button onClick={()=>router.push("/Dashboard")} className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-[#aac6e2] bg-white/75 px-3 text-xs font-semibold text-[#17386d] backdrop-blur-xl transition hover:bg-white dark:border-white/[.12] dark:bg-white/[.06] dark:text-white"><ArrowRight className="h-4 w-4"/>العودة</button>
   <header className="mx-auto mb-7 mt-4 max-w-[700px] text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] bg-gradient-to-br from-[#1479ff] to-[#0758e9] text-white shadow-[0_12px_28px_rgba(7,88,233,.24)]"><Crown className="h-6 w-6 text-[#ffb31a]"/></div><h1 className="mt-4 text-2xl font-bold text-[#102a63] dark:text-white sm:text-3xl">اختر الخطة المناسبة لك</h1><p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-300">قارن الخطط المتاحة وحدود الشبكات والمشتركين وأجهزة NAS، ثم اختر ما يناسب احتياجات شبكتك.</p></header>
   {loading?<State>جارٍ تحميل الخطط المتاحة...</State>:error?<State>{error}</State>:plans.length===0?<State>لا توجد خطط نشطة متاحة حالياً.</State>:<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{plans.map(p=><article key={p.id} className={`group relative overflow-hidden rounded-[24px] border bg-white/82 p-5 shadow-[0_14px_38px_rgba(58,84,112,.10)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_46px_rgba(58,84,112,.16)] dark:bg-[#182b40]/85 ${p.isFeatured?"border-[#5d9ff0] ring-2 ring-[#1479ff]/10":"border-[#b9cfe4] dark:border-white/[.10]"}`}>
    {p.isFeatured&&<span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"><Star className="h-3 w-3 fill-current"/>مميزة</span>}
    <div className="text-lg font-bold text-[#17386d] dark:text-white">{p.name}</div><div className="mt-1 text-xs text-slate-400">{p.durationMonths} شهر</div>
    <div className="mt-5 flex items-end gap-2"><span className="text-3xl font-bold text-[#0758e9]">{p.price}</span><span className="pb-1 text-xs font-semibold text-slate-500">{p.currency}</span></div>
    {p.description&&<p className="mt-3 min-h-12 text-xs leading-6 text-slate-500 dark:text-slate-300">{p.description}</p>}
    <div className="mt-4 grid grid-cols-3 gap-2"><Metric icon={Wifi} label="الشبكات" value={limit(p.maxTenants)}/><Metric icon={Users} label="المشتركون" value={limit(p.maxSubscribers)}/><Metric icon={Server} label="NAS" value={limit(p.maxNas)}/></div>
    <button type="button" className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-[#0758e9] text-xs font-semibold text-white shadow-[0_8px_20px_rgba(7,88,233,.18)] transition hover:bg-[#064dcc]"><Check className="h-4 w-4"/>اختيار هذه الخطة</button>
   </article>)}</section>}
  </div>
  <style jsx>{`.plans-stage{background:linear-gradient(135deg,#f7fbff,#edf5ff 50%,#f9fbfe)}:global(.dark) .plans-stage{background:linear-gradient(135deg,#17131b,#211a25 48%,#17263a)}.plans-grid{opacity:.58;background-image:linear-gradient(rgba(64,132,211,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(64,132,211,.15) 1px,transparent 1px);background-size:38px 38px;mask-image:linear-gradient(to bottom,#000,rgba(0,0,0,.45),transparent)}.plans-glow{background:radial-gradient(circle at 50% 15%,rgba(20,121,255,.15),transparent 34%)}}`}</style>
 </div>
}
function Metric({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="rounded-[14px] border border-[#dbe7f2] bg-[#f8fbff] p-2 text-center dark:border-white/[.07] dark:bg-white/[.04]"><Icon className="mx-auto h-4 w-4 text-[#397bd5]"/><div className="mt-1 text-[10px] text-slate-400">{label}</div><div className="mt-1 truncate text-xs font-semibold">{value}</div></div>}
function State({children}:{children:React.ReactNode}){return <div className="mx-auto max-w-[680px] rounded-[22px] border border-[#bdd2e7] bg-white/75 p-8 text-center text-sm text-slate-500 backdrop-blur-xl dark:border-white/[.10] dark:bg-white/[.05] dark:text-slate-300">{children}</div>}
function limit(v:number){return v===0?"غير محدود":new Intl.NumberFormat("ar").format(v)}
