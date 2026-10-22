import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import QRCode from "qrcode";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import "./App.css";
import AuthPage from "./auth/AuthPage";

const API_URL = "http://localhost:5000/api/products";
const SALES_URL = "http://localhost:5000/api/sales";
const DASHBOARD_URL = "http://localhost:5000/api/dashboard";
const ANALYTICS_URL = "http://localhost:5000/api/analytics";
const TAX_RATE = 0.05;

// Attach the logged-in user's token to POS API requests.
function apiFetch(url, options = {}) {
  const token = localStorage.getItem("posToken");
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function dateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const emptyProduct = {
  barcode: "",
  name: "",
  category: "",
  price: "",
  stock: "",
};

function POSApp({ user, onLogout }) {
  const [page, setPage] = useState(
    window.location.pathname === "/checkout" ? "checkout" : window.location.pathname === "/dashboard" ? "dashboard" : "inventory"
  );

  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [reportStartDate, setReportStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return dateForInput(date);
  });
  const [reportEndDate, setReportEndDate] = useState(() => dateForInput(new Date()));
  const [salesReport, setSalesReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [completedReceipt, setCompletedReceipt] = useState(null);
  const barcodeInputRef = useRef(null);
  const qrScannerRef = useRef(null);
  const lastScannedRef = useRef({ value: "", time: 0 });

  const [showQrScanner, setShowQrScanner] = useState(false);
  const [scannerMessage, setScannerMessage] = useState("");
  const [qrCodeProduct, setQrCodeProduct] = useState(null);
  const [qrCodeImage, setQrCodeImage] = useState("");

  async function loadProducts() {
    setLoading(true);

    try {
      const response = await apiFetch(API_URL);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load products");
      }

      setProducts(data.products);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
    if (window.location.pathname === "/dashboard") {
      loadDashboard();
      loadAnalytics();
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setPage(
        window.location.pathname === "/checkout"
          ? "checkout"
          : window.location.pathname === "/dashboard"
          ? "dashboard"
          : "inventory"
      );
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  function navigate(nextPage) {
    const path =
      nextPage === "checkout"
        ? "/checkout"
        : nextPage === "dashboard"
        ? "/dashboard"
        : "/";
    window.history.pushState({}, "", path);
    setPage(nextPage);
    setError("");
    setMessage("");

    if (nextPage === "checkout") {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
    if (nextPage === "dashboard") {
      loadDashboard();
      loadAnalytics();
    }
  }

  async function loadAnalytics() {
    setAnalyticsLoading(true);
    setAnalyticsError("");

    try {
      const response = await apiFetch(ANALYTICS_URL);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load sales analytics");
      }

      setAnalyticsData(data);
    } catch (err) {
      setAnalyticsError(err.message || "Could not load sales analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function generateSalesReport(event) {
    event.preventDefault();
    setReportError("");
    setSalesReport(null);

    if (!reportStartDate || !reportEndDate) {
      setReportError("Please select both report dates.");
      return;
    }

    if (reportStartDate > reportEndDate) {
      setReportError("Start date must be on or before the end date.");
      return;
    }

    setReportLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: reportStartDate,
        endDate: reportEndDate,
      });
      const response = await apiFetch(`${ANALYTICS_URL}/report?${params.toString()}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not generate sales report");
      }

      setSalesReport(data);
    } catch (err) {
      setReportError(err.message || "Could not generate sales report");
    } finally {
      setReportLoading(false);
    }
  }

  async function loadDashboard() {
    setDashboardLoading(true);
    setDashboardError("");

    try {
      const response = await apiFetch(DASHBOARD_URL);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load dashboard");
      }

      setDashboardData(data);
    } catch (err) {
      setDashboardError(err.message || "Could not load dashboard data");
    } finally {
      setDashboardLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyProduct);
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function openEditForm(product) {
    setEditingId(product._id);

    setForm({
      barcode: product.barcode,
      name: product.name,
      category: product.category,
      price: String(product.price),
      stock: String(product.stock),
    });

    setError("");
    setMessage("");
    setShowForm(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.barcode.trim() || !form.name.trim() || !form.category.trim()) {
      setError("Barcode, product name and category are required.");
      return;
    }

    if (
      form.price.trim() === "" ||
      !Number.isFinite(Number(form.price)) ||
      Number(form.price) < 0
    ) {
      setError("Enter a valid non-negative price.");
      return;
    }

    if (
      form.stock.trim() === "" ||
      !Number.isInteger(Number(form.stock)) ||
      Number(form.stock) < 0
    ) {
      setError("Stock must be a non-negative whole number.");
      return;
    }

    setSaving(true);

    try {
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;

      const response = await apiFetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: form.barcode.trim(),
          name: form.name.trim(),
          category: form.category.trim(),
          price: Number(form.price),
          stock: Number(form.stock),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save product");
      }

      setShowForm(false);
      setForm(emptyProduct);
      setEditingId(null);
      setMessage(editingId ? "Product updated successfully!" : "Product added successfully!");

      await loadProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete "${product.name}"?`)) return;

    try {
      const response = await apiFetch(`${API_URL}/${product._id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete product");
      }

      setMessage(`${product.name} deleted successfully!`);
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  function addToCart(product) {
    if (product.stock < 1) {
      setError(`${product.name} is out of stock.`);
      return;
    }

    setCart((previous) => {
      const existing = previous.find((item) => item._id === product._id);

      if (existing) {
        if (existing.quantity >= product.stock) {
          setError(`Only ${product.stock} unit(s) of ${product.name} are available.`);
          return previous;
        }

        return previous.map((item) =>
          item._id === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...previous, { ...product, quantity: 1 }];
    });

    setMessage(`${product.name} added to cart.`);
    setError("");
  }

  async function handleBarcodeSubmit(event) {
    event.preventDefault();

    const scannedBarcode = barcode.trim();

    if (!scannedBarcode) return;

    try {
      const response = await apiFetch(
        `${API_URL}/barcode/${encodeURIComponent(scannedBarcode)}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Product not found.");
      }

      addToCart(data.product);
      setBarcode("");
      barcodeInputRef.current?.focus();
    } catch (err) {
      setError(err.message);
      setBarcode("");
      barcodeInputRef.current?.focus();
    }
  }
  async function stopQrScanner() {
  const scanner = qrScannerRef.current;

  if (scanner) {
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch (error) {
      console.error("Could not stop QR scanner:", error);
    }

    try {
      scanner.clear();
    } catch (error) {
      console.error("Could not clear QR scanner:", error);
    }

    qrScannerRef.current = null;
  }

  setShowQrScanner(false);
}

async function startQrScanner() {
  setError("");
  setMessage("");
  setScannerMessage("Starting camera...");

  try {
    await stopQrScanner();

    setShowQrScanner(true);

    // Allow React to render the scanner container.
    await new Promise((resolve) => setTimeout(resolve, 150));

    const scanner = new Html5Qrcode("pos-qr-reader");
    qrScannerRef.current = scanner;

    await scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1,
      },
      async (decodedText) => {
        const now = Date.now();

        // Prevent repeated additions while the same QR code remains visible.
        if (
          lastScannedRef.current.value === decodedText &&
          now - lastScannedRef.current.time < 2000
        ) {
          return;
        }

        lastScannedRef.current = {
          value: decodedText,
          time: now,
        };

        setScannerMessage(`QR detected: ${decodedText}`);

        // This QR code must contain a product barcode.
        const scannedBarcode = decodedText.trim();

        try {
          const response = await apiFetch(
            `${API_URL}/barcode/${encodeURIComponent(scannedBarcode)}`
          );

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(
              data.message || "No product matches this QR code."
            );
          }

          addToCart(data.product);
          setScannerMessage(`${data.product.name} scanned successfully.`);
        } catch (error) {
          setError(error.message || "Unable to find the scanned product.");
        }
      },
      () => {
        // Ignore individual camera-frame decode failures.
      }
    );

    setScannerMessage("Camera ready. Point it at a product QR code.");
  } catch (error) {
    console.error("QR scanner error:", error);

    setScannerMessage(
      "Unable to start the camera. Allow camera access and try again."
    );

    await stopQrScanner();
  }
}

async function generateProductQr(product) {
  try {
    const image = await QRCode.toDataURL(String(product.barcode), {
      width: 300,
      margin: 2,
      errorCorrectionLevel: "M",
    });

    setQrCodeProduct(product);
    setQrCodeImage(image);
  } catch (error) {
    setError("Could not generate the product QR code.");
  }
}

  function changeQuantity(productId, delta) {
    setCart((previous) =>
      previous
        .map((item) => {
          if (item._id !== productId) return item;

          const newQuantity = item.quantity + delta;

          if (newQuantity < 1) return item;

          if (newQuantity > item.stock) {
            setError(`Only ${item.stock} unit(s) are available.`);
            return item;
          }

          return { ...item, quantity: newQuantity };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId) {
    setCart((previous) => previous.filter((item) => item._id !== productId));
  }

  const subtotal = cart.reduce(
    (total, item) => total + Math.round(item.price * 100) * item.quantity,
    0
  ) / 100;

  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  async function completeCheckout() {
    if (cart.length === 0) {
      setError("Scan or add at least one product before checkout.");
      return;
    }

    setCheckoutBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(`${SALES_URL}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item._id,
            quantity: item.quantity,
          })),
          paymentMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Checkout failed");
      }

      setCart([]);
setCompletedReceipt(data.sale);

setMessage(
  `Sale completed! Receipt: ${data.sale._id} | Total: ₹${Number(data.sale.total).toFixed(2)}`
);

      await loadProducts();
      barcodeInputRef.current?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setCheckoutBusy(false);
    }
  }

  const filteredProducts = products.filter((product) => {
    const query = search.toLowerCase().trim();

    return (
      product.name.toLowerCase().includes(query) ||
      product.barcode.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query)
    );
  });

  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);

  const inventoryValue = products.reduce(
    (sum, product) => sum + product.price * product.stock,
    0
  );

  const money = (value) =>
    value.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
    });

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">▦</span>
          <div>
            <h2>POS-Sync</h2>
            <p>Inventory & Checkout</p>
          </div>
        </div>

        <nav className="navigation">
          <button
            className={`nav-item ${page === "inventory" ? "active" : ""}`}
            onClick={() => navigate("inventory")}
          >
            <span>▦</span> Inventory
          </button>

          <button
            className={`nav-item ${page === "checkout" ? "active" : ""}`}
            onClick={() => navigate("checkout")}
          >
            <span>▣</span> Barcode Checkout
          </button>

          <button
            className={`nav-item ${page === "dashboard" ? "active" : ""}`}
            onClick={() => navigate("dashboard")}
          >
            <span>▤</span> Sales Dashboard
          </button>
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot"></span>
          MongoDB inventory
          <div style={{ marginTop: "12px", width: "100%" }}>
            <div style={{ fontSize: "12px", marginBottom: "8px", overflowWrap: "anywhere" }}>
              Signed in as {user?.name || user?.email || "Administrator"}
            </div>
            <button className="secondary-button" style={{ width: "100%" }} onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {page === "inventory"
                ? "INVENTORY MANAGEMENT"
                : page === "checkout"
                ? "POINT OF SALE"
                : "BUSINESS OVERVIEW"}
            </p>
            <h1>
              {page === "inventory"
                ? "Product Inventory"
                : page === "checkout"
                ? "Barcode Checkout"
                : "Sales Dashboard"}
            </h1>
            <p className="subtitle">
              {page === "inventory"
                ? "Manage products, barcodes, prices and stock levels."
                : page === "checkout"
                ? "Scan products, manage your cart and complete sales."
                : "Monitor today's sales, recent transactions and low-stock products."}
            </p>
          </div>

          {page === "inventory" && (
            <button className="primary-button" onClick={openAddForm}>
              + Add Product
            </button>
          )}
          {page === "dashboard" && (
            <button className="primary-button" onClick={loadDashboard} disabled={dashboardLoading}>
              {dashboardLoading ? "Refreshing..." : "↻ Refresh Dashboard"}
            </button>
          )}
        </header>

        {message && (
          <div className="alert success-alert">
            {message}
            <button onClick={() => setMessage("")}>×</button>
          </div>
        )}

        {error && (
          <div className="alert error-alert">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        {page === "inventory" ? (
          <>
            <section className="stats-grid">
              <article className="stat-card">
                <span className="stat-icon blue">▦</span>
                <div>
                  <p>Total Products</p>
                  <h2>{products.length}</h2>
                </div>
              </article>

              <article className="stat-card">
                <span className="stat-icon green">▤</span>
                <div>
                  <p>Total Units in Stock</p>
                  <h2>{totalStock}</h2>
                </div>
              </article>

              <article className="stat-card">
                <span className="stat-icon purple">₹</span>
                <div>
                  <p>Inventory Value</p>
                  <h2>{money(inventoryValue)}</h2>
                </div>
              </article>
            </section>

            {showForm && (
              <section className="panel form-panel">
                <div className="panel-heading">
                  <div>
                    <h2>{editingId ? "Edit Product" : "Add New Product"}</h2>
                    <p>Enter product details and its unique barcode.</p>
                  </div>

                  <button
                    className="icon-button"
                    onClick={() => setShowForm(false)}
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="form-grid">
                    <label>
                      Product Name
                      <input name="name" value={form.name} onChange={handleChange} required />
                    </label>

                    <label>
                      Barcode
                      <input name="barcode" value={form.barcode} onChange={handleChange} required />
                    </label>

                    <label>
                      Category
                      <input name="category" value={form.category} onChange={handleChange} required />
                    </label>

                    <label>
                      Price (₹)
                      <input name="price" type="number" min="0" step="0.01" value={form.price} onChange={handleChange} required />
                    </label>

                    <label>
                      Stock Quantity
                      <input name="stock" type="number" min="0" step="1" value={form.stock} onChange={handleChange} required />
                    </label>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="primary-button" disabled={saving}>
                      {saving ? "Saving..." : editingId ? "Save Changes" : "Add Product"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            <section className="panel inventory-panel">
              <div className="panel-heading inventory-heading">
                <div>
                  <h2>📦 Product List</h2>
                  <p>{filteredProducts.length} product(s) displayed</p>
                </div>

                <input
                  className="search-input"
                  type="search"
                  placeholder="Search name, barcode or category..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              {loading ? (
                <div className="empty-state">Loading products...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="empty-state">
                  <h3>{search ? "No matching products" : "Your inventory is empty"}</h3>
                  <p>Add a product to start managing inventory.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr key={product._id}>
                          <td><strong>{product.name}</strong></td>
                          <td className="barcode-cell">{product.barcode}</td>
                          <td>{product.category}</td>
                          <td>{money(product.price)}</td>
                          <td>
                            <span className={`stock-badge ${product.stock <= 5 ? "low-stock" : ""}`}>
                              {product.stock}
                            </span>
                          </td>
                          <td> <div className="action-buttons"> <button className="edit-button" onClick={() => openEditForm(product)} > Edit </button>

<button
  className="secondary-button"
  onClick={() => generateProductQr(product)}
>
  QR Code
</button>

<button
  className="delete-button"
  onClick={() => deleteProduct(product)}
>
  Delete
</button>

</div> </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : page === "checkout" ? (
          <>
            <section className="panel scanner-panel">
              <div className="panel-heading">
                <div>
                  <h2>▦ Scan a Product</h2>
                  <p>Click the input, scan a barcode, or type one and press Enter.</p>
                </div>
                <span className="scanner-status">Scanner ready</span>
              </div>

              <form className="scan-form" onSubmit={handleBarcodeSubmit}>
                <input
                  ref={barcodeInputRef}
                  className="scan-input"
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  placeholder="Scan barcode here..."
                  aria-label="Product barcode"
                  autoComplete="off"
                  autoFocus
                />
                <button className="primary-button" type="submit">
                  Find Product
                </button>
              </form>
              <div style={{ marginTop: "16px" }}>
  {!showQrScanner ? (
    <button
      type="button"
      className="primary-button"
      onClick={startQrScanner}
    >
      📷 Scan QR Code with Camera
    </button>
  ) : (
    <button
      type="button"
      className="secondary-button"
      onClick={stopQrScanner}
    >
      Stop Camera
    </button>
  )}

  {scannerMessage && (
    <p role="status" style={{ marginTop: "12px" }}>
      {scannerMessage}
    </p>
  )}

  {showQrScanner && (
    <div
      id="pos-qr-reader"
      style={{
        width: "100%",
        maxWidth: "420px",
        marginTop: "16px",
      }}
    />
  )}
</div>
            </section>

            <section className="panel inventory-panel">
              <div className="panel-heading">
                <div>
                  <h2>🛒 Current Sale</h2>
                  <p>{cart.reduce((sum, item) => sum + item.quantity, 0)} item(s) in cart</p>
                </div>
              </div>

              {cart.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">🛒</span>
                  <h3>Your cart is empty</h3>
                  <p>Scan a product barcode to add an item.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th>Price</th>
                        <th>Quantity</th>
                        <th>Subtotal</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item) => (
                        <tr key={item._id}>
                          <td><strong>{item.name}</strong></td>
                          <td className="barcode-cell">{item.barcode}</td>
                          <td>{money(item.price)}</td>
                          <td>
                            <div className="quantity-controls">
                              <button onClick={() => changeQuantity(item._id, -1)}>-</button>
                              <strong>{item.quantity}</strong>
                              <button onClick={() => changeQuantity(item._id, 1)}>+</button>
                            </div>
                          </td>
                          <td>{money(item.price * item.quantity)}</td>
                          <td>
                            <button className="delete-button" onClick={() => removeFromCart(item._id)}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel summary-panel">
              <h2>Payment Summary</h2>

              <div className="summary-row">
                <span>Subtotal</span>
                <strong>{money(subtotal)}</strong>
              </div>

              <div className="summary-row">
                <span>Tax (5%)</span>
                <strong>{money(tax)}</strong>
              </div>

              <div className="summary-row total-row">
                <span>Total</span>
                <strong>{money(total)}</strong>
              </div>

              <label className="payment-label">
                Payment Method
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                </select>
              </label>

              <button
                className="primary-button checkout-button"
                onClick={completeCheckout}
                disabled={checkoutBusy || cart.length === 0}
              >
                {checkoutBusy ? "Processing..." : `Complete Sale · ${money(total)}`}
              </button>

              <p className="payment-note">
                Stock is updated in MongoDB after a successful sale.
              </p>
            </section>
          </>
        ) : (
          <section className="dashboard-content">
            {dashboardError && (
              <div className="alert error-alert">
                {dashboardError}
                <button onClick={() => setDashboardError("")}>×</button>
              </div>
            )}

            {dashboardLoading && !dashboardData ? (
              <div className="panel empty-state">Loading dashboard...</div>
            ) : dashboardData ? (
              <>
                <section className="stats-grid dashboard-stats">
                  <article className="stat-card">
                    <span className="stat-icon green">₹</span>
                    <div>
                      <p>Today's Revenue</p>
                      <h2>{money(dashboardData.stats.todaysRevenue || 0)}</h2>
                    </div>
                  </article>
                  <article className="stat-card">
                    <span className="stat-icon blue">▤</span>
                    <div>
                      <p>Transactions Today</p>
                      <h2>{dashboardData.stats.totalTransactions || 0}</h2>
                    </div>
                  </article>
                  <article className="stat-card">
                    <span className="stat-icon purple">▦</span>
                    <div>
                      <p>Products Sold Today</p>
                      <h2>{dashboardData.stats.productsSold || 0}</h2>
                    </div>
                  </article>
                  <article className="stat-card">
                    <span className="stat-icon orange">!</span>
                    <div>
                      <p>Low-Stock Products</p>
                      <h2>{dashboardData.stats.lowStockCount || 0}</h2>
                    </div>
                  </article>
                </section>

                <section className="stats-grid analytics-summary-grid">
                  <article className="stat-card">
                    <span className="stat-icon purple">₹</span>
                    <div>
                      <p>Revenue (Last 7 Days)</p>
                      <h2>{money(analyticsData?.summary?.sevenDayRevenue || 0)}</h2>
                    </div>
                  </article>
                  <article className="stat-card">
                    <span className="stat-icon blue">▤</span>
                    <div>
                      <p>Transactions (Last 7 Days)</p>
                      <h2>{(analyticsData?.revenueTrend || []).reduce((sum, day) => sum + (day.revenue >= 0 ? 0 : 0), 0) + (analyticsData ? Object.values(analyticsData.paymentBreakdown || {}).reduce((sum, method) => sum + (method.transactions || 0), 0) : 0)}</h2>
                    </div>
                  </article>
                  <article className="stat-card">
                    <span className="stat-icon green">▦</span>
                    <div>
                      <p>Units Sold (Last 7 Days)</p>
                      <h2>{analyticsData?.summary?.productsSold || 0}</h2>
                    </div>
                  </article>
                </section>

                {analyticsError && (
                  <div className="alert error-alert">
                    {analyticsError}
                    <button onClick={() => setAnalyticsError("")}>×</button>
                  </div>
                )}

                <section className="analytics-grid">
                  <article className="panel analytics-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>📈 Revenue Trend</h2>
                        <p>Daily revenue for the last 7 days</p>
                      </div>
                    </div>
                    {analyticsLoading && !analyticsData ? (
                      <div className="empty-state">Loading revenue data...</div>
                    ) : analyticsData?.revenueTrend?.length ? (
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={280}>
                          <LineChart data={analyticsData.revenueTrend} margin={{ top: 10, right: 20, left: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} />
                            <YAxis />
                            <Tooltip formatter={(value) => money(Number(value))} />
                            <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={3} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <div className="empty-state">No revenue data available yet.</div>}
                  </article>

                  <article className="panel analytics-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>🏆 Best-Selling Products</h2>
                        <p>Top products by quantity sold</p>
                      </div>
                    </div>
                    {analyticsData?.bestSellers?.length ? (
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={analyticsData.bestSellers} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                            <YAxis allowDecimals={false} />
                            <Tooltip formatter={(value, name) => name === "Revenue" ? money(Number(value)) : value} />
                            <Bar dataKey="quantitySold" name="Units Sold" fill="#16a34a" radius={[5, 5, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <div className="empty-state">Complete a sale to see best-selling products.</div>}
                  </article>

                  <article className="panel analytics-panel payment-analytics-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>💳 Payment Breakdown</h2>
                        <p>Transactions by payment method · last 7 days</p>
                      </div>
                    </div>
                    {analyticsData && Object.values(analyticsData.paymentBreakdown || {}).some((method) => method.transactions > 0) ? (
                      <div className="payment-chart-layout">
                        <div className="chart-container payment-chart">
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie data={Object.entries(analyticsData.paymentBreakdown).map(([name, value]) => ({ name, transactions: value.transactions, revenue: value.revenue })).filter((item) => item.transactions > 0)} dataKey="transactions" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
                                <Cell fill="#2563eb" />
                                <Cell fill="#16a34a" />
                                <Cell fill="#9333ea" />
                              </Pie>
                              <Tooltip formatter={(value, name) => [`${value} transaction(s)`, name]} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="payment-method-list">
                          {Object.entries(analyticsData.paymentBreakdown).map(([method, details]) => (
                            <div className="payment-method-row" key={method}>
                              <span>{method}</span>
                              <strong>{details.transactions} sale(s)</strong>
                              <span>{money(details.revenue)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : <div className="empty-state">No completed transactions in the last 7 days.</div>}
                  </article>
                </section>

                <section className="panel inventory-panel dashboard-panel sales-report-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>📅 Sales Report</h2>
                      <p>Generate a report for a selected date range</p>
                    </div>
                  </div>
                  <form className="report-filter-form" onSubmit={generateSalesReport}>
                    <label>
                      Start Date
                      <input type="date" value={reportStartDate} max={reportEndDate || undefined} onChange={(event) => setReportStartDate(event.target.value)} required />
                    </label>
                    <label>
                      End Date
                      <input type="date" value={reportEndDate} min={reportStartDate || undefined} onChange={(event) => setReportEndDate(event.target.value)} required />
                    </label>
                    <button className="primary-button" type="submit" disabled={reportLoading}>
                      {reportLoading ? "Generating..." : "Generate Report"}
                    </button>
                  </form>
                  {reportError && <div className="alert error-alert">{reportError}</div>}
                  {salesReport && (
                    <>
                      <div className="report-results-grid">
                        <div className="report-result-card"><span>Total Revenue</span><strong>{money(salesReport.report.totalRevenue)}</strong></div>
                        <div className="report-result-card"><span>Transactions</span><strong>{salesReport.report.totalTransactions}</strong></div>
                        <div className="report-result-card"><span>Products Sold</span><strong>{salesReport.report.totalProductsSold}</strong></div>
                        <div className="report-result-card"><span>Tax Collected</span><strong>{money(salesReport.report.totalTax)}</strong></div>
                      </div>
                      {salesReport.sales?.length ? (
                        <div className="table-wrapper report-table-wrapper">
                          <table>
                            <thead><tr><th>Date & Time</th><th>Items</th><th>Payment</th><th>Total</th></tr></thead>
                            <tbody>
                              {salesReport.sales.map((sale) => (
                                <tr key={sale._id}>
                                  <td>{new Date(sale.createdAt).toLocaleString("en-IN")}</td>
                                  <td>{sale.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                                  <td>{sale.paymentMethod}</td>
                                  <td><strong>{money(sale.total)}</strong></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : <div className="empty-state">No sales were found in this date range.</div>}
                    </>
                  )}
                </section>

                <section className="panel inventory-panel dashboard-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>⚠️ Low-Stock Alerts</h2>
                      <p>Products with 5 or fewer units remaining</p>
                    </div>
                  </div>
                  {dashboardData.lowStockProducts?.length ? (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr><th>Product</th><th>Barcode</th><th>Category</th><th>Price</th><th>Stock</th></tr>
                        </thead>
                        <tbody>
                          {dashboardData.lowStockProducts.map((product) => (
                            <tr key={product._id}>
                              <td><strong>{product.name}</strong></td>
                              <td className="barcode-cell">{product.barcode}</td>
                              <td>{product.category}</td>
                              <td>{money(product.price)}</td>
                              <td><span className="stock-badge low-stock">{product.stock}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state"><h3>All good!</h3><p>No products are currently at or below the low-stock threshold.</p></div>
                  )}
                </section>

                <section className="panel inventory-panel dashboard-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>🧾 Recent Sales</h2>
                      <p>Latest 10 transactions</p>
                    </div>
                  </div>
                  {dashboardData.recentSales?.length ? (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr><th>Date & Time</th><th>Items</th><th>Payment</th><th>Status</th><th>Total</th></tr>
                        </thead>
                        <tbody>
                          {dashboardData.recentSales.map((sale) => (
                            <tr key={sale._id}>
                              <td>{new Date(sale.createdAt).toLocaleString("en-IN")}</td>
                              <td>{sale.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                              <td>{sale.paymentMethod}</td>
                              <td><span className="sale-status">{sale.status}</span></td>
                              <td><strong>{money(sale.total)}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state"><h3>No sales yet</h3><p>Completed transactions will appear here.</p></div>
                  )}
                </section>
              </>
            ) : (
              <div className="panel empty-state">
                <h3>Dashboard data unavailable</h3>
                <p>Use Refresh Dashboard to try again.</p>
              </div>
            )}
          </section>
        )}
        {qrCodeProduct && qrCodeImage && (

  <div className="receipt-overlay">
    <section
      className="receipt-card"
      style={{ textAlign: "center" }}
    >
      <h2>Product QR Code</h2>

```
  <h3>{qrCodeProduct.name}</h3>

  <p>Barcode: {qrCodeProduct.barcode}</p>

  <img
    src={qrCodeImage}
    alt={`QR code for ${qrCodeProduct.name}`}
    style={{
      display: "block",
      width: "260px",
      maxWidth: "100%",
      margin: "16px auto",
    }}
  />

  <p>Price: ₹{Number(qrCodeProduct.price).toFixed(2)}</p>

  <div className="receipt-actions no-print">
    <button
      className="secondary-button"
      onClick={() => window.print()}
    >
      🖨️ Print QR Code
    </button>

    <button
      className="primary-button"
      onClick={() => {
        setQrCodeProduct(null);
        setQrCodeImage("");
      }}
    >
      Close
    </button>
  </div>
</section>
```

  </div>
)}

        {completedReceipt && (
  <div className="receipt-overlay">
    <section className="receipt-card" id="pos-print-receipt">

      <div className="receipt-header">
        <h1>POS-Sync</h1>
        <h2>SALES RECEIPT</h2>
        <p>Thank you for shopping with us!</p>
      </div>

      <div className="receipt-meta">
        <p>
          <strong>Receipt No:</strong>{" "}
          {String(completedReceipt._id).slice(-8).toUpperCase()}
        </p>

        <p>
          <strong>Date:</strong>{" "}
          {new Date(
            completedReceipt.createdAt || Date.now()
          ).toLocaleDateString("en-IN")}
        </p>

        <p>
          <strong>Time:</strong>{" "}
          {new Date(
            completedReceipt.createdAt || Date.now()
          ).toLocaleTimeString("en-IN")}
        </p>

        <p>
          <strong>Payment:</strong>{" "}
          {completedReceipt.paymentMethod}
        </p>
      </div>

      <table className="receipt-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Amount</th>
          </tr>
        </thead>

        <tbody>
          {completedReceipt.items?.map((item, index) => (
            <tr key={`${item.barcode || item.name}-${index}`}>
              <td>
                {item.name}
                <small>{item.barcode}</small>
              </td>

              <td>{item.quantity}</td>

              <td>₹{Number(item.price).toFixed(2)}</td>

              <td>
                ₹
                {Number(
                  item.subtotal ??
                  item.price * item.quantity
                ).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-totals">
        <p>
          <span>Subtotal</span>
          <strong>
            ₹{Number(completedReceipt.subtotal).toFixed(2)}
          </strong>
        </p>

        <p>
          <span>Tax</span>
          <strong>
            ₹{Number(completedReceipt.tax).toFixed(2)}
          </strong>
        </p>

        <p className="receipt-total">
          <span>TOTAL</span>
          <strong>
            ₹{Number(completedReceipt.total).toFixed(2)}
          </strong>
        </p>
      </div>

      <p className="receipt-thanks">
        Please keep this receipt for your records.
      </p>

      <div className="receipt-actions no-print">
        <button
          className="secondary-button"
          onClick={() => window.print()}
        >
          🖨️ Print Receipt
        </button>

        <button
          className="primary-button"
          onClick={() => setCompletedReceipt(null)}
        >
          Done
        </button>
      </div>

    </section>
  </div>
)}

        <footer className="page-footer">
          POS-Sync · Barcode-Based Point of Sale System
        </footer>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      const token = localStorage.getItem("posToken");
      if (!token) {
        if (!cancelled) setCheckingSession(false);
        return;
      }

      try {
        const response = await fetch("http://localhost:5000/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok || !data.success || !data.user) {
          localStorage.removeItem("posToken");
          localStorage.removeItem("posUser");
          if (!cancelled) setUser(null);
        } else if (!cancelled) {
          setUser(data.user);
          localStorage.setItem("posUser", JSON.stringify(data.user));
        }
      } catch (error) {
        // Keep the saved token if the backend is temporarily offline; show a clear retry/login screen.
        localStorage.removeItem("posToken");
        localStorage.removeItem("posUser");
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    verifySession();
    return () => { cancelled = true; };
  }, []);

  function handleAuthenticated(authenticatedUser) {
    const token = localStorage.getItem("posToken");
    if (!token) {
      alert("Login succeeded but no authentication token was saved. Please try again.");
      return;
    }
    setUser(authenticatedUser);
  }

  function handleLogout() {
    localStorage.removeItem("posToken");
    localStorage.removeItem("posUser");
    setUser(null);
    window.history.pushState({}, "", "/");
  }

  if (checkingSession) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Arial, sans-serif" }}>Checking your session...</div>;
  }

  if (!user) {
    return <AuthPage onAuthenticated={handleAuthenticated} />;
  }

  if (user.role !== "admin") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", fontFamily: "Arial, sans-serif", background: "#f4f7fb" }}>
        <section style={{ maxWidth: "520px", width: "100%", background: "white", padding: "32px", borderRadius: "16px", boxShadow: "0 10px 35px rgba(0,0,0,0.08)" }}>
          <h1 style={{ marginTop: 0 }}>Welcome to POS-Sync</h1>
          <p>Hello {user.name || user.email}! You are signed in as a regular user.</p>
          <p>The inventory management and staff checkout workspace is available to administrator accounts only.</p>
          <button className="primary-button" onClick={handleLogout}>Log out</button>
        </section>
      </div>
    );
  }

  return <POSApp user={user} onLogout={handleLogout} />;
}

export default App;