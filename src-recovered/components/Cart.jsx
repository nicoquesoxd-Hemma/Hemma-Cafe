import React, { useState } from "react";
import { isEmojiSupported } from "../utils/emojiSupport";
import SafeEmoji from "./SafeEmoji";

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
            alert("Por favor selecciona un vendedor");
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
            const promoCount = Math.floor(item.cartQuantity / promo.quantity);
            const extraCount = item.cartQuantity % promo.quantity;
            return promoCount * promo.price + extraCount * basePrice;
        }
        return basePrice * item.cartQuantity;
    };

    return (
        <div className="card" style={{ position: "sticky", top: "1rem", alignSelf: "start" }}>
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
                <div>
                    {/* Cart Items */}
                    <div style={{ maxHeight: "40vh", overflowY: "auto", marginBottom: "1rem" }}>
                        {cart.map((item) => (
                            <div
                                key={item.id}
                                className="cart-item"
                                style={{ marginBottom: "1.4rem", paddingBottom: "1rem", borderBottom: "1px solid #eee" }}
                            >
                                <div style={{ marginBottom: "0.9rem" }}>
                                    <span style={{ fontWeight: "600", fontSize: "1rem" }}>{item.name}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                                        <button onClick={() => onUpdateQuantity(item.id, -1)} style={{ width: "22px", height: "22px", borderRadius: "50%", border: "1px solid #ccc", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", color: "#666" }}>-</button>
                                        <span style={{ minWidth: "22px", textAlign: "center", fontWeight: "500" }}>{item.cartQuantity}</span>
                                        <button onClick={() => onUpdateQuantity(item.id, 1)} style={{ width: "22px", height: "22px", borderRadius: "50%", border: "1px solid #ccc", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", color: "#666" }}>+</button>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginLeft: "1rem" }}>
                                            <span style={{ fontWeight: "600", color: "#444", fontSize: "0.95rem" }}>{formatCurrency(getItemSubtotal(item))}</span>
                                            <button onClick={() => onRemoveFromCart(item.id)} style={{ color: "#ff4d4d", background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", fontWeight: "bold" }}>×</button>
                                        </div>
                                        {(() => {
                                            const promo = promotions.find((p) => p.productId === item.id);
                                            return promo && item.cartQuantity >= promo.quantity ? (
                                                <span style={{ fontSize: "0.7rem", color: "#f57f17", textAlign: "right", fontWeight: "bold", marginTop: "0.2rem" }}>¡Promo Aplicada! <SafeEmoji emoji="✨" /></span>
                                            ) : null;
                                        })()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Payment Section */}
                    <div style={{ marginTop: "1rem", borderTop: "2px solid var(--color-primary)", paddingTop: "1rem" }}>

                        {/* Split Payment Toggle */}
                        <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center", 
                            marginBottom: "1rem", 
                            padding: "0.6rem 0.8rem", 
                            background: splitPaymentEnabled ? "#e0f7fa" : "#f5f5f5", 
                            borderRadius: "10px", 
                            border: `1px solid ${splitPaymentEnabled ? "#0097a7" : "#ddd"}`, 
                            transition: "background 0.3s" 
                        }}>
                            <div>
                                <div style={{ fontWeight: "700", color: splitPaymentEnabled ? "#006064" : "#555", fontSize: "0.85rem" }}>
                                    <SafeEmoji emoji="🔀" /> Pago dividido
                                </div>
                            </div>
                            <label style={{ position: "relative", display: "inline-block", width: "40px", height: "22px", cursor: "pointer", flexShrink: 0 }}>
                                <input
                                    type="checkbox"
                                    checked={!!splitPaymentEnabled}
                                    onChange={(e) => onToggleSplitPayment(e.target.checked)}
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span style={{
                                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                                    background: splitPaymentEnabled ? "#0097a7" : "#ccc",
                                    borderRadius: "22px",
                                    transition: "background 0.3s"
                                }} />
                                <span style={{
                                    position: "absolute",
                                    height: "16px", width: "16px",
                                    left: splitPaymentEnabled ? "21px" : "3px",
                                    bottom: "3px",
                                    background: "white",
                                    borderRadius: "50%",
                                    transition: "left 0.3s",
                                    boxShadow: "0 1px 2px rgba(0,0,0,0.3)"
                                }} />
                            </label>
                        </div>


                        {/* Total */}
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "1.4rem", color: "var(--color-primary)" }}>
                            <span>Total:</span>
                            <span>{formatCurrency(total)}</span>
                        </div>

                        {/* ── SINGLE PAYMENT MODE ── */}
                        {!splitPaymentEnabled && (
                            <>
                                <div style={{ marginTop: "1rem" }}>
                                    <input
                                        type="number"
                                        placeholder="Paga con..."
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: "2px solid #ddd", boxSizing: "border-box", fontSize: "1.4rem", fontWeight: "bold", color: "var(--color-primary)" }}
                                    />
                                </div>
                                {paymentAmount && (
                                    <div style={{ marginTop: "0.5rem", padding: "0.75rem", borderRadius: "8px", background: changeAmount >= 0 ? "#e8f5e9" : "#ffebee", color: changeAmount >= 0 ? "#2e7d32" : "#c62828", fontWeight: "bold", fontSize: "1.1rem", textAlign: "center" }}>
                                        {changeAmount >= 0 ? `Vueltas: ${formatCurrency(changeAmount)}` : `Faltan: ${formatCurrency(Math.abs(changeAmount))}`}
                                    </div>
                                )}
                                <div style={{ marginTop: "1rem" }}>
                                    <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.3rem", color: "#555", fontWeight: "600" }}>Método de Pago</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: "2px solid #ddd", boxSizing: "border-box", fontSize: "1.1rem", fontWeight: "bold", color: "var(--color-primary)", background: "#fff" }}
                                    >
                                        {availableMethods.map(pm => {
                                            const showEmoji = pm.emoji && isEmojiSupported(pm.emoji);
                                            return (
                                                <option key={pm.id} value={pm.name}>
                                                    {showEmoji ? `${pm.emoji} ` : ""}{pm.name}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </>
                        )}

                        {/* ── SPLIT PAYMENT MODE ── */}
                        {splitPaymentEnabled && (
                            <div style={{ marginTop: "1rem" }}>
                                <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.5rem", color: "#555", fontWeight: "600" }}>
                                    <SafeEmoji emoji="💳" /> Pagos divididos
                                </label>

                                {splitPayments.map((row, idx) => (
                                    <div key={row.id} style={{ display: "flex", gap: "0.4rem", marginBottom: "0.5rem", alignItems: "center" }}>
                                        {/* Method selector */}
                                        <select
                                            value={row.method}
                                            onChange={(e) => handleSplitChange(row.id, "method", e.target.value)}
                                            style={{ flex: "0 0 auto", padding: "0.5rem 0.4rem", borderRadius: "8px", border: "1px solid #ddd", fontSize: "0.9rem", color: "var(--color-primary)", fontWeight: "600", background: "#fff", minWidth: 0 }}
                                        >
                                            {availableMethods.map(pm => {
                                                const showEmoji = pm.emoji && isEmojiSupported(pm.emoji);
                                                return (
                                                    <option key={pm.id} value={pm.name}>
                                                        {showEmoji ? `${pm.emoji} ` : ""}{pm.name}
                                                    </option>
                                                );
                                            })}
                                        </select>

                                        {/* Amount */}
                                        <input
                                            type="number"
                                            placeholder="Monto"
                                            value={row.amount}
                                            onChange={(e) => handleSplitChange(row.id, "amount", e.target.value)}
                                            style={{ flex: "1 1 0", padding: "0.5rem", borderRadius: "8px", border: "1px solid #ddd", fontSize: "1rem", fontWeight: "bold", color: "var(--color-primary)", minWidth: 0 }}
                                        />

                                        {/* Remove row */}
                                        {splitPayments.length > 1 && (
                                            <button
                                                onClick={() => handleRemoveSplitRow(row.id)}
                                                style={{ background: "none", border: "none", color: "#ff4d4d", cursor: "pointer", fontSize: "1.2rem", fontWeight: "bold", padding: "0 0.2rem", flexShrink: 0 }}
                                            >×</button>
                                        )}
                                    </div>
                                ))}

                                {/* Add row button */}
                                <button
                                    onClick={handleAddSplitRow}
                                    style={{ width: "100%", padding: "0.4rem", background: "#f0f4ff", border: "1px dashed #90a4e8", borderRadius: "8px", color: "#3949ab", fontWeight: "600", cursor: "pointer", fontSize: "0.85rem", marginTop: "0.2rem" }}
                                >
                                    + Agregar otro método
                                </button>

                                {/* Running total */}
                                <div style={{ marginTop: "0.7rem", padding: "0.65rem 0.9rem", borderRadius: "8px", background: splitRemaining <= 0 ? "#e8f5e9" : "#fff8e1", color: splitRemaining <= 0 ? "#2e7d32" : "#e65100", fontWeight: "bold", fontSize: "1rem", display: "flex", justifyContent: "space-between" }}>
                                    <span>{splitRemaining <= 0 ? "✅ Cubierto" : "⏳ Pendiente:"}</span>
                                    <span>
                                        {splitRemaining > 0
                                            ? `${formatCurrency(splitRemaining)}`
                                            : splitRemaining < 0
                                                ? `Vueltas: ${formatCurrency(Math.abs(splitRemaining))}`
                                                : "Exacto"}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* ── Custom Total ── */}
                        <div style={{ marginTop: "1rem", border: "1px solid #eee", padding: "0.8rem", borderRadius: "8px", background: "#f9f9f9" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: customTotal !== null ? "0.8rem" : 0 }}>
                                <label style={{ fontSize: "0.85rem", color: "#555", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <input
                                        type="checkbox"
                                        checked={customTotal !== null && customTotal !== undefined}
                                        onChange={(e) => onCustomTotalChange(e.target.checked ? "" : null)}
                                        style={{ width: "16px", height: "16px", cursor: "pointer" }}
                                    />
                                    <SafeEmoji emoji="🏷️" /> Descuento personalizado
                                </label>
                            </div>

                            {(customTotal !== null && customTotal !== undefined) && (
                                <input
                                    type="number"
                                    placeholder="Ingresar precio final..."
                                    value={customTotal || ""}
                                    onChange={(e) => onCustomTotalChange(e.target.value)}
                                    autoFocus
                                    style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid var(--color-primary)", fontSize: "1rem", boxSizing: "border-box", fontWeight: "600", color: "#2e7d32" }}
                                />
                            )}
                        </div>

                        {/* ── Notes ── */}
                        <div style={{ marginTop: "1rem" }}>
                            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.3rem", color: "#555", fontWeight: "600" }}>Notas / Observaciones</label>
                            <textarea
                                placeholder="Notas opcionales de la orden..."
                                value={orderNotes || ""}
                                onChange={(e) => onNotesChange && onNotesChange(e.target.value)}
                                style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #ddd", minHeight: "60px", fontFamily: "inherit", fontSize: "0.85rem", resize: "vertical", boxSizing: "border-box" }}
                            />
                        </div>

                        {/* ── Action buttons ── */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
                            <button
                                className="secondary"
                                style={{ flex: "1 1 45%", padding: "0.8rem", fontSize: "0.9rem", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
                                onClick={() => onPrint({
                                    date: new Date().toISOString(),
                                    customerName: customers.find(c => c.id === selectedCustomerId)?.name || "General",
                                    vendedorName: selectedVendedorName,
                                    paymentMethod: splitPaymentEnabled
                                        ? splitPayments.filter(p => parseInt(p.amount) > 0).map(p => p.method).join(", ")
                                        : paymentMethod,
                                    total: total,
                                    items: cart.map(item => ({
                                        name: item.name,
                                        cartQuantity: item.cartQuantity,
                                        subtotal: getItemSubtotal(item)
                                    }))
                                })}
                            >
                                <SafeEmoji emoji="🖨️" /> Ticket
                            </button>
                            <button
                                style={{ flex: "1 1 45%", padding: "0.8rem", fontSize: "0.9rem", fontWeight: "bold", background: (selectedCustomerId && selectedCustomerId !== "") ? "#f57f17" : "#eee", color: (selectedCustomerId && selectedCustomerId !== "") ? "white" : "#999", border: "none", borderRadius: "8px", cursor: (selectedCustomerId && selectedCustomerId !== "") ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
                                disabled={!selectedCustomerId || selectedCustomerId === ""}
                                onClick={() => onSaveLoan(selectedCustomerName, selectedVendedorName, orderNotes)}
                            >
                                <SafeEmoji emoji="🤝" /> Crédito
                            </button>
                            <button
                                className="primary"
                                style={{ flex: "1 1 100%", padding: "1rem", fontSize: "1.2rem", fontWeight: "bold", textTransform: "uppercase", marginTop: "0.2rem" }}
                                onClick={handleCheckout}
                                disabled={checkoutDisabled}
                            >
                                Cobrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Cart;
