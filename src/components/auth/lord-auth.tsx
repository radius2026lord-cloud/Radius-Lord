"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, Radio, UserRound } from "lucide-react";
import {
  CompactField,
  PrimaryFormButton,
  SecondaryFormButton,
} from "@/components/ui/auth-form-controls";
import { CountryPhoneInput } from "@/components/ui/country-phone-input";
import {
  arabCountries,
  defaultArabCountry,
  radiusAuthContent,
} from "@/components/auth/auth-content";

type Mode = "login" | "signup";

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="text-center" dir="ltr">
      <div className={`relative mx-auto grid place-items-center ${compact ? "h-12 w-16" : "h-[72px] w-[92px]"}`}>
        <svg viewBox="0 0 96 68" className={compact ? "h-11 w-[68px]" : "h-[58px] w-[84px]"} aria-hidden="true">
          <path d="M8 51 16 15l19 17L48 7l13 25 19-17 8 36Z" fill="#ffad16" />
          <circle cx="16" cy="12" r="5" fill="#0b3b82" />
          <circle cx="48" cy="5" r="5" fill="#0b3b82" />
          <circle cx="80" cy="12" r="5" fill="#0b3b82" />
        </svg>
        <Radio className={`absolute bottom-0 text-[#0c63dc] ${compact ? "h-6 w-6" : "h-8 w-8"}`} strokeWidth={2.4} />
      </div>
      <div className={`${compact ? "text-[28px]" : "text-[42px]"} mt-1 font-black leading-none tracking-tight text-[#0c3272] dark:text-white`}>LORD</div>
      <div className={`${compact ? "text-[11px]" : "text-[16px]"} mt-1.5 font-extrabold tracking-[.06em] text-[#f2a000]`}>RADIUS LORD</div>
    </div>
  );
}

function PageMotion() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="auth-orb auth-orb-a" />
      <div className="auth-orb auth-orb-b" />
      <svg viewBox="0 0 1600 900" className="auth-network absolute inset-0 h-full w-full opacity-25 dark:opacity-12">
        <g fill="none" stroke="#2f80ed" strokeWidth="1">
          <path d="M10 220 145 145l120 78 135-100 130 92" opacity=".16" />
          <path d="M0 620 130 520l145 80 130-105 150 75" opacity=".13" />
          <path d="M1180 130 1310 215l135-78 130 95" opacity=".10" />
        </g>
      </svg>
    </div>
  );
}

function ServerIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative mx-auto w-full ${compact ? "h-[150px] max-w-[260px]" : "h-[260px] max-w-[380px]"}`} aria-hidden="true">
      <div className="absolute bottom-1 left-1/2 h-8 w-[76%] -translate-x-1/2 rounded-[50%] bg-[#2f6fc8]/14 blur-xl" />
      <div className="absolute bottom-[14%] left-1/2 w-[55%] -translate-x-1/2">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className={`${compact ? "mb-1 h-[26px]" : "mb-1.5 h-[42px]"} flex items-center rounded-[11px] border border-[#7da5d6]/28 bg-gradient-to-r from-[#dbe8f8] to-[#b8cee9] px-3 shadow-sm dark:border-[#486586]/40 dark:from-[#1b3556] dark:to-[#102845]`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${item === 1 ? "bg-[#ffad16]" : "bg-emerald-500"}`} />
            <span className="mr-2.5 h-1.5 flex-1 rounded-full bg-[#6d91bd]/45 dark:bg-[#58789c]/50" />
          </div>
        ))}
      </div>
      <div className={`absolute bottom-[8%] left-[13%] grid ${compact ? "h-[68px] w-[56px] border-[4px]" : "h-[104px] w-[86px] border-[6px]"} place-items-center rounded-[38%_38%_45%_45%/32%_32%_62%_62%] border-white bg-gradient-to-b from-[#187bff] to-[#063fbf] text-white shadow-xl dark:border-[#dce8f8]`}>
        <LockKeyhole className={compact ? "h-7 w-7" : "h-10 w-10"} />
      </div>
    </div>
  );
}

const featureToneClasses = {
  blue: "bg-[#e8f1ff] text-[#0874f9] dark:bg-[#102e4f] dark:text-[#64adff]",
  green: "bg-[#e6f8ef] text-[#13a563] dark:bg-[#113a31] dark:text-[#50d39a]",
  violet: "bg-[#f0eaff] text-[#8b5cf6] dark:bg-[#2b2147] dark:text-[#b79cff]",
  amber: "bg-[#fff1dc] text-[#f39a00] dark:bg-[#3d2d18] dark:text-[#ffbd4a]",
} as const;

function RadiusSummary() {
  return (
    <div className="mt-6 w-full max-w-[480px] rounded-[22px] border border-white/85 bg-white/74 p-5 shadow-[0_14px_34px_rgba(50,84,124,.09)] backdrop-blur-sm dark:border-white/[.07] dark:bg-[#0d243b]/68">
      <div className="mb-4 text-center text-[14px] font-black text-[#17386d] dark:text-slate-100">
        {radiusAuthContent.summaryTitle}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {radiusAuthContent.features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div key={feature.title} className="flex min-h-[78px] items-start gap-3 rounded-[14px] bg-white/72 p-3 dark:bg-white/[.035]" dir="rtl">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[12px] ${featureToneClasses[feature.tone]}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 text-right">
                <div className="text-[12px] font-black text-[#17386d] dark:text-white">{feature.title}</div>
                <div className="mt-1 text-[10px] leading-5 text-slate-500 dark:text-slate-400">{feature.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WaveFooter() {
  return (
    <div
      className="pointer-events-none absolute bottom-0 left-0 h-[150px] w-full overflow-hidden"
      style={{ WebkitMaskImage: "linear-gradient(to right,#000 0%,#000 72%,rgba(0,0,0,.72) 84%,transparent 100%)", maskImage: "linear-gradient(to right,#000 0%,#000 72%,rgba(0,0,0,.72) 84%,transparent 100%)" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 720 150" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path d="M0 92 C150 55 260 135 395 94 C505 62 590 66 720 104 L720 150 L0 150Z" fill="#7ca9ec" opacity=".38" />
        <path d="M0 105 C145 70 270 148 410 103 C530 67 610 83 720 116 L720 150 L0 150Z" fill="#195ed6" opacity=".9" />
        <path d="M0 119 C145 88 260 153 405 117 C535 85 622 96 720 126 L720 150 L0 150Z" fill="#073da5" />
        <path d="M0 132 C76 111 140 122 214 150 L0 150Z" fill="#ffad16" />
      </svg>
    </div>
  );
}

function VisualPanel({ signup }: { signup: boolean }) {
  return (
    <section className="relative hidden h-full overflow-hidden bg-gradient-to-br from-[#edf4fc] via-[#f8fbff] to-[#e9f1f9] dark:from-[#07182a] dark:via-[#081d33] dark:to-[#061526] min-[1100px]:block">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_28%,rgba(48,137,255,.10),transparent_24%),radial-gradient(circle_at_70%_72%,rgba(255,173,22,.07),transparent_22%)]" />
      <div className="absolute right-0 top-6 bottom-6 w-px bg-gradient-to-b from-transparent via-[#9bbce4]/48 to-transparent dark:via-[#45627f]/55" />

      <div className="relative z-10 flex h-full flex-col items-center px-8 pt-9 text-center xl:px-10 xl:pt-11">
        <Brand />
        {signup ? (
          <>
            <div className="mt-7 text-center">
              <h2 className="text-[22px] font-black text-[#0e316d] dark:text-white xl:text-[24px]">
                {radiusAuthContent.title}
              </h2>
              <p className="mx-auto mt-3 max-w-[500px] text-[12px] leading-6 text-slate-600 dark:text-slate-300 xl:text-[13px]">
                {radiusAuthContent.description}
              </p>
            </div>
            <RadiusSummary />
            <div className="mt-auto mb-[86px] w-full"><ServerIllustration compact /></div>
          </>
        ) : (
          <div className="mt-auto mb-[105px] w-full"><ServerIllustration /></div>
        )}
      </div>
      <WaveFooter />
    </section>
  );
}

export default function LordAuth({ mode }: { mode: Mode }) {
  const signup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState(defaultArabCountry);
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
      return setMessage(`واجهة إنشاء الحساب جاهزة للربط الخلفي (${country.code}${phone}).`);
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
    <main dir="rtl" className="relative min-h-[100dvh] overflow-x-hidden bg-[#e8eef5] text-[#102a63] dark:bg-[#061526] dark:text-slate-100" style={{ fontFamily: "LBC, Tahoma, Arial, sans-serif" }}>
      <PageMotion />
      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-3 sm:p-4 lg:p-5">
        <div
          dir="ltr"
          className={`grid w-full max-w-[1320px] overflow-hidden rounded-[26px] border border-white/80 bg-[#f8fbff]/97 shadow-[0_20px_60px_rgba(58,84,112,.16)] backdrop-blur-sm dark:border-white/[.08] dark:bg-[#081b2f]/97 min-[1100px]:grid-cols-2 min-[1100px]:h-[min(800px,calc(100dvh-40px))] min-[1100px]:min-h-[680px]`}
        >
          <VisualPanel signup={signup} />

          <section dir="rtl" className="flex min-h-[calc(100dvh-24px)] items-center justify-center bg-white/96 px-5 py-7 dark:bg-[#0a1f35]/96 sm:px-8 min-[1100px]:min-h-0 lg:px-10 xl:px-12">
            <div className={`w-full ${signup ? "max-w-[540px]" : "max-w-[460px]"}`}>
              <div className="mb-5 min-[1100px]:hidden"><Brand compact /></div>

              <div className="text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#eaf2ff] text-[#086df0] dark:bg-[#102d4d] dark:text-[#4da0ff]">
                  {signup ? <UserRound className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
                </div>
                <h1 className="mt-3 text-[27px] font-black sm:text-[29px]">{signup ? "إنشاء حساب جديد" : "تسجيل الدخول"}</h1>
                <p className="mx-auto mt-1.5 text-[12px] leading-5 text-slate-500 dark:text-slate-400 sm:text-[13px]">
                  {signup ? "أنشئ حسابك الآن وابدأ إدارة شبكتك بسهولة وأمان" : "مرحباً بك، يرجى تسجيل الدخول للوصول إلى لوحة التحكم"}
                </p>
              </div>

              <form onSubmit={submit} className={signup ? "mt-7" : "mt-9"}>
                {signup ? (
                  <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                    <CompactField label="الاسم الكامل *" icon={UserRound} value={fullName} onChange={setFullName} placeholder="أدخل اسمك الكامل" />
                    <CompactField label="البريد الإلكتروني *" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="أدخل بريدك الإلكتروني" />
                    <CountryPhoneInput className="sm:col-span-2" countries={arabCountries} country={country} onCountryChange={setCountry} phone={phone} onPhoneChange={setPhone} />
                    <CompactField label="كلمة المرور *" icon={LockKeyhole} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="أدخل كلمة المرور" suffix={eye(showPassword, () => setShowPassword((value) => !value))} />
                    <CompactField label="تأكيد كلمة المرور *" icon={LockKeyhole} type={showConfirm ? "text" : "password"} value={confirm} onChange={setConfirm} placeholder="أعد إدخال كلمة المرور" suffix={eye(showConfirm, () => setShowConfirm((value) => !value))} />

                    <label className="flex items-start gap-2 text-[10px] leading-5 text-slate-600 dark:text-slate-300 sm:col-span-2 sm:text-[11px]">
                      <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-1 h-4 w-4 accent-[#0d6ef0]" />
                      <span>أوافق على <button type="button" className="font-semibold text-[#0874f9]">الشروط والأحكام وسياسة الخصوصية</button></span>
                    </label>

                    {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-700 dark:border-amber-400/15 dark:bg-amber-500/10 dark:text-amber-300 sm:col-span-2">{message}</div>}

                    <div className="sm:col-span-2"><PrimaryFormButton>إنشاء الحساب <UserRound className="h-4 w-4" /></PrimaryFormButton></div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 sm:col-span-2"><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />أو<span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /></div>
                    <div className="sm:col-span-2"><SecondaryFormButton><span className="text-base font-black text-[#4285f4]">G</span> إنشاء حساب باستخدام Google</SecondaryFormButton></div>
                    <div className="text-center text-[11px] text-slate-500 dark:text-slate-400 sm:col-span-2">لديك حساب بالفعل؟ <Link href="/login" className="mr-2 font-bold text-[#0874f9]">تسجيل الدخول</Link></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <CompactField label="البريد الإلكتروني *" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="أدخل بريدك الإلكتروني" />
                    <CompactField label="كلمة المرور *" icon={LockKeyhole} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="أدخل كلمة المرور" suffix={eye(showPassword, () => setShowPassword((value) => !value))} />
                    <div className="flex items-center justify-between text-[11px]"><label className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 accent-[#0d6ef0]" />تذكرني</label><button type="button" className="font-semibold text-[#0874f9]">نسيت كلمة المرور؟</button></div>
                    {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-700 dark:border-amber-400/15 dark:bg-amber-500/10 dark:text-amber-300">{message}</div>}
                    <PrimaryFormButton>تسجيل الدخول <span>←</span></PrimaryFormButton>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />أو<span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /></div>
                    <SecondaryFormButton><span className="text-base font-black text-[#4285f4]">G</span> تسجيل الدخول باستخدام Google</SecondaryFormButton>
                    <div className="text-center text-[11px] text-slate-500 dark:text-slate-400">ليس لديك حساب؟ <Link href="/signup" className="mr-2 font-bold text-[#0874f9]">إنشاء حساب جديد</Link></div>
                  </div>
                )}
              </form>
            </div>
          </section>
        </div>
      </div>

      <style jsx global>{`
        @keyframes lordFloatA { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(18px,-12px,0)} }
        @keyframes lordFloatB { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(-20px,15px,0)} }
        @keyframes lordNetwork { 0%,100%{transform:translateX(0);opacity:.22} 50%{transform:translateX(7px);opacity:.30} }
        .auth-orb{position:absolute;border-radius:999px;filter:blur(90px);opacity:.14;will-change:transform}
        .auth-orb-a{width:300px;height:300px;background:#2687ff;left:-95px;top:8%;animation:lordFloatA 20s ease-in-out infinite}
        .auth-orb-b{width:250px;height:250px;background:#ffad16;right:-95px;bottom:4%;opacity:.07;animation:lordFloatB 24s ease-in-out infinite}
        .auth-network{animation:lordNetwork 26s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.auth-orb,.auth-network{animation:none!important}}
      `}</style>
    </main>
  );
}
