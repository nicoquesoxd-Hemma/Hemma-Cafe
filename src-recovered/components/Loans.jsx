import React from "react";
import { isEmojiSupported } from "../utils/emojiSupport";
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

function Loans({ loans, onLoanPayment, paymentMethods, vendedores }) {
    const { showToast } = useApp();
    const [expandedId, setExpandedId] = React.useState(null);
    const [paymentItems, setPaymentItems] = React.useState({}); // { productId: quantity }
    const [payMethod, setPayMethod] = React.useState("Efectivo");
    const [selectedVendedor, setSelectedVendedor] = React.useState("");

    const handleItemToggle = (productId, maxQty) => {
        setPaymentItems(prev => {
            const newItems = { ...prev };
            if (newItems[productId]) {
                delete newItems[productId];
            } else {
                newItems[productId] = maxQty;
            }
            return newItems;
        });
    };

    const handleQtyChange = (productId, qty, maxQty) => {
        const val = parseInt(qty);
        if (isNaN(val) || val < 1) return;
        setPaymentItems(prev => ({
            ...prev,
            [productId]: Math.min(val, maxQty)
        }));
    };

    const calculateSelectedTotal = (loanItems) => {
        return loanItems.reduce((acc, item) => {
            const payQty = paymentItems[item.id] || 0;
            return acc + (item.price * payQty);
        }, 0);
    };

    const handleAbonarProductos = (loan) => {
        const selectedList = (loan.items || [])
            .filter(item => paymentItems[item.id])
            .map(item => ({
                ...item,
                cartQuantity: paymentItems[item.id],
                subtotal: item.price * paymentItems[item.id]
            }));

        if (selectedList.length === 0) {
            showToast("Selecciona al menos un producto para pagar", "warning");
            return;
        }
        if (!selectedVendedor) {
            showToast("Selecciona un vendedor", "warning");
            return;
        }

        const totalToPay = calculateSelectedTotal(loan.items);
        onLoanPayment(loan.id, selectedList, payMethod, selectedVendedor, totalToPay);
        setPaymentItems({});
    };

    const handleExportLoans = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Lista de Créditos");

            worksheet.columns = [
                { header: "Cliente", key: "customer", width: 25 },
                { header: "Total Crédito", key: "total", width: 15 },
                { header: "Última Actividad", key: "lastActivity", width: 20 },
                { header: "Productos Pendientes", key: "items", width: 40 },
                { header: "Notas", key: "notes", width: 30 }
            ];

            loans.forEach(loan => {
                const total = (loan.items || []).reduce((acc, item) => acc + (item.price * item.cartQuantity), 0);
                const itemsStr = (loan.items || []).map(i => `${i.name} (x${i.cartQuantity})`).join(", ");
                const lastActivity = loan.lastUpdated ?
                    (loan.lastUpdated.toDate ? loan.lastUpdated.toDate().toLocaleString() : new Date(loan.lastUpdated).toLocaleString())
                    : "Sin fecha";

                worksheet.addRow({
                    customer: loan.customerName,
                    total: total,
                    lastActivity: lastActivity,
                    items: itemsStr,
                    notes: loan.notes || ""
                });
            });

            // Style headers
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFF3E0' }
            };

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Lista_Creditos_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="card">
            <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ color: "var(--color-primary)", margin: 0 }}>Gestión de Crédito</h2>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <button
                        onClick={handleExportLoans}
                        style={{
                            background: "#ef6c00",
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
                        <SafeEmoji emoji="📤" /> Exportar a Excel
                    </button>
                    <span style={{ color: "#666", fontSize: "0.9rem" }}>
                        {loans.length} {loans.length === 1 ? 'cliente con crédito' : 'clientes con crédito'}
                    </span>
                </div>
            </div>
            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ textAlign: "left", color: "#666", borderBottom: "2px solid #eee" }}>
                            <th style={{ padding: "1rem 0.5rem", width: "40px" }}></th>
                            <th style={{ padding: "1rem" }}>Cliente</th>
                            <th style={{ padding: "1rem" }}>Total Crédito</th>
                            <th style={{ padding: "1rem" }}>Última Actividad</th>
                            <th style={{ padding: "1rem" }}>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loans.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
                                    No hay créditos activos
                                </td>
                            </tr>
                        ) : (
                            loans.map((loan) => {
                                const total = (loan.items || []).reduce((acc, item) => acc + (item.price * item.cartQuantity), 0);
                                const isExpanded = expandedId === loan.id;

                                return (
                                    <React.Fragment key={loan.id}>
                                        <tr
                                            onClick={() => {
                                                setExpandedId(isExpanded ? null : loan.id);
                                                setPaymentItems({});
                                            }}
                                            style={{
                                                borderBottom: "1px solid #f0f0f0",
                                                cursor: "pointer",
                                                backgroundColor: isExpanded ? "#fcfcfc" : "transparent",
                                                transition: "background-color 0.2s"
                                            }}
                                        >
                                            <td style={{ padding: "1rem 0.5rem", textAlign: "center" }}>
                                                <span
                                                    style={{
                                                        display: "inline-block",
                                                        transition: "transform 0.2s",
                                                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                                        color: "var(--color-primary)",
                                                        fontWeight: "bold",
                                                        fontSize: "0.8rem"
                                                    }}
                                                >
                                                    ▶
                                                </span>
                                            </td>
                                            <td style={{ padding: "1rem", fontWeight: "600" }}>{loan.customerName}</td>
                                            <td style={{ padding: "1rem", color: "#c62828", fontWeight: "bold" }}>
                                                {formatCurrency(total)}
                                            </td>
                                            <td style={{ padding: "1rem", fontSize: "0.85rem", color: "#666" }}>
                                                {loan.lastUpdated ? (
                                                    loan.lastUpdated.toDate ? loan.lastUpdated.toDate().toLocaleString() : new Date(loan.lastUpdated).toLocaleString()
                                                ) : "Sin fecha"}
                                            </td>
                                            <td style={{ padding: "1rem" }}>
                                                <span style={{
                                                    background: "#fff3e0",
                                                    color: "#e65100",
                                                    padding: "4px 8px",
                                                    borderRadius: "12px",
                                                    fontSize: "0.75rem",
                                                    fontWeight: "bold"
                                                }}>
                                                    Pendiente
                                                </span>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan="5" style={{ padding: "0", backgroundColor: "#fafafa" }}>
                                                    <div style={{ padding: "1.5rem", borderBottom: "1px solid #e0e0e0" }}>
                                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "2rem" }}>
                                                            {/* Items Detail and Selection */}
                                                            <div>
                                                                <h4 style={{ marginBottom: "1rem", color: "#555" }}>Selecciona productos a pagar:</h4>
                                                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                                                                    <thead>
                                                                        <tr style={{ color: "#888", borderBottom: "1px solid #eee", textAlign: "left" }}>
                                                                            <th style={{ padding: "0.5rem", width: "30px" }}></th>
                                                                            <th style={{ padding: "0.5rem" }}>Producto</th>
                                                                            <th style={{ padding: "0.5rem", textAlign: "center" }}>Crédito</th>
                                                                            <th style={{ padding: "0.5rem", textAlign: "center" }}>A Pagar</th>
                                                                            <th style={{ padding: "0.5rem", textAlign: "right" }}>Subtotal</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {(loan.items || []).map((item) => (
                                                                            <tr key={item.id} style={{ borderBottom: "1px solid #f9f9f9" }}>
                                                                                <td style={{ padding: "0.5rem" }}>
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={!!paymentItems[item.id]}
                                                                                        onChange={() => handleItemToggle(item.id, item.cartQuantity)}
                                                                                    />
                                                                                </td>
                                                                                <td style={{ padding: "0.5rem" }}>{item.name}</td>
                                                                                <td style={{ padding: "0.5rem", textAlign: "center" }}>x{item.cartQuantity}</td>
                                                                                <td style={{ padding: "0.5rem", textAlign: "center" }}>
                                                                                    {paymentItems[item.id] ? (
                                                                                        <input
                                                                                            type="number"
                                                                                            min="1"
                                                                                            max={item.cartQuantity}
                                                                                            value={paymentItems[item.id]}
                                                                                            onChange={(e) => handleQtyChange(item.id, e.target.value, item.cartQuantity)}
                                                                                            style={{ width: "50px", padding: "2px", textAlign: "center" }}
                                                                                        />
                                                                                    ) : "-"}
                                                                                </td>
                                                                                <td style={{ padding: "0.5rem", textAlign: "right" }}>
                                                                                    {formatCurrency(item.price * (paymentItems[item.id] || 0))}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                                {loan.notes && (
                                                                    <div style={{ marginTop: "1rem", padding: "0.8rem", background: "#fffde7", borderRadius: "8px", borderLeft: "3px solid #f9a825", fontSize: "0.85rem" }}>
                                                                        <strong>Obs de Deuda:</strong> {loan.notes}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Finalize Payment Form */}
                                                            <div className="card" style={{ padding: "1.2rem", border: "1px solid #eee", background: "white", alignSelf: "start" }}>
                                                                <div style={{ textAlign: "center", marginBottom: "1.2rem" }}>
                                                                    <div style={{ fontSize: "0.8rem", color: "#888" }}>Total a Pagar Seleccionado:</div>
                                                                    <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#2e7d32" }}>
                                                                        {formatCurrency(calculateSelectedTotal(loan.items))}
                                                                    </div>
                                                                </div>

                                                                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                                                    <div>
                                                                        <label style={{ fontSize: "0.75rem", fontWeight: "bold", display: "block", marginBottom: "0.3rem" }}>Vendedor</label>
                                                                        <select
                                                                            value={selectedVendedor}
                                                                            onChange={(e) => setSelectedVendedor(e.target.value)}
                                                                            style={{ padding: "0.6rem", borderRadius: "8px", border: "1px solid #ddd", width: "100%" }}
                                                                        >
                                                                            <option value="">Seleccionar...</option>
                                                                            {vendedores.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ fontSize: "0.75rem", fontWeight: "bold", display: "block", marginBottom: "0.3rem" }}>Método de Pago</label>
                                                                        <select
                                                                            value={payMethod}
                                                                            onChange={(e) => setPayMethod(e.target.value)}
                                                                            style={{ padding: "0.6rem", borderRadius: "8px", border: "1px solid #ddd", width: "100%" }}
                                                                        >
                                                                            {(paymentMethods && paymentMethods.length > 0 ? paymentMethods : [{ name: "Efectivo", emoji: "💵" }]).map(pm => (
                                                                                <option key={pm.id || pm.name} value={pm.name}>
                                                                                    <SafeEmoji emoji={pm.emoji} /> {pm.name}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                    <button
                                                                        className="primary"
                                                                        onClick={() => handleAbonarProductos(loan)}
                                                                        style={{ padding: "0.8rem", marginTop: "0.5rem", width: "100%", fontSize: "0.95rem" }}
                                                                    >
                                                                        Registrar Pago de Seleccionados
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );


}

export default Loans;
