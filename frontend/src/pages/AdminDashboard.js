import React, { useEffect, useMemo, useState } from 'react';
import Navbar from '../components/Navbar';
import './AdminDashboard.css';
import sharedProducts from '../data/products';
import { fetchProducts, createProduct as apiCreateProduct, updateProduct as apiUpdateProduct, deleteProductApi, fetchOrders, updateOrderStatusApi, fetchAgents, assignOrderApi, fetchUsers, adjustProductStock } from '../mockApi';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [productSearch, setProductSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [agents, setAgents] = useState([]);
  const [assignments, setAssignments] = useState({});

  const [users, setUsers] = useState([]);
  const [expandedOrders, setExpandedOrders] = useState([]); // list of order ids that are expanded to show items

  // Load data from API; fallback to seed/localStorage on failure
  useEffect(() => {
    const seedProducts = sharedProducts.map(p => ({ id: p.id, name: p.name, stock: 100, price: p.price, image: p.image }));
    const seedOrders = [
      { id: 'ORD-1001', customer: 'Alice', total: 650, status: 'paid' },
      { id: 'ORD-1002', customer: 'Bob', total: 320, status: 'pending' },
      { id: 'ORD-1003', customer: 'Charlie', total: 990, status: 'shipped' }
    ];
    const seedAgents = [
      { id: 'AG-1', name: 'Ravi Kumar', email: 'ravi@delivery.com' },
      { id: 'AG-2', name: 'Prem', email: 'prem@delivery.com' },
      { id: 'AG-3', name: 'Rahul', email: 'rahul@delivery.com' }
    ];
    async function load() {
      try {
        console.log('Loading data from API...');
        console.log('Current token:', localStorage.getItem('token'));
        console.log('Current user:', localStorage.getItem('currentUser'));
        
        const [pRes, oRes, aRes, uRes] = await Promise.all([
          fetchProducts(),
          fetchOrders(),
          fetchAgents(),
          fetchUsers()
        ]);
        
        console.log('API responses received:');
        console.log('- Products:', pRes.length, 'items');
        console.log('- Orders:', oRes.length, 'items');
        console.log('- Agents:', aRes.length, 'items');
        console.log('- Users:', uRes.length, 'items');
        
        // Products from API
        if (Array.isArray(pRes)) setProducts(pRes.map(p => ({ ...p, id: p._id })));
        // Orders from API: normalize customer field and capture created date (some APIs use customerName or customerEmail)
        if (Array.isArray(oRes)) setOrders(oRes.map(o => ({
          ...o,
          id: o.orderId || o.id,
          customer: o.customerName || o.customer || o.customerEmail || 'Unknown',
          orderDate: o.createdAt || o.created_at || o.orderDate || o.date || null
        })));
        // Agents from API (delivery users)
        if (Array.isArray(aRes) && aRes.length) setAgents(aRes);
        else setAgents(seedAgents);
        if (Array.isArray(uRes)) setUsers(uRes.map(u => ({ ...u, id: u._id })));
      } catch (e) {
        console.error('Error loading data from API, falling back to local storage:', e);
        const storedProducts = JSON.parse(localStorage.getItem('admin_products') || 'null');
        const storedOrders = JSON.parse(localStorage.getItem('admin_orders') || 'null');
        const storedAgents = JSON.parse(localStorage.getItem('delivery_agents') || 'null');
        const storedAssignments = JSON.parse(localStorage.getItem('delivery_assignments') || '{}');
        if (Array.isArray(storedProducts)) {
          const byId = new Map(storedProducts.map(p => [p.id, p]));
          const merged = seedProducts.map(sp => byId.get(sp.id) ? { ...sp, ...byId.get(sp.id) } : sp);
          storedProducts.forEach(p => { if (!merged.find(m => m.id === p.id)) merged.push(p); });
          setProducts(merged);
          localStorage.setItem('admin_products', JSON.stringify(merged));
        } else {
          setProducts(seedProducts);
          localStorage.setItem('admin_products', JSON.stringify(seedProducts));
        }
        setOrders(Array.isArray(storedOrders) ? storedOrders : seedOrders);
        if (Array.isArray(storedAgents)) {
          setAgents(storedAgents);
        } else {
          setAgents(seedAgents);
          localStorage.setItem('delivery_agents', JSON.stringify(seedAgents));
        }
        setAssignments(storedAssignments && typeof storedAssignments === 'object' ? storedAssignments : {});
        // users fallback stays empty
      }
    }
    load();
  }, []);

  useEffect(() => {
    try { localStorage.setItem('admin_products', JSON.stringify(products)); } catch {}
  }, [products]);

  useEffect(() => {
    try { localStorage.setItem('admin_orders', JSON.stringify(orders)); } catch {}
  }, [orders]);

  const totalRevenue = useMemo(() => orders.reduce((sum, o) => sum + Number(o.total || 0), 0), [orders]);
  const lowStockCount = useMemo(() => products.filter(p => Number(p.stock) <= 10).length, [products]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => `${p.name}`.toLowerCase().includes(q));
  }, [products, productSearch]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(o => `${o.id} ${o.customer} ${o.status}`.toLowerCase().includes(q));
  }, [orders, orderSearch]);

  // Helper: format a date for a record (order/user). Prefer explicit createdAt/orderDate fields,
  // otherwise attempt to derive from a Mongo ObjectId (_id) timestamp. Return 'Unknown' if not possible.
  function formatDateFrom(rec) {
    if (!rec) return 'Unknown';
    // If a raw date/string/number was passed
    if (typeof rec === 'string' || typeof rec === 'number') {
      try { return new Date(rec).toLocaleDateString(); } catch (e) { return 'Unknown'; }
    }
    const possible = rec.createdAt || rec.created_at || rec.orderDate || rec.order_date || rec.date;
    if (possible) {
      try { return new Date(possible).toLocaleDateString(); } catch (e) { /* fallthrough */ }
    }
    if (rec._id && typeof rec._id === 'string' && rec._id.length >= 8) {
      try { return new Date(parseInt(rec._id.substring(0,8), 16) * 1000).toLocaleDateString(); } catch (e) { /* fallthrough */ }
    }
    if (rec.id && typeof rec.id === 'string' && rec.id.length >= 8) {
      try { return new Date(parseInt(rec.id.substring(0,8), 16) * 1000).toLocaleDateString(); } catch (e) { /* fallthrough */ }
    }
    return 'Unknown';
  }

  function openNewProductModal() {
    setEditingProduct({ id: null, name: '', stock: 0, price: 0 });
    setShowProductModal(true);
  }
  function openEditProductModal(p) {
    setEditingProduct({ ...p });
    setShowProductModal(true);
  }
  function closeProductModal() {
    setShowProductModal(false);
    setEditingProduct(null);
  }
  async function saveProduct(e) {
    e.preventDefault();
    if (!editingProduct.name) return;
    const stock = Number(editingProduct.stock);
    const price = Number(editingProduct.price);
    if (Number.isNaN(stock) || Number.isNaN(price)) return;
    
    try {
      if (editingProduct._id || (typeof editingProduct.id === 'string' && editingProduct.id.length > 16)) {
        console.log('Updating existing product in database:', editingProduct._id || editingProduct.id);
        const updated = await apiUpdateProduct(editingProduct._id || editingProduct.id, { name: editingProduct.name, stock, price, image: editingProduct.image || '' });
        console.log('Product updated successfully:', updated);
        setProducts(products.map(p => (p._id === updated._id || p.id === updated._id) ? { ...updated, id: updated._id } : p));
      } else if (editingProduct.id == null) {
        console.log('Creating new product in database:', { name: editingProduct.name, stock, price, image: editingProduct.image || '' });
        const created = await apiCreateProduct({ name: editingProduct.name, stock, price, image: editingProduct.image || '' });
        console.log('Product created successfully:', created);
        setProducts([{ ...created, id: created._id }, ...products]);
      } else {
        console.log('Legacy local update for product:', editingProduct.id);
        // Legacy local update
        setProducts(products.map(p => p.id === editingProduct.id ? { ...p, name: editingProduct.name, stock, price, image: editingProduct.image || p.image } : p));
      }
      closeProductModal();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error saving product: ' + (error.message || 'Unknown error'));
    }
  }
  function deleteProduct(id) {
    if (!window.confirm('Delete this product?')) return;
    if (typeof id === 'string' && id.length > 16) {
      deleteProductApi(id).finally(() => {
        setProducts(products.filter(p => (p._id || p.id) !== id));
      });
    } else {
      setProducts(products.filter(p => p.id !== id));
    }
  }
  async function updateOrderStatus(idOrOrderId, status) {
    // Try backend first (Mongo _id), fallback to local state
    const candidate = orders.find(o => (o._id === idOrOrderId) || (o.orderId === idOrOrderId) || (o.id === idOrOrderId));
    if (candidate && candidate._id) {
      const updated = await updateOrderStatusApi(candidate._id, status);
      setOrders(orders.map(o => (o._id === updated._id) ? { ...updated, id: updated.orderId || updated.id } : o));
    } else {
      setOrders(orders.map(o => (o.id === idOrOrderId) ? { ...o, status } : o));
    }
  }

  async function assignAgentToOrder(orderId, agentEmail) {
    const candidate = orders.find(o => (o.orderId === orderId) || (o.id === orderId) || (o._id === orderId));
    if (candidate && candidate._id) {
      const updated = await assignOrderApi(candidate._id, agentEmail || null);
      setOrders(orders.map(o => (o._id === updated._id) ? { ...updated, id: updated.orderId || updated.id } : o));
    }
    const nextAssignments = { ...assignments, [orderId]: agentEmail };
    setAssignments(nextAssignments);
    try { localStorage.setItem('delivery_assignments', JSON.stringify(nextAssignments)); } catch {}
  }

  function exportCsv(rows, filename) {
    if (!rows.length) return;
    const header = Object.keys(rows[0]);
    const csv = [header.join(',')].concat(rows.map(r => header.map(k => JSON.stringify(r[k] ?? '')).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  const reports = useMemo(() => [
    { id: 'RPT-SEP-SALES', name: 'September Sales', generatedAt: '2025-09-25' },
    { id: 'RPT-INV-STOCK', name: 'Inventory Snapshot', generatedAt: '2025-09-24' }
  ], []);

  return (
    <div>
      <Navbar role="admin" />
      <div className="admin-page">
        <div className="admin-header">
          <div>
            <h2>Admin Dashboard</h2>
            <p>Manage users, products, orders and reports.</p>
          </div>
          <div className="admin-actions">
            <button className="btn primary" onClick={openNewProductModal}>Add Product</button>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title">Products</div>
            <div className="stat-value">{products.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Low Stock (≤10)</div>
            <div className="stat-value warning">{lowStockCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Orders</div>
            <div className="stat-value">{orders.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Revenue (₹)</div>
            <div className="stat-value success">{totalRevenue.toFixed(2)}</div>
          </div>
        </div>

        <div className="admin-tabs">
          <button className={activeTab === 'users' ? 'tab active' : 'tab'} onClick={() => setActiveTab('users')}>Users</button>
          <button className={activeTab === 'products' ? 'tab active' : 'tab'} onClick={() => setActiveTab('products')}>Products</button>
          <button className={activeTab === 'orders' ? 'tab active' : 'tab'} onClick={() => setActiveTab('orders')}>Orders</button>
          <button className={activeTab === 'reports' ? 'tab active' : 'tab'} onClick={() => setActiveTab('reports')}>Reports</button>
        </div>

        {activeTab === 'users' && (
          <div className="card" style={{ 
            minHeight: '600px',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            maxWidth: 'none'
          }}>
            <div className="card-header">
              <h3>Users</h3>
              <div className="card-actions">
              </div>
            </div>
            <div className="table-wrapper" style={{ 
              borderRadius: '12px', 
              overflow: 'visible',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              flex: 1,
              minHeight: '500px',
              width: '100%'
            }}>
              <table className="table" style={{ 
                margin: 0,
                backgroundColor: 'white',
                minHeight: '500px',
                width: '100%',
                tableLayout: 'fixed'
              }}>
                <thead style={{ backgroundColor: '#f8fafc' }}>
                  <tr>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '15%' }}>ID</th>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '20%' }}>Name</th>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '30%' }}>Email</th>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '15%' }}>Role</th>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '20%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => u.role !== 'admin').map((u) => (
                    <tr key={u.id || u._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ 
                        color: '#4a5568', 
                        fontSize: '14px', 
                        fontFamily: 'monospace',
                        padding: '16px 20px',
                        wordBreak: 'break-all'
                      }}>
                        {u.id || u._id}
                      </td>
                      <td style={{ 
                        color: '#2d3748', 
                        fontSize: '15px', 
                        fontWeight: '500',
                        padding: '16px 20px'
                      }}>
                        {u.name}
                      </td>
                      <td style={{ 
                        color: '#4a5568', 
                        fontSize: '15px',
                        padding: '16px 20px',
                        wordBreak: 'break-all'
                      }}>
                        {u.email}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          background: u.role === 'admin' ? 'linear-gradient(135deg, #667eea, #764ba2)' : 
                                     u.role === 'delivery' ? 'linear-gradient(135deg, #f093fb, #f5576c)' : 
                                     'linear-gradient(135deg, #4facfe, #00f2fe)',
                          color: 'white',
                          padding: '6px 16px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <button 
                          onClick={() => {
                            // Show registration date (createdAt) only — last-login info removed
                            const regDate = formatDateFrom(u);
                            alert(`User Details:\n\nID: ${u.id || u._id}\nName: ${u.name}\nEmail: ${u.email}\nRole: ${u.role}\n\nAdditional Info:\n- Account Status: Active\n- Registration Date: ${regDate}`);
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #667eea, #764ba2)',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseOver={(e) => {
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                          }}
                          onMouseOut={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = 'none';
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="card" style={{ 
            minHeight: '600px',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            maxWidth: 'none'
          }}>
            <div className="card-header">
              <h3>Products</h3>
              <div className="card-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input 
                  className="input" 
                  placeholder="Search products..." 
                  value={productSearch} 
                  onChange={(e) => setProductSearch(e.target.value)}
                  style={{ 
                    padding: '10px 16px',
                    fontSize: '14px',
                    minWidth: '200px'
                  }}
                />
                <button 
                  className="btn" 
                  onClick={() => exportCsv(filteredProducts, 'products.csv')}
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Export CSV
                </button>
                <button 
                  className="btn primary" 
                  onClick={openNewProductModal}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  + New Product
                </button>
              </div>
            </div>
            <div className="table-wrapper" style={{ 
              flex: 1,
              minHeight: '500px',
              borderRadius: '12px', 
              overflow: 'visible',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              width: '100%'
            }}>
              <table className="table" style={{ 
                margin: 0,
                backgroundColor: 'white',
                minHeight: '500px',
                width: '100%',
                tableLayout: 'fixed'
              }}>
                <thead style={{ backgroundColor: '#f8fafc' }}>
                  <tr>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '10%' }}>ID</th>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '25%' }}>Name</th>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '15%' }}>Image</th>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '10%' }}>Stock</th>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '15%' }}>Price (₹)</th>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '25%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ 
                        color: '#4a5568', 
                        fontSize: '14px', 
                        fontFamily: 'monospace',
                        padding: '16px 20px',
                        wordBreak: 'break-all'
                      }}>
                        {p.id}
                      </td>
                      <td style={{ 
                        color: '#2d3748', 
                        fontSize: '15px', 
                        fontWeight: '500',
                        padding: '16px 20px'
                      }}>
                        {p.name}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        {p.image ? (
                          <img 
                            src={p.image} 
                            alt={p.name} 
                            style={{ 
                              width: 50, 
                              height: 50, 
                              objectFit: 'cover', 
                              borderRadius: 8,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }} 
                          />
                        ) : (
                          <div style={{
                            width: 50,
                            height: 50,
                            backgroundColor: '#f7fafc',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#a0aec0',
                            fontSize: '12px'
                          }}>
                            No Image
                          </div>
                        )}
                      </td>
                      <td style={{ 
                        color: '#4a5568', 
                        fontSize: '15px',
                        padding: '16px 20px',
                        fontWeight: '500',
                        textAlign: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <button
                            className="btn small"
                            onClick={async () => {
                              try {
                                const updated = await adjustProductStock(p._id || p.id, -1);
                                setProducts(products.map(x => (x._id === updated._id || x.id === updated._id) ? { ...updated, id: updated._id } : x));
                              } catch (err) {
                                console.error('Error decrementing stock', err);
                                alert(err.message || 'Could not decrement stock');
                              }
                            }}
                            style={{ padding: '6px 8px' }}
                          >
                            -
                          </button>
                          <div style={{ minWidth: 40, textAlign: 'center', fontWeight: 600 }}>{p.stock}</div>
                          <button
                            className="btn small"
                            onClick={async () => {
                              try {
                                const updated = await adjustProductStock(p._id || p.id, 1);
                                setProducts(products.map(x => (x._id === updated._id || x.id === updated._id) ? { ...updated, id: updated._id } : x));
                              } catch (err) {
                                console.error('Error incrementing stock', err);
                                alert(err.message || 'Could not increment stock');
                              }
                            }}
                            style={{ padding: '6px 8px' }}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td style={{ 
                        color: '#2d3748', 
                        fontSize: '15px',
                        padding: '16px 20px',
                        fontWeight: '600',
                        textAlign: 'center'
                      }}>
                        ₹{p.price.toFixed(2)}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button 
                            className="btn small" 
                            onClick={() => openEditProductModal(p)}
                            style={{
                              background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
                              color: 'white',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn small danger" 
                            onClick={() => deleteProduct(p.id)}
                            style={{
                              background: 'linear-gradient(135deg, #ff6b6b, #ee5a52)',
                              color: 'white',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="card" style={{ 
            minHeight: '600px',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            maxWidth: 'none'
          }}>
            <div className="card-header">
              <h3>Orders</h3>
              <div className="card-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input 
                  className="input" 
                  placeholder="Search orders..." 
                  value={orderSearch} 
                  onChange={(e) => setOrderSearch(e.target.value)}
                  style={{ 
                    padding: '10px 16px',
                    fontSize: '14px',
                    minWidth: '200px'
                  }}
                />
                <button 
                  className="btn" 
                  onClick={() => exportCsv(filteredOrders, 'orders.csv')}
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Export CSV
                </button>
              </div>
            </div>
            <div className="table-wrapper" style={{ 
              flex: 1,
              minHeight: '500px',
              borderRadius: '12px', 
              overflow: 'visible',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              width: '100%'
            }}>
              <table className="table" style={{ 
                margin: 0,
                backgroundColor: 'white',
                minHeight: '500px',
                width: '100%',
                tableLayout: 'fixed'
              }}>
                <thead style={{ backgroundColor: '#f8fafc' }}>
                  <tr>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '15%' }}>Order ID</th>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '20%' }}>Customer</th>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '15%' }}>Total (₹)</th>
                    {/* Status column removed per request */}
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '20%' }}>Assigned To</th>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '15%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <React.Fragment key={o.id}>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ 
                        color: '#4a5568', 
                        fontSize: '14px', 
                        fontFamily: 'monospace',
                        padding: '16px 20px',
                        wordBreak: 'break-all'
                      }}>
                        {o.orderId || o.id}
                      </td>
                      <td style={{ 
                        color: '#2d3748', 
                        fontSize: '15px', 
                        fontWeight: '500',
                        padding: '16px 20px'
                      }}>
                        {o.customer}
                      </td>
                      <td style={{ 
                        color: '#2d3748', 
                        fontSize: '15px',
                        padding: '16px 20px',
                        fontWeight: '600',
                        textAlign: 'center'
                      }}>
                        ₹{Number(o.total).toFixed(2)}
                      </td>
                      {/* Status column removed */}
                      <td className="assign-td">
                        <select
                          className="select assign-select"
                          value={assignments[o.orderId || o.id] || o.assignedTo || ''}
                          onChange={(e) => assignAgentToOrder(o.orderId || o.id, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {agents.map(a => (
                            <option key={a.email} value={a.email}>{a.name}{a.city ? ` (${a.city})` : ''}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            className="btn small"
                            onClick={() => {
                              const customerName = o.customer;
                              const assigned = assignments[o.orderId || o.id] || o.assignedTo || 'Unassigned';
                              const items = (o.items || []).map(it => `${it.name} x${it.quantity} @ ₹${it.price}`).join('\n');
                              alert(`Order Details:\n\nOrder ID: ${o.orderId || o.id}\nCustomer: ${customerName}\nTotal: ₹${Number(o.total).toFixed(2)}\nAssigned To: ${assigned}\n\nItems:\n${items}\n\nOrder Date: ${formatDateFrom(o)}`);
                            }}
                            style={{
                              background: 'linear-gradient(135deg, #667eea, #764ba2)',
                              color: 'white',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            View
                          </button>

                          <button
                            className="btn small details"
                            onClick={() => {
                              const id = o.orderId || o.id;
                              setExpandedOrders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                            }}
                            aria-expanded={expandedOrders.includes(o.orderId || o.id)}
                          >
                            Items
                          </button>
                        </div>
                      </td>
                      </tr>
                      {expandedOrders.includes(o.orderId || o.id) && (
                        <tr className="order-items-row">
                          <td colSpan={5}>
                            <div className="order-items-container">
                              <table className="order-items-table">
                              <thead>
                                <tr>
                                  <th>Product</th>
                                  <th>Qty</th>
                                  <th>Price (₹)</th>
                                  <th>Subtotal (₹)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(o.items || []).map((it, idx) => (
                                  <tr key={idx}>
                                    <td>{it.name}</td>
                                    <td>{it.quantity}</td>
                                    <td>₹{Number(it.price).toFixed(2)}</td>
                                    <td>₹{(Number(it.price) * Number(it.quantity)).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="card" style={{ 
            minHeight: '600px',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            maxWidth: 'none'
          }}>
            <div className="card-header">
              <h3>Reports</h3>
              <div className="card-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button 
                  className="btn" 
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Generate Report
                </button>
              </div>
            </div>
            <div className="table-wrapper" style={{ 
              flex: 1,
              minHeight: '500px',
              borderRadius: '12px', 
              overflow: 'visible',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              width: '100%'
            }}>
              <table className="table" style={{ 
                margin: 0,
                backgroundColor: 'white',
                minHeight: '500px',
                width: '100%',
                tableLayout: 'fixed'
              }}>
                <thead style={{ backgroundColor: '#f8fafc' }}>
                  <tr>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '25%' }}>Report ID</th>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '35%' }}>Name</th>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '25%' }}>Generated At</th>
                    <th style={{ color: '#2d3748', fontWeight: '600', fontSize: '16px', padding: '16px 20px', width: '15%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ 
                        color: '#4a5568', 
                        fontSize: '14px', 
                        fontFamily: 'monospace',
                        padding: '16px 20px',
                        wordBreak: 'break-all'
                      }}>
                        {r.id}
                      </td>
                      <td style={{ 
                        color: '#2d3748', 
                        fontSize: '15px', 
                        fontWeight: '500',
                        padding: '16px 20px'
                      }}>
                        {r.name}
                      </td>
                      <td style={{ 
                        color: '#4a5568', 
                        fontSize: '15px',
                        padding: '16px 20px'
                      }}>
                        {r.generatedAt}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button 
                            className="btn small" 
                            onClick={() => {
                              alert(`Report Details:\n\nReport ID: ${r.id}\nName: ${r.name}\nGenerated At: ${r.generatedAt}\n\nReport Summary:\n- Total Records: 150\n- Status: Generated\n- Format: PDF/CSV\n- Size: 2.5 MB`);
                            }}
                            style={{
                              background: 'linear-gradient(135deg, #667eea, #764ba2)',
                              color: 'white',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            View
                          </button>
                          <button 
                            className="btn small" 
                            onClick={() => {
                              alert(`Downloading report: ${r.name}\n\nThis would typically download the report file.\nFor demo purposes, this shows the download action.`);
                            }}
                            style={{
                              background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
                              color: 'white',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {showProductModal && (
        <div className="modal-overlay" onClick={closeProductModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingProduct?.id == null ? 'Add Product' : 'Edit Product'}</h3>
              <button className="btn" onClick={closeProductModal}>✕</button>
            </div>
            <form onSubmit={saveProduct} className="modal-body">
              <label className="label">Name</label>
              <input className="input" value={editingProduct?.name || ''} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} />
              <label className="label">Image URL</label>
              <input className="input" value={editingProduct?.image || ''} onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })} />
              <label className="label">Stock</label>
              <input className="input" type="number" value={editingProduct?.stock ?? 0} onChange={(e) => setEditingProduct({ ...editingProduct, stock: e.target.value })} />
              <label className="label">Price (₹)</label>
              <input className="input" type="number" step="0.01" value={editingProduct?.price ?? 0} onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })} />
              <div className="modal-actions">
                <button type="button" className="btn" onClick={closeProductModal}>Cancel</button>
                <button type="submit" className="btn primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
