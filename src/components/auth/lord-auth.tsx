"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Activity,
  Crown,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Moon,
  Radio,
  Server,
  ShieldCheck,
  Sun,
  UserRound,
  Users,
} from "lucide-react";
import { CompactField, PrimaryFormButton, SecondaryFormButton } from "@/components/ui/auth-form-controls";
import { CountryPhoneInput } from "@/components/ui/country-phone-input";
import { arabCountries, defaultArabCountry, radiusAuthContent } from "@/components/auth/auth-content";

type Mode = "login" | "signup";
type LoginStatus = "idle" | "loading" | "success" | "error";

const networkDots = [
  { left: "5%", top: "14%", size: 4, delay: "-1.5s", duration: "7s", tone: "blue" },
  { left: "12%", top: "34%", size: 3, delay: "-4s", duration: "8.5s", tone: "soft" },
  { left: "20%", top: "72%", size: 5, delay: "-2s", duration: "9s", tone: "blue" },
  { left: "28%", top: "20%", size: 3, delay: "-6s", duration: "10s", tone: "soft" },
  { left: "35%", top: "84%", size: 4, delay: "-3s", duration: "7.8s", tone: "amber" },
  { left: "43%", top: "11%", size: 3, delay: "-5s", duration: "9.8s", tone: "soft" },
  { left: "48%", top: "63%", size: 4, delay: "-1s", duration: "8.2s", tone: "blue" },
  { left: "57%", top: "27%", size: 5, delay: "-7s", duration: "10.5s", tone: "soft" },
  { left: "64%", top: "78%", size: 3, delay: "-2.5s", duration: "7.4s", tone: "blue" },
  { left: "72%", top: "16%", size: 4, delay: "-4.5s", duration: "9.4s", tone: "amber" },
  { left: "80%", top: "46%", size: 3, delay: "-6.5s", duration: "8.8s", tone: "soft" },
  { left: "89%", top: "25%", size: 5, delay: "-3.5s", duration: "10.8s", tone: "blue" },
  { left: "94%", top: "69%", size: 3, delay: "-1.8s", duration: "8s", tone: "soft" },
  { left: "8%", top: "88%", size: 3, delay: "-5.2s", duration: "9.2s", tone: "amber" },
  { left: "24%", top: "49%", size: 4, delay: "-2.8s", duration: "8.6s", tone: "soft" },
  { left: "39%", top: "38%", size: 3, delay: "-7.5s", duration: "11s", tone: "blue" },
  { left: "53%", top: "91%", size: 4, delay: "-4.2s", duration: "9.6s", tone: "soft" },
  { left: "68%", top: "55%", size: 5, delay: "-1.2s", duration: "8.4s", tone: "blue" },
  { left: "77%", top: "88%", size: 3, delay: "-6.2s", duration: "10.2s", tone: "soft" },
  { left: "91%", top: "8%", size: 4, delay: "-3.2s", duration: "7.6s", tone: "amber" },
  { left: "15%", top: "9%", size: 3, delay: "-2.3s", duration: "8.1s", tone: "amber" },
  { left: "18%", top: "57%", size: 4, delay: "-5.6s", duration: "9.1s", tone: "blue" },
  { left: "31%", top: "66%", size: 3, delay: "-4.8s", duration: "8.7s", tone: "amber" },
  { left: "46%", top: "24%", size: 4, delay: "-6.8s", duration: "9.9s", tone: "blue" },
  { left: "52%", top: "46%", size: 3, delay: "-3.7s", duration: "7.9s", tone: "amber" },
  { left: "61%", top: "9%", size: 4, delay: "-1.7s", duration: "8.9s", tone: "blue" },
  { left: "70%", top: "35%", size: 3, delay: "-5.9s", duration: "9.7s", tone: "amber" },
  { left: "75%", top: "68%", size: 4, delay: "-2.7s", duration: "8.3s", tone: "blue" },
  { left: "84%", top: "13%", size: 3, delay: "-6.4s", duration: "10.1s", tone: "amber" },
  { left: "86%", top: "78%", size: 4, delay: "-4.4s", duration: "9.3s", tone: "blue" },
  { left: "96%", top: "42%", size: 3, delay: "-2.1s", duration: "8.5s", tone: "amber" },
  { left: "3%", top: "61%", size: 4, delay: "-5.1s", duration: "9.5s", tone: "blue" },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col items-center text-center" dir="ltr">
      <div className={`auth-brand-icon relative grid place-items-center rounded-[19px] bg-gradient-to-br from-[#1479ff] to-[#0758e9] shadow-[0_12px_30px_rgba(20,121,255,.24)] ${compact ? "h-12 w-12" : "h-[68px] w-[68px]"}`}>
        <Crown className={`${compact ? "h-6 w-6" : "h-9 w-9"} text-[#ffad16]`} strokeWidth={2.2} />
        <Radio className={`absolute bottom-1.5 text-white ${compact ? "h-3.5 w-3.5" : "h-[17px] w-[17px]"}`} strokeWidth={2.5} />
      </div>
      <div className={`${compact ? "mt-2 text-[20px]" : "mt-3 text-[30px]"} font-black leading-none tracking-tight text-[#102a63] dark:text-white`}>LORD</div>
      <div className={`${compact ? "text-[9px]" : "text-[12px]"} mt-1 font-extrabold tracking-[.08em] text-[#e99100] dark:text-[#ffad16]`}>RADIUS LORD</div>
    </div>
  );
}

const features = [
  { label: "إدارة NAS", icon: Server },
  { label: "إدارة المشتركين", icon: Users },
  { label: "جلسات مباشرة", icon: Activity },
  { label: "حماية ومراقبة", icon: ShieldCheck },
];

function VisualPanel() {
  return (
    <section className="relative hidden h-full overflow-hidden bg-[#edf3f8] dark:bg-[#211a25]/95 min-[1024px]:block">
      <div className="auth-panel-glow absolute -left-28 -top-24 h-72 w-72 rounded-full bg-[#1479ff]/12 blur-[90px]" />
      <div className="auth-panel-glow auth-panel-glow-delay absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-[#ffad16]/8 blur-[90px] dark:bg-[#ffad16]/5" />
      <div className="absolute inset-0 opacity-[.10] [background-image:linear-gradient(rgba(20,121,255,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(20,121,255,.16)_1px,transparent_1px)] [background-size:34px_34px] dark:opacity-[.10]" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-10 text-center">
        <Brand />
        <h2 className="mt-7 text-[22px] font-black text-[#102a63] dark:text-[#f4f1f5]">{radiusAuthContent.title}</h2>
        <p className="mx-auto mt-3 max-w-[420px] text-[12px] leading-6 text-slate-600 dark:text-[#b9b3bd]">{radiusAuthContent.description}</p>
        <div className="mt-8 grid w-full max-w-[430px] grid-cols-2 gap-3">
          {features.map(({ label, icon: Icon }, index) => (
            <div key={label} className="auth-feature-card flex min-h-[76px] items-center gap-3 rounded-[18px] border border-[#d4e1ed] bg-white px-4 text-right shadow-sm dark:border-white/[.08] dark:bg-[#302e33]/90 dark:shadow-none" style={{ animationDelay: `${index * 160}ms` }}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e2e9f1] text-[#0758e9] dark:bg-[#3b383e] dark:text-[#8ab5ff]"><Icon className="h-[21px] w-[21px]" /></span>
              <span className="text-[13px] font-bold text-[#17386d] dark:text-[#ece8ee]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function LordAuth({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [activeMode, setActiveMode] = useState<Mode>(mode);
  const [transitioning, setTransitioning] = useState(false);
  const [loginStatus, setLoginStatus] = useState<LoginStatus>("idle");
  const signup = activeMode === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState(defaultArabCountry);
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [terms, setTerms] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setMounted(true), []);

  const isDark = mounted && theme === "dark";

  const triggerLoginError = (text: string) => {
    setMessage(text);
    setLoginStatus("error");
    window.setTimeout(() => setLoginStatus("idle"), 560);
  };

  const switchMode = (nextMode: Mode) => {
    if (transitioning || nextMode === activeMode) return;
    setTransitioning(true);
    setMessage("");
    setLoginStatus("idle");
    window.setTimeout(() => setActiveMode(nextMode), 160);
    window.setTimeout(() => {
      router.push(nextMode === "login" ? "/login" : "/signup");
      setTransitioning(false);
    }, 560);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");

    if (signup) {
      if (!fullName || !email || !phone || !password || !confirm) return setMessage("يرجى تعبئة جميع الحقول المطلوبة.");
      if (password !== confirm) return setMessage("كلمتا المرور غير متطابقتين.");
      if (!terms) return setMessage("يرجى الموافقة على الشروط والأحكام وسياسة الخصوصية.");
      return setMessage(`واجهة إنشاء الحساب جاهزة للربط الخلفي (${country.code}${phone}).`);
    }

    if (!email || !password) return triggerLoginError("يرجى إدخال اسم المستخدم أو البريد الإلكتروني وكلمة المرور.");

    setLoginStatus("loading");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: email, password }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setLoginStatus("success");
        window.setTimeout(() => {
          window.location.href = "/Dashboard";
        }, 1400);
      } else {
        triggerLoginError(data.message || "فشل تسجيل الدخول.");
      }
    } catch {
      triggerLoginError("تعذر الاتصال بالخادم.");
    }
  };

  const eye = (visible: boolean, toggle: () => void) => (
    <button
      type="button"
      onClick={toggle}
      className="absolute left-2.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition-all duration-300 hover:scale-105 hover:bg-[#e8eff6] hover:text-[#0758e9] dark:text-[#b9b3bd] dark:hover:bg-[#454149] dark:hover:text-white"
      aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
    >
      {visible ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
    </button>
  );

  return (
    <main
      dir="rtl"
      className="relative h-[100dvh] overflow-hidden bg-[#dce5ef] text-[#102a63] transition-colors duration-500 dark:bg-[#1d1721] dark:text-[#f4f1f5]"
      style={{ fontFamily: "LBC, Tahoma, Arial, sans-serif" }}
    >
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="fixed left-5 top-5 z-30 grid h-11 w-11 place-items-center rounded-full border border-[#cbd9e7] bg-[#f9fbfe] text-[#102a63] shadow-[0_10px_30px_rgba(53,83,116,.14)] transition-all duration-500 hover:-translate-y-0.5 hover:border-[#7fb1e8] hover:text-[#0758e9] dark:border-white/[.10] dark:bg-[#302e33]/95 dark:text-[#f4f1f5] dark:shadow-[0_12px_32px_rgba(0,0,0,.26)] dark:hover:border-white/20 dark:hover:text-[#8ab5ff]"
        aria-label={isDark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
        title={isDark ? "الوضع الفاتح" : "الوضع الداكن"}
      >
        {mounted && isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="auth-bg-grid absolute inset-0" />
        <div className="auth-bg-scan absolute inset-[-25%]" />
        <div className="auth-orbit auth-orbit-a absolute left-[7%] top-[10%] h-[270px] w-[270px] rounded-full border border-[#1479ff]/15 dark:border-[#1479ff]/10" />
        <div className="auth-orbit auth-orbit-b absolute bottom-[5%] right-[7%] h-[220px] w-[220px] rounded-full border border-[#ffad16]/15 dark:border-[#ffad16]/10" />
        <div className="auth-glow auth-glow-blue absolute -left-32 top-[8%] h-[360px] w-[360px] rounded-full bg-[#1479ff]/12 blur-[120px] dark:bg-[#1479ff]/11" />
        <div className="auth-glow auth-glow-amber absolute -right-28 bottom-[5%] h-[300px] w-[300px] rounded-full bg-[#ffad16]/9 blur-[120px] dark:bg-[#ffad16]/6" />

        <svg viewBox="0 0 1600 900" preserveAspectRatio="none" className="auth-network-lines absolute inset-0 h-full w-full opacity-[.26] dark:opacity-[.20]">
          <g fill="none" stroke="currentColor" className="text-[#5f8fc8] dark:text-[#7ea4ff]" strokeWidth="1">
            <path d="M0 180 L145 118 L310 204 L452 112 L612 245" />
            <path d="M0 645 L170 730 L326 588 L486 700 L640 560" />
            <path d="M1600 170 L1450 250 L1300 118 L1155 240 L1015 146" />
            <path d="M1600 680 L1458 570 L1292 720 L1142 590 L1002 760" />
            <path d="M145 118 L170 730 M452 112 L486 700 M1450 250 L1458 570 M1155 240 L1142 590" opacity=".45" />
          </g>
        </svg>

        {networkDots.map((dot, index) => (
          <span
            key={index}
            className={`auth-network-dot absolute rounded-full ${
              dot.tone === "amber"
                ? "bg-[#f3a000] dark:bg-[#ffad16]"
                : dot.tone === "blue"
                  ? "bg-[#1479ff] dark:bg-[#6aa8ff]"
                  : "bg-[#7693b1] dark:bg-[#8f8795]"
            }`}
            style={{
              left: dot.left,
              top: dot.top,
              width: dot.size,
              height: dot.size,
              animationDelay: dot.delay,
              animationDuration: dot.duration,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex h-full min-h-0 items-center justify-center p-3 sm:p-4">
        <div
          dir="ltr"
          className={`auth-shell relative w-full overflow-hidden rounded-[22px] border border-white/80 bg-[#f9fbfe] shadow-[0_24px_70px_rgba(53,83,116,.18)] transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] dark:border-white/[.10] dark:bg-[#302e33]/95 dark:shadow-[0_28px_80px_rgba(0,0,0,.36)] dark:backdrop-blur-xl ${
            signup
              ? "grid max-w-[1020px] min-[1024px]:h-[min(610px,calc(100dvh-24px))] min-[1024px]:grid-cols-2"
              : "max-w-[500px] h-[min(610px,calc(100dvh-24px))]"
          } ${transitioning ? "scale-[.985] opacity-80" : "scale-100 opacity-100"}`}
        >
          {signup && <VisualPanel />}

          <section
            dir="rtl"
            className={`relative flex h-full min-h-0 items-center justify-center overflow-hidden bg-[#f9fbfe] px-5 transition-colors duration-500 dark:bg-[#302e33]/90 sm:px-8 ${
              signup ? "py-5" : "auth-login-section py-4 sm:py-5"
            }`}
          >
            <div className="auth-card-glow pointer-events-none absolute left-1/2 top-0 h-40 w-[70%] -translate-x-1/2 rounded-full bg-[#1479ff]/7 blur-[70px] dark:bg-[#1479ff]/5" />
            <div className={`relative z-10 w-full ${signup ? "max-w-[470px]" : "auth-login-content max-w-[418px]"}`}>
              {!signup && <div className="mb-7"><Brand /></div>}
              {signup && <div className="mb-5 min-[1024px]:hidden"><Brand compact /></div>}

              <div className="text-center">
                <div className="auth-login-icon mx-auto grid h-[52px] w-[52px] place-items-center rounded-full bg-gradient-to-br from-[#1479ff] to-[#0758e9] text-white shadow-[0_10px_24px_rgba(20,121,255,.22)]">
                  {signup ? <UserRound className="h-[22px] w-[22px]" /> : <LockKeyhole className="h-[22px] w-[22px]" />}
                </div>
                <h1 className="mt-3 text-[26px] font-black text-[#102a63] dark:text-[#f4f1f5]">{signup ? "إنشاء حساب جديد" : "تسجيل الدخول"}</h1>
                <p className="mx-auto mt-2 max-w-[370px] text-[12px] leading-5 text-slate-500 dark:text-[#b9b3bd]">
                  {signup ? "أنشئ حسابك الآن وابدأ إدارة شبكتك بسهولة وأمان" : "أدخل اسم المستخدم أو البريد الإلكتروني وكلمة المرور للوصول إلى حسابك"}
                </p>
              </div>

              <form onSubmit={submit} autoComplete="on" className={signup ? "mt-6" : "mt-7"}>
                {signup ? (
                  <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
                    <CompactField label="الاسم الكامل *" icon={UserRound} name="name" autoComplete="name" value={fullName} onChange={setFullName} placeholder="أدخل اسمك الكامل" />
                    <CompactField label="البريد الإلكتروني *" icon={Mail} type="email" name="email" autoComplete="email" value={email} onChange={setEmail} placeholder="أدخل بريدك الإلكتروني" />
                    <CountryPhoneInput className="sm:col-span-2" countries={arabCountries} country={country} onCountryChange={setCountry} phone={phone} onPhoneChange={setPhone} />
                    <CompactField label="كلمة المرور *" icon={LockKeyhole} type={showPassword ? "text" : "password"} name="new-password" autoComplete="new-password" value={password} onChange={setPassword} placeholder="أدخل كلمة المرور" suffix={eye(showPassword, () => setShowPassword((value) => !value))} />
                    <CompactField label="تأكيد كلمة المرور *" icon={LockKeyhole} type={showConfirm ? "text" : "password"} name="confirm-password" autoComplete="new-password" value={confirm} onChange={setConfirm} placeholder="أعد إدخال كلمة المرور" suffix={eye(showConfirm, () => setShowConfirm((value) => !value))} />
                    <label className="flex items-start gap-2 text-[10px] leading-5 text-slate-600 dark:text-[#b9b3bd] sm:col-span-2">
                      <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-1 h-3.5 w-3.5 accent-[#1479ff]" />
                      <span>أوافق على <button type="button" className="font-semibold text-[#0758e9] dark:text-[#8ab5ff]">الشروط والأحكام وسياسة الخصوصية</button></span>
                    </label>
                    {message && <div className="rounded-[14px] border border-[#e5a42e]/30 bg-[#fff4df] px-3 py-2.5 text-[10px] text-[#9c6500] dark:border-[#ffad16]/25 dark:bg-[#ffad16]/10 dark:text-[#ffc45c] sm:col-span-2">{message}</div>}
                    <div className="sm:col-span-2"><PrimaryFormButton>إنشاء الحساب <UserRound className="h-4 w-4" /></PrimaryFormButton></div>
                    <div className="flex items-center gap-3 text-[9px] text-slate-400 dark:text-[#8f8795] sm:col-span-2"><span className="h-px flex-1 bg-slate-200 dark:bg-white/[.08]" />أو<span className="h-px flex-1 bg-slate-200 dark:bg-white/[.08]" /></div>
                    <div className="sm:col-span-2"><SecondaryFormButton><span className="text-sm font-black text-[#4285f4]">G</span> إنشاء حساب باستخدام Google</SecondaryFormButton></div>
                    <div className="text-center text-[10px] text-slate-500 dark:text-[#b9b3bd] sm:col-span-2">لديك حساب بالفعل؟ <button type="button" onClick={() => switchMode("login")} className="mr-2 font-bold text-[#0758e9] transition-colors hover:text-[#063fbf] dark:text-[#8ab5ff] dark:hover:text-white">تسجيل الدخول</button></div>
                  </div>
                ) : (
                  <div className="space-y-4.5">
                    <CompactField label="اسم المستخدم أو البريد الإلكتروني *" icon={UserRound} name="username" autoComplete="username" value={email} onChange={setEmail} placeholder="أدخل اسم المستخدم أو البريد الإلكتروني" />
                    <CompactField label="كلمة المرور *" icon={LockKeyhole} type={showPassword ? "text" : "password"} name="password" autoComplete="current-password" value={password} onChange={setPassword} placeholder="أدخل كلمة المرور" suffix={eye(showPassword, () => setShowPassword((value) => !value))} />
                    {message && <div className="rounded-[14px] border border-[#e5a42e]/30 bg-[#fff4df] px-3 py-2.5 text-[10px] text-[#9c6500] dark:border-[#ffad16]/25 dark:bg-[#ffad16]/10 dark:text-[#ffc45c]">{message}</div>}
                    <div className="pt-3"><PrimaryFormButton status={loginStatus} disabled={loginStatus !== "idle" && loginStatus !== "error"}>تسجيل الدخول <span>←</span></PrimaryFormButton></div>
                    <div className="flex items-center gap-3 text-[9px] text-slate-400 dark:text-[#8f8795]"><span className="h-px flex-1 bg-slate-200 dark:bg-white/[.08]" />أو<span className="h-px flex-1 bg-slate-200 dark:bg-white/[.08]" /></div>
                    <SecondaryFormButton><span className="text-sm font-black text-[#4285f4]">G</span> تسجيل الدخول باستخدام Google</SecondaryFormButton>
                    <div className="pt-1 text-center text-[10px] text-slate-500 dark:text-[#b9b3bd]">ليس لديك حساب؟ <button type="button" onClick={() => switchMode("signup")} className="mr-2 font-bold text-[#0758e9] transition-colors hover:text-[#063fbf] dark:text-[#8ab5ff] dark:hover:text-white">إنشاء حساب جديد</button></div>
                  </div>
                )}
              </form>
            </div>
          </section>
        </div>
      </div>

      <style jsx global>{`
        @keyframes authDotPulse {
          0%, 100% { transform: translate3d(0,0,0) scale(.75); opacity: .22; box-shadow: 0 0 0 rgba(106,168,255,0); }
          45% { transform: translate3d(6px,-9px,0) scale(1.35); opacity: .9; box-shadow: 0 0 14px rgba(106,168,255,.52); }
          70% { transform: translate3d(-4px,-3px,0) scale(.95); opacity: .42; }
        }
        @keyframes authGridDrift {
          from { background-position: 0 0, 0 0; }
          to { background-position: 52px 36px, 52px 36px; }
        }
        @keyframes authScanMove {
          0% { transform: translate3d(-14%,-8%,0) rotate(-8deg); opacity: 0; }
          18% { opacity: .28; }
          55% { opacity: .12; }
          100% { transform: translate3d(16%,10%,0) rotate(-8deg); opacity: 0; }
        }
        @keyframes authOrbitFloat {
          0%,100% { transform: translate3d(0,0,0) scale(1); opacity: .55; }
          50% { transform: translate3d(18px,-12px,0) scale(1.08); opacity: .18; }
        }
        @keyframes authNetworkFlow {
          0%,100% { transform: translate3d(0,0,0); opacity: .16; }
          50% { transform: translate3d(8px,-5px,0); opacity: .28; }
        }
        @keyframes authGlowFloat {
          0%,100% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(22px,-14px,0) scale(1.08); }
        }
        @keyframes authBrandFloat {
          0%,100% { transform: translateY(0); box-shadow: 0 12px 30px rgba(20,121,255,.24); }
          50% { transform: translateY(-5px); box-shadow: 0 18px 38px rgba(20,121,255,.34); }
        }
        @keyframes authIconPulse {
          0%,100% { transform: scale(1); box-shadow: 0 10px 24px rgba(20,121,255,.22); }
          50% { transform: scale(1.06); box-shadow: 0 14px 34px rgba(20,121,255,.36); }
        }
        @keyframes authCardRise {
          0% { transform: translateY(8px); opacity: .55; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes authPanelGlow {
          0%,100% { transform: translate3d(0,0,0); opacity: .8; }
          50% { transform: translate3d(18px,-10px,0); opacity: .45; }
        }

        .auth-bg-grid {
          opacity: .24;
          background-image:
            linear-gradient(rgba(20,121,255,.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(20,121,255,.12) 1px, transparent 1px);
          background-size: 46px 46px;
          mask-image: radial-gradient(circle at center, #000 15%, rgba(0,0,0,.68) 56%, transparent 96%);
          animation: authGridDrift 24s linear infinite;
        }
        .dark .auth-bg-grid {
          opacity: .20;
          background-image:
            linear-gradient(rgba(126,164,255,.11) 1px, transparent 1px),
            linear-gradient(90deg, rgba(126,164,255,.11) 1px, transparent 1px);
        }
        .auth-bg-scan {
          background: linear-gradient(90deg, transparent 38%, rgba(20,121,255,.06) 49%, rgba(20,121,255,.11) 50%, rgba(20,121,255,.06) 51%, transparent 62%);
          animation: authScanMove 11s ease-in-out infinite;
        }
        .auth-network-dot { animation-name: authDotPulse; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        .auth-network-lines { animation: authNetworkFlow 9s ease-in-out infinite; }
        .auth-orbit { animation: authOrbitFloat 12s ease-in-out infinite; box-shadow: inset 0 0 40px rgba(20,121,255,.025); }
        .auth-orbit-b { animation-delay: -5s; animation-duration: 15s; }
        .auth-glow { animation: authGlowFloat 14s ease-in-out infinite; }
        .auth-glow-amber { animation-delay: -6s; animation-duration: 17s; }
        .auth-brand-icon { animation: authBrandFloat 5.5s ease-in-out infinite; }
        .auth-login-icon { animation: authIconPulse 3.6s ease-in-out infinite; }
        .auth-card-glow { animation: authGlowFloat 9s ease-in-out infinite; }
        .auth-feature-card { animation: authCardRise .7s cubic-bezier(.22,.8,.25,1) both; transition: transform .4s cubic-bezier(.22,.8,.25,1), background-color .4s ease, border-color .4s ease; }
        .auth-feature-card:hover { transform: translateY(-3px); border-color: rgba(20,121,255,.28); background: #edf5ff; }
        .dark .auth-feature-card:hover { border-color: rgba(106,168,255,.22); background: rgba(56,54,60,.92); }
        .auth-panel-glow { animation: authPanelGlow 10s ease-in-out infinite; }
        .auth-panel-glow-delay { animation-delay: -4s; }
        .auth-login-content { transition: transform .4s cubic-bezier(.22,.8,.25,1); transform-origin: center center; }

        @media (max-height: 800px) {
          .auth-login-content { transform: scale(.92); width: 108.7%; max-width: none; }
        }

        @media (max-height: 730px) {
          .auth-login-content { transform: scale(.84); width: 119%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .auth-bg-grid,
          .auth-bg-scan,
          .auth-network-dot,
          .auth-network-lines,
          .auth-orbit,
          .auth-glow,
          .auth-brand-icon,
          .auth-login-icon,
          .auth-card-glow,
          .auth-feature-card,
          .auth-panel-glow { animation: none !important; }
        }
      `}</style>
    </main>
  );
}
