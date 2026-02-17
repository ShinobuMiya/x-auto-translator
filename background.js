importScripts("translator.js");

console.log("[BG] Service Worker started");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "translate") {
    console.log("[BG] Translate request:", message.text.substring(0, 50));
    handleTranslate(message.text, message.libreUrl, message.targetLang, message.engine)
      .then((result) => {
        console.log("[BG] Translate result:", JSON.stringify(result).substring(0, 100));
        sendResponse(result);
      })
      .catch((err) => {
        console.error("[BG] Translate error:", err.message);
        sendResponse({ error: err.message });
      });
    return true; // keep message channel open for async response
  }

  if (message.type === "getStatus") {
    sendResponse({ ok: true });
    return false;
  }
});

async function handleTranslate(text, libreUrl, targetLang, engine) {
  try {
    const result = await translate(text, libreUrl, targetLang, engine);
    return result;
  } catch (err) {
    console.error("[BG] handleTranslate failed:", err.message);
    return { error: err.message };
  }
}
