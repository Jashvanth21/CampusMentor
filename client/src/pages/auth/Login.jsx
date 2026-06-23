import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import AppLogo from "../../components/common/AppLogo";
import { useAuth } from "../../context/AuthContext";
import "../../styles/auth.css";

const redirectByRole = {
  student: "/student/dashboard",
  mentor: "/mentor/dashboard",
  admin: "/admin/dashboard"
};

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.post("/auth/login", {
        email: email.trim(),
        password
      });

      const token = response?.data?.token;
      const role = response?.data?.role || response?.data?.user?.role;
      const name = response?.data?.user?.name || "";

      if (!token || !role) {
        setError("Invalid login response from server.");
        return;
      }

      login(token, role, name);
      navigate(redirectByRole[role] || "/login", { replace: true });
    } catch (requestError) {
      console.error("[Login] request failed", requestError?.response?.data || requestError?.message);
      setError(
        requestError?.response?.data?.message ||
          "Login failed. Verify backend is running on http://localhost:5000."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo-lockup">
          <AppLogo size={72} className="auth-logo-image" />
          <span>CampusMentor</span>
        </div>
        <h1>Login</h1>
        <form onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error ? <p className="auth-error">{error}</p> : null}

          <button className="auth-button" type="submit" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
