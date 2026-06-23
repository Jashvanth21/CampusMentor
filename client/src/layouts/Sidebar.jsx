import { NavLink, useNavigate } from "react-router-dom";
import Logo from "../components/common/Logo";
import { useAuth } from "../context/AuthContext";

const SidebarIcon = ({ name }) => {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: "icon-svg"
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...commonProps}>
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="5" rx="2" />
          <rect x="13" y="10" width="8" height="11" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
        </svg>
      );
    case "students":
      return (
        <svg {...commonProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="9.5" cy="7" r="4" />
          <path d="M20 8a3 3 0 0 1 0 6" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        </svg>
      );
    case "tests":
      return (
        <svg {...commonProps}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      );
    case "history":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "placement":
      return (
        <svg {...commonProps}>
          <path d="M3 7h18" />
          <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M10 12h4" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...commonProps}>
          <path d="M4 19h16" />
          <path d="M7 16V9" />
          <path d="M12 16V5" />
          <path d="M17 16v-7" />
        </svg>
      );
    case "recommendations":
      return (
        <svg {...commonProps}>
          <path d="M12 3l2.8 5.67 6.2.9-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.96 1.06-6.2L3 9.57l6.2-.9z" />
        </svg>
      );
    default:
      return null;
  }
};

const navByRole = {
  student: [
    { to: "/student/dashboard", label: "Dashboard", icon: "dashboard" },
    { to: "/student/mock-tests", label: "Mock Tests", icon: "tests" },
    { to: "/student/attempt-history", label: "Attempt History", icon: "history" },
    { to: "/student/placement", label: "Placement", icon: "placement" },
    { to: "/student/analytics", label: "Analytics", icon: "analytics" },
    { to: "/student/recommendations", label: "Recommendations", icon: "recommendations" }
  ],
  mentor: [
    { to: "/mentor/dashboard", label: "Dashboard", icon: "dashboard" },
    { to: "/mentor/students", label: "Students", icon: "students" },
    { to: "/mentor/analytics", label: "Analytics", icon: "analytics" }
  ],
  admin: [
    { to: "/admin/analytics", label: "Analytics" },
    { to: "/admin/drives", label: "Placement" }
  ]
};

const Sidebar = () => {
  const navigate = useNavigate();
  const { userRole, logout } = useAuth();
  const links = navByRole[userRole] || [];
  const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : "Workspace";
  const isStudentSidebar = userRole === "student";
  const isMentorSidebar = userRole === "mentor";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className={`sidebar ${isStudentSidebar ? "student-shell-sidebar" : ""} ${isMentorSidebar ? "mentor-sidebar" : ""}`.trim()}>
      <div className="sidebar-body">
        <div className="sidebar-brand">
          <Logo size={36} showText={false} />
          <div>
            <p className="sidebar-eyebrow">{roleLabel} Portal</p>
            <div className="sidebar-logo">CampusMentor</div>
          </div>
        </div>

        <div className="sidebar-section-label">Navigation</div>
        <nav className="sidebar-nav">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
            >
              <span className="sidebar-link-marker" aria-hidden />
              {item.icon ? (
                <span className="sidebar-link-icon" aria-hidden>
                  <SidebarIcon name={item.icon} />
                </span>
              ) : null}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <button className="sidebar-logout" type="button" onClick={handleLogout}>
        Sign Out
      </button>
    </aside>
  );
};

export default Sidebar;
