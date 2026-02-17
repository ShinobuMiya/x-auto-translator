(() => {
  const TWEET_SELECTOR = 'div[data-testid="tweetText"]';
  const ATTR_TRANSLATED = "data-translated";
  const ATTR_OCR_TRANSLATED = "data-ocr-translated";
  // Japanese detection: hiragana + katakana only (NOT CJK kanji, to avoid matching Chinese)
  const HIRAGANA_KATAKANA_REGEX = /[\u3040-\u309F\u30A0-\u30FF]/g;
  // Full Japanese regex including kanji (for ratio calculation)
  const JP_FULL_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g;
  const JP_THRESHOLD = 0.3;
  const DEBOUNCE_MS = 300;
  const RETRY_DELAY_MS = 2000;
  const IMAGE_SELECTOR = 'div[data-testid="tweetPhoto"] img';

  // Safe wrapper for chrome.runtime.sendMessage
  // Handles Manifest V3 service worker lifecycle errors
  let contextInvalidated = false;
  function safeSendMessage(msg) {
    if (contextInvalidated) return Promise.resolve(null);
    return chrome.runtime.sendMessage(msg).catch((err) => {
      if (err.message?.includes("Extension context invalidated")) {
        console.warn("[X-Translate] Extension context invalidated. Please refresh the page.");
        contextInvalidated = true;
        observer.disconnect();
        return null;
      }
      if (err.message?.includes("message channel closed")) {
        console.warn("[X-Translate] Message channel closed, will retry");
        return null;
      }
      throw err;
    });
  }

  let enabled = true;
  let libreUrl = "";
  let targetLang = "ja";
  let engine = "google";
  let translateCount = 0;

  console.log("[X-Translate] Content script loaded");

  // Load settings
  chrome.storage.local.get(["enabled", "libreUrl", "targetLang", "engine"], (data) => {
    if (data.enabled !== undefined) enabled = data.enabled;
    if (data.libreUrl) libreUrl = data.libreUrl;
    if (data.targetLang) targetLang = data.targetLang;
    if (data.engine) engine = data.engine;
    console.log("[X-Translate] Settings loaded, enabled:", enabled, "targetLang:", targetLang, "engine:", engine);
  });

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) enabled = changes.enabled.newValue;
    if (changes.libreUrl) libreUrl = changes.libreUrl.newValue;
    if (changes.targetLang) targetLang = changes.targetLang.newValue;
    if (changes.engine) engine = changes.engine.newValue;
  });

  // Language detection patterns
  const LANG_PATTERNS = {
    ja: { regex: /[\u3040-\u309F\u30A0-\u30FF]/g, threshold: 0.1 },
    ko: { regex: /[\uAC00-\uD7AF\u1100-\u11FF]/g, threshold: 0.3 },
    "zh-CN": { regex: /[\u4E00-\u9FFF]/g, threshold: 0.3 },
    "zh-TW": { regex: /[\u4E00-\u9FFF]/g, threshold: 0.3 },
    th: { regex: /[\u0E00-\u0E7F]/g, threshold: 0.3 },
    ar: { regex: /[\u0600-\u06FF]/g, threshold: 0.3 },
    hi: { regex: /[\u0900-\u097F]/g, threshold: 0.3 },
    ru: { regex: /[\u0400-\u04FF]/g, threshold: 0.3 },
  };

  function isTargetLang(text) {
    const cleaned = text.replace(/[\s\d\p{P}\p{S}]/gu, "");
    if (cleaned.length === 0) return true;

    // For Latin-script target languages, use a simple heuristic:
    // if text is mostly ASCII/Latin, it's likely already in a Latin language
    const latinTargets = ["en", "es", "fr", "de", "pt", "id", "vi"];
    if (latinTargets.includes(targetLang)) {
      // Can't reliably detect specific Latin languages by script alone,
      // so never skip - let the translator handle it (auto-detect source)
      return false;
    }

    // Japanese: special handling to distinguish from Chinese
    if (targetLang === "ja") {
      const hkMatches = cleaned.match(HIRAGANA_KATAKANA_REGEX);
      if (!hkMatches || hkMatches.length === 0) return false;
      const fullMatches = cleaned.match(JP_FULL_REGEX);
      const jpCount = fullMatches ? fullMatches.length : 0;
      return jpCount / cleaned.length >= JP_THRESHOLD;
    }

    // Chinese: need to distinguish from Japanese
    if (targetLang === "zh-CN" || targetLang === "zh-TW") {
      const hkMatches = cleaned.match(HIRAGANA_KATAKANA_REGEX);
      if (hkMatches && hkMatches.length > 0) return false; // Has kana = Japanese
      const cjkMatches = cleaned.match(/[\u4E00-\u9FFF]/g);
      return cjkMatches && cjkMatches.length / cleaned.length >= 0.3;
    }

    // Other script-based languages
    const pattern = LANG_PATTERNS[targetLang];
    if (pattern) {
      const matches = cleaned.match(pattern.regex);
      return matches && matches.length / cleaned.length >= pattern.threshold;
    }

    return false;
  }

  async function translateElement(el) {
    if (!enabled) return;
    if (el.getAttribute(ATTR_TRANSLATED)) return;

    const text = el.innerText.trim();
    if (!text) {
      el.setAttribute(ATTR_TRANSLATED, "skip");
      return;
    }

    if (isTargetLang(text)) {
      console.log("[X-Translate] Skip (target lang):", text.substring(0, 40));
      el.setAttribute(ATTR_TRANSLATED, "skip");
      return;
    }

    // Mark as processing to prevent duplicate requests
    el.setAttribute(ATTR_TRANSLATED, "pending");
    console.log("[X-Translate] Translating:", text.substring(0, 40));

    try {
      const response = await safeSendMessage({
        type: "translate",
        text: text,
        libreUrl: libreUrl,
        targetLang: targetLang,
        engine: engine,
      });

      if (response && response.text && !response.error) {
        el.innerText = response.text;
        el.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
        el.setAttribute(ATTR_TRANSLATED, "true");
        el.title = text; // store original as tooltip
        translateCount++;
        chrome.storage.local.set({ translateCount });
        console.log("[X-Translate] Done:", response.text.substring(0, 40));
      } else {
        console.warn("[X-Translate] Failed:", response?.error || "no response");
        el.removeAttribute(ATTR_TRANSLATED);
        // Schedule retry
        setTimeout(() => translateElement(el), RETRY_DELAY_MS);
      }
    } catch (err) {
      console.warn("[X-Translate] Request error:", err.message);
      el.removeAttribute(ATTR_TRANSLATED);
      setTimeout(() => translateElement(el), RETRY_DELAY_MS);
    }
  }

  // --- 画像OCR翻訳機能 ---

  function isStatusPage() {
    return /\/status\/\d+/.test(location.pathname);
  }

  // OCR sandbox iframe communication
  let ocrIframe = null;
  let ocrReady = false;
  let ocrRequestId = 0;
  const ocrCallbacks = {};

  function ensureOCRIframe() {
    if (ocrIframe) return;
    ocrIframe = document.createElement("iframe");
    ocrIframe.src = chrome.runtime.getURL("ocr-sandbox.html");
    ocrIframe.style.cssText = "display:none;width:0;height:0;border:none;";
    document.body.appendChild(ocrIframe);

    window.addEventListener("message", (event) => {
      if (event.data?.type === "ocr-ready") {
        ocrReady = true;
        console.log("[X-Translate] OCR sandbox ready");
      }
      if (event.data?.type === "ocr-result" && ocrCallbacks[event.data.id]) {
        const cb = ocrCallbacks[event.data.id];
        delete ocrCallbacks[event.data.id];
        if (event.data.error) {
          cb.reject(new Error(event.data.error));
        } else {
          cb.resolve(event.data.text);
        }
      }
    });
  }

  async function ocrRecognize(imageSrc) {
    ensureOCRIframe();
    // Wait for iframe to be ready
    for (let i = 0; i < 300 && !ocrReady; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!ocrReady) throw new Error("OCR sandbox timeout");

    const id = ++ocrRequestId;
    return new Promise((resolve, reject) => {
      ocrCallbacks[id] = { resolve, reject };
      ocrIframe.contentWindow.postMessage(
        { type: "ocr-request", id, imageSrc },
        "*"
      );
    });
  }

  async function processImageOCR(imgEl) {
    if (imgEl.getAttribute(ATTR_OCR_TRANSLATED)) return;
    imgEl.setAttribute(ATTR_OCR_TRANSLATED, "pending");

    try {
      const text = await ocrRecognize(imgEl.src);

      if (!text || isTargetLang(text)) {
        imgEl.setAttribute(ATTR_OCR_TRANSLATED, "skip");
        console.log("[X-Translate] OCR skip (empty or Japanese)");
        return;
      }

      console.log("[X-Translate] OCR text:", text.substring(0, 60));

      const response = await safeSendMessage({
        type: "translate",
        text: text,
        libreUrl: libreUrl,
        targetLang: targetLang,
        engine: engine,
      });

      if (response?.text && !response.error) {
        showOverlay(imgEl, response.text);
        imgEl.setAttribute(ATTR_OCR_TRANSLATED, "true");
        console.log("[X-Translate] OCR translated:", response.text.substring(0, 60));
      } else {
        console.warn("[X-Translate] OCR translate failed:", response?.error);
        imgEl.removeAttribute(ATTR_OCR_TRANSLATED);
      }
    } catch (err) {
      console.warn("[X-Translate] OCR error:", err.message);
      imgEl.removeAttribute(ATTR_OCR_TRANSLATED);
    }
  }

  function showOverlay(imgEl, translatedText) {
    // Find the tweet article as a stable anchor point
    const article = imgEl.closest('article[data-testid="tweet"]');
    const photoDiv = imgEl.closest('div[data-testid="tweetPhoto"]');
    const target = photoDiv || imgEl.parentElement;

    const overlay = document.createElement("div");
    overlay.setAttribute("data-ocr-overlay", "true");
    overlay.textContent = translatedText;
    overlay.style.cssText = `
      background: #1a1a2e !important;
      color: #e0e0e0 !important;
      padding: 10px 14px !important;
      font-size: 14px !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      white-space: pre-wrap !important;
      line-height: 1.5 !important;
      border-left: 3px solid #4a9eff !important;
      margin: 8px 0 !important;
      border-radius: 4px !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      position: relative !important;
      z-index: 9999 !important;
    `;

    if (article) {
      // Append at the end of the article
      article.appendChild(overlay);
      console.log("[X-Translate] Overlay appended to article");
    } else {
      // Fallback: insert after the image container
      target.parentElement.insertBefore(overlay, target.nextSibling);
      console.log("[X-Translate] Overlay inserted after target");
    }
  }

  // --- メイン処理 ---

  function processAllTweets() {
    if (!enabled) return;
    const tweets = document.querySelectorAll(TWEET_SELECTOR);
    console.log("[X-Translate] Found tweets:", tweets.length);
    tweets.forEach((el) => translateElement(el));

    // 画像OCR（個別ツイートページのみ）
    if (isStatusPage()) {
      const images = document.querySelectorAll(IMAGE_SELECTOR);
      images.forEach((img) => processImageOCR(img));
    }
  }

  // Debounce utility
  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  const debouncedProcess = debounce(processAllTweets, DEBOUNCE_MS);

  // Initial processing (with delay to wait for React render)
  setTimeout(processAllTweets, 1000);

  // Observe DOM for new tweets (infinite scroll, navigation)
  const observer = new MutationObserver(() => {
    debouncedProcess();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
