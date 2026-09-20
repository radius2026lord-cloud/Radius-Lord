"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { FormEvent, useEffect, useState } from "react";
import {
  Crown,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Moon,
  Phone,
  Radio,
  Server,
  ShieldCheck,
  Sun,
  UserRound,
  Wifi,
} from "lucide-react";

type Mode = "login" | "signup";
function Brand() {
  return (
    <div className="text-center">
      <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-[26px] bg-gradient-to-br from-[#147bff] to-[#0843bd] text-white shadow-[0_16px_40px_rgba(19,110,245,.28)]">
        <Crown className="h-10 w-10 text-[#ffad16]" strokeWidth={2.1} />
        <Radio className="absolute bottom-2 h-5 w-5" strokeWidth={2.4} />
      </div>
      <div className="mt-4 text-4xl font-black tracking-tight text-[#0d2d69] dark:text-white">LORD</div>
      <div className="mt-1 text-lg font-bold tracking-[.08em] text-[#e99100]">RADIUS LORD</div>
    </div>
  );
}

function ThemeButton() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && theme === "dark";
  return (
    <button type="button" onClick={() => setTheme(dark ? "light" : "dark")} className="absolute left-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-2xl border border-[#d4e1ef] bg-white/85 text-[#0c3d87] shadow-sm backdrop-blur-md transition hover:scale-105 dark:border-white/10 dark:bg-[#0d243b]/90 dark:text-white" aria-label="تبديل الوضع">
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

function InfoPanel() {
  const features = [
    ["إدارة شاملة", "تحكم كامل بأجهزة NAS والمشتركين والجلسات في مكان واحد", Server, "blue"],
    ["تقارير ذكية", "تقارير مفصلة ورسوم بيانية لمراقبة الأداء والاستخدام", Wifi, "amber"],
    ["أمان متقدم", "حماية متقدمة للبيانات مع نظام صلاحيات متكامل", ShieldCheck, "green"],
    ["تنبيهات فورية", "تنبيهات فورية لأي أحداث مهمة في الشبكة", Radio, "violet"],
  ] as const;
  const tones: Record<string, string> = { blue: "from-[#1684ff] to-[#0757e8]", amber: "from-[#ffbd45] to-[#f29a00]", green: "from-[#24b77e] to-[#0a8d5b]", violet: "from-[#875dff] to-[#6334e3]" };
  return (
    <div className="relative hidden overflow-hidden rounded-[32px] border border-white/70 bg-gradient-to-br from-[#edf4fb] via-[#f8fbff] to-[#e5eef8] p-8 shadow-[0_22px_60px_rgba(70,95,122,.12)] dark:border-white/[.08] dark:from-[#081b2f] dark:via-[#091f36] dark:to-[#07182a] lg:block">
      <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_20%_20%,rgba(20,121,255,.10),transparent_30%),radial-gradient(circle_at_80%_70%,rgba(255,173,22,.10),transparent_32%)]" />
      <div className="relative z-10"><Brand /><div className="mt-7 text-center"><h2 className="text-3xl font-black text-[#0f2f67] dark:text-white">منصة LORD لإدارة أجهزة NAS</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">إدارة سهلة واحترافية لأجهزتك ومشتركيك وجلسات الإنترنت في مكان واحد وبأعلى مستوى من الأمان والكفاءة.</p></div>
        <div className="mx-auto mt-7 grid max-w-xl grid-cols-2 gap-3">{features.map(([title, body, Icon, tone]) => <div key={title} className="rounded-[22px] border border-white/90 bg-white/90 p-4 shadow-[0_10px_26px_rgba(66,89,114,.08)] dark:border-white/[.07] dark:bg-[#0d243b]/95"><div className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${tones[tone]} text-white`}><Icon className="h-5 w-5" /></div><div className="mt-3 font-bold text-[#12366f] dark:text-white">{title}</div><div className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">{body}</div></div>)}</div>
        <div className="mx-auto mt-8 flex max-w-xl items-center justify-center gap-5 rounded-[28px] border border-white/80 bg-white/55 p-6 dark:border-white/[.06] dark:bg-white/[.025]"><div className="grid h-28 w-28 place-items-center rounded-[28px] bg-gradient-to-br from-[#173c72] to-[#0a1d35] shadow-[0_18px_35px_rgba(11,41,82,.18)]"><Server className="h-14 w-14 text-[#4ea2ff]" /></div><div className="grid h-24 w-24 place-items-center rounded-[26px] bg-gradient-to-br from-[#147bff] to-[#063db9] text-white shadow-[0_18px_35px_rgba(20,123,255,.24)]"><ShieldCheck className="h-12 w-12" /></div></div>
      </div><div className="absolute bottom-0 left-0 right-0 h-24 bg-[radial-gradient(ellipse_at_bottom,#0b47be_0%,#0b47be_30%,transparent_31%)] opacity-20 dark:opacity-25" />
    </div>
  );
}

function Field({ label, icon: Icon, type = "text", value, onChange, placeholder, suffix }: { label: string; icon: any; type?: string; value: string; onChange: (v: string) => void; placeholder: string; suffix?: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-[#17386d] dark:text-slate-200">{label}</span><div className="relative"><Icon className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-12 w-full rounded-2xl border border-[#d7e3ef] bg-white pr-12 pl-12 text-sm text-[#17386d] outline-none transition placeholder:text-slate-400 focus:border-[#62a7ff] focus:ring-4 focus:ring-[#147bff]/10 dark:border-white/[.09] dark:bg-[#0b2036] dark:text-white dark:placeholder:text-slate-500" />{suffix}</div></label>;
}

export default function LordAuth({ mode }: { mode: Mode }) {
  const isSignup = mode === "signup";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setMessage("");
    if (isSignup) {
      if (!fullName || !email || !phone || !password || !confirm) return setMessage("يرجى تعبئة جميع الحقول المطلوبة.");
      if (password !== confirm) return setMessage("كلمتا المرور غير متطابقتين.");
      setMessage("بيانات الحساب جاهزة للربط بخدمة التسجيل الخلفية."); return;
    }
    if (!email || !password) return setMessage("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
    try { const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ username: email, password }) }); const data = await res.json(); if (res.ok && data.success) window.location.href = "/Dashboard"; else setMessage(data.message || "فشل تسجيل الدخول."); } catch { setMessage("تعذر الاتصال بالخادم."); }
  };


  return <div dir="rtl" className="min-h-screen bg-[#dce5ef] p-3 text-[#102a63] transition-colors dark:bg-[#07182a] dark:text-slate-100 sm:p-5 lg:p-6">
    <ThemeButton />
    <div className={`mx-auto grid min-h-[calc(100vh-48px)] max-w-[1500px] gap-5 ${isSignup ? "lg:grid-cols-[1fr_1.08fr]" : "lg:grid-cols-[1fr_1fr]"}`}><InfoPanel />
      <section className="flex items-center justify-center rounded-[32px] border border-white/80 bg-[#f9fbfe]/95 p-4 shadow-[0_22px_60px_rgba(70,95,122,.12)] dark:border-white/[.08] dark:bg-[#0b2036]/95 dark:shadow-[0_22px_60px_rgba(0,0,0,.24)] sm:p-7 lg:p-9"><div className="w-full max-w-2xl"><div className="mb-8 lg:hidden"><Brand /></div>
        <div className="text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e9f2ff] text-[#086df0] dark:bg-[#0e2b4b] dark:text-[#4da0ff]">{isSignup ? <UserRound className="h-7 w-7" /> : <LockKeyhole className="h-7 w-7" />}</div><h1 className="mt-5 text-3xl font-black">{isSignup ? "إنشاء حساب جديد" : "تسجيل الدخول"}</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{isSignup ? "أنشئ حسابك الآن وابدأ إدارة حسابك بسهولة وأمان" : "مرحباً بك، يرجى تسجيل الدخول للوصول إلى لوحة التحكم"}</p></div>
        <form onSubmit={submit} className="mt-8 space-y-4">
          {isSignup ? <div className="space-y-4"><Field label="الاسم الكامل *" icon={UserRound} value={fullName} onChange={setFullName} placeholder="أدخل اسمك الكامل" /><Field label="البريد الإلكتروني *" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="أدخل بريدك الإلكتروني" /><Field label="رقم الهاتف *" icon={Phone} value={phone} onChange={setPhone} placeholder="أدخل رقم الهاتف" /><Field label="كلمة المرور *" icon={LockKeyhole} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="أدخل كلمة المرور" suffix={<button type="button" onClick={() => setShowPassword(v=>!v)} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{showPassword?<EyeOff className="h-5 w-5"/>:<Eye className="h-5 w-5"/>}</button>} /><Field label="تأكيد كلمة المرور *" icon={LockKeyhole} type={showConfirm ? "text" : "password"} value={confirm} onChange={setConfirm} placeholder="أعد إدخال كلمة المرور" suffix={<button type="button" onClick={() => setShowConfirm(v=>!v)} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{showConfirm?<EyeOff className="h-5 w-5"/>:<Eye className="h-5 w-5"/>}</button>} /><button type="submit" className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#086df0] to-[#0757d7] font-bold text-white shadow-[0_10px_24px_rgba(8,109,240,.22)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(8,109,240,.28)]">إنشاء الحساب <ShieldCheck className="h-4 w-4" /></button></div> : <><Field label="البريد الإلكتروني *" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="أدخل بريدك الإلكتروني" /><Field label="كلمة المرور *" icon={LockKeyhole} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="أدخل كلمة المرور" suffix={<button type="button" onClick={() => setShowPassword(v=>!v)} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{showPassword?<EyeOff className="h-5 w-5"/>:<Eye className="h-5 w-5"/>}</button>} /><div className="flex items-center justify-between text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} /> تذكرني</label><Link href="#" className="font-semibold text-[#086df0]">نسيت كلمة المرور؟</Link></div><button type="submit" className="h-12 w-full rounded-2xl bg-gradient-to-l from-[#086df0] to-[#0757d7] font-bold text-white">تسجيل الدخول</button></>}
          {message && <div className="mt-4 rounded-2xl border border-[#d7e3ef] bg-[#f2f7fc] px-4 py-3 text-center text-sm text-slate-600 dark:border-white/[.08] dark:bg-[#0e2945] dark:text-slate-300">{message}</div>}
        </form>
        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">{isSignup ? <>لديك حساب بالفعل؟ <Link href="/login" className="font-bold text-[#086df0]">تسجيل الدخول</Link></> : <>ليس لديك حساب؟ <Link href="/signup" className="font-bold text-[#086df0]">إنشاء حساب جديد</Link></>}</div>
      </div></section></div>
  </div>;
}
