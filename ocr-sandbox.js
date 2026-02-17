(() => {
  let worker = null;
  let initializing = false;

  async function getWorker() {
    if (worker) return worker;
    if (initializing) {
      while (initializing) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return worker;
    }
    initializing = true;
    try {
      worker = await Tesseract.createWorker(["eng", "chi_sim", "kor"], undefined, {
        workerPath: "worker.min.js",
        workerBlobURL: false,
        corePath: "./",
      });
      console.log("[OCR Sandbox] Worker initialized");
      return worker;
    } finally {
      initializing = false;
    }
  }

  window.addEventListener("message", async (event) => {
    if (event.data?.type !== "ocr-request") return;

    const { id, imageSrc } = event.data;
    try {
      const w = await getWorker();
      const { data: { text } } = await w.recognize(imageSrc);
      event.source.postMessage(
        { type: "ocr-result", id, text: text.trim() },
        event.origin
      );
    } catch (err) {
      event.source.postMessage(
        { type: "ocr-result", id, error: err.message },
        event.origin
      );
    }
  });

  // Signal ready
  if (window.parent !== window) {
    window.parent.postMessage({ type: "ocr-ready" }, "*");
  }
})();
