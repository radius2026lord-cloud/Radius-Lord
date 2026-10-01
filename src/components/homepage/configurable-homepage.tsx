"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowLeft, CheckCircle2, CreditCard, Home, Layers3, RefreshCw, Settings2, Users } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { type HomepageConfig } from "@/lib/homepage-config";
import { CollectionState, CollectionStatusFilters, CollectionTable, CollectionTableBody, CollectionTableHead, CollectionToolbar, collectionRowClass } from "@/components/ui/collection-display";

type ActivityItem = { id: string; customerId: number; customerName: string; username: string | null; title: string; description: string; status: string; paymentCode?: string; createdAt: string };
type HomepageData = { settings: HomepageConfig; summary: { totalOrders: number; awaitingConfirmation: number; paid: number; completed: number }; activity: ActivityItem[] };
const statuses: Record<string, string> = { account: "حساب جديد", pending: "جديد", awaiting_confirmation: "بانتظار التأكيد", paid: "تم الدفع", completed: "مكتمل", cancelled: "ملغي", expired: "منتهي" };

export default function ConfigurableHomepage() {
  const { account, accountType, loading: authLoading } = useAuth();
  const [data, setData] = useState<HomepageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (authLoading || !accountType) return;
    const controller = new AbortController();
    setData(null); setLoading(true); setError("");
    let inFlight = false;
    const load = async () => {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true; setRefreshing(true);
      try {
        const response = await fetch("/api/homepage", { credentials: "include", cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "تعذر تحميل الصفحة الرئيسية.");
        if (!controller.signal.aborted) { setData(result); setError(""); }
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "تعذر تحميل الصفحة الرئيسية."); }
      finally { inFlight = false; if (!controller.signal.aborted) { setLoading(false); setRefreshing(false); } }
    };
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 30000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [authLoading, accountType, account?.id, revision]);

  if (authLoading) return <CollectionState>جارٍ تحميل حسابك...</CollectionState>;
  const master = accountType === "master_admin";
  return <div dir="rtl" className="space-y-3 sm:space-y-4">
    <header className="rl-surface flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-white p-4 dark:bg-[#0d243b]">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-[#17386d] dark:text-slate-100"><Home className="h-5 w-5 text-[#0758e9]" />الصفحة الرئيسية</h1><p className="mt-1 text-xs text-slate-500">{master ? "متابعة نشاط المنصة وطلبات العملاء" : "متابعة طلباتك ونشاط حسابك"}</p></div>
      <div className="flex flex-wrap gap-2">{master && <Link href="/Dashboard/settings/homepage" className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#bfd4ea] px-3 text-xs text-[#0758e9] dark:border-white/10 dark:text-[#8fc0ff]"><Settings2 className="h-4 w-4" />تخصيص الصفحة</Link>}
        <button type="button" disabled={refreshing} onClick={() => setRevision(value => value + 1)} className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#bfd4ea] px-3 text-xs text-[#17386d] disabled:opacity-50 dark:border-white/10 dark:text-slate-200"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />تحديث</button></div>
    </header>
    {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
    {loading ? <CollectionState>جارٍ تحميل الصفحة الرئيسية...</CollectionState> : data && <>
      {data.settings.sections.filter(section => section.enabled).map(section => {
        switch (section.id) {
          case "welcome": return <section key={section.id} className="rl-surface rounded-[22px] bg-white p-5 dark:bg-[#0d243b]"><h2 className="text-base font-semibold text-[#17386d] dark:text-slate-100">أهلًا، {account?.fullName || account?.username || "بك"}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-500 dark:text-slate-400">{data.settings.welcomeText}</p></section>;
          case "statistics": return <HomepageStatistics key={section.id} summary={data.summary} />;
          case "activity": return <HomepageActivity key={section.id} items={data.activity} master={master} />;
          case "shortcuts": return <HomepageShortcuts key={section.id} master={master} />;
        }
      })}
      {!data.settings.sections.some(section => section.enabled) && <CollectionState>لا توجد أقسام مفعّلة في الصفحة الرئيسية حاليًا.</CollectionState>}
    </>}
  </div>;
}

function HomepageStatistics({ summary }: { summary: HomepageData["summary"] }) {
  const items = [
    { label: "طلبات الدفع", value: summary.totalOrders, icon: CreditCard },
    { label: "بانتظار التأكيد", value: summary.awaitingConfirmation, icon: Activity },
    { label: "تم الدفع", value: summary.paid, icon: CheckCircle2 },
    { label: "طلبات مكتملة", value: summary.completed, icon: Layers3 },
  ];
  return <section aria-label="الإحصاءات" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map(item => <article key={item.label} className="rl-surface flex items-center justify-between rounded-[22px] bg-white p-4 dark:bg-[#0d243b]"><div><p className="text-xs text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-bold text-[#17386d] dark:text-white">{item.value.toLocaleString("ar")}</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e9f2ff] text-[#0758e9] dark:bg-blue-500/10"><item.icon className="h-5 w-5" /></span></article>)}</section>;
}

function HomepageShortcuts({ master }: { master: boolean }) {
  const links = master ? [
    { label: "العملاء", href: "/Dashboard/customers", icon: Users },
    { label: "الخطط", href: "/Dashboard/plans", icon: Layers3 },
    { label: "الاشتراكات", href: "/Dashboard/subscriptions", icon: CreditCard },
    { label: "عمليات الدفع", href: "/Dashboard/payments", icon: CheckCircle2 },
  ] : [{ label: "استعراض الخطط والاشتراك", href: "/Dashboard/customer-plans", icon: Layers3 }];
  return <section className="rl-surface rounded-[22px] bg-white p-4 dark:bg-[#0d243b]"><h2 className="mb-3 text-sm font-semibold text-[#17386d] dark:text-slate-100">الاختصارات</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{links.map(link => <Link key={link.href} href={link.href} className="rl-surface-soft flex items-center gap-3 rounded-[16px] bg-[#f9fbfe] p-4 text-xs font-semibold text-[#17386d] transition hover:bg-[#e9f2ff] dark:bg-white/[.035] dark:text-slate-200"><link.icon className="h-5 w-5 text-[#0758e9]" /><span className="flex-1">{link.label}</span><ArrowLeft className="h-4 w-4" /></Link>)}</div></section>;
}

function HomepageActivity({ items, master }: { items: ActivityItem[]; master: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const rows = useMemo(() => items.filter(item => (filter === "all" || item.status === filter) && [item.customerName, item.username, item.title, item.description, item.paymentCode].filter(Boolean).some(value => String(value).toLowerCase().includes(query.trim().toLowerCase()))), [items, query, filter]);
  const open = (item: ActivityItem) => {
    if (item.paymentCode) router.push(master ? `/Dashboard/payments?code=${encodeURIComponent(item.paymentCode)}` : `/Dashboard/customer-payment?order=${encodeURIComponent(item.paymentCode)}`);
    else if (master) router.push(`/Dashboard/customers/${item.customerId}`);
  };
  return <section className="space-y-3">
    <CollectionToolbar icon={Activity} title="آخر النشاطات" description={master ? "آخر نشاطات الحسابات وطلبات الدفع على المنصة" : "آخر نشاطات حسابك وطلبات الدفع الخاصة بك"} query={query} onQueryChange={setQuery} searchPlaceholder="بحث في النشاطات..." filters={<CollectionStatusFilters value={filter} onChange={setFilter} items={[{ value: "all", label: "الكل", count: items.length, dot: "bg-[#0758e9]" }, ...["account", "pending", "awaiting_confirmation", "paid"].map(status => ({ value: status, label: statuses[status], count: items.filter(item => item.status === status).length, dot: status === "paid" ? "bg-emerald-500" : "bg-amber-500" }))]} />} />
    {rows.length === 0 ? <CollectionState>لا توجد نشاطات مطابقة.</CollectionState> : <CollectionTable><CollectionTableHead><tr>{master && <th className="p-3">العميل</th>}<th className="p-3">النشاط</th><th>الخطة</th><th>كود الدفع</th><th>الحالة</th><th>التاريخ</th></tr></CollectionTableHead><CollectionTableBody>{rows.map(item => <tr key={item.id} onClick={() => open(item)} className={collectionRowClass(false)}>{master && <td className="p-3"><b className="block">{item.customerName}</b><span className="text-[10px] text-slate-400">@{item.username || "—"}</span></td>}<td className="p-3 font-semibold">{item.title}</td><td>{item.description}</td><td dir="ltr" className="font-mono text-[10px] text-[#0758e9]">{item.paymentCode || "—"}</td><td><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] dark:bg-white/10">{statuses[item.status] || item.status}</span></td><td>{formatDate(item.createdAt)}</td></tr>)}</CollectionTableBody></CollectionTable>}
  </section>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(date);
}
