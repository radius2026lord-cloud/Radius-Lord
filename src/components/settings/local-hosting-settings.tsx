"use client";

import { useEffect, useState } from "react";
import { Globe, Network, Save, Server, ShieldCheck } from "lucide-react";
import ProjectInput from "@/components/ui/project-input";
import ProjectLoading from "@/components/ui/project-loading";
import { Button } from "@/components/ui/button";

type Settings = { domain: string; public_ip: string; local_ip: string; public_https_port: number; local_https_port: number };
const empty: Settings = { domain: "", public_ip: "", local_ip: "", public_https_port: 443, local_https_port: 443 };
const endpoint = "/api/admin/platform-settings/local-hosting";

export default function LocalHostingSettings() {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(endpoint, { credentials: "include", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "تعذر تحميل الإعدادات.");
        setForm(data.settings);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadFailed(true);
        setMessage(error instanceof Error ? error.message : "تعذر تحميل الإعدادات.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, []);
  const update = (key: keyof Settings, value: string | number) => {
    setForm(current => ({ ...current, [key]: value })); setMessage(""); setSuccess(false);
  };
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setMessage(""); setSuccess(false);
    try {
      const response = await fetch(endpoint, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تعذر حفظ الإعدادات.");
      setForm(data.settings); setSuccess(true); setMessage("تم حفظ إعدادات الربط. يلزم تطبيق DNS والتحويل على الراوتر ثم التحقق من الوصول.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر حفظ الإعدادات."); }
    finally { setSaving(false); }
  };
  if (loading) return <div className="p-8"><ProjectLoading>جارٍ تحميل إعدادات الربط...</ProjectLoading></div>;
  const url = form.domain.trim() ? `https://${form.domain.trim()}${form.public_https_port === 443 ? "" : `:${form.public_https_port}`}` : "—";
  return <form onSubmit={save} className="space-y-5 p-4 sm:p-6">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-blue-500/10 p-2.5 text-blue-600 dark:text-blue-300"><Globe className="h-5 w-5"/></span><div><h2 className="font-bold">ربط الدومين بالمخدم المحلي</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">خاص باستضافة الكلاود المشتركة: تطبيق واحد على مخدمك المحلي وقاعدة مستقلة لكل شبكة.</p></div></div>
    <fieldset disabled={saving || loadFailed} className="grid min-w-0 gap-4 md:grid-cols-2">
      <label className="rl-field-label">دومين المنصة<ProjectInput required dir="ltr" autoCapitalize="none" spellCheck={false} maxLength={253} className="mt-2" value={form.domain} onChange={e=>update("domain",e.target.value)} placeholder="panel.example.com"/><span className="mt-1 block text-xs font-normal text-slate-500">الدومين فقط، دون https أو مسار.</span></label>
      <label className="rl-field-label">عنوان الإنترنت العام (IPv4)<ProjectInput required dir="ltr" maxLength={15} className="mt-2" value={form.public_ip} onChange={e=>update("public_ip",e.target.value)} placeholder="عنوان WAN العام"/></label>
      <label className="rl-field-label">عنوان المخدم المحلي (IPv4)<ProjectInput required dir="ltr" maxLength={15} className="mt-2" value={form.local_ip} onChange={e=>update("local_ip",e.target.value)} placeholder="192.168.1.10"/><span className="mt-1 block text-xs font-normal text-slate-500">ثبّت هذا العنوان للمخدم في الشبكة الداخلية.</span></label>
      <div className="grid min-w-0 grid-cols-2 gap-3"><label className="rl-field-label">منفذ HTTPS الخارجي<ProjectInput required type="number" min={1} max={65535} step={1} dir="ltr" className="mt-2" value={form.public_https_port || ""} onChange={e=>update("public_https_port",Number(e.target.value))}/></label><label className="rl-field-label">منفذ HTTPS المحلي<ProjectInput required type="number" min={1} max={65535} step={1} dir="ltr" className="mt-2" value={form.local_https_port || ""} onChange={e=>update("local_https_port",Number(e.target.value))}/></label></div>
    </fieldset>
    <div className="rounded-2xl border border-blue-200/70 bg-blue-50/60 p-4 dark:border-blue-500/20 dark:bg-blue-500/5"><h3 className="mb-3 font-semibold">معاينة إعدادات الربط</h3><dl className="grid min-w-0 gap-4 md:grid-cols-3">
      <div className="min-w-0"><dt className="flex items-center gap-2 text-xs text-slate-500"><Globe className="h-4 w-4 text-blue-500"/>سجل DNS من نوع A</dt><dd className="mt-2 break-all text-sm" dir="ltr">{form.domain || "الدومين"} → {form.public_ip || "العنوان العام"}</dd></div>
      <div className="min-w-0"><dt className="flex items-center gap-2 text-xs text-slate-500"><Network className="h-4 w-4 text-violet-500"/>تحويل TCP على الراوتر</dt><dd className="mt-2 break-all text-sm" dir="ltr">{form.public_https_port || "—"} → {form.local_ip || "IP"}:{form.local_https_port || "—"}</dd></div>
      <div className="min-w-0"><dt className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-500"/>رابط المنصة</dt><dd className="mt-2 break-all text-sm" dir="ltr">{url}</dd></div>
    </dl></div>
    <div className="flex items-start gap-2 text-xs leading-6 text-slate-500 dark:text-slate-400"><Server className="mt-1 h-4 w-4 shrink-0 text-blue-500"/><p>طبّق سجل DNS لدى مزود الدومين، وحوّل المنفذ على الراوتر إلى خدمة HTTPS بشهادة صالحة للدومين على المخدم. استخدم عنوان إنترنت عامًا؛ CGNAT يمنع التحويل المباشر. الحفظ هنا لا يغير DNS أو الراوتر ولا يفعّل بيئات المشتركين.</p></div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-4 dark:border-white/10"><p role="status" className={`min-w-0 flex-1 text-sm ${success ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{message}</p><Button type="submit" disabled={saving || loadFailed} className="rl-action rounded-xl bg-[#0758e9] px-5 text-white hover:bg-[#064fd1]"><Save/>{saving ? "جارٍ الحفظ..." : "حفظ إعدادات الربط"}</Button></div>
  </form>;
}
