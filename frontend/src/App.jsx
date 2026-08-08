import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  User, 
  Package, 
  ShoppingCart, 
  CreditCard, 
  History, 
  LogOut, 
  Lock, 
  Mail, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  Sliders, 
  X, 
  ChevronDown, 
  ChevronUp, 
  DollarSign,
  UserPlus
} from 'lucide-react';
import './App.css';

// Automatically detect backend API URL. 
// Uses localhost:3000 during Vite local dev (port 5173) and relative paths in production
const API = window.location.port === '5173' 
  ? 'http://localhost:3000/api' 
  : `${window.location.origin}/api`;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [activeTab, setActiveTab] = useState('products');
  const [toasts, setToasts] = useState([]);
  const [lastResponse, setLastResponse] = useState(null);
  const [showDevLogs, setShowDevLogs] = useState(false);

  // Auth States
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('admin@test.com');
  const [password, setPassword] = useState('admin123');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('customer');
  const [authLoading, setAuthLoading] = useState(false);

  // App Data States
  const [products, setProducts] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [reservationsLoading, setReservationsLoading] = useState(false);

  // Form States - Products
  const [newProdName, setNewProdName] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdStock, setNewProdStock] = useState('');
  const [prodFormLoading, setProdFormLoading] = useState(false);

  const [adjustProdId, setAdjustProdId] = useState('');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('Restocked');
  const [adjustFormLoading, setAdjustFormLoading] = useState(false);

  // Form States - Reservations
  const [reserveProdId, setReserveProdId] = useState('');
  const [reserveQty, setReserveQty] = useState(1);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [reserveLoading, setReserveLoading] = useState(false);

  // Form States - Payments
  const [payResId, setPayResId] = useState('');
  const [payTxId, setPayTxId] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  const [failResId, setFailResId] = useState('');
  const [failReason, setFailReason] = useState('Insufficient funds');
  const [failLoading, setFailLoading] = useState(false);

  // Form States - Audit Logs
  const [auditProdId, setAuditProdId] = useState('');
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditProductMeta, setAuditProductMeta] = useState(null);

  // Auto-fill default transaction ID when payment Res ID is selected
  useEffect(() => {
    if (payResId && !payTxId) {
      setPayTxId('PAY-' + Math.random().toString(36).substr(2, 9).toUpperCase());
    }
  }, [payResId]);

  // Toast Helpers
  const addToast = (title, desc, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, desc, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // API Call Helper
  const apiCall = async (path, method = 'GET', body = null, requireAuth = true, extraHeaders = {}) => {
    try {
      const headers = { 'Content-Type': 'application/json', ...extraHeaders };
      if (requireAuth && token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const options = { method, headers };
      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(`${API}${path}`, options);
      const data = await response.json();
      setLastResponse(data);
      
      if (response.status === 401) {
        handleLogout();
        addToast('Session Expired', data.error?.message || 'Please sign in again.', 'danger');
        throw new Error(data.error?.message || 'Session expired');
      }
      
      if (!response.ok || data.success === false) {
        throw new Error(data.error?.message || data.message || `HTTP ${response.status} error`);
      }
      return data;
    } catch (err) {
      console.error(`API Error [${method} ${path}]:`, err);
      setLastResponse({ success: false, error: { message: err.message } });
      throw err;
    }
  };

  // Auth Operations
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isRegister) {
        const res = await apiCall('/auth/register', 'POST', { username, email, password, role }, false);
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        addToast('Welcome!', `Registered successfully as ${res.data.user.username}`, 'success');
      } else {
        const res = await apiCall('/auth/login', 'POST', { email, password }, false);
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        addToast('Logged In', `Welcome back, ${res.data.user.username}!`, 'success');
      }
    } catch (err) {
      addToast('Authentication Failed', err.message, 'danger');
    } finally {
      setAuthLoading(false);
    }
  };

  // Fetch Data Operations
  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await apiCall('/products', 'GET', null, false);
      setProducts(res.data.products);
    } catch (err) {
      addToast('Failed to Load Products', err.message, 'danger');
    } finally {
      setProductsLoading(false);
    }
  };

  const loadReservations = async () => {
    if (!token) return;
    setReservationsLoading(true);
    try {
      const res = await apiCall('/reservations', 'GET', null, true);
      setReservations(res.data.reservations);
    } catch (err) {
      addToast('Failed to Load Reservations', err.message, 'danger');
    } finally {
      setReservationsLoading(false);
    }
  };

  // Product Operations
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProdName || !newProdPrice || !newProdStock) {
      return addToast('Invalid Input', 'Please fill in all product fields', 'danger');
    }
    setProdFormLoading(true);
    try {
      await apiCall('/products', 'POST', {
        name: newProdName,
        description: newProdDesc,
        price: parseFloat(newProdPrice),
        total_stock: parseInt(newProdStock)
      });
      addToast('Product Created', `Successfully added product ${newProdName}`, 'success');
      setNewProdName('');
      setNewProdDesc('');
      setNewProdPrice('');
      setNewProdStock('');
      loadProducts();
    } catch (err) {
      addToast('Creation Failed', err.message, 'danger');
    } finally {
      setProdFormLoading(false);
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (!adjustProdId || !adjustQty) {
      return addToast('Invalid Input', 'Specify Product ID and Adjustment size', 'danger');
    }
    setAdjustFormLoading(true);
    try {
      await apiCall(`/products/${adjustProdId}/stock`, 'PATCH', {
        adjustment: parseInt(adjustQty),
        reason: adjustReason
      });
      addToast('Stock Adjusted', 'Inventory level updated successfully', 'success');
      setAdjustQty('');
      loadProducts();
    } catch (err) {
      addToast('Adjustment Failed', err.message, 'danger');
    } finally {
      setAdjustFormLoading(false);
    }
  };

  // Reservation Operations
  const handleCreateReservation = async (e) => {
    e.preventDefault();
    if (!reserveProdId || !reserveQty) {
      return addToast('Invalid Input', 'Specify Product ID and Quantity', 'danger');
    }
    setReserveLoading(true);
    try {
      const headers = {};
      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
      }
      const res = await apiCall('/reservations', 'POST', {
        product_id: reserveProdId,
        quantity: parseInt(reserveQty)
      }, true, headers);
      
      addToast('Reservation Created!', `Held ${reserveQty} unit(s). Expiring in 10 minutes.`, 'success');
      setReserveProdId('');
      setIdempotencyKey('');
      loadProducts();
      loadReservations();
    } catch (err) {
      addToast('Reservation Failed', err.message, 'danger');
    } finally {
      setReserveLoading(false);
    }
  };

  const handleCancelReservation = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this reservation? This will return stock to the store.')) return;
    try {
      await apiCall(`/reservations/${id}`, 'DELETE');
      addToast('Reservation Cancelled', 'Released reserved stock.', 'success');
      loadProducts();
      loadReservations();
    } catch (err) {
      addToast('Cancellation Failed', err.message, 'danger');
    }
  };

  // Payment Operations
  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!payResId || !payTxId) {
      return addToast('Invalid Input', 'Specify Reservation ID and Transaction ID', 'danger');
    }
    setPayLoading(true);
    try {
      await apiCall('/payments/confirm', 'POST', {
        reservation_id: payResId,
        payment_id: payTxId
      });
      addToast('Payment Confirmed', 'Order completed and stock committed permanently!', 'success');
      setPayResId('');
      setPayTxId('');
      loadProducts();
      loadReservations();
      setActiveTab('reservations');
    } catch (err) {
      addToast('Payment Failed', err.message, 'danger');
    } finally {
      setPayLoading(false);
    }
  };

  const handleFailPayment = async (e) => {
    e.preventDefault();
    if (!failResId) {
      return addToast('Invalid Input', 'Specify Reservation ID', 'danger');
    }
    setFailLoading(true);
    try {
      await apiCall('/payments/fail', 'POST', {
        reservation_id: failResId,
        reason: failReason
      });
      addToast('Payment Declined', 'Reservation moved to failed state, stock released.', 'success');
      setFailResId('');
      loadProducts();
      loadReservations();
      setActiveTab('reservations');
    } catch (err) {
      addToast('Operation Failed', err.message, 'danger');
    } finally {
      setFailLoading(false);
    }
  };

  // Audit Operations
  const handleFetchAudit = async (e) => {
    if (e) e.preventDefault();
    if (!auditProdId) return addToast('Product ID Required', 'Please enter a product ID', 'danger');
    setAuditLoading(true);
    try {
      const res = await apiCall(`/audit/products/${auditProdId}`, 'GET');
      setAuditLogs(res.data.audit_log);
      setAuditProductMeta(res.data.product);
    } catch (err) {
      addToast('Audit Log Failed', err.message, 'danger');
      setAuditLogs([]);
      setAuditProductMeta(null);
    } finally {
      setAuditLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadProducts();
    if (token && user && user.role === 'customer') {
      loadReservations();
    }
  }, [token, user]);

  // WebSocket connection for real-time stock updates
  useEffect(() => {
    if (!user) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws';
    const wsUrl = window.location.port === '5173'
      ? 'ws://localhost:3000'
      : `${wsProtocol}://${window.location.host}`;

    console.log(`🔌 Connecting to WebSocket Server at: ${wsUrl}`);
    let ws = null;
    let reconnectTimeout = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('🔌 Connected to WebSocket Server');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.event === 'stock_update') {
            const updatedProduct = message.data;
            console.log('🔌 WebSocket Stock Update:', updatedProduct);
            
            // Instantly update local react products state
            setProducts(prevProducts =>
              prevProducts.map(p => p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p)
            );
          }
        } catch (err) {
          console.error('❌ Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = (e) => {
        console.log('🔌 WebSocket connection closed. Reconnecting...', e.reason);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('🔌 WebSocket connection error:', err);
        ws.close();
      };
    };

    connect();

    return () => {
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [user]);

  // Tab switching helper
  const navigateToTab = (tab, data = {}) => {
    setActiveTab(tab);
    if (tab === 'products') loadProducts();
    if (tab === 'reservations' && user && user.role === 'customer') loadReservations();
    if (tab === 'payments') {
      if (data.reservationId) setPayResId(data.reservationId);
    }
    if (tab === 'audit') {
      if (data.productId) {
        setAuditProdId(data.productId);
        // Wait minor tick for state to bind, then fetch
        setTimeout(() => {
          setAuditProdId(data.productId);
          // Trigger fetch using dynamic ref or simple direct invoke
        }, 100);
      }
    }
  };

  // Trigger audit query directly if routing with prefilled data
  useEffect(() => {
    if (activeTab === 'audit' && auditProdId) {
      handleFetchAudit();
    }
  }, [activeTab]);

  return (
    <div className="dashboard-layout">
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <div className="toast-content">
              <div className="toast-title flex-gap-sm">
                {t.type === 'success' && <CheckCircle size={16} color="var(--success)" />}
                {t.type === 'danger' && <AlertCircle size={16} color="var(--danger)" />}
                {t.type === 'info' && <Info size={16} color="var(--info)" />}
                <span>{t.title}</span>
              </div>
              <div className="toast-desc">{t.desc}</div>
            </div>
            <button className="toast-close" onClick={() => removeToast(t.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      {user && (
        <header>
          <div className="header-container">
            <div className="logo-section">
              <Package size={22} color="var(--color-primary)" style={{ stroke: 'url(#indigo-violet-grad)' }} />
              <h1>Inventory Reservation</h1>
            </div>
            <div className="user-profile">
              <div className="user-badge">
                <User size={14} color="var(--color-text-muted)" />
                <span className="user-name">{user.username}</span>
                <span className={`user-role role-${user.role}`}>
                  {user.role}
                </span>
              </div>
              <button className="btn-secondary" onClick={() => { handleLogout(); addToast('Logged Out', 'You have been signed out.', 'info'); }} style={{ padding: '6px 12px', fontSize: '12px' }}>
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Auth Screen */}
      {!user ? (
        <div className="auth-page">
          <div className="card auth-card">
            <div className="auth-header">
              <div className="auth-logo">
                <Shield size={28} />
              </div>
              <h2 className="auth-title">{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
              <p className="auth-subtitle">
                {isRegister ? 'Register admin or customer credentials' : 'Log in to test reservations & inventory sync'}
              </p>
            </div>

            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {isRegister && (
                <div className="form-group">
                  <label>Username</label>
                  <input 
                    type="text" 
                    placeholder="Enter username" 
                    value={username} 
                    onChange={e => setUsername(e.target.value)} 
                    required 
                  />
                </div>
              )}
              <div className="form-group">
                <label>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="email" 
                    placeholder="name@domain.com" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required 
                    style={{ paddingLeft: '40px' }}
                  />
                  <Mail size={16} color="var(--color-text-dim)" style={{ position: 'absolute', left: '14px', top: '15px' }} />
                </div>
              </div>
              <div className="form-group">
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                    style={{ paddingLeft: '40px' }}
                  />
                  <Lock size={16} color="var(--color-text-dim)" style={{ position: 'absolute', left: '14px', top: '15px' }} />
                </div>
              </div>

              {isRegister && (
                <div className="form-group">
                  <label>Account Role</label>
                  <select value={role} onChange={e => setRole(e.target.value)}>
                    <option value="customer">Customer (can create reservations/payments)</option>
                    <option value="admin">Admin (can manage products/adjust stock/view audit logs)</option>
                  </select>
                </div>
              )}

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={authLoading}>
                {authLoading ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <>
                    {isRegister ? <UserPlus size={16} /> : <Shield size={16} />}
                    <span>{isRegister ? 'Sign Up' : 'Sign In'}</span>
                  </>
                )}
              </button>
            </form>

            <div className="auth-switch">
              {isRegister ? 'Already have an account? ' : 'First time deploying? '}
              <span className="auth-link" onClick={() => setIsRegister(!isRegister)}>
                {isRegister ? 'Log In' : 'Register Here'}
              </span>
            </div>
            
            {lastResponse && showDevLogs && (
              <div className="response-drawer" style={{ marginTop: '20px' }}>
                <div className="drawer-content">{JSON.stringify(lastResponse, null, 2)}</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Main Application Screen */
        <div className="container" style={{ flexGrow: 1 }}>
          {/* Navigation Tabs */}
          <div className="tabs-navigation">
            <button 
              className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`} 
              onClick={() => navigateToTab('products')}
            >
              <Package size={16} />
              <span>Products</span>
            </button>
            {user.role === 'customer' && (
              <>
                <button 
                  className={`tab-btn ${activeTab === 'reservations' ? 'active' : ''}`} 
                  onClick={() => navigateToTab('reservations')}
                >
                  <ShoppingCart size={16} />
                  <span>Reservations</span>
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`} 
                  onClick={() => navigateToTab('payments')}
                >
                  <CreditCard size={16} />
                  <span>Simulate Payment</span>
                </button>
              </>
            )}
            {user.role === 'admin' && (
              <button 
                className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`} 
                onClick={() => navigateToTab('audit')}
              >
                <History size={16} />
                <span>Audit Trail</span>
              </button>
            )}
          </div>

          {/* PRODUCTS TAB */}
          {activeTab === 'products' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="flex-between">
                <div>
                  <h2 style={{ fontSize: '22px' }}>Inventory Catalog</h2>
                  <p>Check available stocks and allocate items in real-time</p>
                </div>
                <button className="btn-secondary" onClick={loadProducts} disabled={productsLoading}>
                  <RefreshCw size={14} className={productsLoading ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>

              {productsLoading && products.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <RefreshCw size={28} className="animate-spin" color="var(--color-primary)" />
                  <p style={{ marginTop: '12px' }}>Fetching catalog...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                  <Package size={36} color="var(--color-text-dim)" style={{ marginBottom: '12px' }} />
                  <h3>No Products Available</h3>
                  <p style={{ margin: '8px 0 16px' }}>Add products from the Admin Panel below to start testing reservations.</p>
                </div>
              ) : (
                <div className="grid-responsive">
                  {products.map(p => {
                    const availablePercent = p.total_stock > 0 ? (p.available_stock / p.total_stock) * 100 : 0;
                    const reservedPercent = p.total_stock > 0 ? (p.reserved_stock / p.total_stock) * 100 : 0;

                    return (
                      <div key={p.id} className="card card-hover product-card">
                        <div>
                          <div className="product-header">
                            <h3 className="product-title">{p.name}</h3>
                            <span className="product-price">${parseFloat(p.price).toFixed(2)}</span>
                          </div>
                          <p className="product-desc">{p.description || 'No description provided.'}</p>
                          
                          {/* Stock progress indicators */}
                          <div className="stock-visualization">
                            <div className="stock-labels">
                              <span>Available: <strong>{p.available_stock}</strong></span>
                              <span>Total: {p.total_stock}</span>
                            </div>
                            <div className="stock-progress-container">
                              <div className="progress-bar-available" style={{ width: `${availablePercent}%` }} />
                              <div className="progress-bar-reserved" style={{ width: `${reservedPercent}%` }} />
                            </div>
                            <div className="stock-legend">
                              <div className="legend-item">
                                <div className="legend-dot" style={{ backgroundColor: 'var(--success)' }} />
                                <span>Free ({p.available_stock})</span>
                              </div>
                              <div className="legend-item">
                                <div className="legend-dot" style={{ backgroundColor: 'var(--warning)' }} />
                                <span>Held ({p.reserved_stock})</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '12px' }}>
                          <div className="flex-between">
                            <code style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>ID: {p.id.substring(0, 18)}...</code>
                            <div className="flex-gap-sm">
                              {user.role === 'customer' && (
                                <button 
                                  className="btn-primary" 
                                  style={{ padding: '6px 12px', fontSize: '12px' }}
                                  onClick={() => {
                                    setReserveProdId(p.id);
                                    navigateToTab('reservations');
                                  }}
                                  disabled={p.available_stock === 0}
                                >
                                  Reserve
                                </button>
                              )}
                              {user.role === 'admin' && (
                                <button 
                                  className="btn-warning"
                                  style={{ padding: '6px 12px', fontSize: '12px' }}
                                  onClick={() => navigateToTab('audit', { productId: p.id })}
                                >
                                  Audit
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Admin Panel: Add & Adjust Products */}
              {user.role === 'admin' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '16px' }}>
                  {/* Create Product Card */}
                  <div className="card">
                    <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Plus size={16} color="var(--success)" />
                      <span>Create New Product</span>
                    </h3>
                    <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="form-group">
                        <label>Product Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g., iPhone 15 Pro" 
                          value={newProdName} 
                          onChange={e => setNewProdName(e.target.value)} 
                          required 
                        />
                      </div>
                      <div className="form-group">
                        <label>Description</label>
                        <input 
                          type="text" 
                          placeholder="Short catalog description" 
                          value={newProdDesc} 
                          onChange={e => setNewProdDesc(e.target.value)} 
                        />
                      </div>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Price ($ USD)</label>
                          <input 
                            type="number" 
                            placeholder="999.99" 
                            step="0.01" 
                            value={newProdPrice} 
                            onChange={e => setNewProdPrice(e.target.value)} 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label>Initial Stock Units</label>
                          <input 
                            type="number" 
                            placeholder="50" 
                            value={newProdStock} 
                            onChange={e => setNewProdStock(e.target.value)} 
                            required 
                          />
                        </div>
                      </div>
                      <button type="submit" className="btn-success" style={{ alignSelf: 'flex-start', marginTop: '8px' }} disabled={prodFormLoading}>
                        {prodFormLoading ? <RefreshCw size={14} className="animate-spin" /> : <span>Add Product</span>}
                      </button>
                    </form>
                  </div>

                  {/* Adjust Stock Card */}
                  <div className="card">
                    <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sliders size={16} color="var(--warning)" />
                      <span>Adjust Stock Inventory</span>
                    </h3>
                    <form onSubmit={handleAdjustStock} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="form-group">
                        <label>Product ID</label>
                        <input 
                          type="text" 
                          placeholder="Paste Product UUID" 
                          value={adjustProdId} 
                          onChange={e => setAdjustProdId(e.target.value)} 
                          required 
                        />
                      </div>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Adjustment Units (+ / -)</label>
                          <input 
                            type="number" 
                            placeholder="e.g. +10 or -5" 
                            value={adjustQty} 
                            onChange={e => setAdjustQty(e.target.value)} 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label>Adjustment Reason</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Restocked, Audit update" 
                            value={adjustReason} 
                            onChange={e => setAdjustReason(e.target.value)} 
                          />
                        </div>
                      </div>
                      <button type="submit" className="btn-warning" style={{ alignSelf: 'flex-start', marginTop: '8px' }} disabled={adjustFormLoading}>
                        {adjustFormLoading ? <RefreshCw size={14} className="animate-spin" /> : <span>Apply Adjustment</span>}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RESERVATIONS TAB */}
          {activeTab === 'reservations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="flex-between">
                <div>
                  <h2 style={{ fontSize: '22px' }}>Holds & Reservations</h2>
                  <p>{user.role === 'customer' ? 'Manage your active shopping cart holds' : 'Monitor customers inventory locks'}</p>
                </div>
                <button className="btn-secondary" onClick={loadReservations} disabled={reservationsLoading}>
                  <RefreshCw size={14} className={reservationsLoading ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Customer Reserve Panel */}
              {user.role === 'customer' && (
                <div className="card">
                  <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Lock Inventory Units</h3>
                  <form onSubmit={handleCreateReservation} className="form-grid" style={{ alignItems: 'flex-end' }}>
                    <div className="form-group">
                      <label>Product ID</label>
                      <input 
                        type="text" 
                        placeholder="Paste Product UUID" 
                        value={reserveProdId} 
                        onChange={e => setReserveProdId(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Quantity</label>
                      <input 
                        type="number" 
                        min="1" 
                        value={reserveQty} 
                        onChange={e => setReserveQty(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Idempotency Key (Optional prevention of double charges)</label>
                      <input 
                        type="text" 
                        placeholder="Unique retry key" 
                        value={idempotencyKey} 
                        onChange={e => setIdempotencyKey(e.target.value)} 
                      />
                    </div>
                    <button type="submit" className="btn-primary" style={{ height: '46px' }} disabled={reserveLoading}>
                      {reserveLoading ? <RefreshCw size={14} className="animate-spin" /> : <span>Hold Inventory</span>}
                    </button>
                  </form>
                </div>
              )}

              {/* List Reservations */}
              <div className="card">
                <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Active System Reservations</h3>
                {reservationsLoading && reservations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <RefreshCw size={20} className="animate-spin" />
                  </div>
                ) : reservations.length === 0 ? (
                  <p className="text-muted" style={{ padding: '20px 0' }}>No reservations registered. Hold stock on the catalog page.</p>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Hold ID</th>
                          <th>Product Name / ID</th>
                          <th>Qty</th>
                          <th>Status</th>
                          <th>Expires</th>
                          {user.role === 'customer' && <th className="text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {reservations.map(r => (
                          <tr key={r.id}>
                            <td style={{ fontfamily: 'var(--font-mono)', fontSize: '12px' }}>{r.id.substring(0, 18)}...</td>
                            <td>
                              <span style={{ fontWeight: '600', color: 'var(--color-text-high)' }}>{r.product_name || 'Product'}</span>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>ID: {r.product_id}</div>
                            </td>
                            <td><strong>{r.quantity}</strong></td>
                            <td>
                              <span className={`badge badge-${r.status}`}>{r.status}</span>
                            </td>
                            <td style={{ fontSize: '13px' }}>{new Date(r.expires_at).toLocaleString()}</td>
                            {user.role === 'customer' && (
                              <td className="text-right">
                                {r.status === 'pending' ? (
                                  <div className="flex-gap-sm" style={{ justifyContent: 'flex-end' }}>
                                    <button 
                                      className="btn-success" 
                                      style={{ padding: '4px 10px', fontSize: '12px' }}
                                      onClick={() => navigateToTab('payments', { reservationId: r.id })}
                                    >
                                      Pay
                                    </button>
                                    <button 
                                      className="btn-danger" 
                                      style={{ padding: '4px 10px', fontSize: '12px' }}
                                      onClick={() => handleCancelReservation(r.id)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--color-text-dim)', fontSize: '12px' }}>-</span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SIMULATE PAYMENTS TAB */}
          {activeTab === 'payments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px' }}>Simulate Order Payments</h2>
                <p>Process your active holds to finalize stock deduction or simulate order failures</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Confirm Payment card */}
                <div className="card">
                  <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={18} color="var(--success)" />
                    <span>Confirm Order Payment</span>
                  </h3>
                  <form onSubmit={handleConfirmPayment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="form-group">
                      <label>Reservation (Hold) ID</label>
                      <input 
                        type="text" 
                        placeholder="Paste Hold UUID" 
                        value={payResId} 
                        onChange={e => setPayResId(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Payment Gateway Transaction Reference</label>
                      <input 
                        type="text" 
                        placeholder="Auto-generated transaction key" 
                        value={payTxId} 
                        onChange={e => setPayTxId(e.target.value)} 
                        required 
                      />
                    </div>
                    <button type="submit" className="btn-success" style={{ alignSelf: 'flex-start', marginTop: '8px' }} disabled={payLoading}>
                      {payLoading ? <RefreshCw size={14} className="animate-spin" /> : <span>Confirm Checkout Success</span>}
                    </button>
                  </form>
                </div>

                {/* Decline Payment card */}
                <div className="card">
                  <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={18} color="var(--danger)" />
                    <span>Simulate Payment Decline</span>
                  </h3>
                  <form onSubmit={handleFailPayment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="form-group">
                      <label>Reservation (Hold) ID</label>
                      <input 
                        type="text" 
                        placeholder="Paste Hold UUID" 
                        value={failResId} 
                        onChange={e => setFailResId(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Decline Reason</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Card expired, Insufficient funds" 
                        value={failReason} 
                        onChange={e => setFailReason(e.target.value)} 
                        required 
                      />
                    </div>
                    <button type="submit" className="btn-danger" style={{ alignSelf: 'flex-start', marginTop: '8px' }} disabled={failLoading}>
                      {failLoading ? <RefreshCw size={14} className="animate-spin" /> : <span>Trigger Card Decline</span>}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* AUDIT TRAIL TAB */}
          {activeTab === 'audit' && user.role === 'admin' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px' }}>Inventory Audit Trails</h2>
                <p>Track historic stock movements, allocation sources, and releases</p>
              </div>

              <div className="card">
                <form onSubmit={handleFetchAudit} className="form-grid" style={{ alignItems: 'flex-end', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label>Select Product by ID</label>
                    <input 
                      type="text" 
                      placeholder="Paste Product UUID" 
                      value={auditProdId} 
                      onChange={e => setAuditProdId(e.target.value)} 
                      required 
                    />
                  </div>
                  <button type="submit" className="btn-primary" style={{ height: '46px' }} disabled={auditLoading}>
                    {auditLoading ? <RefreshCw size={14} className="animate-spin" /> : <span>Inspect History</span>}
                  </button>
                </form>

                {auditLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <RefreshCw size={24} className="animate-spin" />
                  </div>
                ) : auditLogs.length === 0 ? (
                  <p className="text-muted" style={{ padding: '20px 0' }}>No history fetched. Enter a valid Product UUID and inspect history.</p>
                ) : (
                  <div>
                    {auditProductMeta && (
                      <div className="flex-between mb-20" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 18px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div>
                          <strong>{auditProductMeta.name}</strong>
                          <div className="text-muted" style={{ fontSize: '12px' }}>Price: ${auditProductMeta.price}</div>
                        </div>
                        <div style={{ fontSize: '13px' }}>
                          Available Stock: <strong style={{ color: 'var(--success)' }}>{auditProductMeta.available_stock}</strong> / {auditProductMeta.total_stock}
                        </div>
                      </div>
                    )}
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Action Time</th>
                            <th>Action Type</th>
                            <th>Units Delta</th>
                            <th>Stock Before</th>
                            <th>Stock After</th>
                            <th>Change Reason</th>
                            <th>Performed By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.map(log => (
                            <tr key={log.id}>
                              <td style={{ fontSize: '13px' }}>{new Date(log.created_at).toLocaleString()}</td>
                              <td>
                                <span className={`badge badge-${
                                  log.action === 'confirmed' ? 'confirmed' : 
                                  log.action === 'reserved' ? 'pending' : 
                                  log.action === 'released' ? 'expired' : 'cancelled'
                                }`}>
                                  {log.action}
                                </span>
                              </td>
                              <td><strong>{log.quantity_changed > 0 ? `+${log.quantity_changed}` : log.quantity_changed}</strong></td>
                              <td>{log.stock_before}</td>
                              <td>{log.stock_after}</td>
                              <td style={{ fontSize: '13px' }}>{log.reason}</td>
                              <td>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                                  {log.performed_by_username || 'system/cron'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* developer Response drawer (bottom) */}
          <div className="card response-drawer" style={{ background: '#090d16', borderStyle: 'dashed' }}>
            <div className="drawer-header" onClick={() => setShowDevLogs(!showDevLogs)}>
              <div className="flex-gap-sm">
                <Shield size={14} color="var(--info)" />
                <span style={{ fontSize: '13px', fontWeight: '700' }}>Developer Console Logs</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>
                {showDevLogs ? 'Click to collapse [▲]' : 'Click to expand [▼]'}
              </span>
            </div>
            {showDevLogs && (
              <div className="drawer-content" style={{ marginTop: '12px' }}>
                {lastResponse ? JSON.stringify(lastResponse, null, 2) : 'Waiting for network transactions... Send a request to inspect data.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SVG Indigo-Violet Gradient definition for Lucide icons */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <linearGradient id="indigo-violet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </svg>
    </div>
  );
}
