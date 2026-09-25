"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  CreditCard,
  Crown,
  ArrowLeft,
  Server,
  UserRound,
  Wifi,
} from "lucide-react";

const stats = [
  { label: "إجمالي المشتركين", value: "2,847", hint: "+36 هذا الشهر", icon: UserRound, tone: "blue" },
  { label: "الجلسات النشطة", value: "1,326", hint: "+12.5% هذا الشهر", icon: Wifi, tone: "amber" },
  { label: "NAS Online", value: "18 / 20", hint: "2 Offline", icon: Server, tone: "violet" },
  { label: "حركة المرور اليوم", value: "4.82 TB", hint: "↑ 2.72 TB  ↓ 2.1 TB", icon: Activity, tone: "orange" },
  { label: "الإيرادات اليوم", value: "$1,248.75", hint: "+8.3%", icon: CircleDollarSign, tone: "green" },
];

const toneMap: Record<string, string> = {
  blue: "from-[#1684ff] to-[#0757e8] text-white",
  amber: "from-[#ffbf55] to-[#f59d0a] text-white",
  violet: "from-[#8a5cff] to-[#6539e7] text-white",
  orange: "from-[#ff9a2f] to-[#e96512] text-white",
  green: "from-[#22b47a] to-[#0b8b5a] text-white",
};

const sessions = [
  ["Online", "ahmad01", "LORD-GHANTO", "192.168.10.21", "10M/10M", "10:24:12 AM", "00:45:21"],
  ["Online", "ali199", "LORD-CENTER", "192.168.20.54", "5M/5M", "10:23:45 AM", "01:15:33"],
  ["Online", "samer22", "LORD-NORTH", "192.168.30.17", "20M/20M", "10:22:31 AM", "00:33:10"],
  ["Offline", "mohamed88", "LORD-WEST", "192.168.40.88", "15M/15M", "10:20:15 AM", "—"],
  ["Online", "omar77", "LORD-CENTER", "192.168.20.77", "10M/10M", "10:18:09 AM", "02:11:44"],
];

const nas = [
  ["LORD-GHANTO", "192.168.10.1", true],
  ["LORD-CENTER", "192.168.20.1", true],
  ["LORD-NORTH", "192.168.30.1", true],
  ["LORD-WEST", "192.168.40.1", false],
  ["LORD-SOUTH", "192.168.50.1", true],
] as const;

const alerts = [
  ["ahmad01", "قام بتسجيل دخول", "منذ 2 دقيقة", "up"],
  ["LORD-WEST", "الجهاز غير متصل", "منذ 5 دقائق", "down"],
  ["20M/20M", "تم إنشاء باقة جديدة", "منذ 15 دقيقة", "info"],
  ["hassan15", "قام بتسجيل دخول", "منذ 22 دقيقة", "up"],
  ["LORD-NORTH", "الجهاز متصل", "منذ 30 دقيقة", "up"],
] as const;

function Sparkline({ color = "#1380ff" }: { color?: string }) {
  return (
    <svg viewBox="0 0 92 32" className="h-8 w-24" aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" points="2,25 12,20 20,24 29,12 38,21 46,7 57,18 66,13 74,23 90,6" />
    </svg>
  );
}

function TrafficChart() {
  return (
    <div className="mt-4 overflow-hidden rounded-[22px] bg-[#f6f9fc] p-3 dark:bg-[#0a1b2e]">
      <svg viewBox="0 0 620 250" className="h-auto w-full min-w-[520px]" role="img" aria-label="مخطط حركة الشبكة">
        {[45, 85, 125, 165, 205].map((y) => <line key={y} x1="45" y1={y} x2="600" y2={y} stroke="currentColor" className="text-slate-200 dark:text-[#20364c]" strokeWidth="1" />)}
        <polyline fill="none" stroke="#137dff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points="55,188 95,162 135,166 175,128 215,153 255,127 295,98 335,112 375,70 415,40 455,91 495,58 535,78 585,100" />
        <polyline fill="none" stroke="#ff9f0a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points="55,218 95,194 135,201 175,165 215,184 255,205 295,158 335,144 375,160 415,116 455,152 495,131 535,140 585,142" />
        {[55,95,135,175,215,255,295,335,375,415,455,495,535,585].map((x, i) => <circle key={x} cx={x} cy={[188,162,166,128,153,127,98,112,70,40,91,58,78,100][i]} r="4" fill="#137dff" />)}
      </svg>
      <div className="flex justify-center gap-6 text-xs text-slate-500 dark:text-slate-400"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#137dff]" />تحميل</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#ff9f0a]" />رفع</span></div>
    </div>
  );
}

function CustomerWelcome() {
  const { account } = useAuth();
  const fullName = account?.fullName?.trim() || "عميلنا";
  return <div className="customer-welcome relative -m-3 h-[calc(100dvh-110px)] overflow-hidden rounded-[22px] sm:-m-4" dir="rtl">
    <div className="customer-grid absolute inset-0" aria-hidden="true" />
    <div className="customer-glow absolute inset-0" aria-hidden="true" />
    <div className="customer-dots absolute inset-0" aria-hidden="true">{Array.from({length:18}).map((_,i)=><i key={i} style={{"--i":i} as React.CSSProperties}/>)}</div>
    <div className="relative z-10 flex h-[calc(100dvh-110px)] items-center justify-center px-5 py-4 sm:px-8">
      <section className="w-full max-w-[900px] text-center">
        <div className="welcome-reveal welcome-delay-1 mx-auto flex w-fit flex-col items-center text-center" dir="ltr"><div className="relative grid h-[68px] w-[68px] place-items-center rounded-[19px] bg-gradient-to-br from-[#1479ff] to-[#0758e9] shadow-[0_12px_30px_rgba(20,121,255,.24)]"><Crown className="h-9 w-9 text-[#ffad16]" strokeWidth={2.2}/><Wifi className="absolute bottom-1.5 h-[17px] w-[17px] text-white" strokeWidth={2.5}/></div><div className="mt-3 text-[30px] font-black leading-none tracking-tight text-[#102a63] dark:text-white">LORD</div><div className="mt-1 text-[12px] font-extrabold tracking-[.08em] text-[#e99100] dark:text-[#ffad16]">RADIUS LORD</div></div>
        <div className="welcome-reveal welcome-delay-2 mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-[#9fc4ec]/70 bg-white/70 px-4 py-2 text-xs font-semibold text-[#0758e9] shadow-sm backdrop-blur-xl dark:border-white/[.12] dark:bg-white/[.06] dark:text-[#8ab5ff]"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"/>مرحباً بك في LORD RADIUS</div>
        <h2 className="welcome-reveal welcome-delay-2 mt-4 text-3xl font-bold tracking-tight text-[#102a63] dark:text-white sm:text-5xl">أهلاً بك، <span className="text-[#0758e9]">{fullName}</span></h2>
        <p className="welcome-reveal welcome-delay-3 mx-auto mt-2 max-w-[650px] text-sm leading-8 text-slate-500 dark:text-slate-300 sm:text-base">نبدأ معك بخطوات بسيطة لتجهيز حسابك. اختر الخطة المناسبة، ثم تابع إعداد شبكتك والاستفادة من أدوات Radius Lord لإدارة خدمتك من مكان واحد.</p>
        <div className="welcome-reveal welcome-delay-4 mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/Dashboard/customer-plans" className="inline-flex h-12 min-w-[210px] items-center justify-center gap-2 rounded-[16px] bg-[#0758e9] px-6 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(7,88,233,.24)] transition hover:-translate-y-0.5 hover:bg-[#064dcc] hover:shadow-[0_16px_34px_rgba(7,88,233,.30)]">عرض الخطط المتاحة<CreditCard className="h-4 w-4"/></Link>
          <button type="button" onClick={()=>document.getElementById("radius-intro")?.scrollIntoView({behavior:"smooth",block:"center"})} className="inline-flex h-12 min-w-[210px] items-center justify-center gap-2 rounded-[16px] border border-[#a9c8e8] bg-white/70 px-6 text-sm font-semibold text-[#17386d] shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white dark:border-white/[.13] dark:bg-white/[.05] dark:text-slate-100 dark:hover:bg-white/[.09]">نبذة عن Radius Lord<ArrowLeft className="h-4 w-4"/></button>
        </div>
        <div id="radius-intro" className="welcome-reveal welcome-delay-5 mx-auto mt-6 grid max-w-[760px] gap-3 sm:grid-cols-3">
          {[["إدارة مركزية","إدارة شبكاتك وخدماتك من واجهة موحدة.",Server],["RADIUS متكامل","ربط NAS والمشتركين والسياسات بسهولة.",Wifi],["مرونة وتوسع","خطط مرنة تناسب نمو شبكتك واحتياجاتها.",Activity]].map(([title,text,Icon]:any)=><article key={title} className="rounded-[20px] border border-[#b9cfe4]/75 bg-white/65 p-4 text-right shadow-[0_10px_28px_rgba(58,84,112,.08)] backdrop-blur-xl transition hover:-translate-y-1 dark:border-white/[.09] dark:bg-white/[.045]"><span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.07] dark:text-[#8ab5ff]"><Icon className="h-5 w-5"/></span><h3 className="mt-3 text-sm font-semibold text-[#17386d] dark:text-white">{title}</h3><p className="mt-1.5 text-xs leading-6 text-slate-500 dark:text-slate-400">{text}</p></article>)}
        </div>
      </section>
    </div>
    <style jsx>{`
      .customer-welcome{background:linear-gradient(135deg,#f7fbff 0%,#edf5ff 45%,#f9fbfe 100%)}
      :global(.dark) .customer-welcome{background:linear-gradient(135deg,#17131b 0%,#211a25 50%,#17263a 100%)}
      .customer-grid{opacity:.62;background-image:linear-gradient(rgba(64,132,211,.17) 1px,transparent 1px),linear-gradient(90deg,rgba(64,132,211,.17) 1px,transparent 1px);background-size:38px 38px;transform:perspective(500px) rotateX(58deg) scale(1.35);transform-origin:center bottom;mask-image:linear-gradient(to bottom,transparent 3%,#000 35%,#000 80%,transparent)}
      .customer-glow{background:radial-gradient(circle at 50% 38%,rgba(20,121,255,.15),transparent 36%),radial-gradient(circle at 15% 80%,rgba(0,194,255,.08),transparent 22%)}
      .customer-dots i{position:absolute;width:6px;height:6px;border-radius:999px;background:#1479ff;opacity:.22;left:calc((var(--i) * 37)% 94% + 3%);top:calc((var(--i) * 53)% 82% + 8%);animation:floatDot calc(5s + (var(--i) % 5)*1s) ease-in-out infinite alternate}
      .welcome-reveal{opacity:0;transform:translateY(16px);animation:welcomeIn .72s cubic-bezier(.22,.8,.25,1) forwards}.welcome-delay-1{animation-delay:.08s}.welcome-delay-2{animation-delay:.18s}.welcome-delay-3{animation-delay:.30s}.welcome-delay-4{animation-delay:.42s}.welcome-delay-5{animation-delay:.56s}
      @keyframes welcomeIn{to{opacity:1;transform:translateY(0)}}@keyframes floatDot{to{transform:translate3d(12px,-18px,0);opacity:.5}}
      @media(prefers-reduced-motion:reduce){.welcome-reveal,.customer-dots i{animation:none;opacity:1;transform:none}}
    `}</style>
  </div>;
}

export default function HomePage() {
  const { accountType, loading } = useAuth();
  if (loading) return <div className="rl-surface rounded-[22px] bg-white p-8 text-center text-sm text-slate-500 dark:bg-[#0d243b]">جارٍ تحميل حسابك...</div>;
  if (accountType === "customer") return <CustomerWelcome />;
  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(({ label, value, hint, icon: Icon, tone }) => (
          <article key={label} className="rounded-[22px] border border-white/90 bg-white p-4 shadow-[0_8px_22px_rgba(58,84,112,.08)] dark:border-white/[.07] dark:bg-[#0d243b] dark:shadow-none">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-bold text-[#102a63] dark:text-white">{value}</p>
              </div>
              <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${toneMap[tone]}`}><Icon className="h-6 w-6" /></div>
            </div>
            <div className="mt-3 flex items-end justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400"><span>{hint}</span><Sparkline color={tone === "amber" || tone === "orange" ? "#ff9f0a" : tone === "green" ? "#16a66f" : tone === "violet" ? "#7449f5" : "#137dff"} /></div>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_.82fr_.9fr]">
        <article className="min-w-0 rounded-[24px] border border-white/90 bg-white p-4 shadow-[0_8px_22px_rgba(58,84,112,.08)] dark:border-white/[.07] dark:bg-[#0d243b] dark:shadow-none">
          <div className="flex items-center justify-between gap-3"><h2 className="font-bold">حركة الشبكة</h2><button className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">آخر 24 ساعة</button></div>
          <div className="overflow-x-auto"><TrafficChart /></div>
        </article>

        <article className="rounded-[24px] border border-white/90 bg-white p-4 shadow-[0_8px_22px_rgba(58,84,112,.08)] dark:border-white/[.07] dark:bg-[#0d243b] dark:shadow-none">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">حالة أجهزة NAS</h2><button className="text-xs font-semibold text-[#0874f9]">عرض الكل</button></div>
          <div className="divide-y divide-slate-100 dark:divide-white/[.07]">
            {nas.map(([name, ip, online]) => (
              <div key={name} className="flex items-center gap-3 py-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#edf4fb] dark:bg-white/[.05]"><Server className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{name}</div><div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{ip}</div></div>
                <span className={`flex items-center gap-1.5 text-[10px] ${online ? "text-emerald-600" : "text-red-500"}`}><i className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-red-500"}`} />{online ? "Online" : "Offline"}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[24px] border border-white/90 bg-white p-4 shadow-[0_8px_22px_rgba(58,84,112,.08)] dark:border-white/[.07] dark:bg-[#0d243b] dark:shadow-none">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">التنبيهات الأخيرة</h2><button className="text-xs font-semibold text-[#0874f9]">عرض الكل</button></div>
          <div className="divide-y divide-slate-100 dark:divide-white/[.07]">
            {alerts.map(([name, text, time, type]) => (
              <div key={`${name}-${time}`} className="flex gap-3 py-3">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${type === "down" ? "bg-red-50 text-red-500 dark:bg-red-500/10" : type === "info" ? "bg-violet-50 text-violet-600 dark:bg-violet-500/10" : "bg-blue-50 text-[#0874f9] dark:bg-blue-500/10"}`}>{type === "down" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</div>
                <div className="min-w-0 flex-1"><div className="text-xs"><b className="text-[#0874f9]">{name}</b> <span className="text-slate-600 dark:text-slate-300">{text}</span></div><div className="mt-1 text-[10px] text-slate-400">{time}</div></div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-[24px] border border-white/90 bg-white p-4 shadow-[0_8px_22px_rgba(58,84,112,.08)] dark:border-white/[.07] dark:bg-[#0d243b] dark:shadow-none">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">آخر جلسات RADIUS</h2><button className="text-xs font-semibold text-[#0874f9]">عرض الكل</button></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-right text-xs">
            <thead className="text-[10px] text-slate-400"><tr><th className="py-2">الحالة</th><th>اسم المستخدم</th><th>NAS</th><th>عنوان IP</th><th>الباقة</th><th>وقت تسجيل الدخول</th><th>المدة</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[.07]">
              {sessions.map((row) => (
                <tr key={`${row[1]}-${row[5]}`} className="text-slate-600 dark:text-slate-300">
                  <td className="py-3"><span className="flex items-center gap-2"><i className={`h-2 w-2 rounded-full ${row[0] === "Online" ? "bg-emerald-500" : "bg-red-500"}`} />{row[0]}</span></td>
                  {row.slice(1).map((cell, i) => <td key={i} className={i === 0 ? "font-bold text-[#17386d] dark:text-slate-100" : ""}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
