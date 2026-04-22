import React, { useState } from "react";
import { isEmojiSupported } from "../utils/emojiSupport";
import SafeEmoji from "./SafeEmoji";
import { useApp } from "../context/AppProvider";

const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

const DEFAULT_PAYMENT_METHODS = [
    { id: "efe", emoji: "💵", name: "Efectivo" },
    { id: "tar", emoji: "💳", name: "Tarjeta" },
    { id: "bre", emoji: "⚡", name: "Bre-B" },
    { id: "neq", emoji: "📱", name: "Nequi" },
    { id: "dav", emoji: "🏦", name: "Daviplata" },
    { id: "ser", emoji: "☕", name: "Servicio" },
];

function Cart({
    cart,
    total,
    products,
    customers,
    promotions,
    selectedCustomerId,
    onSelectCustomer,
    onRemoveFromCart,
    onUpdateQuantity,
    onCheckout,
    vendedores,
    selectedVendedorName,
    onSelectVendedor,
    onPrint,
    orderNotes,
    onNotesChange,
    customTotal,
    onCustomTotalChange,
    paymentMethods,
    onSaveLoan,
    splitPaymentEnabled,
    onToggleSplitPayment,
}) {
    // ── Single-payment state ──────────────────────────────────────────────
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("Efectivo");
    // ── Prevent body scroll when modal is open ───────────────────────────
    // Removed because we are going back to an inline cart layout


    // ── Split-payment state ───────────────────────────────────────────────
    const [splitPayments, setSplitPayments] = useState([
        { id: Date.now(), method: "Efectivo", amount: "" },
    ]);

    const availableMethods = paymentMethods && paymentMethods.length > 0
        ? paymentMethods
        : DEFAULT_PAYMENT_METHODS;

    const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
    const selectedCustomerName = selectedCustomer?.name || "";
    const customerPriceType = selectedCustomer?.priceType || "special";

    // ── Single-payment helpers ────────────────────────────────────────────
    const changeAmount = paymentAmount ? parseInt(paymentAmount) - total : null;

    // ── Split-payment helpers ─────────────────────────────────────────────
    const splitTotal = splitPayments.reduce((s, p) => s + (parseInt(p.amount) || 0), 0);
    const splitRemaining = total - splitTotal;

    const handleAddSplitRow = () => {
        setSplitPayments(prev => [
            ...prev,
            { id: Date.now(), method: availableMethods[0]?.name || "Efectivo", amount: "" },
        ]);
    };

    const handleRemoveSplitRow = (id) => {
        setSplitPayments(prev => prev.filter(p => p.id !== id));
    };

    const handleSplitChange = (id, field, value) => {
        setSplitPayments(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    // ── Checkout ──────────────────────────────────────────────────────────
    const resetPaymentState = () => {
        setPaymentAmount("");
        setPaymentMethod("Efectivo");
        setSplitPayments([{ id: Date.now(), method: availableMethods[0]?.name || "Efectivo", amount: "" }]);
    };

    const handleCheckout = () => {
        if (cart.length === 0) return;
        if (!selectedVendedorName) {
            showToast("Por favor selecciona un vendedor", "warning");
            return;
        }

        if (!splitPaymentEnabled) {
            // single mode - allow checkout even if empty or less than total
            onCheckout(
                selectedCustomerName || "General",
                selectedVendedorName,
                paymentMethod,
                orderNotes || ""
            );
        } else {
            // split mode
            let validPayments = splitPayments
                .filter(p => parseInt(p.amount) > 0)
                .map(p => ({ method: p.method, amount: parseInt(p.amount) }));

            // If no individual amounts entered, assume full total on the first method
            if (validPayments.length === 0) {
                validPayments = [{ method: splitPayments[0].method, amount: total }];
            }

            onCheckout(
                selectedCustomerName || "General",
                selectedVendedorName,
                validPayments,
                orderNotes || ""
            );
        }

        resetPaymentState();
        onSelectCustomer("");
        if (onNotesChange) onNotesChange("");
    };

    // ── Checkout button disabled logic ────────────────────────────────────
    const checkoutDisabled = !selectedVendedorName || cart.length === 0;

    // ── Item subtotal helper ──────────────────────────────────────────────
    const getItemSubtotal = (item) => {
        let basePrice = item.price;
        const isFlexible = item.name?.toLowerCase() === "otro" || item.isPriceFlexible;

        if (selectedCustomerId && !isFlexible) {
            if (customerPriceType === "wholesale" && item.wholesalePrice) {
                basePrice = item.wholesalePrice;
            } else if (customerPriceType === "special" && item.specialPrice) {
                basePrice = item.specialPrice;
            } else if (customerPriceType === "general") {
                basePrice = item.price;
            }
        }
        const promo = promotions.find((p) => p.productId === item.id);
        if (promo && item.cartQuantity >= promo.quantity) {
            if (promo.type === "bulk") {
                return promo.price * item.cartQuantity;
            } else {
                const promoCount = Math.floor(item.cartQuantity / promo.quantity);
                const extraCount = item.cartQuantity % promo.quantity;
                return promoCount * promo.price + extraCount * basePrice;
            }
        }
        return basePrice * item.cartQuantity;
    };

    // ── Item subtitle helper (displays promo info) ──────────────────────────
    const getItemSubtitle = (item) => {
        const promo = promotions.find((p) => p.productId === item.id);
        if (promo && item.cartQuantity >= promo.quantity) {
            if (promo.type === "bulk") {
                return `(x${promo.quantity}+ a ${formatCurrency(promo.price)} c/u)`;
            } else {
                return `(Pack: ${promo.quantity}x ${formatCurrency(promo.price)})`;
            }
        }
        
        let basePrice = item.price;
        const isFlexible = item.name?.toLowerCase() === "otro" || item.isPriceFlexible;
        if (selectedCustomerId && !isFlexible) {
            if (customerPriceType === "wholesale" && item.wholesalePrice) {
                return `(Mayorista)`;
            } else if (customerPriceType === "special" && item.specialPrice) {
                return `(Especial)`;
            }
        }
        return null;
    };

    return (
        <>
        <div className="card cart-sidebar" style={{ 
            height: "100%", 
            display: "flex",
            flexDirection: "column",
            overflow: "hidden", // LOCKED ROOT SCROLL
            padding: "0.75rem",
            flexShrink: 0
        }}>
            <h4 style={{ color: "var(--color-primary)", marginBottom: "0.5rem", fontSize: "1rem" }}>Orden Actual</h4>

            {/* Selectors Row: Vendedor and Cliente side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.6rem", flexShrink: 0 }}>
                <div>
                    <label style={{ display: "block", fontSize: "0.7rem", marginBottom: "0.15rem", color: "#666", fontWeight: "700" }}>Vendedor *</label>
                    <select
                        value={selectedVendedorName}
                        onChange={(e) => onSelectVendedor(e.target.value)}
                        style={{ width: "100%", padding: "0.3rem", borderRadius: "6px", border: "1.5px solid var(--color-primary)", fontSize: "0.85rem", boxSizing: "border-box" }}
                    >
                        <option value="">Seleccionar</option>
                        {vendedores.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ display: "block", fontSize: "0.7rem", marginBottom: "0.15rem", color: "#666", fontWeight: "700" }}>Cliente</label>
                    <select
                        value={selectedCustomerId}
                        onChange={(e) => onSelectCustomer(e.target.value)}
                        style={{ width: "100%", padding: "0.3rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem", boxSizing: "border-box" }}
                    >
                        <option value="">Público General</option>
                        {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            {selectedCustomerId && (
                <div style={{ fontSize: "0.65rem", padding: "0.1rem 0.3rem", borderRadius: "4px", background: "#f5f5f5", marginBottom: "0.6rem", textAlign: "center", fontWeight: "600", color: customerPriceType === "wholesale" ? "#4527a0" : customerPriceType === "general" ? "#757575" : "#E91E63", flexShrink: 0 }}>
                    {customerPriceType === "wholesale" ? "Mayorista" : customerPriceType === "general" ? "General" : "Especial"}
                </div>
            )}

            {cart.length === 0 ? (
                <p style={{ flexShrink: 0 }}>No hay artículos en el carrito</p>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                    {/* Cart Items - THE ONLY SCROLLABLE PART */}
                    <div style={{ flex: 1, overflowY: "auto", marginBottom: "0.5rem", minHeight: 0, paddingRight: "0.2rem" }}>
                        {cart.map((item) => (
                            <div
                                key={item.id}
                                className="cart-item"
                                style={{ marginBottom: "0.5rem", paddingBottom: "0.4rem", borderBottom: "1px solid #f0f0f0" }}
                            >
                                <div style={{ marginBottom: "0.2rem", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.3rem" }}>
                                    <span style={{ fontWeight: "600", fontSize: "0.85rem" }}>{item.name}</span>
                                    {getItemSubtitle(item) && (
                                        <span style={{ fontSize: "0.65rem", color: "#E91E63", fontWeight: "bold" }}>
                                            {getItemSubtitle(item)}
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                        <button onClick={() => onUpdateQuantity(item.id, -1)} style={{ width: "18px", height: "18px", borderRadius: "50%", border: "1px solid #ccc", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#666" }}>-</button>
                                        <span style={{ minWidth: "16px", textAlign: "center", fontWeight: "500", fontSize: "0.8rem" }}>{item.cartQuantity}</span>
                                        <button onClick={() => onUpdateQuantity(item.id, 1)} style={{ width: "18px", height: "18px", borderRadius: "50%", border: "1px solid #ccc", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#666" }}>+</button>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                        <span style={{ fontWeight: "700", color: "#333", fontSize: "0.8rem" }}>{formatCurrency(getItemSubtotal(item))}</span>
                                        <button onClick={() => onRemoveFromCart(item.id)} style={{ color: "#ff4d4d", background: "none", border: "none", cursor: "pointer", fontSize: "1rem", fontWeight: "bold" }}>×</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── INLINE CHECKOUT AREA ── */}
                    <div style={{ marginTop: "auto", borderTop: "1px solid #ddd", paddingTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.4rem", flexShrink: 0 }}>
                        
                        {/* Status Toggles Row (Discount & Split) */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "0.2rem", fontSize: "0.7rem", fontWeight: "600", color: "#444", cursor: "pointer", border: "1px solid #eee", padding: "0.2rem", borderRadius: "4px" }}>
                                <input type="checkbox" checked={customTotal !== null} onChange={(e) => onCustomTotalChange(e.target.checked ? "" : null)} style={{ width: "14px", height: "14px", margin: 0 }} />
                                <span>Dscto.</span>
                            </label>
                            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.2rem", background: splitPaymentEnabled ? "#e0f7fa" : "#f1f3f4", borderRadius: "4px", border: `1px solid ${splitPaymentEnabled ? "#0097a7" : "#eee"}`, cursor: "pointer" }}>
                                <span style={{ fontWeight: "700", color: splitPaymentEnabled ? "#006064" : "#666", fontSize: "0.7rem" }}>Dividir</span>
                                <input type="checkbox" checked={!!splitPaymentEnabled} onChange={(e) => onToggleSplitPayment(e.target.checked)} style={{ width: "14px", height: "14px", margin: 0 }} />
                            </label>
                        </div>
                        {customTotal !== null && (
                            <input type="number" placeholder="Total acordado..." value={customTotal} onChange={(e) => onCustomTotalChange(e.target.value)} style={{ width: "100%", padding: "0.3rem", borderRadius: "4px", border: "1px solid var(--color-primary)", fontSize: "0.85rem", fontWeight: "700" }} />
                        )}

                        {/* ── SINGLE MODE ── */}
                        {!splitPaymentEnabled && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "0.65rem", marginBottom: "0.1rem", fontWeight: "700", color: "#666" }}>Recibido $</label>
                                    <input type="number" placeholder="Monto" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} style={{ width: "100%", padding: "0.3rem", borderRadius: "4px", border: "1px solid #ddd", fontSize: "0.85rem", fontWeight: "bold", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: "0.65rem", marginBottom: "0.1rem", fontWeight: "700", color: "#666" }}>Método</label>
                                    <select value={paymentMethod} onChange={(e) => {
                                        const val = e.target.value;
                                        setPaymentMethod(val);
                                        if (val === "Servicio") { onCustomTotalChange(0); setPaymentAmount(0); }
                                        else if (paymentMethod === "Servicio") { onCustomTotalChange(null); }
                                    }} style={{ width: "100%", padding: "0.3rem", borderRadius: "4px", border: "1px solid #ddd", fontSize: "0.8rem", fontWeight: "bold", boxSizing: "border-box" }}>
                                        {availableMethods.map(pm => (
                                            <option key={pm.id} value={pm.name}>{pm.emoji && isEmojiSupported(pm.emoji) ? `${pm.emoji} ` : ""}{pm.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                        {!splitPaymentEnabled && paymentAmount && (
                            <div style={{ padding: "0.4rem", borderRadius: "6px", background: changeAmount >= 0 ? "#e8f5e9" : "#ffebee", color: changeAmount >= 0 ? "#1b5e20" : "#b71c1c", fontWeight: "bold", fontSize: "0.95rem", textAlign: "center", border: `1px solid ${changeAmount >= 0 ? "#c8e6c9" : "#ffcdd2"}` }}>
                                {changeAmount >= 0 ? `Vueltas: ${formatCurrency(changeAmount)}` : `Faltan: ${formatCurrency(Math.abs(changeAmount))}`}
                            </div>
                        )}

                        {/* ── SPLIT MODE ── */}
                        {splitPaymentEnabled && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                {splitPayments.map((row, idx) => (
                                    <div key={row.id} style={{ display: "flex", gap: "0.4rem" }}>
                                        <select value={row.method} onChange={(e) => handleSplitChange(row.id, "method", e.target.value)} style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #ddd", fontSize: "0.85rem" }}>
                                            {availableMethods.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>)}
                                        </select>
                                        <input type="number" placeholder="Monto" value={row.amount} onChange={(e) => handleSplitChange(row.id, "amount", e.target.value)} style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #ddd", fontSize: "0.9rem", fontWeight: "bold" }} />
                                        {splitPayments.length > 1 && (
                                            <button onClick={() => handleRemoveSplitRow(row.id)} style={{ padding: "0.5rem", color: "#ff4d4d", background: "none", border: "none", cursor: "pointer", fontWeight: "bold", fontSize: "1.1rem" }}>×</button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={handleAddSplitRow} style={{ width: "100%", padding: "0.4rem", border: "1px dashed #0097a7", borderRadius: "6px", color: "#00838f", fontWeight: "600", cursor: "pointer", background: "transparent", fontSize: "0.85rem" }}>+ Añadir Pago</button>
                                <div style={{ marginTop: "0.3rem", padding: "0.5rem", borderRadius: "6px", background: splitRemaining <= 0 ? "#e8f5e9" : "#fff8e1", display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "0.9rem" }}>
                                    <span>{splitRemaining <= 0 ? "✅ Cubierto" : "⏳ Pend."}</span>
                                    <span>{formatCurrency(Math.abs(splitRemaining))}</span>
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        <div>
                            <textarea placeholder="Notas..." value={orderNotes || ""} onChange={(e) => onNotesChange && onNotesChange(e.target.value)} style={{ width: "100%", padding: "0.3rem", borderRadius: "4px", border: "1px solid #ddd", minHeight: "28px", fontSize: "0.75rem", resize: "none", boxSizing: "border-box" }} />
                        </div>

                        {/* Total Summary */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8f9fa", padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid #eee" }}>
                            <span style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#666" }}>Total:</span>
                            <span style={{ fontSize: "1.2rem", fontWeight: "900", color: "var(--color-primary)" }}>{formatCurrency(total)}</span>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                            <button onClick={() => onPrint({ date: new Date().toISOString(), customerName: selectedCustomerName || "General", vendedorName: selectedVendedorName, paymentMethod: splitPaymentEnabled ? "Múltiple" : paymentMethod, total, items: cart.map(i => ({ name: `${i.name} ${getItemSubtitle(i) || ""}`.trim(), cartQuantity: i.cartQuantity, subtotal: getItemSubtotal(i) })) })} style={{ padding: "0.5rem", background: "#f5f5f5", borderRadius: "6px", border: "1px solid #ddd", color: "#333", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.2rem", fontSize: "0.75rem" }}>
                                Ticket
                            </button>
                            <button disabled={!selectedCustomerId} onClick={() => { onSaveLoan(selectedCustomerName, selectedVendedorName, orderNotes); }} style={{ padding: "0.5rem", background: selectedCustomerId ? "#f57f17" : "#eee", borderRadius: "6px", border: "none", color: selectedCustomerId ? "white" : "#999", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.2rem", fontSize: "0.75rem" }}>
                                Crédito
                            </button>
                            <button className="primary" onClick={handleCheckout} disabled={checkoutDisabled} style={{ gridColumn: "span 2", padding: "0.7rem", fontSize: "1rem", fontWeight: "bold", textTransform: "uppercase", borderRadius: "6px" }}>
                                Confirmar Cobro
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </>
    );
}

export default Cart;
