"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Home, RotateCcw, Save, Settings2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { defaultHomepageConfig, homepageSections, isHomepageConfig, type HomepageConfig } from "@/lib/homepage-config";
import { CollectionState } from "@/components/ui/collection-display";

export default function HomepageSettingsPage() {
  const { accountType, loading: authLoading } = useAuth();
  const [form, setForm] = useState<HomepageConfig>(defaultHomepageConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (authLoading || accountType !== "master_admin") return;
    const controller = new AbortController();
    setLoading(true); setLoaded(false); setError("");
    fetch("/api/homepage/settings", { credentials: "include", cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok || !isHomepageConfig(data.settings)) throw new Error(data.message || "تعذر تحميل إعدادات الصفحة الرئيسية.");
      if (!controller.signal.aborted) { setForm(data.settings); setLoaded(true); }
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "تعذر تحميل الإعدادات."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [authLoading, accountType, revision]);

  const move = (index: number, direction: number) => {
    setMessage("");
    setForm(current => { const sections = [...current.sections]; const target = index + direction; if (target < 0 || target >= sections.length) return current; [sections[index], sections[target]] = [sections[target], sections[index]]; return { ...current, sections }; });
  };
  const save = async () => {
    if (!loaded || saving) return;
    setError(""); setMessage("");
    if (!isHomepageConfig(form)) { setError("أدخل رسالة ترحيب من 1 إلى 300 حرف."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/homepage/settings", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تعذر حفظ الإعدادات.");
      setForm(data.settings); setMessage("تم حفظ الإعدادات وتطبيقها على الصفحة الرئيسية للمسؤول والعملاء.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "تعذر حفظ الإعدادات."); }
    finally { setSaving(false); }
  };

  if (authLoading) return <CollectionState>جارٍ تحميل حسابك...</CollectionState>;
  if (accountType !== "master_admin") return <CollectionState>تخصيص الصفحة الرئيسية متاح للمسؤول الرئيسي فقط.</CollectionState>;
  return <div dir="rtl" className="space-y-4">
    <header className="rl-surface flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-white p-4 dark:bg-[#0d243b]"><div><h1 className="flex items-center gap-2 text-lg font-semibold text-[#17386d] dark:text-white"><Settings2 className="h-5 w-5 text-[#0758e9]" />تخصيص الصفحة الرئيسية</h1><p className="mt-1 text-xs leading-6 text-slate-500">إعدادات موحدة للمسؤول والعملاء. محتوى البيانات والروابط يتبع صلاحيات الحساب.</p></div><Link href="/Dashboard" className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#bfd4ea] px-3 text-xs text-[#0758e9] dark:border-white/10 dark:text-[#8fc0ff]"><Home className="h-4 w-4" />عرض الصفحة الرئيسية</Link></header>
    {error && <div role="alert" className="rounded-2xl bg-red-50 p-4 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}{!loaded && <button type="button" onClick={() => setRevision(value => value + 1)} className="mr-3 underline">إعادة المحاولة</button>}</div>}
    {message && <p role="status" className="rounded-2xl bg-emerald-50 p-4 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{message}</p>}
    {loading ? <CollectionState>جارٍ تحميل الإعدادات...</CollectionState> : loaded && <fieldset disabled={saving} className="space-y-4">
      <section className="rl-surface rounded-[22px] bg-white p-4 dark:bg-[#0d243b]"><label className="block text-sm font-semibold text-[#17386d] dark:text-slate-100" htmlFor="welcome-text">رسالة الترحيب</label><p className="mt-1 text-xs text-slate-500">يظهر اسم صاحب الحساب تلقائيًا فوق هذه الرسالة.</p><textarea id="welcome-text" maxLength={300} rows={3} value={form.welcomeText} onChange={event => { setMessage(""); setForm(current => ({ ...current, welcomeText: event.target.value })); }} className="allow-text-selection mt-3 w-full rounded-[14px] border border-[#d7e3ef] bg-[#f9fbfe] p-3 text-sm text-slate-700 outline-none focus:border-[#0758e9] dark:border-white/10 dark:bg-white/5 dark:text-slate-200" /><p className="mt-1 text-left text-[10px] text-slate-400">{form.welcomeText.length} / 300</p></section>
      <section className="rl-surface rounded-[22px] bg-white p-4 dark:bg-[#0d243b]"><h2 className="text-sm font-semibold text-[#17386d] dark:text-slate-100">الأقسام وترتيب الظهور</h2><p className="mt-1 text-xs text-slate-500">فعّل الأقسام المطلوبة ورتّبها باستخدام الأسهم.</p><div className="mt-4 space-y-3">{form.sections.map((section, index) => { const meta = homepageSections.find(item => item.id === section.id)!; return <div key={section.id} className="rl-surface-soft flex flex-wrap items-center gap-3 rounded-[16px] bg-[#f9fbfe] p-3 dark:bg-white/[.035]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e9f2ff] text-xs font-bold text-[#0758e9] dark:bg-blue-500/10">{index + 1}</span><label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"><input type="checkbox" checked={section.enabled} onChange={event => { setMessage(""); setForm(current => ({ ...current, sections: current.sections.map(item => item.id === section.id ? { ...item, enabled: event.target.checked } : item) })); }} className="h-4 w-4 accent-[#0758e9]" /><span><b className="block text-sm text-[#17386d] dark:text-slate-200">{meta.label}</b><span className="mt-1 block text-xs text-slate-500">{meta.description}</span></span></label><div className="flex gap-1"><button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`نقل ${meta.label} إلى الأعلى`} className="grid h-9 w-9 place-items-center rounded-xl border border-[#bfd4ea] text-[#0758e9] disabled:opacity-30 dark:border-white/10"><ArrowUp className="h-4 w-4" /></button><button type="button" disabled={index === form.sections.length - 1} onClick={() => move(index, 1)} aria-label={`نقل ${meta.label} إلى الأسفل`} className="grid h-9 w-9 place-items-center rounded-xl border border-[#bfd4ea] text-[#0758e9] disabled:opacity-30 dark:border-white/10"><ArrowDown className="h-4 w-4" /></button></div></div>; })}</div></section>
      <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => { setForm(defaultHomepageConfig()); setMessage(""); setError(""); }} className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-[#bfd4ea] bg-white px-4 text-xs text-slate-600 dark:border-white/10 dark:bg-[#0d243b] dark:text-slate-300"><RotateCcw className="h-4 w-4" />استعادة الافتراضي</button><button type="button" onClick={save} className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-[#0758e9] px-5 text-xs font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</button></div>
      <p className="text-xs text-slate-400">لا تُطبّق التغييرات أو استعادة الافتراضي إلا بعد الحفظ.</p>
    </fieldset>}
  </div>;
}
