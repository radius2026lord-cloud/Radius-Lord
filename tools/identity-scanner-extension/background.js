importScripts("config.js");

const HOST_NAME = "com.radiuslord.identity_capture";
const ALLOWED_ACTIONS = new Set(["scanner-status", "scanner-capture-image", "scanner-preview-start"]);
const activePorts = new Map();

function forwardPreviewEvent(sender, requestId, result) {
  if (!sender.tab?.id) return;
  chrome.tabs.sendMessage(sender.tab.id, {
    type: "identity-native-preview-event",
    requestId,
    result,
  }, { frameId: sender.frameId }, () => void chrome.runtime.lastError);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "identity-native-cancel") {
    const port = activePorts.get(message.requestId);
    if (port) {
      activePorts.delete(message.requestId);
      port.disconnect();
    }
    sendResponse({ ok: true });
    return undefined;
  }
  if (message?.type !== "identity-native-request" || typeof message.requestId !== "string") return undefined;
  const senderUrl = sender.url || sender.tab?.url || "";
  let senderOrigin = "";
  try { senderOrigin = new URL(senderUrl).origin; } catch { /* reject malformed senders */ }
  if (!RADIUS_LORD_APP_ORIGIN || senderOrigin !== RADIUS_LORD_APP_ORIGIN || !ALLOWED_ACTIONS.has(message.action)) {
    sendResponse({ ok: false, error: "identity_extension_origin_or_action_rejected" });
    return undefined;
  }

  const port = chrome.runtime.connectNative(HOST_NAME);
  activePorts.set(message.requestId, port);
  const isPreview = message.action === "scanner-preview-start";
  let settled = false;
  const finish = (result) => {
    if (settled) return;
    settled = true;
    activePorts.delete(message.requestId);
    clearTimeout(timer);
    port.disconnect();
    sendResponse(result);
  };
  const timer = isPreview ? null : setTimeout(() => finish({ ok: false, error: "identity_native_host_timeout" }), 65000);
  if (isPreview) {
    port.onMessage.addListener((result) => {
      forwardPreviewEvent(sender, message.requestId, result);
      if (result?.type === "preview-error") {
        activePorts.delete(message.requestId);
        port.disconnect();
      }
    });
    port.onDisconnect.addListener(() => {
      activePorts.delete(message.requestId);
      if (!settled) forwardPreviewEvent(sender, message.requestId, {
        type: "preview-stopped",
        error: chrome.runtime.lastError?.message || "",
      });
    });
    sendResponse({ ok: true, streaming: true });
    port.postMessage({ action: message.action });
    return undefined;
  }
  port.onMessage.addListener(finish);
  port.onDisconnect.addListener(() => {
    if (!settled) finish({ ok: false, error: chrome.runtime.lastError?.message || "identity_native_host_disconnected" });
  });
  port.postMessage({ action: message.action });
  return true;
});
