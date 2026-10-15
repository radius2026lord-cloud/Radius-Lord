"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AlertCircle, BadgeCheck, Check, Fingerprint, ScanLine, Upload, Usb, X, RotateCcw } from "lucide-react";
import ProjectButton from "@/components/ui/project-button";
import ProjectInput from "@/components/ui/project-input";

type IdentityField = "firstName" | "lastName";
type IdentityValues = Partial<Record<IdentityField, string>>;
type ExtractedIdentityField = { label: string; value: string };
type Side = "front" | "back";

const FIELD_LABELS: Record<IdentityField, string> = {
  firstName: "الاسم",
  lastName: "الكنية",
};
const FIELD_ORDER: IdentityField[] = ["firstName", "lastName"];
const panelClass = "rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.025]";
const inputClass = "border-[#9fb8d2] bg-white text-[#17386d] placeholder:text-slate-400 focus:border-[#0758e9] dark:border-white/15 dark:bg-[#17263b] dark:text-[#dce8fa]";
const PYTHON_PROCESSOR_URL = "/api/identity/decode";

function hasValue(values: IdentityValues) {
  return FIELD_ORDER.some((field) => Boolean(values[field]?.trim()));
}

export default function SubscriberIdentityImport({
  currentValues,
  onApply,
}: {
  currentValues: IdentityValues;
  onApply: (values: IdentityValues) => void;
}) {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [identityFields, setIdentityFields] = useState<ExtractedIdentityField[]>([]);
  const [suggestions, setSuggestions] = useState<IdentityValues>({});
  const [selected, setSelected] = useState<IdentityField[]>([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [snapiStatus, setSnapiStatus] = useState("بانتظار فحص القارئ…");
  const [scannerModels, setScannerModels] = useState<string[]>([]);
  const requestController = useRef<AbortController | null>(null);

  const frontUrl = useMemo(() => front ? URL.createObjectURL(front) : "", [front]);
  const backUrl = useMemo(() => back ? URL.createObjectURL(back) : "", [back]);
  useEffect(() => () => { if (frontUrl) URL.revokeObjectURL(frontUrl); }, [frontUrl]);
  useEffect(() => () => { if (backUrl) URL.revokeObjectURL(backUrl); }, [backUrl]);

  const emergencyReset = () => {
    requestController.current?.abort();
    requestController.current = null;
    setWorking(false);
    setSnapiStatus("أُوقفت العملية؛ أعد فحص القارئ.");
    setScannerModels([]);
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

  const mergeSuggestions = (found: IdentityValues) => {
    if (!hasValue(found)) {
      setMessage("لم يُتعرّف على الاسم والكنية؛ راجع الحقول المستخرجة.");
      return;
    }
    setSuggestions((old) => {
      const next = { ...old };
      for (const field of FIELD_ORDER) if (found[field]?.trim()) next[field] = found[field]!.trim();
      return next;
    });
    setSelected((old) => Array.from(new Set([...old, ...FIELD_ORDER.filter((field) => Boolean(found[field]?.trim()))])));
    setMessage("تم استخراج البيانات؛ راجعها قبل التطبيق.");
  };

  const clearTemporaryData = () => {
    setFront(null);
    setBack(null);
    setIdentityFields([]);
    setSuggestions({});
    setSelected([]);
    setMessage("");
    setError("");
  };

  const readBarcode = async () => {
    const controller = new AbortController();
    requestController.current = controller;
    setWorking(true);
    setSnapiStatus("القارئ جاهز؛ بانتظار القراءة…");
    setError("");
    setIdentityFields([]);
    setSuggestions({});
    setSelected([]);
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
      setIdentityFields(Array.isArray(result.identityFields) ? result.identityFields : []);
      setScannerModels(Array.isArray(result.scannerModels) ? result.scannerModels : scannerModels);
      mergeSuggestions(found);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? `تعذر إكمال القراءة: ${caught.message}` : "تعذر إكمال القراءة.");
      setMessage("");
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setWorking(false);
      }
    }
  };

  const testSnapi = async () => {
    const controller = new AbortController();
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

  const updateSuggestion = (field: IdentityField, value: string) => setSuggestions((old) => ({ ...old, [field]: value }));
  const toggleField = (field: IdentityField) => setSelected((old) => old.includes(field) ? old.filter((item) => item !== field) : [...old, field]);
  const applySelected = () => {
    const values: IdentityValues = {};
    for (const field of selected) {
      const value = suggestions[field]?.trim();
      if (value && !currentValues[field]?.trim()) values[field] = value;
    }
    if (!Object.keys(values).length) {
      setMessage("لم تُطبّق أي قيمة: الحقول المحددة إما فارغة أو تحتوي بيانات أدخلتها مسبقًا.");
      return;
    }
    onApply(values);
    setMessage("طُبّقت القيم المحددة في الحقول الفارغة. الصور لا تُحفظ مع المشترك في هذه التجربة.");
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void testSnapi(), 0);
    return () => {
      window.clearTimeout(timer);
      requestController.current?.abort();
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
        <ProjectButton type="button" variant="secondary" disabled={working} onClick={()=>void testSnapi()}><Usb/>{working ? "جارٍ الفحص…" : "إعادة الفحص"}</ProjectButton>
        {working&&<ProjectButton type="button" variant="secondary" onClick={emergencyReset}><RotateCcw/>إيقاف طارئ وإعادة الضبط</ProjectButton>}
      </div>
    </div>

    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-300/10 dark:bg-blue-500/[.06]">
      <div role="status" aria-live="polite" className="flex min-h-9 items-center gap-2 text-[11px] font-semibold text-blue-900 dark:text-blue-100">
        {working?<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"/>:snapiStatus==="القارئ جاهز."?<BadgeCheck className="h-4 w-4 text-emerald-600"/>:<Usb className="h-4 w-4 text-blue-600"/>}
        <span>{snapiStatus}</span>
      </div>
      <ProjectButton disabled={working || scannerModels.length === 0} onClick={()=>void readBarcode()}><ScanLine/>{working ? "جارٍ الانتظار…" : "بدء قراءة الهوية"}</ProjectButton>
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

    {(hasValue(suggestions) || identityFields.length > 0) && <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-300/10 dark:bg-violet-500/[.04]">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-[11px] font-bold text-violet-900 dark:text-violet-100">مراجعة المعلومات المستخرجة <span className="mr-1 text-[9px] font-normal text-slate-500">(الخطوة 3)</span></h4><p className="mt-1 text-[9px] text-slate-500">تحقق من الحقول وعدّلها، ثم اختر ما تريد تطبيقه. لن تُستبدل الحقول المعبأة يدويًا.</p></div><ProjectButton type="button" disabled={!selected.some((field)=>Boolean(suggestions[field]?.trim())&&!currentValues[field]?.trim())} onClick={applySelected}><Check/>تطبيق المحدد على الحقول الفارغة</ProjectButton></div>
      {message&&<p role="status" className="mt-2 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">{message}</p>}
      {identityFields.length>0&&<div className="mt-2 grid gap-2 sm:grid-cols-2">{identityFields.map((field,index)=><div key={`${field.label}-${index}`} className={`min-w-0 rounded-lg border p-2 ${index<2?"border-emerald-200 bg-emerald-50/70 dark:border-emerald-300/10 dark:bg-emerald-500/[.06]":"border-violet-100 bg-white/70 dark:border-violet-300/10 dark:bg-white/[.025]"}`}><div className="text-[9px] font-semibold text-slate-500">{index+1}. {field.label}{index<2&&<span className="mr-1 text-emerald-700 dark:text-emerald-300">· سيُنقل للاسم/الكنية</span>}</div><div className="mt-1 break-words text-xs" dir="auto">{field.value||"—"}</div></div>)}</div>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{FIELD_ORDER.map((field)=><label key={field} className="flex min-w-0 items-start gap-2 rounded-lg border border-violet-100 bg-white/70 p-2 dark:border-violet-300/10 dark:bg-white/[.025]"><input type="checkbox" checked={selected.includes(field)} onChange={()=>toggleField(field)} disabled={Boolean(currentValues[field]?.trim())} className="mt-1 accent-blue-600"/><span className="min-w-0 flex-1"><span className="flex items-center gap-1 text-[10px] font-semibold">{FIELD_LABELS[field]}{currentValues[field]?.trim()&&<span className="font-normal text-amber-600">· الحقل ممتلئ</span>}</span><ProjectInput value={suggestions[field]||""} onChange={(event)=>updateSuggestion(field,event.target.value)} className={`mt-1 !h-9 !text-xs ${inputClass}`} maxLength={100}/></span></label>)}</div>
    </div>}
  </section>;
}
