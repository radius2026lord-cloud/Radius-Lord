"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import FloatingNotice from "./floating-notice";
import ServerStatusFooter from "./server-status-footer";
import TransitionOverlay from "@/components/ui/transition-overlay";
import { useOptionalAuth } from "@/components/auth/auth-provider";
import CustomerOnboardingShell from "./customer-onboarding-shell";
import {
  History,
  Tags,
  Layers,
  Activity,
  Bell,
  CircleDollarSign,
  Clock3,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  Crown,
  Database,
  FileClock,
  Gauge,
  Home,
  Layers3,
  List,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  PackagePlus,
  PlusCircle,
  ChevronsUp,
  Radio,
  Server,
  TerminalSquare,
  Settings,
  ShieldCheck,
  ScrollText,
  Sun,
  UserCog,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";

type NavItem = { label: string; href: string; icon: any };
type NavGroup = { label: string; icon: any; items: NavItem[] };

function findNavMatch(groups:NavGroup[],pathname:string):{group:NavGroup;item:NavItem}|undefined {
  const entries=groups.flatMap(group=>group.items.map(item=>({group,item})));
  const exact=entries.find(({item})=>item.href===pathname);
  if(exact)return exact;
  return entries
    .filter(({item})=>item.href!=="/Dashboard"&&pathname.startsWith(item.href+"/")&&!(item.href==="/Dashboard/connection-servers"&&pathname.startsWith(item.href+"/add")))
    .sort((a,b)=>b.item.href.length-a.item.href.length)[0];
}

const masterAdminHome: NavItem = { label: "الصفحة الرئيسية", href: "/Dashboard", icon: Home };

const masterAdminGroups: NavGroup[] = [
  { label: "العملاء", icon: Users, items: [
    { label: "عرض العملاء", href: "/Dashboard/customers", icon: Users },
    { label: "إضافة عميل", href: "/Dashboard/customers/add", icon: UserPlus },
    { label: "الحسابات الموقوفة", href: "/Dashboard/customers/suspended", icon: UserCog },
  ]},
  { label: "خطط الأسعار", icon: CircleDollarSign, items: [
    { label: "عرض الخطط", href: "/Dashboard/plans", icon: Layers3 },
    { label: "إضافة خطة", href: "/Dashboard/plans/add", icon: PackagePlus },
    { label: "إدارة الخطط", href: "/Dashboard/plans/manage", icon: Settings },
  ]},
  { label: "الاشتراكات", icon: CreditCard, items: [
    { label: "عرض الاشتراكات", href: "/Dashboard/subscriptions", icon: CreditCard },
    { label: "عمليات الدفع", href: "/Dashboard/payments", icon: CircleDollarSign },
    { label: "تقارير التحصيل", href: "/Dashboard/payments/reports", icon: Gauge },
    { label: "الاشتراكات النشطة", href: "/Dashboard/subscriptions/active", icon: ShieldCheck },
    { label: "المنتهية والقريبة من الانتهاء", href: "/Dashboard/subscriptions/expiring", icon: Clock3 },
  ]},
  { label: "الشبكات", icon: Radio, items: [
    { label: "عرض الشبكات", href: "/Dashboard/networks", icon: Radio },
    { label: "إضافة شبكة", href: "/Dashboard/networks/add", icon: PackagePlus },
    { label: "حالة الشبكات", href: "/Dashboard/networks/status", icon: Activity },
  ]},
  { label: "الخوادم والبنية التحتية", icon: Server, items: [
    { label: "خوادم قواعد البيانات", href: "/Dashboard/database-servers", icon: Server },
    { label: "بوابات OpenVPN", href: "/Dashboard/connection-servers", icon: Server },
    { label: "خوادم FreeRADIUS", href: "/Dashboard/radius-servers", icon: Radio },
    { label: "استضافة المنصة", href: "/Dashboard/hosting", icon: Server },
    { label: "جاهزية الخوادم", href: "/Dashboard/server-readiness", icon: Activity },
    { label: "صحة البنية التحتية", href: "/Dashboard/infrastructure-health", icon: ShieldCheck },
  ]},
  { label: "أجهزة NAS", icon: Server, items: [
    { label: "عرض أجهزة NAS", href: "/Dashboard/nas", icon: Server },
    { label: "إضافة NAS", href: "/Dashboard/nas/add", icon: PackagePlus },
    { label: "حالة الأجهزة", href: "/Dashboard/nas/status", icon: Activity },
  ]},
  { label: "النظام", icon: Database, items: [
    { label: "طرفية SSH", href: "/Dashboard/ssh-terminal", icon: TerminalSquare },
    { label: "قواعد البيانات", href: "/Dashboard/system/databases", icon: Database },
    { label: "حالة الخدمات", href: "/Dashboard/system/services", icon: Activity },
  ]},
  { label: "السجلات", icon: ScrollText, items: [
    { label: "سجلات النظام", href: "/Dashboard/logs/system", icon: ScrollText },
    { label: "سجلات RADIUS", href: "/Dashboard/logs/radius", icon: FileClock },
    { label: "نشاط الإدارة", href: "/Dashboard/logs/admin", icon: ShieldCheck },
  ]},
  { label: "الإعدادات", icon: Settings, items: [
    { label: "تخصيص الصفحة الرئيسية", href: "/Dashboard/settings/homepage", icon: Home },
    { label: "إعدادات المنصة", href: "/Dashboard/settings", icon: Settings },
    { label: "الصلاحيات", href: "/Dashboard/settings/permissions", icon: ShieldCheck },
  ]},
];

const customerNavGroups: NavGroup[] = [
  { label: "الشبكة", icon: Radio, items: [
    { label: "الصفحة الرئيسية", href: "/Dashboard", icon: Home },
    { label: "أجهزة NAS", href: "/Dashboard/nas", icon: Server },
    { label: "الجلسات الحية", href: "/Dashboard/sessions", icon: Activity },
    { label: "سجلات RADIUS", href: "/Dashboard/radius-logs", icon: FileClock },
  ]},
  { label: "المشتركون", icon: Users, items: [
    { label: "المشتركون", href: "/Dashboard/subscribers", icon: Users },
    { label: "الباقات", href: "/Dashboard/packages", icon: Layers3 },
    { label: "الحسابات المنتهية", href: "/Dashboard/expired", icon: Clock3 },
  ]},
  { label: "الإدارة", icon: Settings, items: [
    { label: "المحاسبة", href: "/Dashboard/billing", icon: CircleDollarSign },
    { label: "التقارير", href: "/Dashboard/reports", icon: Gauge },
    { label: "الإعدادات", href: "/Dashboard/settings", icon: Settings },
  ]},
];

const shortcuts = [
  { label: "إضافة مستخدم", icon: UserPlus }, { label: "عرض الجلسات", icon: Users },
  { label: "إضافة باقة", icon: PackagePlus }, { label: "إضافة NAS", icon: Server },
  { label: "سجلات RADIUS", icon: FileClock }, { label: "التقارير", icon: Gauge },
  { label: "التنبيهات", icon: Bell }, { label: "المزيد", icon: MoreHorizontal },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center rl-sidebar-motion ${compact ? "justify-center gap-0" : "gap-3"}`}>
      <Image src="/images/logo/lord-radius-icon-v5.png" alt="Lord Radius" width={112} height={112} priority className="h-14 w-14 shrink-0 object-contain rl-sidebar-motion" />
      <div className={`overflow-hidden whitespace-nowrap leading-tight rl-sidebar-motion ${compact ? "max-w-0 -translate-x-2 opacity-0" : "max-w-[160px] translate-x-0 opacity-100"}`}>
        <div className="truncate text-[15px] font-bold text-[#102a63] dark:text-white">اللورد لخدمات الإنترنت</div>
        <div className="mt-1 text-[11px] font-semibold tracking-wide text-[#e99100]">Lord Radius</div>
      </div>
    </div>
  );
}

type NetworkShellContext={isPrincipal?:boolean;canViewCategories?:boolean;canViewActivity?:boolean;canManageStaff?:boolean;canManageGroups?:boolean;canCreateSubscribers?:boolean;basePath:string;tab:string;profileTab?:string;hotspotTab?:string;subscriberTab?:string;fullName:string;onLogout:()=>Promise<void>;footer:React.ReactNode};
export default function DashboardShell({ children,network }: { children: React.ReactNode;network?:NetworkShellContext }) {
  const actualPathname = usePathname();
  const auth = useOptionalAuth();
  const account=network?{fullName:network.fullName}:auth?.account;
  const accountType=network?'customer':auth?.accountType;
  const subscribersWorkspace=network?.tab==="subscribers";
  const pathname=network?(network.tab==='overview'?network.basePath:network.tab==='profiles'?`${network.basePath}?tab=profiles&profileTab=${network.profileTab||'list'}`:network.tab==='hotspot'?`${network.basePath}?tab=hotspot&hotspotTab=${network.hotspotTab||'packages'}`:network.tab==='subscribers'?`${network.basePath}?tab=subscribers${network.subscriberTab==='create'?'&subscriberTab=create':''}`:`${network.basePath}?tab=${network.tab}`):actualPathname;
  const networkHome:NavItem={label:'الصفحة الرئيسية',href:network?.basePath||'/Dashboard',icon:Home};
  const networkGroups:NavGroup[]=network?[
   {label:'إدارة المشتركين',icon:Users,items:[{label:'المشتركون',href:`${network.basePath}?tab=subscribers`,icon:Users},...(network.canCreateSubscribers?[{label:'إضافة عميل',href:`${network.basePath}?tab=subscribers&subscriberTab=create`,icon:UserPlus}]:[]),...(network.canViewCategories?[{label:'تصنيفات المشتركين',href:`${network.basePath}?tab=categories`,icon:Tags}]:[])]},
   {label:'بروفايلات الخدمة',icon:Gauge,items:[{label:'عرض البروفايلات',href:`${network.basePath}?tab=profiles&profileTab=list`,icon:List},{label:'إنشاء بروفايل',href:`${network.basePath}?tab=profiles&profileTab=create`,icon:PlusCircle},{label:'مضاعفة السرعة',href:`${network.basePath}?tab=profiles&profileTab=double`,icon:ChevronsUp}]},
   {label:'الهوتسبوت',icon:Radio,items:[{label:'الباقات',href:`${network.basePath}?tab=hotspot&hotspotTab=packages`,icon:Layers},{label:'دفعات الكروت',href:`${network.basePath}?tab=hotspot&hotspotTab=batches`,icon:CreditCard},{label:'الحسابات الفردية',href:`${network.basePath}?tab=hotspot&hotspotTab=standalone`,icon:Users}]},
   {label:'خوادم NAS',icon:Server,items:[{label:'إدارة الخوادم',href:`${network.basePath}?tab=servers`,icon:Server}]},
   {label:'الإعدادات',icon:Settings,items:[{label:'إعدادات الشبكة',href:`${network.basePath}?tab=settings`,icon:Settings},{label:'إعدادات RADIUS',href:`${network.basePath}?tab=radius-settings`,icon:Server}]},
   {label:'اشتراكي',icon:CreditCard,items:[{label:'معلومات الاشتراك',href:`${network.basePath}?tab=subscription`,icon:CreditCard}]},
   ...(network.canViewActivity?[{label:'السجلات',icon:ScrollText,items:[{label:'سجل النظام',href:`${network.basePath}?tab=activity`,icon:ScrollText},{label:'سجل الإدارة',href:`${network.basePath}?tab=admin-activity`,icon:ShieldCheck}]}]:[]),
   ...(network.isPrincipal||network.canManageStaff||network.canManageGroups?[{label:'إدارة المستخدمين',icon:ShieldCheck,items:[...(network.isPrincipal||network.canManageStaff?[{label:'المستخدمون',href:`${network.basePath}?tab=managers`,icon:Users}]:[]),...(network.isPrincipal||network.canManageGroups?[{label:'مجموعات الصلاحيات',href:`${network.basePath}?tab=permission-groups`,icon:ShieldCheck}]:[])]}]:[]),
  ]:[];
  const navGroups=network?networkGroups:accountType==='master_admin'?masterAdminGroups:customerNavGroups;
  const home=network?networkHome:masterAdminHome;
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sectionMenuOpen,setSectionMenuOpen]=useState(false);
  const sectionMenuRef=useRef<HTMLDivElement>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError,setLogoutError]=useState("");
  const [openNavGroups, setOpenNavGroups] = useState<Record<string, boolean>>({});
  const shellRootRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const desktopNavRef = useRef<HTMLElement>(null);
  const sidebarHoverTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const navRevealTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const cancelSidebarHover = () => { if(sidebarHoverTimer.current) clearTimeout(sidebarHoverTimer.current); sidebarHoverTimer.current=null; };
  const scheduleSidebar = (closed:boolean) => { cancelSidebarHover(); sidebarHoverTimer.current=setTimeout(()=>{setCollapsed(closed);sidebarHoverTimer.current=null;},closed?500:180); };
  useEffect(()=>()=>{if(sidebarHoverTimer.current)clearTimeout(sidebarHoverTimer.current);if(navRevealTimer.current)clearTimeout(navRevealTimer.current);},[]);
  const navGroupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(()=>{if(collapsed&&navRevealTimer.current){clearTimeout(navRevealTimer.current);navRevealTimer.current=null;}},[collapsed]);
  useEffect(() => setMounted(true), []);
  useEffect(()=>{if(!sectionMenuOpen)return;const close=(event:MouseEvent)=>{if(sectionMenuRef.current&&!sectionMenuRef.current.contains(event.target as Node))setSectionMenuOpen(false)};const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")setSectionMenuOpen(false)};document.addEventListener("mousedown",close);document.addEventListener("keydown",onKeyDown);return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",onKeyDown)}},[sectionMenuOpen]);
  useEffect(()=>{setSectionMenuOpen(false)},[pathname]);

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true); setAccountOpen(false); setMobileOpen(false);
    if(network){try{await network.onLogout();}finally{setLoggingOut(false);}return;}
    const startedAt = performance.now();
    try {const response=await fetch("/api/auth/logout", { method: "POST", credentials: "include" });if(!response.ok)throw new Error('تعذر إلغاء الجلسة على الخادم. أعد المحاولة.');}
    catch{setLoggingOut(false);setLogoutError('تعذر إلغاء الجلسة على الخادم. أعد المحاولة.');return;}
    {
      const remaining = Math.max(0, 1400 - (performance.now() - startedAt));
      window.setTimeout(() => window.location.replace("/login"), remaining);
    }
  };

  const isDark = mounted && theme === "dark";
  const sidebarWidth = collapsed ? "lg:w-[92px]" : "lg:w-[232px]";
  const mainGap = collapsed ? "lg:mr-[112px]" : "lg:mr-[252px]";
  const footerGap = collapsed ? "lg:right-[132px]" : "lg:right-[272px]";
  const shellMotion = "rl-sidebar-motion";
  const customerOnboarding = accountType === "customer" && (pathname === "/Dashboard" || pathname.indexOf("/Dashboard/customer-plans") === 0 || pathname.indexOf("/Dashboard/customer-payment") === 0);
  useEffect(() => {
    if ((!network&&accountType !== "master_admin") || customerOnboarding) return;
    const root = shellRootRef.current, footer = footerRef.current;
    if (!root || !footer) return;
    const measure = () => root.style.setProperty("--rl-footer-space", `${Math.ceil(footer.getBoundingClientRect().height) + 32}px`);
    measure();const observer = new ResizeObserver(measure);observer.observe(footer);
    return () => { observer.disconnect();root.style.removeProperty("--rl-footer-space"); };
  }, [accountType, customerOnboarding,Boolean(network)]);

  const currentTitle = useMemo(() => {
    if (accountType === "master_admin" && new RegExp("^/Dashboard/connection-servers/[^/]+$").test(pathname) && !pathname.endsWith("/add")) return "تفاصيل وإعداد خادم الاتصال";
    if (pathname === home.href) return home.label;
    return findNavMatch(navGroups,pathname)?.item.label ?? "الصفحة الرئيسية";
  }, [pathname,accountType,network?.basePath,navGroups,home.href]);

  useEffect(() => {
    const match=findNavMatch(navGroups,pathname);
    if(match)setOpenNavGroups(current=>current[match.group.label]?current:{...current,[match.group.label]:true});
  }, [pathname,accountType,network?.basePath]);

  const revealNavGroup = (label: string) => {
    if(navRevealTimer.current)clearTimeout(navRevealTimer.current);
    navRevealTimer.current=setTimeout(() => {
      const nav = desktopNavRef.current, group = navGroupRefs.current[label];
      if (!nav || !group) return;
      const navRect = nav.getBoundingClientRect(), groupRect = group.getBoundingClientRect();
      const bottomSafe = navRect.bottom - 14, topSafe = navRect.top + 14;
      let delta = 0;
      if (groupRect.bottom > bottomSafe) delta = groupRect.bottom - bottomSafe;
      else if (groupRect.top < topSafe) delta = groupRect.top - topSafe;
      if (Math.abs(delta) > 2) nav.scrollTo({ top: nav.scrollTop + delta, behavior: "smooth" });
    }, 490);
  };

  const toggleNavGroup = (label: string, willOpen: boolean, mobile = false) => {
    if(navRevealTimer.current)clearTimeout(navRevealTimer.current);
    setOpenNavGroups((current) => ({ ...current, [label]: !current[label] }));
    if (willOpen && !mobile) revealNavGroup(label);
  };

  // Render directly so state updates preserve sidebar DOM and CSS transitions.
  const renderSidebarContent = (mobile = false) => {
    const compact = !mobile && collapsed;
    return (
      <div className="flex h-full flex-col">
        <div className={`flex items-center pb-4 pt-3 ${shellMotion} ${compact ? "justify-center px-0" : "justify-between px-3"}`}>
          <Brand compact={compact} />
          {mobile && <button onClick={() => setMobileOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200/80 dark:border-white/10" aria-label="إغلاق القائمة"><X className="h-5 w-5" /></button>}
        </div>
        <nav ref={mobile ? undefined : desktopNavRef} style={{overflowAnchor:"none"}} className={`sidebar min-h-0 flex-1 overflow-y-auto pb-3 scroll-smooth ${shellMotion} ${compact ? "px-3" : "px-2"}`}>
          {(accountType === "master_admin" || network) && (
            <div className="mb-3">
              <Link href={home.href} onClick={() => mobile && setMobileOpen(false)} title={compact ? home.label : undefined} className={`group flex min-h-12 items-center rounded-[18px] rl-nav-main text-[15px] font-medium ${shellMotion} ${pathname === home.href ? "bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.055] dark:text-white" : "text-slate-600 hover:bg-[#edf4fb] hover:text-[#0758e9] dark:text-white dark:hover:bg-white/[.045] dark:hover:text-white"} ${compact ? "justify-center px-0" : "gap-3 px-2"}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-all duration-500 ${pathname === home.href ? "sidebar-active-icon bg-gradient-to-br from-[#1479ff] to-[#0758e9] text-white shadow-[0_8px_20px_rgba(20,121,255,.28)]" : "bg-[#e2e9f1] text-[#315985] dark:bg-[#3b383e] dark:text-[#c4bec8]"}`}><Home className="h-5 w-5" /></span>
                <span className={`overflow-hidden whitespace-nowrap font-[600] ${shellMotion} ${compact ? "max-w-0 -translate-x-2 opacity-0" : "max-w-[180px] opacity-100"}`}>الصفحة الرئيسية</span>
              </Link>
            </div>
          )}
          {(navGroups).map((group) => {
            const GroupIcon = group.icon;
            const groupActive = findNavMatch(navGroups,pathname)?.group.label===group.label;
            const open = Boolean(openNavGroups[group.label]);
            return <div key={group.label} ref={mobile ? undefined : (el) => { navGroupRefs.current[group.label] = el; }} className="mb-2">
              <button type="button" onClick={() => compact && !mobile ? setCollapsed(false) : toggleNavGroup(group.label, !open, mobile)} title={compact ? group.label : undefined} className={`group flex min-h-12 w-full items-center rounded-[18px] rl-nav-main text-[15px] font-medium ${shellMotion} ${groupActive ? "text-[#0758e9] dark:text-white" : "text-slate-600 hover:bg-[#edf4fb] hover:text-[#0758e9] dark:text-white dark:hover:bg-white/[.045] dark:hover:text-white"} ${compact ? "justify-center px-0" : "gap-3 px-2"}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-all duration-500 ${groupActive ? "sidebar-active-icon bg-gradient-to-br from-[#1479ff] to-[#0758e9] text-white shadow-[0_8px_20px_rgba(20,121,255,.20)]" : "bg-[#e2e9f1] text-[#315985] group-hover:bg-[#d7e7f8] dark:bg-[#3b383e] dark:text-[#c4bec8] dark:group-hover:bg-[#454149] dark:group-hover:text-[#f1eef4]"}`}><GroupIcon className="h-5 w-5" /></span>
                <span className={`min-w-0 flex-1 overflow-hidden ${group.label === "الخوادم والبنية التحتية" ? "whitespace-normal leading-5" : "whitespace-nowrap"} text-right font-[600] ${shellMotion} ${compact ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"}`}>{group.label}</span>
                {!compact && <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-500 ${open ? "rotate-180" : ""}`} />}
              </button>
              <div className={`grid transition-[grid-template-rows,opacity] duration-[450ms] ease-[cubic-bezier(.45,0,.25,1)] motion-reduce:transition-none ${!compact && open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="min-h-0 overflow-hidden"><div className="space-y-1 py-1 pr-5">
                  {group.items.map((item) => {
                    const Icon = item.icon; const active = findNavMatch(navGroups,pathname)?.item.href===item.href;
                    return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} onClick={() => mobile && setMobileOpen(false)} className={`flex min-h-10 items-center gap-2 rounded-[14px] px-2 rl-nav-sub text-[13px] font-medium transition ${active ? "bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.055] dark:text-white" : "text-slate-500 hover:bg-[#edf4fb] hover:text-[#0758e9] dark:text-white dark:hover:bg-white/[.045] dark:hover:text-white"}`}><Icon className="h-4 w-4 shrink-0" /><span>{item.label}</span></Link>;
                  })}
                </div></div>
              </div>
            </div>;
          })}
        </nav>
        <div className={`p-2 ${shellMotion}`}><button type="button" onClick={logout} disabled={loggingOut} className={`flex min-h-12 w-full items-center rounded-[18px] border border-red-500 text-[15px] font-semibold text-red-500 hover:bg-red-50 disabled:cursor-wait disabled:opacity-70 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-500/10 ${shellMotion} ${compact ? "justify-center px-0" : "gap-3 px-2"}`}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-500 rl-sidebar-motion dark:bg-red-500/10 dark:text-red-400"><LogOut className="h-5 w-5" /></span>
          <span className={`overflow-hidden whitespace-nowrap rl-sidebar-motion ${compact ? "max-w-0 -translate-x-2 opacity-0" : "max-w-[120px] translate-x-0 opacity-100"}`}>{loggingOut ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج"}</span>
        </button></div>
      </div>
    );
  };

  if (customerOnboarding) {
    return <CustomerOnboardingShell>{children}</CustomerOnboardingShell>;
  }

  return (
    <>
    
    <div ref={shellRootRef} dir="rtl" className={`dashboard-shell-root ${subscribersWorkspace?"rl-hostinger-subscribers":""} relative h-screen overflow-hidden ${subscribersWorkspace ? "bg-[#f1f3f5] dark:bg-[#0b1b2a]" : "bg-[#dce5ef] dark:bg-[#1d1721]"} text-[#102a63] transition-colors dark:text-[#f4f1f5] ${loggingOut ? "dashboard-logout-active" : ""}`}>
      <aside onPointerEnter={event => { if (event.pointerType !== "touch") scheduleSidebar(false); }} onPointerLeave={event => { if (event.pointerType !== "touch") scheduleSidebar(true); }} className={`dashboard-logout-surface fixed bottom-3 right-3 top-3 z-40 hidden ${sidebarWidth} overflow-hidden rounded-[22px] border border-white/70 bg-[#f9fbfe]/95 shadow-[0_16px_44px_rgba(46,75,107,.12)] backdrop-blur-xl ${shellMotion} dark:border-white/[.10] dark:bg-[#302e33]/95 dark:shadow-[0_18px_50px_rgba(0,0,0,.22)] lg:block`}>
        {renderSidebarContent()}
      </aside>
      <div ref={element => { if (element) element.inert = !mobileOpen; }} aria-hidden={!mobileOpen} data-open={mobileOpen} className="rl-mobile-sidebar dashboard-logout-surface fixed inset-0 z-[80] lg:hidden"><button className="rl-mobile-sidebar-backdrop absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة" /><aside className="rl-mobile-sidebar-panel absolute bottom-3 right-3 top-3 w-[min(86vw,330px)] overflow-hidden rounded-[22px] border border-white/70 bg-[#f9fbfe] shadow-2xl dark:border-white/10 dark:bg-[#302e33]">{renderSidebarContent(true)}</aside></div>

      <div className={`dashboard-main-shell dashboard-logout-surface ${mainGap} h-screen min-w-0 overflow-hidden ${shellMotion}`}>
        <header className="relative z-30 px-3 pt-3 md:px-4 lg:px-5"><div className="flex min-h-[62px] items-center gap-3 rounded-[16px] border border-white/80 bg-[#f9fbfe]/95 px-3.5 shadow-[0_12px_34px_rgba(60,88,116,.10)] backdrop-blur-xl dark:border-white/[.10] dark:bg-[#302e33]/95 dark:shadow-[0_12px_34px_rgba(0,0,0,.18)] sm:px-5">
          <button onClick={() => setMobileOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#d5e2ef] bg-white text-[#0758e9] dark:border-white/10 dark:bg-[#38363c] dark:text-white lg:hidden" aria-label="فتح القائمة"><Menu className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1 px-1">
            {(() => {
              const match=findNavMatch(navGroups,pathname);
              const group=match?.group;
              const current=match?.item;
              const currentLabel=accountType==="master_admin"&&new RegExp("^/Dashboard/connection-servers/[^/]+$").test(pathname)&&!pathname.endsWith("/add")?"تفاصيل وإعداد خادم الاتصال":current?.label??currentTitle;
              return <nav aria-label="دليل التنقل" dir="rtl" className="rl-breadcrumb flex min-w-0 items-center gap-2 overflow-visible text-[13px] font-medium sm:gap-2.5 sm:text-sm">
                <Link href={home.href} aria-label={home.label} title={home.label} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#5f6368] transition hover:bg-black/[.04] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8eabc8] dark:text-slate-400 dark:hover:bg-white/[.06] dark:hover:text-white"><Home className="h-[18px] w-[18px]"/></Link>
                <ChevronLeft aria-hidden="true" className="h-4 w-4 shrink-0 text-[#9aa0a6] dark:text-slate-500"/>
                {group&&<><Link href={group.items[0]?.href||home.href} dir="auto" className="min-w-0 max-w-[34vw] truncate text-[#5f6368] transition hover:text-[#202124] focus-visible:outline-none focus-visible:underline dark:text-slate-400 dark:hover:text-slate-100">{group.label}</Link><ChevronLeft aria-hidden="true" className="h-4 w-4 shrink-0 text-[#9aa0a6] dark:text-slate-500"/></>}
                {group&&group.items.length>1?<div ref={sectionMenuRef} className="relative min-w-0 shrink"><button type="button" aria-current="page" aria-haspopup="menu" aria-expanded={sectionMenuOpen} onClick={()=>setSectionMenuOpen(value=>!value)} title="التنقل بين صفحات القسم" className="flex min-w-0 items-center gap-1.5 rounded-md px-0.5 py-1 text-left font-semibold text-[#202124] transition hover:text-[#0758e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8eabc8] dark:text-slate-100 dark:hover:text-white"><span dir="auto" className="truncate">{currentLabel}</span><ChevronDown aria-hidden="true" className={`h-3 w-3 shrink-0 text-[#777a80] transition-transform ${sectionMenuOpen?"rotate-180":""}`}/></button>{sectionMenuOpen&&<div role="menu" aria-label={`أقسام ${group.label}`} className="ui-state-enter absolute left-0 top-[calc(100%+8px)] z-[90] w-[230px] overflow-hidden rounded-[16px] border border-[#d7e3ef] bg-[#f9fbfe] p-1.5 text-right shadow-[0_18px_45px_rgba(44,65,92,.22)] dark:border-white/[.12] dark:bg-[#302e33] dark:shadow-[0_22px_55px_rgba(0,0,0,.38)]">{group.items.map((item)=>{const ItemIcon=item.icon;const active=item.href===current?.href;return <Link key={item.href} href={item.href} role="menuitem" aria-current={active?"page":undefined} onClick={()=>setSectionMenuOpen(false)} className={`flex min-h-10 items-center gap-2.5 rounded-[12px] px-2.5 text-xs font-semibold transition ${active?"bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.08] dark:text-white":"text-slate-600 hover:bg-[#edf4fb] hover:text-[#0758e9] dark:text-slate-300 dark:hover:bg-white/[.05] dark:hover:text-white"}`}><ItemIcon className="h-4 w-4 shrink-0 text-[#0758e9] dark:text-[#8ab5ff]"/><span className="min-w-0 flex-1">{item.label}</span>{active&&<span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"/>}</Link>})}</div>}</div>:<span aria-current="page" dir="auto" className="min-w-0 truncate px-0.5 py-1 font-semibold text-[#202124] dark:text-slate-100">{currentLabel}</span>}
              </nav>;
            })()}
          </div>
          <div className="mr-auto flex items-center gap-2 sm:gap-3">
            {!network&&<div className="hidden min-h-10 items-center gap-3 rounded-[22px] border border-[#d7e3ef] bg-white px-4 dark:border-white/[.10] dark:bg-[#38363c] md:flex"><Radio className="h-5 w-5 text-[#0758e9]" /><div className="leading-tight"><div className="text-xs font-bold">RADIUS</div><div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-[#b9b3bd]"><span className="h-2 w-2 rounded-full bg-emerald-500" />Online</div></div></div>}
            <button type="button" className="group relative grid h-10 w-10 place-items-center rounded-full border border-[#e5e5e8] bg-[#f4f4f5] text-[#5f6268] transition-all duration-200 hover:bg-white hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8eabc8] dark:border-white/[.10] dark:bg-[#172b40] dark:text-slate-300 dark:hover:bg-[#29435d] dark:hover:text-white" aria-label="الإشعارات، 3 غير مقروءة" title="الإشعارات"><Bell className="h-[18px] w-[18px] transition-transform duration-200 group-hover:-rotate-6" /><span className="absolute -left-1 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full border-2 border-white bg-[#ffad16] px-1 text-[9px] font-bold leading-none text-[#17386d] dark:border-[#302e33]">3</span></button>
            <button type="button" onClick={() => setTheme(isDark ? "light" : "dark")} className="grid h-10 w-10 place-items-center rounded-full border border-[#e5e5e8] bg-[#f4f4f5] text-[#5f6268] transition-all duration-200 hover:bg-white hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8eabc8] dark:border-white/[.10] dark:bg-[#172b40] dark:text-slate-300 dark:hover:bg-[#29435d] dark:hover:text-white" aria-label="تبديل الوضع">{mounted && isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
            <div className="relative hidden sm:block">
              <button type="button" onClick={() => setAccountOpen((open) => !open)} aria-haspopup="menu" aria-expanded={accountOpen} className={`flex items-center gap-2 rounded-full border py-1 pr-2 pl-3 transition-all duration-200 ease-[cubic-bezier(.22,.8,.25,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8eabc8] ${accountOpen ? "border-[#e5e5e8] bg-white shadow-[0_1px_4px_rgba(0,0,0,.14)] dark:border-white/[.10] dark:bg-[#29435d] dark:shadow-[0_1px_4px_rgba(0,0,0,.32)]" : "border-[#e5e5e8] bg-[#f4f4f5] hover:bg-white dark:border-white/[.10] dark:bg-[#172b40] dark:hover:bg-[#29435d]"}`}><div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#0e74ff] to-[#073dbd] text-white"><Crown className="h-4 w-4 text-[#ffad16]" /></div><div className="leading-tight text-right"><div className="max-w-[120px] truncate text-xs font-bold">{account?.fullName || "..."}</div><div className="mt-0.5 text-[10px] text-slate-500 dark:text-[#b9b3bd]">{accountType === "master_admin" ? "Master Admin" : "Customer"}</div></div></button>
              <div role="menu" className={`absolute left-0 top-[calc(100%+6px)] z-[70] w-[225px] origin-top-left rounded-[20px] border border-[#d7e3ef] bg-[#f9fbfe] p-2 shadow-[0_18px_45px_rgba(44,65,92,.22)] transition-all duration-300 ease-[cubic-bezier(.22,.8,.25,1)] dark:border-white/[.12] dark:bg-[#302e33] dark:shadow-[0_22px_55px_rgba(0,0,0,.38)] ${accountOpen ? "visible translate-y-0 scale-100 opacity-100" : "invisible -translate-y-2 scale-[.97] opacity-0 pointer-events-none"}`}>
                <div className="mb-2 flex items-center gap-3 rounded-[16px] border border-[#e5e5e8] bg-[#f4f4f5] px-3 py-2.5 dark:border-white/[.10] dark:bg-[#172b40]"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#0e74ff] to-[#073dbd] text-white"><Crown className="h-5 w-5 text-[#ffad16]" /></div><div className="min-w-0 leading-tight"><div className="truncate text-sm font-bold">{account?.fullName || "..."}</div><div className="mt-1 text-[10px] text-slate-500 dark:text-[#b9b3bd]">{accountType === "master_admin" ? "Master Admin" : "Customer"}</div></div></div>
                <Link href={network?`${network.basePath}?tab=settings`:"/Dashboard/profile"} onClick={() => setAccountOpen(false)} role="menuitem" className="group flex min-h-11 items-center gap-3 rounded-[14px] px-3 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-[#edf4fb] hover:text-[#0758e9] dark:text-[#ece8ee] dark:hover:bg-[#38363c] dark:hover:text-white"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e2e9f1] text-[#315985] transition group-hover:bg-[#d7e7f8] group-hover:text-[#0758e9] dark:bg-[#3b383e] dark:text-[#c4bec8]"><UserRound className="h-4 w-4" /></span><span>معلومات الحساب</span></Link>
                <Link href={network?`${network.basePath}?tab=settings`:"/Dashboard/settings"} onClick={() => setAccountOpen(false)} role="menuitem" className="group mt-1 flex min-h-11 items-center gap-3 rounded-[14px] px-3 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-[#edf4fb] hover:text-[#0758e9] dark:text-[#ece8ee] dark:hover:bg-[#38363c] dark:hover:text-white"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e2e9f1] text-[#315985] transition group-hover:bg-[#d7e7f8] group-hover:text-[#0758e9] dark:bg-[#3b383e] dark:text-[#c4bec8]"><Settings className="h-4 w-4" /></span><span>إعدادات الحساب</span></Link>
                <div className="my-2 h-px bg-slate-200/80 dark:bg-white/[.08]" />
                <button type="button" onClick={logout} disabled={loggingOut} role="menuitem" className="group flex min-h-11 w-full items-center gap-3 rounded-[14px] border border-red-400/70 px-3 text-sm font-semibold text-red-500 transition-all duration-200 hover:bg-red-50 disabled:cursor-wait disabled:opacity-70 dark:border-red-400/55 dark:text-red-400 dark:hover:bg-red-500/10"><span className="grid h-8 w-8 place-items-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400"><LogOut className="h-4 w-4" /></span><span>{loggingOut ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج"}</span></button>
              </div>
            </div>
          </div>
        </div></header>
        <main style={accountType === "master_admin" || network ? {paddingBottom:"var(--rl-footer-space)"} : undefined} className={`h-[calc(100dvh-74px)] overflow-hidden px-3 pt-3 md:px-4 lg:px-5 ${customerOnboarding ? "pb-3" : accountType === "master_admin" ? "pb-[210px] sm:pb-[132px] xl:pb-[84px]" : "pb-[66px]"}`}><div className={`workspace-frame ${accountType === "master_admin" || (network && !subscribersWorkspace) ? "rl-workspace-separated" : ""} h-full ${subscribersWorkspace?"rounded-[22px] border border-[#b7c0ca] bg-transparent shadow-none dark:border-[#40556a] dark:bg-transparent":"rounded-[22px] border border-[#a9c8e8] bg-[#edf3f8]/80 shadow-[inset_0_1px_0_rgba(255,255,255,.9)] dark:border-white/[.08] dark:bg-[#211a25] dark:shadow-none"} ${customerOnboarding ? "flex min-h-0 flex-col overflow-hidden p-0" : "overflow-hidden pb-[18px]"}`}>

          <div className={customerOnboarding ? "min-w-0" : "workspace-scroll rl-workspace-inset-scroll h-full min-w-0 overflow-y-auto p-3 sm:p-4"}><div className={customerOnboarding ? "" : "rl-workspace-content-end"}>{children}</div></div>
        </div></main>
        {!customerOnboarding && <footer ref={footerRef} className={`fixed bottom-3 left-3 right-3 z-30 md:left-4 lg:left-5 ${footerGap} ${shellMotion}`}>{network?network.footer:accountType === "master_admin" ? <ServerStatusFooter/> : <div className="flex min-h-[46px] flex-wrap items-center gap-x-5 gap-y-1 rounded-[12px] border border-white/80 bg-[#f9fbfe]/95 px-4 py-1.5 text-[10px] text-slate-500 shadow-[0_10px_28px_rgba(60,88,116,.09)] backdrop-blur-xl dark:border-white/[.10] dark:bg-[#302e33]/95 dark:text-[#b9b3bd] dark:shadow-[0_8px_24px_rgba(0,0,0,.16)]">
          <div className="flex items-center gap-2"><Database className="h-4 w-4 text-[#0758e9]" /><span>radius.lord.local</span></div><div className="hidden h-5 w-px bg-slate-200 dark:bg-white/10 sm:block" /><div><span className="font-semibold text-slate-700 dark:text-[#f4f1f5]">Ubuntu 22.04.4 LTS</span></div><div className="hidden h-5 w-px bg-slate-200 dark:bg-white/10 md:block" /><div className="hidden items-center gap-2 md:flex"><span>CPU</span><span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><span className="block h-full w-[23%] rounded-full bg-[#ffad16]" /></span><b>23%</b></div><div className="hidden items-center gap-2 lg:flex"><span>RAM</span><span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><span className="block h-full w-[42%] rounded-full bg-[#1479ff]" /></span><b>42%</b></div><div className="mr-auto flex items-center gap-4"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />FreeRADIUS</span><span className="hidden items-center gap-1.5 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" />MySQL</span><span className="font-semibold text-slate-700 dark:text-[#f4f1f5]">10:24:45 AM</span></div>
        </div>}</footer>}
      </div>

      <FloatingNotice error={logoutError} onDismiss={()=>setLogoutError("")}/>
      {loggingOut && <TransitionOverlay variant="logout" />}

      <style jsx global>{`
        @keyframes dashboardLogoutFade { from { opacity: 1; transform: scale(1); filter: blur(0); } to { opacity: .28; transform: scale(.988); filter: blur(2px); } }
        .dashboard-logout-active .dashboard-logout-surface { pointer-events: none; animation: dashboardLogoutFade .34s cubic-bezier(.22,.8,.25,1) both; }
        @media (prefers-reduced-motion: reduce) { .dashboard-logout-active .dashboard-logout-surface { animation: none !important; } }
      `}</style>
    </div>
    </>
  );
}
