const PAGE_SOURCE = "radius-lord-identity-page";
const EXTENSION_SOURCE = "radius-lord-identity-extension";
const ALLOWED_ACTIONS = new Set(["scanner-status", "scanner-capture-image", "scanner-preview-start"]);

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "identity-native-preview-event" || typeof message.requestId !== "string") return;
  window.postMessage({
    source: EXTENSION_SOURCE,
    type: message.result?.type || "preview-error",
    requestId: message.requestId,
    result: message.result,
  }, window.location.origin);
});

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const request = event.data;
  if (request?.source !== PAGE_SOURCE || typeof request.requestId !== "string") return;

  if (request.type === "presence") {
    window.postMessage({ source: EXTENSION_SOURCE, type: "presence-response", requestId: request.requestId }, window.location.origin);
    return;
  }

  if (request.type === "cancel") {
    chrome.runtime.sendMessage({ type: "identity-native-cancel", requestId: request.requestId });
    return;
  }
  if (request.type !== "request" || !ALLOWED_ACTIONS.has(request.action)) return;

  chrome.runtime.sendMessage({ type: "identity-native-request", requestId: request.requestId, action: request.action }, (result) => {
    const response = chrome.runtime.lastError
      ? { ok: false, error: "identity_extension_unavailable" }
      : result;
    window.postMessage({ source: EXTENSION_SOURCE, requestId: request.requestId, result: response }, window.location.origin);
  });
});
