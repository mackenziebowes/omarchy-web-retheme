// Holds the native messaging port to the Omarchy host and mirrors the theme into storage.
const HOST = "com.omarchy.web_retheme";
let port = null;
let retry = 1000;

function connect() {
  if (port) return;
  port = chrome.runtime.connectNative(HOST);

  port.onMessage.addListener((msg) => {
    retry = 1000;
    if (msg.type === "theme") {
      chrome.storage.local.set({ theme: { name: msg.name, colors: msg.colors }, hostError: null });
    } else if (msg.type === "error") {
      chrome.storage.local.set({ hostError: msg.message });
    }
  });

  port.onDisconnect.addListener(() => {
    const err = chrome.runtime.lastError?.message || "host disconnected";
    chrome.storage.local.set({ hostError: err });
    port = null;
    setTimeout(connect, retry);
    retry = Math.min(retry * 2, 30000);
  });
}

connect();
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
