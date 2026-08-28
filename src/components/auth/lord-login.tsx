"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Radio, UserRound } from "lucide-react";
import { CompactField, PrimaryFormButton, SecondaryFormButton } from "@/components/ui/auth-form-controls";

function Brand() {
  return (
    <div className="text-center" dir="ltr">
      <div className="relative mx-auto grid h-[58px] w-[78px] place-items-center">
        <svg viewBox="0 0 96 68" className="h-[48px] w-[72px]" aria-hidden="true">
          <path d="M8 51 16 15l19 17L48 7l13 25 19-17 8 36Z" fill="#ffad16" />
          <circle cx="16" cy="12" r="5" fill="#0b3b82" />
          <circle cx="48" cy="5" r="5" fill="#0b3b82" />
          <circle cx="80" cy="12" r="5" fill="#0b3b82" />
        </svg>
        <Radio className="absolute bottom-0 h-7 w-7 text-[#0c63dc]" strokeWidth={2.4} />
      </div>
      <div className="mt-1 text-[34px] font-black leading-none tracking-tight text-[#0c3272] dark:text-white">LORD</div>
      <div className="mt-1 text-[13px] font-extrabold tracking-[.06em] text-[#f2a000]">RADIUS LORD</div>
    </div>
  );
}

function LoginBackground() {
  const nodes = [
    [74,118],[142,78],[221,142],[306,101],[354,194],[94,292],[185,244],[278,318],[338,270],[56,506],[136,558],[225,492],[318,574],[92,734],[194,680],[284,752],
    [1528,104],[1442,166],[1364,92],[1288,184],[1542,300],[1458,246],[1370,328],[1276,278],[1554,520],[1470,584],[1384,512],[1282,602],[1518,746],[1428,688],[1328,770],
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="login-orb login-orb-a" />
      <div className="login-orb login-orb-b" />
      <div className="login-dot-grid" />
      <svg viewBox="0 0 1600 900" className="login-network absolute inset-0 h-full w-full opacity-55 dark:opacity-30">
        <g fill="none" stroke="#5b8fd6" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
          <path d="M0 174 L74 118 L142 78 L221 142 L306 101 L354 194" opacity=".70" />
          <path d="M0 326 L94 292 L185 244 L278 318 L338 270" opacity=".54" />
          <path d="M0 472 L56 506 L136 558 L225 492 L318 574" opacity=".62" />
          <path d="M0 786 L92 734 L194 680 L284 752 L365 706" opacity=".48" />
          <path d="M142 78 L185 244 M221 142 L278 318 M136 558 L194 680" opacity=".32" />
          <path d="M1600 152 L1528 104 L1442 166 L1364 92 L1288 184" opacity=".64" />
          <path d="M1600 340 L1542 300 L1458 246 L1370 328 L1276 278" opacity=".53" />
          <path d="M1600 486 L1554 520 L1470 584 L1384 512 L1282 602" opacity=".60" />
          <path d="M1600 790 L1518 746 L1428 688 L1328 770 L1246 718" opacity=".46" />
          <path d="M1442 166 L1458 246 M1370 328 L1384 512 M1470 584 L1428 688" opacity=".30" />
        </g>
        <g fill="#7ca4dc" opacity=".82">
          {nodes.map(([cx, cy], index) => <circle key={index} cx={cx} cy={cy} r={index % 4 === 0 ? "4.6" : "3.6"} />)}
        </g>
      </svg>
    </div>
  );
}

export default function LordLogin() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (!identifier || !password) return setMessage("يرجى إدخال اسم المستخدم أو البريد الإلكتروني وكلمة المرور.");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: identifier, password }),
      });
      const data = await response.json();
      if (response.ok && data.success) window.location.href = "/Dashboard";
      else setMessage(data.message || "فشل تسجيل الدخول.");
    } catch {
      setMessage("تعذر الاتصال بالخادم.");
    }
  };

  return (
    <main dir="rtl" className="relative min-h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_10%_18%,rgba(73,145,235,.25),transparent_30%),radial-gradient(circle_at_88%_82%,rgba(255,176,43,.11),transparent_26%),linear-gradient(135deg,#e4edf8_0%,#f5f8fc_48%,#e9f0f7_100%)] text-[#102a63] dark:bg-[radial-gradient(circle_at_12%_24%,rgba(35,104,186,.24),transparent_32%),radial-gradient(circle_at_88%_84%,rgba(196,126,28,.10),transparent_28%),linear-gradient(135deg,#04111f_0%,#071a2d_52%,#0a2239_100%)] dark:text-slate-100" style={{ fontFamily: "LBC, Tahoma, Arial, sans-serif" }}>
      <LoginBackground />

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center p-4 sm:p-6">
        <section className="w-full max-w-[470px] rounded-[26px] border border-white/85 bg-white/95 px-6 py-8 shadow-[0_24px_70px_rgba(58,84,112,.18)] backdrop-blur-md dark:border-white/[.08] dark:bg-[#081b2f]/96 sm:px-9 sm:py-10">
          <Brand />

          <div className="mt-6 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#eaf2ff] text-[#086df0] dark:bg-[#102d4d] dark:text-[#4da0ff]">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h1 className="mt-3 text-[25px] font-black">تسجيل الدخول</h1>
            <p className="mx-auto mt-1.5 text-[11px] leading-5 text-slate-500 dark:text-slate-400">أدخل اسم المستخدم أو البريد الإلكتروني للوصول إلى حسابك</p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <CompactField
              label="اسم المستخدم أو البريد الإلكتروني *"
              icon={UserRound}
              value={identifier}
              onChange={setIdentifier}
              placeholder="أدخل اسم المستخدم أو البريد الإلكتروني"
            />

            <CompactField
              label="كلمة المرور *"
              icon={LockKeyhole}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={setPassword}
              placeholder="أدخل كلمة المرور"
              suffix={(
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            />

            {message && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-700 dark:border-amber-400/15 dark:bg-amber-500/10 dark:text-amber-300">{message}</div>}

            <PrimaryFormButton>تسجيل الدخول <span>←</span></PrimaryFormButton>

            <div className="flex items-center gap-3 text-[9px] text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />أو<span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /></div>

            <SecondaryFormButton><span className="text-sm font-black text-[#4285f4]">G</span> تسجيل الدخول باستخدام Google</SecondaryFormButton>

            <div className="text-center text-[10px] text-slate-500 dark:text-slate-400">ليس لديك حساب؟ <Link href="/signup" className="mr-2 font-bold text-[#0874f9]">إنشاء حساب جديد</Link></div>
          </form>
        </section>
      </div>

      <style jsx global>{`
        @keyframes loginFloatA { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(18px,-12px,0)} }
        @keyframes loginFloatB { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(-20px,15px,0)} }
        @keyframes loginNetwork { 0%,100%{transform:translate3d(0,0,0)} 35%{transform:translate3d(7px,-5px,0)} 70%{transform:translate3d(-4px,4px,0)} }
        .login-orb{position:absolute;border-radius:999px;filter:blur(90px);opacity:.14;will-change:transform}
        .login-orb-a{width:300px;height:300px;background:#2687ff;left:-95px;top:8%;animation:loginFloatA 20s ease-in-out infinite}
        .login-orb-b{width:250px;height:250px;background:#ffad16;right:-95px;bottom:4%;opacity:.07;animation:loginFloatB 24s ease-in-out infinite}
        .login-dot-grid{position:absolute;inset:0;background-image:radial-gradient(circle,rgba(32,105,198,.34) 1.35px,transparent 1.5px);background-size:24px 24px;opacity:.23;mask-image:linear-gradient(90deg,#000 0%,#000 23%,transparent 38%,transparent 62%,#000 77%,#000 100%)}
        .dark .login-dot-grid{opacity:.15}
        .login-network{animation:loginNetwork 20s ease-in-out infinite;filter:drop-shadow(0 0 2px rgba(71,124,193,.14))}
        @media (prefers-reduced-motion: reduce){.login-orb,.login-network{animation:none!important}}
      `}</style>
    </main>
  );
}
