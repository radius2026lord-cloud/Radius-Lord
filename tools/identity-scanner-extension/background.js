importScripts("config.js");

const HOST_NAME = "com.radiuslord.identity_capture";
const ALLOWED_ACTIONS = new Set(["scanner-status", "scanner-capture-image"]);
const activePorts = new Map();

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
  let settled = false;
  const finish = (result) => {
    if (settled) return;
    settled = true;
    activePorts.delete(message.requestId);
    clearTimeout(timer);
    port.disconnect();
    sendResponse(result);
  };
  const timer = setTimeout(() => finish({ ok: false, error: "identity_native_host_timeout" }), 65000);
  port.onMessage.addListener(finish);
  port.onDisconnect.addListener(() => {
    if (!settled) finish({ ok: false, error: chrome.runtime.lastError?.message || "identity_native_host_disconnected" });
  });
  port.postMessage({ action: message.action });
  return true;
});
