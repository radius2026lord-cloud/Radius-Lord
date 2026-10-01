"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleDollarSign, RefreshCw } from "lucide-react";
import ProjectDropdown from "@/components/ui/project-dropdown";
import ProjectInput from "@/components/ui/project-input";
import PaymentPurposeBadge from "@/components/payments/payment-purpose-badge";
import { paymentPurposeOptions } from "@/lib/payment-display";
import { useAuth } from "@/components/auth/auth-provider";
import { CollectionState, CollectionTable, CollectionTableBody, CollectionTableHead } from "@/components/ui/collection-display";

type Amount = { amount: string; count: number };
type ReceivedPayment = { id:number; customerId:number; customerName:string; customerUsername:string|null; customerEmail:string; paymentCode:string; purpose:string; planName:string; deploymentName:string|null; purchasedItems:string[]; amount:string; currency:string; paidAt:string; confirmedBy:string|null };
type Report = { payments:ReceivedPayment[]; currencies:string[]; pagination:{page:number;pageSize:number;total:number}; date: string; group: "day" | "month" | "year"; summary: { currency: string; day: Amount; month: Amount; year: Amount }[]; series: { period: string; currency: string; count: number; amount: string }[] };
const labels = { day: "يومي", month: "شهري", year: "سنوي" };

export default function CollectionReportsPage() {
  const { accountType, loading: authLoading } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [date, setDate] = useState("");
  const [group, setGroup] = useState<Report["group"]>("day");
  const [currency, setCurrency] = useState("all");
  const [purpose,setPurpose]=useState("all");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (authLoading || accountType !== "master_admin") return;
    const controller = new AbortController();
    setLoading(true); setError(""); setReport(null);
    const params = new URLSearchParams({ group,currency,purpose,search,page:String(page) });
    if (date) params.set("date", date);
    fetch(`/api/billing/admin/collection-report?${params}`, { credentials: "include", cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تعذر تحميل تقرير التحصيل.");
      if (!controller.signal.aborted) setReport(data);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "تعذر تحميل التقرير."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [authLoading, accountType, date, group, currency, purpose, search, page, revision]);

  const currencies=useMemo(()=>Array.from(new Set([...(report?.currencies??[]),...(currency==='all'?[]:[currency])])).sort(),[report,currency]);
  const activeCurrency=currency;
  const summaries = report?.summary.filter(item => activeCurrency === "all" || item.currency === activeCurrency) ?? [];
  const rows = useMemo(() => {
    if (!report) return [];
    const visibleCurrencies = activeCurrency === "all" ? currencies : [activeCurrency];
    if (report.group === "year") return report.series.filter(item => activeCurrency === "all" || item.currency === activeCurrency);
    const [year, month] = report.date.split("-").map(Number);
    const periods = report.group === "day" ? Array.from({ length: new Date(Date.UTC(year, month, 0)).getUTCDate() }, (_, index) => `${report.date.slice(0, 7)}-${String(index + 1).padStart(2, "0")}`) : Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
    const values = new Map(report.series.map(item => [`${item.period}:${item.currency}`, item]));
    return periods.flatMap(period => visibleCurrencies.map(code => values.get(`${period}:${code}`) ?? { period, currency: code, count: 0, amount: "0.00" }));
  }, [report, currencies, activeCurrency]);

  if (authLoading) return <CollectionState>جارٍ تحميل حسابك...</CollectionState>;
  if (accountType !== "master_admin") return <CollectionState>تقارير التحصيل متاحة للمسؤول الرئيسي فقط.</CollectionState>;
  return <div dir="rtl" className="space-y-4">
    <header className="rl-surface flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-white p-4 dark:bg-[#0d243b]"><div><h1 className="flex items-center gap-2 text-lg font-semibold text-[#17386d] dark:text-white"><CircleDollarSign className="h-5 w-5 text-[#0758e9]" />تقارير التحصيل</h1><p className="mt-1 text-xs leading-6 text-slate-500">المبالغ المؤكدة حسب تاريخ التحصيل، مع إجماليات مستقلة لكل عملة.</p></div><div className="flex gap-2"><Link href="/Dashboard/payments" className="inline-flex h-10 items-center rounded-[14px] border border-[#bfd4ea] px-3 text-xs text-[#0758e9] dark:border-white/10 dark:text-[#8fc0ff]">عمليات الدفع</Link><button type="button" disabled={loading} onClick={() => setRevision(value => value + 1)} className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#bfd4ea] px-3 text-xs text-[#17386d] disabled:opacity-50 dark:border-white/10 dark:text-slate-200"><RefreshCw className="h-4 w-4" />تحديث</button></div></header>
    <section className="rl-surface flex flex-wrap items-end gap-3 rounded-[22px] bg-white p-4 dark:bg-[#0d243b]">
      <label className="text-xs text-slate-500"><span className="mb-2 flex items-center gap-1"><CalendarDays className="h-4 w-4" />تاريخ الجرد</span><input type="date" min="2000-01-01" max="9998-12-31" value={date || report?.date || ""} onChange={event => {setDate(event.target.value);setPage(1);}} className="allow-text-selection h-10 rounded-[14px] border border-[#d7e3ef] bg-[#f9fbfe] px-3 text-sm dark:border-white/10 dark:bg-white/5" /></label>
      <div className="min-w-[150px] text-xs text-slate-500"><span className="mb-2 block">تفصيل التقرير</span><ProjectDropdown value={group} onChange={value=>{setGroup(value as Report["group"]);setPage(1);}} options={Object.entries(labels).map(([value,label])=>({value,label}))}/></div>
      <div className="min-w-[220px] text-xs text-slate-500"><span className="mb-2 block">العملة</span><ProjectDropdown value={currency} onChange={value=>{setCurrency(value);setPage(1);}} options={[{value:"all",label:"جميع العملات بصورة منفصلة"},...currencies.map(value=>({value,label:value}))]}/></div>
      <div className="min-w-[170px] text-xs text-slate-500"><span className="mb-2 block">نوع العملية</span><ProjectDropdown value={purpose} onChange={value=>{setPurpose(value);setPage(1);}} options={[{value:"all",label:"جميع العمليات"},...paymentPurposeOptions]}/></div>
      <label className="min-w-[200px] flex-1 text-xs text-slate-500"><span className="mb-2 block">حساب العميل</span><ProjectInput maxLength={120} value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}} placeholder="الاسم أو المستخدم أو البريد الإلكتروني"/></label>
    </section>
    {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
    {loading ? <CollectionState>جارٍ تحميل التحصيل...</CollectionState> : report && <>
      <div className="grid gap-3 lg:grid-cols-3">{(["day", "month", "year"] as const).map(period => <section key={period} className="rl-surface rounded-[22px] bg-white p-4 dark:bg-[#0d243b]"><h2 className="text-sm font-semibold text-[#17386d] dark:text-white">{period === "day" ? "تحصيل اليوم المحدد" : period === "month" ? "تحصيل الشهر المحدد" : "تحصيل السنة المحددة"}</h2><p className="mt-1 text-[11px] text-slate-400" dir="ltr">{report.date.slice(0, period === "day" ? 10 : period === "month" ? 7 : 4)}</p><div className="mt-4 space-y-3">{summaries.length ? summaries.map(item => <div key={item.currency} className="flex flex-wrap items-center justify-between gap-2"><b className="text-xl text-[#17386d] dark:text-white" dir="ltr">{formatAmount(item[period].amount)} <span className="text-xs font-normal">{item.currency}</span></b><span className="text-xs text-slate-500">{item[period].count} دفعة</span></div>) : <p className="text-xs text-slate-400">لا توجد دفعات مؤكدة في هذه السنة.</p>}</div></section>)}</div>
      <section className="space-y-3"><div><h2 className="text-sm font-semibold text-[#17386d] dark:text-white">{group === "day" ? `التحصيل اليومي لشهر ${report.date.slice(0, 7)}` : group === "month" ? `التحصيل الشهري لسنة ${report.date.slice(0, 4)}` : "التحصيل السنوي لجميع السنوات"}</h2><p className="mt-1 text-xs text-slate-500">تشمل الدفعات المؤكدة والطلبات المكتملة، وتُستبعد الطلبات غير المدفوعة والملغاة والمنتهية. التواريخ حسب توقيت الخادم.</p></div>
        {rows.length === 0 ? <CollectionState>لا توجد دفعات مؤكدة لهذه الفترة.</CollectionState> : <CollectionTable><CollectionTableHead><tr><th className="p-3">الفترة</th><th>العملة</th><th>عدد الدفعات</th><th>المبلغ المحصّل</th></tr></CollectionTableHead><CollectionTableBody>{rows.map(row => <tr key={`${row.period}-${row.currency}`} className="border-t border-slate-100 dark:border-white/10"><td className="p-3" dir="ltr">{row.period}</td><td>{row.currency}</td><td>{row.count}</td><td dir="ltr" className="font-semibold">{formatAmount(row.amount)}</td></tr>)}</CollectionTableBody></CollectionTable>}
      </section>
      <section className="space-y-3">
        <div><h2 className="text-sm font-semibold text-[#17386d] dark:text-white">تفاصيل الدفعات المستلمة</h2><p className="mt-1 text-xs text-slate-500">الحساب الذي دفع، ونوع العملية، والخطة والإضافات المشتراة خلال الفترة المعروضة. الإجماليات أعلاه تتبع الفلاتر نفسها.</p></div>
        {report.payments.length===0?<CollectionState>لا توجد دفعات مستلمة مطابقة.</CollectionState>:<>
          <CollectionTable minWidth="1150px"><CollectionTableHead><tr><th className="p-3">العميل</th><th>نوع العملية</th><th>الخطة والإضافات</th><th>كود الدفع</th><th>المبلغ</th><th>تاريخ التحصيل</th><th>أكد الدفع</th></tr></CollectionTableHead><CollectionTableBody>{report.payments.map(payment=><tr key={payment.id} className="border-t border-slate-100 dark:border-white/10">
            <td className="p-3"><Link href={`/Dashboard/customers/${payment.customerId}`} className="block font-semibold text-[#0758e9] dark:text-[#8fc0ff]">{payment.customerName}</Link><span className="mt-1 block text-[10px] text-slate-400">@{payment.customerUsername||"—"} · #{payment.customerId}</span><span className="block text-[10px] text-slate-400" dir="ltr">{payment.customerEmail}</span></td>
            <td><PaymentPurposeBadge value={payment.purpose}/></td>
            <td><b className="block">{payment.planName}</b><span className="block text-[10px] text-slate-400">{payment.deploymentName||"—"}</span>{payment.purchasedItems.length>0&&<span className="mt-1 block text-[10px] text-slate-500">الإضافات: {payment.purchasedItems.join("، ")}</span>}</td>
            <td dir="ltr"><Link href={`/Dashboard/payments?code=${encodeURIComponent(payment.paymentCode)}`} className="font-mono text-[10px] text-[#0758e9] dark:text-[#8fc0ff]">{payment.paymentCode}</Link></td>
            <td className="font-semibold" dir="ltr">{formatAmount(payment.amount)} {payment.currency}</td>
            <td>{new Intl.DateTimeFormat("ar",{dateStyle:"short",timeStyle:"short"}).format(new Date(payment.paidAt))}</td><td>{payment.confirmedBy||"—"}</td>
          </tr>)}</CollectionTableBody></CollectionTable>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span>{report.pagination.total} دفعة · الصفحة {page} من {Math.max(1,Math.ceil(report.pagination.total/report.pagination.pageSize))}</span><div className="flex gap-2"><button type="button" disabled={page<=1} onClick={()=>setPage(value=>value-1)} className="h-9 rounded-xl border border-[#bfd4ea] px-3 disabled:opacity-40 dark:border-white/10">السابق</button><button type="button" disabled={page*report.pagination.pageSize>=report.pagination.total} onClick={()=>setPage(value=>value+1)} className="h-9 rounded-xl border border-[#bfd4ea] px-3 disabled:opacity-40 dark:border-white/10">التالي</button></div></div>
        </>}
      </section>
    </>}
  </div>;
}

function formatAmount(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}
