"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Crown,LogOut,Moon,Sun,Wifi } from "lucide-react";
import { useEffect,useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

export default function CustomerOnboardingShell({children}:{children:React.ReactNode}){
 const pathname=usePathname(),{account}=useAuth(),{theme,setTheme}=useTheme(),[mounted,setMounted]=useState(false),[loggingOut,setLoggingOut]=useState(false);
 useEffect(()=>setMounted(true),[]);
 const logout=async()=>{if(loggingOut)return;setLoggingOut(true);try{await fetch("/api/auth/logout",{method:"POST",credentials:"include"})}finally{window.location.replace("/login")}};
 return <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#edf3f9] text-[#102a63] dark:bg-[#17131d] dark:text-white" dir="rtl">
  <header className="z-30 shrink-0 px-3 pt-3 sm:px-5"><div className="flex h-[64px] items-center gap-3 rounded-[20px] border border-white/80 bg-white/90 px-3 shadow-[0_10px_32px_rgba(44,72,104,.10)] backdrop-blur-xl dark:border-white/[.08] dark:bg-[#26212b]/92">
   <Link href="/Dashboard" className="flex items-center gap-2"><span className="relative grid h-10 w-10 place-items-center rounded-[13px] bg-gradient-to-br from-[#1681ff] to-[#0758e9] text-white"><Crown className="h-5 w-5 text-[#ffb019]"/><Wifi className="absolute bottom-1 h-2.5 w-2.5"/></span><span className="hidden leading-tight sm:block"><b className="block text-sm">LORD RADIUS</b><small className="text-[9px] font-bold tracking-wider text-[#e99100]">CUSTOMER SETUP</small></span></Link>
   <div className="mx-auto hidden rounded-full border border-[#d9e5f1] bg-[#f7faff] px-4 py-2 text-[11px] font-semibold text-slate-500 dark:border-white/[.08] dark:bg-white/[.04] dark:text-slate-300">{pathname.includes("customer-plans")?"اختيار خطة الاشتراك":"مرحباً بك في LORD RADIUS"}</div>
   <div className="mr-auto flex items-center gap-2"><div className="hidden text-left sm:block"><div className="max-w-[180px] truncate text-xs font-bold">{account?.fullName||"Customer"}</div><div className="mt-0.5 text-[9px] text-slate-400">Customer</div></div><button onClick={()=>setTheme(mounted&&theme==="dark"?"light":"dark")} className="grid h-10 w-10 place-items-center rounded-full border border-[#d7e3ef] bg-white dark:border-white/[.09] dark:bg-white/[.05]" aria-label="تغيير المظهر">{mounted&&theme==="dark"?<Sun className="h-4 w-4"/>:<Moon className="h-4 w-4"/>}</button><button onClick={logout} disabled={loggingOut} className="grid h-10 w-10 place-items-center rounded-full border border-red-200 bg-red-50 text-red-500 disabled:opacity-50 dark:border-red-500/25 dark:bg-red-500/10" aria-label="تسجيل الخروج"><LogOut className="h-4 w-4"/></button></div>
  </div></header>
  <main className="min-h-0 flex-1 p-3 sm:px-5 sm:pb-5"><div className="h-full min-h-0 overflow-hidden rounded-[24px] border border-[#b9cee3] bg-[#f5f8fc] shadow-[0_18px_45px_rgba(39,69,103,.08)] dark:border-white/[.08] dark:bg-[#19151f]">{children}</div></main>
 </div>
}