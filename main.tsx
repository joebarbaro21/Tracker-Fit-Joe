import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { registerSW } from "virtual:pwa-register";

registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new Event("pwa-update-available"));
  },
  onOfflineReady() {
    console.log("[PWA] ready for offline");
  },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
