"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  Activity,
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

type ArabCountry = {
  name: string;
  code: string;
  flag: string;
};

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

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="text-center" dir="ltr">
      <div className={`relative mx-auto grid place-items-center ${compact ? "h-10 w-13" : "h-14 w-18"}`}>
        <svg viewBox="0 0 96 68" className={compact ? "h-10 w-[62px]" : "h-11 w-[68px]"} aria-hidden="true">
          <path d="M8 51 16 15l19 17L48 7l13 25 19-17 8 36Z" fill="#ffad16" />
          <circle cx="16" cy="12" r="5" fill="#0b3b82" />
          <circle cx="48" cy="5" r="5" fill="#0b3b82" />
          <circle cx="80" cy="12" r="5" fill="#0b3b82" />
        </svg>
        <Radio className="absolute bottom-0 h-6 w-6 text-[#0c63dc]" strokeWidth={2.4} />
      </div>
      <div className={`${compact ? "text-[25px]" : "text-[34px]"} mt-1 font-black leading-none tracking-tight text-[#0c3272] dark:text-white`}>LORD</div>
      <div className={`${compact ? "text-[10px]" : "text-[13px]"} mt-1 font-extrabold tracking-[.06em] text-[#f2a000]`}>RADIUS LORD</div>
    </div>
  );
}

function PageMotion() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="auth-orb auth-orb-a" />
      <div className="auth-orb auth-orb-b" />
      <div className="auth-orb auth-orb-c" />
      <svg viewBox="0 0 1600 900" className="auth-network absolute inset-0 h-full w-full opacity-30 dark:opacity-15">
        <g fill="none" stroke="#2f80ed" strokeWidth="1">
          <path d="M70 210 260 120l170 120 170-85 190 115 180-90 230 130" opacity=".16" />
          <path d="M20 640 220 520l170 90 170-120 220 120 185-90 250 115" opacity=".13" />
        </g>
      </svg>
    </div>
  );
}

function PanelNetwork() {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-18" aria-hidden="true">
      <svg viewBox="0 0 700 700" className="h-full w-full">
        <g stroke="#4d91ef" strokeOpacity=".17" fill="none" strokeWidth="1.1">
          <path d="M30 230 150 180l110 76 100-95 120 70 110-72 100 85" />
          <path d="M40 500 155 410l105 72 95-80 130 65 110-92 105 62" />
        </g>
      </svg>
    </div>
  );
}

function ServerIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative mx-auto w-full ${compact ? "h-[168px] max-w-[290px]" : "h-[230px] max-w-[340px]"}`} aria-hidden="true">
      <div className="absolute bottom-2 left-1/2 h-8 w-[76%] -translate-x-1/2 rounded-[50%] bg-[#2f6fc8]/13 blur-xl dark:bg-black/30" />
      <div className="absolute bottom-[12%] left-1/2 w-[54%] -translate-x-1/2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className={`${compact ? "mb-1 h-[29px]" : "mb-1.5 h-[37px]"} flex items-center rounded-[12px] border border-[#7da5d6]/30 bg-gradient-to-r from-[#dbe8f8] to-[#b8cee9] px-3.5 shadow-sm dark:border-[#486586]/40 dark:from-[#1b3556] dark:to-[#102845]`}>
            <span className={`h-2 w-2 rounded-full ${item === 1 ? "bg-[#ffad16]" : "bg-emerald-500"}`} />
            <span className="mr-2.5 h-1.5 flex-1 rounded-full bg-[#6d91bd]/50 dark:bg-[#58789c]/55" />
          </div>
        ))}
      </div>
      <div className={`absolute bottom-[9%] left-[12%] grid ${compact ? "h-[72px] w-[60px] border-[4px]" : "h-[92px] w-[76px] border-[5px]"} place-items-center rounded-[38%_38%_45%_45%/32%_32%_62%_62%] border-white bg-gradient-to-b from-[#187bff] to-[#063fbf] text-white shadow-lg dark:border-[#dce8f8]`}>
        <LockKeyhole className={compact ? "h-7 w-7" : "h-8 w-8"} />
      </div>
    </div>
  );
}

const radiusNotes = [
  [Server, "إدارة أجهزة NAS", "متابعة الأجهزة وحالتها من مكان واحد"],
  [UsersRound, "إدارة المشتركين", "جلسات وباقات ومعلومات المستخدمين"],
  [Activity, "مراقبة مستمرة", "حالة الشبكة والتنبيهات بشكل واضح"],
  [ShieldCheck, "أمان وصلاحيات", "تحكم منظم وآمن في الوصول"],
] as const;

function RadiusSummary() {
  return (
    <div className="mt-4 w-full max-w-[370px] rounded-[16px] border border-white/80 bg-white/55 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-white/[.07] dark:bg-[#0b2138]/50">
      <div className="mb-2 text-center text-[11px] font-bold text-[#16396e] dark:text-slate-200">RADIUS باختصار</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {radiusNotes.map(([Icon, title, text]) => (
          <div key={title} className="flex items-start gap-2" dir="rtl">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[#e6f0ff] text-[#0d6ef0] dark:bg-[#102d4d] dark:text-[#53a4ff]"><Icon className="h-3.5 w-3.5" /></span>
            <div className="min-w-0 text-right">
              <div className="text-[9px] font-bold text-[#17386d] dark:text-slate-100">{title}</div>
              <div className="mt-0.5 text-[8px] leading-4 text-slate-500 dark:text-slate-400">{text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualPanel({ signup }: { signup: boolean }) {
  return (
    <section className="relative hidden h-full overflow-hidden bg-gradient-to-br from-[#eef4fb] via-[#f8fbff] to-[#e7eef7] dark:from-[#07182a] dark:via-[#081d33] dark:to-[#061526] min-[980px]:block">
      <PanelNetwork />
      <div className="absolute right-0 top-[7%] h-[86%] w-[2px] bg-gradient-to-b from-transparent via-[#4c91eb]/55 to-transparent dark:via-[#47749c]/65" />
      <div className="absolute right-[-2px] top-[25%] h-[50%] w-[5px] rounded-full bg-gradient-to-b from-[#27c2e9]/0 via-[#27c2e9]/45 via-50% to-[#725cff]/0 blur-[2px]" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-7 py-5">
        <Brand />
        {signup && (
          <>
            <div className="mt-3 text-center">
              <h2 className="text-[18px] font-black text-[#0e316d] dark:text-white">منصة <span className="text-[#086ef1]">LORD</span> لإدارة RADIUS و NAS</h2>
              <p className="mx-auto mt-1 max-w-[390px] text-[9px] leading-4 text-slate-600 dark:text-slate-300">إدارة هادئة وواضحة للمشتركين والجلسات وأجهزة الشبكة ضمن واجهة واحدة.</p>
            </div>
            <RadiusSummary />
          </>
        )}
        <div className={`${signup ? "mt-2" : "mt-6"} w-full`}><ServerIllustration compact={signup} /></div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[10%] overflow-hidden" aria-hidden="true">
        <div className="absolute -bottom-[58%] -left-[8%] h-full w-[78%] rotate-6 rounded-[50%] bg-[#0b4bc6]" />
        <div className="absolute -bottom-[62%] left-[8%] h-full w-[84%] -rotate-3 rounded-[50%] bg-[#07379e]" />
        <div className="absolute -bottom-[60%] left-[2%] h-[70%] w-[46%] rotate-12 rounded-[50%] bg-[#ffad16]" />
      </div>
    </section>
  );
}

function Field({ label, icon: Icon, type = "text", value, onChange, placeholder, suffix }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-[#17386d] dark:text-slate-200">{label}</span>
      <div className="relative">
        <Icon className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-[40px] w-full rounded-[10px] border border-[#cbd9e8] bg-white pr-10 pl-10 text-[12px] text-[#17386d] outline-none transition placeholder:text-slate-400 focus:border-[#3d8df4] focus:ring-2 focus:ring-[#147bff]/10 dark:border-[#304861] dark:bg-[#091c30] dark:text-white" />
        {suffix}
      </div>
    </label>
  );
}

function Steps() {
  return (
    <div className="mx-auto mt-2.5 grid max-w-[380px] grid-cols-3 gap-2">
      {["المعلومات الأساسية", "معلومات إضافية", "تأكيد الحساب"].map((label, index) => (
        <div key={label} className="relative text-center">
          {index < 2 && <span className="absolute left-[-50%] top-3 h-px w-full bg-gradient-to-r from-[#c7d8ec] via-[#79aef1] to-[#c7d8ec] dark:from-[#334d68] dark:via-[#4c82b8] dark:to-[#334d68]" />}
          <div className={`relative z-10 mx-auto grid h-6 w-6 place-items-center rounded-full border text-[10px] font-bold ${index === 0 ? "border-[#0d6ef0] bg-[#0d6ef0] text-white shadow-[0_0_0_3px_rgba(13,110,240,.08)]" : "border-[#bccde0] bg-white text-slate-500 dark:border-[#425870] dark:bg-[#0b2036]"}`}>{index + 1}</div>
          <div className={`mt-1 text-[8px] ${index === 0 ? "font-semibold text-[#0d6ef0]" : "text-slate-500 dark:text-slate-400"}`}>{label}</div>
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
  const [countryCode, setCountryCode] = useState("+964");
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
      return setMessage(`واجهة إنشاء الحساب جاهزة للربط بخدمة التسجيل الخلفية. رقم الهاتف: ${countryCode}${phone}`);
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

  const selectedCountry = arabCountries.find((country) => country.code === countryCode) ?? arabCountries[0];

  return (
    <main dir="rtl" className="relative min-h-[100dvh] overflow-hidden bg-[#e8eef5] text-[#102a63] dark:bg-[#061526] dark:text-slate-100" style={{ fontFamily: "LBC, Tahoma, Arial, sans-serif" }}>
      <PageMotion />
      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-3 sm:p-4">
        <div dir="ltr" className={`grid w-full max-w-[1020px] overflow-hidden rounded-[22px] border border-white/80 bg-[#f8fbff]/96 shadow-[0_20px_65px_rgba(58,84,112,.18)] backdrop-blur-sm dark:border-white/[.08] dark:bg-[#081b2f]/96 min-[980px]:grid-cols-2 ${signup ? "min-[980px]:h-[640px]" : "min-[980px]:h-[610px]"}`}>
          <VisualPanel signup={signup} />
          <section dir="rtl" className="flex min-h-[calc(100dvh-24px)] items-center justify-center bg-white/95 px-5 py-5 dark:bg-[#0a1f35]/96 sm:px-7 min-[980px]:min-h-0">
            <div className={`w-full ${signup ? "max-w-[410px]" : "max-w-[410px]"}`}>
              <div className="mb-4 min-[980px]:hidden"><Brand compact /></div>
              <div className="text-center">
                <div className={`mx-auto grid ${signup ? "h-9 w-9" : "h-11 w-11"} place-items-center rounded-full bg-[#eaf2ff] text-[#086df0] dark:bg-[#102d4d] dark:text-[#4da0ff]`}>{signup ? <UserRound className="h-4 w-4" /> : <LockKeyhole className="h-5 w-5" />}</div>
                <h1 className={`${signup ? "mt-1.5 text-[21px]" : "mt-2.5 text-[25px]"} font-black`}>{signup ? "إنشاء حساب جديد" : "تسجيل الدخول"}</h1>
                <p className={`mx-auto ${signup ? "mt-0.5" : "mt-1"} text-[10px] leading-4 text-slate-500 dark:text-slate-400`}>{signup ? "أنشئ حسابك وابدأ إدارة الشبكة بسهولة وأمان" : "مرحباً بك، يرجى تسجيل الدخول للوصول إلى لوحة التحكم"}</p>
              </div>
              {signup && <Steps />}
              <form onSubmit={submit} className={signup ? "mt-2.5 space-y-1.5" : "mt-7 space-y-3.5"}>
                {signup && <Field label="الاسم الكامل *" icon={UserRound} value={fullName} onChange={setFullName} placeholder="أدخل اسمك الكامل" />}
                <Field label="البريد الإلكتروني *" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="أدخل بريدك الإلكتروني" />
                {signup && (
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-[#17386d] dark:text-slate-200">رقم الهاتف *</span>
                    <div className="flex h-[40px] overflow-hidden rounded-[10px] border border-[#cbd9e8] bg-white transition focus-within:border-[#3d8df4] focus-within:ring-2 focus-within:ring-[#147bff]/10 dark:border-[#304861] dark:bg-[#091c30]" dir="ltr">
                      <div className="relative w-[128px] shrink-0 border-r border-[#cbd9e8] dark:border-[#304861]">
                        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-center gap-1.5 px-2 text-[10px] text-[#17386d] dark:text-slate-200">
                          <span>{selectedCountry.flag}</span><span>{selectedCountry.code}</span><span className="text-[8px] text-slate-400">⌄</span>
                        </div>
                        <select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} aria-label="رمز نداء الدولة" className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
                          {arabCountries.map((country) => <option key={`${country.name}-${country.code}`} value={country.code}>{country.flag} {country.name} {country.code}</option>)}
                        </select>
                      </div>
                      <div className="relative flex-1" dir="rtl">
                        <Phone className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="أدخل رقم الهاتف" className="h-full w-full bg-transparent pr-10 pl-3 text-[12px] text-[#17386d] outline-none placeholder:text-slate-400 dark:text-white" />
                      </div>
                    </div>
                  </label>
                )}
                <Field label="كلمة المرور *" icon={LockKeyhole} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="أدخل كلمة المرور" suffix={eye(showPassword, () => setShowPassword((value) => !value))} />
                {signup && <Field label="تأكيد كلمة المرور *" icon={LockKeyhole} type={showConfirm ? "text" : "password"} value={confirm} onChange={setConfirm} placeholder="أعد إدخال كلمة المرور" suffix={eye(showConfirm, () => setShowConfirm((value) => !value))} />}
                {!signup && <div className="flex items-center justify-between text-[11px]"><label className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 accent-[#0d6ef0]" />تذكرني</label><button type="button" className="font-semibold text-[#0874f9]">نسيت كلمة المرور؟</button></div>}
                {signup && <label className="flex items-center gap-2 text-[8px] leading-4 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="h-3.5 w-3.5 accent-[#0d6ef0]" /><span>أوافق على <button type="button" className="font-semibold text-[#0874f9]">الشروط والأحكام وسياسة الخصوصية</button></span></label>}
                {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[9px] text-amber-700 dark:border-amber-400/15 dark:bg-amber-500/10 dark:text-amber-300">{message}</div>}
                <button type="submit" className="flex h-[40px] w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-l from-[#0d6ef0] to-[#0647d9] text-[11px] font-bold text-white shadow-sm transition hover:brightness-105">{signup ? "إنشاء الحساب" : "تسجيل الدخول"}<span>←</span></button>
                <div className="flex items-center gap-3 text-[9px] text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />أو<span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /></div>
                <button type="button" className="flex h-[40px] w-full items-center justify-center gap-3 rounded-[10px] border border-[#cbd9e8] bg-white text-[10px] font-bold text-[#17386d] dark:border-[#304861] dark:bg-[#091c30] dark:text-white"><span className="text-sm font-black text-[#4285f4]">G</span>{signup ? "إنشاء حساب باستخدام Google" : "تسجيل الدخول باستخدام Google"}</button>
                <div className="text-center text-[10px] text-slate-500 dark:text-slate-400">{signup ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"}<Link href={signup ? "/login" : "/signup"} className="mr-2 font-bold text-[#0874f9]">{signup ? "تسجيل الدخول" : "إنشاء حساب جديد"}</Link></div>
              </form>
            </div>
          </section>
        </div>
      </div>
      <style jsx global>{`
        @keyframes lordFloatA { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(24px,-18px,0)} }
        @keyframes lordFloatB { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(-28px,22px,0)} }
        @keyframes lordNetwork { 0%,100%{transform:translateX(0);opacity:.28} 50%{transform:translateX(10px);opacity:.38} }
        .auth-orb{position:absolute;border-radius:999px;filter:blur(72px);opacity:.18;will-change:transform}
        .auth-orb-a{width:270px;height:270px;background:#2687ff;left:-75px;top:8%;animation:lordFloatA 14s ease-in-out infinite}
        .auth-orb-b{width:230px;height:230px;background:#ffad16;right:-85px;bottom:4%;opacity:.08;animation:lordFloatB 17s ease-in-out infinite}
        .auth-orb-c{width:190px;height:190px;background:#7c5cff;left:58%;top:-90px;opacity:.08;animation:lordFloatB 20s ease-in-out infinite reverse}
        .auth-network{animation:lordNetwork 18s ease-in-out infinite}
        @media (max-height: 700px) and (min-width: 980px){
          main .auth-orb{opacity:.12}
        }
        @media (prefers-reduced-motion: reduce){.auth-orb,.auth-network{animation:none!important}}
      `}</style>
    </main>
  );
}
