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
  return <div className="radius-art relative h-full min-h-0 w-full overflow-hidden" dir="rtl">
    <div className="art-grid absolute inset-0" aria-hidden="true"/><div className="art-glow absolute inset-0" aria-hidden="true"/>
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1400 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="wire" x1="0" x2="1"><stop offset="0" stopColor="#1681ff" stopOpacity=".08"/><stop offset=".5" stopColor="#1681ff" stopOpacity=".42"/><stop offset="1" stopColor="#1681ff" stopOpacity=".08"/></linearGradient><filter id="soft"><feGaussianBlur stdDeviation="4"/></filter></defs>
      <g className="art-wires" fill="none" stroke="url(#wire)" strokeWidth="1.3"><path d="M-20 545 C170 480 230 365 410 390 S610 525 710 430"/><path d="M1420 535 C1235 470 1165 350 1000 390 S820 510 710 430"/><path d="M120 155 C270 210 335 250 470 315"/><path d="M1280 145 C1130 200 1070 250 930 315"/></g>
      <g className="rack rack-left" transform="translate(80 245)"><rect width="190" height="245" rx="20"/><rect x="18" y="24" width="154" height="38" rx="8"/><rect x="18" y="75" width="154" height="38" rx="8"/><rect x="18" y="126" width="154" height="38" rx="8"/><rect x="18" y="177" width="154" height="38" rx="8"/><g className="rack-led"><circle cx="42" cy="43" r="4"/><circle cx="42" cy="94" r="4"/><circle cx="42" cy="145" r="4"/><circle cx="42" cy="196" r="4"/></g></g>
      <g className="rack rack-right" transform="translate(1130 245)"><rect width="190" height="245" rx="20"/><rect x="18" y="24" width="154" height="38" rx="8"/><rect x="18" y="75" width="154" height="38" rx="8"/><rect x="18" y="126" width="154" height="38" rx="8"/><rect x="18" y="177" width="154" height="38" rx="8"/><g className="rack-led"><circle cx="148" cy="43" r="4"/><circle cx="148" cy="94" r="4"/><circle cx="148" cy="145" r="4"/><circle cx="148" cy="196" r="4"/></g></g>
      <g className="router-art" transform="translate(610 520)"><path d="M0 42 L90 0 180 42 90 84Z"/><path d="M0 42v45l90 43 90-43V42"/><path d="M48 47h84M64 68h52"/><circle cx="35" cy="63" r="4"/><circle cx="145" cy="63" r="4"/></g>
      <g className="signal" transform="translate(700 180)"><circle r="7"/><path d="M-35 5a40 40 0 0 1 70 0M-60-8a70 70 0 0 1 120 0M-86-22a100 100 0 0 1 172 0"/></g>
      <g className="data-points"><circle cx="275" cy="395" r="4"/><circle cx="430" cy="390" r="4"/><circle cx="1000" cy="390" r="4"/><circle cx="1128" cy="390" r="4"/><circle cx="710" cy="430" r="5"/></g>
    </svg>
    <div className="relative z-10 flex h-full w-full items-center justify-center px-[clamp(18px,4vw,70px)] py-4">
      <section className="flex h-full w-full max-w-[1180px] flex-col items-center justify-center text-center">
        <div className="welcome-reveal flex flex-col items-center" dir="ltr"><div className="logo-core relative grid h-[66px] w-[66px] place-items-center rounded-[20px] bg-gradient-to-br from-[#1681ff] to-[#0758e9] shadow-[0_0_48px_rgba(20,121,255,.32)]"><Crown className="h-9 w-9 text-[#ffb019]" strokeWidth={2.2}/><Wifi className="absolute bottom-1.5 h-4 w-4 text-white"/></div><div className="mt-2 text-[26px] font-black leading-none text-[#102a63] dark:text-white">LORD</div><div className="mt-1 text-[10px] font-extrabold tracking-[.13em] text-[#e99100]">RADIUS LORD</div></div>
        <div className="welcome-reveal d2 mt-3 inline-flex items-center gap-2 rounded-full border border-[#9fc4ec]/70 bg-white/90 px-4 py-2 text-xs font-semibold text-[#0758e9] shadow-sm dark:border-[#426181] dark:bg-[#13273d] dark:text-[#8ab5ff]"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"/>مرحباً بك في LORD RADIUS</div>
        <h2 className="welcome-reveal d2 mt-3 text-3xl font-bold text-[#102a63] dark:text-white sm:text-[42px]">أهلاً بك، <span className="text-[#0758e9]">{fullName}</span></h2>
        <p className="welcome-reveal d3 mx-auto mt-2 max-w-[680px] text-sm leading-6 text-slate-500 dark:text-slate-300 sm:text-base">منصة متكاملة لإدارة RADIUS والشبكات والمشتركين. اختر خطتك وابدأ بناء شبكتك داخل منظومة LORD RADIUS.</p>
        <div className="welcome-reveal d4 mt-4 flex flex-col gap-3 sm:flex-row"><Link href="/Dashboard/customer-plans" className="inline-flex h-11 min-w-[220px] items-center justify-center gap-2 rounded-[15px] bg-[#0758e9] px-6 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(7,88,233,.28)] transition hover:-translate-y-0.5 hover:bg-[#064dcc]">عرض الخطط المتاحة<CreditCard className="h-4 w-4"/></Link><button type="button" onClick={()=>document.getElementById("radius-intro")?.focus()} className="inline-flex h-11 min-w-[220px] items-center justify-center gap-2 rounded-[15px] border border-[#a9c8e8] bg-white/90 px-6 text-sm font-semibold text-[#17386d] shadow-sm transition hover:-translate-y-0.5 dark:border-[#426181] dark:bg-[#13273d] dark:text-white">نبذة عن Radius Lord<ArrowLeft className="h-4 w-4"/></button></div>
        <div id="radius-intro" tabIndex={-1} className="welcome-reveal d5 mt-5 grid w-full max-w-[900px] gap-3 outline-none sm:grid-cols-3">{[["إدارة مركزية","تحكم بشبكاتك وخدماتك من مركز واحد.",Server],["RADIUS متكامل","NAS ومشتركون وسياسات واتصال مركزي.",Wifi],["جاهز للتوسع","بنية مرنة تنمو مع شبكتك واحتياجاتك.",Activity]].map(([title,text,Icon]:any)=><article key={title} className="feature-card rounded-[19px] border border-[#bfd3e7] bg-[#f7fbff] p-3 text-right shadow-[0_12px_28px_rgba(32,72,112,.09)] transition hover:-translate-y-1 dark:border-[#314b66] dark:bg-[#14283d]"><span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#e7f1ff] text-[#0758e9] dark:bg-[#183b60] dark:text-[#7eb4ff]"><Icon className="h-[18px] w-[18px]"/></span><h3 className="mt-2 text-sm font-semibold text-[#17386d] dark:text-white">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{text}</p></article>)}</div>
      </section>
    </div>
    <style jsx>{`
      .radius-art{background:linear-gradient(135deg,#f8fbff,#edf5ff 52%,#f8fbff)}:global(.dark) .radius-art{background:linear-gradient(135deg,#0b111b 0%,#101d2d 48%,#090e17 100%)}
      .art-grid{background-image:linear-gradient(rgba(20,121,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(20,121,255,.08) 1px,transparent 1px);background-size:54px 54px;mask-image:radial-gradient(ellipse at center,#000 20%,rgba(0,0,0,.55) 68%,transparent)}.art-glow{background:radial-gradient(circle at 50% 44%,rgba(20,121,255,.16),transparent 28%),radial-gradient(circle at 12% 62%,rgba(20,121,255,.07),transparent 20%),radial-gradient(circle at 88% 62%,rgba(20,121,255,.07),transparent 20%)}
      .rack{fill:rgba(20,121,255,.025);stroke:rgba(20,121,255,.19);stroke-width:1.3}.rack>rect:not(:first-child){fill:rgba(20,121,255,.035);stroke:rgba(20,121,255,.16)}:global(.dark) .rack{fill:rgba(18,54,89,.24);stroke:rgba(78,151,240,.22)}:global(.dark) .rack>rect:not(:first-child){fill:rgba(17,48,79,.34);stroke:rgba(78,151,240,.18)}.rack-led{fill:#1681ff}.rack-led circle{animation:led 2.6s ease-in-out infinite}.rack-led circle:nth-child(2){animation-delay:.6s}.rack-led circle:nth-child(3){animation-delay:1.1s}
      .router-art{fill:rgba(20,121,255,.035);stroke:rgba(20,121,255,.22);stroke-width:1.3}.router-art circle,.data-points{fill:#1681ff}.signal{fill:#1681ff;stroke:#1681ff;stroke-width:2;fill-opacity:.7}.signal path{fill:none;opacity:.18}.art-wires path{stroke-dasharray:8 10;animation:wireMove 16s linear infinite}.data-points circle{filter:drop-shadow(0 0 5px #1681ff);animation:dataPulse 2.8s ease-in-out infinite}
      .logo-core:before{content:"";position:absolute;inset:-12px;border:1px solid rgba(20,121,255,.18);border-radius:27px;animation:corePulse 3.4s ease-out infinite}.welcome-reveal{opacity:0;transform:translateY(12px);animation:welcomeIn .7s cubic-bezier(.22,.8,.25,1) forwards}.d2{animation-delay:.14s}.d3{animation-delay:.25s}.d4{animation-delay:.36s}.d5{animation-delay:.48s}
      @keyframes welcomeIn{to{opacity:1;transform:none}}@keyframes wireMove{to{stroke-dashoffset:-180}}@keyframes led{50%{opacity:.2}}@keyframes dataPulse{50%{opacity:.3;transform:scale(.7)}}@keyframes corePulse{0%{transform:scale(.86);opacity:.8}75%,100%{transform:scale(1.22);opacity:0}}
      @media(max-width:1100px){.rack{opacity:.45}.network-art{opacity:.6}}@media(max-height:760px){.rack,.router-art{opacity:.35}#radius-intro{margin-top:.65rem}.radius-art p{line-height:1.2rem}}@media(prefers-reduced-motion:reduce){.welcome-reveal,.art-wires path,.rack-led circle,.data-points circle,.logo-core:before{animation:none;opacity:1;transform:none}}
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
