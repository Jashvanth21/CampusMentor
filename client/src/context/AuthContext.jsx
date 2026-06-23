import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [role, setRole] = useState(() => localStorage.getItem("role") || "");
  const [name, setName] = useState(() => localStorage.getItem("name") || "");

  const login = (nextToken, nextRole, nextName = "") => {
    const safeToken = nextToken || "";
    const safeRole = nextRole || "";
    const safeName = nextName || "";

    setToken(safeToken);
    setRole(safeRole);
    setName(safeName);
    localStorage.setItem("token", safeToken);
    localStorage.setItem("role", safeRole);
    localStorage.setItem("name", safeName);
  };

  const logout = () => {
    setToken("");
    setRole("");
    setName("");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
  };

  const setUserProfile = (user) => {
    const nextName = user?.name || "";
    const nextRole = user?.role || role;
    setName(nextName);
    setRole(nextRole || "");
    if (nextName) {
      localStorage.setItem("name", nextName);
    }
    if (nextRole) {
      localStorage.setItem("role", nextRole);
    }
  };

  const value = useMemo(
    () => ({
      token,
      role,
      name,
      isAuthenticated: Boolean(token),
      userRole: role,
      userName: name,
      login,
      logout,
      setUserProfile
    }),
    [token, role, name]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
