import React, { useState, useMemo } from "react";
import SafeEmoji from "./SafeEmoji";
import DatePicker, { registerLocale } from "react-datepicker";
import es from "date-fns/locale/es";
import "react-datepicker/dist/react-datepicker.css";
import ExcelJS from "exceljs/dist/exceljs.min.js";
import { saveAs } from "file-saver";
import { useApp } from "../context/AppProvider";

registerLocale("es", es);

const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

function DailyPerformance({ transactions, logs, onSave, onViewDetails, onDeleteLog, paymentMethods }) {
    const { showConfirm, showToast } = useApp();
    const [realAmounts, setRealAmounts] = useState({});
    const [notes, setNotes] = useState("");
    const [diffMethod, setDiffMethod] = useState("Efectivo"); // Se mantiene para compatibilidad o nota principal
    const [sortKey, setSortKey] = useState("date");
    const [sortDirection, setSortDirection] = useState("desc");
    const [dateRange, setDateRange] = useState([null, null]);

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };

    const sortedColumnStyle = (key) => ({
        cursor: "pointer",
        userSelect: "none",
        padding: "1rem",
        background: sortKey === key ? "rgba(var(--color-primary-rgb), 0.1)" : "transparent",
    });

    const todayStats = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find the most recent closure for today
        const lastTodayLog = [...logs]
            .filter(log => {
                const d = new Date(log.date);
                d.setHours(0, 0, 0, 0);
                return d.getTime() === today.getTime();
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

        const lastClosureTime = lastTodayLog ? new Date(lastTodayLog.date) : today;

        const todayTrans = transactions.filter(t => {
            const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
            // If there's a closure today, only show transactions AFTER that closure
            // If no closure today, show all transactions for today (startTime = today 00:00)
            return d > lastClosureTime;
        });

        const totalExpected = todayTrans.reduce((acc, t) => acc + (t.total || 0), 0);
        const totalProducts = todayTrans.reduce((acc, t) => acc + (t.items || []).reduce((sum, i) => sum + (i.cartQuantity || 1), 0), 0);

        const paymentMethodTotals = {};
        todayTrans.forEach(t => {
            if (t.payments && Array.isArray(t.payments) && t.payments.length > 0) {
                t.payments.forEach(p => {
                    const method = p.method || "Desconocido";
                    paymentMethodTotals[method] = (paymentMethodTotals[method] || 0) + (p.amount || 0);
                });
            } else {
                const method = t.paymentMethod || "Desconocido";
                paymentMethodTotals[method] = (paymentMethodTotals[method] || 0) + (t.total || 0);
            }
        });

        return { totalExpected, totalProducts, paymentMethodTotals };
    }, [transactions, logs]);

    const activeMethods = useMemo(() => {
        const methodsFromPM = paymentMethods?.map(pm => pm.name) || [];
        const methodsFromTrans = Object.keys(todayStats.paymentMethodTotals);
        return Array.from(new Set([...methodsFromPM, ...methodsFromTrans])).filter(m => m !== "Desconocido");
    }, [paymentMethods, todayStats.paymentMethodTotals]);

    const totalReal = useMemo(() =>
        Object.values(realAmounts).reduce((acc, val) => acc + (parseFloat(val) || 0), 0)
        , [realAmounts]);

    const totalDifference = totalReal - todayStats.totalExpected;

    // Pre-llenar campos con el dinero esperado por defecto
    React.useEffect(() => {
        if (Object.keys(realAmounts).length === 0 && Object.keys(todayStats.paymentMethodTotals).length > 0) {
            const defaults = {};
            Object.entries(todayStats.paymentMethodTotals).forEach(([method, amount]) => {
                defaults[method] = amount.toString();
            });
            setRealAmounts(defaults);
        }
    }, [todayStats.paymentMethodTotals]);


    const handleSave = (e) => {
        e.preventDefault();

        const perMethodStats = {};
        activeMethods.forEach(method => {
            const expected = todayStats.paymentMethodTotals[method] || 0;
            const real = parseFloat(realAmounts[method]) || 0;
            perMethodStats[method] = {
                expected,
                real,
                diff: real - expected
            };
        });

        onSave({
            expectedTotal: todayStats.totalExpected,
            realTotal: totalReal,
            difference: totalDifference,
            diffMethod: totalDifference !== 0 ? diffMethod : null,
            productsSold: todayStats.totalProducts,
            paymentMethodTotals: todayStats.paymentMethodTotals,
            perMethodStats,
            notes: notes
        });
        setRealAmounts({});
        setNotes("");
        setDiffMethod("Efectivo");
    };

    const handleDownloadHistory = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Historial de Rendimiento");

            worksheet.columns = [
                { header: "Fecha", key: "date", width: 15 },
                { header: "Productos", key: "products", width: 10 },
                { header: "Esperado", key: "expected", width: 15 },
                { header: "Real", key: "real", width: 15 },
                { header: "Diferencia", key: "diff", width: 15 },
                { header: "Metodo Dif.", key: "diffMethod", width: 15 },
                { header: "Notas", key: "notes", width: 30 }
            ];

            logs.forEach(log => {
                worksheet.addRow({
                    date: new Date(log.date).toLocaleDateString(),
                    products: log.productsSold || 0,
                    expected: log.expectedTotal || 0,
                    real: log.realTotal || 0,
                    diff: log.difference || 0,
                    diffMethod: log.diffMethod || "-",
                    notes: log.notes || ""
                });
            });

            // Style headers
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE3F2FD' }
            };

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Historial_Rendimiento_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <div className="card" style={{ borderLeft: "5px solid var(--color-primary)" }}>
                <h2 style={{ color: "var(--color-primary)", marginBottom: "1.5rem" }}>Cierre de Caja Hoy</h2>
                <form onSubmit={handleSave} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
                    <div style={{ padding: "1.5rem", background: "#f8f9fa", borderRadius: "12px", textAlign: "center" }}>
                        <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.5rem" }}>Esperado en Sistema</div>
                        <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "var(--color-primary)" }}>
                            {formatCurrency(todayStats.totalExpected)}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#999", marginTop: "0.5rem" }}>
                            {todayStats.totalProducts} productos vendidos
                        </div>
                    </div>
                    <div style={{
                        padding: "1.5rem",
                        background: totalDifference === 0 ? "#f8f9fa" : totalDifference > 0 ? "#e8f5e9" : "#ffebee",
                        borderRadius: "12px",
                        textAlign: "center"
                    }}>
                        <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.5rem" }}>Diferencia Total</div>
                        <div style={{
                            fontSize: "1.8rem",
                            fontWeight: "bold",
                            color: totalDifference === 0 ? "#666" : totalDifference > 0 ? "#2e7d32" : "#c62828"
                        }}>
                            {formatCurrency(totalDifference)}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#999", marginTop: "0.5rem" }}>
                            {totalDifference === 0 ? "Cuadre perfecto" : totalDifference > 0 ? "Sobrante General" : "Faltante General"}
                        </div>
                    </div>

                    {/* Entrada Detallada por Método */}
                    <div style={{ gridColumn: "1 / -1", background: "white", padding: "1.5rem", borderRadius: "12px", border: "1px solid #eee" }}>
                        <h4 style={{ margin: "0 0 1.5rem 0", color: "#555" }}>Conteo de Dinero por Método</h4>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
                            {activeMethods.map(method => {
                                const pm = paymentMethods?.find(p => p.name === method);
                                const expected = todayStats.paymentMethodTotals[method] || 0;
                                const real = parseFloat(realAmounts[method]) || 0;
                                const diff = real - expected;

                                return (
                                    <div key={method} style={{
                                        padding: "1rem",
                                        borderRadius: "10px",
                                        border: "1px solid #f0f0f0",
                                        background: real > 0 ? "#fafafa" : "white"
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.8rem" }}>
                                            <SafeEmoji emoji={pm?.emoji || "❓"} />
                                            <strong style={{ fontSize: "1rem" }}>{method}</strong>
                                        </div>

                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#888" }}>
                                                <span>Esperado:</span>
                                                <span>{formatCurrency(expected)}</span>
                                            </div>

                                            <div>
                                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "600", color: "#666", marginBottom: "0.2rem" }}>Dinero Real:</label>
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    value={realAmounts[method] || ""}
                                                    onChange={(e) => setRealAmounts({ ...realAmounts, [method]: e.target.value })}
                                                    style={{
                                                        width: "100%",
                                                        padding: "0.6rem",
                                                        borderRadius: "6px",
                                                        border: "1px solid #ddd",
                                                        fontSize: "1rem"
                                                    }}
                                                />
                                            </div>

                                            {real > 0 && (
                                                <div style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    fontSize: "0.85rem",
                                                    fontWeight: "600",
                                                    color: diff === 0 ? "#666" : diff > 0 ? "#2e7d32" : "#c62828",
                                                    marginTop: "0.3rem",
                                                    padding: "0.4rem",
                                                    background: diff === 0 ? "#f5f5f5" : diff > 0 ? "#e8f5e9" : "#ffebee",
                                                    borderRadius: "4px"
                                                }}>
                                                    <span>Diferencia:</span>
                                                    <span>{formatCurrency(diff)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                            {totalDifference !== 0 && (
                                <div style={{ flex: 1, minWidth: "300px" }}>
                                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.5rem" }}>
                                        Nota Principal de la Diferencia
                                    </label>
                                    <select
                                        value={diffMethod}
                                        onChange={(e) => setDiffMethod(e.target.value)}
                                        style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: "1px solid #ddd", fontSize: "1rem" }}
                                    >
                                        <option value="Efectivo">Causado en: Efectivo</option>
                                        {activeMethods.filter(m => m !== "Efectivo").map(m => (
                                            <option key={m} value={m}>Causado en: {m}</option>
                                        ))}
                                        <option value="Varios">Causado por: Varios métodos</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div>
                            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.5rem" }}>Notas/Observaciones</label>
                            <textarea
                                placeholder="Escribe aquí novedades del día..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: "2px solid #ddd", minHeight: "80px", fontFamily: "inherit" }}
                            />
                        </div>
                        <button type="submit" className="primary" style={{ padding: "1rem", fontSize: "1rem", width: "100%" }}>
                            Guardar Cierre Diario
                        </button>
                    </div>
                </form>
            </div>

            <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                    <h2 style={{ margin: 0 }}>Historial de Rendimiento</h2>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                        <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#555" }}>Rango de Fecha:</label>
                        <DatePicker
                            selectsRange={true}
                            startDate={dateRange[0]}
                            endDate={dateRange[1]}
                            onChange={(update) => setDateRange(update)}
                            isClearable={true}
                            locale="es"
                            dateFormat="dd/MM/yyyy"
                            placeholderText="Filtrar por fecha"
                            className="custom-datepicker"
                            wrapperClassName="datepicker-wrapper"
                        />
                        <button
                            onClick={handleDownloadHistory}
                            style={{
                                background: "#2e7d32",
                                color: "white",
                                border: "none",
                                padding: "0.5rem 1rem",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                                fontWeight: "bold",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem"
                            }}
                        >
                            <SafeEmoji emoji="📥" /> Exportar Historial
                        </button>
                    </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                    {(() => {
                        const [startDate, endDate] = dateRange;
                        const filtered = logs.filter(log => {
                            if (!log.date) return true;
                            const d = new Date(log.date);
                            if (startDate) { const s = new Date(startDate); s.setHours(0, 0, 0, 0); if (d < s) return false; }
                            if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); if (d > e) return false; }
                            return true;
                        });
                        const sorted = [...filtered].sort((a, b) => {
                            let vA, vB;
                            switch (sortKey) {
                                case "date": vA = new Date(a.date).getTime(); vB = new Date(b.date).getTime(); break;
                                case "products": vA = a.productsSold || 0; vB = b.productsSold || 0; break;
                                case "expected": vA = a.expectedTotal || 0; vB = b.expectedTotal || 0; break;
                                case "real": vA = a.realTotal || 0; vB = b.realTotal || 0; break;
                                case "diff": vA = a.difference || 0; vB = b.difference || 0; break;
                                default: return 0;
                            }
                            if (vA < vB) return sortDirection === "asc" ? -1 : 1;
                            if (vA > vB) return sortDirection === "asc" ? 1 : -1;
                            return 0;
                        });
                        const arrow = (key) => sortKey === key ? (sortDirection === "asc" ? " ↑" : " ↓") : "";
                        return (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ textAlign: "left", color: "#666", borderBottom: "2px solid #eee" }}>
                                        <th style={sortedColumnStyle("date")} onClick={() => handleSort("date")}>Fecha{arrow("date")}</th>
                                        <th style={sortedColumnStyle("products")} onClick={() => handleSort("products")}>Prods.{arrow("products")}</th>
                                        <th style={sortedColumnStyle("expected")} onClick={() => handleSort("expected")}>Esperado{arrow("expected")}</th>
                                        <th style={sortedColumnStyle("real")} onClick={() => handleSort("real")}>Real{arrow("real")}</th>
                                        <th style={sortedColumnStyle("diff")} onClick={() => handleSort("diff")}>Dif.{arrow("diff")}</th>
                                        <th style={{ padding: "1rem" }}>Desglose</th>
                                        <th style={{ padding: "1rem" }}>Notas</th>
                                        <th style={{ padding: "1rem" }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((log) => (
                                        <tr key={log.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                                            <td style={{ padding: "1rem" }}>{new Date(log.date).toLocaleDateString()}</td>
                                            <td style={{ padding: "1rem" }}>{log.productsSold}</td>
                                            <td style={{ padding: "1rem" }}>{formatCurrency(log.expectedTotal)}</td>
                                            <td style={{ padding: "1rem" }}>{formatCurrency(log.realTotal)}</td>
                                            <td style={{ padding: "1rem", fontWeight: "600", color: log.difference >= 0 ? "#2e7d32" : "#c62828" }}>
                                                <div>{formatCurrency(log.difference)}</div>
                                                {log.difference !== 0 && log.diffMethod && (
                                                    <div style={{ fontSize: "0.7rem", fontWeight: "normal", opacity: 0.8 }}>
                                                        ({log.diffMethod})
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: "1rem", fontSize: "0.75rem", color: "#555" }}>
                                                {log.perMethodStats ? (
                                                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                                                        {Object.entries(log.perMethodStats).map(([method, stats]) => (
                                                            <span key={method} style={{
                                                                background: stats.diff === 0 ? "#eee" : stats.diff > 0 ? "#e8f5e9" : "#ffebee",
                                                                padding: "2px 6px",
                                                                borderRadius: "4px",
                                                                color: stats.diff === 0 ? "#666" : stats.diff > 0 ? "#2e7d32" : "#c62828",
                                                                border: stats.diff !== 0 ? "1px solid currentColor" : "none"
                                                            }}>
                                                                {method}: {formatCurrency(stats.real)}
                                                                {stats.diff !== 0 && ` (${stats.diff > 0 ? '+' : ''}${formatCurrency(stats.diff)})`}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : log.paymentMethodTotals ? (
                                                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                                                        {Object.entries(log.paymentMethodTotals).map(([method, total]) => (
                                                            <span key={method} style={{ background: "#eee", padding: "2px 6px", borderRadius: "4px" }}>
                                                                {method}: {formatCurrency(total)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : "-"}
                                            </td>
                                            <td style={{ padding: "1rem", fontSize: "0.85rem", color: "#666", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {log.notes || "-"}
                                            </td>
                                            <td style={{ padding: "1rem" }}>
                                                <button
                                                    onClick={() => onViewDetails(log.date)}
                                                    style={{ background: "#f0f0f0", border: "none", padding: "0.4rem 0.8rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", marginRight: "0.5rem" }}
                                                >
                                                    Ver Ventas
                                                </button>
                                                <button
                                                    className="secondary"
                                                    onClick={() => {
                                                        showConfirm("¿Estás seguro de que deseas eliminar este cierre de caja? Esta acción no se puede deshacer.").then(confirmed => {
                                                            if (confirmed) {
                                                                onDeleteLog(log.id);
                                                                showToast("Cierre eliminado", "success");
                                                            }
                                                        });
                                                    }}
                                                    style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", borderColor: "#ffcdd2", color: "#c62828" }}
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {sorted.length === 0 && (
                                        <tr>
                                            <td colSpan="8" style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
                                                {logs.length === 0 ? "No hay cierres registrados" : "No hay registros en ese rango de fechas"}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}

export default DailyPerformance;
