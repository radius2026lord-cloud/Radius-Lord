"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  ChevronLeft,
  ChevronRight,
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
    <div className="flex items-center gap-3 min-w-0">
      <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#0a70ff] to-[#063bbd] text-white shadow-[0_10px_25px_rgba(26,111,255,.28)]">
        <Crown className="h-6 w-6 text-[#ffad16]" strokeWidth={2.2} />
        <Radio className="absolute bottom-1.5 h-3.5 w-3.5" strokeWidth={2.5} />
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[15px] font-bold text-[#102a63] dark:text-white">اللورد لخدمات الإنترنت</div>
          <div className="mt-1 text-[11px] font-semibold tracking-wide text-[#e99100]">LORD RADIUS</div>
        </div>
      )}
    </div>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickVisible, setQuickVisible] = useState(true);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let lastY = window.scrollY;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastY + 6) setQuickVisible(false);
      if (currentY < lastY - 6) setQuickVisible(true);
      lastY = currentY;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setQuickVisible(true), 240);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const isDark = mounted && theme === "dark";
  const sidebarWidth = collapsed ? "lg:w-[92px]" : "lg:w-[232px]";
  const mainGap = collapsed ? "lg:mr-[112px]" : "lg:mr-[252px]";

  const currentTitle = useMemo(() => {
    for (const group of navGroups) {
      const match = group.items.find((item) => pathname === item.href);
      if (match) return match.label;
    }
    return "لوحة التحكم";
  }, [pathname]);

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pb-4 pt-3">
        <Brand compact={!mobile && collapsed} />
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200/80 dark:border-white/10" aria-label="إغلاق القائمة">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            {(!collapsed || mobile) && <div className="mb-2 px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500">{group.label}</div>}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => mobile && setMobileOpen(false)}
                    title={collapsed && !mobile ? item.label : undefined}
                    className={`group flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition-all ${
                      active
                        ? "bg-gradient-to-l from-[#1479ff] to-[#0758e9] text-white shadow-[0_8px_22px_rgba(17,105,240,.22)]"
                        : "text-slate-600 hover:bg-[#eaf3ff] hover:text-[#0758e9] dark:text-slate-300 dark:hover:bg-white/[.055] dark:hover:text-white"
                    } ${collapsed && !mobile ? "justify-center" : "gap-3"}`}
                  >
                    <Icon className="h-[19px] w-[19px] shrink-0" />
                    {(!collapsed || mobile) && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-2">
        <Link href="/login" className={`flex min-h-11 items-center rounded-xl border border-red-200/80 px-3 text-sm font-semibold text-red-500 hover:bg-red-50 dark:border-red-400/15 dark:hover:bg-red-500/10 ${collapsed && !mobile ? "justify-center" : "gap-3"}`}>
          <LogOut className="h-[19px] w-[19px]" />
          {(!collapsed || mobile) && <span>تسجيل الخروج</span>}
        </Link>
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#dce5ef] text-[#102a63] transition-colors dark:bg-[#07182a] dark:text-slate-100">
      <aside className={`fixed bottom-3 right-3 top-3 z-40 hidden ${sidebarWidth} overflow-hidden rounded-[28px] border border-white/70 bg-[#f9fbfe]/95 shadow-[0_16px_44px_rgba(46,75,107,.12)] backdrop-blur-xl transition-all duration-300 dark:border-white/[.08] dark:bg-[#0b2036]/95 dark:shadow-[0_18px_50px_rgba(0,0,0,.28)] lg:block`}>
        <SidebarContent />
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -left-3 top-14 z-50 grid h-8 w-8 place-items-center rounded-full border border-[#bdd4ed] bg-white text-[#0758e9] shadow-lg transition hover:scale-105 dark:border-white/10 dark:bg-[#102942] dark:text-[#4da0ff]"
          aria-label={collapsed ? "فتح الشريط الجانبي" : "طي الشريط الجانبي"}
        >
          {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة" />
          <aside className="absolute bottom-3 right-3 top-3 w-[min(86vw,330px)] overflow-hidden rounded-[26px] border border-white/70 bg-[#f9fbfe] shadow-2xl dark:border-white/10 dark:bg-[#0b2036]">
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      <div className={`${mainGap} min-w-0 transition-all duration-300`}>
        <header className="sticky top-0 z-30 px-3 pt-3 md:px-4 lg:px-5">
          <div className="flex min-h-[74px] items-center gap-3 rounded-[26px] border border-white/80 bg-[#f9fbfe]/95 px-3.5 shadow-[0_12px_34px_rgba(60,88,116,.10)] backdrop-blur-xl dark:border-white/[.08] dark:bg-[#0b2036]/95 dark:shadow-[0_12px_34px_rgba(0,0,0,.24)] sm:px-5">
            <button onClick={() => setMobileOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#d5e2ef] bg-white text-[#0758e9] dark:border-white/10 dark:bg-white/[.04] dark:text-white lg:hidden" aria-label="فتح القائمة">
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative min-w-0 flex-1 sm:max-w-[430px]">
              <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                className="h-11 w-full rounded-2xl border border-[#d7e3ef] bg-white/90 pr-12 pl-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#6aaeff] focus:ring-4 focus:ring-[#1480ff]/10 dark:border-white/[.09] dark:bg-[#0d243c] dark:text-white dark:placeholder:text-slate-500"
                placeholder="ابحث عن NAS، مشترك، جلسة ..."
              />
            </div>

            <div className="mr-auto flex items-center gap-2 sm:gap-3">
              <div className="hidden min-h-11 items-center gap-3 rounded-2xl border border-[#d7e3ef] bg-white px-4 dark:border-white/[.09] dark:bg-[#0d243c] md:flex">
                <Radio className="h-5 w-5 text-[#0758e9]" />
                <div className="leading-tight">
                  <div className="text-xs font-bold">RADIUS</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-500" />Online</div>
                </div>
              </div>

              <button className="relative grid h-11 w-11 place-items-center rounded-2xl border border-[#d7e3ef] bg-white dark:border-white/[.09] dark:bg-[#0d243c]" aria-label="التنبيهات">
                <Bell className="h-5 w-5" />
                <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff9f0a] px-1 text-[10px] font-bold text-white">3</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="grid h-11 w-11 place-items-center rounded-2xl border border-[#d7e3ef] bg-white text-[#102a63] dark:border-white/[.09] dark:bg-[#0d243c] dark:text-slate-100"
                aria-label="تبديل الوضع"
              >
                {mounted && isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <div className="hidden items-center gap-2 rounded-2xl border border-[#d7e3ef] bg-white py-1.5 pr-2 pl-3 dark:border-white/[.09] dark:bg-[#0d243c] sm:flex">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#0e74ff] to-[#073dbd] text-white"><Crown className="h-4 w-4 text-[#ffad16]" /></div>
                <div className="leading-tight"><div className="text-xs font-bold">Admin</div><div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">مدير النظام</div></div>
              </div>
            </div>
          </div>
        </header>

        <main className="px-3 pb-2 pt-3 md:px-4 lg:px-5">
          <div className="overflow-hidden rounded-[28px] border border-[#a9c8e8] bg-[#edf3f8]/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.9)] dark:border-[#27445f] dark:bg-[#091d32]/80 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-4 px-1">
              <div>
                <h1 className="text-lg font-bold sm:text-xl">{currentTitle}</h1>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">مركز التحكم والمراقبة لشبكة LORD RADIUS</p>
              </div>
              <div className="hidden items-center gap-2 rounded-2xl border border-[#d4e1ed] bg-white px-3 py-2 text-xs text-slate-500 dark:border-white/[.08] dark:bg-[#0d243c] dark:text-slate-400 md:flex"><ShieldCheck className="h-4 w-4 text-emerald-500" /> جميع الخدمات مستقرة</div>
            </div>

            <div className="min-w-0">{children}</div>

            <div className={`mt-4 transition-all duration-300 ${quickVisible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`}>
              <div className="mx-auto flex w-fit max-w-full gap-1.5 overflow-x-auto rounded-[24px] border border-[#d3e0ec] bg-white/95 p-2 shadow-[0_12px_30px_rgba(48,78,110,.12)] dark:border-white/[.08] dark:bg-[#0d243c]/95 dark:shadow-[0_12px_30px_rgba(0,0,0,.20)]">
                {shortcuts.map(({ label, icon: Icon }) => (
                  <button key={label} className="flex h-11 shrink-0 items-center gap-2 rounded-[17px] px-3 text-xs font-semibold text-[#17386d] transition hover:bg-[#edf5ff] dark:text-slate-200 dark:hover:bg-white/[.06] sm:px-4">
                    <Icon className="h-[18px] w-[18px] text-[#0758e9] dark:text-[#4da0ff]" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>

        <footer className="px-3 pb-3 pt-1 md:px-4 lg:px-5">
          <div className="flex min-h-[58px] flex-wrap items-center gap-x-5 gap-y-2 rounded-[22px] border border-white/80 bg-[#f9fbfe]/95 px-4 py-2 text-[10px] text-slate-500 shadow-[0_10px_28px_rgba(60,88,116,.09)] dark:border-white/[.08] dark:bg-[#0b2036]/95 dark:text-slate-400">
            <div className="flex items-center gap-2"><Database className="h-4 w-4 text-[#0758e9]" /><span>radius.lord.local</span></div>
            <div className="hidden h-6 w-px bg-slate-200 dark:bg-white/10 sm:block" />
            <div><span className="font-semibold text-slate-700 dark:text-slate-200">Ubuntu 22.04.4 LTS</span></div>
            <div className="hidden h-6 w-px bg-slate-200 dark:bg-white/10 md:block" />
            <div className="hidden items-center gap-2 md:flex"><span>CPU</span><span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><span className="block h-full w-[23%] rounded-full bg-[#ffad16]" /></span><b>23%</b></div>
            <div className="hidden items-center gap-2 lg:flex"><span>RAM</span><span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><span className="block h-full w-[42%] rounded-full bg-[#1479ff]" /></span><b>42%</b></div>
            <div className="mr-auto flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />FreeRADIUS</span>
              <span className="hidden items-center gap-1.5 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" />MySQL</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">10:24:45 AM</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
