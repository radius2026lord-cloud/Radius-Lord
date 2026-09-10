"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Crown,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Radio,
  Server,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { CompactField, PrimaryFormButton, SecondaryFormButton } from "@/components/ui/auth-form-controls";
import { CountryPhoneInput } from "@/components/ui/country-phone-input";
import { arabCountries, defaultArabCountry, radiusAuthContent } from "@/components/auth/auth-content";

type Mode = "login" | "signup";

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col items-center text-center" dir="ltr">
      <div className={`relative grid place-items-center rounded-[18px] bg-gradient-to-br from-[#1479ff] to-[#0758e9] shadow-[0_12px_30px_rgba(20,121,255,.24)] ${compact ? "h-12 w-12" : "h-16 w-16"}`}>
        <Crown className={`${compact ? "h-6 w-6" : "h-8 w-8"} text-[#ffad16]`} strokeWidth={2.2} />
        <Radio className={`absolute bottom-1.5 text-white ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`} strokeWidth={2.5} />
      </div>
      <div className={`${compact ? "mt-2 text-[20px]" : "mt-3 text-[28px]"} font-black leading-none tracking-tight text-white`}>LORD</div>
      <div className={`${compact ? "text-[9px]" : "text-[11px]"} mt-1 font-extrabold tracking-[.08em] text-[#ffad16]`}>RADIUS LORD</div>
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
    <section className="relative hidden h-full overflow-hidden bg-[#211a25] min-[1024px]:block">
      <div className="absolute -left-28 -top-24 h-72 w-72 rounded-full bg-[#1479ff]/10 blur-[90px]" />
      <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-[#ffad16]/5 blur-[90px]" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-10 text-center">
        <Brand />
        <h2 className="mt-7 text-[21px] font-black text-[#f4f1f5]">{radiusAuthContent.title}</h2>
        <p className="mx-auto mt-3 max-w-[420px] text-[11px] leading-6 text-[#b9b3bd]">{radiusAuthContent.description}</p>
        <div className="mt-8 grid w-full max-w-[430px] grid-cols-2 gap-3">
          {features.map(({ label, icon: Icon }) => (
            <div key={label} className="flex min-h-[72px] items-center gap-3 rounded-[18px] border border-white/[.08] bg-[#302e33] px-4 text-right">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#3b383e] text-[#8ab5ff]"><Icon className="h-5 w-5" /></span>
              <span className="text-[12px] font-bold text-[#ece8ee]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function LordAuth({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<Mode>(mode);
  const [transitioning, setTransitioning] = useState(false);
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

  const switchMode = (nextMode: Mode) => {
    if (transitioning || nextMode === activeMode) return;
    setTransitioning(true);
    setMessage("");
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

    if (!email || !password) return setMessage("يرجى إدخال اسم المستخدم أو البريد الإلكتروني وكلمة المرور.");

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
      className="absolute left-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[#b9b3bd] transition-all duration-300 hover:bg-[#454149] hover:text-white"
      aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
    >
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <main
      dir="rtl"
      className="relative min-h-[100dvh] overflow-x-hidden bg-[#1d1721] text-[#f4f1f5]"
      style={{ fontFamily: "LBC, Tahoma, Arial, sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 top-[8%] h-[360px] w-[360px] rounded-full bg-[#1479ff]/10 blur-[120px]" />
        <div className="absolute -right-28 bottom-[5%] h-[300px] w-[300px] rounded-full bg-[#ffad16]/5 blur-[120px]" />
        <div className="absolute inset-0 opacity-[.16] [background-image:radial-gradient(circle,rgba(138,181,255,.38)_1px,transparent_1px)] [background-size:28px_28px]" />
      </div>

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-4 sm:p-6">
        <div
          dir="ltr"
          className={`auth-shell relative w-full overflow-hidden rounded-[22px] border border-white/[.10] bg-[#302e33] shadow-[0_28px_80px_rgba(0,0,0,.36)] transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] ${
            signup
              ? "grid max-w-[1020px] min-[1024px]:h-[610px] min-[1024px]:grid-cols-2"
              : "max-w-[500px]"
          } ${transitioning ? "scale-[.985] opacity-80" : "scale-100 opacity-100"}`}
        >
          {signup && <VisualPanel />}

          <section
            dir="rtl"
            className={`relative flex h-full items-center justify-center bg-[#302e33] px-5 sm:px-8 ${
              signup ? "min-h-[calc(100dvh-32px)] py-7 min-[1024px]:min-h-0" : "min-h-[610px] py-8"
            }`}
          >
            <div className={`relative z-10 w-full ${signup ? "max-w-[470px]" : "max-w-[410px]"}`}>
              {!signup && <div className="mb-7"><Brand /></div>}
              {signup && <div className="mb-5 min-[1024px]:hidden"><Brand compact /></div>}

              <div className="text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#1479ff] to-[#0758e9] text-white shadow-[0_10px_24px_rgba(20,121,255,.22)]">
                  {signup ? <UserRound className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
                </div>
                <h1 className="mt-3 text-[24px] font-black text-[#f4f1f5]">{signup ? "إنشاء حساب جديد" : "تسجيل الدخول"}</h1>
                <p className="mx-auto mt-2 max-w-[360px] text-[11px] leading-5 text-[#b9b3bd]">
                  {signup ? "أنشئ حسابك الآن وابدأ إدارة شبكتك بسهولة وأمان" : "أدخل اسم المستخدم أو البريد الإلكتروني وكلمة المرور للوصول إلى حسابك"}
                </p>
              </div>

              <form onSubmit={submit} className={signup ? "mt-6" : "mt-8"}>
                {signup ? (
                  <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
                    <CompactField label="الاسم الكامل *" icon={UserRound} value={fullName} onChange={setFullName} placeholder="أدخل اسمك الكامل" />
                    <CompactField label="البريد الإلكتروني *" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="أدخل بريدك الإلكتروني" />
                    <CountryPhoneInput className="sm:col-span-2" countries={arabCountries} country={country} onCountryChange={setCountry} phone={phone} onPhoneChange={setPhone} />
                    <CompactField label="كلمة المرور *" icon={LockKeyhole} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="أدخل كلمة المرور" suffix={eye(showPassword, () => setShowPassword((value) => !value))} />
                    <CompactField label="تأكيد كلمة المرور *" icon={LockKeyhole} type={showConfirm ? "text" : "password"} value={confirm} onChange={setConfirm} placeholder="أعد إدخال كلمة المرور" suffix={eye(showConfirm, () => setShowConfirm((value) => !value))} />
                    <label className="flex items-start gap-2 text-[10px] leading-5 text-[#b9b3bd] sm:col-span-2">
                      <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-1 h-3.5 w-3.5 accent-[#1479ff]" />
                      <span>أوافق على <button type="button" className="font-semibold text-[#8ab5ff]">الشروط والأحكام وسياسة الخصوصية</button></span>
                    </label>
                    {message && <div className="rounded-[14px] border border-[#ffad16]/25 bg-[#ffad16]/10 px-3 py-2.5 text-[10px] text-[#ffc45c] sm:col-span-2">{message}</div>}
                    <div className="sm:col-span-2"><PrimaryFormButton>إنشاء الحساب <UserRound className="h-4 w-4" /></PrimaryFormButton></div>
                    <div className="flex items-center gap-3 text-[9px] text-[#8f8795] sm:col-span-2"><span className="h-px flex-1 bg-white/[.08]" />أو<span className="h-px flex-1 bg-white/[.08]" /></div>
                    <div className="sm:col-span-2"><SecondaryFormButton><span className="text-sm font-black text-[#4285f4]">G</span> إنشاء حساب باستخدام Google</SecondaryFormButton></div>
                    <div className="text-center text-[10px] text-[#b9b3bd] sm:col-span-2">لديك حساب بالفعل؟ <button type="button" onClick={() => switchMode("login")} className="mr-2 font-bold text-[#8ab5ff]">تسجيل الدخول</button></div>
                  </div>
                ) : (
                  <div className="space-y-4.5">
                    <CompactField label="اسم المستخدم أو البريد الإلكتروني *" icon={UserRound} value={email} onChange={setEmail} placeholder="أدخل اسم المستخدم أو البريد الإلكتروني" />
                    <CompactField label="كلمة المرور *" icon={LockKeyhole} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="أدخل كلمة المرور" suffix={eye(showPassword, () => setShowPassword((value) => !value))} />
                    {message && <div className="rounded-[14px] border border-[#ffad16]/25 bg-[#ffad16]/10 px-3 py-2.5 text-[10px] text-[#ffc45c]">{message}</div>}
                    <div className="pt-1"><PrimaryFormButton>تسجيل الدخول <span>←</span></PrimaryFormButton></div>
                    <div className="flex items-center gap-3 text-[9px] text-[#8f8795]"><span className="h-px flex-1 bg-white/[.08]" />أو<span className="h-px flex-1 bg-white/[.08]" /></div>
                    <SecondaryFormButton><span className="text-sm font-black text-[#4285f4]">G</span> تسجيل الدخول باستخدام Google</SecondaryFormButton>
                    <div className="pt-1 text-center text-[10px] text-[#b9b3bd]">ليس لديك حساب؟ <button type="button" onClick={() => switchMode("signup")} className="mr-2 font-bold text-[#8ab5ff] transition-colors hover:text-white">إنشاء حساب جديد</button></div>
                  </div>
                )}
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
