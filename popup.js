const toggle = document.getElementById("toggle");
const engineSelect = document.getElementById("engine");
const targetLangSelect = document.getElementById("targetLang");
const libreUrlInput = document.getElementById("libreUrl");
const libreUrlRow = document.getElementById("libreUrlRow");
const libreUrlBtnRow = document.getElementById("libreUrlBtnRow");
const saveBtn = document.getElementById("saveUrl");
const countEl = document.getElementById("count");
const statusEl = document.getElementById("status");

function updateLibreUrlVisibility() {
  const show = engineSelect.value !== "google";
  libreUrlRow.style.display = show ? "" : "none";
  libreUrlBtnRow.style.display = show ? "" : "none";
}

// Load saved settings
chrome.storage.local.get(["enabled", "engine", "targetLang", "libreUrl", "translateCount"], (data) => {
  toggle.checked = data.enabled !== undefined ? data.enabled : true;
  engineSelect.value = data.engine || "google";
  targetLangSelect.value = data.targetLang || "ja";
  libreUrlInput.value = data.libreUrl || "";
  countEl.textContent = data.translateCount || 0;
  updateLibreUrlVisibility();
});

// Toggle handler
toggle.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: toggle.checked });
  statusEl.textContent = toggle.checked ? "有効" : "無効";
});

// Engine handler
engineSelect.addEventListener("change", () => {
  chrome.storage.local.set({ engine: engineSelect.value });
  const label = engineSelect.options[engineSelect.selectedIndex].text;
  statusEl.textContent = `エンジン: ${label}`;
  setTimeout(() => (statusEl.textContent = ""), 2000);
  updateLibreUrlVisibility();
});

// Target language handler
targetLangSelect.addEventListener("change", () => {
  chrome.storage.local.set({ targetLang: targetLangSelect.value });
  const label = targetLangSelect.options[targetLangSelect.selectedIndex].text;
  statusEl.textContent = `翻訳先: ${label}`;
  setTimeout(() => (statusEl.textContent = ""), 2000);
});

// Save LibreTranslate URL
saveBtn.addEventListener("click", () => {
  chrome.storage.local.set({ libreUrl: libreUrlInput.value.trim() });
  statusEl.textContent = "URL を保存しました";
  setTimeout(() => (statusEl.textContent = ""), 2000);
});
