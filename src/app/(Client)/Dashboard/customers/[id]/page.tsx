"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Clock3, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

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
  updatedAt: string;
};

const labels = { active: "نشط", suspended: "معلّق", disabled: "معطّل" } as const;

export default function CustomerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/customers/${params.id}`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) { setNotFound(true); return null; }
        if (!response.ok) throw new Error("Failed");
        return response.json();
      })
      .then((data) => data?.customer && setCustomer(data.customer))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <StateCard>جارٍ تحميل بيانات العميل...</StateCard>;
  if (notFound || !customer) return <StateCard>تعذر العثور على العميل.</StateCard>;

  const statusTone = customer.status === "active" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : customer.status === "suspended" ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" : "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400";

  return (
    <div className="space-y-3 sm:space-y-4" dir="rtl">
      <section className="rounded-[22px] border border-white/90 bg-white p-4 shadow-[0_8px_22px_rgba(58,84,112,.08)] dark:border-white/[.07] dark:bg-[#0d243b]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button type="button" onClick={() => router.push("/Dashboard/customers")} className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-[#d7e3ef] bg-[#f9fbfe] text-slate-500 transition hover:border-[#9fc4ec] hover:bg-[#edf4fb] hover:text-[#0758e9] dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#b8b1bd]"><ArrowRight className="h-4 w-4" /></button>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[17px] bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.06] dark:text-[#8ab5ff]"><UserRound className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[#17386d] dark:text-[#e3dee6] sm:text-xl">{customer.fullName}</h2>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusTone}`}><i className="h-1.5 w-1.5 rounded-full bg-current" />{labels[customer.status]}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#9f98a5]">@{customer.username || "—"} · رقم العميل #{customer.id}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[22px] border border-white/90 bg-white p-4 shadow-[0_8px_22px_rgba(58,84,112,.07)] dark:border-white/[.07] dark:bg-[#0d243b]">
          <h3 className="mb-4 text-sm font-semibold text-[#17386d] dark:text-[#d8d2dc]">بيانات الحساب</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Info icon={Mail} label="البريد الإلكتروني" value={customer.email} ltr />
            <Info icon={Phone} label="رقم الهاتف" value={customer.phone} ltr />
            <Info icon={MapPin} label="الدولة" value={customer.country} />
            <Info icon={UserRound} label="اسم المستخدم" value={customer.username ? `@${customer.username}` : "—"} />
          </div>
        </div>

        <div className="rounded-[22px] border border-white/90 bg-white p-4 shadow-[0_8px_22px_rgba(58,84,112,.07)] dark:border-white/[.07] dark:bg-[#0d243b]">
          <h3 className="mb-4 text-sm font-semibold text-[#17386d] dark:text-[#d8d2dc]">نشاط الحساب</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Info icon={Clock3} label="آخر تسجيل دخول" value={formatDateTime(customer.lastLoginAt)} />
            <Info icon={CalendarDays} label="تاريخ إنشاء الحساب" value={formatDateTime(customer.createdAt)} />
            <Info icon={CalendarDays} label="آخر تحديث" value={formatDateTime(customer.updatedAt)} />
          </div>
        </div>
      </section>

      <section className="rounded-[22px] border border-dashed border-[#cbd9e7] bg-white/60 p-5 text-center dark:border-white/[.10] dark:bg-white/[.025]">
        <div className="text-sm font-medium text-slate-600 dark:text-[#c4bdc8]">الشبكات والاشتراكات</div>
        <p className="mt-1 text-xs text-slate-400 dark:text-[#8f8894]">سيتم ربط شبكات العميل واشتراكاته هنا في المرحلة التالية.</p>
      </section>
    </div>
  );
}

function Info({ icon: Icon, label, value, ltr = false }: { icon: typeof Mail; label: string; value: string; ltr?: boolean }) {
  return <div className="rounded-[16px] border border-[#e2ebf4] bg-[#f9fbfe] p-3 dark:border-white/[.07] dark:bg-white/[.035]"><div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-[#918a96]"><Icon className="h-4 w-4 text-[#5f91d8]" />{label}</div><div className="allow-text-selection mt-2 truncate text-sm font-medium text-slate-700 dark:text-[#d4ced7]" dir={ltr ? "ltr" : "rtl"}>{value}</div></div>;
}

function StateCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[22px] border border-white/90 bg-white p-8 text-center text-sm text-slate-500 dark:border-white/[.07] dark:bg-[#0d243b] dark:text-slate-400">{children}</div>;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
