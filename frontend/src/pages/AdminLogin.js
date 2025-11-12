import React, { useState } from "react";
import { useHistory, Link } from "react-router-dom";
import { loginUser } from "../mockApi";
import "../App.css";

function AdminLogin() {
  const history = useHistory();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      const res = await loginUser({ email, password });
      if (!res.success) {
        alert(res.msg || 'Login failed');
        return;
      }
      if (res.user.role !== 'admin') {
        alert('Not an admin account');
        return;
      }
  localStorage.setItem('currentUser', JSON.stringify({ name: res.user.name, email: res.user.email, role: res.user.role }));
      history.push('/admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="card">
        <h2>Admin Login</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Enter Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Enter Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={loading}>{loading ? "Logging in..." : "Login as Admin"}</button>
        </form>
        <p>
          New admin? <Link to="/admin/register">Register</Link>
        </p>
      </div>
    </div>
  );
}

export default AdminLogin;


