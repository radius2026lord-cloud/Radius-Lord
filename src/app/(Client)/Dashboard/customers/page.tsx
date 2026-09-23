"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Mail, Phone, Search, UserRound, Users } from "lucide-react";
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [gridSelectionMode, setGridSelectionMode] = useState(false);

  useEffect(() => {
    if (view === "grid") {
      setSelected(new Set());
      setBulkAction("");
      setBulkMenuOpen(false);
      setGridSelectionMode(false);
    } else {
      setGridSelectionMode(false);
    }
  }, [view]);

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

  const allVisibleSelected = filtered.length > 0 && filtered.every((customer) => selected.has(customer.id));
  const toggleCustomer = (id: number) => setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAllVisible = () => setSelected((current) => { const next = new Set(current); if (allVisibleSelected) filtered.forEach((customer) => next.delete(customer.id)); else filtered.forEach((customer) => next.add(customer.id)); return next; });

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
            {view === "grid" && (
              <div className="flex shrink-0 items-center gap-1.5">
                {gridSelectionMode && <button type="button" onClick={toggleAllVisible} className={`h-11 rounded-[16px] border px-3 text-xs font-bold transition-all duration-300 sm:px-4 ${allVisibleSelected ? "border-[#8bb9f0] bg-[#e9f2ff] text-[#0758e9] dark:border-white/20 dark:bg-white/[.07] dark:text-white" : "border-[#d7e3ef] bg-white text-[#17386d] hover:border-[#9fc4ec] hover:bg-[#edf4fb] dark:border-white/[.10] dark:bg-[#38363c] dark:text-white"}`}>{allVisibleSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}</button>}
                <button type="button" onClick={() => { setGridSelectionMode((active) => { const next = !active; if (!next) { setSelected(new Set()); setBulkAction(""); setBulkMenuOpen(false); } return next; }); }} className={`h-11 rounded-[16px] border px-3 text-xs font-bold transition-all duration-300 sm:px-4 ${gridSelectionMode ? "border-[#8bb9f0] bg-[#e9f2ff] text-[#0758e9] shadow-[0_6px_16px_rgba(20,121,255,.10)] dark:border-white/20 dark:bg-white/[.07] dark:text-white" : "border-[#d7e3ef] bg-white text-[#17386d] hover:border-[#9fc4ec] hover:bg-[#edf4fb] dark:border-white/[.10] dark:bg-[#38363c] dark:text-white dark:hover:bg-white/[.07]"}`}>{gridSelectionMode ? "إلغاء التحديد" : "تحديد"}</button>
              </div>
            )}
            <CollectionViewToggle value={view} onChange={setView} />
          </div>
        </div>
      </section>

      {selected.size > 0 && (
        <section className="flex flex-col gap-2 rounded-[18px] border border-[#9fc4ec] bg-[#f4f8fd] p-2.5 shadow-[0_8px_22px_rgba(58,84,112,.08)] animate-slideDown dark:border-white/[.12] dark:bg-white/[.045] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-[#17386d] dark:text-white">
            <span className="grid h-7 min-w-7 place-items-center rounded-full bg-[#0758e9] px-2 text-white">{selected.size}</span>
            <span>تم تحديد {selected.size} من العملاء</span>
          </div>
          <div className="relative w-full sm:w-[230px]">
            <button type="button" onClick={() => setBulkMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={bulkMenuOpen} className={`flex h-10 w-full items-center justify-between rounded-[14px] border bg-white px-3 text-xs font-semibold text-[#17386d] transition-all duration-300 dark:bg-[#38363c] dark:text-white ${bulkMenuOpen ? "border-[#8bb9f0] shadow-[0_8px_22px_rgba(20,121,255,.12)] dark:border-white/20" : "border-[#bfd4ea] dark:border-white/[.10]"}`}>
              <span>{bulkAction === "activate" ? "تفعيل المحدد" : bulkAction === "suspend" ? "تعليق المحدد" : bulkAction === "disable" ? "تعطيل المحدد" : "تطبيق إجراء جماعي..."}</span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${bulkMenuOpen ? "rotate-180" : ""}`} />
            </button>
            <div role="menu" className={`absolute left-0 right-0 top-[calc(100%+6px)] z-40 origin-top rounded-[18px] border border-[#d7e3ef] bg-[#f9fbfe] p-2 shadow-[0_18px_45px_rgba(44,65,92,.22)] transition-all duration-300 ease-[cubic-bezier(.22,.8,.25,1)] dark:border-white/[.12] dark:bg-[#302e33] ${bulkMenuOpen ? "visible translate-y-0 scale-100 opacity-100" : "invisible -translate-y-2 scale-[.97] opacity-0 pointer-events-none"}`}>
              {[["activate","تفعيل المحدد"],["suspend","تعليق المحدد"],["disable","تعطيل المحدد"]].map(([value,label]) => (
                <button key={value} type="button" role="menuitem" onClick={() => { setBulkAction(value); setBulkMenuOpen(false); }} className={`group flex min-h-10 w-full items-center gap-2 rounded-[13px] px-3 text-right text-xs font-semibold transition-all duration-200 hover:bg-[#edf4fb] hover:text-[#0758e9] dark:hover:bg-[#38363c] dark:hover:text-white ${bulkAction === value ? "bg-[#edf4fb] text-[#0758e9] dark:bg-[#38363c] dark:text-white" : "text-slate-700 dark:text-[#ece8ee]"}`}>
                  <span className={`h-2 w-2 rounded-full ${value === "activate" ? "bg-emerald-500" : value === "suspend" ? "bg-amber-500" : "bg-red-500"}`} />
                  <span>{label}</span>
                  {bulkAction === value && <Check className="mr-auto h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {loading ? (
        <div className="rounded-[22px] border border-white/90 bg-white p-8 text-center text-sm text-slate-500 dark:border-white/[.07] dark:bg-[#0d243b] dark:text-slate-400">جارٍ تحميل العملاء...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[22px] border border-white/90 bg-white p-8 text-center text-sm text-slate-500 dark:border-white/[.07] dark:bg-[#0d243b] dark:text-slate-400">لا يوجد عملاء مطابقون.</div>
      ) : view === "grid" ? (
        <section key="grid-view" className="animate-collectionView grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((customer) => <CustomerCard key={customer.id} customer={customer} selectionMode={gridSelectionMode} selected={selected.has(customer.id)} onToggle={() => toggleCustomer(customer.id)} />)}
        </section>
      ) : (
        <>
          <section key="row-view" className="animate-collectionView hidden overflow-hidden rounded-[22px] border border-white/90 bg-white shadow-[0_8px_22px_rgba(58,84,112,.08)] dark:border-white/[.07] dark:bg-[#0d243b] md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-right text-xs">
                <thead className="border-b-[3px] border-[#9ebbd9] bg-[#d3e2f2] text-[11px] font-bold text-[#17386d] shadow-[0_3px_0_rgba(104,139,176,.10)] dark:border-white/[.18] dark:bg-[#3b383e] dark:text-slate-200"><tr><th className="w-12 p-3 text-center"><SelectionBox checked={allVisibleSelected} onChange={toggleAllVisible} label="تحديد كل العملاء الظاهرين" /></th><th className="p-3">العميل</th><th>اسم المستخدم</th><th>الهاتف</th><th>الدولة</th><th>الحالة</th><th>تاريخ الإنشاء</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[.07]">
                  {filtered.map((customer) => <CustomerRow key={customer.id} customer={customer} selected={selected.has(customer.id)} onToggle={() => toggleCustomer(customer.id)} />)}
                </tbody>
              </table>
            </div>
          </section>
          <section className="space-y-2 md:hidden">
            {filtered.map((customer) => <CustomerMobileRow key={customer.id} customer={customer} />)}
          </section>
        </>
      )}
          <style jsx global>{`
        @keyframes collectionViewEnter {
          from { opacity: 0; transform: translateY(8px) scale(.992); filter: blur(2px); }
          to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        .animate-collectionView { animation: collectionViewEnter .34s cubic-bezier(.22,.8,.25,1) both; }
        @media (prefers-reduced-motion: reduce) { .animate-collectionView { animation: none !important; } }
      `}</style>
    </div>
  );
}

function Status({ status }: { status: Customer["status"] }) {
  const tone = status === "active" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : status === "suspended" ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" : "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${tone}`}><i className="h-1.5 w-1.5 rounded-full bg-current" />{statusLabel[status]}</span>;
}

function CustomerCard({ customer, selectionMode, selected, onToggle }: { customer: Customer; selectionMode: boolean; selected: boolean; onToggle: () => void }) {
  return <article onClick={() => selectionMode && onToggle()} className={`group relative min-w-0 rounded-[22px] border bg-white p-4 shadow-[0_8px_22px_rgba(58,84,112,.08)] transition-[transform,box-shadow,border-color,background-color] duration-300 ease-[cubic-bezier(.22,.8,.25,1)] hover:-translate-y-1 hover:scale-[1.018] hover:shadow-[0_16px_34px_rgba(58,84,112,.16)] dark:bg-[#0d243b] dark:hover:shadow-[0_18px_38px_rgba(0,0,0,.22)] ${selected ? "border-[#6aaeff] bg-[#f2f7fd] ring-2 ring-[#1479ff]/15 dark:border-[#4c8dff] dark:bg-white/[.055]" : "border-white/90 hover:border-[#78afe9] hover:bg-[#e9f2ff] dark:border-white/[.07] dark:hover:border-white/[.16]"} ${selectionMode ? "cursor-pointer" : ""}`}>
    {selectionMode && <div className="-mx-1 -mt-1 mb-3 flex items-center justify-end border-b border-slate-100 pb-2 dark:border-white/[.07]"><span aria-hidden="true" className={`grid h-7 w-7 place-items-center rounded-[9px] border transition-all duration-250 ${selected ? "border-[#0758e9] bg-[#0758e9] text-white shadow-[0_4px_10px_rgba(7,88,233,.22)]" : "border-[#b8cadc] bg-[#f8fbfe] text-transparent dark:border-white/25 dark:bg-[#38363c]"}`}><Check className="h-4 w-4" strokeWidth={3} /></span></div>}
    <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.06] dark:text-[#8ab5ff]"><UserRound className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{customer.fullName}</div><div className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">@{customer.username || "—"}</div></div><Status status={customer.status} /></div>
    <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-white/[.07] dark:text-slate-400"><div className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0" /><span className="truncate" dir="ltr">{customer.email}</span></div><div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" /><span dir="ltr">{customer.phone}</span></div><div className="flex items-center justify-between gap-3"><span>{customer.country}</span><span>{formatDate(customer.createdAt)}</span></div></div>
  </article>;
}

function CustomerRow({ customer, selected, onToggle }: { customer: Customer; selected: boolean; onToggle: () => void }) {
  return <tr className={`text-slate-600 ${selected ? "bg-[#f2f7fd] dark:bg-white/[.055]" : ""} transition-[transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(.22,.8,.25,1)] hover:relative hover:z-10 hover:scale-[1.006] hover:bg-[#e9f2ff] hover:shadow-[0_8px_20px_rgba(58,84,112,.11)] dark:text-slate-300 dark:hover:bg-white/[.045]`}><td className="w-12 p-3 text-center"><SelectionBox checked={selected} onChange={onToggle} label={`تحديد ${customer.fullName}`} /></td><td className="p-3"><div className="font-bold text-[#17386d] dark:text-white">{customer.fullName}</div><div className="mt-1 text-[10px] text-slate-400">{customer.email}</div></td><td>@{customer.username || "—"}</td><td dir="ltr">{customer.phone}</td><td>{customer.country}</td><td><Status status={customer.status} /></td><td>{formatDate(customer.createdAt)}</td></tr>;
}

function CustomerMobileRow({ customer }: { customer: Customer }) {
  return <article className="rounded-[18px] border border-white/90 bg-white p-3 shadow-[0_6px_18px_rgba(58,84,112,.07)] transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(.22,.8,.25,1)] hover:-translate-y-0.5 hover:scale-[1.01] hover:border-[#78afe9] hover:bg-[#e9f2ff] hover:shadow-[0_12px_26px_rgba(58,84,112,.13)] dark:border-white/[.07] dark:bg-[#0d243b] dark:hover:border-white/[.16]"><div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.06]"><UserRound className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{customer.fullName}</div><div className="mt-1 truncate text-[10px] text-slate-500">@{customer.username || "—"} · {customer.phone}</div></div><Status status={customer.status} /></div></article>;
}

function SelectionBox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <label className="inline-grid cursor-pointer place-items-center">
    <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} className="peer sr-only" />
    <span className="grid h-[19px] w-[19px] place-items-center rounded-[6px] border-2 border-[#9bb4cf] bg-white text-white shadow-sm transition-all duration-200 peer-checked:scale-105 peer-checked:border-[#0758e9] peer-checked:bg-[#0758e9] peer-checked:shadow-[0_4px_10px_rgba(7,88,233,.28)] dark:border-white/30 dark:bg-[#38363c] dark:peer-checked:border-[#4c8dff] dark:peer-checked:bg-[#4c8dff]">
      <Check className={`h-3.5 w-3.5 transition-all duration-200 ${checked ? "scale-100 opacity-100" : "scale-50 opacity-0"}`} strokeWidth={3} />
    </span>
  </label>;
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
