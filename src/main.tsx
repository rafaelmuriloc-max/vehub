import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker (skip in iframe/preview)
if ("serviceWorker" in navigator) {
  const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const isPreview = window.location.hostname.includes("lovableproject.com") || window.location.hostname.includes("id-preview--");
  if (!inIframe && !isPreview) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          // Force check for new sw.js on every page load
          reg.update().catch(() => {});
        })
        .catch(() => {});
    });
  }
}
