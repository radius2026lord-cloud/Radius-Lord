"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  BarChart3,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  Radio,
  Server,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type Mode = "login" | "signup";

type FieldProps = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suffix?: React.ReactNode;
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="text-center" dir="ltr">
      <div className={`relative mx-auto grid place-items-center ${compact ? "h-14 w-14" : "h-[82px] w-[82px]"}`}>
        <div className="absolute top-0 text-[#ffad16]">
          <svg viewBox="0 0 96 68" className={compact ? "h-10 w-14" : "h-14 w-20"} aria-hidden="true">
            <path d="M8 51 16 15l19 17L48 7l13 25 19-17 8 36Z" fill="currentColor" />
            <circle cx="16" cy="12" r="5" fill="#0b3b82" />
            <circle cx="48" cy="5" r="5" fill="#0b3b82" />
            <circle cx="80" cy="12" r="5" fill="#0b3b82" />
          </svg>
        </div>
        <Radio className={`absolute bottom-0 text-[#0c63dc] ${compact ? "h-7 w-7" : "h-9 w-9"}`} strokeWidth={2.4} />
      </div>
      <div className={`${compact ? "mt-2 text-3xl" : "mt-3 text-[46px]"} font-black leading-none tracking-tight text-[#0c3272] dark:text-white`}>LORD</div>
      <div className={`${compact ? "mt-1 text-sm" : "mt-2 text-xl"} font-extrabold tracking-[.06em] text-[#f2a000]`}>RADIUS LORD</div>
    </div>
  );
}

function NetworkBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-55 dark:opacity-30" aria-hidden="true">
      <svg viewBox="0 0 900 900" className="h-full w-full">
        <g stroke="#4d91ef" strokeOpacity=".20" fill="none" strokeWidth="1.2">
          <path d="M40 320 180 250l130 90 115-130 145 85 135-100 145 120" />
          <path d="M65 580 190 470l125 80 105-100 160 82 125-120 130 90" />
          <path d="M110 720 250 620l125 78 135-115 145 72 120-70" />
        </g>
        {[
          [40,320],[180,250],[310,340],[425,210],[570,295],[705,195],[850,315],
          [65,580],[190,470],[315,550],[420,450],[580,532],[705,412],[835,502],
          [110,720],[250,620],[375,698],[510,583],[655,655],[775,585]
        ].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="5" fill="#3b82f6" fillOpacity=".26" />)}
      </svg>
    </div>
  );
}

function ServerIllustration({ large = false }: { large?: boolean }) {
  return (
    <div className={`relative mx-auto ${large ? "h-[330px] max-w-[420px]" : "h-[250px] max-w-[340px]"}`} aria-hidden="true">
      <div className="absolute bottom-3 left-1/2 h-12 w-[86%] -translate-x-1/2 rounded-[50%] bg-[#2f6fc8]/15 blur-xl dark:bg-black/30" />
      <div className="absolute bottom-10 left-1/2 w-[62%] -translate-x-1/2 space-y-2.5">
        {[0,1,2,3].map((item) => (
          <div key={item} className="flex h-14 items-center rounded-[18px] border border-[#7da5d6]/35 bg-gradient-to-r from-[#dbe8f8] to-[#b8cee9] px-5 shadow-[0_10px_24px_rgba(23,66,120,.14)] dark:border-[#486586]/45 dark:from-[#1b3556] dark:to-[#102845]">
            <span className={`h-2.5 w-2.5 rounded-full ${item === 1 ? "bg-[#ffad16]" : "bg-emerald-500"}`} />
            <span className="mr-3 h-2 flex-1 rounded-full bg-[#6d91bd]/55 dark:bg-[#58789c]/60" />
          </div>
        ))}
      </div>
      <div className="absolute bottom-8 left-[12%] grid h-[135px] w-[112px] place-items-center rounded-[38%_38%_45%_45%/32%_32%_62%_62%] border-[8px] border-white bg-gradient-to-b from-[#187bff] to-[#063fbf] text-white shadow-[0_18px_32px_rgba(12,83,197,.30)] dark:border-[#dce8f8]">
        <LockKeyhole className="h-14 w-14" strokeWidth={1.9} />
      </div>
      {large && (
        <div className="absolute right-[4%] top-3 h-[140px] w-[185px] -rotate-3 rounded-[18px] border border-[#a9c3e4] bg-white/80 p-5 shadow-[0_16px_30px_rgba(43,77,119,.12)] dark:border-[#314d6d] dark:bg-[#102641]/80">
          <div className="h-2.5 w-20 rounded-full bg-[#0d6ef0]/25" />
          <div className="mt-6 flex h-16 items-end gap-2">
            {[32,52,40,70,58].map((height, index) => <span key={index} className="w-5 rounded-t-md bg-[#0d73ef]" style={{height}} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureCard({ title, text, icon: Icon, tone }: { title: string; text: string; icon: React.ComponentType<{ className?: string }>; tone: string }) {
  return (
    <div className="flex min-h-[92px] items-center gap-4 rounded-[17px] border border-white/90 bg-white/88 px-4 py-3 shadow-[0_9px_22px_rgba(49,78,112,.07)] dark:border-white/[.08] dark:bg-[#0d243b]/92">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br ${tone} text-white shadow-sm`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <div className="text-[15px] font-bold text-[#10336f] dark:text-white">{title}</div>
        <div className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{text}</div>
      </div>
    </div>
  );
}

function InfoPanel({ signup }: { signup: boolean }) {
  return (
    <section dir="rtl" className="relative hidden min-h-0 overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br from-[#eef4fb] via-[#f8fbff] to-[#e6eef8] shadow-[0_20px_55px_rgba(61,87,116,.11)] dark:border-white/[.08] dark:from-[#07182a] dark:via-[#081d33] dark:to-[#061526] xl:block">
      <NetworkBackground />
      <div className="relative z-10 flex h-full min-h-[calc(100dvh-32px)] flex-col p-[clamp(24px,2.4vw,42px)]">
        {signup ? (
          <>
            <div className="shrink-0">
              <Brand />
              <div className="mt-5 text-center">
                <h2 className="text-[clamp(24px,2vw,34px)] font-black leading-tight text-[#0e316d] dark:text-white">منصة <span className="text-[#086ef1]">LORD</span> لإدارة أجهزة NAS</h2>
                <p className="mx-auto mt-3 max-w-[600px] text-[13px] leading-7 text-slate-600 dark:text-slate-300">إدارة سهلة واحترافية لأجهزتك ومشتركيك وجلسات الإنترنت في مكان واحد وبأعلى مستوى من الأمان والكفاءة.</p>
              </div>
            </div>
            <div className="mt-6 grid min-h-0 flex-1 grid-cols-[minmax(230px,.86fr)_minmax(260px,1.14fr)] items-center gap-5">
              <div className="space-y-3">
                <FeatureCard title="إدارة شاملة" text="تحكم كامل بأجهزة NAS والمشتركين والجلسات في مكان واحد" icon={Server} tone="from-[#1684ff] to-[#0757e8]" />
                <FeatureCard title="تقارير ذكية" text="تقارير مفصلة ورسوم بيانية لمراقبة الأداء والاستخدام" icon={BarChart3} tone="from-[#ffb536] to-[#f29600]" />
                <FeatureCard title="أمان متقدم" text="حماية متقدمة للبيانات مع نظام صلاحيات متكامل" icon={ShieldCheck} tone="from-[#24b77e] to-[#0a8d5b]" />
                <FeatureCard title="تنبيهات فورية" text="تنبيهات فورية لأي أحداث مهمة في الشبكة" icon={Radio} tone="from-[#875dff] to-[#6334e3]" />
              </div>
              <ServerIllustration large />
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center">
            <Brand />
            <div className="mt-8 w-full max-w-[520px]">
              <ServerIllustration large />
            </div>
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-28 overflow-hidden" aria-hidden="true">
        <div className="absolute -bottom-16 -left-12 h-36 w-[72%] rotate-6 rounded-[50%] bg-[#0b4bc6]" />
        <div className="absolute -bottom-20 left-[10%] h-36 w-[82%] -rotate-3 rounded-[50%] bg-[#07379e]" />
        <div className="absolute -bottom-20 left-[2%] h-24 w-[45%] rotate-12 rounded-[50%] bg-[#ffad16]" />
      </div>
    </section>
  );
}

function Field({ label, icon: Icon, type = "text", value, onChange, placeholder, suffix }: FieldProps) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[12px] font-bold text-[#17386d] dark:text-slate-200">{label}</span>
      <div className="relative">
        <Icon className="absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full min-w-0 rounded-[12px] border border-[#cad9e8] bg-white pr-11 pl-11 text-[13px] text-[#17386d] outline-none transition placeholder:text-slate-400 focus:border-[#3d8df4] focus:ring-4 focus:ring-[#147bff]/10 dark:border-[#304861] dark:bg-[#091c30] dark:text-white dark:placeholder:text-slate-500 sm:h-12"
        />
        {suffix}
      </div>
    </label>
  );
}

function Steps() {
  const labels = ["المعلومات الأساسية", "معلومات إضافية", "تأكيد الحساب"];
  return (
    <div className="mx-auto mt-5 grid max-w-[520px] grid-cols-3 items-start gap-2">
      {labels.map((label, index) => (
        <div key={label} className="relative text-center">
          {index < 2 && <span className="absolute left-[-50%] top-4 h-px w-full bg-[#cbd9e7] dark:bg-[#3b526b]" />}
          <div className={`relative z-10 mx-auto grid h-8 w-8 place-items-center rounded-full border text-xs font-bold ${index === 0 ? "border-[#0d6ef0] bg-[#0d6ef0] text-white" : "border-[#bccde0] bg-white text-slate-500 dark:border-[#425870] dark:bg-[#0b2036] dark:text-slate-300"}`}>{index + 1}</div>
          <div className={`mt-2 truncate text-[10px] sm:text-[11px] ${index === 0 ? "font-semibold text-[#0d6ef0]" : "text-slate-500 dark:text-slate-400"}`}>{label}</div>
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
  const [promo, setPromo] = useState("");
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
        setMessage("يرجى تعبئة جميع الحقول المطلوبة.");
        return;
      }
      if (password !== confirm) {
        setMessage("كلمتا المرور غير متطابقتين.");
        return;
      }
      if (!terms) {
        setMessage("يرجى الموافقة على الشروط والأحكام وسياسة الخصوصية.");
        return;
      }
      setMessage("واجهة إنشاء الحساب جاهزة للربط بخدمة التسجيل الخلفية.");
      return;
    }

    if (!email || !password) {
      setMessage("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
      return;
    }

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

  return (
    <main dir="rtl" className="min-h-dvh overflow-x-hidden bg-[#dce5ef] p-2 text-[#102a63] transition-colors dark:bg-[#061526] dark:text-slate-100 sm:p-3 lg:p-4">
      <div dir="ltr" className="mx-auto grid min-h-[calc(100dvh-16px)] max-w-[1540px] grid-cols-1 gap-3 sm:min-h-[calc(100dvh-24px)] lg:min-h-[calc(100dvh-32px)] xl:grid-cols-[1fr_1fr] xl:gap-4">
        <InfoPanel signup={signup} />

        <section dir="rtl" className="flex min-w-0 items-center justify-center rounded-[24px] border border-white/80 bg-[#fbfdff]/95 px-4 py-5 shadow-[0_20px_55px_rgba(61,87,116,.11)] dark:border-white/[.08] dark:bg-[#0a1f35]/96 dark:shadow-[0_20px_55px_rgba(0,0,0,.24)] sm:px-7 sm:py-7 xl:rounded-[28px] xl:px-[clamp(30px,3vw,56px)] xl:py-6">
          <div className="w-full max-w-[640px]">
            <div className="mb-5 xl:hidden"><Brand compact /></div>

            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#eaf3ff] text-[#086df0] dark:bg-[#102b49] dark:text-[#4a9fff] sm:h-16 sm:w-16">
                {signup ? <UserRound className="h-7 w-7" /> : <UserRound className="h-7 w-7" />}
              </div>
              <h1 className="mt-3 text-[26px] font-black leading-tight sm:text-[30px]">{signup ? "إنشاء حساب جديد" : "تسجيل الدخول"}</h1>
              <p className="mx-auto mt-2 max-w-lg text-[12px] leading-6 text-slate-500 dark:text-slate-400 sm:text-[13px]">{signup ? "أنشئ حسابك الآن وابدأ إدارة أجهزتك ومشتركيك بسهولة وأمان" : "مرحباً بك، يرجى تسجيل الدخول للوصول إلى لوحة التحكم"}</p>
            </div>

            {signup && <Steps />}

            <form onSubmit={submit} className={`${signup ? "mt-5" : "mt-7"} space-y-3`}>
              {signup && <Field label="الاسم الكامل *" icon={UserRound} value={fullName} onChange={setFullName} placeholder="أدخل اسمك الكامل" />}
              <Field label="البريد الإلكتروني *" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="أدخل بريدك الإلكتروني" />

              {signup && (
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-bold text-[#17386d] dark:text-slate-200">رقم الهاتف *</span>
                  <div className="flex h-11 overflow-hidden rounded-[12px] border border-[#cad9e8] bg-white dark:border-[#304861] dark:bg-[#091c30] sm:h-12">
                    <div className="flex shrink-0 items-center gap-2 border-l border-[#cad9e8] px-3 text-[12px] dark:border-[#304861] sm:px-4">
                      <span>🇮🇶</span><span>+964</span>
                    </div>
                    <div className="relative min-w-0 flex-1">
                      <Phone className="absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                      <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="أدخل رقم الهاتف" className="h-full w-full min-w-0 bg-transparent pr-11 pl-3 text-[13px] outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500" />
                    </div>
                  </div>
                </label>
              )}

              <Field
                label="كلمة المرور *"
                icon={LockKeyhole}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={setPassword}
                placeholder="أدخل كلمة المرور"
                suffix={<button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-label="إظهار كلمة المرور">{showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}</button>}
              />

              {signup && (
                <>
                  <Field
                    label="تأكيد كلمة المرور *"
                    icon={LockKeyhole}
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={setConfirm}
                    placeholder="أعد إدخال كلمة المرور"
                    suffix={<button type="button" onClick={() => setShowConfirm((value) => !value)} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-label="إظهار تأكيد كلمة المرور">{showConfirm ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}</button>}
                  />
                  <Field label="المجاز التعريفي (اختياري)" icon={ShieldCheck} value={promo} onChange={setPromo} placeholder="أدخل المجاز التعريفي إن كان لديك" />
                </>
              )}

              {!signup && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[12px]">
                  <label className="flex cursor-pointer items-center gap-2 text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#0d6ef0]" />
                    تذكرني
                  </label>
                  <button type="button" className="font-semibold text-[#0874f9]">نسيت كلمة المرور؟</button>
                </div>
              )}

              {signup && (
                <label className="flex cursor-pointer items-start gap-2 pt-0.5 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#0d6ef0]" />
                  <span>أوافق على <button type="button" className="font-semibold text-[#0874f9]">الشروط والأحكام وسياسة الخصوصية</button></span>
                </label>
              )}

              {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-400/15 dark:bg-amber-500/10 dark:text-amber-200">{message}</div>}

              <button type="submit" className="h-11 w-full rounded-[11px] bg-gradient-to-r from-[#075be8] to-[#0a6ff1] text-sm font-bold text-white shadow-[0_10px_22px_rgba(13,110,240,.20)] transition hover:brightness-105 sm:h-12">
                {signup ? "التالي" : "تسجيل الدخول"}
              </button>

              <div className="flex items-center gap-3 py-0.5 text-[11px] text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /><span>أو</span><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /></div>

              <button type="button" className="flex h-11 w-full items-center justify-center gap-3 rounded-[11px] border border-[#cad9e8] bg-white text-[13px] font-bold text-[#17386d] transition hover:bg-slate-50 dark:border-[#304861] dark:bg-[#091c30] dark:text-white dark:hover:bg-[#102943] sm:h-12">
                <span className="grid h-5 w-5 place-items-center rounded-full font-black text-[#4285f4]">G</span>
                {signup ? "إنشاء حساب باستخدام Google" : "تسجيل الدخول باستخدام Google"}
              </button>

              <div className="pt-1 text-center text-[12px] text-slate-500 dark:text-slate-400">
                {signup ? <>لديك حساب بالفعل؟ <Link href="/login" className="mr-2 font-bold text-[#0874f9]">تسجيل الدخول</Link></> : <>ليس لديك حساب؟ <Link href="/signup" className="mr-2 font-bold text-[#0874f9]">إنشاء حساب جديد</Link></>}
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
