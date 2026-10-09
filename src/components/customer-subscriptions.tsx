"use client";
import ProjectLoading from "@/components/ui/project-loading";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, RefreshCw } from "lucide-react";

type Subscription = {
  id: number; paymentCode: string; planName: string; durationMonths: number;
  deploymentName: string | null; totalAmount: number; currency: string;
  status: string; requestedAt: string | null;
};
const labels: Record<string, string> = {
  pending: "جديد", awaiting_confirmation: "بانتظار التأكيد", paid: "تم الدفع",
  completed: "مكتمل", cancelled: "ملغي", expired: "منتهي",
};

export default function CustomerSubscriptions({ customerId }: { customerId: number }) {
  const [items, setItems] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setItems([]);
    fetch(`/api/billing/admin/customers/${customerId}/subscriptions`, {
      credentials: "include", cache: "no-store", signal: controller.signal,
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تعذر تحميل اشتراكات العميل.");
      setItems(data.subscriptions ?? []);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "تعذر تحميل اشتراكات العميل.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [customerId, revision]);

  return <section className="rl-surface rounded-[22px] bg-white p-4 dark:bg-[#0d243b]">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-sm font-semibold text-[#17386d] dark:text-[#d8d2dc]"><CreditCard className="h-4 w-4 text-[#0758e9]" />طلبات اشتراك العميل</h3>
        <p className="mt-1 text-[11px] text-slate-400">طلبات الاشتراك التي انتقل العميل منها إلى مرحلة الدفع.</p></div>
      <button type="button" disabled={loading} onClick={() => setRevision(value => value + 1)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#9db8d1] px-3 text-xs text-[#0758e9] disabled:opacity-50 dark:text-[#8fc0ff]"><RefreshCw className="h-4 w-4" />تحديث</button>
    </div>
    {loading ? <div className="p-5"><ProjectLoading>جارٍ تحميل الاشتراكات...</ProjectLoading></div>
      : error ? <p role="alert" className="p-3 text-xs text-red-600 dark:text-red-300">{error}</p>
      : items.length === 0 ? <p className="p-5 text-center text-xs text-slate-400">لا توجد طلبات اشتراك لهذا العميل حتى الآن.</p>
      : <div className="grid gap-3 md:grid-cols-2">{items.map(item => <article key={item.id} className="rl-surface-soft min-w-0 rounded-[16px] bg-[#f9fbfe] p-4 dark:bg-white/[.035]">
        <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="text-sm font-semibold text-[#17386d] dark:text-slate-200">{item.planName}</h4><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-600 dark:bg-white/10 dark:text-slate-300">{labels[item.status] ?? item.status}</span></div>
        <dl className="mt-3 space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex justify-between gap-3"><dt>الاستضافة</dt><dd>{item.deploymentName || "—"}</dd></div>
          <div className="flex justify-between gap-3"><dt>المدة بالأشهر</dt><dd>{item.durationMonths}</dd></div>
          <div className="flex justify-between gap-3"><dt>الإجمالي</dt><dd dir="ltr">{item.totalAmount} {item.currency}</dd></div>
          <div className="flex justify-between gap-3"><dt>تاريخ الطلب</dt><dd>{formatDate(item.requestedAt)}</dd></div>
        </dl>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/10"><span dir="ltr" className="break-all font-mono text-[10px] text-[#0758e9] dark:text-[#8fc0ff]">{item.paymentCode}</span><Link href={`/Dashboard/subscriptions/${item.id}`} className="text-xs font-semibold text-[#0758e9] dark:text-[#8fc0ff]">عرض تفاصيل الاشتراك</Link></div>
      </article>)}</div>}
  </section>;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(date);
}
