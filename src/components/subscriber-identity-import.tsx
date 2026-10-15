"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AlertCircle, BadgeCheck, Check, Fingerprint, ScanLine, ShieldCheck, Upload, Usb, X, RotateCcw } from "lucide-react";
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
  const [rawOcrText, setRawOcrText] = useState("");
  const [identityFields, setIdentityFields] = useState<ExtractedIdentityField[]>([]);
  const [readSummary, setReadSummary] = useState("");
  const [suggestions, setSuggestions] = useState<IdentityValues>({});
  const [selected, setSelected] = useState<IdentityField[]>([]);
  const [working, setWorking] = useState(false);
  const [processStatus, setProcessStatus] = useState("سيبدأ فحص الجهاز تلقائيًا عند اختيار إدخال الهوية.");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [snapiStatus, setSnapiStatus] = useState("لم يُختبر الاتصال بعد.");
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
    setProcessStatus("أُوقف الطلب وأُعيدت الواجهة. يمكنك إعادة اختبار القارئ.");
    setSnapiStatus("أُوقف الفحص؛ أعد الاختبار قبل القراءة.");
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

  const mergeSuggestions = (found: IdentityValues, source: string) => {
    if (!hasValue(found)) {
      setMessage("لم أحدد الاسم والكنية تلقائيًا. راجع الحقول الستة وأدخل القيم يدويًا أدناه.");
      return;
    }
    setSuggestions((old) => {
      const next = { ...old };
      for (const field of FIELD_ORDER) if (found[field]?.trim()) next[field] = found[field]!.trim();
      return next;
    });
    setSelected((old) => Array.from(new Set([...old, ...FIELD_ORDER.filter((field) => Boolean(found[field]?.trim()))])));
    setMessage(source);
  };

  const clearTemporaryData = () => {
    setFront(null);
    setBack(null);
    setRawOcrText("");
    setIdentityFields([]);
    setReadSummary("");
    setSuggestions({});
    setSelected([]);
    setMessage("مُسحت الصور ونتيجة القراءة المؤقتة من الصفحة.");
    setError("");
  };

  const readBarcode = async () => {
    const controller = new AbortController();
    requestController.current = controller;
    setWorking(true);
    setProcessStatus("القارئ جاهز؛ بانتظار مسح PDF417…");
    setError("");
    setIdentityFields([]);
    setReadSummary("");
    setSuggestions({});
    setSelected([]);
    setMessage("القارئ جاهز للاستقبال. وجّه ZBEX إلى باركود PDF417 الآن...");
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
        const errors: Record<string, string> = {
          scanner_windows_only: "القراءة المباشرة عبر SNAPI تعمل على Windows حيث يتصل القارئ.",
          scanner_sdk_python_missing: "متطلب pywin32 غير مثبت. شغّل تثبيت tools/requirements-identity.txt.",
          scanner_sdk_unavailable: "تعذر فتح CoreScanner. تأكد من تثبيت وتشغيل تعريف/خدمة ZBEX SNAPI وأن القارئ مضبوط على SNAPI.",
          scanner_sdk_open_failed: "لم يفتح CoreScanner اتصال SNAPI بالقارئ.",
          scanner_not_found: "لم يعثر CoreScanner على قارئ متصل. تحقق من USB ووضع SNAPI.",
          scanner_event_registration_failed: "اتصل CoreScanner لكن تعذر تفعيل استقبال قراءة الباركود.",
          scanner_read_timeout: "انتهت مهلة الانتظار قبل قراءة الرمز. اضغط بدء الاستقبال ثم امسح PDF417.",
          scanner_raw_data_missing: "وصل حدث من القارئ دون بايتات rawdata قابلة للمعالجة.",
        };
        throw new Error(errors[result.error] || "تعذرت قراءة باركود من القارئ.");
      }
      const decoded = typeof result.decodedText === "string" ? result.decodedText : "";
      const found = result.fields && typeof result.fields === "object" ? result.fields as IdentityValues : {};
      setRawOcrText(decoded);
      setProcessStatus("اكتملت القراءة وفك البايتات. راجع الحقول قبل تطبيقها.");
      setIdentityFields(Array.isArray(result.identityFields) ? result.identityFields : []);
      const payloadSource = result.payloadSource === "datalabel" ? "datalabel" : "rawdata";
      const dataLabelBytes = Number(result.dataLabelByteCount) || 0;
      const rawDataBytes = Number(result.rawDataByteCount) || 0;
      const byteComparison = dataLabelBytes && rawDataBytes && dataLabelBytes !== rawDataBytes
        ? ` · datalabel ${dataLabelBytes} / rawdata ${rawDataBytes} بايت`
        : "";
      setReadSummary(`${result.format || "PDF417"} · ${result.byteCount || 0} بايت من ${payloadSource}${byteComparison}`);
      setScannerModels(Array.isArray(result.scannerModels) ? result.scannerModels : scannerModels);
      if (hasValue(found)) mergeSuggestions(found, `استقبل Python بيانات ${payloadSource} من قارئ SNAPI وفكّها بـ Windows-1256. راجع الحقول قبل تطبيقها.`);
      else setMessage("استقبل Python البايتات وفكّ نص PDF417، لكن لم يحدد الاسم والكنية تلقائيًا. راجع الحقول الستة أدناه.");
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
    setProcessStatus("جارٍ فحص ZBEX وخدمة CoreScanner/SNAPI تلقائيًا…");
    setError("");
    setMessage("جارٍ اختبار الاتصال المباشر عبر CoreScanner/SNAPI...");
    setSnapiStatus("جارٍ الاختبار...");
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
        const errors: Record<string, string> = {
          scanner_windows_only: "اتصال SNAPI المباشر متاح على جهاز Windows الذي يتصل به القارئ.",
          scanner_sdk_python_missing: "متطلب pywin32 غير مثبت. شغّل تثبيت tools/requirements-identity.txt.",
          scanner_sdk_unavailable: "لم تتوفر خدمة CoreScanner. تحقق من تثبيت تعريف SNAPI وتشغيله.",
          scanner_sdk_open_failed: "تعذر فتح اتصال SNAPI بالقارئ.",
          scanner_not_found: "لم يعثر CoreScanner على ZBEX متصل بوضع SNAPI.",
        };
        throw new Error(errors[result.error] || "تعذر التحقق من اتصال القارئ.");
      }
      const models = Array.isArray(result.scannerModels) ? result.scannerModels as string[] : [];
      setScannerModels(models);
      setSnapiStatus(models.length ? `متصل عبر SNAPI: ${models.join("، ")}` : "اتصال SNAPI جاهز.");
      setProcessStatus("القارئ متصل وجاهز. ابدأ الاستقبال ثم امسح PDF417.");
      setMessage("تم العثور على القارئ. اضغط بدء الاستقبال ثم امسح باركود PDF417.");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setSnapiStatus("لم ينجح الاتصال.");
      setProcessStatus("لم يكتمل فحص القارئ. تحقق من USB وSNAPI ثم أعد الفحص.");
      setError(caught instanceof Error ? caught.message : "تعذر التحقق من اتصال القارئ.");
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
          <p className="mt-1 text-[10px] leading-5 text-slate-500">امسح باركود PDF417 مباشرة بقارئ ZBEX عبر SNAPI. يلتقط Python بايتات القارئ الخام ثم يفكها مثل التطبيق الخارجي.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <ProjectButton type="button" variant="secondary" disabled={working} onClick={()=>void testSnapi()}><Usb/>{working ? "جارٍ الفحص…" : "إعادة اختبار القارئ"}</ProjectButton>
        {working&&<ProjectButton type="button" variant="secondary" onClick={emergencyReset}><RotateCcw/>إيقاف طارئ وإعادة الضبط</ProjectButton>}
      </div>
    </div>

    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-[10px] leading-5 text-blue-900 dark:border-blue-300/10 dark:bg-blue-500/[.06] dark:text-blue-100">
      <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 shrink-0"/>تُعالج بايتات الباركود مؤقتًا داخل المشروع ولا تُحفظ في قاعدة البيانات.</div>
      <p className="mt-1 break-words">حالة الاتصال: {snapiStatus}</p>
      <div role="status" aria-live="polite" className="mt-2 flex items-center gap-2 rounded-lg border border-blue-200/80 bg-white/70 px-2.5 py-2 font-medium dark:border-white/10 dark:bg-white/[.035]">
        {working&&<span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"/>}
        <span>{processStatus}</span>
      </div>
    </div>

    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-300/10 dark:bg-blue-500/[.05]">
      <div className="flex items-start gap-2 text-[10px] leading-5 text-blue-900 dark:text-blue-100">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-600 text-[9px] font-bold text-white">1</span>
        <p><strong>يُفحص اتصال ZBEX/SNAPI تلقائيًا</strong> عند اختيار الإدخال بالهوية. بعد ظهور الجاهزية ابدأ الاستقبال.</p>
      </div>
      <div className="mt-2 flex items-start gap-2 text-[10px] leading-5 text-blue-900 dark:text-blue-100">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-600 text-[9px] font-bold text-white">2</span>
        <p><strong>ابدأ استقبال الباركود</strong> ثم اضغط زناد القارئ على PDF417. تصل بيانات rawdata إلى Python كبايتات Hex، وبعدها تُفك بـ Windows-1256.</p>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-300/10 dark:bg-blue-500/[.05]">
      <p className="text-[9px] text-slate-500">لا حاجة لرفع صورة الباركود. البيانات تبقى مؤقتة حتى تغادر الصفحة أو تمسحها.</p>
      <ProjectButton disabled={working || scannerModels.length === 0} onClick={()=>void readBarcode()}><ScanLine/>{working ? "بانتظار قراءة ZBEX…" : "بدء استقبال PDF417 من القارئ"}</ProjectButton>
    </div>
    <details className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <summary className="cursor-pointer text-[10px] font-semibold text-slate-600 dark:text-slate-300">صور وجهي الهوية (اختياري؛ لا تُستخدم لقراءة الباركود)</summary>
      <p className="mt-2 text-[9px] leading-5 text-slate-500">يمكن معاينة الصور هنا للتجربة فقط. فك PDF417 يتم من القارئ مباشرة عبر SNAPI.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {([{ side: "front" as const, title: "الوجه الأمامي", file: front, url: frontUrl }, { side: "back" as const, title: "الوجه الخلفي", file: back, url: backUrl }]).map(({ side, title, file, url }) => <div key={side} className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-white/10">
        <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold">{title} <span className="font-normal text-slate-400">(اختياري)</span></span>{file&&<button type="button" className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" onClick={()=>setSideFile(side,null)} aria-label={`إزالة صورة ${title}`}><X className="h-4 w-4"/></button>}</div>
        {url ? <Image src={url} alt={`معاينة ${title}`} width={320} height={128} unoptimized className="mt-2 h-32 w-full rounded-lg border border-slate-200 object-contain dark:border-white/10"/> : <label className="mt-2 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 text-center text-[10px] text-slate-500 hover:border-blue-300 dark:border-white/15 dark:bg-white/[.02]"><Upload className="h-4 w-4 text-blue-600"/>تصوير أو رفع صورة {title}<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event)=>setSideFile(side,event.target.files?.[0]||null)}/></label>}
      </div>)}
      </div>
      <div className="mt-2 flex justify-end"><ProjectButton type="button" variant="secondary" onClick={clearTemporaryData}><X/>مسح الصور والنتيجة المؤقتة</ProjectButton></div>
    </details>
    {message&&<p role="status" className="mt-2 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-[10px] leading-5 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0"/>{message}</p>}
    {error&&<p role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[10px] leading-5 text-red-700 dark:bg-red-500/10 dark:text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{error}</p>}

    {(hasValue(suggestions) || rawOcrText || identityFields.length > 0) && <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-300/10 dark:bg-violet-500/[.04]">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-[11px] font-bold text-violet-900 dark:text-violet-100">مراجعة المعلومات المستخرجة <span className="mr-1 text-[9px] font-normal text-slate-500">(الخطوة 3)</span></h4><p className="mt-1 text-[9px] text-slate-500">تحقق من الحقول وعدّلها، ثم اختر ما تريد تطبيقه. لن تُستبدل الحقول المعبأة يدويًا.</p></div><ProjectButton type="button" disabled={!selected.some((field)=>Boolean(suggestions[field]?.trim())&&!currentValues[field]?.trim())} onClick={applySelected}><Check/>تطبيق المحدد على الحقول الفارغة</ProjectButton></div>
      {readSummary&&<p className="mt-3 text-[10px] font-semibold text-violet-800 dark:text-violet-200">{readSummary}</p>}
      {identityFields.length>0&&<div className="mt-2 grid gap-2 sm:grid-cols-2">{identityFields.map((field,index)=><div key={`${field.label}-${index}`} className={`min-w-0 rounded-lg border p-2 ${index<2?"border-emerald-200 bg-emerald-50/70 dark:border-emerald-300/10 dark:bg-emerald-500/[.06]":"border-violet-100 bg-white/70 dark:border-violet-300/10 dark:bg-white/[.025]"}`}><div className="text-[9px] font-semibold text-slate-500">{index+1}. {field.label}{index<2&&<span className="mr-1 text-emerald-700 dark:text-emerald-300">· سيُنقل للاسم/الكنية</span>}</div><div className="mt-1 break-words text-xs" dir="auto">{field.value||"—"}</div></div>)}</div>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{FIELD_ORDER.map((field)=><label key={field} className="flex min-w-0 items-start gap-2 rounded-lg border border-violet-100 bg-white/70 p-2 dark:border-violet-300/10 dark:bg-white/[.025]"><input type="checkbox" checked={selected.includes(field)} onChange={()=>toggleField(field)} disabled={Boolean(currentValues[field]?.trim())} className="mt-1 accent-blue-600"/><span className="min-w-0 flex-1"><span className="flex items-center gap-1 text-[10px] font-semibold">{FIELD_LABELS[field]}{currentValues[field]?.trim()&&<span className="font-normal text-amber-600">· الحقل ممتلئ</span>}</span><ProjectInput value={suggestions[field]||""} onChange={(event)=>updateSuggestion(field,event.target.value)} className={`mt-1 !h-9 !text-xs ${inputClass}`} maxLength={100}/></span></label>)}</div>
      {rawOcrText&&<details className="mt-3 rounded-lg border border-slate-200 bg-white/70 p-2 text-[10px] dark:border-white/10 dark:bg-white/[.025]"><summary className="cursor-pointer font-semibold text-slate-600">عرض النص الخام للمراجعة</summary><textarea readOnly value={rawOcrText} rows={5} className={`mt-2 w-full rounded-lg border p-2 text-[10px] ${inputClass}`} dir="auto"/></details>}
      <p className="mt-2 text-[9px] leading-5 text-slate-500">تُعرض الحقول الستة للمراجعة مؤقتًا؛ يُطبّق الاسم والكنية فقط على النموذج الحالي. لا تُحفظ بقية بيانات الهوية أو الصور في قاعدة البيانات خلال التجربة.</p>
    </div>}
  </section>;
}
