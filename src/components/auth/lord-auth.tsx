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
      <div className={`relative mx-auto grid place-items-center ${compact ? "h-12 w-12" : "h-[74px] w-[74px] 2xl:h-[86px] 2xl:w-[86px]"}`}>
        <svg viewBox="0 0 96 68" className={compact ? "h-9 w-12" : "h-12 w-[72px] 2xl:h-14 2xl:w-20"} aria-hidden="true">
          <path d="M8 51 16 15l19 17L48 7l13 25 19-17 8 36Z" fill="#ffad16" />
          <circle cx="16" cy="12" r="5" fill="#0b3b82" />
          <circle cx="48" cy="5" r="5" fill="#0b3b82" />
          <circle cx="80" cy="12" r="5" fill="#0b3b82" />
        </svg>
        <Radio className={`absolute bottom-0 text-[#0c63dc] ${compact ? "h-6 w-6" : "h-8 w-8 2xl:h-9 2xl:w-9"}`} strokeWidth={2.4} />
      </div>
      <div className={`${compact ? "mt-1 text-3xl" : "mt-2 text-[40px] 2xl:text-[48px]"} font-black leading-none tracking-tight text-[#0c3272] dark:text-white`}>LORD</div>
      <div className={`${compact ? "mt-1 text-xs" : "mt-1.5 text-lg 2xl:text-xl"} font-extrabold tracking-[.06em] text-[#f2a000]`}>RADIUS LORD</div>
    </div>
  );
}

function NetworkBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-55 dark:opacity-25" aria-hidden="true">
      <svg viewBox="0 0 900 900" className="h-full w-full">
        <g stroke="#4d91ef" strokeOpacity=".18" fill="none" strokeWidth="1.2">
          <path d="M30 280 170 220l130 90 120-115 145 82 135-92 155 110" />
          <path d="M45 560 180 455l130 84 110-94 155 75 135-110 140 82" />
          <path d="M85 725 240 620l125 78 140-110 145 70 120-70" />
        </g>
        {[[30,280],[170,220],[300,310],[420,195],[565,277],[700,185],[855,295],[45,560],[180,455],[310,539],[420,445],[575,520],[710,410],[850,492],[85,725],[240,620],[365,698],[505,588],[650,658],[770,588]].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="5" fill="#3b82f6" fillOpacity=".24" />)}
      </svg>
    </div>
  );
}

function ServerIllustration({ signup = false }: { signup?: boolean }) {
  return (
    <div className={`relative mx-auto w-full ${signup ? "h-[clamp(230px,34vh,340px)] max-w-[430px]" : "h-[clamp(250px,39vh,390px)] max-w-[470px]"}`} aria-hidden="true">
      <div className="absolute bottom-3 left-1/2 h-12 w-[82%] -translate-x-1/2 rounded-[50%] bg-[#2f6fc8]/15 blur-xl dark:bg-black/30" />
      <div className="absolute bottom-[12%] left-1/2 w-[58%] -translate-x-1/2 space-y-[clamp(5px,.8vh,10px)]">
        {[0,1,2,3].map((item) => (
          <div key={item} className="flex h-[clamp(40px,6vh,57px)] items-center rounded-[16px] border border-[#7da5d6]/35 bg-gradient-to-r from-[#dbe8f8] to-[#b8cee9] px-4 shadow-[0_10px_24px_rgba(23,66,120,.14)] dark:border-[#486586]/45 dark:from-[#1b3556] dark:to-[#102845]">
            <span className={`h-2.5 w-2.5 rounded-full ${item === 1 ? "bg-[#ffad16]" : "bg-emerald-500"}`} />
            <span className="mr-3 h-2 flex-1 rounded-full bg-[#6d91bd]/55 dark:bg-[#58789c]/60" />
          </div>
        ))}
      </div>
      <div className="absolute bottom-[10%] left-[12%] grid h-[clamp(105px,15vh,145px)] w-[clamp(88px,9vw,116px)] place-items-center rounded-[38%_38%_45%_45%/32%_32%_62%_62%] border-[7px] border-white bg-gradient-to-b from-[#187bff] to-[#063fbf] text-white shadow-[0_18px_32px_rgba(12,83,197,.30)] dark:border-[#dce8f8]">
        <LockKeyhole className="h-12 w-12" strokeWidth={1.9} />
      </div>
      <div className={`absolute right-[4%] top-[3%] rounded-[18px] border border-[#a9c3e4] bg-white/82 p-4 shadow-[0_16px_30px_rgba(43,77,119,.12)] dark:border-[#314d6d] dark:bg-[#102641]/85 ${signup ? "h-[clamp(105px,15vh,145px)] w-[clamp(150px,13vw,195px)]" : "hidden"}`}>
        <div className="h-2.5 w-20 rounded-full bg-[#0d6ef0]/25" />
        <div className="mt-4 flex h-14 items-end gap-2">
          {[28,44,34,58,48].map((height, index) => <span key={index} className="w-5 rounded-t-md bg-[#0d73ef]" style={{height}} />)}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, text, icon: Icon, tone }: { title: string; text: string; icon: IconType; tone: string }) {
  return (
    <div className="flex min-h-[clamp(66px,8.7vh,92px)] items-center gap-3 rounded-[16px] border border-white/90 bg-white/90 px-3.5 py-2.5 shadow-[0_9px_22px_rgba(49,78,112,.07)] dark:border-white/[.08] dark:bg-[#0d243b]/92">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-gradient-to-br ${tone} text-white shadow-sm`}><Icon className="h-5 w-5" /></div>
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-[#10336f] dark:text-white 2xl:text-[15px]">{title}</div>
        <div className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400 2xl:text-[11px] 2xl:leading-5">{text}</div>
      </div>
    </div>
  );
}

function VisualPanel({ signup }: { signup: boolean }) {
  return (
    <section className="relative hidden h-full min-h-0 overflow-hidden border-l border-white/60 bg-gradient-to-br from-[#eef4fb] via-[#f8fbff] to-[#e6eef8] dark:border-white/[.06] dark:from-[#07182a] dark:via-[#081d33] dark:to-[#061526] lg:block">
      <NetworkBackground />
      <div className="relative z-10 flex h-full min-h-0 flex-col px-[clamp(24px,3vw,56px)] py-[clamp(22px,3vh,40px)]">
        {signup ? (
          <>
            <div className="shrink-0 text-center">
              <Brand />
              <h2 className="mt-[clamp(14px,2vh,24px)] text-[clamp(23px,2vw,34px)] font-black leading-tight text-[#0e316d] dark:text-white">منصة <span className="text-[#086ef1]">LORD</span> لإدارة أجهزة NAS</h2>
              <p className="mx-auto mt-2 max-w-[600px] text-[clamp(11px,.8vw,13px)] leading-6 text-slate-600 dark:text-slate-300">إدارة سهلة واحترافية لأجهزتك ومشتركيك وجلسات الإنترنت في مكان واحد وبأعلى مستوى من الأمان والكفاءة.</p>
            </div>
            <div className="mt-[clamp(12px,1.8vh,24px)] grid min-h-0 flex-1 grid-cols-[minmax(210px,.82fr)_minmax(250px,1.18fr)] items-center gap-4">
              <div className="space-y-[clamp(7px,1vh,12px)]">
                <FeatureCard title="إدارة شاملة" text="تحكم كامل بأجهزة NAS والمشتركين والجلسات في مكان واحد" icon={Server} tone="from-[#1684ff] to-[#0757e8]" />
                <FeatureCard title="تقارير ذكية" text="تقارير مفصلة ورسوم بيانية لمراقبة الأداء والاستخدام" icon={BarChart3} tone="from-[#ffb536] to-[#f29600]" />
                <FeatureCard title="أمان متقدم" text="حماية متقدمة للبيانات مع نظام صلاحيات متكامل" icon={ShieldCheck} tone="from-[#24b77e] to-[#0a8d5b]" />
                <FeatureCard title="تنبيهات فورية" text="تنبيهات فورية لأي أحداث مهمة في الشبكة" icon={Radio} tone="from-[#875dff] to-[#6334e3]" />
              </div>
              <ServerIllustration signup />
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center pb-[4vh]">
            <Brand />
            <div className="mt-[clamp(22px,4vh,46px)] w-full"><ServerIllustration /></div>
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[13%] overflow-hidden" aria-hidden="true">
        <div className="absolute -bottom-[55%] -left-[8%] h-full w-[78%] rotate-6 rounded-[50%] bg-[#0b4bc6]" />
        <div className="absolute -bottom-[60%] left-[8%] h-full w-[84%] -rotate-3 rounded-[50%] bg-[#07379e]" />
        <div className="absolute -bottom-[58%] left-[2%] h-[70%] w-[46%] rotate-12 rounded-[50%] bg-[#ffad16]" />
      </div>
    </section>
  );
}

function Field({ label, icon: Icon, type = "text", value, onChange, placeholder, suffix }: FieldProps) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[12px] font-bold text-[#17386d] dark:text-slate-200 2xl:text-[13px]">{label}</span>
      <div className="relative">
        <Icon className="absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-[clamp(40px,5.4vh,50px)] w-full min-w-0 rounded-[11px] border border-[#cbd9e8] bg-white pr-11 pl-11 text-[13px] text-[#17386d] outline-none transition placeholder:text-slate-400 focus:border-[#3d8df4] focus:ring-4 focus:ring-[#147bff]/10 dark:border-[#304861] dark:bg-[#091c30] dark:text-white dark:placeholder:text-slate-500"
        />
        {suffix}
      </div>
    </label>
  );
}

function Steps() {
  const labels = ["المعلومات الأساسية", "معلومات إضافية", "تأكيد الحساب"];
  return (
    <div className="mx-auto mt-[clamp(10px,1.8vh,20px)] grid max-w-[520px] grid-cols-3 items-start gap-2">
      {labels.map((label, index) => (
        <div key={label} className="relative text-center">
          {index < 2 && <span className="absolute left-[-50%] top-4 h-px w-full bg-[#cbd9e7] dark:bg-[#3b526b]" />}
          <div className={`relative z-10 mx-auto grid h-8 w-8 place-items-center rounded-full border text-xs font-bold ${index === 0 ? "border-[#0d6ef0] bg-[#0d6ef0] text-white" : "border-[#bccde0] bg-white text-slate-500 dark:border-[#425870] dark:bg-[#0b2036] dark:text-slate-300"}`}>{index + 1}</div>
          <div className={`mt-1.5 truncate text-[10px] 2xl:text-[11px] ${index === 0 ? "font-semibold text-[#0d6ef0]" : "text-slate-500 dark:text-slate-400"}`}>{label}</div>
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
      if (!fullName || !email || !phone || !password || !confirm) return setMessage("يرجى تعبئة جميع الحقول المطلوبة.");
      if (password !== confirm) return setMessage("كلمتا المرور غير متطابقتين.");
      if (!terms) return setMessage("يرجى الموافقة على الشروط والأحكام وسياسة الخصوصية.");
      return setMessage("واجهة إنشاء الحساب جاهزة للربط بخدمة التسجيل الخلفية.");
    }
    if (!email || !password) return setMessage("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ username: email, password }) });
      const data = await res.json();
      if (res.ok && data.success) window.location.href = "/Dashboard";
      else setMessage(data.message || "فشل تسجيل الدخول.");
    } catch {
      setMessage("تعذر الاتصال بالخادم.");
    }
  };

  const eyeButton = (visible: boolean, toggle: () => void) => (
    <button type="button" onClick={toggle} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-label="إظهار كلمة المرور">{visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
  );

  return (
    <main dir="rtl" className="min-h-screen bg-[#e8eef5] p-2 text-[#102a63] transition-colors dark:bg-[#061526] dark:text-slate-100 sm:p-3 lg:h-screen lg:min-h-[640px] lg:overflow-hidden" style={{ fontFamily: "LBC, Tahoma, Arial, sans-serif" }}>
      <div dir="ltr" className="mx-auto grid min-h-[calc(100vh-16px)] max-w-[1540px] overflow-hidden rounded-[24px] border border-white/80 bg-[#f8fbff] shadow-[0_18px_55px_rgba(58,84,112,.14)] dark:border-white/[.08] dark:bg-[#081b2f] lg:h-[calc(100vh-16px)] lg:min-h-[624px] lg:grid-cols-2 sm:min-h-[calc(100vh-24px)] sm:rounded-[28px] lg:max-h-[1080px]">
        <VisualPanel signup={signup} />

        <section dir="rtl" className="relative flex min-h-0 items-center justify-center bg-white/92 px-[clamp(16px,3.2vw,58px)] py-[clamp(18px,2.8vh,34px)] dark:bg-[#0a1f35]/96">
          <div className={`w-full ${signup ? "max-w-[620px]" : "max-w-[560px]"}`}>
            <div className="mb-5 lg:hidden"><Brand compact /></div>

            <div className="text-center">
              <div className="mx-auto grid h-[clamp(50px,7vh,66px)] w-[clamp(50px,7vh,66px)] place-items-center rounded-full bg-[#eaf2ff] text-[#086df0] dark:bg-[#102d4d] dark:text-[#4da0ff]">
                {signup ? <UserRound className="h-7 w-7" /> : <LockKeyhole className="h-7 w-7" />}
              </div>
              <h1 className="mt-[clamp(10px,1.6vh,18px)] text-[clamp(25px,2vw,34px)] font-black leading-tight">{signup ? "إنشاء حساب جديد" : "تسجيل الدخول"}</h1>
              <p className="mt-1.5 text-[clamp(11px,.8vw,13px)] text-slate-500 dark:text-slate-400">{signup ? "أنشئ حسابك الآن وابدأ إدارة أجهزتك ومشتركيك بسهولة وأمان" : "مرحباً بك، يرجى تسجيل الدخول للوصول إلى لوحة التحكم"}</p>
            </div>

            {signup && <Steps />}

            <form onSubmit={submit} className={`${signup ? "mt-[clamp(10px,1.6vh,18px)] space-y-[clamp(6px,.8vh,10px)]" : "mt-[clamp(22px,4vh,46px)] space-y-[clamp(16px,2.2vh,26px)]"}`}>
              {signup && <Field label="الاسم الكامل *" icon={UserRound} value={fullName} onChange={setFullName} placeholder="أدخل اسمك الكامل" />}
              <Field label="البريد الإلكتروني *" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="أدخل بريدك الإلكتروني" />
              {signup && (
                <label className="block min-w-0">
                  <span className="mb-1 block text-[12px] font-bold text-[#17386d] dark:text-slate-200 2xl:text-[13px]">رقم الهاتف *</span>
                  <div className="flex h-[clamp(40px,5.4vh,50px)] overflow-hidden rounded-[11px] border border-[#cbd9e8] bg-white dark:border-[#304861] dark:bg-[#091c30]" dir="ltr">
                    <div className="flex w-[118px] shrink-0 items-center justify-center gap-2 border-r border-[#cbd9e8] text-xs font-semibold text-[#17386d] dark:border-[#304861] dark:text-slate-200">🇮🇶 <span>+964</span></div>
                    <div className="relative min-w-0 flex-1" dir="rtl"><Phone className="absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" /><input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="أدخل رقم الهاتف" className="h-full w-full bg-transparent pr-11 pl-4 text-[13px] outline-none placeholder:text-slate-400 dark:text-white" /></div>
                  </div>
                </label>
              )}
              <Field label="كلمة المرور *" icon={LockKeyhole} type={showPassword ? "text" : "password"} value={password} onChange={setPassword} placeholder="أدخل كلمة المرور" suffix={eyeButton(showPassword, () => setShowPassword((v)=>!v))} />
              {signup && <Field label="تأكيد كلمة المرور *" icon={LockKeyhole} type={showConfirm ? "text" : "password"} value={confirm} onChange={setConfirm} placeholder="أعد إدخال كلمة المرور" suffix={eyeButton(showConfirm, () => setShowConfirm((v)=>!v))} />}
              {signup && <Field label="المجاز التعريفي (اختياري)" icon={ShieldCheck} value={promo} onChange={setPromo} placeholder="أدخل المجاز التعريفي إن كان لديك" />}

              {!signup && (
                <div className="flex items-center justify-between text-[12px] sm:text-[13px]">
                  <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><input type="checkbox" checked={remember} onChange={(e)=>setRemember(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#0d6ef0]" />تذكرني</label>
                  <button type="button" className="font-semibold text-[#0874f9]">نسيت كلمة المرور؟</button>
                </div>
              )}

              {signup && (
                <label className="flex items-start gap-2 text-[10px] leading-5 text-slate-600 dark:text-slate-300 2xl:text-[11px]"><input type="checkbox" checked={terms} onChange={(e)=>setTerms(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded accent-[#0d6ef0]" /><span>أوافق على <button type="button" className="font-semibold text-[#0874f9]">الشروط والأحكام وسياسة الخصوصية</button></span></label>
              )}

              {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-400/15 dark:bg-amber-500/10 dark:text-amber-300">{message}</div>}

              <button type="submit" className="flex h-[clamp(42px,5.7vh,52px)] w-full items-center justify-center gap-3 rounded-[11px] bg-gradient-to-l from-[#0d6ef0] to-[#0647d9] text-[14px] font-bold text-white shadow-[0_10px_24px_rgba(13,110,240,.20)] transition hover:brightness-105">{signup ? "التالي" : "تسجيل الدخول"}<span aria-hidden="true">←</span></button>

              <div className="flex items-center gap-3 text-[11px] text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />أو<span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /></div>
              <button type="button" className="flex h-[clamp(42px,5.7vh,52px)] w-full items-center justify-center gap-3 rounded-[11px] border border-[#cbd9e8] bg-white text-[13px] font-bold text-[#17386d] dark:border-[#304861] dark:bg-[#091c30] dark:text-white"><span className="text-lg font-black text-[#4285f4]">G</span>{signup ? "إنشاء حساب باستخدام Google" : "تسجيل الدخول باستخدام Google"}</button>

              <div className="text-center text-[12px] text-slate-500 dark:text-slate-400">{signup ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"} <Link href={signup ? "/login" : "/signup"} className="mr-2 font-bold text-[#0874f9]">{signup ? "تسجيل الدخول" : "إنشاء حساب جديد"}</Link></div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
