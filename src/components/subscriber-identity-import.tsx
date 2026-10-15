"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AlertCircle, ArrowLeft, BadgeCheck, Fingerprint, ScanLine, Upload, Usb, X, RotateCcw } from "lucide-react";
import ProjectButton from "@/components/ui/project-button";
import ProjectInput from "@/components/ui/project-input";
import ProjectTooltip from "@/components/ui/project-tooltip";

type IdentityField = "firstName" | "lastName";
type IdentityValues = Partial<Record<IdentityField, string>>;
type IdentityFormField = { label: string; value: string; locked?: boolean };
type Side = "front" | "back";

const IDENTITY_FIELD_LABELS = ["الاسم", "الكنية", "اسم الأب", "اسم الأم", "محل وتاريخ الولادة", "الرقم الوطني"];
const panelClass = "rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.025]";
const inputClass = "border-[#9fb8d2] bg-white text-[#17386d] placeholder:text-slate-400 focus:border-[#0758e9] dark:border-white/15 dark:bg-[#17263b] dark:text-[#dce8fa]";
const PYTHON_PROCESSOR_URL = "/api/identity/decode";
const PROCESSING_CARD_DURATION_MS = 5000;

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
  const [processingComplete, setProcessingComplete] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [closingProcessing, setClosingProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [snapiStatus, setSnapiStatus] = useState("بانتظار فحص القارئ…");
  const [scannerModels, setScannerModels] = useState<string[]>([]);
  const requestController = useRef<AbortController | null>(null);
  const statusPollController = useRef<AbortController | null>(null);
  const processingStartedAtRef = useRef<number | null>(null);
  const closeProcessingTimerRef = useRef<number | null>(null);
  const autoListenRef = useRef(false);
  const autoStartSuppressedRef = useRef(false);
  const hasIdentityBeenReadRef = useRef(false);
  const readBarcodeRef = useRef<() => Promise<void>>(async () => {});

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
  useEffect(() => {
    if (!processing || processingComplete || processingStartedAtRef.current === null) return;
    const updateProgress = () => {
      const elapsed = Date.now() - (processingStartedAtRef.current || Date.now());
      setProcessingProgress(Math.min(92, Math.floor((elapsed / PROCESSING_CARD_DURATION_MS) * 92)));
    };
    updateProgress();
    const timer = window.setInterval(updateProgress, 250);
    return () => window.clearInterval(timer);
  }, [processing, processingComplete]);
  useEffect(() => () => {
    if (closeProcessingTimerRef.current !== null) window.clearTimeout(closeProcessingTimerRef.current);
  }, []);
  const emergencyReset = () => {
    autoListenRef.current = false;
    autoStartSuppressedRef.current = true;
    requestController.current?.abort();
    requestController.current = null;
    if (closeProcessingTimerRef.current !== null) window.clearTimeout(closeProcessingTimerRef.current);
    closeProcessingTimerRef.current = null;
    setClosingProcessing(false);
    setWorking(false);
    setProcessing(false);
    setProcessingComplete(false);
    setProcessingProgress(0);
    processingStartedAtRef.current = null;
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

  const readBarcode = useCallback(async () => {
    const controller = new AbortController();
    requestController.current = controller;
    setWorking(true);
    setProcessing(false);
    setProcessingComplete(false);
    setProcessingProgress(0);
    setClosingProcessing(false);
    processingStartedAtRef.current = null;
    statusPollController.current?.abort();
    if (scannerModels.length) setSnapiStatus("القارئ جاهز.");
    setError("");
    setMessage("");
    let retryAfterTimeout = false;
    let scanSucceeded = false;
    try {
      const response = await fetch(PYTHON_PROCESSOR_URL, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scanner-scan" }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({})) as { error?: string };
        if (failure.error === "scanner_read_timeout" && autoListenRef.current) {
          retryAfterTimeout = true;
          setMessage("القارئ جاهز؛ امسح باركود الهوية مباشرة.");
          return;
        }
        throw new Error("تعذرت قراءة الهوية. أعد المحاولة.");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("تعذر استقبال نتيجة القارئ.");
      const decoder = new TextDecoder();
      let pending = "";
      let processingStartedAt: number | null = null;
      const resultHolder: { value: Record<string, unknown> | null } = { value: null };
      const handleEvent = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as { type?: string; stage?: string; result?: Record<string, unknown> };
        if (event.type === "progress" && event.stage === "processing") {
          if (processingStartedAt === null) {
            processingStartedAt = Date.now();
            processingStartedAtRef.current = processingStartedAt;
          }
          setProcessing(true);
        }
        if (event.type === "result" && event.result) resultHolder.value = event.result;
      };
      while (true) {
        const { done, value } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        const lines = pending.split("\n");
        pending = lines.pop() || "";
        lines.forEach(handleEvent);
        if (done) break;
      }
      if (pending.trim()) handleEvent(pending);
      if (!resultHolder.value) throw new Error("لم تصل نتيجة المعالجة من القارئ.");
      const scanResult = resultHolder.value;
      if (scanResult.ok !== true) {
        if (scanResult.error === "scanner_read_timeout" && autoListenRef.current) {
          retryAfterTimeout = true;
          setMessage("القارئ جاهز؛ امسح باركود الهوية مباشرة.");
          return;
        }
        if (["scanner_not_found", "scanner_sdk_open_failed", "scanner_sdk_unavailable"].includes(String(scanResult.error))) {
          autoListenRef.current = false;
          setScannerModels([]);
          setSnapiStatus("القارئ غير جاهز.");
        }
        throw new Error("تعذرت قراءة الهوية. أعد المحاولة.");
      }
      autoListenRef.current = false;
      hasIdentityBeenReadRef.current = true;
      const found = scanResult.fields && typeof scanResult.fields === "object" ? scanResult.fields as IdentityValues : {};
      setSnapiStatus("القارئ جاهز.");
      const extracted = Array.isArray(scanResult.identityFields) ? scanResult.identityFields as IdentityFormField[] : [];
      const nextFields = IDENTITY_FIELD_LABELS.map((label, index) => ({
        label,
        value: index === 0
          ? currentValues.firstName?.trim() || found.firstName?.trim() || extracted[index]?.value || ""
          : index === 1
            ? currentValues.lastName?.trim() || found.lastName?.trim() || extracted[index]?.value || ""
            : extracted[index]?.value || "",
        locked: index < 2
          ? !currentValues[index === 0 ? "firstName" : "lastName"]?.trim() && Boolean(found[index === 0 ? "firstName" : "lastName"]?.trim() || extracted[index]?.value?.trim())
          : Boolean(extracted[index]?.value?.trim()),
      }));
      setIdentityFields(nextFields);
      setScannerModels(Array.isArray(scanResult.scannerModels) ? scanResult.scannerModels as string[] : scannerModels);
      const names: IdentityValues = {};
      if (!currentValues.firstName?.trim() && found.firstName?.trim()) names.firstName = found.firstName.trim();
      if (!currentValues.lastName?.trim() && found.lastName?.trim()) names.lastName = found.lastName.trim();
      if (Object.keys(names).length) onApply(names);
      setMessage("تم ملء حقول الهوية. أكمل بيانات التواصل أدناه.");
      if (processingStartedAt !== null) {
        const remaining = PROCESSING_CARD_DURATION_MS - (Date.now() - processingStartedAt);
        if (remaining > 0) {
          await new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(() => {
              controller.signal.removeEventListener("abort", abortWait);
              resolve();
            }, remaining);
            const abortWait = () => {
              window.clearTimeout(timer);
              reject(new DOMException("Aborted", "AbortError"));
            };
            controller.signal.addEventListener("abort", abortWait, { once: true });
          });
        }
      }
      scanSucceeded = true;
      setProcessingProgress(100);
      setProcessingComplete(true);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      autoListenRef.current = false;
      setError(caught instanceof Error ? `تعذر إكمال القراءة: ${caught.message}` : "تعذر إكمال القراءة.");
      setMessage("");
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        if (retryAfterTimeout && autoListenRef.current) {
          window.setTimeout(() => { if (autoListenRef.current) void readBarcodeRef.current(); }, 150);
        } else {
          setWorking(false);
          if (!scanSucceeded) {
            setProcessing(false);
            setProcessingProgress(0);
            processingStartedAtRef.current = null;
          }
        }
      }
    }
  }, [currentValues, onApply, scannerModels]);

  useEffect(() => { readBarcodeRef.current = readBarcode; }, [readBarcode]);

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
      return models.length > 0;
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return false;
      setSnapiStatus("القارئ غير جاهز.");
      setError(caught instanceof Error ? caught.message : "تعذر فحص جاهزية القارئ.");
      setMessage("");
      return false;
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setWorking(false);
      }
    }
  };

  const verifyAndListen = async () => {
    autoListenRef.current = false;
    autoStartSuppressedRef.current = false;
    hasIdentityBeenReadRef.current = false;
    const ready = await testSnapi();
    if (ready) {
      autoListenRef.current = true;
      void readBarcode();
    }
  };

  const updateIdentityField = (index: number, value: string) => {
    setIdentityFields((old) => old.map((field, fieldIndex) => fieldIndex === index ? { ...field, value } : field));
    if (index === 0) onNameChange("firstName", value);
    if (index === 1) onNameChange("lastName", value);
  };

  const continueAfterProcessing = () => {
    if (closeProcessingTimerRef.current !== null) window.clearTimeout(closeProcessingTimerRef.current);
    setClosingProcessing(true);
    closeProcessingTimerRef.current = window.setTimeout(() => {
      setProcessing(false);
      setProcessingComplete(false);
      setProcessingProgress(0);
      setClosingProcessing(false);
      processingStartedAtRef.current = null;
      setMessage("");
      closeProcessingTimerRef.current = null;
    }, 180);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void verifyAndListen(), 0);
    return () => {
      window.clearTimeout(timer);
      autoListenRef.current = false;
      requestController.current?.abort();
    };
    // Start the initial reader check once when the identity tab mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    let disposed = false;
    const refreshStatus = async () => {
      if (document.visibilityState === "visible" && !requestController.current && !autoListenRef.current) {
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
            if (models.length && !hasIdentityBeenReadRef.current && !autoStartSuppressedRef.current) {
              autoListenRef.current = true;
              void readBarcodeRef.current();
            }
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
        <ProjectTooltip label="إعادة فحص اتصال قارئ الهوية"><ProjectButton type="button" variant="secondary" disabled={working} onClick={()=>void verifyAndListen()}><Usb/>إعادة الفحص</ProjectButton></ProjectTooltip>
        <ProjectTooltip label="العودة إلى قائمة المشتركين"><ProjectButton type="button" variant="secondary" onClick={onBackToList}><ArrowLeft/>العودة للقائمة</ProjectButton></ProjectTooltip>
        {working&&<ProjectButton type="button" variant="secondary" onClick={emergencyReset}><RotateCcw/>إيقاف طارئ وإعادة الضبط</ProjectButton>}
      </div>
    </div>

    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-300/10 dark:bg-blue-500/[.06]">
      <div role="status" aria-live="polite" className="flex min-h-9 items-center gap-2 text-[11px] font-semibold text-blue-900 dark:text-blue-100">
        {snapiStatus==="القارئ جاهز."?<BadgeCheck className="h-4 w-4 text-emerald-600"/>:working?<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"/>:<Usb className="h-4 w-4 text-blue-600"/>}
        <span>{snapiStatus}</span>
      </div>
      <p className="text-[10px] font-medium text-blue-800 dark:text-blue-200">{scannerModels.length ? "امسح باركود الهوية مباشرة؛ القراءة تبدأ تلقائيًا." : "سيبدأ الاستماع تلقائيًا عند اتصال القارئ."}</p>
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
          <ProjectInput required={index < 2} readOnly={field.locked} value={field.value} onChange={(event) => updateIdentityField(index, event.target.value)} className={`${inputClass} ${field.locked ? "cursor-not-allowed bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-300" : ""}`} maxLength={index === 5 ? 24 : index === 4 ? 120 : 100} dir="auto"/>
        </label>)}
      </div>
      {message&&<div role="status" aria-live="polite" className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-[11px] font-medium text-emerald-800 dark:border-emerald-300/15 dark:bg-emerald-500/[.08] dark:text-emerald-200"><BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300"/>{message}</div>}
      <p className="mt-2 text-[9px] leading-5 text-slate-500">بيانات الأب والأم والولادة والرقم الوطني مؤقتة في هذه التجربة.</p>
    </section>

    {processing&&typeof document!=="undefined"&&createPortal(<div className={`fixed inset-0 z-[10000] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-[2px] transition-opacity duration-200 ${closingProcessing ? "opacity-0" : "opacity-100"}`} role="dialog" aria-modal="true" aria-labelledby="identity-processing-title">
      <section className={`w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl transition-[opacity,transform] duration-200 dark:border-white/10 dark:bg-[#142338] ${closingProcessing ? "translate-y-1 scale-[.98] opacity-0" : "translate-y-0 scale-100 opacity-100"}`}>
        <div className="flex items-center gap-3">
          <span className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-xl ${processingComplete ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"}`}>
            {processingComplete ? <BadgeCheck className="h-6 w-6"/> : <ScanLine className="h-5 w-5"/>}
          </span>
          <div className="min-w-0">
            <h3 id="identity-processing-title" className="text-sm font-bold text-[#17386d] dark:text-slate-100">{processingComplete ? "اكتملت معالجة بيانات الهوية" : "جارٍ معالجة بيانات الهوية"}</h3>
            <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-300">{processingComplete ? "تم استخراج البيانات وتعبئة الحقول بنجاح." : "وصلت قراءة الباركود؛ جارٍ فك البيانات وتعبئة الحقول."}</p>
          </div>
        </div>
        {!processingComplete&&<p className="mt-3 text-[10px] font-medium text-blue-700 dark:text-blue-200">لا تغلق الصفحة ولا تعِد تحميلها أثناء المعالجة.</p>}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-blue-100 dark:bg-white/10" role="progressbar" aria-label={processingComplete ? "اكتملت معالجة بيانات الهوية" : "جارٍ معالجة بيانات الهوية"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={processingProgress}>
            <span className={`block h-full rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none ${processingComplete ? "bg-emerald-500" : "bg-gradient-to-r from-sky-500 to-blue-700"}`} style={{ width: `${processingProgress}%` }}/>
          </div>
          <span className={`w-10 text-left text-[10px] font-bold tabular-nums ${processingComplete ? "text-emerald-600 dark:text-emerald-300" : "text-blue-700 dark:text-blue-200"}`} dir="ltr">{processingProgress}%</span>
        </div>
        <div className="mt-4 flex justify-end">
          {processingComplete
            ? <ProjectButton type="button" disabled={closingProcessing} onClick={continueAfterProcessing}><BadgeCheck/>متابعة لإكمال البيانات</ProjectButton>
            : <ProjectButton type="button" variant="secondary" onClick={emergencyReset}><RotateCcw/>إيقاف طارئ</ProjectButton>}
        </div>
      </section>
    </div>, document.body)}
  </section>;
}
