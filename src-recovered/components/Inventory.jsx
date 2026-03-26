import React, { useState, useMemo } from "react";
import SafeEmoji from "./SafeEmoji";
import ExcelJS from "exceljs/dist/exceljs.min.js";
import { saveAs } from "file-saver";
import { useApp } from "../context/AppProvider";

function CollapsibleCard({ title, color, isOpen: controlledIsOpen, onToggle, defaultOpen = true, children, extraAction }) {
    const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);
    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
    const toggle = onToggle || (() => setInternalIsOpen(!internalIsOpen));

    return (
        <div className="card" style={{ borderLeft: `5px solid ${color}` }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    userSelect: "none",
                }}
            >
                <div onClick={toggle} style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1 }}>
                    <h2 style={{ color, margin: 0 }}>{title}</h2>
                    <span
                        style={{
                            fontSize: "1.4rem",
                            color,
                            transition: "transform 0.3s",
                            transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                            display: "inline-block",
                        }}
                    >
                        ▼
                    </span>
                </div>
                {extraAction && <div style={{ marginLeft: "1rem" }}>{extraAction}</div>}
            </div>
            <div className={`collapsible-wrapper ${isOpen ? "open" : ""}`}>
                <div className="collapsible-content">
                    {children}
                </div>
            </div>
        </div>
    );
}

function Inventory({
    products,
    categories,
    onAddProduct,
    onUpdateProduct,
    onDeleteProduct,
    onAddCategory,
    onDeleteCategory,
    promotions,
    onAddPromotion,
    onDeletePromotion,
    onImportXlsx
}) {
    const { showToast, showConfirm, theme, updateTheme, resetTheme } = useApp();
    const [newProduct, setNewProduct] = useState({
        name: "",
        price: "",
        specialPrice: "",
        wholesalePrice: "",
        quantity: "",
        categoryId: "",
        image: "",
    });
    const [editingId, setEditingId] = useState(null); // Keep for inline price editing if still used, but we'll use a main isEditingId for full edit
    const [isEditingId, setIsEditingId] = useState(null);
    const [editProduct, setEditProduct] = useState({});
    const [isUploading, setIsUploading] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
    const [expandedSections, setExpandedSections] = useState({
        products: true,
        addProduct: true,
        categories: false,
        promotions: false,
    });

    const handleDownloadInventory = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Inventario Actual");

            worksheet.columns = [
                { header: "Nombre", key: "Nombre", width: 25 },
                { header: "Categoría", key: "Categoría", width: 20 },
                { header: "Precio", key: "Precio", width: 15 },
                { header: "Cantidad", key: "Cantidad", width: 10 },
                { header: "Precio Especial", key: "Precio Especial", width: 15 },
                { header: "Precio Mayorista", key: "Precio Mayorista", width: 15 }
            ];

            products.forEach(p => {
                const category = categories.find(c => c.id === p.categoryId)?.name || "General";
                worksheet.addRow({
                    "Nombre": p.name,
                    "Categoría": category,
                    "Precio": p.price,
                    "Cantidad": p.quantity,
                    "Precio Especial": p.specialPrice || "",
                    "Precio Mayorista": p.wholesalePrice || ""
                });
            });

            // Style headers
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE8F5E9' }
            };

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Inventario_Hemma_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast("Inventario descargado exitosamente", "success");
        } catch (err) {
            console.error(err);
            showToast("Error al exportar inventario", "error");
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const buffer = evt.target.result;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                const worksheet = workbook.worksheets[0];
                const data = [];

                // Get headers from first row
                const headers = {};
                const headerRow = worksheet.getRow(1);
                headerRow.eachCell((cell, colNumber) => {
                    headers[colNumber] = cell.text;
                });

                // Iterate through rows starting from 2
                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return;
                    const rowData = {};
                    row.eachCell((cell, colNumber) => {
                        const header = headers[colNumber];
                        if (header) {
                            // Extract numeric value if it's a number, or just text
                            rowData[header] = cell.type === ExcelJS.ValueType.Number ? cell.value : cell.text;
                        }
                    });
                    if (Object.keys(rowData).length > 0) {
                        data.push(rowData);
                    }
                });

                if (data.length > 0) {
                    onImportXlsx(data);
                } else {
                    showToast("El archivo está vacío o no tiene el formato correcto", "warning");
                }
            } catch (err) {
                console.error(err);
                showToast("Error al leer el archivo Excel", "error");
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = null; // Reset input
    };

    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleSort = (key) => {
        if (sortConfig.key === key) {
            setSortConfig({ key, direction: sortConfig.direction === "asc" ? "desc" : "asc" });
        } else {
            setSortConfig({ key, direction: "asc" });
        }
    };

    const sortedColumnStyle = (key) => ({
        cursor: "pointer",
        userSelect: "none",
        background: sortConfig.key === key ? "rgba(21,101,192,0.05)" : "transparent",
        padding: "0.8rem 0.5rem",
    });

    const handleImageUpload = async (e, isEditing = false) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "HemmaCafe"); // From minified code
        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/dlmjkaehj/image/upload`, {
                method: "POST",
                body: formData,
            });
            if (!response.ok) throw new Error("Error al subir imagen");
            const data = await response.json();
            if (isEditing) {
                setEditProduct((prev) => ({ ...prev, image: data.secure_url }));
            } else {
                setNewProduct((prev) => ({ ...prev, image: data.secure_url }));
            }
            showToast("Imagen subida exitosamente", "success");
        } catch (err) {
            showToast("Error al subir la imagen", "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleAddProduct = (e) => {
        e.preventDefault();
        if (!newProduct.name || !newProduct.price || !newProduct.quantity || !newProduct.categoryId) {
            showToast("Complete los campos obligatorios", "warning");
            return;
        }

        const productData = {
            ...newProduct,
            price: parseFloat(newProduct.price),
            specialPrice: newProduct.specialPrice ? parseFloat(newProduct.specialPrice) : null,
            wholesalePrice: newProduct.wholesalePrice ? parseFloat(newProduct.wholesalePrice) : null,
            quantity: parseInt(newProduct.quantity),
        };

        if (isEditingId) {
            onUpdateProduct(isEditingId, productData);
            setIsEditingId(null);
            setExpandedSections(prev => ({ ...prev, products: true }));
            showToast("Producto actualizado", "success");
        } else {
            onAddProduct(productData);
            showToast("Producto agregado", "success");
        }

        setNewProduct({ name: "", price: "", specialPrice: "", wholesalePrice: "", quantity: "", categoryId: "", image: "" });
    };

    const handleEditProduct = (p) => {
        setIsEditingId(p.id);
        setNewProduct({
            name: p.name,
            price: p.price.toString(),
            specialPrice: p.specialPrice ? p.specialPrice.toString() : "",
            wholesalePrice: p.wholesalePrice ? p.wholesalePrice.toString() : "",
            quantity: p.quantity.toString(),
            categoryId: p.categoryId,
            image: p.image || ""
        });
        setExpandedSections(prev => ({ ...prev, addProduct: true, products: false }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setIsEditingId(null);
        setNewProduct({ name: "", price: "", specialPrice: "", wholesalePrice: "", quantity: "", categoryId: "", image: "" });
        setExpandedSections(prev => ({ ...prev, products: true }));
    };

    const handleUpdatePrice = (id, newPrice) => {
        onUpdateProduct(id, { price: parseFloat(newPrice) });
        setEditingId(null);
    };

    const handleAddCategory = (e) => {
        e.preventDefault();
        if (!newCategoryName) return;
        onAddCategory(newCategoryName);
        setNewCategoryName("");
        showToast("Categoría agregada", "success");
    };

    const [newPromo, setNewPromo] = useState({ productId: "", quantity: "", price: "" });
    const handleAddPromotion = (e) => {
        e.preventDefault();
        if (!newPromo.productId || !newPromo.quantity || !newPromo.price) return;
        onAddPromotion({
            ...newPromo,
            quantity: parseInt(newPromo.quantity),
            price: parseFloat(newPromo.price),
        });
        setNewPromo({ productId: "", quantity: "", price: "" });
        showToast("Promoción agregada", "success");
    };

    const sortedProducts = useMemo(() => {
        let filtered = products.filter((p) => {
            const matchesName = p.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = !categoryFilter || p.categoryId === categoryFilter;
            return matchesName && matchesCategory;
        });
        return filtered.sort((a, b) => {
            let aVal, bVal;
            if (sortConfig.key === "categoryId") {
                aVal = (categories.find(c => c.id === a.categoryId)?.name || "").toLowerCase();
                bVal = (categories.find(c => c.id === b.categoryId)?.name || "").toLowerCase();
            } else if (typeof a[sortConfig.key] === 'string') {
                aVal = (a[sortConfig.key] || "").toLowerCase();
                bVal = (b[sortConfig.key] || "").toLowerCase();
            } else {
                aVal = a[sortConfig.key] || 0;
                bVal = b[sortConfig.key] || 0;
            }
            if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
    }, [products, searchQuery, categoryFilter, sortConfig, categories]);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <CollapsibleCard
                title={<><SafeEmoji emoji="📦" /> Productos</>}
                color="var(--color-primary)"
                isOpen={expandedSections.products}
                onToggle={() => toggleSection('products')}
                extraAction={
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <input
                            type="file"
                            id="xlsxInput"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileUpload}
                            style={{ display: "none" }}
                        />
                        <button
                            onClick={handleDownloadInventory}
                            style={{
                                background: "#1565c0",
                                color: "white",
                                border: "none",
                                padding: "0.5rem 1rem",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                                fontWeight: "bold"
                            }}
                        >
                            <SafeEmoji emoji="📤" /> Descargar Inventario
                        </button>
                        <button
                            onClick={() => document.getElementById("xlsxInput").click()}
                            style={{
                                background: "#2e7d32",
                                color: "white",
                                border: "none",
                                padding: "0.5rem 1rem",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                                fontWeight: "bold"
                            }}
                        >
                            <SafeEmoji emoji="📥" /> Subir XLSX
                        </button>
                    </div>
                }
            >
                <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                    <input
                        placeholder="Buscar..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ flex: 1, padding: "0.6rem", borderRadius: "8px", border: "1px solid #ddd" }}
                    />
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        style={{ padding: "0.6rem", borderRadius: "8px", border: "1px solid #ddd" }}
                    >
                        <option value="">Todas las categorías</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div style={{ overflowX: "auto" }}>
                    <table className="history-table" style={{ width: "100%" }}>
                        <thead>
                            <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
                                <th style={{ padding: "0.8rem 0.5rem" }}>Img</th>
                                <th style={sortedColumnStyle("name")} onClick={() => handleSort("name")}>
                                    Nombre {sortConfig.key === "name" ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : ""}
                                </th>
                                <th style={sortedColumnStyle("categoryId")} onClick={() => handleSort("categoryId")}>
                                    Categoría {sortConfig.key === "categoryId" ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : ""}
                                </th>
                                <th style={sortedColumnStyle("quantity")} onClick={() => handleSort("quantity")}>
                                    Stock {sortConfig.key === "quantity" ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : ""}
                                </th>
                                <th style={sortedColumnStyle("price")} onClick={() => handleSort("price")}>
                                    Precio {sortConfig.key === "price" ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : ""}
                                </th>
                                <th style={sortedColumnStyle("specialPrice")} onClick={() => handleSort("specialPrice")}>
                                    Especial {sortConfig.key === "specialPrice" ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : ""}
                                </th>
                                <th style={sortedColumnStyle("wholesalePrice")} onClick={() => handleSort("wholesalePrice")}>
                                    Mayorista {sortConfig.key === "wholesalePrice" ? (sortConfig.direction === "asc" ? " ↑" : " ↓") : ""}
                                </th>
                                <th style={{ textAlign: "right", padding: "0.8rem 0.5rem" }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedProducts.map((p) => (
                                <tr key={p.id}>
                                    <td>
                                        {p.image ? (
                                            <img
                                                src={p.image}
                                                alt=""
                                                style={{ width: "35px", height: "35px", objectFit: "cover", borderRadius: "4px" }}
                                            />
                                        ) : (
                                            <div style={{ width: "35px", height: "35px", background: "#f0f0f0", borderRadius: "4px" }}></div>
                                        )}
                                    </td>
                                    <td style={{ fontWeight: "600" }}>{p.name}</td>
                                    <td>{categories.find((c) => c.id === p.categoryId)?.name || "-"}</td>
                                    <td>
                                        <span style={{ color: p.quantity <= 5 ? "red" : "inherit" }}>
                                            {p.quantity} unid.
                                        </span>
                                    </td>
                                    <td>${p.price.toLocaleString()}</td>
                                    <td style={{ color: "var(--color-primary)" }}>
                                        {p.specialPrice ? `$${p.specialPrice.toLocaleString()}` : "-"}
                                    </td>
                                    <td style={{ color: "#6a1b9a", fontWeight: p.wholesalePrice ? "600" : "normal" }}>
                                        {p.wholesalePrice ? `$${p.wholesalePrice.toLocaleString()}` : "-"}
                                    </td>
                                    <td style={{ textAlign: "right" }}>
                                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem" }}>
                                            <button
                                                onClick={() => handleEditProduct(p)}
                                                style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", background: "#f0f4ff", color: "#1565c0", border: "1px solid #d0dfff", borderRadius: "4px", cursor: "pointer" }}
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => showConfirm("¿Estás seguro de que deseas eliminar este producto?").then((confirmed) => { if (confirmed) onDeleteProduct(p.id); })}
                                                className="danger"
                                                style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                                            >
                                                Borrar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CollapsibleCard>

            <div className="card" style={{ borderLeft: `5px solid #1565c0`, padding: "0" }}>
                <div
                    onClick={() => toggleSection('addProduct')}
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        padding: "1rem 1.5rem",
                        userSelect: "none"
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                        <span style={{ fontSize: "1.8rem", color: isEditingId ? "#ff8800" : "#6a1b9a", fontWeight: "bold" }}>
                            {isEditingId ? <SafeEmoji emoji="✏️" /> : "+"}
                        </span>
                        <h2 style={{ color: isEditingId ? "#ff8800" : "#1565c0", margin: 0, fontSize: "1.4rem" }}>
                            {isEditingId ? "Editar Producto" : "Agregar Producto"}
                        </h2>
                    </div>
                    <span
                        style={{
                            fontSize: "1.2rem",
                            color: "#1565c0",
                            transition: "transform 0.3s",
                            transform: expandedSections.addProduct ? "rotate(0deg)" : "rotate(-90deg)",
                            display: "inline-block",
                        }}
                    >
                        ▼
                    </span>
                </div>
                <div className={`collapsible-wrapper ${expandedSections.addProduct ? "open" : ""}`}>
                    <div className="collapsible-content">
                        <form onSubmit={handleAddProduct} style={{
                            display: "flex",
                            gap: "1.5rem",
                            padding: "1.5rem",
                            background: "#f8faff",
                            borderRadius: "12px",
                            border: "1px solid #eef2ff"
                        }}>
                            {/* Image Upload Area */}
                            <div style={{
                                width: "160px",
                                height: "220px",
                                border: "2px dashed #ccc",
                                borderRadius: "12px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                position: "relative",
                                background: newProduct.image ? `url(${newProduct.image}) center/cover no-repeat` : "#fff"
                            }} onClick={() => document.getElementById("fileInput").click()}>
                                {!newProduct.image && (
                                    <>
                                        <span style={{ fontSize: "2rem", color: "#ccc" }}>+</span>
                                        <span style={{ fontSize: "0.8rem", color: "#999" }}>Subir imagen</span>
                                    </>
                                )}
                                <input
                                    id="fileInput"
                                    type="file"
                                    onChange={handleImageUpload}
                                    accept="image/*"
                                    style={{ display: "none" }}
                                    disabled={isUploading}
                                />
                                {isUploading && (
                                    <div style={{
                                        position: "absolute",
                                        inset: 0,
                                        background: "rgba(255,255,255,0.7)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        borderRadius: "12px"
                                    }}>
                                        <span style={{ fontSize: "0.8rem", fontWeight: "bold" }}>...</span>
                                    </div>
                                )}
                            </div>

                            {/* Inputs Area */}
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                                <input
                                    value={newProduct.name}
                                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                    placeholder="Nombre del Producto"
                                    style={{ width: "100%", padding: "0.7rem", borderRadius: "8px", border: "1px solid #ddd" }}
                                />
                                <select
                                    value={newProduct.categoryId}
                                    onChange={(e) => setNewProduct({ ...newProduct, categoryId: e.target.value })}
                                    style={{ width: "100%", padding: "0.7rem", borderRadius: "8px", border: "1px solid #ddd" }}
                                >
                                    <option value="">Seleccionar Categoría</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.8rem" }}>
                                    <input
                                        type="number"
                                        value={newProduct.price}
                                        onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                                        placeholder="Precio Normal (COP)"
                                        style={{ width: "100%", padding: "0.7rem", borderRadius: "8px", border: "1px solid #ddd" }}
                                    />
                                    <input
                                        type="number"
                                        value={newProduct.specialPrice}
                                        onChange={(e) => setNewProduct({ ...newProduct, specialPrice: e.target.value })}
                                        placeholder="Precio Especial"
                                        style={{ width: "100%", padding: "0.7rem", borderRadius: "8px", border: "1px solid #ddd", borderTop: "3px solid var(--color-primary)" }}
                                    />
                                    <input
                                        type="number"
                                        value={newProduct.wholesalePrice}
                                        onChange={(e) => setNewProduct({ ...newProduct, wholesalePrice: e.target.value })}
                                        placeholder="Precio Mayorista"
                                        style={{ width: "100%", padding: "0.7rem", borderRadius: "8px", border: "1px solid #ddd", borderTop: "3px solid #6a1b9a" }}
                                    />
                                </div>
                                <input
                                    type="number"
                                    value={newProduct.quantity}
                                    onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                                    placeholder="Stock"
                                    style={{ width: "50%", padding: "0.7rem", borderRadius: "8px", border: "1px solid #ddd" }}
                                />
                                <button
                                    type="submit"
                                    style={{
                                        width: "100%",
                                        padding: "0.8rem",
                                        background: isEditingId ? "#ff8800" : (theme?.primary || "#b6d82c"),
                                        color: "white",
                                        border: "none",
                                        borderRadius: "8px",
                                        fontWeight: "bold",
                                        marginTop: "0.5rem",
                                        cursor: isUploading ? "not-allowed" : "pointer"
                                    }}
                                    disabled={isUploading}
                                >
                                    {isUploading ? "Subiendo Imagen..." : (isEditingId ? "Actualizar Producto" : "Agregar Producto")}
                                </button>
                                {isEditingId && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        style={{
                                            width: "100%",
                                            padding: "0.8rem",
                                            background: "#eee",
                                            color: "#666",
                                            border: "none",
                                            borderRadius: "8px",
                                            fontWeight: "bold",
                                            marginTop: "0.3rem",
                                            cursor: "pointer"
                                        }}
                                    >
                                        Cancelar Edición
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Remaining Sections: Categories and Promotions */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Categorías */}
                <div className="card" style={{ borderLeft: "5px solid #007e33", padding: "1rem 1.5rem" }}>
                    <div
                        onClick={() => toggleSection('categories')}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "1.5rem" }}><SafeEmoji emoji="🏷️" /></span>
                            <h2 style={{ color: "#007e33", margin: 0, fontSize: "1.2rem" }}>Categorías</h2>
                        </div>
                        <span style={{
                            color: "#007e33",
                            transition: "transform 0.3s",
                            transform: expandedSections.categories ? "rotate(0deg)" : "rotate(-90deg)"
                        }}>▼</span>
                    </div>
                    <div className={`collapsible-wrapper ${expandedSections.categories ? "open" : ""}`}>
                        <div className="collapsible-content">
                            <form onSubmit={handleAddCategory} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                                <input
                                    placeholder="Nueva categoría"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    style={{ flex: 1, padding: "0.6rem", borderRadius: "8px", border: "1px solid #ddd" }}
                                />
                                <button type="submit" style={{ background: "#007e33", color: "white", border: "none", padding: "0.6rem 1.2rem", borderRadius: "8px", fontWeight: "bold" }}>Agregar</button>
                            </form>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                {categories.map(c => (
                                    <div key={c.id} style={{ background: "#f0f0f0", padding: "0.4rem 0.8rem", borderRadius: "20px", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
                                        <span>{c.name}</span>
                                        <button
                                            onClick={() => onDeleteCategory(c.id)}
                                            style={{ background: "none", border: "none", color: "#ff4d4d", cursor: "pointer", fontWeight: "bold", padding: "0" }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Promociones */}
                <div className="card" style={{ borderLeft: "5px solid #ff8800", padding: "1rem 1.5rem" }}>
                    <div
                        onClick={() => toggleSection('promotions')}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "1.5rem" }}><SafeEmoji emoji="✨" /></span>
                            <h2 style={{ color: "#ff8800", margin: 0, fontSize: "1.2rem" }}>Gestión de Promociones</h2>
                        </div>
                        <span style={{
                            color: "#ff8800",
                            transition: "transform 0.3s",
                            transform: expandedSections.promotions ? "rotate(0deg)" : "rotate(-90deg)"
                        }}>▼</span>
                    </div>
                    <div className={`collapsible-wrapper ${expandedSections.promotions ? "open" : ""}`}>
                        <div className="collapsible-content">
                            <form onSubmit={handleAddPromotion} style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                                <select
                                    value={newPromo.productId}
                                    onChange={(e) => setNewPromo({ ...newPromo, productId: e.target.value })}
                                    style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #ddd" }}
                                >
                                    <option value="">Seleccionar Producto</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
                                    <input
                                        type="number"
                                        placeholder="Cant. Mínima"
                                        value={newPromo.quantity}
                                        onChange={(e) => setNewPromo({ ...newPromo, quantity: e.target.value })}
                                        style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #ddd" }}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Precio Total Promo"
                                        value={newPromo.price}
                                        onChange={(e) => setNewPromo({ ...newPromo, price: e.target.value })}
                                        style={{ width: "100%", padding: "0.6rem", borderRadius: "8px", border: "1px solid #ddd" }}
                                    />
                                </div>
                                <button type="submit" style={{ background: "#ff8800", color: "white", border: "none", padding: "0.8rem", borderRadius: "8px", fontWeight: "bold", textTransform: "uppercase" }}>Activar Promoción</button>
                            </form>
                            <div style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#666", textAlign: "center" }}>
                                {promotions.filter(p => products.find(pr => pr.id === p.productId)).length === 0 ? "No hay promociones activas" : (
                                    <div style={{ textAlign: "left" }}>
                                        {promotions
                                            .filter(p => products.find(pr => pr.id === p.productId))
                                            .map(p => {
                                                const product = products.find(pr => pr.id === p.productId);
                                                return (
                                                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", background: "#fffaf0", padding: "0.5rem", borderRadius: "6px", marginBottom: "0.4rem", border: "1px solid #ffe8cc" }}>
                                                        <span>
                                                            <b>{product.name}</b>:
                                                            {` ${p.quantity}+ x $${(p.price || 0).toLocaleString()}`}
                                                        </span>
                                                        <button
                                                            onClick={() => onDeletePromotion(p.id)}
                                                            style={{ color: "red", background: "none", border: "none", cursor: "pointer", padding: "0 0.5rem", fontSize: "1.1rem" }}
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Inventory;
