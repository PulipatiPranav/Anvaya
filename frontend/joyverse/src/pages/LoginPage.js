import React, { useState } from "react";
import axios from "axios";
import "./LoginPage.css";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config/api";

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/api/auth/login`, {
        username,
        password,
      });

      const { role, therapistId, token } = response.data;
      localStorage.setItem("username", username);
      if (token) localStorage.setItem("token", token);

      if (role === "therapist") {
        localStorage.setItem("therapistId", therapistId);
        navigate("/therapistdashboard");
      } else if (role === "superadmin") {
        navigate("/superadmin");
      } else if (role === "child") {
        navigate("/welcomepage");
      } else {
        setError("Unknown user role. Please contact your administrator.");
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError("Incorrect username or password. Please try again.");
      } else if (!err.response) {
        setError("Cannot connect to server. Please check your connection.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const errorId = "login-error";

  return (
    <div className="loginscreen">
      <a href="#login-form" className="skip-to-content">Skip to login form</a>

      <section className="joyverse-wrapper" aria-label="JoyVerse branding">
        <h1 className="joyverse">JoyVerse</h1>
      </section>

      <form
        id="login-form"
        className="usernamecontainer-parent"
        onSubmit={handleLogin}
        aria-label="Sign in to JoyVerse"
        aria-describedby={error ? errorId : undefined}
        noValidate
      >
        <label className="login-label" htmlFor="login-username">
          Username
        </label>
        <input
          id="login-username"
          className="usernamecontainer"
          placeholder="Enter your username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          aria-required="true"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
        />

        <label className="login-label" htmlFor="login-password">
          Password
        </label>
        <input
          id="login-password"
          className="passwordcontainer"
          placeholder="Enter your password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          aria-required="true"
          aria-invalid={!!error}
        />

        <button
          className="login-button"
          type="submit"
          disabled={loading}
          aria-busy={loading}
        >
          <span className="login">{loading ? "Signing in…" : "Login"}</span>
        </button>
      </form>

      {error && (
        <p id={errorId} className="error" role="alert" aria-live="assertive">
          {error}
        </p>
      )}
    </div>
  );
}

export default LoginPage;
