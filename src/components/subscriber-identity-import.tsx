"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AlertCircle, BadgeCheck, Camera, Check, FileImage, Fingerprint, ScanLine, ShieldCheck, Upload, Usb, X } from "lucide-react";
import ProjectButton from "@/components/ui/project-button";
import ProjectInput from "@/components/ui/project-input";

type IdentityField = "firstName" | "lastName" | "phone" | "address";
type IdentityValues = Partial<Record<IdentityField, string>>;
type ExtractedIdentityField = { label: string; value: string };
type Side = "front" | "back";

const FIELD_LABELS: Record<IdentityField, string> = {
  firstName: "الاسم",
  lastName: "الكنية",
  phone: "رقم الهاتف",
  address: "العنوان",
};
const FIELD_ORDER: IdentityField[] = ["firstName", "lastName", "phone", "address"];
const panelClass = "rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.025]";
const inputClass = "border-[#9fb8d2] bg-white text-[#17386d] placeholder:text-slate-400 focus:border-[#0758e9] dark:border-white/15 dark:bg-[#17263b] dark:text-[#dce8fa]";
const PYTHON_PROCESSOR_URL = "/api/identity/decode";

function hasValue(values: IdentityValues) {
  return FIELD_ORDER.some((field) => Boolean(values[field]?.trim()));
}

function fileFromCanvas(canvas: HTMLCanvasElement, name: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("تعذر حفظ الصورة الملتقطة."));
      resolve(new File([blob], name, { type: blob.type || "image/jpeg", lastModified: Date.now() }));
    }, "image/jpeg", 0.92);
  });
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
  const [barcodeText, setBarcodeText] = useState("");
  const [rawOcrText, setRawOcrText] = useState("");
  const [identityFields, setIdentityFields] = useState<ExtractedIdentityField[]>([]);
  const [readSummary, setReadSummary] = useState("");
  const [suggestions, setSuggestions] = useState<IdentityValues>({});
  const [selected, setSelected] = useState<IdentityField[]>([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pythonStatus, setPythonStatus] = useState("لم يُختبر اتصال Python بعد.");
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputId, setVideoInputId] = useState("");
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [snapiStatus, setSnapiStatus] = useState("لم يُختبر الاتصال بعد.");
  const videoRef = useRef<HTMLVideoElement>(null);

  const frontUrl = useMemo(() => front ? URL.createObjectURL(front) : "", [front]);
  const backUrl = useMemo(() => back ? URL.createObjectURL(back) : "", [back]);
  useEffect(() => () => { if (frontUrl) URL.revokeObjectURL(frontUrl); }, [frontUrl]);
  useEffect(() => () => { if (backUrl) URL.revokeObjectURL(backUrl); }, [backUrl]);
  useEffect(() => {
    if (videoRef.current && videoStream) videoRef.current.srcObject = videoStream;
  }, [videoStream]);
  useEffect(() => () => videoStream?.getTracks().forEach((track) => track.stop()), [videoStream]);

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
      setMessage("لم أتعرف تلقائيًا على حقول معروفة. يمكنك مراجعة النص الخام وإدخال القيم يدويًا أدناه.");
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

  const testPythonProcessor = async () => {
    setWorking(true);
    setError("");
    setPythonStatus("جارٍ الاتصال...");
    try {
      const response = await fetch(PYTHON_PROCESSOR_URL, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error("لم يستجب معالج Python داخل المشروع.");
      setPythonStatus("جاهز داخل المشروع. النص يُعالج مؤقتًا في الذاكرة.");
      setMessage("المعالج جاهز. امسح الباركود في مربع النص.");
    } catch {
      setPythonStatus("غير متاح.");
      setError("تعذر تشغيل قارئ PDF417 في Python. تأكد من تثبيت متطلبات tools/requirements-identity.txt وأن الأمر python أو python3 متاح.");
    } finally {
      setWorking(false);
    }
  };

  const readBarcode = async (source = barcodeText) => {
    setError("");
    setBarcodeText(source);
    setIdentityFields([]);
    setReadSummary("");
    setWorking(true);
    setMessage("جارٍ تمرير نص القارئ إلى معالج Python داخل المشروع...");
    try {
      const response = await fetch(PYTHON_PROCESSOR_URL, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذرت معالجة النص في Python.");
      const decoded = typeof result.decodedText === "string" ? result.decodedText : source;
      const found = result.fields && typeof result.fields === "object" ? result.fields as IdentityValues : {};
      setPythonStatus("عولج النص داخل المشروع.");
      setRawOcrText(decoded);
      setIdentityFields(Array.isArray(result.identityFields) ? result.identityFields : []);
      setReadSummary(result.byteCount ? `${result.format || "PDF417"} · ${result.byteCount} بايت` : "");
      if (hasValue(found)) mergeSuggestions(found, "عالج Python نص الباركود باستخدام Windows-1256. راجع الحقول قبل تطبيقها.");
      else {
        setSuggestions((old) => ({ ...old }));
        setSelected([]);
        setMessage("عالج Python النص كاملًا، لكن تنسيقه لا يطابق الحقول المعروفة. راجع النص المفكوك أدناه.");
      }
    } catch {
      setPythonStatus("تعذرت المعالجة.");
      setError("تعذرت معالجة النص بواسطة Python داخل المشروع. تحقق من تشغيل التطبيق في وضع التطوير وتوفر Python.");
      setMessage("");
    } finally {
      setWorking(false);
    }
  };

  const clearTemporaryData = () => {
    stopVideo();
    setFront(null);
    setBack(null);
    setBarcodeText("");
    setRawOcrText("");
    setIdentityFields([]);
    setReadSummary("");
    setSuggestions({});
    setSelected([]);
    setMessage("مُسحت الصور والنص والنتائج المؤقتة من هذه الصفحة.");
    setError("");
  };

  const readImages = async () => {
    const files = [front, back].filter((file): file is File => Boolean(file));
    if (!files.length) {
      setError("ارفع صورة واحدة على الأقل من وجهي الهوية أولًا.");
      return;
    }
    setWorking(true);
    setError("");
    setIdentityFields([]);
    setReadSummary("");
    setMessage("جارٍ قراءة صورة الهوية باستخدام قارئ PDF417 في ملف Python...");
    try {
      const form = new FormData();
      for (const file of files) form.append("images", file, file.name);
      const response = await fetch(PYTHON_PROCESSOR_URL, { method: "POST", body: form, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        if (result.error === "python_dependencies_missing") {
          throw new Error("متطلبات Python غير مكتملة. ثبّتها من tools/requirements-identity.txt ثم أعد المحاولة.");
        }
        throw new Error("تعذرت قراءة صورة الهوية في Python.");
      }
      if (result.found) {
        const decoded = typeof result.decodedText === "string" ? result.decodedText : "";
        const found = result.fields && typeof result.fields === "object" ? result.fields as IdentityValues : {};
        setRawOcrText(decoded);
        setIdentityFields(Array.isArray(result.identityFields) ? result.identityFields : []);
        setReadSummary(`${result.format || "PDF417"} · ${result.byteCount || 0} بايت`);
        if (hasValue(found)) mergeSuggestions(found, "قرأ Python رمز PDF417 من الصورة. راجع الحقول الستة قبل تطبيق الاسم والكنية.");
        else setMessage("قرأ Python الباركود، لكن تعذر تحديد الاسم والكنية تلقائيًا. راجع الحقول الستة وأدخل القيم المناسبة يدويًا.");
        return;
      }

      setRawOcrText("");
      setIdentityFields([]);
      setReadSummary("");
      setMessage("لم يعثر قارئ PDF417 على باركود في الصور. تحقق من اختيار صورة الوجه الخلفي التي يظهر فيها الرمز، ثم جرّب صورة أوضح.");
    } catch (caught) {
      setError(caught instanceof Error ? `تعذر إكمال القراءة: ${caught.message}` : "تعذر إكمال القراءة.");
      setMessage("");
    } finally {
      setWorking(false);
    }
  };

  const stopVideo = () => {
    videoStream?.getTracks().forEach((track) => track.stop());
    setVideoStream(null);
  };

  const testSnapi = async () => {
    setWorking(true);
    setError("");
    setMessage("جارٍ فحص مصادر التصوير وواجهة USB...");
    setSnapiStatus("جارٍ الاختبار...");
    let cameraDevices: MediaDeviceInfo[] = [];
    let scannerCamera: MediaDeviceInfo | undefined;
    let usbDevice: any = null;
    const usb = (navigator as Navigator & { usb?: { getDevices: () => Promise<any[]>; requestDevice: (options: { filters: { vendorId?: number; productId?: number; classCode?: number; subclassCode?: number; protocolCode?: number }[] }) => Promise<any> } }).usb;
    if (usb) {
      try {
        const remembered = await usb.getDevices();
        usbDevice = remembered.find((device) => /zebex|z-3052|snapi/i.test(`${device.productName || ""} ${device.manufacturerName || ""}`));
        if (!usbDevice) usbDevice = await usb.requestDevice({ filters: [{}] });
      } catch { /* Device not selected or not available through WebUSB. */ }
    }
    if (navigator.mediaDevices?.getUserMedia && navigator.mediaDevices?.enumerateDevices) {
      try {
        const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true });
        permissionStream.getTracks().forEach((track) => track.stop());
      } catch { /* USB detection remains useful when camera access is unavailable. */ }
      try {
        cameraDevices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");
        setVideoInputs(cameraDevices);
        scannerCamera = cameraDevices.find((device) => /snapi|zebex|zebra|scanner/i.test(device.label));
        if (scannerCamera) setVideoInputId(scannerCamera.deviceId);
      } catch { /* Keep the upload flow available if camera enumeration fails. */ }
    }

    if (scannerCamera) {
      setSnapiStatus(`ظهر مصدر تصوير باسم «${scannerCamera.label}».`);
      setMessage("تم العثور على مصدر تصوير مناسب. ابدأ المعاينة لالتقاط وجهي الهوية.");
    } else if (usbDevice) {
      setSnapiStatus(`ظهر جهاز USB باسم «${usbDevice.productName || "Zebra / SNAPI"}»، لكن المتصفح لا يعرضه كمصدر صورة.`);
      setMessage("نجح فحص USB فقط. لا يمكن التقاط صورة حتى يظهر القارئ في النظام كمصدر فيديو.");
    } else {
      setSnapiStatus("لم يظهر مصدر تصوير باسم SNAPI أو ZEBEX أو ZEBRA.");
      setMessage(cameraDevices.length
        ? "لم يظهر القارئ كمصدر تصوير. يمكنك اختيار كاميرا متاحة للالتقاط، أو رفع صور الوجهين."
        : "لم يظهر مصدر فيديو أو جهاز USB. يمكنك رفع صور الوجهين لمتابعة التجربة.");
    }
    setWorking(false);
  };

  const startVideo = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("التصوير من المتصفح غير متاح. استخدم رفع الصور.");
      return;
    }
    try {
      stopVideo();
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoInputId ? { deviceId: { exact: videoInputId } } : true });
      setVideoStream(stream);
      setError("");
    } catch {
      setError("تعذر فتح مصدر التصوير المختار. أعد اختبار الاتصال أو استخدم رفع الصور.");
    }
  };

  const capture = async (side: Side) => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("انتظر ظهور المعاينة قبل التقاط الصورة.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    try {
      setSideFile(side, await fileFromCanvas(canvas, `identity-${side}.jpg`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر التقاط الصورة.");
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

  return <section className={panelClass} aria-labelledby="subscriber-identity-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><Fingerprint className="h-4 w-4"/></span>
        <div className="min-w-0">
          <h3 id="subscriber-identity-title" className="text-xs font-bold text-[#17386d] dark:text-slate-100">استيراد بيانات الهوية <span className="mr-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">تجريبي</span></h3>
          <p className="mt-1 text-[10px] leading-5 text-slate-500">الطريقة المطابقة للقارئ الخارجي: ارفع صورة الوجه الخلفي ثم اقرأ PDF417 بواسطة Python داخل المشروع. الوجه الأمامي اختياري.</p>
        </div>
      </div>
      <ProjectButton type="button" variant="secondary" disabled={working} onClick={()=>void testSnapi()}><Usb/>{working ? "جارٍ الفحص…" : "اختبار اتصال SNAPI"}</ProjectButton>
    </div>

    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-[10px] leading-5 text-blue-900 dark:border-blue-300/10 dark:bg-blue-500/[.06] dark:text-blue-100">
      <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 shrink-0"/>تُعالج الصور والبيانات داخل التطبيق في وضع التطوير ولا تُحفظ في قاعدة البيانات.</div>
      <p className="mt-1 break-words">حالة الاتصال: {snapiStatus}</p>
    </div>

    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-300/10 dark:bg-blue-500/[.035]">
      <div className="flex items-start gap-2 text-[10px] leading-5 text-blue-900 dark:text-blue-100">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-600 text-[9px] font-bold text-white">1</span>
        <p><strong>ارفع صورة الوجه الخلفي</strong> التي يظهر فيها باركود PDF417. صورة الوجه الأمامي اختيارية.</p>
      </div>
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {([{ side: "front" as const, title: "الوجه الأمامي", file: front, url: frontUrl }, { side: "back" as const, title: "الوجه الخلفي", file: back, url: backUrl }]).map(({ side, title, file, url }) => <div key={side} className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-white/10">
        <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold">{title} <span className="font-normal text-slate-400">(اختياري)</span></span>{file&&<button type="button" className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" onClick={()=>setSideFile(side,null)} aria-label={`إزالة صورة ${title}`}><X className="h-4 w-4"/></button>}</div>
        {url ? <Image src={url} alt={`معاينة ${title}`} width={320} height={128} unoptimized className="mt-2 h-32 w-full rounded-lg border border-slate-200 object-contain dark:border-white/10"/> : <label className="mt-2 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 text-center text-[10px] text-slate-500 hover:border-blue-300 dark:border-white/15 dark:bg-white/[.02]"><Upload className="h-4 w-4 text-blue-600"/>رفع صورة {title}<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event)=>setSideFile(side,event.target.files?.[0]||null)}/></label>}
      </div>)}
    </div>

    {videoInputs.length > 0 && <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <label className="min-w-[180px] flex-1 text-[10px] font-medium">مصدر التصوير<select value={videoInputId} onChange={(event)=>setVideoInputId(event.target.value)} className={`mt-1 h-10 w-full rounded-xl border px-3 text-xs outline-none ${inputClass}`}><option value="">الكاميرا الافتراضية</option>{videoInputs.map((device,index)=><option key={device.deviceId||index} value={device.deviceId}>{device.label||`كاميرا ${index+1}`}</option>)}</select></label>
      <ProjectButton type="button" variant="secondary" onClick={()=>void startVideo()}><Camera/>بدء المعاينة</ProjectButton>
    </div>}
    {videoStream&&<div className="mt-3 rounded-xl border border-blue-200 p-3 dark:border-blue-300/15"><video ref={videoRef} autoPlay playsInline muted className="max-h-64 w-full rounded-lg bg-slate-900 object-contain"/><div className="mt-2 flex flex-wrap justify-end gap-2"><ProjectButton type="button" variant="secondary" onClick={()=>void capture("front")}><Camera/>التقاط الوجه الأمامي</ProjectButton><ProjectButton type="button" variant="secondary" onClick={()=>void capture("back")}><Camera/>التقاط الوجه الخلفي</ProjectButton><ProjectButton type="button" variant="secondary" onClick={stopVideo}><X/>إيقاف</ProjectButton></div></div>}

    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-300/10 dark:bg-blue-500/[.05]">
      <div className="flex items-start gap-2 text-[10px] leading-5 text-blue-900 dark:text-blue-100">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-600 text-[9px] font-bold text-white">2</span>
        <p><strong>اقرأ الباركود من الصورة.</strong> يقرأ Python بايتات PDF417 مباشرة، ثم يفك الحقول بترميز Windows-1256 مثل التطبيق الخارجي.</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] text-slate-500">تظهر النتيجة للمراجعة فقط ولا تُحفظ في قاعدة البيانات.</p>
        <ProjectButton type="button" disabled={working || (!front && !back)} onClick={()=>void readImages()}><FileImage/>{working ? "جارٍ قراءة PDF417 عبر Python…" : "قراءة باركود الصورة عبر Python"}</ProjectButton>
      </div>
    </div>
    <details className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <summary className="cursor-pointer text-[10px] font-semibold text-slate-600 dark:text-slate-300">طريقة بديلة: إدخال نص القارئ (keyboard-wedge)</summary>
      <p className="mt-2 text-[10px] leading-5 text-slate-500">استخدمها فقط إذا كان القارئ يرسل النص بترميز سليم. بعض الأجهزة تغيّر ترميز النص؛ عندها ارفع صورة الباركود واستخدم الطريقة الأساسية أعلاه للحصول على نتيجة مطابقة للتطبيق الخارجي.</p>
      <textarea value={barcodeText} onChange={(event)=>setBarcodeText(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void readBarcode(event.currentTarget.value.replace(/[\r\n]+$/,""));}}} rows={3} maxLength={30000} placeholder="امسح الرمز هنا؛ سيعالجه Python المحلي عند Enter…" className={`mt-2 min-h-20 w-full rounded-xl border p-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 ${inputClass}`} dir="auto"/>
      <p className="mt-2 text-[9px] text-slate-500">حالة Python: {pythonStatus}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-[9px] text-slate-400">يعالج مسار التطوير البيانات داخل المشروع مؤقتًا.</p><div className="flex flex-wrap gap-2"><ProjectButton type="button" variant="secondary" onClick={clearTemporaryData}><X/>مسح المؤقت</ProjectButton><ProjectButton type="button" variant="secondary" onClick={()=>void testPythonProcessor()} disabled={working}><Usb/>{working ? "جارٍ الاختبار…" : "اختبار Python"}</ProjectButton><ProjectButton type="button" variant="secondary" onClick={()=>void readBarcode()} disabled={working || !barcodeText.trim()}><ScanLine/>تحليل عبر Python</ProjectButton></div></div>
    </details>
    {message&&<p role="status" className="mt-2 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-[10px] leading-5 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0"/>{message}</p>}
    {error&&<p role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[10px] leading-5 text-red-700 dark:bg-red-500/10 dark:text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{error}</p>}

    {(hasValue(suggestions) || rawOcrText || identityFields.length > 0) && <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-300/10 dark:bg-violet-500/[.04]">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-[11px] font-bold text-violet-900 dark:text-violet-100">مراجعة المعلومات المستخرجة <span className="mr-1 text-[9px] font-normal text-slate-500">(الخطوة 3)</span></h4><p className="mt-1 text-[9px] text-slate-500">تحقق من الحقول وعدّلها، ثم اختر ما تريد تطبيقه. لن تُستبدل الحقول المعبأة يدويًا.</p></div><ProjectButton type="button" disabled={!selected.some((field)=>Boolean(suggestions[field]?.trim())&&!currentValues[field]?.trim())} onClick={applySelected}><Check/>تطبيق المحدد على الحقول الفارغة</ProjectButton></div>
      {readSummary&&<p className="mt-3 text-[10px] font-semibold text-violet-800 dark:text-violet-200">{readSummary}</p>}
      {identityFields.length>0&&<div className="mt-2 grid gap-2 sm:grid-cols-2">{identityFields.map((field,index)=><div key={`${field.label}-${index}`} className="min-w-0 rounded-lg border border-violet-100 bg-white/70 p-2 dark:border-violet-300/10 dark:bg-white/[.025]"><div className="text-[9px] font-semibold text-slate-500">{field.label}</div><div className="mt-1 break-words text-xs" dir="auto">{field.value}</div></div>)}</div>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{FIELD_ORDER.map((field)=><label key={field} className="flex min-w-0 items-start gap-2 rounded-lg border border-violet-100 bg-white/70 p-2 dark:border-violet-300/10 dark:bg-white/[.025]"><input type="checkbox" checked={selected.includes(field)} onChange={()=>toggleField(field)} disabled={Boolean(currentValues[field]?.trim())} className="mt-1 accent-blue-600"/><span className="min-w-0 flex-1"><span className="flex items-center gap-1 text-[10px] font-semibold">{FIELD_LABELS[field]}{currentValues[field]?.trim()&&<span className="font-normal text-amber-600">· الحقل ممتلئ</span>}</span><ProjectInput value={suggestions[field]||""} onChange={(event)=>updateSuggestion(field,event.target.value)} className={`mt-1 !h-9 !text-xs ${inputClass}`} maxLength={field === "address" ? 500 : 100}/></span></label>)}</div>
      {rawOcrText&&<details className="mt-3 rounded-lg border border-slate-200 bg-white/70 p-2 text-[10px] dark:border-white/10 dark:bg-white/[.025]"><summary className="cursor-pointer font-semibold text-slate-600">عرض النص الخام للمراجعة</summary><textarea readOnly value={rawOcrText} rows={5} className={`mt-2 w-full rounded-lg border p-2 text-[10px] ${inputClass}`} dir="auto"/></details>}
      <p className="mt-2 text-[9px] leading-5 text-slate-500">المرحلة التجريبية لا تحفظ صور الهوية ولا البيانات المستخرجة في قاعدة البيانات. زر الحفظ الحالي سيحفظ حقول المشترك المعتادة فقط.</p>
    </div>}
  </section>;
}
