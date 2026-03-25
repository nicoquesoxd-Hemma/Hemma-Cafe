import React, { useState } from "react";
import SafeEmoji from "./SafeEmoji";
import { isEmojiSupported } from "../utils/emojiSupport";
import ExcelJS from "exceljs/dist/exceljs.min.js";
import { saveAs } from "file-saver";
import { useApp } from "../context/AppProvider";

const EMOJIS = ["💵", "💳", "⚡", "📱", "🏦", "💰", "🪙", "🎁", "🔷", "💎"];

const Section = ({ id, color, icon, title, children, isOpen, onToggle }) => (
    <div className="card" style={{ borderLeft: `5px solid ${color}`, padding: "1rem 1.5rem" }}>
        <div
            onClick={() => onToggle(id)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.5rem" }}>{icon}</span>
                <h2 style={{ color, margin: 0, fontSize: "1.2rem" }}>{title}</h2>
            </div>
            <span style={{
                color,
                transition: "transform 0.3s",
                transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)"
            }}>▼</span>
        </div>
        <div className={`collapsible-wrapper ${isOpen ? "open" : ""}`}>
            <div className="collapsible-content">
                {children}
            </div>
        </div>
    </div>
);

function Ajustes({
    customers,
    onAddCustomer,
    onDeleteCustomer,
    vendedores,
    onAddVendedor,
    onDeleteVendedor,
    paymentMethods,
    onAddPaymentMethod,
    onDeletePaymentMethod,
    onResetAllData,
    onResetPerformanceData,
    onAddDemoProducts,
    splitPaymentEnabled,
    onToggleSplitPayment,
}) {
    const { showToast, showConfirm, theme, updateTheme, resetTheme } = useApp();

    const [newCustomerName, setNewCustomerName] = useState("");
    const [newCustomerPriceType, setNewCustomerPriceType] = useState("special");
    const [newVendedorName, setNewVendedorName] = useState("");
    const [newPMName, setNewPMName] = useState("");
    const [newPMEmoji, setNewPMEmoji] = useState("💵");

    const [expandedSections, setExpandedSections] = useState({
        customers: false,
        vendedores: false,
        paymentMethods: true,
        maintenance: false,
        appearance: false,
        templates: false,
        update: false,
    });
    const toggle = (s) => setExpandedSections(prev => ({ ...prev, [s]: !prev[s] }));

    const handleAddCustomer = (e) => {
        e.preventDefault();
        if (!newCustomerName) return;
        onAddCustomer(newCustomerName, newCustomerPriceType);
        setNewCustomerName("");
        setNewCustomerPriceType("special");
        showToast("Cliente agregado", "success");
    };

    const handleAddVendedor = (e) => {
        e.preventDefault();
        if (!newVendedorName) return;
        onAddVendedor(newVendedorName);
        setNewVendedorName("");
        showToast("Vendedor agregado", "success");
    };

    const handleAddPM = (e) => {
        e.preventDefault();
        const name = newPMName.trim();
        if (!name) return;
        
        const normalized = name.toLowerCase();
        if (paymentMethods.some(pm => pm.name.toLowerCase().trim() === normalized)) {
            showToast("Este método de pago ya existe", "error");
            return;
        }

        onAddPaymentMethod({ name, emoji: newPMEmoji });
        setNewPMName("");
        setNewPMEmoji("💵");
        showToast("Método de pago agregado", "success");
    };

    const [updateStatus, setUpdateStatus] = useState("idle"); // idle, checking, available, not-available, downloading, downloaded, error
    const [updateVersion, setUpdateVersion] = useState("");
    const [downloadProgress, setDownloadProgress] = useState(0);

    React.useEffect(() => {
        if (window.electron) {
            window.electron.onUpdateStatus((status, info) => {
                setUpdateStatus(status);
                if (info) setUpdateVersion(info);
                if (status === 'downloaded') showToast("Actualización descargada", "success");
                if (status === 'error') showToast(`Error: ${info}`, "error");
            });
            window.electron.onUpdateProgress((percent) => {
                setUpdateStatus("downloading");
                setDownloadProgress(percent);
            });
        }
    }, []);

    const handleCheckUpdates = () => {
        if (window.electron) {
            setUpdateStatus("checking");
            window.electron.checkForUpdates();
        }
    };

    const handleDownloadUpdate = () => {
        if (window.electron) {
            window.electron.startDownload();
        }
    };

    const handleInstallUpdate = () => {
        if (window.electron) {
            window.electron.quitAndInstall();
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "700px", margin: "0 auto" }}>
            <h2 style={{ color: "var(--color-primary)", margin: 0 }}><SafeEmoji emoji="⚙️" /> Ajustes</h2>

            {/* Métodos de Pago */}
            <Section id="paymentMethods" color="#0097a7" icon={<SafeEmoji emoji="💳" />} title="Métodos de Pago" isOpen={expandedSections.paymentMethods} onToggle={toggle}>
                <form onSubmit={handleAddPM} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", marginTop: "1rem", flexWrap: "wrap" }}>
                    <select
                        value={newPMEmoji}
                        onChange={(e) => setNewPMEmoji(e.target.value)}
                        style={{ padding: "0.6rem", borderRadius: "8px", border: "1px solid #ddd", fontSize: "1.2rem", minWidth: "60px" }}
                    >
                        {EMOJIS.map(em => {
                            const showEmoji = isEmojiSupported(em);
                            return <option key={em} value={em}>{showEmoji ? em : "M"} - {em === "💵" ? "Efectivo" : em === "💳" ? "Tarjeta" : "Otro"}</option>;
                        })}
                    </select>
                    <input
                        placeholder="Nombre del método (ej: Nequi)"
                        value={newPMName}
                        onChange={(e) => setNewPMName(e.target.value)}
                        style={{ flex: 1, padding: "0.6rem", borderRadius: "8px", border: "1px solid #ddd", minWidth: "160px" }}
                    />
                    <button type="submit" style={{ background: "#0097a7", color: "white", border: "none", padding: "0.6rem 1.2rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
                        Agregar
                    </button>
                </form>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {paymentMethods.length === 0 && (
                        <p style={{ color: "#999", fontSize: "0.9rem" }}>No hay métodos de pago configurados.</p>
                    )}
                    {paymentMethods.map(pm => (
                        <div key={pm.id} style={{ background: "#e0f7fa", padding: "0.4rem 0.9rem", borderRadius: "20px", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", color: "#006064" }}>
                            <span><SafeEmoji emoji={pm.emoji} /> {pm.name}</span>
                            <button
                                onClick={() => showConfirm(`¿Eliminar "${pm.name}"?`).then(c => { if (c) onDeletePaymentMethod(pm.id); })}
                                style={{ background: "none", border: "none", color: "#ff4d4d", cursor: "pointer", fontWeight: "bold", padding: "0" }}
                            >✕</button>
                        </div>
                    ))}
                </div>
                <p style={{ fontSize: "0.78rem", color: "#888", marginTop: "0.8rem", fontStyle: "italic" }}>
                    Estos métodos aparecerán en el selector de pago de la orden actual.
                </p>

                {/* Split payment toggle */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", padding: "0.8rem", background: splitPaymentEnabled ? "#e0f7fa" : "#f5f5f5", borderRadius: "10px", border: `1px solid ${splitPaymentEnabled ? "#0097a7" : "#ddd"}`, transition: "background 0.3s" }}>
                    <div>
                        <div style={{ fontWeight: "700", color: splitPaymentEnabled ? "#006064" : "#555", fontSize: "0.95rem" }}><SafeEmoji emoji="🔀" /> Pago dividido</div>
                        <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.2rem" }}>Permite usar varios métodos en un solo pedido</div>
                    </div>
                    {/* Toggle switch */}
                    <label style={{ position: "relative", display: "inline-block", width: "46px", height: "26px", cursor: "pointer", flexShrink: 0 }}>
                        <input
                            type="checkbox"
                            checked={!!splitPaymentEnabled}
                            onChange={(e) => onToggleSplitPayment(e.target.checked)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                            background: splitPaymentEnabled ? "#0097a7" : "#ccc",
                            borderRadius: "26px",
                            transition: "background 0.3s"
                        }} />
                        <span style={{
                            position: "absolute",
                            height: "20px", width: "20px",
                            left: splitPaymentEnabled ? "23px" : "3px",
                            bottom: "3px",
                            background: "white",
                            borderRadius: "50%",
                            transition: "left 0.3s",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
                        }} />
                    </label>
                </div>
            </Section>

            {/* Clientes */}
            <Section id="customers" color="#d81b60" icon={<SafeEmoji emoji="👥" />} title="Clientes" isOpen={expandedSections.customers} onToggle={toggle}>
                <form onSubmit={handleAddCustomer} style={{ display: "flex", flexDirection: "column", gap: "0.7rem", marginBottom: "1rem", marginTop: "1rem" }}>
                    <input
                        placeholder="Nombre de nuevo cliente"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        style={{ flex: 1, padding: "0.6rem", borderRadius: "8px", border: "1px solid #ddd" }}
                    />
                    {/* Price type selector */}
                    <div style={{ display: "flex", gap: "0.8rem", padding: "0.6rem 0.8rem", background: "#fce4ec", borderRadius: "8px", alignItems: "center" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: "700", color: "#880e4f", flexShrink: 0 }}>Tipo de precio:</span>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer", fontSize: "0.85rem", fontWeight: newCustomerPriceType === "special" ? "700" : "400" }}>
                            <input type="radio" name="priceType" value="special" checked={newCustomerPriceType === "special"} onChange={() => setNewCustomerPriceType("special")} />
                            <SafeEmoji emoji="⭐" /> Especial
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer", fontSize: "0.85rem", fontWeight: newCustomerPriceType === "wholesale" ? "700" : "400" }}>
                            <input type="radio" name="priceType" value="wholesale" checked={newCustomerPriceType === "wholesale"} onChange={() => setNewCustomerPriceType("wholesale")} />
                            <SafeEmoji emoji="🏦" /> Mayorista
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer", fontSize: "0.85rem", fontWeight: newCustomerPriceType === "general" ? "700" : "400" }}>
                            <input type="radio" name="priceType" value="general" checked={newCustomerPriceType === "general"} onChange={() => setNewCustomerPriceType("general")} />
                            <SafeEmoji emoji="👤" /> General
                        </label>
                    </div>
                    <button type="submit" style={{ background: "#d81b60", color: "white", border: "none", padding: "0.6rem 1.2rem", borderRadius: "8px", fontWeight: "bold" }}>Agregar</button>
                </form>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {customers.map(c => (
                        <div key={c.id} style={{ background: "#f0f0f0", padding: "0.4rem 0.8rem", borderRadius: "20px", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
                            <span>{c.name}</span>
                            {c.priceType === "wholesale" ? (
                                <span style={{ background: "#ede7f6", color: "#4527a0", borderRadius: "10px", padding: "0.1rem 0.5rem", fontSize: "0.72rem", fontWeight: "700" }}><SafeEmoji emoji="🏦" /> Mayorista</span>
                            ) : c.priceType === "general" ? (
                                <span style={{ background: "#e0e0e0", color: "#616161", borderRadius: "10px", padding: "0.1rem 0.5rem", fontSize: "0.72rem", fontWeight: "700" }}><SafeEmoji emoji="👤" /> General</span>
                            ) : (
                                <span style={{ background: "#fce4ec", color: "#880e4f", borderRadius: "10px", padding: "0.1rem 0.5rem", fontSize: "0.72rem", fontWeight: "700" }}><SafeEmoji emoji="⭐" /> Especial</span>
                            )}
                            <button
                                onClick={() => onDeleteCustomer(c.id)}
                                style={{ background: "none", border: "none", color: "#ff4d4d", cursor: "pointer", fontWeight: "bold", padding: "0" }}
                            >✕</button>
                        </div>
                    ))}
                </div>
            </Section>

            {/* Vendedores */}
            <Section id="vendedores" color="#6a1b9a" icon={<SafeEmoji emoji="👔" />} title="Vendedores" isOpen={expandedSections.vendedores} onToggle={toggle}>
                <form onSubmit={handleAddVendedor} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", marginTop: "1rem" }}>
                    <input
                        placeholder="Nombre de nuevo vendedor"
                        value={newVendedorName}
                        onChange={(e) => setNewVendedorName(e.target.value)}
                        style={{ flex: 1, padding: "0.6rem", borderRadius: "8px", border: "1px solid #ddd" }}
                    />
                    <button type="submit" style={{ background: "#6a1b9a", color: "white", border: "none", padding: "0.6rem 1.2rem", borderRadius: "8px", fontWeight: "bold" }}>Agregar</button>
                </form>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {vendedores.map(v => (
                        <div key={v.id} style={{ background: "#f0f0f0", padding: "0.4rem 0.8rem", borderRadius: "20px", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
                            <span>{v.name}</span>
                            <button
                                onClick={() => onDeleteVendedor(v.id)}
                                style={{ background: "none", border: "none", color: "#ff4d4d", cursor: "pointer", fontWeight: "bold", padding: "0" }}
                            >✕</button>
                        </div>
                    ))}
                </div>
            </Section>

            {/* Apariencia */}
            <Section id="appearance" color="#2196f3" icon={<SafeEmoji emoji="🎨" />} title="Apariencia" isOpen={expandedSections.appearance} onToggle={toggle}>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem", marginTop: "1rem" }}>
                    {[
                        { label: "Color Principal:", key: "primary", default: "#b6d82c" },
                        { label: "Color de Fondo:", key: "bg", default: "#f5f5dc" },
                        { label: "Color de Texto (Módulos):", key: "text", default: "#333333" },
                        { label: "Color del Encabezado (Fondo):", key: "headerBg", default: "#b6d82c", fallback: "primary" },
                        { label: "Color Letra del Encabezado:", key: "headerText", default: "#ffffff" },
                        { label: "Color Letra de los Títulos:", key: "titleText", default: "#333333", fallback: "text" },
                        { label: "Color de los Productos (h6):", key: "products", default: "#333333", fallback: "text" },
                    ].map(({ label, key, default: def, fallback }) => (
                        <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <label style={{ fontWeight: "bold" }}>{label}</label>
                            <input
                                type="color"
                                value={theme?.[key] || (fallback ? theme?.[fallback] : null) || def}
                                onChange={(e) => updateTheme({ ...theme, [key]: e.target.value })}
                                style={{ width: "50px", height: "40px", cursor: "pointer", border: "none" }}
                            />
                        </div>
                    ))}
                    <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "0.2rem 0" }} />
                    {[
                        { label: "Color Alerta (Éxito):", key: "alertSuccess", default: "#2e7d32" },
                        { label: "Color Alerta (Error):", key: "alertError", default: "#c62828" },
                        { label: "Color Alerta (Advertencia):", key: "alertWarning", default: "#e65100" },
                        { label: "Color Alerta (Información):", key: "alertInfo", default: "#1565c0" },
                    ].map(({ label, key, default: def }) => (
                        <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <label style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#666" }}>{label}</label>
                            <input
                                type="color"
                                value={theme?.[key] || def}
                                onChange={(e) => updateTheme({ ...theme, [key]: e.target.value })}
                                style={{ width: "40px", height: "30px", cursor: "pointer", border: "none" }}
                            />
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => showConfirm("¿Restaurar colores originales de Hemma?").then(c => { if (c) resetTheme(); })}
                    style={{ width: "100%", padding: "0.8rem", background: "#f5f5f5", color: "#333", border: "1px solid #ccc", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
                >
                    Restaurar Colores por Defecto
                </button>
            </Section>

            {/* Plantillas */}
            <Section id="templates" color="#2e7d32" icon={<SafeEmoji emoji="📄" />} title="Plantillas de Importación" isOpen={expandedSections.templates} onToggle={toggle}>
                <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1.2rem", marginTop: "1rem" }}>
                    Descarga esta plantilla para organizar tus productos y subirlos masivamente desde la pestaña de Inventario.
                </p>
                <button
                    onClick={async () => {
                        try {
                            const workbook = new ExcelJS.Workbook();
                            const sheet = workbook.addWorksheet("Productos");

                            sheet.columns = [
                                { header: "Nombre", key: "Nombre", width: 25 },
                                { header: "Categoría", key: "Categoría", width: 20 },
                                { header: "Precio", key: "Precio", width: 15 },
                                { header: "Cantidad", key: "Cantidad", width: 10 },
                                { header: "Precio Especial", key: "Precio Especial", width: 15 },
                                { header: "Precio Mayorista", key: "Precio Mayorista", width: 15 }
                            ];

                            sheet.addRow({
                                "Nombre": "Producto Ejemplo",
                                "Categoría": "General",
                                "Precio": 5000,
                                "Cantidad": 10,
                                "Precio Especial": 4500,
                                "Precio Mayorista": 4000
                            });

                            // Style header
                            const headerRow = sheet.getRow(1);
                            headerRow.font = { bold: true };

                            const buffer = await workbook.xlsx.writeBuffer();
                            saveAs(new Blob([buffer]), "Plantilla_Productos_Hemma.xlsx");
                            showToast("Plantilla descargada", "success");
                        } catch (err) {
                            console.error(err);
                            showToast("Error al generar la plantilla", "error");
                        }
                    }}
                    style={{
                        width: "100%",
                        padding: "0.8rem",
                        background: "#2e7d32",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem"
                    }}
                >
                    <SafeEmoji emoji="📥" /> Descargar Plantilla XLSX
                </button>
                <p style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.8rem" }}>
                    * El sistema creará las categorías automáticamente si no existen.
                </p>
            </Section>

            {/* Mantenimiento */}
            <Section id="maintenance" color="#6c757d" icon={<SafeEmoji emoji="⚙️" />} title="Mantenimiento" isOpen={expandedSections.maintenance} onToggle={toggle}>
                <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1.5rem", marginTop: "1rem" }}>
                    Eliminar permanentemente el historial de ventas o de rendimiento de la nube. Útil para cerrar el mes o reiniciar registros.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                    <button
                        onClick={() => showConfirm("¿ESTÁS SEGURO? Esta acción eliminará todo el historial de ventas y no se puede deshacer.").then(c => { if (c) onResetAllData(); })}
                        style={{ width: "100%", padding: "0.8rem", background: "#ff4444", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
                    >
                        <SafeEmoji emoji="🗑️" /> Borrar Historial de Ventas
                    </button>
                    <button
                        onClick={() => showConfirm("¿ESTÁS SEGURO? Esta acción eliminará todo el historial de rendimiento y no se puede deshacer.").then(c => { if (c) onResetPerformanceData(); })}
                        style={{ width: "100%", padding: "0.8rem", background: "#c0392b", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
                    >
                        <SafeEmoji emoji="📊" /> Borrar Historial de Rendimiento
                    </button>

                    <button
                        onClick={() => showConfirm("Esto agregará 5 productos de prueba al catálogo. ¿Continuar?").then(c => { if (c) onAddDemoProducts(); })}
                        style={{
                            width: "100%",
                            padding: "0.8rem",
                            background: "#4caf50",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: "bold",
                            cursor: "pointer"
                        }}
                    >
                        <SafeEmoji emoji="🚀" /> Crear Productos de Prueba
                    </button>
                </div>
            </Section>

            {/* Actualización de Software */}
            <Section id="update" color="#673ab7" icon={<SafeEmoji emoji="🆙" />} title="Actualización de Software" isOpen={expandedSections.update} onToggle={toggle}>
                <div style={{ marginTop: "1rem", padding: "1rem", background: "#f3e5f5", borderRadius: "10px", border: "1px solid #d1c4e9" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <div>
                            <div style={{ fontWeight: "700", color: "#4527a0", fontSize: "1rem" }}>Estado del Sistema</div>
                            <div style={{ fontSize: "0.85rem", color: "#666" }}>Versión actual: 1.0.7</div>
                        </div>
                        <button
                            onClick={handleCheckUpdates}
                            disabled={updateStatus === "checking" || updateStatus === "downloading"}
                            style={{ background: "#673ab7", color: "white", border: "none", padding: "0.6rem 1rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", opacity: (updateStatus === "checking" || updateStatus === "downloading") ? 0.6 : 1 }}
                        >
                            {updateStatus === "checking" ? "Buscando..." : "Buscar Actualizaciones"}
                        </button>
                    </div>

                    {updateStatus === "available" && (
                        <div style={{ textAlign: "center", padding: "1rem", borderTop: "1px solid #d1c4e9" }}>
                            <p style={{ fontWeight: "bold", color: "#311b92", marginBottom: "0.8rem" }}>¡Nueva versión disponible: {updateVersion}!</p>
                            <button
                                onClick={handleDownloadUpdate}
                                style={{ background: "#2e7d32", color: "white", border: "none", padding: "0.7rem 1.5rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
                            >
                                Descargar ahora
                            </button>
                        </div>
                    )}

                    {updateStatus === "downloading" && (
                        <div style={{ padding: "1rem", borderTop: "1px solid #d1c4e9" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.5rem", fontWeight: "bold" }}>
                                <span>Descargando actualización...</span>
                                <span>{Math.round(downloadProgress)}%</span>
                            </div>
                            <div style={{ width: "100%", height: "10px", background: "#e1bee7", borderRadius: "5px", overflow: "hidden" }}>
                                <div style={{ width: `${downloadProgress}%`, height: "100%", background: "#673ab7", transition: "width 0.3s" }} />
                            </div>
                        </div>
                    )}

                    {updateStatus === "downloaded" && (
                        <div style={{ textAlign: "center", padding: "1rem", borderTop: "1px solid #d1c4e9", background: "#e8f5e9", borderRadius: "8px" }}>
                            <p style={{ fontWeight: "bold", color: "#1b5e20", marginBottom: "0.8rem" }}>Actualización lista para instalar.</p>
                            <button
                                onClick={handleInstallUpdate}
                                style={{ background: "#1b5e20", color: "white", border: "none", padding: "0.7rem 1.5rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
                            >
                                Reiniciar e Instalar
                            </button>
                        </div>
                    )}

                    {updateStatus === "not-available" && (
                        <p style={{ fontSize: "0.85rem", color: "#2e7d32", textAlign: "center", marginTop: "1rem", fontWeight: "bold" }}>Tienes la última versión instalada.</p>
                    )}

                    {updateStatus === "error" && (
                        <p style={{ fontSize: "0.85rem", color: "#c62828", textAlign: "center", marginTop: "1rem", fontWeight: "bold" }}>No se pudo conectar con el servidor de actualizaciones.</p>
                    )}
                </div>
            </Section>
        </div>
    );
}

export default Ajustes;
