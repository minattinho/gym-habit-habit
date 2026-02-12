import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({
      onNeedRefresh() {
        if (confirm("Nova versão disponível! Deseja atualizar?")) {
          window.location.reload();
        }
      },
      onOfflineReady() {
        console.log("App pronto para uso offline!");
      },
    });
  });
}
