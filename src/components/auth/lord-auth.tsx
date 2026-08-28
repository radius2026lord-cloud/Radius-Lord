"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Radio,
  UserRound,
} from "lucide-react";
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
import { Mail } from "lucide-react";

type Mode = "login" | "signup";

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="text-center" dir="ltr">
      <div className={`relative mx-auto grid place-items-center ${compact ? "h-9 w-12" : "h-13 w-17"}`}>
        <svg viewBox="0 0 96 68" className={compact ? "h-9 w-[58px]" : "h-10 w-[64px]"} aria-hidden="true">
          <path d="M8 51 16 15l19 17L48 7l13 25 19-17 8 36Z" fill="#ffad16" />
          <circle cx="16" cy="12" r="5" fill="#0b3b82" />
          <circle cx="48" cy="5" r="5" fill="#0b3b82" />
          <circle cx="80" cy="12" r="5" fill="#0b3b82" />
        </svg>
        <Radio className="absolute bottom-0 h-5.5 w-5.5 text-[#0c63dc]" strokeWidth={2.4} />
      </div>
      <div className={`${compact ? "text-[23px]" : "text-[31px]"} mt-1 font-black leading-none tracking-tight text-[#0c3272] dark:text-white`}>LORD</div>
      <div className={`${compact ? "text-[9px]" : "text-[12px]"} mt-1 font-extrabold tracking-[.06em] text-[#f2a000]`}>RADIUS LORD</div>
    </div>
  );
}

function PageMotion() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="auth-orb auth-orb-a" />
      <div className="auth-orb auth-orb-b" />
      <svg viewBox="0 0 1600 900" className="auth-network absolute inset-0 h-full w-full opacity-20 dark:opacity-10">
        <g fill="none" stroke="#2f80ed" strokeWidth="1">
          <path d="M70 210 260 120l170 120 170-85 190 115 180-90 230 130" opacity=".12" />
          <path d="M20 640 220 520l170 90 170-120 220 120 185-90 250 115" opacity=".09" />
        </g>
      </svg>
    </div>
  );
}

function ServerIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative mx-auto w-full ${compact ? "h-[112px] max-w-[220px]" : "h-[210px] max-w-[320px]"}`} aria-hidden="true">
      <div className="absolute bottom-2 left-1/2 h-7 w-[72%] -translate-x-1/2 rounded-[50%] bg-[#2f6fc8]/12 blur-xl" />
      <div className="absolute bottom-[14%] left-1/2 w-[54%] -translate-x-1/2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className={`${compact ? "mb-1 h-[20px]" : "mb-1.5 h-[33px]"} flex items-center rounded-[10px] border border-[#7da5d6]/28 bg-gradient-to-r from-[#dbe8f8] to-[#b8cee9] px-3 dark:border-[#486586]/40 dark:from-[#1b3556] dark:to-[#102845]`}>
            <span className={`h-2 w-2 rounded-full ${item === 1 ? "bg-[#ffad16]" : "bg-emerald-500"}`} />
            <span className="mr-2 h-1.5 flex-1 rounded-full bg-[#6d91bd]/45 dark:bg-[#58789c]/50" />
          </div>
        ))}
      </div>
      <div className={`absolute bottom-[10%] left-[12%] grid ${compact ? "h-[52px] w-[44px] border-[4px]" : "h-[84px] w-[70px] border-[5px]"} place-items-center rounded-[38%_38%_45%_45%/32%_32%_62%_62%] border-white bg-gradient-to-b from-[#187bff] to-[#063fbf] text-white shadow-lg dark:border-[#dce8f8]`}>
        <LockKeyhole className={compact ? "h-5.5 w-5.5" : "h-8 w-8"} />
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
    <div className="mt-4 w-full max-w-[390px] rounded-[18px] border border-white/85 bg-white/72 p-4 shadow-[0_14px_34px_rgba(50,84,124,.09)] backdrop-blur-sm dark:border-white/[.07] dark:bg-[#0d243b]/68">
      <div className="mb-3 text-center text-[12px] font-black text-[#17386d] dark:text-slate-100">
        {radiusAuthContent.summaryTitle}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {radiusAuthContent.features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div key={feature.title} className="flex min-h-[62px] items-start gap-2.5 rounded-[12px] bg-white/70 p-2.5 dark:bg-white/[.035]" dir="rtl">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${featureToneClasses[feature.tone]}`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 text-right">
                <div className="text-[10px] font-black text-[#17386d] dark:text-white">{feature.title}</div>
                <div className="mt-1 text-[8.5px] leading-4 text-slate-500 dark:text-slate-400">{feature.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VisualPanel({ signup }: { signup: boolean }) {
  return (
    <section className="relative hidden h-full overflow-hidden bg-gradient-to-br from-[#edf4fc] via-[#f7fbff] to-[#e8f0f8] dark:from-[#07182a] dark:via-[#081d33] dark:to-[#061526] min-[980px]:block">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_28%,rgba(48,137,255,.10),transparent_22%),radial-gradient(circle_at_70%_72%,rgba(255,173,22,.08),transparent_20%)]" />
      <div className="absolute right-0 top-[8%] h-[84%] w-px bg-gradient-to-b from-transparent via-[#87afe1]/45 to-transparent dark:via-[#45627f]/55" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-7 py-5">
        <Brand />
        {signup && (
          <>
            <div className="mt-3 text-center">
              <h2 className="text-[18px] font-black text-[#0e316d] dark:text-white">
                {radiusAuthContent.title}
              </h2>
              <p className="mx-auto mt-2 max-w-[400px] text-[10px] leading-5 text-slate-600 dark:text-slate-300">
                {radiusAuthContent.description}
              </p>
            </div>
            <RadiusSummary />
          </>
        )}
        <div className={`${signup ? "mt-1" : "mt-6"} w-full`}>
          <ServerIllustration compact={signup} />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 h-[12%] w-full overflow-hidden" aria-hidden="true">
        <div className="absolute -bottom-[58%] -left-[8%] h-full w-[82%] rotate-6 rounded-[50%] bg-[#0b4bc6] opacity-95" />
        <div className="absolute -bottom-[62%] left-[7%] h-full w-[86%] -rotate-3 rounded-[50%] bg-[#07379e] opacity-90" />
        <div className="absolute -bottom-[60%] left-[2%] h-[70%] w-[45%] rotate-12 rounded-[50%] bg-[#ffad16] opacity-95" />
        <div className="absolute inset-y-0 right-0 w-[28%] bg-gradient-to-r from-transparent via-[#edf4fc]/55 to-[#edf4fc] dark:via-[#07182a]/55 dark:to-[#07182a]" />
      </div>
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
      if (!fullName || !email || !phone || !password || !confirm) {
        return setMessage("يرجى تعبئة جميع الحقول المطلوبة.");
      }
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
    <button
      type="button"
      onClick={toggle}
      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
    >
      {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
    </button>
  );

  return (
    <main
      dir="rtl"
      className="relative min-h-[100dvh] overflow-x-hidden bg-[#e8eef5] text-[#102a63] dark:bg-[#061526] dark:text-slate-100"
      style={{ fontFamily: "LBC, Tahoma, Arial, sans-serif" }}
    >
      <PageMotion />
      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-3 sm:p-4">
        <div
          dir="ltr"
          className={`grid w-full max-w-[1080px] overflow-hidden rounded-[24px] border border-white/80 bg-[#f8fbff]/96 shadow-[0_18px_55px_rgba(58,84,112,.16)] backdrop-blur-sm dark:border-white/[.08] dark:bg-[#081b2f]/96 min-[980px]:grid-cols-[1.05fr_.95fr] ${signup ? "min-[980px]:h-[620px]" : "min-[980px]:h-[600px]"}`}
        >
          <VisualPanel signup={signup} />

          <section dir="rtl" className="flex min-h-[calc(100dvh-24px)] items-center justify-center bg-white/95 px-5 py-5 dark:bg-[#0a1f35]/96 sm:px-7 min-[980px]:min-h-0">
            <div className={`w-full ${signup ? "max-w-[390px]" : "max-w-[410px]"}`}>
              <div className="mb-4 min-[980px]:hidden">
                <Brand compact />
              </div>

              <div className="text-center">
                <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-[#eaf2ff] text-[#086df0] dark:bg-[#102d4d] dark:text-[#4da0ff]">
                  {signup ? <UserRound className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                </div>
                <h1 className="mt-2 text-[22px] font-black">{signup ? "إنشاء حساب جديد" : "تسجيل الدخول"}</h1>
                <p className="mx-auto mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
                  {signup ? "أنشئ حسابك الآن وابدأ إدارة شبكتك بسهولة وأمان" : "مرحباً بك، يرجى تسجيل الدخول للوصول إلى لوحة التحكم"}
                </p>
              </div>

              <form onSubmit={submit} className={signup ? "mt-4 space-y-2" : "mt-7 space-y-3.5"}>
                {signup && (
                  <CompactField
                    label="الاسم الكامل *"
                    icon={UserRound}
                    value={fullName}
                    onChange={setFullName}
                    placeholder="أدخل اسمك الكامل"
                  />
                )}

                <CompactField
                  label="البريد الإلكتروني *"
                  icon={Mail}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="أدخل بريدك الإلكتروني"
                />

                {signup && (
                  <CountryPhoneInput
                    countries={arabCountries}
                    country={country}
                    onCountryChange={setCountry}
                    phone={phone}
                    onPhoneChange={setPhone}
                  />
                )}

                <CompactField
                  label="كلمة المرور *"
                  icon={LockKeyhole}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  placeholder="أدخل كلمة المرور"
                  suffix={eye(showPassword, () => setShowPassword((value) => !value))}
                />

                {signup && (
                  <CompactField
                    label="تأكيد كلمة المرور *"
                    icon={LockKeyhole}
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={setConfirm}
                    placeholder="أعد إدخال كلمة المرور"
                    suffix={eye(showConfirm, () => setShowConfirm((value) => !value))}
                  />
                )}

                {!signup && (
                  <div className="flex items-center justify-between text-[10px]">
                    <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-3.5 w-3.5 accent-[#0d6ef0]" />
                      تذكرني
                    </label>
                    <button type="button" className="font-semibold text-[#0874f9]">نسيت كلمة المرور؟</button>
                  </div>
                )}

                {signup && (
                  <label className="flex items-start gap-2 text-[8.5px] leading-4 text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-[#0d6ef0]" />
                    <span>
                      أوافق على <button type="button" className="font-semibold text-[#0874f9]">الشروط والأحكام وسياسة الخصوصية</button>
                    </span>
                  </label>
                )}

                {message && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[9px] text-amber-700 dark:border-amber-400/15 dark:bg-amber-500/10 dark:text-amber-300">
                    {message}
                  </div>
                )}

                <PrimaryFormButton>
                  {signup ? "إنشاء الحساب" : "تسجيل الدخول"}<span>←</span>
                </PrimaryFormButton>

                <div className="flex items-center gap-3 text-[9px] text-slate-400">
                  <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                  أو
                  <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                </div>

                <SecondaryFormButton>
                  <span className="text-sm font-black text-[#4285f4]">G</span>
                  {signup ? "إنشاء حساب باستخدام Google" : "تسجيل الدخول باستخدام Google"}
                </SecondaryFormButton>

                <div className="text-center text-[10px] text-slate-500 dark:text-slate-400">
                  {signup ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"}
                  <Link href={signup ? "/login" : "/signup"} className="mr-2 font-bold text-[#0874f9]">
                    {signup ? "تسجيل الدخول" : "إنشاء حساب جديد"}
                  </Link>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>

      <style jsx global>{`
        @keyframes lordFloatA { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(16px,-12px,0)} }
        @keyframes lordFloatB { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(-18px,14px,0)} }
        @keyframes lordNetwork { 0%,100%{transform:translateX(0);opacity:.18} 50%{transform:translateX(6px);opacity:.24} }
        .auth-orb{position:absolute;border-radius:999px;filter:blur(80px);opacity:.13;will-change:transform}
        .auth-orb-a{width:260px;height:260px;background:#2687ff;left:-80px;top:8%;animation:lordFloatA 20s ease-in-out infinite}
        .auth-orb-b{width:220px;height:220px;background:#ffad16;right:-85px;bottom:5%;opacity:.06;animation:lordFloatB 24s ease-in-out infinite}
        .auth-network{animation:lordNetwork 26s ease-in-out infinite}
        @media (max-width: 979px){
          .auth-orb-a{width:190px;height:190px}
          .auth-orb-b{width:160px;height:160px}
        }
        @media (prefers-reduced-motion: reduce){.auth-orb,.auth-network{animation:none!important}}
      `}</style>
    </main>
  );
}
