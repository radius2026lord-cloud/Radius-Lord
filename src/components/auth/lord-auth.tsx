"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  BarChart3,
  Crown,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  Radio,
  Server,
  ShieldCheck,
  UserPlus,
  UserRound,
  Wifi,
} from "lucide-react";

type Mode = "login" | "signup";

type FieldProps = {
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
  suffix?: React.ReactNode;
};

function Brand() {
  return (
    <div className="text-center select-none">
      <div className="relative mx-auto grid h-[74px] w-[74px] place-items-center text-[#0758e9] sm:h-[86px] sm:w-[86px]">
        <Crown className="h-14 w-14 text-[#ffad16] sm:h-16 sm:w-16" strokeWidth={2.25} />
        <Radio className="absolute bottom-0 h-8 w-8 text-[#0758e9]" strokeWidth={2.7} />
      </div>
      <div className="mt-2 text-4xl font-black tracking-tight text-[#10306e] dark:text-white sm:text-5xl">LORD</div>
      <div className="mt-1 text-base font-extrabold tracking-[.08em] text-[#f2a000] sm:text-lg">RADIUS LORD</div>
    </div>
  );
}

function ServerArt({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative mx-auto flex items-end justify-center ${compact ? "h-52 max-w-sm" : "h-64 max-w-lg sm:h-72"}`} aria-hidden="true">
      <div className="absolute inset-x-[12%] bottom-4 h-24 rounded-[50%] bg-[#126fff]/10 blur-2xl dark:bg-[#126fff]/15" />
      <div className="relative z-10 mb-8 flex flex-col gap-2 rounded-[30px] bg-gradient-to-br from-[#dce9f8] to-[#9bb7da] p-4 shadow-[0_24px_50px_rgba(47,80,126,.18)] dark:from-[#29466d] dark:to-[#102944] dark:shadow-[0_24px_55px_rgba(0,0,0,.35)]">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="flex h-12 w-44 items-center gap-2 rounded-xl border border-white/60 bg-gradient-to-r from-[#244b7b] to-[#17355c] px-4 shadow-sm sm:w-52 dark:border-white/10">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className={`h-2 w-2 rounded-full ${item === 1 ? "bg-[#ffad16]" : "bg-[#1e8cff]"}`} />
            <span className="mr-auto h-1.5 w-16 rounded-full bg-white/20" />
          </div>
        ))}
      </div>
      <div className="relative z-20 -mr-5 mb-5 grid h-32 w-28 place-items-center rounded-[44%_44%_50%_50%/34%_34%_62%_62%] border-[6px] border-white bg-gradient-to-br from-[#1c80ff] to-[#063fb9] text-white shadow-[0_18px_42px_rgba(18,105,240,.33)] dark:border-[#8fb6e5] sm:h-36 sm:w-32">
        <LockKeyhole className="h-14 w-14" strokeWidth={2.1} />
      </div>
    </div>
  );
}

function LoginVisual() {
  return (
    <section className="relative hidden min-h-[680px] overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br from-[#eef4fb] via-[#f8fbff] to-[#e4edf8] p-8 shadow-[0_18px_55px_rgba(63,88,116,.10)] dark:border-[#23405e] dark:from-[#07182a] dark:via-[#081d32] dark:to-[#07182a] lg:flex lg:flex-col lg:items-center lg:justify-center">
      <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_12%_68%,rgba(16,111,244,.16)_0_2px,transparent_3px),radial-gradient(circle_at_76%_34%,rgba(16,111,244,.14)_0_2px,transparent_3px)] [background-size:82px_82px,105px_105px] dark:opacity-55" />
      <div className="relative z-10 -mt-10"><Brand /><ServerArt compact /></div>
      <div className="absolute bottom-0 left-0 right-0 h-36 overflow-hidden"><div className="absolute -bottom-24 -left-20 h-48 w-[70%] rotate-[8deg] rounded-[50%] bg-[#083d9d] dark:bg-[#073a8f]" /><div className="absolute -bottom-24 left-[12%] h-40 w-[72%] -rotate-[4deg] rounded-[50%] bg-[#0758e9] dark:bg-[#074bbd]" /><div className="absolute bottom-8 left-[5%] h-5 w-[45%] -rotate-[8deg] rounded-full bg-[#ffad16]" /></div>
    </section>
  );
}

const featureItems = [
  ["إدارة شاملة", "تحكم كامل بأجهزة NAS والمشتركين والجلسات في مكان واحد", Server, "from-[#1684ff] to-[#0757e8]"],
  ["تقارير ذكية", "تقارير مفصلة ورسوم بيانية لمراقبة الأداء والاستخدام", BarChart3, "from-[#ffbd45] to-[#f29a00]"],
  ["أمان متقدم", "حماية متقدمة لبياناتك مع نظام صلاحيات متكامل", ShieldCheck, "from-[#24b77e] to-[#0a8d5b]"],
  ["تنبيهات فورية", "تنبيهات فورية لأي أحداث مهمة في الشبكة", Wifi, "from-[#875dff] to-[#6334e3]"],
] as const;

function SignupVisual() {
  return (
    <section className="relative hidden min-h-[760px] overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br from-[#eef4fb] via-[#f8fbff] to-[#e3edf8] p-7 shadow-[0_18px_55px_rgba(63,88,116,.10)] dark:border-[#23405e] dark:from-[#07182a] dark:via-[#081d32] dark:to-[#07182a] lg:block xl:p-9">
      <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_18%_58%,rgba(18,112,244,.18)_0_2px,transparent_3px),radial-gradient(circle_at_80%_28%,rgba(18,112,244,.14)_0_2px,transparent_3px)] [background-size:96px_96px,118px_118px] dark:opacity-45" />
      <div className="relative z-10"><Brand /><div className="mt-7 text-center xl:text-right"><h2 className="text-2xl font-black text-[#11336f] dark:text-white xl:text-3xl">منصة <span className="text-[#0758e9]">LORD</span> لإدارة أجهزة NAS</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300 xl:mx-0">إدارة سهلة واحترافية لأجهزتك ومشتركيك وجلسات الإنترنت في مكان واحد وبأعلى مستوى من الأمان والكفاءة.</p></div><div className="mt-7 grid grid-cols-[minmax(230px,.8fr)_1fr] items-center gap-5 xl:grid-cols-[minmax(250px,.75fr)_1fr]"><div className="space-y-3">{featureItems.map(([title, body, Icon, tone]) => <article key={title} className="flex items-center gap-3 rounded-2xl border border-white/85 bg-white/90 p-3.5 shadow-[0_8px_24px_rgba(70,92,117,.08)] dark:border-white/[.07] dark:bg-[#0c233a]/95"><div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${tone} text-white`}><Icon className="h-5 w-5" /></div><div><h3 className="text-sm font-bold text-[#143772] dark:text-white">{title}</h3><p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{body}</p></div></article>)}</div><ServerArt /></div></div>
      <div className="absolute bottom-0 left-0 right-0 h-28 overflow-hidden"><div className="absolute -bottom-16 -left-20 h-36 w-[74%] rotate-[6deg] rounded-[50%] bg-[#07398f]" /><div className="absolute -bottom-20 left-[18%] h-36 w-[65%] -rotate-[3deg] rounded-[50%] bg-[#0758e9]" /><div className="absolute bottom-8 left-[2%] h-4 w-[46%] -rotate-[7deg] rounded-full bg-[#ffad16]" /></div>
    </section>
  );
}

function Field({ label, icon: Icon, value, onChange, placeholder, type = "text", required, suffix }: FieldProps) {
  return <label className="block min-w-0"><span className="mb-2 block text-sm font-bold text-[#17366d] dark:text-slate-100">{label}{required && <span className="mr-1 text-red-500">*</span>}</span><div className="relative min-w-0"><Icon className="absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" /><input value={value} onChange={(event) => onChange(event.target.value)} type={type} required={required} placeholder={placeholder} className="h-12 w-full min-w-0 rounded-xl border border-[#cbdbea] bg-white pr-12 pl-12 text-sm text-[#16366e] outline-none transition placeholder:text-slate-400 focus:border-[#147bff] focus:ring-4 focus:ring-[#147bff]/10 dark:border-[#29445f] dark:bg-[#0a1f34] dark:text-white dark:placeholder:text-slate-500 sm:h-[52px]" />{suffix}</div></label>;
}

function GoogleButton({ signup }: { signup: boolean }) {
  return <button type="button" className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#cbdbea] bg-white text-sm font-bold text-[#17366d] transition hover:border-[#9cbce0] hover:bg-[#f8fbff] dark:border-[#29445f] dark:bg-[#091d31] dark:text-white dark:hover:bg-[#0d2741] sm:h-[52px]"><span className="grid h-6 w-6 place-items-center rounded-full bg-white text-base font-black text-[#4285f4]">G</span>{signup ? "إنشاء حساب باستخدام Google" : "تسجيل الدخول باستخدام Google"}</button>;
}

export default function LordAuth({ mode }: { mode: Mode }) {
  const signup = mode === "signup";
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [fullName, setFullName] = useState(""); const [phone, setPhone] = useState(""); const [confirmPassword, setConfirmPassword] = useState(""); const [referral, setReferral] = useState(""); const [remember, setRemember] = useState(false); const [accepted, setAccepted] = useState(false); const [showPassword, setShowPassword] = useState(false); const [showConfirm, setShowConfirm] = useState(false); const [message, setMessage] = useState("");

  const submit = async (event: FormEvent) => { event.preventDefault(); setMessage(""); if (signup) { if (!fullName || !email || !phone || !password || !confirmPassword) return setMessage("يرجى تعبئة جميع الحقول المطلوبة."); if (password !== confirmPassword) return setMessage("كلمتا المرور غير متطابقتين."); if (!accepted) return setMessage("يرجى الموافقة على الشروط والأحكام وسياسة الخصوصية."); setMessage("واجهة إنشاء الحساب جاهزة للربط بخدمة التسجيل الخلفية."); return; } if (!email || !password) return setMessage("يرجى إدخال البريد الإلكتروني وكلمة المرور."); try { const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ username: email, password }) }); const data = await response.json(); if (response.ok && data.success) window.location.href = "/Dashboard"; else setMessage(data.message || "فشل تسجيل الدخول."); } catch { setMessage("تعذر الاتصال بالخادم."); } };

  return <main dir="rtl" className="min-h-screen overflow-x-hidden bg-[#dce5ef] p-2.5 text-[#102a63] transition-colors dark:bg-[#061626] dark:text-white sm:p-4 lg:p-5"><div className={`mx-auto grid min-h-[calc(100vh-20px)] max-w-[1540px] gap-4 sm:min-h-[calc(100vh-32px)] lg:min-h-[calc(100vh-40px)] ${signup ? "lg:grid-cols-[1.02fr_1fr]" : "lg:grid-cols-2"}`}>{signup ? <SignupVisual /> : <LoginVisual />}<section className="flex min-w-0 items-center justify-center rounded-[28px] border border-white/80 bg-[#fbfdff]/95 p-4 shadow-[0_18px_55px_rgba(63,88,116,.10)] dark:border-[#23405e] dark:bg-[#0a1f34]/95 dark:shadow-[0_20px_60px_rgba(0,0,0,.22)] sm:p-7 lg:p-8 xl:p-10"><div className={`w-full ${signup ? "max-w-2xl" : "max-w-xl"}`}><div className="mb-7 lg:hidden"><Brand /></div><header className="text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e9f2ff] text-[#0758e9] dark:bg-[#102b49] dark:text-[#2986ff]">{signup ? <UserPlus className="h-8 w-8" /> : <UserRound className="h-8 w-8" />}</div><h1 className="mt-5 text-2xl font-black sm:text-3xl">{signup ? "إنشاء حساب جديد" : "تسجيل الدخول"}</h1><p className="mx-auto mt-2 max-w-lg text-xs leading-6 text-slate-500 dark:text-slate-400 sm:text-sm">{signup ? "أنشئ حسابك الآن وابدأ إدارة أجهزتك ومشتركيك بسهولة وأمان" : "مرحباً بك، يرجى تسجيل الدخول للوصول إلى لوحة التحكم"}</p></header>{signup && <div className="mx-auto mt-7 grid max-w-xl grid-cols-3 gap-2 text-center text-[10px] text-slate-500 dark:text-slate-400 sm:text-xs">{["المعلومات الأساسية", "معلومات إضافية", "تأكيد الحساب"].map((label, index) => <div key={label} className="relative flex min-w-0 flex-col items-center gap-2 before:absolute before:right-[50%] before:top-4 before:-z-0 before:h-px before:w-full before:bg-[#cbd9e7] last:before:hidden dark:before:bg-[#314a64]"><span className={`relative z-10 grid h-8 w-8 place-items-center rounded-full border font-bold ${index === 0 ? "border-[#0758e9] bg-[#0758e9] text-white" : "border-[#bdcede] bg-[#fbfdff] text-slate-500 dark:border-[#38516c] dark:bg-[#0a1f34] dark:text-slate-300"}`}>{index + 1}</span><span className={`truncate ${index === 0 ? "font-bold text-[#0758e9]" : ""}`}>{label}</span></div>)}</div>}<form onSubmit={submit} className="mt-7 space-y-4">{signup && <Field label="الاسم الكامل" required icon={UserRound} value={fullName} onChange={setFullName} placeholder="أدخل اسمك الكامل" />}<Field label="البريد الإلكتروني" required icon={Mail} type="email" value={email} onChange={setEmail} placeholder="أدخل بريدك الإلكتروني" />{signup && <div><span className="mb-2 block text-sm font-bold text-[#17366d] dark:text-slate-100">رقم الهاتف <span className="text-red-500">*</span></span><div className="flex min-w-0 overflow-hidden rounded-xl border border-[#cbdbea] bg-white dark:border-[#29445f] dark:bg-[#0a1f34]"><div className="flex h-12 shrink-0 items-center gap-2 border-l border-[#cbdbea] px-3 text-xs dark:border-[#29445f] sm:h-[52px]"><span>🇮🇶</span><span>+964</span></div><div className="relative min-w-0 flex-1"><Phone className="absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" /><input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" placeholder="أدخل رقم هاتفك" className="h-12 w-full min-w-0 bg-transparent pr-12 pl-4 text-sm outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500 sm:h-[52px]" /></div></div></div>}<Field label="كلمة المرور" required icon={LockKeyhole} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="أدخل كلمة المرور" suffix={<button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-label="إظهار كلمة المرور">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>} />{signup && <Field label="تأكيد كلمة المرور" required icon={LockKeyhole} type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={setConfirmPassword} placeholder="أعد إدخال كلمة المرور" suffix={<button type="button" onClick={() => setShowConfirm((value) => !value)} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-label="إظهار تأكيد كلمة المرور">{showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>} />}{signup && <Field label="المجال التعريفي (اختياري)" icon={ShieldCheck} value={referral} onChange={setReferral} placeholder="أدخل المجال التعريفي إن كان لديك" />}{signup ? <label className="flex items-start gap-2 text-xs leading-6 text-slate-500 dark:text-slate-400"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 accent-[#0758e9]" /><span>أوافق على <button type="button" className="font-bold text-[#0758e9]">الشروط والأحكام وسياسة الخصوصية</button></span></label> : <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm"><label className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#0758e9]" />تذكرني</label><button type="button" className="font-semibold text-[#0758e9]">نسيت كلمة المرور؟</button></div>}{message && <div role="status" className="rounded-xl border border-[#cbdbea] bg-[#f2f7fd] px-4 py-3 text-center text-xs text-[#17366d] dark:border-[#29445f] dark:bg-[#0c253d] dark:text-slate-200">{message}</div>}<button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#126fff] to-[#0750db] text-sm font-bold text-white shadow-[0_10px_25px_rgba(18,105,240,.22)] transition hover:brightness-105 active:scale-[.995] sm:h-[52px]">{signup ? "التالي" : "تسجيل الدخول"}<span aria-hidden="true">←</span></button><div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-[#d8e2ec] dark:bg-[#29445f]" /><span>أو</span><span className="h-px flex-1 bg-[#d8e2ec] dark:bg-[#29445f]" /></div><GoogleButton signup={signup} /><div className="text-center text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{signup ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"} <Link href={signup ? "/login" : "/signup"} className="mr-2 font-bold text-[#0758e9]">{signup ? "تسجيل الدخول" : "إنشاء حساب جديد"}</Link></div></form></div></section></div></main>;
}
