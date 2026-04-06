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
        <div className="card" style={{ 
            position: "sticky", 
            top: "1rem", 
            alignSelf: "start", 
            maxHeight: "calc(100vh - 2rem)", 
            overflowY: "auto",
            display: "flex",
            flexDirection: "column"
        }}>
            <h2 style={{ color: "var(--color-primary)", marginBottom: "1rem" }}>Orden Actual</h2>

            {/* Vendedor Selection */}
            <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.3rem", color: "#555", fontWeight: "600" }}>
                    Vendedor *
                </label>
                <select
                    value={selectedVendedorName}
                    onChange={(e) => onSelectVendedor(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "2px solid var(--color-primary)", boxSizing: "border-box" }}
                >
                    <option value="">Seleccionar Vendedor</option>
                    {vendedores.map((v) => (
                        <option key={v.id} value={v.name}>{v.name}</option>
                    ))}
                </select>
            </div>

            {/* Cliente Selection */}
            <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.3rem", color: "#555", fontWeight: "600" }}>
                    Cliente
                </label>
                <select
                    value={selectedCustomerId}
                    onChange={(e) => onSelectCustomer(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box" }}
                >
                    <option value="">Público General</option>
                    {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                {selectedCustomerId && (
                    <div style={{ fontSize: "0.75rem", color: customerPriceType === "wholesale" ? "#4527a0" : customerPriceType === "general" ? "#757575" : "#E91E63", marginTop: "0.3rem", fontWeight: "600" }}>
                        {customerPriceType === "wholesale" ? (
                            <><SafeEmoji emoji="🏦" /> Precios mayoristas aplicados</>
                        ) : customerPriceType === "general" ? (
                            <><SafeEmoji emoji="👤" /> Precios generales aplicados</>
                        ) : (
                            <><SafeEmoji emoji="⭐" /> Precios especiales aplicados</>
                        )}
                    </div>
                )}
            </div>

            {cart.length === 0 ? (
                <p>No hay artículos en el carrito</p>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                    {/* Cart Items */}
                    <div style={{ flex: 1, maxHeight: "50vh", overflowY: "auto", marginBottom: "1rem" }}>
                        {cart.map((item) => (
                            <div
                                key={item.id}
                                className="cart-item"
                                style={{ marginBottom: "1.2rem", paddingBottom: "0.8rem", borderBottom: "1px solid #eee" }}
                            >
                                <div style={{ marginBottom: "0.5rem", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.4rem" }}>
                                    <span style={{ fontWeight: "600", fontSize: "0.95rem" }}>{item.name}</span>
                                    {getItemSubtitle(item) && (
                                        <span style={{ fontSize: "0.75rem", color: "#E91E63", fontWeight: "bold" }}>
                                            {getItemSubtitle(item)}
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                        <button onClick={() => onUpdateQuantity(item.id, -1)} style={{ width: "20px", height: "20px", borderRadius: "50%", border: "1px solid #ccc", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", color: "#666" }}>-</button>
                                        <span style={{ minWidth: "18px", textAlign: "center", fontWeight: "500", fontSize: "0.9rem" }}>{item.cartQuantity}</span>
                                        <button onClick={() => onUpdateQuantity(item.id, 1)} style={{ width: "20px", height: "20px", borderRadius: "50%", border: "1px solid #ccc", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", color: "#666" }}>+</button>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                        <span style={{ fontWeight: "600", color: "#444", fontSize: "0.9rem" }}>{formatCurrency(getItemSubtotal(item))}</span>
                                        <button onClick={() => onRemoveFromCart(item.id)} style={{ color: "#ff4d4d", background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", fontWeight: "bold" }}>×</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── INLINE CHECKOUT AREA ── */}
                    <div style={{ marginTop: "auto", borderTop: "2px solid #eee", paddingTop: "0.8rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        
                        {/* Custom Total (Discount) */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", fontWeight: "600", color: "#666", cursor: "pointer", flex: 1 }}>
                                <input type="checkbox" checked={customTotal !== null} onChange={(e) => onCustomTotalChange(e.target.checked ? "" : null)} style={{ width: "16px", height: "16px", margin: 0 }} />
                                <span><SafeEmoji emoji="🏷️" /> Descuento Especial</span>
                            </label>
                            {customTotal !== null && (
                                <input type="number" placeholder="Precio final..." value={customTotal} onChange={(e) => onCustomTotalChange(e.target.value)} style={{ flex: 1, padding: "0.4rem", borderRadius: "6px", border: "1px solid var(--color-primary)", fontSize: "0.9rem", fontWeight: "700", minWidth: "100px" }} />
                            )}
                        </div>

                        {/* Split Payment Toggle */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0.6rem", background: splitPaymentEnabled ? "#e0f7fa" : "#f1f3f4", borderRadius: "8px", border: `1px solid ${splitPaymentEnabled ? "#0097a7" : "#eee"}` }}>
                            <div style={{ fontWeight: "700", color: splitPaymentEnabled ? "#006064" : "#555", fontSize: "0.85rem" }}>
                                <SafeEmoji emoji="🔀" /> Pago dividido
                            </div>
                            <label style={{ position: "relative", display: "inline-block", width: "40px", height: "22px", cursor: "pointer", margin: 0 }}>
                                <input type="checkbox" checked={!!splitPaymentEnabled} onChange={(e) => onToggleSplitPayment(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                                <span style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: splitPaymentEnabled ? "#0097a7" : "#ccc", borderRadius: "24px", transition: "0.3s" }} />
                                <span style={{ position: "absolute", height: "16px", width: "16px", left: splitPaymentEnabled ? "21px" : "3px", bottom: "3px", background: "white", borderRadius: "50%", transition: "0.3s" }} />
                            </label>
                        </div>

                        {/* ── SINGLE MODE ── */}
                        {!splitPaymentEnabled && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem", fontWeight: "600", color: "#555" }}>Paga con ($)</label>
                                    <input type="number" placeholder="Monto recib..." value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #ddd", fontSize: "1rem", fontWeight: "bold", color: "var(--color-primary)", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.2rem", fontWeight: "600", color: "#555" }}>Método</label>
                                    <select value={paymentMethod} onChange={(e) => {
                                        const val = e.target.value;
                                        setPaymentMethod(val);
                                        if (val === "Servicio") { onCustomTotalChange(0); setPaymentAmount(0); }
                                        else if (paymentMethod === "Servicio") { onCustomTotalChange(null); }
                                    }} style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.9rem", fontWeight: "bold", boxSizing: "border-box" }}>
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
                            <textarea placeholder="Notas (opcional)..." value={orderNotes || ""} onChange={(e) => onNotesChange && onNotesChange(e.target.value)} style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #ddd", minHeight: "45px", fontSize: "0.85rem", resize: "vertical", boxSizing: "border-box" }} />
                        </div>

                        {/* Total Summary */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8f9fa", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid #eee" }}>
                            <span style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#555" }}>Total:</span>
                            <span style={{ fontSize: "1.4rem", fontWeight: "900", color: "var(--color-primary)" }}>{formatCurrency(total)}</span>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                            <button onClick={() => onPrint({ date: new Date().toISOString(), customerName: selectedCustomerName || "General", vendedorName: selectedVendedorName, paymentMethod: splitPaymentEnabled ? "Múltiple" : paymentMethod, total, items: cart.map(i => ({ name: `${i.name} ${getItemSubtitle(i) || ""}`.trim(), cartQuantity: i.cartQuantity, subtotal: getItemSubtotal(i) })) })} style={{ padding: "0.7rem", background: "#f5f5f5", borderRadius: "8px", border: "1px solid #ddd", color: "#333", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
                                <SafeEmoji emoji="🖨️" /> Ticket
                            </button>
                            <button disabled={!selectedCustomerId} onClick={() => { onSaveLoan(selectedCustomerName, selectedVendedorName, orderNotes); }} style={{ padding: "0.7rem", background: selectedCustomerId ? "#f57f17" : "#eee", borderRadius: "8px", border: "none", color: selectedCustomerId ? "white" : "#999", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
                                <SafeEmoji emoji="🤝" /> Crédito
                            </button>
                            <button className="primary" onClick={handleCheckout} disabled={checkoutDisabled} style={{ gridColumn: "span 2", padding: "0.9rem", fontSize: "1.1rem", fontWeight: "bold", textTransform: "uppercase", borderRadius: "8px", boxShadow: "0 4px 12px rgba(182, 216, 44, 0.4)" }}>
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
