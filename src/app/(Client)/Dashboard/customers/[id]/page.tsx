"use client";

import { useEffect, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, Mail, MapPin, Pencil, Phone, Trash2, UserRound, X } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ProjectTooltip from "@/components/ui/project-tooltip";

type RecentActivity = { id:number; actionCode:string; actionName:string; description:string|null; adminName:string|null; adminUsername:string|null; createdAt:string; metadata:any };

const activityTone:Record<string,string>={ CREATE:"bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", UPDATE:"bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", DELETE:"bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300", SUSPEND:"bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" };

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
  const searchParams = useSearchParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ fullName: "", username: "", email: "", phone: "", country: "" });

  useEffect(() => {
    fetch(`/api/admin/customers/${params.id}`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) { setNotFound(true); return null; }
        if (!response.ok) throw new Error("Failed");
        return response.json();
      })
      .then((data) => {
        if (data?.customer) {
          setCustomer(data.customer);
          setForm({ fullName: data.customer.fullName, username: data.customer.username ?? "", email: data.customer.email, phone: data.customer.phone, country: data.customer.country });
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  const loadRecentActivity = () => {
    fetch(`/api/admin/audit-logs/customer/${params.id}`, { credentials: "include", cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => setRecentActivity(data?.logs ?? []))
      .catch(() => setRecentActivity([]));
  };

  useEffect(() => { loadRecentActivity(); }, [params.id]);

  useEffect(() => { if (customer && searchParams.get("edit") === "1") beginEdit(); }, [customer?.id, searchParams]);

  const beginEdit = () => {
    if (!customer) return;
    setForm({ fullName: customer.fullName, username: customer.username ?? "", email: customer.email, phone: customer.phone, country: customer.country });
    setError(""); setMessage(""); setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setError(""); };

  const saveEdit = async () => {
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/customers/${params.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تعذر حفظ التعديلات.");
      setCustomer(data.customer);
      setForm({ fullName: data.customer.fullName, username: data.customer.username ?? "", email: data.customer.email, phone: data.customer.phone, country: data.customer.country });
      setEditing(false); setMessage(data.message || "تم حفظ التعديلات بنجاح.");
      loadRecentActivity();
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر حفظ التعديلات."); }
    finally { setSaving(false); }
  };

  if (loading) return <StateCard>جارٍ تحميل بيانات العميل...</StateCard>;
  if (notFound || !customer) return <StateCard>تعذر العثور على العميل.</StateCard>;

  const statusTone = customer.status === "active" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : customer.status === "suspended" ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" : "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400";

  return (
    <div className="space-y-3 sm:space-y-4" dir="rtl">
      <section className="rl-surface rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(58,84,112,.08)] dark:border-white/[.07] dark:bg-[#0d243b]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ProjectTooltip label="رجوع إلى العملاء"><button type="button" onClick={() => router.push("/Dashboard/customers")} aria-label="الرجوع إلى العملاء" className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border-2 border-[#78afe9] bg-[#e9f2ff] text-[#0758e9] shadow-[0_4px_12px_rgba(7,88,233,.10)] transition hover:border-[#0758e9] hover:bg-[#dcecff] dark:border-[#4d83c8] dark:bg-[#173554] dark:text-[#8fc0ff] dark:hover:border-[#6aaeff]"><ArrowRight className="h-4 w-4" /></button></ProjectTooltip>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[17px] bg-[#e9f2ff] text-[#0758e9] dark:bg-white/[.06] dark:text-[#8ab5ff]"><UserRound className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[#17386d] dark:text-[#e3dee6] sm:text-xl">{customer.fullName}</h2>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusTone}`}><i className="h-1.5 w-1.5 rounded-full bg-current" />{labels[customer.status]}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#9f98a5]">@{customer.username || "—"} · رقم العميل #{customer.id}</p>
          </div>
          {!editing && <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button type="button" onClick={beginEdit} className="flex h-11 items-center gap-2 rounded-[14px] border-2 border-[#78afe9] bg-[#e9f2ff] px-3.5 text-xs font-medium text-[#0758e9] shadow-[0_4px_12px_rgba(7,88,233,.08)] transition hover:border-[#0758e9] hover:bg-[#dcecff] dark:border-[#4d83c8] dark:bg-[#173554] dark:text-[#8fc0ff]"><Pencil className="h-4 w-4" />تعديل العميل</button>
            <button type="button" disabled title="حذف العميل — سيتم تفعيله بعد إضافة تأكيد الحذف" className="flex h-11 cursor-not-allowed items-center gap-2 rounded-[14px] border-2 border-red-200 bg-red-50 px-3.5 text-xs font-medium text-red-500 opacity-70 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300"><Trash2 className="h-4 w-4" />حذف العميل</button>
          </div>}
        </div>
        {(message || error) && <div className={`mt-3 rounded-[13px] border px-3 py-2 text-xs ${error ? "border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300" : "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"}`}>{error || message}</div>}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rl-surface rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(58,84,112,.07)] dark:border-white/[.07] dark:bg-[#0d243b]">
          <h3 className="mb-4 text-sm font-semibold text-[#17386d] dark:text-[#d8d2dc]">بيانات الحساب</h3>
          {editing ? (
            <div key="edit" className="ui-state-enter">
              <div className="grid gap-2 sm:grid-cols-2">
                <EditField label="الاسم الكامل" value={form.fullName} onChange={(value) => setForm((current) => ({ ...current, fullName: value }))} />
                <EditField label="اسم المستخدم" value={form.username} onChange={(value) => setForm((current) => ({ ...current, username: value }))} ltr />
                <EditField label="البريد الإلكتروني" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} ltr type="email" />
                <EditField label="رقم الهاتف" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} ltr />
                <EditField label="الدولة" value={form.country} onChange={(value) => setForm((current) => ({ ...current, country: value }))} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={saving} onClick={saveEdit} className="flex h-10 items-center gap-2 rounded-[13px] bg-[#0758e9] px-4 text-xs font-medium text-white transition hover:bg-[#064dcc] disabled:opacity-60"><Check className="h-4 w-4" />{saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button>
                <button type="button" disabled={saving} onClick={cancelEdit} className="flex h-10 items-center gap-2 rounded-[13px] border border-[#d7e3ef] bg-white px-4 text-xs font-medium text-slate-500 transition hover:bg-[#f5f8fc] dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#bdb6c1]"><X className="h-4 w-4" />إلغاء</button>
              </div>
            </div>
          ) : (
          <div key="view" className="ui-state-enter grid gap-2 sm:grid-cols-2">
            <Info icon={Mail} label="البريد الإلكتروني" value={customer.email} ltr />
            <Info icon={Phone} label="رقم الهاتف" value={customer.phone} ltr />
            <Info icon={MapPin} label="الدولة" value={customer.country} />
            <Info icon={UserRound} label="اسم المستخدم" value={customer.username ? `@${customer.username}` : "—"} />
          </div>
          )}
        </div>

        <div className="rl-surface rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(58,84,112,.07)] dark:border-white/[.07] dark:bg-[#0d243b]">
          <h3 className="mb-4 text-sm font-semibold text-[#17386d] dark:text-[#d8d2dc]">نشاط الحساب</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Info icon={Clock3} label="آخر تسجيل دخول" value={formatDateTime(customer.lastLoginAt)} />
            <Info icon={CalendarDays} label="تاريخ إنشاء الحساب" value={formatDateTime(customer.createdAt)} />
            <Info icon={CalendarDays} label="آخر تحديث" value={formatDateTime(customer.updatedAt)} />
          </div>
        </div>
      </section>

      <section className="rl-surface rounded-[22px] bg-white p-4 dark:bg-[#0d243b]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h3 className="flex items-center gap-2 text-sm font-semibold text-[#17386d] dark:text-[#d8d2dc]"><Activity className="h-4 w-4 text-[#0758e9]" />آخر النشاطات</h3><p className="mt-1 text-[11px] text-slate-400">آخر العمليات الإدارية على هذا العميل</p></div>
          <button type="button" onClick={() => router.push(`/Dashboard/logs/admin?entityType=CUSTOMER&entityId=${customer.id}`)} className="flex h-9 items-center gap-1.5 rounded-[12px] border border-[#9db8d1] bg-[#f7faff] px-3 text-[11px] font-medium text-[#0758e9] transition hover:bg-[#e9f2ff] dark:border-white/[.12] dark:bg-white/[.04] dark:text-[#8fc0ff]">عرض السجل الكامل<ArrowLeft className="h-3.5 w-3.5" /></button>
        </div>
        {recentActivity.length === 0 ? <div className="rl-surface-soft rounded-[16px] bg-[#f9fbfe] p-5 text-center text-xs text-slate-400 dark:bg-white/[.035]">لا توجد نشاطات مسجلة لهذا العميل حتى الآن.</div> :
        <div className="space-y-2">{recentActivity.map((item) => <div key={item.id} className="rl-surface-soft ui-state-enter flex flex-col gap-2 rounded-[16px] bg-[#f9fbfe] p-3 dark:bg-white/[.035] sm:flex-row sm:items-center">
          <span className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${activityTone[item.actionCode] ?? "bg-slate-100 text-slate-600 dark:bg-white/[.08] dark:text-slate-300"}`}>{item.actionName}</span>
          <div className="min-w-0 flex-1"><div className="truncate text-xs font-medium text-slate-650 dark:text-slate-200">{item.description || "عملية إدارية"}</div><div className="mt-1 text-[10px] text-slate-400">بواسطة {item.adminName || item.adminUsername || "النظام"}</div></div>
          <div className="shrink-0 text-[10px] text-slate-400">{formatDateTime(item.createdAt)}</div>
        </div>)}</div>}
      </section>

      <section className="rounded-[22px] border border-dashed border-[#cbd9e7] bg-white/60 p-5 text-center dark:border-white/[.10] dark:bg-white/[.025]">
        <div className="text-sm font-medium text-slate-600 dark:text-[#c4bdc8]">الشبكات والاشتراكات</div>
        <p className="mt-1 text-xs text-slate-400 dark:text-[#8f8894]">سيتم ربط شبكات العميل واشتراكاته هنا في المرحلة التالية.</p>
      </section>
    </div>
  );
}

function EditField({ label, value, onChange, ltr = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; ltr?: boolean; type?: string }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] text-slate-400 dark:text-[#918a96]">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} dir={ltr ? "ltr" : "rtl"} className="allow-text-selection h-11 w-full rl-surface-soft rounded-[14px] bg-[#f9fbfe] px-3 text-sm font-normal text-slate-700 outline-none transition focus:border-[#6aaeff] focus:ring-4 focus:ring-[#1480ff]/10 dark:border-white/[.10] dark:bg-[#38363c] dark:text-[#d4ced7]" /></label>;
}

function Info({ icon: Icon, label, value, ltr = false }: { icon: typeof Mail; label: string; value: string; ltr?: boolean }) {
  return <div className="rl-surface-soft rounded-[16px] bg-[#f9fbfe] p-3 dark:border-white/[.07] dark:bg-white/[.035]"><div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-[#918a96]"><Icon className="h-4 w-4 text-[#5f91d8]" />{label}</div><div className="allow-text-selection mt-2 truncate text-sm font-medium text-slate-700 dark:text-[#d4ced7]" dir={ltr ? "ltr" : "rtl"}>{value}</div></div>;
}

function StateCard({ children }: { children: React.ReactNode }) {
  return <div className="rl-surface rounded-[22px] bg-white p-8 text-center text-sm text-slate-500 dark:border-white/[.07] dark:bg-[#0d243b] dark:text-slate-400">{children}</div>;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
