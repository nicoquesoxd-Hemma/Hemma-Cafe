import React, { useState, useEffect, useMemo } from "react";
import SafeEmoji from "./components/SafeEmoji";
import { db } from "./firebase";
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc, writeBatch, getDocs } from "firebase/firestore";
import Login from "./components/Login";
import ProductCatalog from "./components/ProductCatalog";
import Cart from "./components/Cart";
import Inventory from "./components/Inventory";
import SalesHistory from "./components/SalesHistory";
import DailyPerformance from "./components/DailyPerformance";
import Ajustes from "./components/Ajustes";
import Receipt from "./components/Receipt";
import Loans from "./components/Loans";
import { useApp } from "./context/AppProvider";

function App() {
    const { showToast } = useApp();
    const [currentMode, setCurrentMode] = useState(
        () => localStorage.getItem("pos_mode") || "production"
    );
    const [isAuthenticated, setIsAuthenticated] = useState(
        () => localStorage.getItem(`pos_authenticated_${currentMode}`) === "true"
    );

    const colName = (name) => currentMode === "demo" ? `demo_${name}` : name;
    const [activeTab, setActiveTab] = useState("pos");
    const [products, setProducts] = useState([]);
    const [tables, setTables] = useState(() => {
        const saved = localStorage.getItem(`pos_tables_state_${currentMode}`);
        if (saved) return JSON.parse(saved);
        return {
            "mostrador": [],
            "mesa1": [],
            "mesa2": [],
            "mesa3": [],
            "mesa4": []
        };
    });
    const [activeTable, setActiveTable] = useState("mostrador");
    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [promotions, setPromotions] = useState([]);
    const [selectedCustomerIdByTable, setSelectedCustomerIdByTable] = useState(() => {
        const saved = localStorage.getItem(`pos_customers_state_${currentMode}`);
        if (saved) return JSON.parse(saved);
        return {
            "mostrador": "",
            "mesa1": "",
            "mesa2": "",
            "mesa3": "",
            "mesa4": ""
        };
    });
    const [selectedVendedor, setSelectedVendedor] = useState(
        () => localStorage.getItem(`selectedVendedor_${currentMode}`) || ""
    );
    const [vendedores, setVendedores] = useState([]);
    const [performanceLogs, setPerformanceLogs] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [splitPaymentEnabled, setSplitPaymentEnabled] = useState(
        () => localStorage.getItem(`splitPaymentEnabled_${currentMode}`) === "true"
    );
    const handleToggleSplitPayment = (val) => {
        setSplitPaymentEnabled(val);
        localStorage.setItem(`splitPaymentEnabled_${currentMode}`, String(val));
    };
    const [historyFilter, setHistoryFilter] = useState(null);
    const [transactionToPrint, setTransactionToPrint] = useState(null);
    const [orderNotesByTable, setOrderNotesByTable] = useState(() => {
        return { "mostrador": "", "mesa1": "", "mesa2": "", "mesa3": "", "mesa4": "" };
    });
    const [customTotalsByTable, setCustomTotalsByTable] = useState(() => {
        const saved = localStorage.getItem(`pos_custom_totals_${currentMode}`);
        if (saved) return JSON.parse(saved);
        return { "mostrador": null, "mesa1": null, "mesa2": null, "mesa3": null, "mesa4": null };
    });
    const [loans, setLoans] = useState([]);

    // Real-time data sync from Firestore
    useEffect(() => {
        const unsubProducts = onSnapshot(collection(db, colName("products")), (snapshot) => {
            setProducts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        const unsubTransactions = onSnapshot(
            query(collection(db, colName("transactions")), orderBy("date", "desc")),
            (snapshot) => {
                setTransactions(snapshot.docs.map((d) => {
                    const data = d.data();
                    let formattedDate = data.date;
                    if (data.date && typeof data.date.toDate === "function") {
                        formattedDate = data.date.toDate().toISOString();
                    } else if (data.date && data.date.seconds) {
                        formattedDate = new Date(data.date.seconds * 1000).toISOString();
                    }
                    return {
                        id: d.id,
                        ...data,
                        date: formattedDate
                    };
                }));
            }
        );
        const unsubCategories = onSnapshot(collection(db, colName("categories")), (snapshot) => {
            setCategories(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        const unsubCustomers = onSnapshot(collection(db, colName("customers")), (snapshot) => {
            setCustomers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        const unsubPromotions = onSnapshot(collection(db, colName("promotions")), (snapshot) => {
            setPromotions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        const unsubVendedores = onSnapshot(collection(db, colName("vendedores")), (snapshot) => {
            setVendedores(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        const unsubPerformance = onSnapshot(
            query(collection(db, colName("dailyPerformance")), orderBy("date", "desc")),
            (snapshot) => {
                setPerformanceLogs(snapshot.docs.map((d) => {
                    const data = d.data();
                    return {
                        id: d.id,
                        ...data,
                        date: data.date?.toDate ? data.date.toDate().toISOString() : data.date
                    };
                }));
            }
        );
        const unsubPaymentMethods = onSnapshot(
            query(collection(db, colName("paymentMethods")), orderBy("order", "asc")),
            (snapshot) => {
                setPaymentMethods(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
            }
        );
        const unsubLoans = onSnapshot(collection(db, colName("loans")), (snapshot) => {
            setLoans(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });

        return () => {
            unsubProducts();
            unsubTransactions();
            unsubCategories();
            unsubCustomers();
            unsubPromotions();
            unsubVendedores();
            unsubPerformance();
            unsubPaymentMethods();
            unsubLoans();
        };
    }, []);

    useEffect(() => {
        localStorage.setItem(`pos_tables_state_${currentMode}`, JSON.stringify(tables));
    }, [tables, currentMode]);

    useEffect(() => {
        localStorage.setItem(`pos_custom_totals_${currentMode}`, JSON.stringify(customTotalsByTable));
    }, [customTotalsByTable, currentMode]);

    // Seed métodos de pago por defecto si la colección está vacía
    useEffect(() => {
        const seed = async () => {
            const snap = await getDocs(collection(db, colName("paymentMethods")));
            if (snap.empty) {
                const defaults = [
                    { name: "Efectivo", emoji: "💵", order: 1 },
                    { name: "Tarjeta", emoji: "💳", order: 2 },
                    { name: "Bre-B", emoji: "⚡", order: 3 },
                    { name: "Nequi", emoji: "📱", order: 4 },
                    { name: "Daviplata", emoji: "🏦", order: 5 },
                ];
                for (const pm of defaults) {
                    await addDoc(collection(db, colName("paymentMethods")), pm);
                }
            }
        };
        seed();
    }, [currentMode]);

    useEffect(() => {
        localStorage.setItem(`pos_customers_state_${currentMode}`, JSON.stringify(selectedCustomerIdByTable));
    }, [selectedCustomerIdByTable, currentMode]);

    useEffect(() => {
        if (selectedVendedor) {
            localStorage.setItem(`selectedVendedor_${currentMode}`, selectedVendedor);
        } else {
            localStorage.removeItem(`selectedVendedor_${currentMode}`);
        }
    }, [selectedVendedor, currentMode]);

    const activeCart = tables[activeTable] || [];
    const activeCustomerId = selectedCustomerIdByTable[activeTable] || "";

    const setActiveCustomerId = (id) => {
        setSelectedCustomerIdByTable(prev => ({
            ...prev,
            [activeTable]: id
        }));
    };
    const handleSelectCustomer = setActiveCustomerId;

    const activeOrderNotes = orderNotesByTable[activeTable] || "";
    const handleNotesChange = (val) => setOrderNotesByTable(prev => ({ ...prev, [activeTable]: val }));

    const handleAddToCart = (product) => {
        if (product.quantity <= 0) return;
        setTables((prevTables) => {
            const currentCart = prevTables[activeTable] || [];
            const existing = currentCart.find((item) => item.id === product.id);
            if (existing) {
                if (existing.cartQuantity < (products.find(p => p.id === product.id)?.quantity || 0)) {
                    return {
                        ...prevTables,
                        [activeTable]: currentCart.map((item) =>
                            item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item
                        )
                    };
                } else {
                    showToast("No hay más stock disponible", "warning");
                    return prevTables;
                }
            }
            return {
                ...prevTables,
                [activeTable]: [...currentCart, { ...product, cartQuantity: 1 }]
            };
        });
    };

    const handleUpdateQuantity = (id, delta) => {
        setTables((prevTables) => {
            const currentCart = prevTables[activeTable] || [];
            return {
                ...prevTables,
                [activeTable]: currentCart.map((item) => {
                    if (item.id === id) {
                        const newQty = item.cartQuantity + delta;
                        if (newQty <= 0) return item; // Handled by remove usually, but keep it safe
                        const stock = products.find(p => p.id === id)?.quantity || 0;
                        if (newQty > stock) {
                            showToast("No hay más stock disponible", "warning");
                            return item;
                        }
                        return { ...item, cartQuantity: newQty };
                    }
                    return item;
                })
            };
        });
    };

    const handleRemoveFromCart = (id) => {
        setTables((prevTables) => {
            const currentCart = prevTables[activeTable] || [];
            return {
                ...prevTables,
                [activeTable]: currentCart.filter((item) => item.id !== id)
            };
        });
    };

    const cartSubtotal = useMemo(() => {
        const activeCustomer = customers.find(c => c.id === activeCustomerId);
        const priceType = activeCustomer?.priceType || "special";
        return activeCart.reduce((acc, item) => {
            // Resolve price based on customer type
            let basePrice = item.price;
            if (activeCustomerId) {
                if (priceType === "wholesale" && item.wholesalePrice) {
                    basePrice = item.wholesalePrice;
                } else if (priceType === "special" && item.specialPrice) {
                    basePrice = item.specialPrice;
                }
            }

            // Apply Promotions
            const promo = promotions.find((p) => p.productId === item.id);
            if (promo && item.cartQuantity >= promo.quantity) {
                const promoCount = Math.floor(item.cartQuantity / promo.quantity);
                const extraCount = item.cartQuantity % promo.quantity;
                return acc + (promoCount * promo.price + extraCount * basePrice);
            }
            return acc + basePrice * item.cartQuantity;
        }, 0);
    }, [activeCart, promotions, activeCustomerId, customers]);

    const cartTotal = useMemo(() => {
        const customTotal = customTotalsByTable[activeTable];
        if (customTotal !== null && customTotal !== undefined && customTotal !== "") {
            return parseFloat(customTotal);
        }
        return cartSubtotal;
    }, [cartSubtotal, customTotalsByTable, activeTable]);

    const salesCount = useMemo(() => {
        const counts = {};
        transactions.forEach(t => {
            (t.items || []).forEach(item => {
                counts[item.id] = (counts[item.id] || 0) + (item.cartQuantity || 0);
            });
        });
        return counts;
    }, [transactions]);

    const handleCheckout = (customerName, vendedorName, paymentsOrMethod, notes) => {
        // paymentsOrMethod can be a string (legacy) or an array [{ method, amount }]
        const paymentsArray = Array.isArray(paymentsOrMethod)
            ? paymentsOrMethod
            : [{ method: paymentsOrMethod, amount: cartTotal }];
        const primaryMethod = paymentsArray[0]?.method || "Efectivo";
        try {
            const batch = writeBatch(db);
            const transRef = doc(collection(db, colName("transactions")));

            const isCustomTotal = customTotalsByTable[activeTable] !== null && customTotalsByTable[activeTable] !== undefined && customTotalsByTable[activeTable] !== "";
            const finalNotes = isCustomTotal
                ? (notes ? `${notes} (Descuento personalizado)` : "Descuento personalizado")
                : notes;

            batch.set(transRef, {
                date: new Date(),
                customerName: customerName || "General",
                vendedorName: vendedorName,
                paymentMethod: primaryMethod,
                payments: paymentsArray,
                notes: finalNotes || "",
                total: cartTotal,
                items: activeCart.map(item => {
                    const activeCustomer = customers.find(c => c.id === activeCustomerId);
                    const priceType = activeCustomer?.priceType || "special";
                    let basePrice = item.price;
                    if (activeCustomerId) {
                        if (priceType === "wholesale" && item.wholesalePrice) {
                            basePrice = item.wholesalePrice;
                        } else if (priceType === "special" && item.specialPrice) {
                            basePrice = item.specialPrice;
                        }
                    }
                    const promo = promotions.find(p => p.productId === item.id);
                    const subtotal = (() => {
                        if (promo && item.cartQuantity >= promo.quantity) {
                            const promoCount = Math.floor(item.cartQuantity / promo.quantity);
                            const extraCount = item.cartQuantity % promo.quantity;
                            return promoCount * promo.price + extraCount * basePrice;
                        }
                        return basePrice * item.cartQuantity;
                    })();
                    return { id: item.id, name: item.name, price: basePrice, cartQuantity: item.cartQuantity, subtotal };
                })
            });

            // Update product quantities in the same batch
            activeCart.forEach(item => {
                const prodRef = doc(db, colName("products"), item.id);
                const currentQty = products.find(p => p.id === item.id)?.quantity || 0;
                batch.update(prodRef, {
                    quantity: currentQty - item.cartQuantity
                });
            });

            // Ejecutamos el commit pero NO lo esperamos (permitiendo funcionamiento offline instantáneo)
            batch.commit().catch(err => {
                console.error("Error en la sincronización diferida:", err);
                showToast("Error crítico al sincronizar datos", "error");
            });

            // Limpieza inmediata de la interfaz
            setTables(prev => ({
                ...prev,
                [activeTable]: []
            }));
            setSelectedCustomerIdByTable(prev => ({
                ...prev,
                [activeTable]: ""
            }));
            setOrderNotesByTable(prev => ({
                ...prev,
                [activeTable]: ""
            }));
            setCustomTotalsByTable(prev => ({
                ...prev,
                [activeTable]: null
            }));

            showToast(`Compra procesada por ${vendedorName}`, "success");
        } catch (err) {
            console.error("Error local al procesar compra:", err);
            showToast("Error al procesar la compra", "error");
        }
    };

    const handleSaveLoan = async (customerName, vendedorName, notes) => {
        if (!activeCustomerId || customerName === "General") {
            showToast("Debe seleccionar un cliente para usar créditos", "warning");
            return;
        }

        try {
            const customerId = activeCustomerId;
            const existingLoan = loans.find(l => l.customerId === customerId);
            const batch = writeBatch(db);

            const newItems = activeCart.map(item => ({
                id: item.id,
                name: item.name,
                price: item.specialPrice || item.price,
                cartQuantity: item.cartQuantity,
                dateAdded: new Date().toISOString()
            }));

            if (existingLoan) {
                const loanRef = doc(db, colName("loans"), existingLoan.id);
                // Merge items: if product exists, add quantity; if not, add item
                const mergedItems = [...(existingLoan.items || [])];
                newItems.forEach(newItem => {
                    const idx = mergedItems.findIndex(mi => mi.id === newItem.id);
                    if (idx > -1) {
                        mergedItems[idx].cartQuantity += newItem.cartQuantity;
                    } else {
                        mergedItems.push(newItem);
                    }
                });

                batch.update(loanRef, {
                    items: mergedItems,
                    lastUpdated: new Date(),
                    vendedorName: vendedorName, // Update to last seller
                    notes: notes || existingLoan.notes || ""
                });
            } else {
                const loanRef = doc(collection(db, colName("loans")));
                batch.set(loanRef, {
                    customerId,
                    customerName,
                    vendedorName,
                    items: newItems,
                    notes: notes || "",
                    createdAt: new Date(),
                    lastUpdated: new Date()
                });
            }

            // Update product quantities (deduct from stock)
            activeCart.forEach(item => {
                const prodRef = doc(db, colName("products"), item.id);
                const currentQty = products.find(p => p.id === item.id)?.quantity || 0;
                batch.update(prodRef, {
                    quantity: currentQty - item.cartQuantity
                });
            });

            await batch.commit();

            // Clear cart
            setTables(prev => ({ ...prev, [activeTable]: [] }));
            setSelectedCustomerIdByTable(prev => ({ ...prev, [activeTable]: "" }));
            setOrderNotesByTable(prev => ({ ...prev, [activeTable]: "" }));

            showToast(`Cuenta enviada a créditos (${customerName})`, "success");
        } catch (err) {
            console.error("Error saving loan:", err);
            showToast("Error al guardar el crédito", "error");
        }
    };

    const handleLoanPayment = async (loanId, paymentItems, paymentMethod, vendedorName, amount) => {
        try {
            const loan = loans.find(l => l.id === loanId);
            if (!loan) return;

            const batch = writeBatch(db);

            // 1. Record Transaction with specific items paid
            const transactionData = {
                date: new Date().toISOString(),
                customerName: loan.customerName,
                vendedorName: vendedorName,
                paymentMethod: paymentMethod,
                total: amount,
                items: paymentItems,
                type: "abono",
                loanId: loanId,
                notes: `Pago de productos específicos de deuda. Cliente: ${loan.customerName}`
            };
            batch.set(doc(collection(db, colName("transactions"))), transactionData);

            // 2. Update Loan Items
            const loanRef = doc(db, colName("loans"), loanId);
            const remainingItems = [];

            // Map current items and subtract paid ones
            const currentItems = loan.items || [];
            currentItems.forEach(item => {
                const paidItem = paymentItems.find(p => p.id === item.id);
                if (paidItem) {
                    const newQty = item.cartQuantity - paidItem.cartQuantity;
                    if (newQty > 0) {
                        remainingItems.push({ ...item, cartQuantity: newQty });
                    }
                } else {
                    remainingItems.push(item);
                }
            });

            if (remainingItems.length === 0) {
                batch.delete(loanRef);
                showToast(`Deuda de ${loan.customerName} saldada totalmente`, "success");
            } else {
                batch.update(loanRef, {
                    items: remainingItems,
                    lastUpdated: new Date()
                });
                showToast("Pago de productos registrado", "success");
            }

            await batch.commit();
        } catch (err) {
            console.error(err);
            showToast("Error al procesar el pago", "error");
        }
    };

    const handleImportXlsx = async (data) => {
        try {
            const batch = writeBatch(db);
            let importedCount = 0;
            let updatedCount = 0;
            const newCategoriesMap = {}; // Track categories created in this batch

            for (const item of data) {
                // Find or create category
                let categoryId = "";
                const categoryName = (item.Categoría || "General").trim();
                const categoryNameLower = categoryName.toLowerCase();
                
                const existingCat = categories.find(c => c.name.toLowerCase() === categoryNameLower);
                
                if (existingCat) {
                    categoryId = existingCat.id;
                } else if (newCategoriesMap[categoryNameLower]) {
                    categoryId = newCategoriesMap[categoryNameLower];
                } else {
                    const catRef = doc(collection(db, colName("categories")));
                    batch.set(catRef, { name: categoryName, createdAt: new Date() });
                    categoryId = catRef.id;
                    newCategoriesMap[categoryNameLower] = categoryId;
                }

                const productName = (item.Nombre || "").trim();
                if (!productName) continue;

                const existingProd = products.find(p => p.name.toLowerCase() === productName.toLowerCase());
                const price = parseFloat(item.Precio || 0);
                const qty = parseInt(item.Cantidad || 0);
                const specialPrice = item["Precio Especial"] ? parseFloat(item["Precio Especial"]) : null;
                const wholesalePrice = item["Precio Mayorista"] ? parseFloat(item["Precio Mayorista"]) : null;

                if (existingProd) {
                    const prodRef = doc(db, colName("products"), existingProd.id);
                    batch.update(prodRef, {
                        price,
                        quantity: qty, // Reemplazar cantidad en lugar de sumar
                        specialPrice,
                        wholesalePrice,
                        categoryId,
                        lastUpdated: new Date()
                    });
                    updatedCount++;
                } else {
                    const prodRef = doc(collection(db, colName("products")));
                    batch.set(prodRef, {
                        name: productName,
                        price,
                        quantity: qty,
                        specialPrice,
                        wholesalePrice,
                        categoryId,
                        image: "",
                        createdAt: new Date()
                    });
                    importedCount++;
                }
            }

            await batch.commit();
            showToast(`Importación exitosa: ${importedCount} nuevos, ${updatedCount} actualizados`, "success");
        } catch (err) {
            console.error("XLSX Import Error:", err);
            showToast("Error al importar productos", "error");
        }
    };

    const handlePrint = (transaction) => {
        if (!transaction) return;
        setTransactionToPrint(transaction);
        // Aumentamos ligeramente el timeout para asegurar el renderizado de los productos
        setTimeout(() => {
            window.print();
        }, 300);
    };

    // Inventory Handlers
    const handleAddProduct = (prod) => {
        addDoc(collection(db, colName("products")), prod).catch(err => console.error("Error add prod:", err));
    };
    const handleDeleteProduct = async (id) => {
        try {
            const batch = writeBatch(db);
            // Delete product
            batch.delete(doc(db, colName("products"), id));
            // Find and delete associated promotions
            promotions.filter(p => p.productId === id).forEach(p => {
                batch.delete(doc(db, colName("promotions"), p.id));
            });
            await batch.commit();
            showToast("Producto y promociones asociadas eliminados", "success");
        } catch (err) {
            console.error("Error delete prod + promos:", err);
            showToast("Error al eliminar producto", "error");
        }
    };
    const handleUpdateProduct = (id, updatedData) => {
        updateDoc(doc(db, colName("products"), id), updatedData).catch(err => console.error("Error update prod:", err));
    };
    const handleAddCategory = (name) => {
        addDoc(collection(db, colName("categories")), { name }).catch(err => console.error("Error add cat:", err));
    };
    const handleDeleteCategory = (id) => {
        deleteDoc(doc(db, colName("categories"), id)).catch(err => console.error("Error delete cat:", err));
    };
    const handleAddCustomer = (name, priceType = "special") => {
        addDoc(collection(db, colName("customers")), { name, priceType }).catch(err => console.error("Error add cust:", err));
    };
    const handleDeleteCustomer = (id) => {
        deleteDoc(doc(db, colName("customers"), id)).catch(err => console.error("Error delete cust:", err));
    };
    const handleAddPromotion = (promo) => {
        addDoc(collection(db, colName("promotions")), promo).catch(err => console.error("Error add promo:", err));
    };
    const handleDeletePromotion = async (id) => {
        try {
            await deleteDoc(doc(db, colName("promotions"), id));
            showToast("Promoción eliminada", "success");
        } catch (err) {
            console.error("Error delete promo:", err);
            showToast("Error al eliminar la promoción", "error");
        }
    };
    const handleAddVendedor = (name) => {
        addDoc(collection(db, colName("vendedores")), { name }).catch(err => console.error("Error add vend:", err));
    };
    const handleDeleteVendedor = (id) => {
        deleteDoc(doc(db, colName("vendedores"), id)).catch(err => console.error("Error delete vend:", err));
    };

    const handleSavePerformance = async (data) => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Find ALL logs for today (in case there are duplicates)
            const todayLogs = performanceLogs.filter(log => {
                const d = new Date(log.date);
                d.setHours(0, 0, 0, 0);
                return d.getTime() === today.getTime();
            });

            if (todayLogs.length > 0) {
                const batch = writeBatch(db);
                // We'll merge everything into the FIRST log found
                const targetLog = todayLogs[0];
                const logRef = doc(db, "dailyPerformance", targetLog.id);

                const mergedData = {
                    expectedTotal: (targetLog.expectedTotal || 0),
                    realTotal: (targetLog.realTotal || 0),
                    difference: (targetLog.difference || 0),
                    productsSold: (targetLog.productsSold || 0),
                    notes: targetLog.notes || "",
                    paymentMethodTotals: { ...(targetLog.paymentMethodTotals || {}) },
                    perMethodStats: { ...(targetLog.perMethodStats || {}) },
                    date: new Date() // Set to now to reset "Expected" in DailyPerformance
                };

                // Merge other existing logs if they exist (clean up duplicates)
                for (let i = 1; i < todayLogs.length; i++) {
                    const other = todayLogs[i];
                    mergedData.expectedTotal += (other.expectedTotal || 0);
                    mergedData.realTotal += (other.realTotal || 0);
                    mergedData.difference += (other.difference || 0);
                    mergedData.productsSold += (other.productsSold || 0);
                    if (other.notes) {
                        mergedData.notes = mergedData.notes ? `${mergedData.notes} | ${other.notes}` : other.notes;
                    }
                    Object.entries(other.paymentMethodTotals || {}).forEach(([m, v]) => {
                        mergedData.paymentMethodTotals[m] = (mergedData.paymentMethodTotals[m] || 0) + v;
                    });
                    Object.entries(other.perMethodStats || {}).forEach(([m, s]) => {
                        if (mergedData.perMethodStats[m]) {
                            mergedData.perMethodStats[m].expected = (mergedData.perMethodStats[m].expected || 0) + (s.expected || 0);
                            mergedData.perMethodStats[m].real = (mergedData.perMethodStats[m].real || 0) + (s.real || 0);
                            mergedData.perMethodStats[m].diff = (mergedData.perMethodStats[m].diff || 0) + (s.diff || 0);
                        } else {
                            mergedData.perMethodStats[m] = s;
                        }
                    });
                    batch.delete(doc(db, colName("dailyPerformance"), other.id));
                }

                // Finally merge the NEW data from the form
                mergedData.expectedTotal += (data.expectedTotal || 0);
                mergedData.realTotal += (data.realTotal || 0);
                mergedData.difference += (data.difference || 0);
                mergedData.productsSold += (data.productsSold || 0);
                if (data.notes) {
                    mergedData.notes = mergedData.notes ? `${mergedData.notes} | ${data.notes}` : data.notes;
                }
                Object.entries(data.paymentMethodTotals || {}).forEach(([m, v]) => {
                    mergedData.paymentMethodTotals[m] = (mergedData.paymentMethodTotals[m] || 0) + v;
                });
                Object.entries(data.perMethodStats || {}).forEach(([m, s]) => {
                    if (mergedData.perMethodStats[m]) {
                        mergedData.perMethodStats[m].expected = (mergedData.perMethodStats[m].expected || 0) + (s.expected || 0);
                        mergedData.perMethodStats[m].real = (mergedData.perMethodStats[m].real || 0) + (s.real || 0);
                        mergedData.perMethodStats[m].diff = (mergedData.perMethodStats[m].diff || 0) + (s.diff || 0);
                    } else {
                        mergedData.perMethodStats[m] = s;
                    }
                });

                batch.update(logRef, mergedData);
                await batch.commit();
                showToast("Cierre diario actualizado y unido", "success");
            } else {
                await addDoc(collection(db, colName("dailyPerformance")), {
                    ...data,
                    date: new Date()
                });
                showToast("Rendimiento diario guardado", "success");
            }
        } catch (err) {
            console.error("Error saving performance:", err);
            showToast("Error al guardar rendimiento", "error");
        }
    };

    const handleJumpToHistory = (date) => {
        setHistoryFilter({ dateRange: [new Date(date), new Date(date)] });
        setActiveTab("history");
    };
    const handleAddPaymentMethod = ({ name, emoji }) => {
        const order = paymentMethods.length + 1;
        addDoc(collection(db, colName("paymentMethods")), { name, emoji, order }).catch(err => console.error("Error add PM:", err));
    };
    const handleDeletePaymentMethod = (id) => {
        deleteDoc(doc(db, colName("paymentMethods"), id)).catch(err => console.error("Error delete PM:", err));
    };

    const handleResetTransactions = () => {
        try {
            const batch = writeBatch(db);
            transactions.forEach((t) => {
                batch.delete(doc(db, colName("transactions"), t.id));
            });
            batch.commit().catch(err => console.error("Error reset trans:", err));
            showToast("Historial de ventas eliminado", "success");
        } catch (err) {
            showToast("Error al eliminar historial", "error");
        }
    };

    const handleResetPerformance = async () => {
        try {
            const batch = writeBatch(db);
            performanceLogs.forEach((log) => {
                batch.delete(doc(db, colName("dailyPerformance"), log.id));
            });
            await batch.commit();
            showToast("Historial de rendimiento eliminado", "success");
        } catch (err) {
            showToast("Error al eliminar historial de rendimiento", "error");
        }
    };

    const handleAddDemoProducts = async () => {
        try {
            const demos = [
                { name: "Cappuccino Especial", categoryId: categories[0]?.id || "", price: 8500, specialPrice: 7500, quantity: 20, image: "https://images.unsplash.com/photo-1534778101976-62847782c213?w=500&q=80" },
                { name: "Hamburguesa Gourmet", categoryId: categories[0]?.id || "", price: 22000, specialPrice: 19500, quantity: 15, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80" },
                { name: "Jugo de Naranja Natural", categoryId: categories[0]?.id || "", price: 6000, specialPrice: 5000, quantity: 30, image: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&q=80" },
                { name: "Torta de Chocolate", categoryId: categories[0]?.id || "", price: 12000, specialPrice: 10000, quantity: 10, image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&q=80" },
                { name: "Sándwich de Pollo", categoryId: categories[0]?.id || "", price: 15000, specialPrice: 13000, quantity: 12, image: "https://images.unsplash.com/photo-1521390188846-e2a3a97453a0?w=500&q=80" },
            ];
            for (const prod of demos) {
                await addDoc(collection(db, colName("products")), prod);
            }
            showToast("Productos de prueba creados", "success");
        } catch (err) {
            showToast("Error al crear productos demo", "error");
        }
    };

    if (!isAuthenticated) {
        return (
            <Login
                onLogin={(mode) => {
                    setCurrentMode(mode);
                    setIsAuthenticated(true);
                    localStorage.setItem("pos_mode", mode);
                    localStorage.setItem(`pos_authenticated_${mode}`, "true");
                }}
            />
        );
    }

    return (
        <div className="app">
            <header>
                <div className="header-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <img src="logo.png" alt="Hemma Logo" style={{ height: '45px', objectFit: 'contain' }} />
                        <h1 style={{ margin: 0 }}>HEMMA</h1>
                        {currentMode === "demo" && (
                            <span style={{
                                background: "#ff9800",
                                color: "white",
                                padding: "0.2rem 0.6rem",
                                borderRadius: "4px",
                                fontSize: "0.8rem",
                                fontWeight: "bold"
                            }}>
                                MODO DEMO
                            </span>
                        )}
                    </div>
                    <button
                        className="logout-button"
                        onClick={() => {
                            setIsAuthenticated(false);
                            localStorage.removeItem(`pos_authenticated_${currentMode}`);
                        }}
                    >
                        Cerrar Sesión
                    </button>
                </div>
                <nav>
                    <button className={activeTab === "pos" ? "active" : ""} onClick={() => setActiveTab("pos")}>
                        Caja (POS)
                    </button>
                    <button className={activeTab === "inventory" ? "active" : ""} onClick={() => setActiveTab("inventory")}>
                        Inventario
                    </button>
                    <button className={activeTab === "performance" ? "active" : ""} onClick={() => setActiveTab("performance")}>
                        Rendimiento
                    </button>
                    <button className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}>
                        Ventas
                    </button>
                    <button className={activeTab === "loans" ? "active" : ""} onClick={() => setActiveTab("loans")}>
                        Créditos
                    </button>
                    <button className={activeTab === "ajustes" ? "active" : ""} onClick={() => setActiveTab("ajustes")}>
                        Ajustes
                    </button>
                </nav>
            </header>

            <main className="container">
                {activeTab === "pos" && (
                    <div className="pos-wrapper">
                        <div style={{
                            display: "flex",
                            gap: "0.5rem",
                            marginBottom: "1rem",
                            overflowX: "auto",
                            paddingBottom: "0.5rem"
                        }}>
                            {[
                                { id: "mostrador", label: <><SafeEmoji emoji="🏢" /> Mostrador</> },
                                { id: "mesa1", label: <><SafeEmoji emoji="🍽️" /> Mesa 1</> },
                                { id: "mesa2", label: <><SafeEmoji emoji="🍽️" /> Mesa 2</> },
                                { id: "mesa3", label: <><SafeEmoji emoji="🍽️" /> Mesa 3</> },
                                { id: "mesa4", label: <><SafeEmoji emoji="🍽️" /> Mesa 4</> }
                            ].map(table => (
                                <button
                                    key={table.id}
                                    className={activeTable === table.id ? "primary" : "secondary"}
                                    onClick={() => setActiveTable(table.id)}
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        minWidth: "120px",
                                        padding: "0.8rem",
                                        position: "relative"
                                    }}
                                >
                                    <span style={{ fontWeight: "bold" }}>{table.label}</span>
                                    <span style={{ fontSize: "0.8rem", opacity: 0.9 }}>
                                        {tables[table.id] && tables[table.id].length > 0
                                            ? `${tables[table.id].length} items`
                                            : "Libre"
                                        }
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="pos-container">
                            {(() => {
                                const activeCustomer = customers.find(c => c.id === activeCustomerId);
                                const activeCustomerPriceType = activeCustomer?.priceType || "special";
                                return (
                                    <ProductCatalog
                                        products={products}
                                        categories={categories}
                                        selectedCustomerId={activeCustomerId}
                                        customerPriceType={activeCustomerPriceType}
                                        onAddToCart={handleAddToCart}
                                        salesCount={salesCount}
                                    />
                                );
                            })()}
                            <Cart
                                cart={activeCart}
                                total={cartTotal}
                                products={products}
                                customers={customers}
                                promotions={promotions}
                                selectedCustomerId={activeCustomerId}
                                onSelectCustomer={handleSelectCustomer}
                                onRemoveFromCart={handleRemoveFromCart}
                                onUpdateQuantity={handleUpdateQuantity}
                                onCheckout={handleCheckout}
                                vendedores={vendedores}
                                selectedVendedorName={selectedVendedor}
                                onSelectVendedor={setSelectedVendedor}
                                onPrint={handlePrint}
                                orderNotes={activeOrderNotes}
                                onNotesChange={handleNotesChange}
                                customTotal={customTotalsByTable[activeTable]}
                                onCustomTotalChange={(val) => setCustomTotalsByTable(prev => ({ ...prev, [activeTable]: val }))}
                                paymentMethods={paymentMethods}
                                onSaveLoan={handleSaveLoan}
                                splitPaymentEnabled={splitPaymentEnabled}
                            />
                        </div>
                    </div>
                )}

                {activeTab === "loans" && (
                    <Loans
                        loans={loans}
                        onLoanPayment={handleLoanPayment}
                        paymentMethods={paymentMethods}
                        vendedores={vendedores}
                    />
                )}
                {activeTab === "inventory" && (
                    <Inventory
                        products={products}
                        categories={categories}
                        promotions={promotions}
                        onAddProduct={handleAddProduct}
                        onUpdateProduct={handleUpdateProduct}
                        onDeleteProduct={handleDeleteProduct}
                        onAddCategory={handleAddCategory}
                        onDeleteCategory={handleDeleteCategory}
                        onAddPromotion={handleAddPromotion}
                        onDeletePromotion={handleDeletePromotion}
                        onImportXlsx={handleImportXlsx}
                    />
                )}
                {activeTab === "performance" && (
                    <DailyPerformance
                        transactions={transactions}
                        logs={performanceLogs}
                        onSave={handleSavePerformance}
                        onViewDetails={handleJumpToHistory}
                        paymentMethods={paymentMethods}
                    />
                )}
                {activeTab === "history" && (
                    <SalesHistory
                        transactions={transactions}
                        vendedores={vendedores}
                        initialFilters={historyFilter}
                        onClearInitialFilters={() => setHistoryFilter(null)}
                        onPrint={handlePrint}
                    />
                )}
                {activeTab === "ajustes" && (
                    <Ajustes
                        customers={customers}
                        onAddCustomer={handleAddCustomer}
                        onDeleteCustomer={handleDeleteCustomer}
                        vendedores={vendedores}
                        onAddVendedor={handleAddVendedor}
                        onDeleteVendedor={handleDeleteVendedor}
                        paymentMethods={paymentMethods}
                        onAddPaymentMethod={handleAddPaymentMethod}
                        onDeletePaymentMethod={handleDeletePaymentMethod}
                        onResetAllData={handleResetTransactions}
                        onResetPerformanceData={handleResetPerformance}
                        onAddDemoProducts={handleAddDemoProducts}
                        splitPaymentEnabled={splitPaymentEnabled}
                        onToggleSplitPayment={handleToggleSplitPayment}
                    />
                )}
            </main>

            {/* Componente de Recibo (Oculto en pantalla para no interferir, pero disponible para impresión) */}
            <div className="receipt-container-hidden">
                <Receipt transaction={transactionToPrint} />
            </div>
        </div>
    );
}

export default App;
