"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, Phone, Radio, UserRound } from "lucide-react";

type Mode = "login" | "signup";
type IconType = React.ComponentType<{ className?: string }>;
type FieldProps = {
  label: string;
  icon: IconType;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suffix?: React.ReactNode;
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="text-center" dir="ltr">
      <div className={`relative mx-auto grid place-items-center ${compact ? "h-11 w-14" : "h-16 w-20"}`}>
        <svg viewBox="0 0 96 68" className="h-12 w-[72px]" aria-hidden="true">
          <path d="M8 51 16 15l19 17L48 7l13 25 19-17 8 36Z" fill="#ffad16" />
          <circle cx="16" cy="12" r="5" fill="#0b3b82" />
          <circle cx="48" cy="5" r="5" fill="#0b3b82" />
          <circle cx="80" cy="12" r="5" fill="#0b3b82" />
        </svg>
        <Radio className="absolute bottom-0 h-7 w-7 text-[#0c63dc]" strokeWidth={2.4} />
      </div>
      <div className={`${compact ? "text-[27px]" : "text-[37px]"} mt-1 font-black leading-none tracking-tight text-[#0c3272] dark:text-white`}>LORD</div>
      <div className={`${compact ? "text-[11px]" : "text-[15px]"} mt-1 font-extrabold tracking-[.06em] text-[#f2a000]`}>RADIUS LORD</div>
    </div>
  );
}

function PageMotion() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="auth-orb auth-orb-a" />
      <div className="auth-orb auth-orb-b" />
      <div className="auth-orb auth-orb-c" />
      <svg viewBox="0 0 1600 900" className="auth-network absolute inset-0 h-full w-full opacity-40 dark:opacity-20">
        <g fill="none" stroke="#2f80ed" strokeWidth="1">
          <path d="M70 210 260 120l170 120 170-85 190 115 180-90 230 130" opacity=".18" />
          <path d="M20 640 220 520l170 90 170-120 220 120 185-90 250 115" opacity=".15" />
        </g>
      </svg>
    </div>
  );
}

function PanelNetwork() {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-45 dark:opacity-20" aria-hidden="true">
      <svg viewBox="0 0 700 700" className="h-full w-full">
        <g stroke="#4d91ef" strokeOpacity=".18" fill="none" strokeWidth="1.2">
          <path d="M30 230 150 180l110 76 100-95 120 70 110-72 100 85" />
          <path d="M40 500 155 410l105 72 95-80 130 65 110-92 105 62" />
        </g>
      </svg>
    </div>
  );
}

function ServerIllustration() {
  return (
    <div className="relative mx-auto h-[250px] w-full max-w-[360px]" aria-hidden="true">
      <div className="absolute bottom-2 left-1/2 h-9 w-[78%] -translate-x-1/2 rounded-[50%] bg-[#2f6fc8]/15 blur-xl dark:bg-black/30" />
      <div className="absolute bottom-[12%] left-1/2 w-[56%] -translate-x-1/2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="mb-1.5 flex h-[40px] items-center rounded-[13px] border border-[#7da5d6]/35 bg-gradient-to-r from-[#dbe8f8] to-[#b8cee9] px-4 shadow-sm dark:border-[#486586]/45 dark:from-[#1b3556] dark:to-[#102845]">
            <span className={`h-2.5 w-2.5 rounded-full ${item === 1 ? "bg-[#ffad16]" : "bg-emerald-500"}`} />
            <span className="mr-3 h-2 flex-1 rounded-full bg-[#6d91bd]/55 dark:bg-[#58789c]/60" />
          </div>
        ))}
      </div>
      <div className="absolute bottom-[10%] left-[10%] grid h-[100px] w-[82px] place-items-center rounded-[38%_38%_45%_45%/32%_32%_62%_62%] border-[6px] border-white bg-gradient-to-b from-[#187bff] to-[#063fbf] text-white shadow-xl dark:border-[#dce8f8]">
        <LockKeyhole className="h-9 w-9" />
      </div>
    </div>
  );
}

function VisualPanel({ signup }: { signup: boolean }) {
  return (
    <section className="relative hidden h-full overflow-hidden bg-gradient-to-br from-[#eef4fb] via-[#f8fbff] to-[#e6eef8] dark:from-[#07182a] dark:via-[#081d33] dark:to-[#061526] min-[980px]:block">
      <PanelNetwork />
      <div className="absolute right-0 top-[8%] h-[84%] w-px bg-gradient-to-b from-transparent via-[#7da7d8]/60 to-transparent dark:via-[#3f5f80]/80" />
      <div className="absolute right-[-1px] top-1/2 h-24 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-[#0d6ef0]/0 via-[#0d6ef0]/70 to-[#0d6ef0]/0 blur-[.2px]" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-7 py-6">
        <Brand />
        {signup && (
          <div className="mt-4 text-center">
            <h2 className="text-[20px] font-black text-[#0e316d] dark:text-white">منصة <span className="text-[#086ef1]">LORD</span> لإدارة أجهزة NAS</h2>
            <p className="mx-auto mt-1.5 max-w-[390px] text-[10px] leading-5 text-slate-600 dark:text-slate-300">إدارة سهلة واحترافية لأجهزتك ومشتركيك وجلسات الإنترنت في مكان واحد.</p>
          </div>
        )}
        <div className={`${signup ? "mt-3" : "mt-7"} w-full`}><ServerIllustration /></div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[11%] overflow-hidden" aria-hidden="true">
        <div className="absolute -bottom-[55%] -left-[8%] h-full w-[78%] rotate-6 rounded-[50%] bg-[#0b4bc6]" />
        <div className="absolute -bottom-[60%] left-[8%] h-full w-[84%] -rotate-3 rounded-[50%] bg-[#07379e]" />
        <div className="absolute -bottom-[58%] left-[2%] h-[70%] w-[46%] rotate-12 rounded-[50%] bg-[#ffad16]" />
      </div>
    </section>
  );
}

function Field({ label, icon: Icon, type = "text", value, onChange, placeholder, suffix }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold text-[#17386d] dark:text-slate-200">{label}</span>
      <div className="relative">
        <Icon className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-[43px] w-full rounded-[10px] border border-[#cbd9e8] bg-white pr-10 pl-10 text-[13px] text-[#17386d] outline-none transition placeholder:text-slate-400 focus:border-[#3d8df4] focus:ring-2 focus:ring-[#147bff]/10 dark:border-[#304861] dark:bg-[#091c30] dark:text-white" />
        {suffix}
      </div>
    </label>
  );
}

function Steps() {
  return (
    <div className="mx-auto mt-3.5 grid max-w-[400px] grid-cols-3 gap-2">
      {["المعلومات الأساسية", "معلومات إضافية", "تأكيد الحساب"].map((label, index) => (
        <div key={label} className="relative text-center">
          {index < 2 && <span className="absolute left-[-50%] top-3.5 h-px w-full bg-[#cbd9e7] dark:bg-[#3b526b]" />}
          <div className={`relative z-10 mx-auto grid h-7 w-7 place-items-center rounded-full border text-[11px] font-bold ${index === 0 ? "border-[#0d6ef0] bg-[#0d6ef0] text-white" : "border-[#bccde0] bg-white text-slate-500 dark:border-[#425870] dark:bg-[#0b2036]"}`}>{index + 1}</div>
          <div className={`mt-1 text-[9px] ${index === 0 ? "font-semibold text-[#0d6ef0]" : "text-slate-500 dark:text-slate-400"}`}>{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function LordAuth({ mode }: { mode: Mode }) {
  const signup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [remember, setRemember] = useState(false);
  const [terms, setTerms] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (signup) {
      if (!fullName || !email || !phone || !password || !confirm) return setMessage("يرجى تعبئة جميع الحقول المطلوبة.");
      if (password !== confirm) return setMessage("كلمتا المرور غير متطابقتين.");
      if (!terms) return setMessage("يرجى الموافقة على الشروط والأحكام وسياسة الخصوصية.");
      return setMessage("واجهة إنشاء الحساب جاهزة للربط بخدمة التسجيل الخلفية.");
    }
    if (!email || !password) return setMessage("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: email, password }),
      });
      const data = await response.json();
      if (response.ok && data.success) window.location.href = "/Dashboard";
      else setMessage(data.message || "فشل تسجيل الدخول.");
    } catch {
      setMessage("تعذر الاتصال بالخادم.");
    }
  };

  const eye = (visible: boolean, toggle: () => void) => (
    <button type="button" onClick={toggle} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <main dir="rtl" className="relative min-h-[100dvh] overflow-hidden bg-[#e8eef5] text-[#102a63] dark:bg-[#061526] dark:text-slate-100" style={{ fontFamily: "LBC, Tahoma, Arial, sans-serif" }}>
      <PageMotion />
      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-3 sm:p-4">
        <div dir="ltr" className={`grid w-full max-w-[1020px] overflow-hidden rounded-[22px] border border-white/80 bg-[#f8fbff]/96 shadow-[0_20px_65px_rgba(58,84,112,.18)] backdrop-blur-sm dark:border-white/[.08] dark:bg-[#081b2f]/96 min-[980px]:grid-cols-2 ${signup ? "min-[980px]:h-[650px]" : "min-[980px]:h-[610px]"}`}>
          <VisualPanel signup={signup} />
          <section dir="rtl" className="flex min-h-[calc(100dvh-24px)] items-center justify-center bg-white/95 px-5 py-6 dark:bg-[#0a1f35]/96 sm:px-8 min-[980px]:min-h-0">
            <div className={`w-full ${signup ? "max-w-[420px]" : "max-w-[410px]"}`}>
              <div className="mb-5 min-[980px]:hidden"><Brand compact /></div>
              <div className="text-center">
                <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#eaf2ff] text-[#086df0] dark:bg-[#102d4d] dark:text-[#4da0ff]">{signup ? <UserRound className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}</div>
                <h1 className="mt-2.5 text-[25px] font-black">{signup ? "إنشاء حساب جديد" : "تسجيل الدخول"}</h1>
                <p className="mx-auto mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{signup ? "أنشئ حسابك الآن وابدأ إدارة أجهزتك ومشتركيك بسهولة وأمان" : "مرحباً بك، يرجى تسجيل الدخول للوصول إلى لوحة التحكم"}</p>
              </div>
              {signup && <Steps />}
              <form onSubmit={submit} className={signup ? "mt-3 space-y-2.5" : "mt-7 space-y-3.5"}>
                {signup && <Field label="الاسم الكامل *" icon={UserRound} value={fullName} onChange={setFullName} placeholder="أدخل اسمك الكامل" />}
                <Field label="البريد الإلكتروني *" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="أدخل بريدك الإلكتروني" />
                {signup && (
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-bold text-[#17386d] dark:text-slate-200">رقم الهاتف *</span>
                    <div className="flex h-[43px] overflow-hidden rounded-[10px] border border-[#cbd9e8] bg-white dark:border-[#304861] dark:bg-[#091c30]" dir="ltr">
                      <div className="flex w-[94px] shrink-0 items-center justify-center gap-1.5 border-r border-[#cbd9e8] text-[11px] dark:border-[#304861]">🇮🇶 <span>+964</span></div>
                      <div className="relative flex-1" dir="rtl"><Phone className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="أدخل رقم الهاتف" className="h-full w-full bg-transparent pr-10 pl-3 text-[13px] outline-none dark:text-white" /></div>
                    </div>
                  </label>
                )}
                <Field label="كلمة المرور *" icon={LockKeyhole} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="أدخل كلمة المرور" suffix={eye(showPassword, () => setShowPassword((value) => !value))} />
                {signup && <Field label="تأكيد كلمة المرور *" icon={LockKeyhole} type={showConfirm ? "text" : "password"} value={confirm} onChange={setConfirm} placeholder="أعد إدخال كلمة المرور" suffix={eye(showConfirm, () => setShowConfirm((value) => !value))} />}
                {!signup && <div className="flex items-center justify-between text-[11px]"><label className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 accent-[#0d6ef0]" />تذكرني</label><button type="button" className="font-semibold text-[#0874f9]">نسيت كلمة المرور؟</button></div>}
                {signup && <label className="flex items-start gap-2 text-[9px] leading-5 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-1 h-4 w-4 accent-[#0d6ef0]" /><span>أوافق على <button type="button" className="font-semibold text-[#0874f9]">الشروط والأحكام وسياسة الخصوصية</button></span></label>}
                {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-700 dark:border-amber-400/15 dark:bg-amber-500/10 dark:text-amber-300">{message}</div>}
                <button type="submit" className="flex h-[43px] w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-l from-[#0d6ef0] to-[#0647d9] text-[12px] font-bold text-white shadow-sm hover:brightness-105">{signup ? "إنشاء الحساب" : "تسجيل الدخول"}<span>←</span></button>
                <div className="flex items-center gap-3 text-[10px] text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />أو<span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /></div>
                <button type="button" className="flex h-[43px] w-full items-center justify-center gap-3 rounded-[10px] border border-[#cbd9e8] bg-white text-[11px] font-bold text-[#17386d] dark:border-[#304861] dark:bg-[#091c30] dark:text-white"><span className="text-base font-black text-[#4285f4]">G</span>{signup ? "إنشاء حساب باستخدام Google" : "تسجيل الدخول باستخدام Google"}</button>
                <div className="text-center text-[11px] text-slate-500 dark:text-slate-400">{signup ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"}<Link href={signup ? "/login" : "/signup"} className="mr-2 font-bold text-[#0874f9]">{signup ? "تسجيل الدخول" : "إنشاء حساب جديد"}</Link></div>
              </form>
            </div>
          </section>
        </div>
      </div>
      <style jsx global>{`
        @keyframes lordFloatA { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(34px,-24px,0)} }
        @keyframes lordFloatB { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(-42px,30px,0)} }
        @keyframes lordNetwork { 0%,100%{transform:translateX(0);opacity:.34} 50%{transform:translateX(18px);opacity:.52} }
        .auth-orb{position:absolute;border-radius:999px;filter:blur(65px);opacity:.26;will-change:transform}
        .auth-orb-a{width:280px;height:280px;background:#2687ff;left:-70px;top:8%;animation:lordFloatA 12s ease-in-out infinite}
        .auth-orb-b{width:240px;height:240px;background:#ffad16;right:-85px;bottom:4%;opacity:.12;animation:lordFloatB 15s ease-in-out infinite}
        .auth-orb-c{width:200px;height:200px;background:#7c5cff;left:58%;top:-90px;opacity:.12;animation:lordFloatB 18s ease-in-out infinite reverse}
        .auth-network{animation:lordNetwork 16s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.auth-orb,.auth-network{animation:none!important}}
      `}</style>
    </main>
  );
}
