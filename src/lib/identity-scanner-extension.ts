export type IdentityScannerAction = "scanner-status" | "scanner-capture-image";

type IdentityScannerResult = {
  ok?: boolean;
  error?: string;
  scannerCount?: number;
  scannerModels?: string[];
  bridgeVersion?: string;
  imageBase64?: string;
  mimeType?: string;
  format?: string;
  byteCount?: number;
  storage?: "memory-only";
};

type ExtensionReply = { source?: string; type?: string; requestId?: string; result?: IdentityScannerResult };

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
