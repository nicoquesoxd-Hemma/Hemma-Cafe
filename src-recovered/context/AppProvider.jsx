import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const AppContext = createContext();

export function useApp() {
    return useContext(AppContext);
}

export function AppProvider({ children }) {
    const [toast, setToast] = useState(null);
    const [confirm, setConfirm] = useState(null);

    const showToast = useCallback((message, type = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const closeToast = useCallback(() => setToast(null), []);

    const showConfirm = useCallback((message) => {
        return new Promise((resolve) => {
            setConfirm({ message, resolve });
        });
    }, []);

    const handleConfirm = (value) => {
        if (confirm) {
            confirm.resolve(value);
            setConfirm(null);
        }
    };



    const icons = {
        success: "✅",
        error: "❌",
        warning: "⚠️",
        info: "ℹ️",
    };

    useEffect(() => {
        if (!document.getElementById("toast-animations")) {
            const style = document.createElement("style");
            style.id = "toast-animations";
            style.textContent = `
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes dialogFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `;
            document.head.appendChild(style);
        }
    }, []);

    const defaultTheme = {
        primary: "#b6d82c",
        bg: "#f5f5dc",
        text: "#333333",
        headerBg: "#b6d82c",
        headerText: "#ffffff",
        titleText: "#333333",
        products: "#333333",
        alertSuccess: "#2e7d32",
        alertError: "#c62828",
        alertWarning: "#e65100",
        alertInfo: "#1565c0"
    };

    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem("pos_theme");
        return saved ? JSON.parse(saved) : defaultTheme;
    });

    const updateTheme = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem("pos_theme", JSON.stringify(newTheme));
    };

    const resetTheme = () => {
        setTheme(defaultTheme);
        localStorage.removeItem("pos_theme");
    };

    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty("--color-primary", theme.primary);
        // Using opacity or a simple trick for hover to not overcomplicate dynamic darkening
        root.style.setProperty("--color-primary-hover", theme.primary);
        root.style.setProperty("--color-bg", theme.bg);
        root.style.setProperty("--color-text", theme.text);
        root.style.setProperty("--color-header-bg", theme.headerBg || theme.primary);
        root.style.setProperty("--color-header-text", theme.headerText || "#ffffff");
        root.style.setProperty("--color-title-text", theme.titleText || theme.text);
        root.style.setProperty("--color-products", theme.products || theme.text);
    }, [theme]);

    return (
        <AppContext.Provider value={{ showToast, showConfirm, theme, updateTheme, resetTheme }}>
            {children}
            {toast && (
                <div
                    style={{
                        position: "fixed",
                        top: "1.5rem",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: theme[`alert${toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}`] || "#2e7d32",
                        color: "white",
                        padding: "1rem 2rem",
                        borderRadius: "12px",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                        zIndex: 9999,
                        fontSize: "1rem",
                        fontWeight: "bold",
                        animation: "toastSlideIn 0.3s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        maxWidth: "90vw",
                    }}
                >
                    <span>{icons[toast.type] || icons.success}</span>
                    <span>{toast.message}</span>
                    <button
                        onClick={closeToast}
                        style={{
                            background: "none",
                            border: "none",
                            color: "white",
                            cursor: "pointer",
                            fontSize: "1.2rem",
                            marginLeft: "1rem",
                        }}
                    >
                        ×
                    </button>
                </div>
            )}
            {confirm && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0,0,0,0.5)",
                        zIndex: 10000,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        animation: "dialogFadeIn 0.2s ease",
                    }}
                >
                    <div
                        style={{
                            background: "white",
                            padding: "2rem",
                            borderRadius: "16px",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                            maxWidth: "400px",
                            width: "90%",
                            textAlign: "center",
                        }}
                    >
                        <p style={{ fontSize: "1.1rem", marginBottom: "1.5rem", color: "#333" }}>
                            {confirm.message}
                        </p>
                        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                            <button
                                onClick={() => handleConfirm(false)}
                                style={{
                                    padding: "0.6rem 1.5rem",
                                    borderRadius: "8px",
                                    border: "1px solid #ccc",
                                    background: "#f5f5f5",
                                    cursor: "pointer",
                                    fontWeight: "600",
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleConfirm(true)}
                                style={{
                                    padding: "0.6rem 1.5rem",
                                    borderRadius: "8px",
                                    border: "none",
                                    background: "#e74c3c",
                                    color: "white",
                                    cursor: "pointer",
                                    fontWeight: "600",
                                }}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppContext.Provider>
    );
}
