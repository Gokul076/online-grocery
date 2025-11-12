
// Call backend directly to bypass any dev proxy issues
const API = process.env.REACT_APP_API_URL || 'http://localhost:5050/api';
const getToken = () => localStorage.getItem('token');
const authHeaders = () => (getToken() ? { Authorization: `Bearer ${getToken()}` } : {});

async function handleJson(res) {
  if (res.status === 401) {
    try { localStorage.removeItem('token'); } catch {}
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.msg || 'Request failed'), { data, status: res.status });
  return data;
}

export const registerUser = async (userData) => {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  const data = await handleJson(res);
  return { success: true, msg: data.msg };
};

export const loginUser = async ({ email, password }) => {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await handleJson(res);
  if (data.token) localStorage.setItem('token', data.token);
  return { success: true, user: { email, name: data.name, role: data.role } };
};

export const fetchProducts = async () => {
  console.log('Fetching products from API:', `${API}/products`);
  const res = await fetch(`${API}/products`);
  console.log('Products API Response status:', res.status);
  const result = await handleJson(res);
  console.log('Products fetched from database:', result.length, 'products');
  return result;
};

export const createProduct = async (product) => {
  console.log('Creating product via API:', product);
  console.log('API URL:', `${API}/products`);
  console.log('Auth headers:', authHeaders());
  
  const res = await fetch(`${API}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(product)
  });
  
  console.log('API Response status:', res.status);
  const result = await handleJson(res);
  console.log('API Response data:', result);
  return result;
};

export const updateProduct = async (id, updates) => {
  const res = await fetch(`${API}/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(updates)
  });
  return handleJson(res);
};

export const adjustProductStock = async (id, delta) => {
  const res = await fetch(`${API}/products/${id}/adjust-stock`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ delta })
  });
  return handleJson(res);
};

export const deleteProductApi = async (id) => {
  const res = await fetch(`${API}/products/${id}`, { method: 'DELETE', headers: authHeaders() });
  return handleJson(res);
};

export const fetchOrders = async () => {
  const res = await fetch(`${API}/orders`, { headers: authHeaders() });
  return handleJson(res);
};

export const createOrderApi = async (order) => {
  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order)
  });
  return handleJson(res);
};

export const updateOrderStatusApi = async (id, status) => {
  const res = await fetch(`${API}/orders/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ status })
  });
  return handleJson(res);
};

export const assignOrderApi = async (id, assignedTo) => {
  const res = await fetch(`${API}/orders/${id}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ assignedTo })
  });
  return handleJson(res);
};

export const fetchAgents = async () => {
  const res = await fetch(`${API}/agents`, { headers: authHeaders() });
  return handleJson(res);
};

export const fetchUsers = async () => {
  const res = await fetch(`${API}/users`, { headers: authHeaders() });
  return handleJson(res);
};
