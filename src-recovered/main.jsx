import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { AppProvider } from "./context/AppProvider";
import "./index.css"; // The CSS we formatted earlier

// Registrar Service Worker para PWA (uso offline)
const updateSW = registerSW({
    onNeedRefresh() {
        if (confirm("Hay una nueva versión de la app disponible. ¿Deseas recargar?")) {
            updateSW();
        }
    },
    onOfflineReady() {
        console.log("App lista para funcionar offline");
    },
});

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <AppProvider>
            <App />
        </AppProvider>
    </React.StrictMode>
);
