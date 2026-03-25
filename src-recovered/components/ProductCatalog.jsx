import React, { useState, useMemo } from "react";

// Helper for formatting currency (COP)
const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

function ProductCatalog({ products, categories, selectedCustomerId, customerPriceType = "special", onAddToCart, salesCount = {} }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [sortBy, setSortBy] = useState("mostSold");
    const [sortOrder, setSortOrder] = useState("desc");

    // Modal state for "Otro" price
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const [priceInput, setPriceInput] = useState("");
    const [pendingProduct, setPendingProduct] = useState(null);

    const filteredProducts = useMemo(() => {
        return [...products]
            .filter((product) => {
                const matchesName = product.name.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesCategory = !categoryFilter || product.categoryId === categoryFilter;
                return matchesName && matchesCategory;
            })
            .sort((a, b) => {
                let valA, valB;
                switch (sortBy) {
                    case "name":
                        valA = a.name.toLowerCase();
                        valB = b.name.toLowerCase();
                        break;
                    case "price":
                        valA = a.price;
                        valB = b.price;
                        break;
                    case "category":
                        valA = (categories?.find((c) => c.id === a.categoryId)?.name || "").toLowerCase();
                        valB = (categories?.find((c) => c.id === b.categoryId)?.name || "").toLowerCase();
                        break;
                    case "category":
                        valA = (categories?.find((c) => c.id === a.categoryId)?.name || "").toLowerCase();
                        valB = (categories?.find((c) => c.id === b.categoryId)?.name || "").toLowerCase();
                        break;
                    case "stock":
                        valA = a.quantity || 0;
                        valB = b.quantity || 0;
                        break;
                    case "mostSold":
                        valA = salesCount[a.id] || 0;
                        valB = salesCount[b.id] || 0;
                        break;
                    default:
                        return 0;
                }

                if (valA < valB) return sortOrder === "asc" ? -1 : 1;
                if (valA > valB) return sortOrder === "asc" ? 1 : -1;
                return 0;
            });
    }, [products, searchQuery, categoryFilter, sortBy, sortOrder, categories]);

    const toggleSortOrder = () => {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    };

    const handleConfirmPrice = () => {
        if (priceInput !== "" && !isNaN(priceInput) && pendingProduct) {
            onAddToCart({ ...pendingProduct, price: parseFloat(priceInput) });
            setIsPriceModalOpen(false);
            setPriceInput("");
            setPendingProduct(null);
        }
    };

    const labelStyle = {
        display: "block",
        fontSize: "0.8rem",
        marginBottom: "0.3rem",
        color: "#555",
        fontWeight: "600",
    };

    const inputStyle = {
        width: "100%",
        padding: "0.5rem",
        borderRadius: "8px",
        border: "1px solid #ccc",
        boxSizing: "border-box",
    };

    return (
        <div style={{ display: "flex", gap: "1rem" }}>
            {/* Price Modal */}
            {isPriceModalOpen && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.6)", zIndex: 1000,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    backdropFilter: "blur(4px)"
                }}>
                    <div className="card" style={{
                        width: "90%", maxWidth: "400px", padding: "2rem",
                        textAlign: "center", animation: "dialogFadeIn 0.3s ease"
                    }}>
                        <h2 style={{ color: "var(--color-primary)", marginBottom: "1rem" }}>Ingrese el Precio</h2>
                        <p style={{ color: "#666", marginBottom: "1.5rem", fontSize: "0.95rem" }}>
                            Ingresa el valor para el item "<b>{pendingProduct?.name}</b>"
                        </p>
                        <div style={{ position: "relative", marginBottom: "1.5rem" }}>
                            <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", fontWeight: "bold", color: "#666" }}>$</span>
                            <input
                                type="number"
                                autoFocus
                                value={priceInput}
                                onChange={(e) => setPriceInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleConfirmPrice()}
                                placeholder="0"
                                style={{
                                    width: "100%", padding: "1rem 1rem 1rem 2.2rem",
                                    borderRadius: "12px", border: "2px solid var(--color-primary)",
                                    fontSize: "1.5rem", fontWeight: "bold", boxSizing: "border-box",
                                    outline: "none"
                                }}
                            />
                        </div>
                        <div style={{ display: "flex", gap: "1rem" }}>
                            <button
                                onClick={() => setIsPriceModalOpen(false)}
                                style={{ flex: 1, padding: "0.8rem", borderRadius: "10px", border: "1px solid #ddd", background: "#f5f5f5", fontWeight: "bold", cursor: "pointer" }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmPrice}
                                style={{ flex: 1, padding: "0.8rem", borderRadius: "10px", border: "none", background: "var(--color-primary)", color: "white", fontWeight: "bold", cursor: "pointer" }}
                            >
                                Agregar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sidebar Filters */}
            <div
                className="card"
                style={{
                    width: "200px",
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.8rem",
                    padding: "1rem",
                    alignSelf: "flex-start",
                    position: "sticky",
                    top: "1rem",
                    zIndex: 10
                }}
            >
                <h3 style={{ margin: 0, color: "var(--color-primary)", fontSize: "1rem" }}>Filtros</h3>
                <div>
                    <label style={labelStyle}>Buscar</label>
                    <input
                        type="text"
                        placeholder="Producto..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={inputStyle}
                    />
                </div>
                <div>
                    <label style={labelStyle}>Categoría</label>
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        style={inputStyle}
                    >
                        <option value="">Todas</option>
                        {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                                {cat.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label style={labelStyle}>Ordenar por</label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={inputStyle}>
                        <option value="name">Nombre</option>
                        <option value="price">Precio</option>
                        <option value="category">Categoría</option>
                        <option value="stock">Stock</option>
                        <option value="mostSold">Más Vendidos</option>
                    </select>
                </div>
                <button
                    onClick={toggleSortOrder}
                    className="secondary"
                    style={{ padding: "0.5rem", fontSize: "0.85rem", width: "100%" }}
                    title={sortOrder === "asc" ? "Ascendente" : "Descendente"}
                >
                    {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
                </button>
            </div>

            {/* Product Grid */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div className="product-grid">
                    {filteredProducts.map((product) => {
                        const categoryName = categories?.find((c) => c.id === product.categoryId)?.name;
                        const isOutOfStock = product.quantity <= 0;

                        let hasDiscount = false;
                        let currentPrice = product.price;

                        if (selectedCustomerId) {
                            if (customerPriceType === "wholesale" && product.wholesalePrice) {
                                currentPrice = product.wholesalePrice;
                                hasDiscount = true;
                            } else if (customerPriceType === "special" && product.specialPrice) {
                                currentPrice = product.specialPrice;
                                hasDiscount = true;
                            }
                        }

                        return (
                            <div
                                onClick={() => {
                                    if (isOutOfStock) return;
                                    if (product.name.toLowerCase() === "otro" || product.isPriceFlexible) {
                                        setPendingProduct(product);
                                        setIsPriceModalOpen(true);
                                    } else {
                                        onAddToCart(product);
                                    }
                                }}
                                key={product.id}
                                className={`product-card ${isOutOfStock ? "out-of-stock" : ""}`}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    opacity: isOutOfStock ? 0.6 : 1,
                                    cursor: isOutOfStock ? "not-allowed" : "pointer",
                                    position: "relative",
                                    overflow: "hidden",
                                }}
                            >
                                {isOutOfStock && (
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: "50%",
                                            left: "50%",
                                            transform: "translate(-50%, -50%)",
                                            background: "rgba(255,0,0,0.8)",
                                            color: "white",
                                            padding: "0.5rem 1rem",
                                            borderRadius: "4px",
                                            fontWeight: "bold",
                                            zIndex: 2,
                                        }}
                                    >
                                        AGOTADO
                                    </div>
                                )}
                                {product.image && (
                                    <img
                                        src={product.image}
                                        alt={product.name}
                                        style={{
                                            width: "100%",
                                            height: "120px",
                                            objectFit: "cover",
                                            borderRadius: "8px 8px 0 0",
                                            marginBottom: "0.5rem",
                                        }}
                                    />
                                )}
                                <div>
                                    <h3>{product.name}</h3>
                                    {categoryName && (
                                        <span
                                            style={{
                                                fontSize: "0.75rem",
                                                background: "var(--color-primary)",
                                                color: "white",
                                                padding: "0.1rem 0.4rem",
                                                borderRadius: "10px",
                                                display: "inline-block",
                                                marginBottom: "0.5rem",
                                            }}
                                        >
                                            {categoryName}
                                        </span>
                                    )}
                                </div>
                                <div
                                    style={{
                                        marginTop: "auto",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <div>
                                        {hasDiscount && (
                                            <span
                                                style={{
                                                    textDecoration: "line-through",
                                                    color: "#999",
                                                    fontSize: "0.8rem",
                                                    marginRight: "0.5rem",
                                                }}
                                            >
                                                {formatCurrency(product.price)}
                                            </span>
                                        )}
                                        <p
                                            className="price"
                                            style={{
                                                margin: 0,
                                                color: hasDiscount ? "#E91E63" : "var(--color-primary)",
                                            }}
                                        >
                                            {formatCurrency(currentPrice)}
                                        </p>
                                    </div>
                                    <span style={{ fontSize: "0.8rem", color: "#666" }}>
                                        Disp.: {product.quantity || 0}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default ProductCatalog;
