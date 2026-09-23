"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, Phone, Search, UserRound, Users } from "lucide-react";
import CollectionViewToggle, { CollectionViewMode } from "@/components/ui/collection-view-toggle";

type Customer = {
  id: number;
  fullName: string;
  username: string | null;
  email: string;
  phone: string;
  country: string;
  status: "active" | "suspended" | "disabled";
  lastLoginAt: string | null;
  createdAt: string;
};

const statusLabel: Record<Customer["status"], string> = {
  active: "نشط",
  suspended: "معلّق",
  disabled: "معطّل",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<CollectionViewMode>("row");

  useEffect(() => {
    fetch("/api/admin/customers", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed");
        return response.json();
      })
      .then((data) => setCustomers(data.customers ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return customers;
    return customers.filter((customer) =>
      [customer.fullName, customer.username, customer.email, customer.phone, customer.country]
        .filter(Boolean).some((field) => String(field).toLowerCase().includes(value)),
    );
  }, [customers, query]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="rounded-[22px] border border-white/90 bg-white p-3 shadow-[0_8px_22px_rgba(58,84,112,.08)] dark:border-white/[.07] dark:bg-[#0d243b] sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg"><Users className="h-5 w-5 text-[#0758e9]" />العملاء</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">عرض وإدارة حسابات عملاء Radius Lord</p>
          </div>
          <div className="flex w-full items-center gap-2 md:w-auto">
            <div className="relative min-w-0 flex-1 md:w-[320px] md:flex-none">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث بالاسم، المستخدم، الهاتف..." className="h-11 w-full rounded-[16px] border border-[#d7e3ef] bg-[#f9fbfe] pr-10 pl-3 text-sm outline-none focus:border-[#6aaeff] focus:ring-4 focus:ring-[#1480ff]/10 dark:border-white/[.10] dark:bg-[#38363c]" />
            </div>
            <CollectionViewToggle value={view} onChange={setView} />
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-[22px] border border-white/90 bg-white p-8 text-center text-sm text-slate-500 dark:border-white/[.07] dark:bg-[#0d243b] dark:text-slate-400">جارٍ تحميل العملاء...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[22px] border border-white/90 bg-white p-8 text-center text-sm text-slate-500 dark:border-white/[.07] dark:bg-[#0d243b] dark:text-slate-400">لا يوجد عملاء مطابقون.</div>
      ) : view === "grid" ? (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((customer) => <CustomerCard key={customer.id} customer={customer} />)}
        </section>
      ) : (
        <>
          <section className="hidden overflow-hidden rounded-[22px] border border-white/90 bg-white shadow-[0_8px_22px_rgba(58,84,112,.08)] dark:border-white/[.07] dark:bg-[#0d243b] md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-right text-xs">
                <thead className="bg-[#f6f9fc] text-[11px] text-slate-500 dark:bg-white/[.035] dark:text-slate-400"><tr><th className="p-3">العميل</th><th>اسم المستخدم</th><th>الهاتف</th><th>الدولة</th><th>الحالة</th><th>تاريخ الإنشاء</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[.07]">
                  {filtered.map((customer) => <CustomerRow key={customer.id} customer={customer} />)}
                </tbody>
              </table>
            </div>
          </section>
          <section className="space-y-2 md:hidden">
            {filtered.map((customer) => <CustomerMobileRow key={customer.id} customer={customer} />)}
          </section>
        </>
      )}
    </div>
  );
}

function Status({ status }: { status: Customer["status"] }) {
  const tone = status === "active" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : status === "suspended" ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" : "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${tone}`}><i className="h-1.5 w-1.5 rounded-full bg-current" />{statusLabel[status]}</span>;
}

function CustomerCard({ customer }: { customer: Customer }) {
  return <article className="group min-w-0 rounded-[22px] border border-white/90 bg-white p-4 shadow-[0_8px_22px_rgba(58,84,112,.08)] transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(.22,.8,.25,1)] hover:-translate-y-1 hover:scale-[1.018] hover:border-[#78afe9] hover:bg-[#e9f2ff] hover:shadow-[0_16px_34px_rgba(58,84,112,.16)] dark:border-white/[.07] dark:bg-[#0d243b] dark:hover:border-white/[.16] dark:hover:shadow-[0_18px_38px_rgba(0,0,0,.22)]">
    <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.06] dark:text-[#8ab5ff]"><UserRound className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{customer.fullName}</div><div className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">@{customer.username || "—"}</div></div><Status status={customer.status} /></div>
    <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-white/[.07] dark:text-slate-400"><div className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0" /><span className="truncate" dir="ltr">{customer.email}</span></div><div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" /><span dir="ltr">{customer.phone}</span></div><div className="flex items-center justify-between gap-3"><span>{customer.country}</span><span>{formatDate(customer.createdAt)}</span></div></div>
  </article>;
}

function CustomerRow({ customer }: { customer: Customer }) {
  return <tr className="text-slate-600 transition-[transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(.22,.8,.25,1)] hover:relative hover:z-10 hover:scale-[1.006] hover:bg-[#e9f2ff] hover:shadow-[0_8px_20px_rgba(58,84,112,.11)] dark:text-slate-300 dark:hover:bg-white/[.045]"><td className="p-3"><div className="font-bold text-[#17386d] dark:text-white">{customer.fullName}</div><div className="mt-1 text-[10px] text-slate-400">{customer.email}</div></td><td>@{customer.username || "—"}</td><td dir="ltr">{customer.phone}</td><td>{customer.country}</td><td><Status status={customer.status} /></td><td>{formatDate(customer.createdAt)}</td></tr>;
}

function CustomerMobileRow({ customer }: { customer: Customer }) {
  return <article className="rounded-[18px] border border-white/90 bg-white p-3 shadow-[0_6px_18px_rgba(58,84,112,.07)] transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(.22,.8,.25,1)] hover:-translate-y-0.5 hover:scale-[1.01] hover:border-[#78afe9] hover:bg-[#e9f2ff] hover:shadow-[0_12px_26px_rgba(58,84,112,.13)] dark:border-white/[.07] dark:bg-[#0d243b] dark:hover:border-white/[.16]"><div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.06]"><UserRound className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{customer.fullName}</div><div className="mt-1 truncate text-[10px] text-slate-500">@{customer.username || "—"} · {customer.phone}</div></div><Status status={customer.status} /></div></article>;
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
