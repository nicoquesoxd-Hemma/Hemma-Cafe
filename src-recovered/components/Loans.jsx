import React from "react";
import SafeEmoji from "./SafeEmoji";
import ExcelJS from "exceljs/dist/exceljs.min.js";
import { saveAs } from "file-saver";
import { useApp } from "../context/AppProvider";

const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) return "$ 0";
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

const extractDate = (loan) => {
    const dateValue = loan.date || loan.lastUpdated || loan.createdAt;
    if (!dateValue) return new Date();
    return dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
};

const formatDateLong = (loan) => {
    const d = extractDate(loan);
    return d.toLocaleDateString("es-CO", { day: '2-digit', month: 'long', year: 'numeric' });
};

const formatTime = (loan) => {
    const d = extractDate(loan);
    return d.toLocaleTimeString("es-CO", { hour: '2-digit', minute: '2-digit' });
};

function Loans({ loans, onLoanPayment, onRemoveLoanItem, paymentMethods, vendedores }) {
    const { showToast, showConfirm } = useApp();
    const [expandedCustomerId, setExpandedCustomerId] = React.useState(null);
    const [paymentItems, setPaymentItems] = React.useState({}); // { loanId_productId: quantity }
    const [payMethod, setPayMethod] = React.useState("Efectivo");
    const [selectedVendedor, setSelectedVendedor] = React.useState("");
    
    // --- Split Payment States ---
    const [splitEnabled, setSplitEnabled] = React.useState(false);
    const [splitPayments, setSplitPayments] = React.useState([
        { id: Date.now(), method: "Efectivo", amount: "" }
    ]);

    // --- Agrupación Multinivel ---
    const customersWithDebt = React.useMemo(() => {
        const groups = {};
        loans.forEach(loan => {
            const cid = loan.customerId || "unknown";
            if (!groups[cid]) {
                groups[cid] = {
                    id: cid,
                    name: loan.customerName || "Desconocido",
                    totalDebt: 0,
                    transactions: [],
                    lastActivity: null
                };
            }
            const transTotal = (loan.items || []).reduce((acc, item) => acc + (item.price * item.cartQuantity), 0);
            const loanDateObj = extractDate(loan);
            
            groups[cid].totalDebt += transTotal;
            groups[cid].transactions.push({
                ...loan,
                total: transTotal,
                dateObj: loanDateObj
            });

            if (!groups[cid].lastActivity || loanDateObj > groups[cid].lastActivity) {
                groups[cid].lastActivity = loanDateObj;
            }
        });

        Object.values(groups).forEach(g => g.transactions.sort((a, b) => b.dateObj - a.dateObj));
        return Object.values(groups).sort((a, b) => b.lastActivity - a.lastActivity);
    }, [loans]);

    const totalSelected = React.useMemo(() => {
        return Object.entries(paymentItems).reduce((sum, [key, qty]) => {
            const [loanId, productId] = key.split('_');
            const loan = loans.find(l => l.id === loanId);
            const item = loan?.items?.find(i => i.id === productId);
            return sum + ((item?.price || 0) * qty);
        }, 0);
    }, [paymentItems, loans]);

    // Split Payment Helpers
    const splitTotal = splitPayments.reduce((s, p) => s + (parseInt(p.amount) || 0), 0);
    const splitRemaining = totalSelected - splitTotal;

    const handleAddSplitRow = () => {
        setSplitPayments(prev => [...prev, { id: Date.now(), method: paymentMethods[0]?.name || "Efectivo", amount: "" }]);
    };

    const handleRemoveSplitRow = (id) => {
        setSplitPayments(prev => prev.filter(p => p.id !== id));
    };

    const handleSplitChange = (id, field, value) => {
        setSplitPayments(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const handleItemToggle = (loanId, productId, maxQty) => {
        const key = `${loanId}_${productId}`;
        setPaymentItems(prev => {
            const next = { ...prev };
            if (next[key]) delete next[key];
            else next[key] = maxQty;
            return next;
        });
    };

    const handleQtyChange = (loanId, productId, qty, maxQty) => {
        const key = `${loanId}_${productId}`;
        const val = parseInt(qty);
        if (isNaN(val) || val < 1) return;
        setPaymentItems(prev => ({ ...prev, [key]: Math.min(val, maxQty) }));
    };

    const handlePayTransaction = (loanId) => {
        const loan = loans.find(l => l.id === loanId);
        if (!loan) return;

        const selectedForThisLoan = (loan.items || [])
            .filter(item => paymentItems[`${loan.id}_${item.id}`])
            .map(item => ({
                ...item,
                cartQuantity: paymentItems[`${loan.id}_${item.id}`],
                subtotal: item.price * paymentItems[`${loan.id}_${item.id}`]
            }));

        if (selectedForThisLoan.length === 0) return;
        if (!selectedVendedor) {
            showToast("Selecciona un vendedor", "warning");
            return;
        }

        const currentTotal = selectedForThisLoan.reduce((acc, i) => acc + i.subtotal, 0);

        // Lógica de Pago (Único vs Dividido)
        let paymentToPass;
        if (splitEnabled) {
            const validPayments = splitPayments
                .filter(p => parseInt(p.amount) > 0)
                .map(p => ({ method: p.method, amount: parseInt(p.amount) }));
            
            if (validPayments.length === 0) {
                showToast("Ingresa montos válidos", "warning");
                return;
            }
            if (Math.abs(splitRemaining) > 0) {
                showToast(`Faltan ${formatCurrency(Math.abs(splitRemaining))} por cubrir`, "error");
                return;
            }
            paymentToPass = validPayments;
        } else {
            paymentToPass = payMethod;
        }

        onLoanPayment(loan.id, selectedForThisLoan, paymentToPass, selectedVendedor, currentTotal);
        
        // Limpiar selección de este préstamo
        setPaymentItems(prev => {
            const next = { ...prev };
            selectedForThisLoan.forEach(i => delete next[`${loan.id}_${i.id}`]);
            return next;
        });
    };

    const handleExportExcel = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Créditos Detallados");
            worksheet.columns = [
                { header: "Cliente", key: "cliente", width: 25 },
                { header: "Fecha", key: "fecha", width: 15 },
                { header: "Hora", key: "hora", width: 12 },
                { header: "Producto", key: "producto", width: 30 },
                { header: "Cantidad", key: "cantidad", width: 10 },
                { header: "Precio Unit.", key: "precio", width: 15 },
                { header: "Subtotal", key: "subtotal", width: 15 },
                { header: "Notas", key: "notas", width: 30 }
            ];
            loans.forEach(loan => {
                const dateObj = extractDate(loan);
                loan.items.forEach(item => {
                    worksheet.addRow({
                        cliente: loan.customerName,
                        fecha: dateObj.toLocaleDateString(),
                        hora: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        producto: item.name,
                        cantidad: item.cartQuantity,
                        precio: item.price,
                        subtotal: item.price * item.cartQuantity,
                        notas: loan.notes || ""
                    });
                });
            });
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB6D82C' } };
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Reporte_Creditos_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast("Excel exportado con éxito", "success");
        } catch (error) { showToast("Error al exportar Excel", "error"); }
    };

    return (
        <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h2 style={{ margin: 0, fontWeight: "800" }}>Créditos</h2>
                    <p style={{ color: "#888", fontSize: "0.8rem", margin: "2px 0 0 0" }}>Control de cuentas y abonos</p>
                </div>
                <button className="primary" onClick={handleExportExcel} style={{ fontSize: "0.85rem" }}>
                    <SafeEmoji emoji="📊" /> Exportar a Excel
                </button>
            </div>

            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                    <thead>
                        <tr style={{ textAlign: "left", color: "#999", fontSize: "0.75rem", textTransform: "uppercase" }}>
                            <th style={{ padding: "0 1rem" }}></th>
                            <th style={{ padding: "0 1rem" }}>Cliente</th>
                            <th style={{ padding: "0 1rem" }}>Deuda Total</th>
                            <th style={{ padding: "0 1rem" }}>Última Actividad</th>
                            <th style={{ padding: "0 1rem", textAlign: "right" }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customersWithDebt.map((cust) => {
                            const isExpanded = expandedCustomerId === cust.id;
                            return (
                                <React.Fragment key={cust.id}>
                                    <tr 
                                        onClick={() => setExpandedCustomerId(isExpanded ? null : cust.id)}
                                        style={{ 
                                            backgroundColor: isExpanded ? "#fff" : "#fafafa",
                                            boxShadow: isExpanded ? "0 4px 12px rgba(0,0,0,0.05)" : "none",
                                            cursor: "pointer",
                                            borderRadius: "8px",
                                            transition: "all 0.2s"
                                        }}
                                    >
                                        <td style={{ padding: "1rem", borderRadius: "8px 0 0 8px", width: "40px" }}>
                                            <span style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block", color: "var(--color-primary)", transition: "transform 0.2s" }}>▶</span>
                                        </td>
                                        <td style={{ padding: "1rem" }}>
                                            <div style={{ fontWeight: "700" }}>{cust.name}</div>
                                        </td>
                                        <td style={{ padding: "1rem" }}>
                                            <div style={{ color: "#c62828", fontWeight: "800" }}>{formatCurrency(cust.totalDebt)}</div>
                                        </td>
                                        <td style={{ padding: "1rem", fontSize: "0.85rem", color: "#666" }}>{formatDateLong({ date: cust.lastActivity })}</td>
                                        <td style={{ padding: "1rem", textAlign: "right", borderRadius: "0 8px 8px 0" }}>
                                            <button className={isExpanded ? "primary" : "secondary"} style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem" }}>
                                                {isExpanded ? "Cerrar" : "Ver Detalles"}
                                            </button>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr>
                                            <td colSpan="5" style={{ padding: "1rem 0 2rem 0" }}>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "2rem", padding: "0 1rem", alignItems: "start" }}>
                                                    
                                                    {/* Timeline Detallado */}
                                                    <div style={{ borderLeft: "2px solid #eee", paddingLeft: "2rem", marginLeft: "1rem" }}>
                                                        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                                                            {cust.transactions.map((trans) => (
                                                                <div key={trans.id} style={{ position: "relative" }}>
                                                                    <div style={{ position: "absolute", left: "-2.6rem", top: "0.4rem", width: "12px", height: "12px", background: "#fff", border: "3px solid var(--color-primary)", borderRadius: "50%" }}></div>
                                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                                                        <div style={{ fontSize: "0.9rem", fontWeight: "700" }}>{formatDateLong(trans)} <span style={{ fontWeight: "400", color: "#999", marginLeft: "0.5rem" }}>{formatTime(trans)}</span></div>
                                                                        <div style={{ fontWeight: "700", color: "#c62828" }}>{formatCurrency(trans.total)}</div>
                                                                    </div>
                                                                    <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #eee", overflow: "hidden" }}>
                                                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                                                                            <thead>
                                                                                <tr style={{ background: "#f9f9f9", textAlign: "left", color: "#999", fontSize: "0.7rem", textTransform: "uppercase" }}>
                                                                                    <th style={{ padding: "0.5rem 1rem", width: "40px" }}></th>
                                                                                     <th style={{ padding: "0.5rem 1rem" }}>Producto</th>
                                                                                     <th style={{ padding: "0.5rem 1rem", textAlign: "center" }}>Cant.</th>
                                                                                     <th style={{ padding: "0.5rem 1rem", textAlign: "center" }}>Abonar</th>
                                                                                     <th style={{ padding: "0.5rem 1rem", textAlign: "right" }}>Subtotal</th>
                                                                                     <th style={{ padding: "0.5rem 1rem", textAlign: "center", width: "40px" }}></th>
                                                                                 </tr>
                                                                             </thead>
                                                                             <tbody>
                                                                                 {trans.items.map(item => (
                                                                                     <tr 
                                                                                         key={item.id} 
                                                                                         style={{ borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}
                                                                                         onClick={() => handleItemToggle(trans.id, item.id, item.cartQuantity)}
                                                                                     >
                                                                                         <td style={{ padding: "0.6rem 1rem" }}>
                                                                                             <input 
                                                                                                 type="checkbox" 
                                                                                                 style={{ accentColor: "var(--color-primary)" }} 
                                                                                                 checked={!!paymentItems[`${trans.id}_${item.id}`]} 
                                                                                                 onChange={() => {}} // Se maneja por el onClick de la fila
                                                                                             />
                                                                                         </td>
                                                                                         <td style={{ padding: "0.6rem 1rem", fontWeight: "600" }}>{item.name}</td>
                                                                                         <td style={{ padding: "0.6rem 1rem", textAlign: "center", color: "#666" }}>x{item.cartQuantity}</td>
                                                                                         <td style={{ padding: "0.6rem 1rem", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                                                                                             {paymentItems[`${trans.id}_${item.id}`] ? (
                                                                                                 <input type="number" min="1" max={item.cartQuantity} value={paymentItems[`${trans.id}_${item.id}`]} onChange={(e) => handleQtyChange(trans.id, item.id, e.target.value, item.cartQuantity)} style={{ width: "40px", padding: "2px", border: "1px solid var(--color-primary)", borderRadius: "4px", textAlign: "center" }} />
                                                                                             ) : "-"}
                                                                                         </td>
                                                                                         <td style={{ padding: "0.6rem 1rem", textAlign: "right", fontWeight: "600" }}>{formatCurrency(item.price * (paymentItems[`${trans.id}_${item.id}`] || item.cartQuantity))}</td>
                                                                                         <td style={{ padding: "0.6rem 1rem", textAlign: "center" }} onClick={(e) => { e.stopPropagation(); onRemoveLoanItem(trans.id, item.id); }}>
                                                                                             <button style={{ background: "none", border: "none", color: "#ff4d4d", cursor: "pointer", fontSize: "1.1rem", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" }} title="Eliminar del crédito">
                                                                                                 <SafeEmoji emoji="🗑️" />
                                                                                             </button>
                                                                                         </td>
                                                                                     </tr>
                                                                                 ))}
                                                                             </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Centro de Pago */}
                                                    <div style={{ position: "sticky", top: "1rem" }}>
                                                        <div style={{ background: "var(--color-surface)", borderRadius: "12px", padding: "1.2rem", border: "2px solid var(--color-primary)", boxShadow: "0 8px 20px rgba(0,0,0,0.05)" }}>
                                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                                                                <div style={{ fontSize: "0.7rem", fontWeight: "800", textTransform: "uppercase", color: "var(--color-primary)", letterSpacing: "1px" }}>Total Selección</div>
                                                                <label style={{ fontSize: "0.7rem", fontWeight: "700", color: splitEnabled ? "var(--color-primary)" : "#999", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                                                                    Dividir <input type="checkbox" checked={splitEnabled} onChange={(e) => setSplitEnabled(e.target.checked)} />
                                                                </label>
                                                            </div>
                                                            <div style={{ fontSize: "1.8rem", fontWeight: "900", marginBottom: "1.2rem" }}>{formatCurrency(totalSelected)}</div>
                                                            
                                                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                                                <div>
                                                                    <label style={{ fontSize: "0.75rem", fontWeight: "700", display: "block", marginBottom: "0.3rem" }}>Vendedor</label>
                                                                    <select value={selectedVendedor} onChange={(e) => setSelectedVendedor(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--color-border)", fontSize: "0.85rem" }}>
                                                                        <option value="">Seleccionar...</option>
                                                                        {vendedores.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                                                                    </select>
                                                                </div>

                                                                {!splitEnabled ? (
                                                                    <div>
                                                                        <label style={{ fontSize: "0.75rem", fontWeight: "700", display: "block", marginBottom: "0.3rem" }}>Método</label>
                                                                        <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid var(--color-border)", fontSize: "0.85rem" }}>
                                                                            {paymentMethods.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>)}
                                                                        </select>
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ background: "#f8f9fa", padding: "0.8rem", borderRadius: "8px", border: "1px solid #eee" }}>
                                                                        {splitPayments.map((row) => (
                                                                            <div key={row.id} style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                                                                                <select value={row.method} onChange={(e) => handleSplitChange(row.id, "method", e.target.value)} style={{ flex: 1, padding: "4px", fontSize: "0.75rem", borderRadius: "4px" }}>
                                                                                    {paymentMethods.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>)}
                                                                                </select>
                                                                                <input type="number" placeholder="Monto" value={row.amount} onChange={(e) => handleSplitChange(row.id, "amount", e.target.value)} style={{ width: "80px", padding: "4px", fontSize: "0.75rem", borderRadius: "4px" }} />
                                                                                {splitPayments.length > 1 && (
                                                                                    <button onClick={() => handleRemoveSplitRow(row.id)} style={{ background: "none", border: "none", color: "#ff4d4d", cursor: "pointer", fontWeight: "bold" }}>×</button>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                        <button onClick={handleAddSplitRow} style={{ width: "100%", padding: "4px", border: "1px dashed var(--color-primary)", background: "transparent", color: "var(--color-primary)", fontSize: "0.7rem", fontWeight: "700", cursor: "pointer", marginTop: "4px" }}>+ Añadir Método</button>
                                                                        <div style={{ marginTop: "8px", fontSize: "0.75rem", fontWeight: "800", display: "flex", justifyContent: "space-between", color: Math.abs(splitRemaining) > 0 ? "#c62828" : "#2e7d32" }}>
                                                                            <span>{Math.abs(splitRemaining) > 0 ? "Faltan:" : "Cubierto:"}</span>
                                                                            <span>{formatCurrency(Math.abs(splitRemaining))}</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                
                                                                <button 
                                                                    className="primary" 
                                                                    style={{ width: "100%", padding: "0.8rem", marginTop: "0.5rem", opacity: (totalSelected === 0 || (splitEnabled && Math.abs(splitRemaining) > 0)) ? 0.5 : 1 }}
                                                                    disabled={totalSelected === 0 || (splitEnabled && Math.abs(splitRemaining) > 0)}
                                                                    onClick={() => {
                                                                        const loanIds = [...new Set(Object.keys(paymentItems).map(k => k.split('_')[0]))];
                                                                        loanIds.forEach(id => handlePayTransaction(id));
                                                                    }}
                                                                >
                                                                    PROCESAR ABONO
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div style={{ marginTop: "1rem", padding: "1rem", borderRadius: "12px", background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                                                            <div style={{ fontWeight: "700", fontSize: "0.8rem", color: "#666" }}>Deuda Total</div>
                                                            <div style={{ fontSize: "1.2rem", fontWeight: "800", color: "#c62828" }}>{formatCurrency(cust.totalDebt)}</div>
                                                        </div>
                                                    </div>

                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Loans;
