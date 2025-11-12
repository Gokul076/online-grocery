import React, { useState } from "react";
import { useHistory, Link } from "react-router-dom";
import { loginUser } from "../mockApi";
import "../styles.css";
import "../App.css";

function Login() {
  const history = useHistory();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }
    try {
      const res = await loginUser({ email, password });
      if (!res.success) {
        alert(res.msg || 'Invalid credentials');
        return;
      }
  const role = res.user.role;
  const name = res.user.name;
  localStorage.setItem('currentUser', JSON.stringify({ name, email, role }));
      if (role === 'admin') history.push('/admin');
      else if (role === 'delivery') history.push('/delivery');
      else history.push('/dashboard');
    } catch (e) {
      alert('Login failed. Please check your email/password and try again.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h2 className="login-title">Welcome back</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="login-btn">Login</button>
        </form>
        <div className="register-link">
          Don’t have an account? <Link to="/register">Register</Link>
        </div>
        <div className="register-link" style={{ marginTop: 8 }}>
          Shop owner? <Link to="/admin/login">Admin Login</Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
