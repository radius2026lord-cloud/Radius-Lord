"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  Activity,
  ChevronDown,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  Radio,
  Server,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  CompactField,
  PrimaryFormButton,
  SecondaryFormButton,
} from "@/components/ui/auth-form-controls";

type Mode = "login" | "signup";
type ArabCountry = { name: string; code: string; flag: string };

const arabCountries: ArabCountry[] = [
  { name: "العراق", code: "+964", flag: "🇮🇶" },
  { name: "السعودية", code: "+966", flag: "🇸🇦" },
  { name: "سوريا", code: "+963", flag: "🇸🇾" },
  { name: "الأردن", code: "+962", flag: "🇯🇴" },
  { name: "لبنان", code: "+961", flag: "🇱🇧" },
  { name: "فلسطين", code: "+970", flag: "🇵🇸" },
  { name: "الإمارات", code: "+971", flag: "🇦🇪" },
  { name: "قطر", code: "+974", flag: "🇶🇦" },
  { name: "الكويت", code: "+965", flag: "🇰🇼" },
  { name: "البحرين", code: "+973", flag: "🇧🇭" },
  { name: "عُمان", code: "+968", flag: "🇴🇲" },
  { name: "اليمن", code: "+967", flag: "🇾🇪" },
  { name: "مصر", code: "+20", flag: "🇪🇬" },
  { name: "ليبيا", code: "+218", flag: "🇱🇾" },
  { name: "تونس", code: "+216", flag: "🇹🇳" },
  { name: "الجزائر", code: "+213", flag: "🇩🇿" },
  { name: "المغرب", code: "+212", flag: "🇲🇦" },
  { name: "موريتانيا", code: "+222", flag: "🇲🇷" },
  { name: "السودان", code: "+249", flag: "🇸🇩" },
  { name: "الصومال", code: "+252", flag: "🇸🇴" },
  { name: "جيبوتي", code: "+253", flag: "🇩🇯" },
  { name: "جزر القمر", code: "+269", flag: "🇰🇲" },
];

const radiusNotes = [
  [Server, "NAS", "إدارة ومتابعة الأجهزة"],
  [UsersRound, "المشتركون", "جلسات وباقات ومستخدمون"],
  [Activity, "المراقبة", "حالة الشبكة والتنبيهات"],
  [ShieldCheck, "الأمان", "صلاحيات وتحكم آمن"],
] as const;

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
      <svg viewBox="0 0 1600 900" className="auth-network absolute inset-0 h-full w-full opacity-25 dark:opacity-15">
        <g fill="none" stroke="#2f80ed" strokeWidth="1">
          <path d="M70 210 260 120l170 120 170-85 190 115 180-90 230 130" opacity=".14" />
          <path d="M20 640 220 520l170 90 170-120 220 120 185-90 250 115" opacity=".11" />
        </g>
      </svg>
    </div>
  );
}

function ServerIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative mx-auto w-full ${compact ? "h-[130px] max-w-[245px]" : "h-[220px] max-w-[330px]"}`} aria-hidden="true">
      <div className="absolute bottom-2 left-1/2 h-7 w-[72%] -translate-x-1/2 rounded-[50%] bg-[#2f6fc8]/12 blur-xl" />
      <div className="absolute bottom-[14%] left-1/2 w-[54%] -translate-x-1/2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className={`${compact ? "mb-1 h-[23px]" : "mb-1.5 h-[35px]"} flex items-center rounded-[10px] border border-[#7da5d6]/28 bg-gradient-to-r from-[#dbe8f8] to-[#b8cee9] px-3 dark:border-[#486586]/40 dark:from-[#1b3556] dark:to-[#102845]`}>
            <span className={`h-2 w-2 rounded-full ${item === 1 ? "bg-[#ffad16]" : "bg-emerald-500"}`} />
            <span className="mr-2 h-1.5 flex-1 rounded-full bg-[#6d91bd]/45 dark:bg-[#58789c]/50" />
          </div>
        ))}
      </div>
      <div className={`absolute bottom-[10%] left-[12%] grid ${compact ? "h-[58px] w-[48px] border-[4px]" : "h-[88px] w-[72px] border-[5px]"} place-items-center rounded-[38%_38%_45%_45%/32%_32%_62%_62%] border-white bg-gradient-to-b from-[#187bff] to-[#063fbf] text-white shadow-lg dark:border-[#dce8f8]`}>
        <LockKeyhole className={compact ? "h-6 w-6" : "h-8 w-8"} />
      </div>
    </div>
  );
}

function RadiusSummary() {
  return (
    <div className="mt-3 w-full max-w-[360px] rounded-[18px] border border-white/85 bg-gradient-to-br from-white/82 via-white/68 to-[#eaf3ff]/78 p-3 shadow-[0_14px_35px_rgba(50,84,124,.10)] backdrop-blur-md dark:border-white/[.07] dark:from-[#102942]/78 dark:via-[#0d2339]/70 dark:to-[#0b1d31]/76">
      <div className="mb-2 text-center text-[10px] font-bold text-[#17386d] dark:text-slate-100">RADIUS باختصار</div>
      <div className="grid grid-cols-2 gap-2">
        {radiusNotes.map(([Icon, title, text]) => (
          <div key={title} className="flex items-center gap-2 rounded-[10px] bg-white/60 px-2 py-2 dark:bg-white/[.035]" dir="rtl">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[#e5f0ff] text-[#0d6ef0] dark:bg-[#12304f] dark:text-[#56a7ff]"><Icon className="h-3.5 w-3.5" /></span>
            <div className="min-w-0 text-right">
              <div className="text-[9px] font-bold text-[#17386d] dark:text-white">{title}</div>
              <div className="mt-0.5 text-[8px] leading-3.5 text-slate-500 dark:text-slate-400">{text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualPanel({ signup }: { signup: boolean }) {
  return (
    <section className="relative hidden h-full overflow-hidden bg-gradient-to-br from-[#edf4fc] via-[#f7fbff] to-[#e8f0f8] dark:from-[#07182a] dark:via-[#081d33] dark:to-[#061526] min-[980px]:block">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_28%,rgba(48,137,255,.10),transparent_22%),radial-gradient(circle_at_70%_72%,rgba(255,173,22,.08),transparent_20%)]" />
      <div className="absolute right-0 top-[9%] h-[82%] w-[2px] bg-gradient-to-b from-transparent via-[#62a3ed]/48 to-transparent" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-7 py-5">
        <Brand />
        {signup && (
          <>
            <div className="mt-2.5 text-center">
              <h2 className="text-[16px] font-black text-[#0e316d] dark:text-white">إدارة RADIUS و NAS بهدوء ووضوح</h2>
              <p className="mx-auto mt-1 max-w-[360px] text-[9px] leading-4 text-slate-600 dark:text-slate-300">المشتركون والجلسات والأجهزة والتنبيهات ضمن مكان واحد.</p>
            </div>
            <RadiusSummary />
          </>
        )}
        <div className={`${signup ? "mt-1" : "mt-6"} w-full`}><ServerIllustration compact={signup} /></div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[10%] overflow-hidden" aria-hidden="true">
        <div className="absolute -bottom-[58%] -left-[8%] h-full w-[78%] rotate-6 rounded-[50%] bg-[#0b4bc6]" />
        <div className="absolute -bottom-[62%] left-[8%] h-full w-[84%] -rotate-3 rounded-[50%] bg-[#07379e]" />
        <div className="absolute -bottom-[60%] left-[2%] h-[70%] w-[46%] rotate-12 rounded-[50%] bg-[#ffad16]" />
      </div>
    </section>
  );
}

function CountryPhone({ country, setCountry, phone, setPhone }: { country: ArabCountry; setCountry: (country: ArabCountry) => void; phone: string; setPhone: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold text-[#17386d] dark:text-slate-200">رقم الهاتف *</span>
      <div className="flex h-[36px] overflow-visible rounded-[9px] border border-[#ccd9e7] bg-white dark:border-[#304861] dark:bg-[#091c30]" dir="ltr">
        <div className="relative w-[118px] shrink-0 border-r border-[#ccd9e7] dark:border-[#304861]">
          <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-full w-full items-center justify-center gap-1.5 px-2 text-[10px] text-[#17386d] dark:text-white">
            <span>{country.flag}</span><span>{country.code}</span><ChevronDown className="h-3 w-3" />
          </button>
          {open && (
            <div className="absolute left-0 top-[40px] z-30 max-h-52 w-48 overflow-auto rounded-[10px] border border-[#ccd9e7] bg-white p-1.5 shadow-xl dark:border-[#304861] dark:bg-[#0b2138]" dir="rtl">
              {arabCountries.map((item) => (
                <button key={item.name} type="button" onClick={() => { setCountry(item); setOpen(false); }} className="flex w-full items-center justify-between rounded-[7px] px-2 py-1.5 text-[10px] hover:bg-[#edf5ff] dark:hover:bg-white/[.05]">
                  <span>{item.flag} {item.name}</span><span dir="ltr">{item.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative flex-1" dir="rtl">
          <Phone className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="أدخل رقم الهاتف" className="h-full w-full bg-transparent pr-9 pl-3 text-[11px] outline-none placeholder:text-slate-400 dark:text-white" />
        </div>
      </div>
    </label>
  );
}

export default function LordAuth({ mode }: { mode: Mode }) {
  const signup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<ArabCountry>(arabCountries[0]);
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
    <button type="button" onClick={toggle} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>
      {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
    </button>
  );

  return (
    <main dir="rtl" className="relative min-h-[100dvh] overflow-hidden bg-[#e8eef5] text-[#102a63] dark:bg-[#061526] dark:text-slate-100" style={{ fontFamily: "LBC, Tahoma, Arial, sans-serif" }}>
      <PageMotion />
      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-3 sm:p-4">
        <div dir="ltr" className={`grid w-full max-w-[980px] overflow-hidden rounded-[22px] border border-white/80 bg-[#f8fbff]/96 shadow-[0_18px_55px_rgba(58,84,112,.16)] backdrop-blur-sm dark:border-white/[.08] dark:bg-[#081b2f]/96 min-[980px]:grid-cols-[1.08fr_.92fr] ${signup ? "min-[980px]:h-[585px]" : "min-[980px]:h-[610px]"}`}>
          <VisualPanel signup={signup} />
          <section dir="rtl" className="flex min-h-[calc(100dvh-24px)] items-center justify-center bg-white/95 px-5 py-5 dark:bg-[#0a1f35]/96 sm:px-7 min-[980px]:min-h-0">
            <div className={`w-full ${signup ? "max-w-[365px]" : "max-w-[410px]"}`}>
              <div className="mb-4 min-[980px]:hidden"><Brand compact /></div>
              <div className="text-center">
                <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-[#eaf2ff] text-[#086df0] dark:bg-[#102d4d] dark:text-[#4da0ff]">{signup ? <UserRound className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}</div>
                <h1 className="mt-2 text-[22px] font-black">{signup ? "إنشاء حساب جديد" : "تسجيل الدخول"}</h1>
                <p className="mx-auto mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{signup ? "أنشئ حسابك وابدأ إدارة الشبكة بسهولة وأمان" : "مرحباً بك، يرجى تسجيل الدخول للوصول إلى لوحة التحكم"}</p>
              </div>

              <form onSubmit={submit} className={signup ? "mt-3 space-y-1.5" : "mt-7 space-y-3.5"}>
                {signup && <CompactField label="الاسم الكامل *" icon={UserRound} value={fullName} onChange={setFullName} placeholder="أدخل اسمك الكامل" />}
                <CompactField label="البريد الإلكتروني *" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="أدخل بريدك الإلكتروني" />
                {signup && <CountryPhone country={country} setCountry={setCountry} phone={phone} setPhone={setPhone} />}
                <CompactField label="كلمة المرور *" icon={LockKeyhole} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="أدخل كلمة المرور" suffix={eye(showPassword, () => setShowPassword((value) => !value))} />
                {signup && <CompactField label="تأكيد كلمة المرور *" icon={LockKeyhole} type={showConfirm ? "text" : "password"} value={confirm} onChange={setConfirm} placeholder="أعد إدخال كلمة المرور" suffix={eye(showConfirm, () => setShowConfirm((value) => !value))} />}

                {!signup && <div className="flex items-center justify-between text-[10px]"><label className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-3.5 w-3.5 accent-[#0d6ef0]" />تذكرني</label><button type="button" className="font-semibold text-[#0874f9]">نسيت كلمة المرور؟</button></div>}
                {signup && <label className="flex items-start gap-2 text-[8px] leading-4 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-[#0d6ef0]" /><span>أوافق على <button type="button" className="font-semibold text-[#0874f9]">الشروط والأحكام وسياسة الخصوصية</button></span></label>}

                {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[9px] text-amber-700 dark:border-amber-400/15 dark:bg-amber-500/10 dark:text-amber-300">{message}</div>}

                <PrimaryFormButton>{signup ? "إنشاء الحساب" : "تسجيل الدخول"}<span>←</span></PrimaryFormButton>
                <div className="flex items-center gap-3 text-[9px] text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />أو<span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /></div>
                <SecondaryFormButton><span className="text-sm font-black text-[#4285f4]">G</span>{signup ? "إنشاء حساب باستخدام Google" : "تسجيل الدخول باستخدام Google"}</SecondaryFormButton>
                <div className="text-center text-[10px] text-slate-500 dark:text-slate-400">{signup ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"}<Link href={signup ? "/login" : "/signup"} className="mr-2 font-bold text-[#0874f9]">{signup ? "تسجيل الدخول" : "إنشاء حساب جديد"}</Link></div>
              </form>
            </div>
          </section>
        </div>
      </div>

      <style jsx global>{`
        @keyframes lordFloatA { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(20px,-14px,0)} }
        @keyframes lordFloatB { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(-24px,18px,0)} }
        @keyframes lordNetwork { 0%,100%{transform:translateX(0);opacity:.24} 50%{transform:translateX(8px);opacity:.34} }
        .auth-orb{position:absolute;border-radius:999px;filter:blur(80px);opacity:.16;will-change:transform}
        .auth-orb-a{width:260px;height:260px;background:#2687ff;left:-80px;top:8%;animation:lordFloatA 18s ease-in-out infinite}
        .auth-orb-b{width:220px;height:220px;background:#ffad16;right:-85px;bottom:5%;opacity:.08;animation:lordFloatB 22s ease-in-out infinite}
        .auth-network{animation:lordNetwork 24s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.auth-orb,.auth-network{animation:none!important}}
      `}</style>
    </main>
  );
}
