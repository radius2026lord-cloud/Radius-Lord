"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AlertCircle, ArrowLeft, BadgeCheck, Fingerprint, ScanLine, Upload, Usb, X, RotateCcw } from "lucide-react";
import ProjectButton from "@/components/ui/project-button";
import ProjectInput from "@/components/ui/project-input";

type IdentityField = "firstName" | "lastName";
type IdentityValues = Partial<Record<IdentityField, string>>;
type IdentityFormField = { label: string; value: string };
type Side = "front" | "back";

const IDENTITY_FIELD_LABELS = ["الاسم", "الكنية", "اسم الأب", "اسم الأم", "محل وتاريخ الولادة", "الرقم الوطني"];
const panelClass = "rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.025]";
const inputClass = "border-[#9fb8d2] bg-white text-[#17386d] placeholder:text-slate-400 focus:border-[#0758e9] dark:border-white/15 dark:bg-[#17263b] dark:text-[#dce8fa]";
const PYTHON_PROCESSOR_URL = "/api/identity/decode";

export default function SubscriberIdentityImport({
  currentValues,
  onApply,
  onNameChange,
  onBackToList,
}: {
  currentValues: IdentityValues;
  onApply: (values: IdentityValues) => void;
  onNameChange: (field: IdentityField, value: string) => void;
  onBackToList: () => void;
}) {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [identityFields, setIdentityFields] = useState<IdentityFormField[]>(() => IDENTITY_FIELD_LABELS.map((label, index) => ({
    label,
    value: index === 0 ? currentValues.firstName || "" : index === 1 ? currentValues.lastName || "" : "",
  })));
  const [working, setWorking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [snapiStatus, setSnapiStatus] = useState("بانتظار فحص القارئ…");
  const [scannerModels, setScannerModels] = useState<string[]>([]);
  const requestController = useRef<AbortController | null>(null);
  const statusPollController = useRef<AbortController | null>(null);

  const frontUrl = useMemo(() => front ? URL.createObjectURL(front) : "", [front]);
  const backUrl = useMemo(() => back ? URL.createObjectURL(back) : "", [back]);
  useEffect(() => () => { if (frontUrl) URL.revokeObjectURL(frontUrl); }, [frontUrl]);
  useEffect(() => () => { if (backUrl) URL.revokeObjectURL(backUrl); }, [backUrl]);
  useEffect(() => {
    if (!processing) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [processing]);

  const emergencyReset = () => {
    requestController.current?.abort();
    requestController.current = null;
    setWorking(false);
    setProcessing(false);
    setSnapiStatus(scannerModels.length ? "القارئ جاهز." : "أُوقفت العملية؛ أعد فحص القارئ.");
    setMessage("");
    setError("");
  };

  const setSideFile = (side: Side, file: File | null) => {
    setError("");
    if (file && (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024)) {
      setError("اختر صورة بصيغة مدعومة لا يتجاوز حجمها 12 ميغابايت.");
      return;
    }
    (side === "front" ? setFront : setBack)(file);
  };

  const clearTemporaryData = () => {
    setFront(null);
    setBack(null);
    setIdentityFields(IDENTITY_FIELD_LABELS.map((label, index) => ({
      label,
      value: index === 0 ? currentValues.firstName || "" : index === 1 ? currentValues.lastName || "" : "",
    })));
    setMessage("");
    setError("");
  };

  const readBarcode = async () => {
    const controller = new AbortController();
    requestController.current = controller;
    setWorking(true);
    setProcessing(true);
    statusPollController.current?.abort();
    if (scannerModels.length) setSnapiStatus("القارئ جاهز.");
    setError("");
    setMessage("");
    try {
      const response = await fetch(PYTHON_PROCESSOR_URL, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scanner-scan" }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error("تعذرت قراءة الهوية. أعد المحاولة.");
      }
      const found = result.fields && typeof result.fields === "object" ? result.fields as IdentityValues : {};
      setSnapiStatus("القارئ جاهز.");
      const extracted = Array.isArray(result.identityFields) ? result.identityFields as IdentityFormField[] : [];
      const nextFields = IDENTITY_FIELD_LABELS.map((label, index) => ({
        label,
        value: index === 0
          ? currentValues.firstName?.trim() || found.firstName?.trim() || extracted[index]?.value || ""
          : index === 1
            ? currentValues.lastName?.trim() || found.lastName?.trim() || extracted[index]?.value || ""
            : extracted[index]?.value || "",
      }));
      setIdentityFields(nextFields);
      setScannerModels(Array.isArray(result.scannerModels) ? result.scannerModels : scannerModels);
      const names: IdentityValues = {};
      if (!currentValues.firstName?.trim() && found.firstName?.trim()) names.firstName = found.firstName.trim();
      if (!currentValues.lastName?.trim() && found.lastName?.trim()) names.lastName = found.lastName.trim();
      if (Object.keys(names).length) onApply(names);
      setMessage("تم ملء حقول الهوية. أكمل بيانات التواصل أدناه.");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? `تعذر إكمال القراءة: ${caught.message}` : "تعذر إكمال القراءة.");
      setMessage("");
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setWorking(false);
        setProcessing(false);
      }
    }
  };

  const testSnapi = async () => {
    const controller = new AbortController();
    statusPollController.current?.abort();
    requestController.current?.abort();
    requestController.current = controller;
    setWorking(true);
    setSnapiStatus("جارٍ فحص جاهزية القارئ…");
    setError("");
    setMessage("");
    try {
      const response = await fetch(PYTHON_PROCESSOR_URL, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scanner-status" }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error("القارئ غير جاهز. تحقق من اتصاله ثم أعد الفحص.");
      }
      const models = Array.isArray(result.scannerModels) ? result.scannerModels as string[] : [];
      setScannerModels(models);
      setSnapiStatus(models.length ? "القارئ جاهز." : "القارئ غير جاهز.");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setSnapiStatus("القارئ غير جاهز.");
      setError(caught instanceof Error ? caught.message : "تعذر فحص جاهزية القارئ.");
      setMessage("");
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setWorking(false);
      }
    }
  };

  const updateIdentityField = (index: number, value: string) => {
    setIdentityFields((old) => old.map((field, fieldIndex) => fieldIndex === index ? { ...field, value } : field));
    if (index === 0) onNameChange("firstName", value);
    if (index === 1) onNameChange("lastName", value);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void testSnapi(), 0);
    return () => {
      window.clearTimeout(timer);
      requestController.current?.abort();
    };
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    let disposed = false;
    const refreshStatus = async () => {
      if (document.visibilityState === "visible" && !requestController.current) {
        const controller = new AbortController();
        statusPollController.current = controller;
        try {
          const response = await fetch(PYTHON_PROCESSOR_URL, {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "scanner-status" }),
            signal: controller.signal,
          });
          const result = await response.json();
          if (!disposed && !controller.signal.aborted) {
            const models = response.ok && result.ok && Array.isArray(result.scannerModels) ? result.scannerModels as string[] : [];
            setScannerModels(models);
            setSnapiStatus(models.length ? "القارئ جاهز." : "القارئ غير جاهز.");
          }
        } catch {
          if (!disposed && !controller.signal.aborted) {
            setScannerModels([]);
            setSnapiStatus("القارئ غير جاهز.");
          }
        } finally {
          if (statusPollController.current === controller) statusPollController.current = null;
        }
      }
      if (!disposed) timer = window.setTimeout(() => void refreshStatus(), 8000);
    };
    timer = window.setTimeout(() => void refreshStatus(), 8000);
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
      statusPollController.current?.abort();
      statusPollController.current = null;
    };
  }, []);

  return <section className={panelClass} aria-labelledby="subscriber-identity-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><Fingerprint className="h-4 w-4"/></span>
        <div className="min-w-0">
          <h3 id="subscriber-identity-title" className="text-xs font-bold text-[#17386d] dark:text-slate-100">استيراد بيانات الهوية <span className="mr-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">تجريبي</span></h3>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <ProjectButton type="button" variant="secondary" onClick={onBackToList}><ArrowLeft/>العودة للقائمة</ProjectButton>
        <ProjectButton type="button" variant="secondary" disabled={working} onClick={()=>void testSnapi()}><Usb/>إعادة الفحص</ProjectButton>
        {working&&<ProjectButton type="button" variant="secondary" onClick={emergencyReset}><RotateCcw/>إيقاف طارئ وإعادة الضبط</ProjectButton>}
      </div>
    </div>

    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-300/10 dark:bg-blue-500/[.06]">
      <div role="status" aria-live="polite" className="flex min-h-9 items-center gap-2 text-[11px] font-semibold text-blue-900 dark:text-blue-100">
        {scannerModels.length>0?<BadgeCheck className="h-4 w-4 text-emerald-600"/>:working?<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"/>:<Usb className="h-4 w-4 text-blue-600"/>}
        <span>{snapiStatus}</span>
      </div>
      <ProjectButton disabled={working || scannerModels.length === 0} onClick={()=>void readBarcode()}><ScanLine/>بدء قراءة الهوية</ProjectButton>
    </div>
    <details className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <summary className="cursor-pointer text-[10px] font-semibold text-slate-600 dark:text-slate-300">صور وجهي الهوية (اختياري)</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {([{ side: "front" as const, title: "الوجه الأمامي", file: front, url: frontUrl }, { side: "back" as const, title: "الوجه الخلفي", file: back, url: backUrl }]).map(({ side, title, file, url }) => <div key={side} className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-white/10">
        <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold">{title} <span className="font-normal text-slate-400">(اختياري)</span></span>{file&&<button type="button" className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" onClick={()=>setSideFile(side,null)} aria-label={`إزالة صورة ${title}`}><X className="h-4 w-4"/></button>}</div>
        {url ? <Image src={url} alt={`معاينة ${title}`} width={320} height={128} unoptimized className="mt-2 h-32 w-full rounded-lg border border-slate-200 object-contain dark:border-white/10"/> : <label className="mt-2 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 text-center text-[10px] text-slate-500 hover:border-blue-300 dark:border-white/15 dark:bg-white/[.02]"><Upload className="h-4 w-4 text-blue-600"/>تصوير أو رفع صورة {title}<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event)=>setSideFile(side,event.target.files?.[0]||null)}/></label>}
      </div>)}
      </div>
      <div className="mt-2 flex justify-end"><ProjectButton type="button" variant="secondary" onClick={clearTemporaryData}><X/>مسح الصور والنتيجة المؤقتة</ProjectButton></div>
    </details>
    {error&&<p role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[10px] leading-5 text-red-700 dark:bg-red-500/10 dark:text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{error}</p>}

    <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.025]" aria-label="بيانات الهوية">
      <div className="grid gap-3 sm:grid-cols-2">
        {identityFields.map((field, index) => <label key={field.label} className="min-w-0 space-y-1 text-[11px] font-medium">
          {field.label}{index < 2 && " *"}
          <ProjectInput required={index < 2} value={field.value} onChange={(event) => updateIdentityField(index, event.target.value)} className={inputClass} maxLength={index === 5 ? 24 : index === 4 ? 120 : 100} dir="auto"/>
        </label>)}
      </div>
      {message&&<p role="status" className="mt-2 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">{message}</p>}
      <p className="mt-2 text-[9px] leading-5 text-slate-500">بيانات الأب والأم والولادة والرقم الوطني مؤقتة في هذه التجربة.</p>
    </section>

    {processing&&typeof document!=="undefined"&&createPortal(<div className="fixed inset-0 z-[10000] grid place-items-center bg-slate-950/35 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="identity-processing-title">
      <section className="w-full max-w-sm rounded-2xl border border-blue-100 bg-white p-5 text-center shadow-2xl dark:border-white/10 dark:bg-[#142338]">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-50 dark:bg-blue-500/10"><span className="h-6 w-6 animate-spin rounded-full border-[3px] border-blue-200 border-t-blue-600"/></span>
        <h3 id="identity-processing-title" className="mt-3 text-sm font-bold text-[#17386d] dark:text-slate-100">قراءة ومعالجة الهوية</h3>
        <p className="mt-1 text-[11px] text-slate-500">وجّه القارئ إلى باركود الهوية؛ ستظهر البيانات مباشرة في الحقول.</p>
        <ProjectButton type="button" variant="secondary" className="mt-4" onClick={emergencyReset}><RotateCcw/>إيقاف القراءة</ProjectButton>
      </section>
    </div>, document.body)}
  </section>;
}
