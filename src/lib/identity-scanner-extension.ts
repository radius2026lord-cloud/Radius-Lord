export type IdentityScannerAction = "scanner-status" | "scanner-capture-image" | "scanner-preview-start";

type IdentityScannerResult = {
  ok?: boolean;
  error?: string;
  scannerCount?: number;
  scannerModels?: string[];
  bridgeVersion?: string;
  imageBase64?: string;
  streaming?: boolean;
  mimeType?: string;
  format?: string;
  byteCount?: number;
  storage?: "memory-only";
};

type ExtensionReply = { source?: string; type?: string; requestId?: string; result?: IdentityScannerResult };

type PreviewReply = {
  source?: string;
  type?: string;
  requestId?: string;
  result?: { imageBase64?: string; error?: string; scannerModels?: string[] };
};

export function startIdentityScannerPreview(onFrame: (dataUrl: string) => void, onError: (error: string) => void) {
  if (typeof window === "undefined") throw new Error("identity_extension_unavailable");
  const requestId = window.crypto.randomUUID();
  let settled = false;
  let resolveReady: () => void = () => {};
  let rejectReady: (error: Error) => void = () => {};
  let ready = false;

  const readyPromise = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const cleanup = () => {
    window.clearTimeout(timer);
    window.removeEventListener("message", handleEvent);
  };
  const stop = () => {
    if (settled) return;
    settled = true;
    cleanup();
    window.postMessage({ source: "radius-lord-identity-page", type: "cancel", requestId }, window.location.origin);
    if (!ready) rejectReady(new DOMException("Aborted", "AbortError"));
  };
  const timer = window.setTimeout(() => {
    if (settled) return;
    settled = true;
    cleanup();
    window.postMessage({ source: "radius-lord-identity-page", type: "cancel", requestId }, window.location.origin);
    const error = new Error("identity_preview_start_timeout");
    if (!ready) rejectReady(error);
    onError(error.message);
  }, 8000);
  const handleEvent = (event: MessageEvent<PreviewReply>) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;
    if (data?.source !== "radius-lord-identity-extension" || data.requestId !== requestId) return;
    if (data.type === "preview-ready") {
      ready = true;
      window.clearTimeout(timer);
      resolveReady();
    } else if (data.type === "preview-frame" && data.result?.imageBase64) {
      onFrame(`data:image/jpeg;base64,${data.result.imageBase64}`);
    } else if (data.type === "preview-error") {
      const error = data.result?.error || "scanner_preview_failed";
      settled = true;
      cleanup();
      if (!ready) rejectReady(new Error(error));
      onError(error);
    }
  };

  window.addEventListener("message", handleEvent);
  window.postMessage({
    source: "radius-lord-identity-page",
    type: "request",
    requestId,
    action: "scanner-preview-start",
  }, window.location.origin);

  return { ready: readyPromise, stop };
}

export function detectIdentityScannerExtension(timeoutMs = 1500) {
  if (typeof window === "undefined") return Promise.resolve(false);

  const requestId = window.crypto.randomUUID();
  return new Promise<boolean>((resolve) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", handleReply);
    };
    const timer = window.setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    const handleReply = (event: MessageEvent<ExtensionReply>) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.source !== "radius-lord-identity-extension" || event.data.type !== "presence-response" || event.data.requestId !== requestId) return;
      cleanup();
      resolve(true);
    };

    window.addEventListener("message", handleReply);
    window.postMessage({ source: "radius-lord-identity-page", type: "presence", requestId }, window.location.origin);
  });
}

export function requestIdentityScanner(action: IdentityScannerAction, timeoutMs = 5000, signal?: AbortSignal) {
  if (typeof window === "undefined") return Promise.reject(new Error("identity_extension_unavailable"));
  if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));

  const requestId = window.crypto.randomUUID();
  return new Promise<IdentityScannerResult>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", handleReply);
      signal?.removeEventListener("abort", handleAbort);
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("identity_extension_unavailable"));
    }, timeoutMs);
    const handleAbort = () => {
      cleanup();
      window.postMessage({ source: "radius-lord-identity-page", type: "cancel", requestId }, window.location.origin);
      reject(new DOMException("Aborted", "AbortError"));
    };

    const handleReply = (event: MessageEvent<ExtensionReply>) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.source !== "radius-lord-identity-extension" || event.data.requestId !== requestId) return;
      cleanup();
      if (!event.data.result) reject(new Error("identity_extension_invalid_response"));
      else resolve(event.data.result);
    };

    window.addEventListener("message", handleReply);
    signal?.addEventListener("abort", handleAbort, { once: true });
    window.postMessage({ source: "radius-lord-identity-page", type: "request", requestId, action }, window.location.origin);
  });
}
