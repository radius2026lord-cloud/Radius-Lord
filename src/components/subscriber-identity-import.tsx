"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AlertCircle, ArrowLeft, BadgeCheck, Camera, Download, Fingerprint, ScanLine, Upload, Usb, X, RotateCcw } from "lucide-react";
import ProjectButton from "@/components/ui/project-button";
import ProjectDialog from "@/components/ui/project-dialog";
import ProjectTooltip from "@/components/ui/project-tooltip";
import { detectIdentityScannerExtension, requestIdentityScanner } from "@/lib/identity-scanner-extension";

type IdentityField = "firstName" | "lastName";
type IdentityValues = Partial<Record<IdentityField, string>>;
export type IdentityDocumentDraft = { fatherName: string; motherName: string; birthPlaceDate: string; nationalNumber: string; captureMethod: "qr" };
export type IdentityImagesDraft = { front: string | null; back: string | null };
type IdentityFormField = { label: string; value: string };
type Side = "front" | "back";

const IDENTITY_FIELD_LABELS = ["الاسم", "الكنية", "اسم الأب", "اسم الأم", "محل وتاريخ الولادة", "الرقم الوطني"];
const panelClass = "rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.025]";
const inputClass = "border-[#9fb8d2] bg-white text-[#17386d] dark:border-white/15 dark:bg-[#17263b] dark:text-[#dce8fa]";
const PYTHON_PROCESSOR_URL = "/api/identity/decode";
// Show progress while decoding, but never hold the completed form for an artificial delay.
const REQUIRED_IDENTITY_BRIDGE_VERSION = "0.3.1";
const SETUP_PROMPT_STORAGE_KEY = "rl:identity-scanner-setup-prompted-v1";

export default function SubscriberIdentityImport({
  currentValues,
  onApply,
  onNameChange,
  onIdentityDocumentChange,
  onIdentityImagesChange,
  onBackToList,
  onCaptureDialogChange,
  renderBeforeCapture,
}: {
  currentValues: IdentityValues;
  onApply: (values: IdentityValues) => void;
  onNameChange: (field: IdentityField, value: string) => void;
  onIdentityDocumentChange: (value: IdentityDocumentDraft | null) => void;
  onIdentityImagesChange: (value: (current: IdentityImagesDraft) => IdentityImagesDraft) => void;
  onBackToList: () => void;
  onCaptureDialogChange?: (open: boolean) => void;
  renderBeforeCapture?: ReactNode;
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
  const [capturingSide, setCapturingSide] = useState<Side | null>(null);
  const [positioningSide, setPositioningSide] = useState<Side | null>(null);
  const [captureExtensionReady, setCaptureExtensionReady] = useState(false);
  const [barcodeRead, setBarcodeRead] = useState(false);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [setupIssue, setSetupIssue] = useState<"extension" | "bridge" | "update">("extension");
  const [checkingSetup, setCheckingSetup] = useState(false);
  const frontFileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);
  const showCaptureDialog = (side: Side | null) => {
    setPositioningSide(side);
    onCaptureDialogChange?.(side !== null);
  };
  const requestController = useRef<AbortController | null>(null);
  const statusPollController = useRef<AbortController | null>(null);
  const closeProcessingTimerRef = useRef<number | null>(null);
  const autoListenRef = useRef(false);
  const autoStartSuppressedRef = useRef(false);
  const scannerCaptureInProgressRef = useRef(false);
  const activeBarcodeReadRef = useRef<{ done: Promise<void> } | null>(null);
  const hasIdentityBeenReadRef = useRef(false);
  const setupPromptedRef = useRef(false);
  const readBarcodeRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    try { setupPromptedRef.current = window.localStorage.getItem(SETUP_PROMPT_STORAGE_KEY) === "1"; } catch {}
  }, []);

  const promptForSetup = (force = false) => {
    if (!force && setupPromptedRef.current) return;
    setupPromptedRef.current = true;
    try { window.localStorage.setItem(SETUP_PROMPT_STORAGE_KEY, "1"); } catch {}
    setSetupDialogOpen(true);
  };

  const clearSetupPrompt = () => {
    setupPromptedRef.current = false;
    try { window.localStorage.removeItem(SETUP_PROMPT_STORAGE_KEY); } catch {}
  };

  const frontUrl = useMemo(() => front ? URL.createObjectURL(front) : "", [front]);
  const backUrl = useMemo(() => back ? URL.createObjectURL(back) : "", [back]);
  useEffect(() => () => { if (frontUrl) URL.revokeObjectURL(frontUrl); }, [frontUrl]);
  useEffect(() => () => { if (backUrl) URL.revokeObjectURL(backUrl); }, [backUrl]);
  useEffect(() => {
    if (!positioningSide) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [positioningSide]);
  useEffect(() => () => {
    if (closeProcessingTimerRef.current !== null) window.clearTimeout(closeProcessingTimerRef.current);
  }, []);
  const emergencyReset = () => {
    autoListenRef.current = false;
    autoStartSuppressedRef.current = true;
    scannerCaptureInProgressRef.current = false;
    requestController.current?.abort();
    requestController.current = null;
    showCaptureDialog(null);
    if (closeProcessingTimerRef.current !== null) window.clearTimeout(closeProcessingTimerRef.current);
    closeProcessingTimerRef.current = null;
    setClosingProcessing(false);
    setWorking(false);
    setCapturingSide(null);
    setProcessing(false);
    setProcessingComplete(false);
    setProcessingProgress(0);
    setSnapiStatus(scannerModels.length ? "القارئ جاهز." : "أُوقفت العملية؛ أعد فحص القارئ.");
    setMessage("");
    setError("");
  };

  const setSideFile = async (side: Side, file: File | null) => {
    setError("");
    if (file && (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024)) {
      setError("اختر صورة بصيغة مدعومة لا يتجاوز حجمها 12 ميغابايت.");
      return;
    }
    (side === "front" ? setFront : setBack)(file);
    try {
      let encoded: string | null = null;
      if (file) {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("تعذر تجهيز صورة الهوية.");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("تعذر ضغط صورة الهوية.")), "image/jpeg", 0.78));
        if (blob.size > 1_500_000) throw new Error("حجم الصورة بعد تجهيزها يتجاوز 1.5 ميغابايت.");
        encoded = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("تعذر تجهيز صورة الهوية."));
          reader.onerror = () => reject(new Error("تعذر قراءة صورة الهوية."));
          reader.readAsDataURL(blob);
        });
      }
      onIdentityImagesChange(current => ({ ...current, [side]: encoded }));
    } catch (caught) {
      (side === "front" ? setFront : setBack)(null);
      setError(caught instanceof Error ? caught.message : "تعذر تجهيز صورة الهوية.");
    }
  };

  const prepareScannerSide = (side: Side) => {
    if (working || capturingSide) return;
    if (!barcodeRead) {
      setError("اقرأ باركود الهوية أولًا، ثم ابدأ تصوير الوجهين.");
      return;
    }
    if (!captureExtensionReady) {
      void checkCaptureExtension(true);
      return;
    }
    showCaptureDialog(side);
    setError("");
    setMessage(`ضع ${side === "front" ? "الوجه الأمامي" : "الوجه الخلفي"} داخل إطار التوجيه، ثم اضغط زر الالتقاط.`);
  };

  const captureScannerSide = async (side: Side) => {
    if (capturingSide || processing || scannerCaptureInProgressRef.current) return;
    if (!captureExtensionReady) {
      void checkCaptureExtension(true);
      return;
    }
    scannerCaptureInProgressRef.current = true;
    const controller = new AbortController();
    autoListenRef.current = false;
    statusPollController.current?.abort();
    const activeBarcodeRead = activeBarcodeReadRef.current;
    requestController.current?.abort();
    requestController.current = controller;
    setCapturingSide(side);
    setWorking(true);
    setSnapiStatus("جارٍ التقاط صورة الهوية…");
    setError("");
    setMessage(`جارٍ التقاط ${side === "front" ? "الوجه الأمامي" : "الوجه الخلفي"} من القارئ…`);

    try {
      // Stop PDF417 listening before switching the same SNAPI reader into image mode.
      if (activeBarcodeRead) {
        const barcodeStopped = await new Promise<boolean>((resolve) => {
          const timeout = window.setTimeout(() => resolve(false), 3000);
          activeBarcodeRead.done.then(() => {
            window.clearTimeout(timeout);
            resolve(true);
          });
        });
        if (!barcodeStopped) throw new Error("barcode_listener_stop_timeout");
      }
      // Give the scanner SDK a short settle window after the barcode process closes.
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      const result = await requestIdentityScanner("scanner-capture-image", 65000, controller.signal);
      if (controller.signal.aborted) return;
      if (result.ok !== true || !result.imageBase64) {
        throw new Error(result.error === "scanner_image_capture_timeout"
          ? "انتهت مهلة التصوير؛ تعرّف النظام على القارئ لكنه لم يستقبل صورة. تحقق من وضع SNAPI مع واجهة التصوير وتعريفه."
          : result.error === "scanner_snapi_imaging_required"
            ? "ظهر القارئ، لكن اتصال التصوير SNAPI غير متاح. أعد ضبطه على SNAPI مع Imaging Interface ثم أعد فحصه."
          : result.error === "scanner_image_transfer_failed"
            ? "بدأ القارئ التصوير، لكن تعذر نقل الصورة. أعد توصيله وتحقق من تعريف SNAPI Imaging."
          : result.error === "scanner_image_trigger_failed"
            ? "وصل طلب التصوير، لكن القارئ لم يبدأ الالتقاط. تحقق من تعريف SNAPI وأعد توصيل القارئ."
          : result.error === "identity_native_host_disconnected"
            ? "تعذر الاتصال ببرنامج الربط المحلي. أعد تثبيت إضافة التقاط الهوية وافحص اتصال القارئ."
            : "تعذر التقاط الصورة من القارئ. تحقق من وضع SNAPI مع واجهة التصوير.");
      }

      const binary = window.atob(result.imageBase64);
      const imageBytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) imageBytes[index] = binary.charCodeAt(index);
      const capturedFile = new File([imageBytes], `identity-${side}.${result.format || "jpg"}`, {
        type: result.mimeType || "image/jpeg",
      });
      await setSideFile(side, capturedFile);
      showCaptureDialog(side === "front" && !back ? "back" : null);
      setSnapiStatus("القارئ جاهز.");
      setMessage(side === "front" && !back
        ? "تم التقاط الوجه الأمامي. انتقل الآن إلى تصوير الوجه الخلفي."
        : front || side === "front" ? "تم التقاط وجهي الهوية مؤقتًا. يمكنك مراجعة المعاينتين أو إعادة تصوير أي وجه." : "تم التقاط الوجه الخلفي مؤقتًا.");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setSnapiStatus(captureExtensionReady ? "القارئ جاهز." : "القارئ غير جاهز.");
      const errorCode = caught instanceof Error ? caught.message : "";
      setError(errorCode === "identity_extension_unavailable"
        ? "تعذر الاتصال بإضافة الالتقاط. أعد تحميل الصفحة وتحقق من تشغيل برنامج الربط المحلي."
        : errorCode === "barcode_listener_stop_timeout"
          ? "تعذر إيقاف استماع باركود PDF417 بأمان. أعد فحص القارئ ثم حاول التقاط الصورة مجددًا."
        : errorCode === "scanner_image_transport_too_large"
          ? "تعذر ضغط صورة القارئ إلى حجم النقل الآمن؛ أعد الالتقاط أو تحقق من إعدادات صورة الجهاز."
          : caught instanceof Error ? caught.message : "تعذر التقاط الصورة من القارئ.");
      setMessage("");
    } finally {
      scannerCaptureInProgressRef.current = false;
      if (requestController.current === controller) {
        requestController.current = null;
        setCapturingSide(null);
        setWorking(false);
        if (scannerModels.length && !hasIdentityBeenReadRef.current && !autoStartSuppressedRef.current) {
          autoListenRef.current = true;
          window.setTimeout(() => { if (autoListenRef.current) void readBarcodeRef.current(); }, 200);
        }
      }
    }
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
    if (scannerCaptureInProgressRef.current || activeBarcodeReadRef.current) return;
    let finishBarcodeRead = () => {};
    const done = new Promise<void>((resolve) => { finishBarcodeRead = resolve; });
    activeBarcodeReadRef.current = { done };
    const controller = new AbortController();
    requestController.current = controller;
    setWorking(true);
    setProcessing(false);
    setProcessingComplete(false);
    setProcessingProgress(0);
    setClosingProcessing(false);
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
      const resultHolder: { value: Record<string, unknown> | null } = { value: null };
      const handleEvent = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as { type?: string; stage?: string; result?: Record<string, unknown> };
        if (event.type === "progress" && event.stage === "processing") {
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
      setBarcodeRead(true);
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
      }));
      setIdentityFields(nextFields);
      onIdentityDocumentChange({
        fatherName: nextFields[2]?.value || "",
        motherName: nextFields[3]?.value || "",
        birthPlaceDate: nextFields[4]?.value || "",
        nationalNumber: nextFields[5]?.value || "",
        captureMethod: "qr",
      });
      setScannerModels(Array.isArray(scanResult.scannerModels) ? scanResult.scannerModels as string[] : scannerModels);
      // The Python decoder may return the six ordered identityFields without
      // a separate `fields` object. Use the values already rendered in the
      // name and surname inputs so the subscriber draft receives them too.
      const names: IdentityValues = {};
      const firstName = nextFields[0]?.value?.trim() || found.firstName?.trim() || "";
      const lastName = nextFields[1]?.value?.trim() || found.lastName?.trim() || "";
      if (!currentValues.firstName?.trim() && firstName) {
        names.firstName = firstName;
        onNameChange("firstName", firstName);
      }
      if (!currentValues.lastName?.trim() && lastName) {
        names.lastName = lastName;
        onNameChange("lastName", lastName);
      }
      if (Object.keys(names).length) onApply(names);
      setMessage("تم ملء حقول الهوية. أكمل بيانات التواصل أدناه.");
      scanSucceeded = true;
      setProcessingProgress(100);
      setProcessingComplete(true);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      autoListenRef.current = false;
      setError(caught instanceof Error ? `تعذر إكمال القراءة: ${caught.message}` : "تعذر إكمال القراءة.");
      setMessage("");
    } finally {
      if (activeBarcodeReadRef.current?.done === done) {
        activeBarcodeReadRef.current = null;
        finishBarcodeRead();
      }
      if (requestController.current === controller) {
        requestController.current = null;
        if (retryAfterTimeout && autoListenRef.current) {
          window.setTimeout(() => { if (autoListenRef.current) void readBarcodeRef.current(); }, 150);
        } else {
          setWorking(false);
          if (!scanSucceeded) {
            setProcessing(false);
            setProcessingProgress(0);
          }
        }
      }
    }
  }, [currentValues, onApply, onNameChange, onIdentityDocumentChange, scannerModels]);

  useEffect(() => { readBarcodeRef.current = readBarcode; }, [readBarcode]);

  const checkCaptureExtension = async (forcePrompt = false) => {
    const extensionDetected = await detectIdentityScannerExtension();
    if (!extensionDetected) {
      setCaptureExtensionReady(false);
      setSetupIssue("extension");
      promptForSetup(forcePrompt);
      return false;
    }

    try {
      const result = await requestIdentityScanner("scanner-status", 3000);
      if (result.bridgeVersion !== REQUIRED_IDENTITY_BRIDGE_VERSION) {
        setCaptureExtensionReady(false);
        setSetupIssue("update");
        promptForSetup(forcePrompt);
        return false;
      }
      const ready = result.ok === true && Boolean(result.scannerCount);
      setCaptureExtensionReady(ready);
      const bridgeUnavailable = result.ok !== true && result.error !== "scanner_not_found";
      if (bridgeUnavailable) {
        setSetupIssue("bridge");
        promptForSetup(forcePrompt);
      } else {
        clearSetupPrompt();
        setSetupDialogOpen(false);
      }
      return ready;
    } catch {
      setCaptureExtensionReady(false);
      setSetupIssue("bridge");
      promptForSetup(forcePrompt);
      return false;
    }
  };

  const recheckInstallation = async () => {
    setCheckingSetup(true);
    try {
      const extensionDetected = await detectIdentityScannerExtension();
      if (!extensionDetected) {
        await checkCaptureExtension(true);
        return;
      }
      const result = await requestIdentityScanner("scanner-status", 3000);
      if (result.bridgeVersion !== REQUIRED_IDENTITY_BRIDGE_VERSION) {
        setCaptureExtensionReady(false);
        setSetupIssue("update");
        promptForSetup(true);
        return;
      }
      const bridgeInstalled = result.ok === true || result.error === "scanner_not_found";
      if (!bridgeInstalled) {
        await checkCaptureExtension(true);
        return;
      }
      setCaptureExtensionReady(result.ok === true && Boolean(result.scannerCount));
      clearSetupPrompt();
      setSetupDialogOpen(false);
      setMessage(result.ok ? "تم العثور على إضافة الالتقاط والقارئ." : "تم العثور على الإضافة؛ تحقق من توصيل القارئ وضبطه على SNAPI.");
    } catch {
      await checkCaptureExtension(true);
    } finally {
      setCheckingSetup(false);
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
      await checkCaptureExtension();
      return models.length > 0;
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return false;
      if (await checkCaptureExtension()) {
        setSnapiStatus("القارئ جاهز.");
        setError("");
        setMessage("");
        return false;
      }
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

  const verifyAndListen = async (forceSetupPrompt = false) => {
    autoListenRef.current = false;
    autoStartSuppressedRef.current = false;
    hasIdentityBeenReadRef.current = false;
    setBarcodeRead(false);
    onIdentityDocumentChange(null);
    const ready = await testSnapi();
    if (forceSetupPrompt) await checkCaptureExtension(true);
    if (ready) {
      autoListenRef.current = true;
      void readBarcode();
    }
  };

  const continueAfterProcessing = useCallback(() => {
    if (closeProcessingTimerRef.current !== null) window.clearTimeout(closeProcessingTimerRef.current);
    setClosingProcessing(true);
    closeProcessingTimerRef.current = window.setTimeout(() => {
      setProcessing(false);
      setProcessingComplete(false);
      setProcessingProgress(0);
      setClosingProcessing(false);
      setMessage("");
      closeProcessingTimerRef.current = null;
    }, 180);
  }, []);

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
            const captureReady = models.length ? false : await checkCaptureExtension();
            setSnapiStatus(models.length || captureReady ? "القارئ جاهز." : "القارئ غير جاهز.");
            if (models.length && !hasIdentityBeenReadRef.current && !autoStartSuppressedRef.current) {
              autoListenRef.current = true;
              void readBarcodeRef.current();
            }
          }
        } catch {
          if (!disposed && !controller.signal.aborted) {
            setScannerModels([]);
            const captureReady = await checkCaptureExtension();
            if (!disposed) setSnapiStatus(captureReady ? "القارئ جاهز." : "القارئ غير جاهز.");
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
    // The status poll is intentionally bound to the component's initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <section className={panelClass} aria-labelledby="subscriber-identity-title">
    <ProjectDialog
      open={setupDialogOpen}
      onClose={() => setSetupDialogOpen(false)}
      title={setupIssue === "extension" ? "إضافة التقاط الهوية غير مثبتة" : setupIssue === "update" ? "يتوفر تحديث لجسر قارئ الهوية" : "برنامج ربط القارئ غير جاهز"}
      description={setupIssue === "update" ? "نسخة برنامج الربط المحلية أقدم من المطلوبة لالتقاط صور الهوية. نزّل التحديث وشغّل المثبّت على هذا اللابتوب." : "يحتاج التقاط صور الهوية إلى إضافة Chrome وبرنامج الربط المحلي على لابتوب يعمل بنظام Windows."}
      maxWidth="max-w-xl"
      footer={<><ProjectButton type="button" variant="secondary" onClick={() => setSetupDialogOpen(false)}>المتابعة بدون تثبيت</ProjectButton><ProjectButton type="button" disabled={checkingSetup} onClick={() => void recheckInstallation()}><Usb/>{checkingSetup ? "جارٍ التحقق…" : "أعد التحقق"}</ProjectButton></>}
    >
      <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
        {setupIssue === "extension"
          ? "لم يتمكن الموقع من اكتشاف إضافة Lord Radius في هذا المتصفح. نزّل حزمة التثبيت واتبع الخطوات أدناه؛ ستظهر هذه النافذة تلقائيًا مرة واحدة على هذا المتصفح."
          : setupIssue === "update"
            ? "اكتشف الموقع أن برنامج الربط المحلي يحتاج تحديثًا. نزّل الحزمة الجديدة وشغّل المثبّت؛ ستبقى صور الهوية مؤقتة داخل الصفحة."
            : "تم اكتشاف إضافة المتصفح، لكن برنامج الربط المحلي لا يستجيب. أعد تشغيل المثبّت من الحزمة ثم أعد تحميل صفحة الموقع."}
      </p>
      <ol className="mt-4 space-y-2 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-[11px] leading-6 text-blue-950 dark:border-blue-300/10 dark:bg-blue-500/[.06] dark:text-blue-100">
        {setupIssue === "update" ? <>
          <li>١. نزّل الحزمة الجديدة واختر «استخراج الكل»؛ لا تشغّل ملف BAT من داخل ZIP أو RAR.</li>
          <li>٢. شغّل <bdi dir="ltr">tools\install-identity-scanner.bat</bdi> وأدخل أصل الموقع الظاهر هنا: <bdi dir="ltr">{typeof window !== "undefined" ? window.location.origin : ""}</bdi>.</li>
          <li>٣. بعد اكتمال التثبيت أعد تحميل هذه الصفحة واضغط «أعد التحقق»؛ لا حاجة لإعادة إضافة مجلد Chrome إذا كانت الإضافة مثبتة.</li>
        </> : <>
          <li>١. نزّل الحزمة واختر «استخراج الكل» على لابتوب Windows؛ لا تشغّل ملف BAT من داخل عارض ZIP أو RAR.</li>
          <li>٢. شغّل <bdi dir="ltr">tools\install-identity-scanner.bat</bdi> وأدخل أصل الموقع الظاهر هنا: <bdi dir="ltr">{typeof window !== "undefined" ? window.location.origin : ""}</bdi>.</li>
          <li>٣. في Chrome فعّل <bdi dir="ltr">Developer mode</bdi> ثم اختر <bdi dir="ltr">Load unpacked</bdi> وحدد مجلد الإضافة الذي يطبعه المثبّت.</li>
          <li>٤. أعد تحميل صفحة الموقع، ثم اضغط «أعد التحقق».</li>
        </>}
      </ol>
      <p className="mt-2 text-[10px] leading-5 text-slate-500">يُعرض أصل الموقع تلقائيًا من الصفحة المفتوحة، لذلك لا يعتمد ملف التثبيت على localhost ثابت. عند تغيير النطاق لاحقًا، شغّل المثبّت على الموقع الجديد مرة واحدة لهذا الجهاز.</p>
      <p className="mt-3 text-[10px] leading-5 text-slate-500">تأكد كذلك من تثبيت تعريف قارئ Z‑3052 وضبطه على SNAPI مع Imaging Interface. يبقى الإدخال اليدوي متاحًا دون تثبيت.</p>
      <a href="/downloads/lord-radius-identity-scanner-setup.zip" download className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-[14px] bg-[#0758e9] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#064fd1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0758e9]/40">
        <Download className="h-4 w-4"/>{setupIssue === "update" ? "تنزيل تحديث الجسر" : "تنزيل حزمة التثبيت"}
      </a>
    </ProjectDialog>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><Fingerprint className="h-4 w-4"/></span>
        <div className="min-w-0">
          <h3 id="subscriber-identity-title" className="text-xs font-bold text-[#17386d] dark:text-slate-100">استيراد بيانات الهوية <span className="mr-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">تجريبي</span></h3>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <ProjectTooltip label="إعادة فحص اتصال قارئ الهوية"><ProjectButton type="button" variant="secondary" disabled={working} onClick={()=>void verifyAndListen(true)}><Usb/>إعادة الفحص</ProjectButton></ProjectTooltip>
        <ProjectTooltip label="العودة إلى قائمة المشتركين"><ProjectButton type="button" variant="secondary" onClick={onBackToList}><ArrowLeft/>العودة للقائمة</ProjectButton></ProjectTooltip>
        {working&&<ProjectButton type="button" variant="secondary" onClick={emergencyReset}><RotateCcw/>إيقاف طارئ وإعادة الضبط</ProjectButton>}
      </div>
    </div>

    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-300/10 dark:bg-blue-500/[.06]">
      <div role="status" aria-live="polite" className="flex min-h-9 items-center gap-2 text-[11px] font-semibold text-blue-900 dark:text-blue-100">
        {snapiStatus==="القارئ جاهز."?<BadgeCheck className="h-4 w-4 text-emerald-600"/>:working?<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"/>:<Usb className="h-4 w-4 text-blue-600"/>}
        <span>{snapiStatus}</span>
      </div>
      <p className="text-[10px] font-medium text-blue-800 dark:text-blue-200">{capturingSide ? `جارٍ التقاط ${capturingSide === "front" ? "الوجه الأمامي" : "الوجه الخلفي"} من القارئ.` : scannerModels.length ? "امسح باركود الهوية مباشرة؛ القراءة تبدأ تلقائيًا." : "سيبدأ الاستماع تلقائيًا عند اتصال القارئ."}</p>
    </div>
    {error&&<p role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[10px] leading-5 text-red-700 dark:bg-red-500/10 dark:text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{error}</p>}

    <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[.025]" aria-label="بيانات الهوية">
      <div className="grid gap-3 sm:grid-cols-2">
        {identityFields.map((field) => <div key={field.label} className="min-w-0 space-y-1 text-[11px] font-medium">
          <span>{field.label}</span>
          <div dir="auto" className={`flex min-h-10 w-full items-center rounded-xl border px-3 py-2 text-xs font-semibold ${inputClass} ${field.value ? "" : "text-slate-400"}`}>{field.value || "بانتظار قراءة باركود الهوية"}</div>
        </div>)}
      </div>
      {message&&<div role="status" aria-live="polite" className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-[11px] font-medium text-emerald-800 dark:border-emerald-300/15 dark:bg-emerald-500/[.08] dark:text-emerald-200"><BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300"/>{message}</div>}
      <p className="mt-2 text-[9px] leading-5 text-slate-500">بيانات الهوية المستخرجة للعرض فقط، وتُحفظ مع ملف المشترك بعد تأكيده.</p>
    </section>
    {renderBeforeCapture&&<div className="mt-3 ui-state-enter">{renderBeforeCapture}</div>}

    <section className="mt-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-slate-50 p-3 dark:border-blue-300/10 dark:from-[#17263b] dark:via-[#142338] dark:to-[#122033]" aria-label="تصوير وجهي الهوية">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">
            <span aria-hidden="true" className="absolute inset-0 rounded-xl border border-blue-400/50 identity-camera-pulse"/>
            <Camera className="relative h-5 w-5"/>
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-blue-950 dark:text-blue-100">تصوير وجهي الهوية</p>
            <p className="mt-1 text-[10px] leading-5 text-slate-600 dark:text-slate-300">خطوتان سهلتان: الوجه الأمامي ثم الوجه الخلفي. الصور تبقى مؤقتة.</p>
            <p role="status" className={`mt-1 text-[10px] font-semibold ${barcodeRead||(front&&back) ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
              {front&&back ? "اكتمل تصوير الوجهين." : barcodeRead ? "تمت قراءة الباركود؛ تصوير الهوية متاح الآن." : "يتاح التصوير بالقارئ بعد قراءة باركود الهوية."}
            </p>
          </div>
        </div>
        {!(front&&back)&&<ProjectButton type="button" disabled={!barcodeRead||working||processing} onClick={()=>prepareScannerSide(front ? "back" : "front")}>
          <Camera className="identity-camera-icon"/>{front ? "متابعة تصوير الوجه الخلفي" : "ابدأ تصوير الهوية"}
        </ProjectButton>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2" aria-label="خطوات تصوير الهوية">
        {([{ side: "front" as const, label: "الوجه الأمامي", file: front }, { side: "back" as const, label: "الوجه الخلفي", file: back }]).map((step, index) => <div key={step.side} className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-semibold ${step.file ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-300/15 dark:bg-emerald-500/[.08] dark:text-emerald-200" : positioningSide === step.side ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-300/20 dark:bg-blue-500/10 dark:text-blue-100" : "border-slate-200 bg-white/70 text-slate-500 dark:border-white/10 dark:bg-white/[.02]"}`}>
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${step.file ? "bg-emerald-100 dark:bg-emerald-400/10" : "bg-slate-100 dark:bg-white/10"}`}>{step.file ? <BadgeCheck className="h-3.5 w-3.5"/> : index + 1}</span>
          <span>{step.label}</span>{step.file&&<span className="mr-auto">تم</span>}
        </div>)}
      </div>
      <style jsx global>{`@keyframes identityLaserSweep { 0%,100% { transform: translateY(-30px); opacity: .15; } 50% { transform: translateY(30px); opacity: 1; } } @keyframes identityCameraPulse { 0%,100% { transform: scale(1); opacity: .75; } 50% { transform: scale(1.08); opacity: .18; } } @keyframes identityProgressSweep { 0% { transform: translateX(260%); } 100% { transform: translateX(-260%); } } .identity-camera-pulse { animation: identityCameraPulse 1.8s ease-in-out infinite; } .identity-camera-icon { animation: identityCameraPulse 1.8s ease-in-out infinite; } .identity-progress-indeterminate { width: 38%; animation: identityProgressSweep 1.25s ease-in-out infinite; } @media (prefers-reduced-motion: reduce) { .identity-laser,.identity-camera-pulse,.identity-camera-icon,.identity-progress-indeterminate { animation: none !important; } }`}</style>
    </section>
    <section className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-white/10" aria-label="صور الهوية الاختيارية">
      <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">معاينة أو اختيار صور الوجهين</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {([{ side: "front" as const, title: "الوجه الأمامي", file: front, url: frontUrl }, { side: "back" as const, title: "الوجه الخلفي", file: back, url: backUrl }]).map(({ side, title, file, url }) => <div key={side} className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-white/10">
        <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold">{title} <span className="font-normal text-slate-400">(اختياري)</span></span><span className="flex items-center gap-1">{file&&<><ProjectTooltip label={`إعادة تصوير ${title}`}><button type="button" disabled={!barcodeRead||working||processing} className="grid h-7 w-7 place-items-center rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-40 dark:hover:bg-blue-500/10" onClick={()=>prepareScannerSide(side)} aria-label={`إعادة تصوير ${title}`}><Camera className="h-4 w-4"/></button></ProjectTooltip><button type="button" className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" onClick={()=>setSideFile(side,null)} aria-label={`إزالة صورة ${title}`}><X className="h-4 w-4"/></button></>}</span></div>
        {url ? <Image src={url} alt={`الصورة الملتقطة: ${title}`} width={320} height={128} unoptimized className="mt-2 h-32 w-full rounded-lg border border-slate-200 object-contain dark:border-white/10"/> : <div className="mt-2 flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 text-center text-[10px] text-slate-500 dark:border-white/15 dark:bg-white/[.02]"><input ref={side === "front" ? frontFileInputRef : backFileInputRef} type="file" accept="image/*" className="sr-only" aria-label={`رفع صورة ${title} من الجهاز`} onChange={(event)=>{void setSideFile(side,event.target.files?.[0]||null);event.currentTarget.value="";}}/><button type="button" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-3 text-[10px] font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-300/15 dark:bg-white/[.04] dark:text-blue-200" onClick={()=>{(side === "front" ? frontFileInputRef : backFileInputRef).current?.click();}}><Upload className="h-3.5 w-3.5"/>رفع صورة {title} من الجهاز (اختياري)</button><span>للالتقاط استخدم زر القارئ أعلاه</span></div>}
      </div>)}
      </div>
      <div className="mt-2 flex justify-end"><ProjectButton type="button" variant="secondary" onClick={clearTemporaryData}><X/>مسح الصور والنتيجة المؤقتة</ProjectButton></div>
    </section>
    {positioningSide&&typeof document!=="undefined"&&createPortal(<div className="fixed inset-0 z-[10002] grid place-items-center bg-slate-950/55 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="identity-capture-title">
      <section className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#142338]">
        <header className="shrink-0 border-b border-slate-200 p-4 dark:border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><Camera className="h-4 w-4 identity-camera-icon"/></span>
              <div className="min-w-0"><h3 id="identity-capture-title" className="text-sm font-bold text-[#17386d] dark:text-slate-100">تصوير وجهي الهوية</h3><p className="mt-0.5 text-[10px] text-slate-500">الخطوة {positioningSide === "front" ? "١ من ٢" : "٢ من ٢"}</p></div>
            </div>
            <button type="button" disabled={working} onClick={()=>showCaptureDialog(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-white/10" aria-label="إغلاق التصوير"><X className="h-4 w-4"/></button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([{ side: "front" as const, label: "١. الوجه الأمامي", file: front }, { side: "back" as const, label: "٢. الوجه الخلفي", file: back }]).map(step=><div key={step.side} className={`flex min-h-9 items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-semibold ${step.file ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-300/15 dark:bg-emerald-500/[.08] dark:text-emerald-200" : positioningSide === step.side ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-300/20 dark:bg-blue-500/10 dark:text-blue-100" : "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/[.02]"}`}><span>{step.file?<BadgeCheck className="h-3.5 w-3.5"/>:step.label}</span>{step.file&&<span>{step.label.split(". ")[1]} — تم</span>}</div>)}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200"><span>وجّه {positioningSide === "front" ? "الوجه الأمامي" : "الوجه الخلفي"} داخل إطار القارئ</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">{positioningSide === "back" ? "الخطوة الثانية" : "الخطوة الأولى"}</span></div>
          <div className="relative mx-auto mt-3 grid aspect-[1.65/1] w-full max-w-sm place-items-center overflow-hidden rounded-xl border-2 border-dashed border-blue-400 bg-slate-950 px-8 shadow-inner dark:border-blue-300/70">
            <div className="relative grid aspect-[1.6/1] w-full place-items-center overflow-hidden rounded-lg border border-white/30 bg-gradient-to-br from-slate-700 to-slate-900 shadow-xl">
              <span className="text-center text-[10px] font-semibold tracking-wide text-white/80">{positioningSide === "back" ? "وجّه منطقة الباركود نحو القارئ" : "وجّه بيانات الهوية نحو القارئ"}</span>
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <span className="identity-laser absolute inset-x-0 top-1/2 h-px bg-red-300/70 shadow-[0_0_8px_2px_rgba(248,113,113,.6)]" style={{ animation: "identityLaserSweep 2.1s ease-in-out infinite" }}/>
                <span className="identity-laser absolute inset-x-0 top-1/2 h-0.5 bg-red-400 shadow-[0_0_12px_4px_rgba(248,113,113,.85)]" style={{ animation: "identityLaserSweep 2.1s ease-in-out -0.7s infinite" }}/>
                <span className="identity-laser absolute inset-x-0 top-1/2 h-px bg-rose-200/70 shadow-[0_0_8px_2px_rgba(251,113,133,.65)]" style={{ animation: "identityLaserSweep 2.1s ease-in-out -1.4s infinite" }}/>
              </div>
            </div>
            <span className="pointer-events-none absolute inset-2 rounded-lg border border-blue-300/30"/>
          </div>
          {positioningSide === "back"&&frontUrl&&<div className="mx-auto mt-3 flex max-w-sm items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-2 dark:border-emerald-300/10 dark:bg-emerald-500/[.06]"><Image src={frontUrl} alt="معاينة الوجه الأمامي الملتقط" width={88} height={56} unoptimized className="h-14 w-20 rounded-lg border border-emerald-200 object-contain dark:border-white/10"/><span className="text-[10px] font-medium text-emerald-800 dark:text-emerald-200">تم حفظ معاينة الوجه الأمامي مؤقتًا. اقلب الهوية لتصوير الجهة الخلفية.</span></div>}
          <p className="mt-2 text-center text-[10px] leading-5 text-slate-500 dark:text-slate-400">حرّك الهوية حتى تستقر كاملة داخل الحدود تحت خطوط المسح.</p>
          {error&&<p role="alert" className="mt-2 rounded-xl bg-red-50 p-2.5 text-[10px] leading-5 text-red-700 dark:bg-red-500/10 dark:text-red-200">{error}</p>}
        </div>
        <footer className="shrink-0 border-t border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#142338]">
          <ProjectTooltip label={`التقاط ${positioningSide === "front" ? "الوجه الأمامي" : "الوجه الخلفي"} مؤقتًا من القارئ`}><span className="block"><ProjectButton type="button" className="w-full" disabled={Boolean(capturingSide)||processing} onClick={()=>void captureScannerSide(positioningSide)}><Camera/>{capturingSide===positioningSide?"جارٍ التقاط الصورة…":`التقاط ${positioningSide === "front" ? "الوجه الأمامي" : "الوجه الخلفي"}`}</ProjectButton></span></ProjectTooltip>
          {working&&<ProjectButton type="button" variant="secondary" className="mt-2 w-full" onClick={emergencyReset}><RotateCcw/>إيقاف طارئ</ProjectButton>}
        </footer>
        <style jsx global>{`@keyframes identityLaserSweep { 0%,100% { transform: translateY(-30px); opacity: .15; } 50% { transform: translateY(30px); opacity: 1; } } @media (prefers-reduced-motion: reduce) { .identity-laser { animation: none !important; } }`}</style>
      </section>
    </div>, document.body)}

    {processing&&typeof document!=="undefined"&&createPortal(<div className={`fixed inset-0 z-[10004] grid place-items-center p-4 transition-[opacity,background-color,backdrop-filter] duration-200 ${processingComplete ? "pointer-events-none bg-transparent backdrop-blur-0" : "bg-slate-950/45 backdrop-blur-[2px]"} ${closingProcessing ? "opacity-0" : "opacity-100"}`} role="dialog" aria-modal={!processingComplete} aria-labelledby="identity-processing-title">
      <section className={`pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl transition-[opacity,transform] duration-200 dark:border-white/10 dark:bg-[#142338] ${closingProcessing ? "translate-y-1 scale-[.98] opacity-0" : "translate-y-0 scale-100 opacity-100"}`}>
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
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-blue-100 dark:bg-white/10" role="progressbar" aria-label={processingComplete ? "اكتملت معالجة بيانات الهوية" : "جارٍ معالجة بيانات الهوية"} aria-valuemin={0} aria-valuemax={100} {...(processingComplete ? {"aria-valuenow": processingProgress} : {})}>
            <span className={`block h-full rounded-full ${processingComplete ? "bg-emerald-500" : "identity-progress-indeterminate bg-gradient-to-r from-sky-500 to-blue-700"}`} style={processingComplete ? { width: `${processingProgress}%` } : undefined}/>
          </div>
          <span className={`w-10 text-left text-[10px] font-bold tabular-nums ${processingComplete ? "text-emerald-600 dark:text-emerald-300" : "text-blue-700 dark:text-blue-200"}`} dir="ltr">{processingComplete ? "100%" : "جارٍ"}</span>
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
