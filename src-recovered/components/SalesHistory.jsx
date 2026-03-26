import React, { useState, useMemo } from "react";
import ExcelJS from "exceljs/dist/exceljs.min.js";
import SafeEmoji from "./SafeEmoji";
import { saveAs } from "file-saver";
import DatePicker, { registerLocale } from "react-datepicker";
import es from "date-fns/locale/es";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("es", es);

const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

function SalesHistory({ transactions, vendedores, products, categories, initialFilters, onClearInitialFilters, onPrint, onUpdateTransaction }) {
    const [filters, setFilters] = useState({
        dateRange: [new Date(), new Date()],
        minPrice: "",
        maxPrice: "",
        productName: "",
        vendedorName: "",
        paymentMethod: "",
        hasNotes: false,
    });
    const [sortKey, setSortKey] = useState("date");
    const [sortDirection, setSortDirection] = useState("desc");
    const [expandedId, setExpandedId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [tempItems, setTempItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");

    React.useEffect(() => {
        if (initialFilters) {
            setFilters(prev => ({
                ...prev,
                ...initialFilters
            }));
            onClearInitialFilters();
        }
    }, [initialFilters, onClearInitialFilters]);

    const filteredTransactions = useMemo(() => {
        console.log("Transacciones recibidas:", transactions);
        return [...transactions]
            .filter((t) => {
                if (!t.date) return true; // Mostrar si no hay fecha para debug
                const transDate = t.date?.toDate ? t.date.toDate() : new Date(t.date);
                const [startDate, endDate] = filters.dateRange;

                if (startDate) {
                    const sDate = new Date(startDate);
                    sDate.setHours(0, 0, 0, 0);
                    if (transDate < sDate) return false;
                }
                if (endDate) {
                    const eDate = new Date(endDate);
                    eDate.setHours(23, 59, 59, 999);
                    if (transDate > eDate) return false;
                }
                if (filters.minPrice !== "" && (t.total || 0) < parseFloat(filters.minPrice)) return false;
                if (filters.maxPrice !== "" && (t.total || 0) > parseFloat(filters.maxPrice)) return false;
                if (filters.vendedorName && t.vendedorName !== filters.vendedorName) return false;
                if (filters.productName) {
                    const query = filters.productName.toLowerCase();
                    if (!t.items || !t.items.some((item) => item.name?.toLowerCase().includes(query))) return false;
                }
                if (filters.paymentMethod) {
                    // Match against payments array (split payment) OR paymentMethod (legacy)
                    const hasMatch = (t.payments && t.payments.some(p => p.method === filters.paymentMethod))
                        || t.paymentMethod === filters.paymentMethod;
                    if (!hasMatch) return false;
                }
                if (filters.hasNotes && !t.notes) return false;
                return true;
            })
            .sort((a, b) => {
                let valA, valB;
                const itemsA = a.items || [];
                const itemsB = b.items || [];
                switch (sortKey) {
                    case "date":
                        valA = a.date ? new Date(a.date).getTime() : 0;
                        valB = b.date ? new Date(b.date).getTime() : 0;
                        break;
                    case "total":
                        valA = a.total || 0;
                        valB = b.total || 0;
                        break;
                    case "customer":
                        valA = (a.customerName || "General").toLowerCase();
                        valB = (b.customerName || "General").toLowerCase();
                        break;
                    case "vendedor":
                        valA = (a.vendedorName || "").toLowerCase();
                        valB = (b.vendedorName || "").toLowerCase();
                        break;
                    case "items":
                        valA = itemsA.length;
                        valB = itemsB.length;
                        break;
                    case "paymentMethod":
                        valA = (a.paymentMethod || "").toLowerCase();
                        valB = (b.paymentMethod || "").toLowerCase();
                        break;
                    default:
                        return 0;
                }
                if (valA < valB) return sortDirection === "asc" ? -1 : 1;
                if (valA > valB) return sortDirection === "asc" ? 1 : -1;
                return 0;
            });
    }, [transactions, filters, sortKey, sortDirection]);

    const totals = useMemo(() => {
        return filteredTransactions.reduce((acc, t) => {
            const itemsCount = (t.items || []).reduce((sum, item) => sum + (item.cartQuantity || 1), 0);
            return {
                products: acc.products + itemsCount,
                sales: acc.sales + (t.total || 0)
            };
        }, { products: 0, sales: 0 });
    }, [filteredTransactions]);

    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Detalle Transacciones");

        sheet.columns = [
            { header: "Fecha", key: "fecha", width: 15 },
            { header: "Hora", key: "hora", width: 12 },
            { header: "Vendedor", key: "vendedor", width: 18 },
            { header: "Cliente", key: "cliente", width: 18 },
            { header: "Producto", key: "producto", width: 25 },
            { header: "Categoría", key: "categoria", width: 20 },
            { header: "Precio Unit.", key: "precioUnit", width: 15 },
            { header: "Cantidad", key: "cantidad", width: 10 },
            { header: "Subtotal", key: "subtotal", width: 15 },
            { header: "Total Transacción", key: "totalTrans", width: 18 },
            { header: "Método de Pago", key: "metodoPago", width: 18 },
            { header: "Notas", key: "notas", width: 30 },
        ];

        // Header style
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF0E7300" },
        };
        headerRow.alignment = { vertical: "middle", horizontal: "center" };

        filteredTransactions.forEach((t) => {
            t.items.forEach((item, idx) => {
                const product = products.find(p => p.id === item.id) || products.find(p => p.name === item.name);
                const categoryName = categories.find(c => c.id === product?.categoryId)?.name || "Sin Categoría";

                sheet.addRow({
                    fecha: new Date(t.date).toLocaleDateString(),
                    hora: new Date(t.date).toLocaleTimeString(),
                    vendedor: t.vendedorName || "N/A",
                    cliente: t.customerName || "General",
                    producto: item.name,
                    categoria: categoryName,
                    precioUnit: item.price,
                    cantidad: item.cartQuantity || 1,
                    subtotal: item.subtotal || item.price * (item.cartQuantity || 1),
                    totalTrans: t.total,
                    metodoPago: t.paymentMethod || "Efectivo",
                    notas: idx === 0 ? (t.notes || "") : "",
                });
            });
        });

        // Currency formatting
        ["G", "I", "J"].forEach((col) => {
            sheet.getColumn(col).numFmt = '"$"#,##0';
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `reporte_ventas_${new Date().toISOString().split("T")[0]}.xlsx`);
    };

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };



    const sortedColumnStyle = (key) => ({
        cursor: "pointer",
        userSelect: "none",
        background: sortKey === key ? "rgba(14,115,0,0.1)" : "transparent",
        padding: "1rem 0.5rem",
    });


    const handleStartEdit = (transaction) => {
        setEditingId(transaction.id);
        setTempItems([...transaction.items]);
        setSearchTerm("");
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setTempItems([]);
        setSearchTerm("");
    };

    const handleSaveEdit = (transaction) => {
        const newTotal = tempItems.reduce((acc, item) => acc + (item.subtotal || item.price * (item.cartQuantity || 1)), 0);
        onUpdateTransaction(transaction.id, tempItems, newTotal, transaction.items);
        setEditingId(null);
        setTempItems([]);
    };

    const handleUpdateTempQuantity = (index, delta) => {
        const newItems = [...tempItems];
        const item = { ...newItems[index] };
        item.cartQuantity = Math.max(1, (item.cartQuantity || 1) + delta);
        item.subtotal = item.price * item.cartQuantity;
        newItems[index] = item;
        setTempItems(newItems);
    };

    const handleRemoveTempItem = (index) => {
        const newItems = [...tempItems];
        newItems.splice(index, 1);
        setTempItems(newItems);
    };

    const handleAddProductToTemp = (product) => {
        const existingIndex = tempItems.findIndex(i => i.id === product.id);
        if (existingIndex > -1) {
            handleUpdateTempQuantity(existingIndex, 1);
        } else {
            // Determine price based on current transaction customer (if reachable)
            // For simplicity, we'll try to guess or use Normal Price.
            // Actually, we should probably check the transaction's customer type, but transactions only store customerName.
            // Let's use item.price as default, or check if we can reconstruct the priceType.
            setTempItems([...tempItems, {
                id: product.id,
                name: product.name,
                price: product.price,
                cartQuantity: 1,
                subtotal: product.price
            }]);
        }
        setSearchTerm("");
    };

    const filteredProductsToList = useMemo(() => {
        if (!searchTerm) return [];
        return products.filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 5);
    }, [products, searchTerm]);

    return (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "2rem", alignItems: "start" }}>
            {/* Sidebar Filtros */}
            <div style={{ position: "sticky", top: "1rem" }}>
                <div className="card" style={{ padding: "1.5rem" }}>
                    <h2 style={{ color: "var(--color-primary)", marginBottom: "1.5rem", fontSize: "1.4rem" }}>Filtros</h2>

                    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                        <div>
                            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.4rem", fontWeight: "600" }}>Rango de Fecha</label>
                            <DatePicker
                                selectsRange={true}
                                startDate={filters.dateRange[0]}
                                endDate={filters.dateRange[1]}
                                onChange={(update) => {
                                    setFilters({ ...filters, dateRange: update });
                                }}
                                isClearable={true}
                                locale="es"
                                dateFormat="dd/MM/yyyy"
                                placeholderText="Seleccionar rango"
                                className="custom-datepicker"
                                wrapperClassName="datepicker-wrapper"
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.4rem", fontWeight: "600" }}>Vendedor</label>
                            <select
                                value={filters.vendedorName}
                                onChange={(e) => setFilters({ ...filters, vendedorName: e.target.value })}
                                style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #ccc" }}
                            >
                                <option value="">Todos los vendedores</option>
                                {vendedores.map((v) => (
                                    <option key={v.id} value={v.name}>
                                        {v.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.4rem", fontWeight: "600" }}>Producto</label>
                            <input
                                type="text"
                                placeholder="Buscar producto..."
                                value={filters.productName}
                                onChange={(e) => setFilters({ ...filters, productName: e.target.value })}
                                style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #ccc" }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.4rem", fontWeight: "600" }}>Rango de Precio</label>
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                <input
                                    type="number"
                                    placeholder="Min $"
                                    value={filters.minPrice}
                                    onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                                    style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #ccc" }}
                                />
                                <input
                                    type="number"
                                    placeholder="Max $"
                                    value={filters.maxPrice}
                                    onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                                    style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #ccc" }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.4rem", fontWeight: "600" }}>Método de Pago</label>
                            <select
                                value={filters.paymentMethod}
                                onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
                                style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #ccc" }}
                            >
                                <option value="">Todos los métodos</option>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Tarjeta">Tarjeta</option>
                                <option value="Bre-B">Bre-B</option>
                                <option value="Nequi">Nequi</option>
                                <option value="Daviplata">Daviplata</option>
                            </select>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.4rem" }}>
                            <input
                                type="checkbox"
                                id="hasNotes"
                                checked={filters.hasNotes}
                                onChange={(e) => setFilters({ ...filters, hasNotes: e.target.checked })}
                                style={{ width: "18px", height: "18px", cursor: "pointer" }}
                            />
                            <label htmlFor="hasNotes" style={{ fontSize: "0.85rem", fontWeight: "600", cursor: "pointer" }}>Solo con Notas / Obs.</label>
                        </div>

                        <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "0.5rem 0" }} />

                        <button
                            className="secondary"
                            onClick={() =>
                                setFilters({
                                    minPrice: "",
                                    maxPrice: "",
                                    productName: "",
                                    vendedorName: "",
                                    paymentMethod: "",
                                    dateRange: [new Date(), new Date()],
                                    hasNotes: false,
                                })
                            }
                            style={{ width: "100%", fontSize: "0.85rem", padding: "0.7rem" }}
                        >
                            Limpiar Filtros
                        </button>

                        <button
                            className="primary"
                            onClick={handleExportExcel}
                            style={{ width: "100%", fontSize: "0.85rem", padding: "0.7rem" }}
                        >
                            <SafeEmoji emoji="📦" /> Exportar Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Contenido Principal (Tabla) */}
            <div className="card" style={{ minWidth: 0 }}>
                <div style={{ marginBottom: "1.5rem" }}>
                    <h2 style={{ color: "var(--color-primary)", margin: 0 }}>Historial de Transacciones</h2>
                    <p style={{ color: "#666", fontSize: "0.91rem", marginTop: "0.3rem" }}>
                        Mostrando {filteredTransactions.length} transacciones
                    </p>
                </div>

                {filteredTransactions.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "3rem", color: "#888" }}>
                        <p style={{ fontSize: "1.1rem" }}>No se encontraron transacciones con esos filtros.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="history-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                            <thead>
                                <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
                                    <th style={{ padding: "1rem 0.5rem", width: "40px" }}></th>
                                    <th style={sortedColumnStyle("date")} onClick={() => handleSort("date")}>
                                        Fecha y Hora {sortKey === "date" ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
                                    </th>
                                    <th style={sortedColumnStyle("vendedor")} onClick={() => handleSort("vendedor")}>
                                        Vendedor {sortKey === "vendedor" ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
                                    </th>
                                    <th style={sortedColumnStyle("customer")} onClick={() => handleSort("customer")}>
                                        Cliente {sortKey === "customer" ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
                                    </th>
                                    <th style={{ ...sortedColumnStyle("items"), textAlign: "center" }} onClick={() => handleSort("items")}>
                                        Cant. {sortKey === "items" ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
                                    </th>
                                    <th style={sortedColumnStyle("total")} onClick={() => handleSort("total")}>
                                        Total {sortKey === "total" ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
                                    </th>
                                    <th style={sortedColumnStyle("paymentMethod")} onClick={() => handleSort("paymentMethod")}>
                                        Método {sortKey === "paymentMethod" ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
                                    </th>
                                    <th style={{ padding: "1rem 0.5rem" }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.map((t) => (
                                    <React.Fragment key={t.id}>
                                        <tr
                                            onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                                            style={{
                                                borderBottom: "1px solid #f0f0f0",
                                                cursor: "pointer",
                                                backgroundColor: expandedId === t.id ? "#fcfcfc" : "transparent",
                                            }}
                                        >
                                            <td style={{ padding: "1rem 0.5rem", textAlign: "center" }}>
                                                <span
                                                    style={{
                                                        display: "inline-block",
                                                        transition: "transform 0.2s",
                                                        transform: expandedId === t.id ? "rotate(90deg)" : "rotate(0deg)",
                                                        color: "var(--color-primary)",
                                                        fontWeight: "bold",
                                                        fontSize: "0.8rem"
                                                    }}
                                                >
                                                    ▶
                                                </span>
                                            </td>
                                            <td style={{ padding: "1rem 0.5rem" }}>{new Date(t.date).toLocaleString()}</td>
                                            <td style={{ padding: "1rem 0.5rem" }}>
                                                <span
                                                    style={{
                                                        padding: "0.3rem 0.6rem",
                                                        borderRadius: "12px",
                                                        background: "#e8f5e9",
                                                        color: "var(--color-primary)",
                                                        fontSize: "0.85rem",
                                                        fontWeight: "600",
                                                    }}
                                                >
                                                    {t.vendedorName || "N/A"}
                                                </span>
                                            </td>
                                            <td style={{ padding: "1rem 0.5rem" }}>{t.customerName || "General"}</td>
                                            <td style={{ padding: "1rem 0.5rem", textAlign: "center" }}>
                                                {(t.items || []).reduce((acc, item) => acc + (item.cartQuantity || 1), 0)}
                                            </td>
                                            <td style={{ padding: "1rem 0.5rem", fontWeight: "bold" }}>{formatCurrency(t.total)}</td>
                                            <td style={{ padding: "1rem 0.5rem" }}>
                                                {/* Split payment: show all method pills; legacy: single pill */}
                                                {t.payments && t.payments.length > 1 ? (
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                                                        {t.payments.map((p, i) => (
                                                            <span key={i} style={{
                                                                padding: "0.25rem 0.5rem",
                                                                borderRadius: "10px",
                                                                background: "#ede7f6",
                                                                color: "#4527a0",
                                                                fontSize: "0.72rem",
                                                                fontWeight: "600",
                                                                whiteSpace: "nowrap"
                                                            }}>
                                                                {p.method} {formatCurrency(p.amount)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span style={{
                                                        padding: "0.3rem 0.6rem",
                                                        borderRadius: "12px",
                                                        background: t.paymentMethod === "Efectivo" ? "#fff3e0" :
                                                            t.paymentMethod === "Tarjeta" ? "#e1f5fe" :
                                                                t.paymentMethod === "Bre-B" ? "#e8f5e9" :
                                                                    t.paymentMethod === "Nequi" ? "#f3e5f5" : "#e0f2f1",
                                                        color: t.paymentMethod === "Efectivo" ? "#e65100" :
                                                            t.paymentMethod === "Tarjeta" ? "#01579b" :
                                                                t.paymentMethod === "Bre-B" ? "#2e7d32" :
                                                                    t.paymentMethod === "Nequi" ? "#4a148c" : "#004d40",
                                                        fontSize: "0.75rem",
                                                        fontWeight: "600"
                                                    }}>
                                                        {t.paymentMethod || "Efectivo"}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: "1rem 0.5rem" }}>
                                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onPrint(t);
                                                        }}
                                                        style={{
                                                            background: "#f0f0f0",
                                                            border: "none",
                                                            padding: "0.4rem 0.8rem",
                                                            borderRadius: "6px",
                                                            cursor: "pointer",
                                                            fontSize: "0.85rem",
                                                            fontWeight: "600",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            transition: "background 0.2s"
                                                        }}
                                                        title="Reimprimir Recibo"
                                                        onMouseOver={(e) => e.currentTarget.style.background = "#e0e0e0"}
                                                        onMouseOut={(e) => e.currentTarget.style.background = "#f0f0f0"}
                                                    >
                                                        Imprimir
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (expandedId !== t.id) setExpandedId(t.id);
                                                            handleStartEdit(t);
                                                        }}
                                                        style={{
                                                            background: "#e3f2fd",
                                                            border: "none",
                                                            padding: "0.4rem 0.8rem",
                                                            borderRadius: "6px",
                                                            cursor: "pointer",
                                                            fontSize: "0.85rem",
                                                            fontWeight: "600",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            color: "#1976d2",
                                                            transition: "background 0.2s"
                                                        }}
                                                        title="Editar Transacción"
                                                        onMouseOver={(e) => e.currentTarget.style.background = "#bbdefb"}
                                                        onMouseOut={(e) => e.currentTarget.style.background = "#e3f2fd"}
                                                    >
                                                        Editar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedId === t.id && (
                                            <tr>
                                                <td colSpan="7" style={{ padding: "0", backgroundColor: "#fafafa" }}>
                                                    <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #e0e0e0" }}>
                                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                                                            <thead>
                                                                <tr style={{ color: "#666", borderBottom: "1px solid #eee" }}>
                                                                    <th style={{ padding: "0.5rem", textAlign: "left" }}>Producto</th>
                                                                    <th style={{ padding: "0.5rem", textAlign: "right" }}>Precio</th>
                                                                    <th style={{ padding: "0.5rem", textAlign: "center" }}>Cant.</th>
                                                                    <th style={{ padding: "0.5rem", textAlign: "right" }}>Subtotal</th>
                                                                    <th style={{ padding: "0.5rem", textAlign: "center", width: "80px" }}></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {(editingId === t.id ? tempItems : (t.items || [])).map((item, idx) => (
                                                                    <tr key={idx} style={{ borderBottom: "1px solid #f9f9f9" }}>
                                                                        <td style={{ padding: "0.5rem" }}>{item.name}</td>
                                                                        <td style={{ padding: "0.5rem", textAlign: "right" }}>
                                                                            {formatCurrency(item.price)}
                                                                        </td>
                                                                        <td style={{ padding: "0.5rem", textAlign: "center" }}>
                                                                            {editingId === t.id ? (
                                                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                                                                                    <button onClick={() => handleUpdateTempQuantity(idx, -1)} style={{ padding: "2px 8px", borderRadius: "4px", border: "1px solid #ccc", background: "white", cursor: "pointer" }}>-</button>
                                                                                    <span style={{ minWidth: "20px" }}>{item.cartQuantity}</span>
                                                                                    <button onClick={() => handleUpdateTempQuantity(idx, 1)} style={{ padding: "2px 8px", borderRadius: "4px", border: "1px solid #ccc", background: "white", cursor: "pointer" }}>+</button>
                                                                                </div>
                                                                            ) : (
                                                                                <>x{item.cartQuantity || 1}</>
                                                                            )}
                                                                        </td>
                                                                        <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: "600" }}>
                                                                            {formatCurrency(item.subtotal || item.price * (item.cartQuantity || 1))}
                                                                        </td>
                                                                        <td style={{ padding: "0.5rem", textAlign: "center" }}>
                                                                            {editingId === t.id && (
                                                                                <button
                                                                                    onClick={() => handleRemoveTempItem(idx)}
                                                                                    style={{ background: "#ffebee", border: "none", color: "#d32f2f", padding: "0.3rem 0.5rem", borderRadius: "4px", cursor: "pointer" }}
                                                                                >
                                                                                    <SafeEmoji emoji="🗑️" />
                                                                                </button>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                            <tfoot>
                                                                {editingId === t.id && (
                                                                    <tr>
                                                                        <td colSpan="5" style={{ padding: "1rem 0.5rem" }}>
                                                                            <div style={{ position: "relative" }}>
                                                                                <input 
                                                                                    type="text" 
                                                                                    placeholder="🔍 Agregar producto..." 
                                                                                    value={searchTerm}
                                                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                                                    style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", border: "1px solid #ddd" }}
                                                                                />
                                                                                {filteredProductsToList.length > 0 && (
                                                                                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #ddd", borderRadius: "8px", zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", marginTop: "0.2rem" }}>
                                                                                        {filteredProductsToList.map(p => (
                                                                                            <div 
                                                                                                key={p.id} 
                                                                                                onClick={() => handleAddProductToTemp(p)}
                                                                                                style={{ padding: "0.5rem 1rem", cursor: "pointer", borderBottom: "1px solid #eee" }}
                                                                                                className="search-item-hover"
                                                                                                onMouseOver={(e) => e.currentTarget.style.background = "#f5f5f5"}
                                                                                                onMouseOut={(e) => e.currentTarget.style.background = "white"}
                                                                                            >
                                                                                                <div style={{ fontWeight: "600", fontSize: "0.85rem" }}>{p.name}</div>
                                                                                                <div style={{ fontSize: "0.75rem", color: "#666" }}>{formatCurrency(p.price)}</div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                                <tr>
                                                                    <td colSpan="3" style={{ padding: "1rem 0.5rem 0.5rem 0.5rem", textAlign: "right", fontWeight: "600" }}>
                                                                        TOTAL:
                                                                    </td>
                                                                    <td
                                                                        style={{
                                                                            padding: "1rem 0.5rem 0.5rem 0.5rem",
                                                                            textAlign: "right",
                                                                            fontWeight: "bold",
                                                                            color: "var(--color-primary)",
                                                                            fontSize: "0.95rem",
                                                                        }}
                                                                    >
                                                                        {editingId === t.id ? (
                                                                            formatCurrency(tempItems.reduce((acc, i) => acc + (i.subtotal || i.price * (i.cartQuantity || 1)), 0))
                                                                        ) : (
                                                                            formatCurrency(t.total)
                                                                        )}
                                                                    </td>
                                                                    <td></td>
                                                                </tr>
                                                            </tfoot>
                                                        </table>
                                                        
                                                        {editingId === t.id ? (
                                                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1rem" }}>
                                                                <button 
                                                                    onClick={handleCancelEdit}
                                                                    style={{ padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid #ccc", background: "white", cursor: "pointer" }}
                                                                >Cancelar</button>
                                                                <button 
                                                                    onClick={() => handleSaveEdit(t)}
                                                                    style={{ padding: "0.5rem 1.5rem", borderRadius: "8px", border: "none", background: "var(--color-primary)", color: "white", fontWeight: "bold", cursor: "pointer" }}
                                                                >Guardar Cambios</button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {/* Payment breakdown for split transactions */}
                                                                {t.payments && t.payments.length > 1 && (
                                                                    <div style={{ marginTop: "0.8rem", padding: "0.7rem 1rem", background: "#ede7f6", borderRadius: "8px", borderLeft: "3px solid #7e57c2" }}>
                                                                        <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#4527a0", marginRight: "0.6rem" }}><SafeEmoji emoji="🔀" /> Pago dividido:</span>
                                                                        <span style={{ display: "inline-flex", gap: "0.4rem", flexWrap: "wrap" }}>
                                                                            {t.payments.map((p, i) => (
                                                                                <span key={i} style={{ background: "white", border: "1px solid #b39ddb", borderRadius: "8px", padding: "0.2rem 0.6rem", fontSize: "0.82rem", fontWeight: "600", color: "#4527a0" }}>
                                                                                    {p.method}: {formatCurrency(p.amount)}
                                                                                </span>
                                                                            ))}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {t.notes && (
                                                                    <div style={{ marginTop: "0.8rem", padding: "0.7rem 1rem", background: "#fffde7", borderRadius: "8px", borderLeft: "3px solid #f9a825" }}>
                                                                        <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#f57f17", marginRight: "0.5rem" }}><SafeEmoji emoji="📝" /> Notas:</span>
                                                                        <span style={{ fontSize: "0.85rem", color: "#555" }}>{t.notes}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Resumen Final */}
                {filteredTransactions.length > 0 && (
                    <div style={{
                        marginTop: "1.5rem",
                        padding: "1.5rem",
                        background: "white",
                        borderRadius: "12px",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                        border: "1px solid #eee",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                    }}>
                        <div style={{ display: "flex", gap: "2rem" }}>
                            <div>
                                <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.3rem" }}>Productos Vendidos</div>
                                <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--color-primary)" }}>
                                    {totals.products} <span style={{ fontSize: "0.9rem", color: "#999", fontWeight: "normal" }}>uds</span>
                                </div>
                            </div>
                            <div style={{ width: "1px", background: "#eee" }}></div>
                            <div>
                                <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.3rem" }}>Total Recaudado</div>
                                <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#2e7d32" }}>
                                    {formatCurrency(totals.sales)}
                                </div>
                            </div>
                        </div>
                        <div style={{ color: "#999", fontSize: "0.85rem", fontStyle: "italic" }}>
                            * Basado en {filteredTransactions.length} transacciones filtradas
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SalesHistory;
