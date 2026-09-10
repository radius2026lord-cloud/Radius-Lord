"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  CircleDollarSign,
  Clock3,
  Crown,
  Database,
  FileClock,
  Gauge,
  Home,
  Layers3,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  PackagePlus,
  Radio,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sun,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";

const navGroups = [
  {
    label: "الشبكة",
    items: [
      { label: "لوحة التحكم", href: "/Dashboard", icon: Home },
      { label: "أجهزة NAS", href: "/Dashboard/nas", icon: Server },
      { label: "الجلسات الحية", href: "/Dashboard/sessions", icon: Activity },
      { label: "سجلات RADIUS", href: "/Dashboard/radius-logs", icon: FileClock },
    ],
  },
  {
    label: "المشتركون",
    items: [
      { label: "المشتركون", href: "/Dashboard/subscribers", icon: Users },
      { label: "الباقات", href: "/Dashboard/packages", icon: Layers3 },
      { label: "الحسابات المنتهية", href: "/Dashboard/expired", icon: Clock3 },
    ],
  },
  {
    label: "الإدارة",
    items: [
      { label: "المحاسبة", href: "/Dashboard/billing", icon: CircleDollarSign },
      { label: "التقارير", href: "/Dashboard/reports", icon: Gauge },
      { label: "الإعدادات", href: "/Dashboard/settings", icon: Settings },
    ],
  },
];

const shortcuts = [
  { label: "إضافة مستخدم", icon: UserPlus },
  { label: "عرض الجلسات", icon: Users },
  { label: "إضافة باقة", icon: PackagePlus },
  { label: "إضافة NAS", icon: Server },
  { label: "سجلات RADIUS", icon: FileClock },
  { label: "التقارير", icon: Gauge },
  { label: "التنبيهات", icon: Bell },
  { label: "المزيد", icon: MoreHorizontal },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] ${compact ? "justify-center gap-0" : "gap-3"}`}>
      <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#0a70ff] to-[#063bbd] text-white shadow-[0_10px_25px_rgba(26,111,255,.28)] transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)]">
        <Crown className="h-6 w-6 text-[#ffad16]" strokeWidth={2.2} />
        <Radio className="absolute bottom-1.5 h-3.5 w-3.5" strokeWidth={2.5} />
      </div>
      <div className={`overflow-hidden whitespace-nowrap leading-tight transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] ${compact ? "max-w-0 -translate-x-2 opacity-0" : "max-w-[160px] translate-x-0 opacity-100"}`}>
        <div className="truncate text-[15px] font-bold text-[#102a63] dark:text-white">اللورد لخدمات الإنترنت</div>
        <div className="mt-1 text-[11px] font-semibold tracking-wide text-[#e99100]">LORD RADIUS</div>
      </div>
    </div>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => setMounted(true), []);

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setAccountOpen(false);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.href = "/login";
    }
  };

  const isDark = mounted && theme === "dark";
  const sidebarWidth = collapsed ? "lg:w-[92px]" : "lg:w-[232px]";
  const mainGap = collapsed ? "lg:mr-[112px]" : "lg:mr-[252px]";
  const footerGap = collapsed ? "lg:right-[132px]" : "lg:right-[272px]";
  const shellMotion = "transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)]";

  const currentTitle = useMemo(() => {
    for (const group of navGroups) {
      const match = group.items.find((item) => pathname === item.href);
      if (match) return match.label;
    }
    return "لوحة التحكم";
  }, [pathname]);

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => {
    const compact = !mobile && collapsed;

    return (
      <div className="flex h-full flex-col">
        <div className={`flex items-center pb-4 pt-3 ${shellMotion} ${compact ? "justify-center px-0" : "justify-between px-3"}`}>
          <Brand compact={compact} />
          {mobile && (
            <button onClick={() => setMobileOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200/80 dark:border-white/10" aria-label="إغلاق القائمة">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className={`sidebar min-h-0 flex-1 overflow-y-auto pb-3 ${shellMotion} ${compact ? "px-3" : "px-2"}`}>
          {navGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <div className={`overflow-hidden px-3 text-[11px] font-semibold text-slate-400 transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] dark:text-slate-500 ${compact ? "mb-0 max-h-0 -translate-x-2 opacity-0" : "mb-2 max-h-6 translate-x-0 opacity-100"}`}>
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => mobile && setMobileOpen(false)}
                      title={compact ? item.label : undefined}
                      className={`group flex min-h-12 items-center rounded-[18px] text-sm font-medium ${shellMotion} ${
                        active
                          ? "bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.055] dark:text-white"
                          : "text-slate-600 hover:bg-[#edf4fb] hover:text-[#0758e9] dark:text-slate-300 dark:hover:bg-white/[.045] dark:hover:text-white"
                      } ${compact ? "justify-center px-0" : "gap-3 px-2"}`}
                    >
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] ${
                          active
                            ? "bg-gradient-to-br from-[#1479ff] to-[#0758e9] text-white shadow-[0_8px_20px_rgba(20,121,255,.28)]"
                            : "bg-[#e2e9f1] text-[#315985] group-hover:bg-[#d7e7f8] group-hover:text-[#0758e9] dark:bg-[#3b383e] dark:text-[#c4bec8] dark:group-hover:bg-[#454149] dark:group-hover:text-[#8ab5ff]"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className={`overflow-hidden whitespace-nowrap transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] ${compact ? "max-w-0 -translate-x-2 opacity-0" : "max-w-[150px] translate-x-0 opacity-100"}`}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={`p-2 ${shellMotion}`}>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className={`flex min-h-12 w-full items-center rounded-[18px] border border-red-500 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:cursor-wait disabled:opacity-70 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-500/10 ${shellMotion} ${compact ? "justify-center px-0" : "gap-3 px-2"}`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-500 transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] dark:bg-red-500/10 dark:text-red-400">
              <LogOut className="h-5 w-5" />
            </span>
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-500 ease-[cubic-bezier(.22,.8,.25,1)] ${compact ? "max-w-0 -translate-x-2 opacity-0" : "max-w-[120px] translate-x-0 opacity-100"}`}>{loggingOut ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج"}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div dir="rtl" className="h-screen overflow-hidden bg-[#dce5ef] text-[#102a63] transition-colors dark:bg-[#1d1721] dark:text-[#f4f1f5]">
      <aside
        onMouseLeave={(event) => {
          if (collapsed) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const exitedThroughLeft = event.clientX <= rect.left && event.clientY >= rect.top && event.clientY <= rect.bottom;
          if (exitedThroughLeft) setCollapsed(true);
        }}
        className={`fixed bottom-3 right-3 top-3 z-40 hidden ${sidebarWidth} overflow-hidden rounded-[22px] border border-white/70 bg-[#f9fbfe]/95 shadow-[0_16px_44px_rgba(46,75,107,.12)] backdrop-blur-xl ${shellMotion} dark:border-white/[.10] dark:bg-[#302e33]/95 dark:shadow-[0_18px_50px_rgba(0,0,0,.22)] lg:block`}
      >
        {collapsed && (
          <div
            aria-hidden="true"
            onMouseEnter={() => setCollapsed(false)}
            className="absolute inset-y-0 left-0 z-50 w-3"
          />
        )}
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة" />
          <aside className="absolute bottom-3 right-3 top-3 w-[min(86vw,330px)] overflow-hidden rounded-[22px] border border-white/70 bg-[#f9fbfe] shadow-2xl dark:border-white/10 dark:bg-[#302e33]">
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      <div className={`${mainGap} h-screen min-w-0 overflow-hidden ${shellMotion}`}>
        <header className="relative z-30 px-3 pt-3 md:px-4 lg:px-5">
          <div className="flex min-h-[62px] items-center gap-3 rounded-[16px] border border-white/80 bg-[#f9fbfe]/95 px-3.5 shadow-[0_12px_34px_rgba(60,88,116,.10)] backdrop-blur-xl dark:border-white/[.10] dark:bg-[#302e33]/95 dark:shadow-[0_12px_34px_rgba(0,0,0,.18)] sm:px-5">
            <button onClick={() => setMobileOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#d5e2ef] bg-white text-[#0758e9] dark:border-white/10 dark:bg-[#38363c] dark:text-white lg:hidden" aria-label="فتح القائمة">
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative min-w-0 flex-1 sm:max-w-[430px]">
              <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                className="h-10 w-full rounded-[22px] border border-[#d7e3ef] bg-white/90 pr-12 pl-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#6aaeff] focus:ring-4 focus:ring-[#1480ff]/10 dark:border-white/[.10] dark:bg-[#211a25] dark:text-[#f4f1f5] dark:placeholder:text-[#8f8894]"
                placeholder="ابحث عن NAS، مشترك، جلسة ..."
              />
            </div>

            <div className="mr-auto flex items-center gap-2 sm:gap-3">
              <div className="hidden min-h-10 items-center gap-3 rounded-[22px] border border-[#d7e3ef] bg-white px-4 dark:border-white/[.10] dark:bg-[#38363c] md:flex">
                <Radio className="h-5 w-5 text-[#0758e9]" />
                <div className="leading-tight">
                  <div className="text-xs font-bold">RADIUS</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-[#b9b3bd]"><span className="h-2 w-2 rounded-full bg-emerald-500" />Online</div>
                </div>
              </div>

              <button className="relative grid h-10 w-10 place-items-center rounded-full border border-[#d7e3ef] bg-white dark:border-white/[.10] dark:bg-[#38363c]" aria-label="التنبيهات">
                <Bell className="h-5 w-5" />
                <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff9f0a] px-1 text-[10px] font-bold text-white">3</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="grid h-10 w-10 place-items-center rounded-full border border-[#d7e3ef] bg-white text-[#102a63] dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#f4f1f5]"
                aria-label="تبديل الوضع"
              >
                {mounted && isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <div
                className="relative hidden sm:block"
                onMouseEnter={() => setAccountOpen(true)}
                onMouseLeave={() => setAccountOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  className={`flex items-center gap-2 rounded-[22px] border bg-white py-1 pr-2 pl-3 transition-all duration-300 ease-[cubic-bezier(.22,.8,.25,1)] dark:bg-[#38363c] ${accountOpen ? "border-[#8bb9f0] shadow-[0_8px_22px_rgba(20,121,255,.12)] dark:border-white/20" : "border-[#d7e3ef] dark:border-white/[.10]"}`}
                >
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#0e74ff] to-[#073dbd] text-white"><Crown className="h-4 w-4 text-[#ffad16]" /></div>
                  <div className="leading-tight text-right"><div className="text-xs font-bold">Admin</div><div className="mt-0.5 text-[10px] text-slate-500 dark:text-[#b9b3bd]">مدير النظام</div></div>
                </button>

                <div
                  role="menu"
                  className={`absolute left-0 top-[calc(100%+6px)] z-[70] w-[225px] origin-top-left rounded-[20px] border border-[#d7e3ef] bg-[#f9fbfe] p-2 shadow-[0_18px_45px_rgba(44,65,92,.22)] transition-all duration-300 ease-[cubic-bezier(.22,.8,.25,1)] dark:border-white/[.12] dark:bg-[#302e33] dark:shadow-[0_22px_55px_rgba(0,0,0,.38)] ${accountOpen ? "visible translate-y-0 scale-100 opacity-100" : "invisible -translate-y-2 scale-[.97] opacity-0 pointer-events-none"}`}
                >
                  <div className="mb-2 flex items-center gap-3 rounded-[16px] bg-[#edf4fb] px-3 py-2.5 dark:bg-[#38363c]">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#0e74ff] to-[#073dbd] text-white"><Crown className="h-5 w-5 text-[#ffad16]" /></div>
                    <div className="min-w-0 leading-tight">
                      <div className="truncate text-sm font-bold">Admin</div>
                      <div className="mt-1 text-[10px] text-slate-500 dark:text-[#b9b3bd]">مدير النظام</div>
                    </div>
                  </div>

                  <Link href="/Dashboard/profile" onClick={() => setAccountOpen(false)} role="menuitem" className="group flex min-h-11 items-center gap-3 rounded-[14px] px-3 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-[#edf4fb] hover:text-[#0758e9] dark:text-[#ece8ee] dark:hover:bg-[#38363c] dark:hover:text-white">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e2e9f1] text-[#315985] transition group-hover:bg-[#d7e7f8] group-hover:text-[#0758e9] dark:bg-[#3b383e] dark:text-[#c4bec8]"><UserRound className="h-4 w-4" /></span>
                    <span>معلومات الحساب</span>
                  </Link>

                  <Link href="/Dashboard/settings" onClick={() => setAccountOpen(false)} role="menuitem" className="group mt-1 flex min-h-11 items-center gap-3 rounded-[14px] px-3 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-[#edf4fb] hover:text-[#0758e9] dark:text-[#ece8ee] dark:hover:bg-[#38363c] dark:hover:text-white">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e2e9f1] text-[#315985] transition group-hover:bg-[#d7e7f8] group-hover:text-[#0758e9] dark:bg-[#3b383e] dark:text-[#c4bec8]"><Settings className="h-4 w-4" /></span>
                    <span>إعدادات الحساب</span>
                  </Link>

                  <div className="my-2 h-px bg-slate-200/80 dark:bg-white/[.08]" />

                  <button
                    type="button"
                    onClick={logout}
                    disabled={loggingOut}
                    role="menuitem"
                    className="group flex min-h-11 w-full items-center gap-3 rounded-[14px] border border-red-400/70 px-3 text-sm font-semibold text-red-500 transition-all duration-200 hover:bg-red-50 disabled:cursor-wait disabled:opacity-70 dark:border-red-400/55 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400"><LogOut className="h-4 w-4" /></span>
                    <span>{loggingOut ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="h-[calc(100dvh-74px)] overflow-hidden px-3 pb-[66px] pt-3 md:px-4 lg:px-5">
          <div className="workspace-scroll h-full overflow-y-auto rounded-[22px] border border-[#a9c8e8] bg-[#edf3f8]/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.9)] dark:border-white/[.08] dark:bg-[#211a25] dark:shadow-none sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-4 px-1">
              <div>
                <h1 className="text-lg font-bold sm:text-xl">{currentTitle}</h1>
                <p className="mt-1 text-xs text-slate-500 dark:text-[#b9b3bd]">مركز التحكم والمراقبة لشبكة LORD RADIUS</p>
              </div>
              <div className="hidden items-center gap-2 rounded-[22px] border border-[#d4e1ed] bg-white px-3 py-2 text-xs text-slate-500 dark:border-white/[.10] dark:bg-[#302e33] dark:text-[#b9b3bd] md:flex"><ShieldCheck className="h-4 w-4 text-emerald-500" /> جميع الخدمات مستقرة</div>
            </div>

            <div className="min-w-0">{children}</div>

            <div className="mt-4">
              <div className="mx-auto flex w-fit max-w-full gap-1.5 overflow-x-auto rounded-[26px] border border-[#d3e0ec] bg-white/95 p-2 shadow-[0_12px_30px_rgba(48,78,110,.12)] dark:border-white/[.10] dark:bg-[#302e33]/95 dark:shadow-none">
                {shortcuts.map(({ label, icon: Icon }) => (
                  <button key={label} className="flex h-11 shrink-0 items-center gap-2 rounded-[18px] px-3 text-xs font-semibold text-[#17386d] transition hover:bg-[#edf5ff] dark:text-[#f4f1f5] dark:hover:bg-[#38363c] sm:px-4">
                    <Icon className="h-[18px] w-[18px] text-[#0758e9] dark:text-[#6aa8ff]" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>

        <footer className={`fixed bottom-3 left-3 right-3 z-30 md:left-4 lg:left-5 ${footerGap} ${shellMotion}`}>
          <div className="flex min-h-[46px] flex-wrap items-center gap-x-5 gap-y-1 rounded-[12px] border border-white/80 bg-[#f9fbfe]/95 px-4 py-1.5 text-[10px] text-slate-500 shadow-[0_10px_28px_rgba(60,88,116,.09)] backdrop-blur-xl dark:border-white/[.10] dark:bg-[#302e33]/95 dark:text-[#b9b3bd] dark:shadow-[0_8px_24px_rgba(0,0,0,.16)]">
            <div className="flex items-center gap-2"><Database className="h-4 w-4 text-[#0758e9]" /><span>radius.lord.local</span></div>
            <div className="hidden h-5 w-px bg-slate-200 dark:bg-white/10 sm:block" />
            <div><span className="font-semibold text-slate-700 dark:text-[#f4f1f5]">Ubuntu 22.04.4 LTS</span></div>
            <div className="hidden h-5 w-px bg-slate-200 dark:bg-white/10 md:block" />
            <div className="hidden items-center gap-2 md:flex"><span>CPU</span><span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><span className="block h-full w-[23%] rounded-full bg-[#ffad16]" /></span><b>23%</b></div>
            <div className="hidden items-center gap-2 lg:flex"><span>RAM</span><span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><span className="block h-full w-[42%] rounded-full bg-[#1479ff]" /></span><b>42%</b></div>
            <div className="mr-auto flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />FreeRADIUS</span>
              <span className="hidden items-center gap-1.5 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" />MySQL</span>
              <span className="font-semibold text-slate-700 dark:text-[#f4f1f5]">10:24:45 AM</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
