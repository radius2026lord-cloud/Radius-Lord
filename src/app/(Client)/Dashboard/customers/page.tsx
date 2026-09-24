"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Mail, Phone, UserRound, Users } from "lucide-react";
import { CollectionCard, CollectionGrid, CollectionMobileCard, CollectionMobileList, CollectionState, CollectionTable, CollectionTableBody, CollectionTableHead, CollectionToolbar, CollectionStatusFilters, CollectionSelectionBar, CollectionSelectionBox, collectionRowClass, useCollectionDisplay } from "@/components/ui/collection-display";

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
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Customer["status"]>("all");
  const { view, setView, selected, setSelected, selectionMode: gridSelectionMode, setSelectionMode: setGridSelectionMode, toggle: toggleCustomer, setAll: setAllCustomers } = useCollectionDisplay<number>("customers", "row");
  const [bulkAction, setBulkAction] = useState("");
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/customers", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed");
        return response.json();
      })
      .then((data) => setCustomers(data.customers ?? []))
      .finally(() => setLoading(false));
  }, []);

  const statusCounts = useMemo(() => ({
    all: customers.length,
    active: customers.filter((customer) => customer.status === "active").length,
    suspended: customers.filter((customer) => customer.status === "suspended").length,
    disabled: customers.filter((customer) => customer.status === "disabled").length,
  }), [customers]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return customers.filter((customer) => {
      if (statusFilter !== "all" && customer.status !== statusFilter) return false;
      if (!value) return true;
      return [customer.fullName, customer.username, customer.email, customer.phone, customer.country]
        .filter(Boolean).some((field) => String(field).toLowerCase().includes(value));
    });
  }, [customers, query, statusFilter]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((customer) => selected.has(customer.id));
  const toggleAllVisible = () => setAllCustomers(filtered.map((customer) => customer.id), !allVisibleSelected);

  return (
    <div className="space-y-3 sm:space-y-4">
      <CollectionToolbar icon={Users} title="العملاء" description="عرض وإدارة حسابات عملاء Radius Lord" view={view} onViewChange={setView} selectionMode={gridSelectionMode} onSelectionModeChange={setGridSelectionMode} allSelected={allVisibleSelected} onToggleAll={toggleAllVisible} query={query} onQueryChange={setQuery} searchPlaceholder="بحث بالاسم، المستخدم، الهاتف..." filters={<CollectionStatusFilters value={statusFilter} onChange={setStatusFilter} items={[{value:"all",label:"الكل",count:statusCounts.all,dot:"bg-[#0758e9]"},{value:"active",label:"نشط",count:statusCounts.active,dot:"bg-emerald-500"},{value:"suspended",label:"معلّق",count:statusCounts.suspended,dot:"bg-amber-500"},{value:"disabled",label:"معطّل",count:statusCounts.disabled,dot:"bg-red-500"}]} />} />

      <CollectionSelectionBar count={selected.size} noun="العملاء" onClear={() => { setSelected(new Set()); setBulkAction(""); setBulkMenuOpen(false); }}>
        <div className="relative w-full sm:w-[230px]"><button type="button" onClick={() => setBulkMenuOpen((open) => !open)} className="flex h-10 w-full items-center justify-between rounded-[14px] border border-[#bfd4ea] bg-white px-3 text-xs font-semibold text-[#17386d] dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#d8d2dc]"><span>{bulkAction === "activate" ? "تفعيل المحدد" : bulkAction === "suspend" ? "تعليق المحدد" : bulkAction === "disable" ? "تعطيل المحدد" : "تطبيق إجراء جماعي..."}</span><ChevronDown className={`h-4 w-4 transition-transform ${bulkMenuOpen ? "rotate-180" : ""}`}/></button>{bulkMenuOpen&&<div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 rounded-[18px] border border-[#d7e3ef] bg-[#f9fbfe] p-2 shadow-xl dark:border-white/[.12] dark:bg-[#302e33]">{[["activate","تفعيل المحدد"],["suspend","تعليق المحدد"],["disable","تعطيل المحدد"]].map(([value,label])=><button key={value} type="button" onClick={()=>{setBulkAction(value);setBulkMenuOpen(false)}} className="flex min-h-10 w-full items-center gap-2 rounded-[13px] px-3 text-right text-xs font-semibold hover:bg-[#edf4fb] dark:hover:bg-[#38363c]"><span className={`h-2 w-2 rounded-full ${value==="activate"?"bg-emerald-500":value==="suspend"?"bg-amber-500":"bg-red-500"}`}/>{label}</button>)}</div>}</div>
      </CollectionSelectionBar>

      {loading ? (
        <CollectionState>جارٍ تحميل العملاء...</CollectionState>
      ) : filtered.length === 0 ? (
        <CollectionState>لا يوجد عملاء مطابقون.</CollectionState>
      ) : view === "grid" ? (
        <CollectionGrid>
          {filtered.map((customer) => <CustomerCard key={customer.id} customer={customer} selectionMode={gridSelectionMode} selected={selected.has(customer.id)} onToggle={() => toggleCustomer(customer.id)} onOpen={() => router.push(`/Dashboard/customers/${customer.id}`)} />)}
        </CollectionGrid>
      ) : (
        <>
          <CollectionTable>
            <CollectionTableHead><tr><th className="w-12 p-3 text-center"><CollectionSelectionBox checked={allVisibleSelected} onChange={toggleAllVisible} label="تحديد كل العملاء الظاهرين" /></th><th className="p-3">العميل</th><th>اسم المستخدم</th><th>الهاتف</th><th>الدولة</th><th>الحالة</th><th>تاريخ الإنشاء</th></tr></CollectionTableHead>
            <CollectionTableBody>{filtered.map((customer) => <CustomerRow key={customer.id} customer={customer} selected={selected.has(customer.id)} onToggle={() => toggleCustomer(customer.id)} onOpen={() => router.push(`/Dashboard/customers/${customer.id}`)} />)}</CollectionTableBody>
          </CollectionTable>
          <CollectionMobileList>{filtered.map((customer) => <CustomerMobileRow key={customer.id} customer={customer} onOpen={() => router.push(`/Dashboard/customers/${customer.id}`)} />)}</CollectionMobileList>
        </>
      )}
          <style jsx global>{`
        @keyframes collectionViewEnter {
          from { opacity: 0; transform: translateY(8px) scale(.992); filter: blur(2px); }
          to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        .animate-collectionView { animation: collectionViewEnter .34s cubic-bezier(.22,.8,.25,1) both; }
        .customers-table-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .customers-table-scroll::-webkit-scrollbar { display: none; }
        @media (prefers-reduced-motion: reduce) { .animate-collectionView { animation: none !important; } }
      `}</style>
    </div>
  );
}

function Status({ status }: { status: Customer["status"] }) {
  const tone = status === "active" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : status === "suspended" ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" : "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${tone}`}><i className="h-1.5 w-1.5 rounded-full bg-current" />{statusLabel[status]}</span>;
}

function CustomerCard({ customer, selectionMode, selected, onToggle, onOpen }: { customer: Customer; selectionMode: boolean; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  return <CollectionCard selectionMode={selectionMode} selected={selected} onToggle={onToggle} onOpen={onOpen}>
    <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.06] dark:text-[#8ab5ff]"><UserRound className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{customer.fullName}</div><div className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">@{customer.username || "—"}</div></div><Status status={customer.status} /></div>
    <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-white/[.07] dark:text-slate-400"><div className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0" /><span className="truncate" dir="ltr">{customer.email}</span></div><div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" /><span dir="ltr">{customer.phone}</span></div><div className="flex items-center justify-between gap-3"><span>{customer.country}</span><span>{formatDate(customer.createdAt)}</span></div></div>
  </CollectionCard>;
}

function CustomerRow({ customer, selected, onToggle, onOpen }: { customer: Customer; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  return <tr onClick={onOpen} className={collectionRowClass(selected)}><td className="w-12 p-3 text-center" onClick={(event) => event.stopPropagation()}><CollectionSelectionBox checked={selected} onChange={onToggle} label={`تحديد ${customer.fullName}`} /></td><td className="p-3"><div className="font-semibold text-[#17386d] dark:text-[#d8d2dc]">{customer.fullName}</div><div className="mt-1 text-[10px] text-slate-400">{customer.email}</div></td><td>@{customer.username || "—"}</td><td dir="ltr">{customer.phone}</td><td>{customer.country}</td><td><Status status={customer.status} /></td><td>{formatDate(customer.createdAt)}</td></tr>;
}

function CustomerMobileRow({ customer, onOpen }: { customer: Customer; onOpen: () => void }) {
  return <CollectionMobileCard onOpen={onOpen}><div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.06]"><UserRound className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{customer.fullName}</div><div className="mt-1 truncate text-[10px] text-slate-500">@{customer.username || "—"} · {customer.phone}</div></div><Status status={customer.status} /></div></CollectionMobileCard>;
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
