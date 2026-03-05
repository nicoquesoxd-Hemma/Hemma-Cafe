import React from "react";

const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

function Receipt({ transaction }) {
    if (!transaction) return null;

    const { date, customerName, vendedorName, items, total, paymentMethod } = transaction;

    return (
        <div id="receipt-print-area" style={{
            width: "80mm",
            padding: "5mm",
            backgroundColor: "white",
            color: "black",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "12px",
            lineHeight: "1.4"
        }}>
            <div style={{ textAlign: "center", marginBottom: "15px" }}>
                <h2 style={{ margin: "0", fontSize: "18px" }}>HEMMA CAFÉ</h2>
                <p style={{ margin: "5px 0" }}></p>
                <div style={{ borderBottom: "1px dashed #000", margin: "10px 0" }}></div>
            </div>

            <div style={{ marginBottom: "10px" }}>
                <div><strong>FECHA:</strong> {new Date(date).toLocaleString()}</div>
                <div><strong>VENDEDOR:</strong> {vendedorName || "N/A"}</div>
                <div><strong>CLIENTE:</strong> {customerName || "General"}</div>
                <div style={{ borderBottom: "1px dashed #000", margin: "10px 0" }}></div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px" }}>
                <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #000" }}>
                        <th style={{ padding: "5px 0" }}>PRODUCTO</th>
                        <th style={{ textAlign: "center" }}>CANT.</th>
                        <th style={{ textAlign: "right" }}>TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, idx) => (
                        <tr key={idx}>
                            <td style={{ padding: "5px 0", maxWidth: "40mm", wordWrap: "break-word" }}>{item.name}</td>
                            <td style={{ textAlign: "center" }}>x{item.cartQuantity}</td>
                            <td style={{ textAlign: "right" }}>{formatCurrency(item.subtotal)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div style={{ borderTop: "1px dashed #000", paddingTop: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "14px" }}>
                    <span>TOTAL:</span>
                    <span>{formatCurrency(total)}</span>
                </div>
                <div style={{ marginTop: "5px", fontSize: "11px" }}>
                    <strong>MÉTODO DE PAGO:</strong> {paymentMethod || "Efectivo"}
                </div>
            </div>

            <div style={{ textAlign: "center", marginTop: "20px", fontSize: "10px", fontStyle: "italic" }}>
                <p>¡Gracias por su compra!</p>
                <p>www.hemmacafe.com</p>
            </div>
        </div>
    );
}

export default Receipt;
