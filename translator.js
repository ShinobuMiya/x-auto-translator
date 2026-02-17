const DEFAULT_LIBRE_URL = "http://localhost:5000/translate";
const MAX_RETRIES = 3;

async function translateWithGoogle(text, targetLang) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", targetLang || "ja");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Google Translate error: ${res.status}`);
  }
  const data = await res.json();
  if (!data || !data[0] || !Array.isArray(data[0])) {
    throw new Error("Google Translate: unexpected response format");
  }
  // Response may contain null entries, filter them out
  return data[0]
    .filter((seg) => seg && seg[0])
    .map((seg) => seg[0])
    .join("");
}

async function translateWithLibre(text, libreUrl, targetLang) {
  const url = libreUrl || DEFAULT_LIBRE_URL;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      source: "auto",
      target: targetLang || "ja",
    }),
  });
  if (!res.ok) {
    throw new Error(`LibreTranslate error: ${res.status}`);
  }
  const data = await res.json();
  return data.translatedText;
}

async function translate(text, libreUrl, targetLang, engine) {
  engine = engine || "google";
  let lastError;

  const tryGoogle = async () => {
    const result = await translateWithGoogle(text, targetLang);
    console.log("[Translator] Google OK:", text.substring(0, 30), "->", result.substring(0, 30));
    return { text: result, engine: "google" };
  };

  const tryLibre = async () => {
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const result = await translateWithLibre(text, libreUrl, targetLang);
        console.log("[Translator] Libre OK:", text.substring(0, 30), "->", result.substring(0, 30));
        return { text: result, engine: "libre" };
      } catch (e) {
        lastError = e;
        console.warn(`[Translator] Libre attempt ${i + 1} failed:`, e.message);
      }
    }
    return null;
  };

  if (engine === "google") {
    return tryGoogle();
  }

  if (engine === "libre") {
    const result = await tryLibre();
    if (result) return result;
    throw lastError;
  }

  // "google+libre": Google first, LibreTranslate fallback
  try {
    return await tryGoogle();
  } catch (e) {
    lastError = e;
    console.warn("[Translator] Google failed:", e.message);
  }
  const result = await tryLibre();
  if (result) return result;
  throw lastError;
}
