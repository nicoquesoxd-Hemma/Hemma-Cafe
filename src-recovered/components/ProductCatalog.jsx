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
                                key={product.id}
                                className={`product-card ${isOutOfStock ? "out-of-stock" : ""}`}
                                onClick={() => !isOutOfStock && onAddToCart(product)}
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
