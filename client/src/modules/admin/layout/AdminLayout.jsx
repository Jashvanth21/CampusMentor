import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import ChangePasswordModal from "../../../components/ChangePasswordModal";
import Logo from "../../../components/common/Logo";
import { useAuth } from "../../../context/AuthContext";
import AppShell from "../../../layouts/AppShell";

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
    case "mentors":
      return (
        <svg {...commonProps}>
          <circle cx="9" cy="7" r="4" />
          <path d="M3 21a6 6 0 0 1 12 0" />
          <circle cx="18" cy="8" r="3" />
          <path d="M15 21a4.5 4.5 0 0 1 6 0" />
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
    case "placement":
      return (
        <svg {...commonProps}>
          <path d="M3 7h18" />
          <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M10 12h4" />
        </svg>
      );
    case "requests":
      return (
        <svg {...commonProps}>
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
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
    default:
      return null;
  }
};

const adminNavSections = [
  {
    label: "",
    items: [{ to: "/admin/dashboard", label: "Dashboard", icon: "dashboard" }]
  },
  {
    label: "Management",
    items: [
      { to: "/admin/students", label: "Students", icon: "students" },
      { to: "/admin/mentors", label: "Mentors", icon: "mentors" }
    ]
  },
  {
    label: "Tests",
    items: [
      { to: "/admin/create-test", label: "Create Test", icon: "tests" },
      { to: "/admin/manage-tests", label: "Manage Tests", icon: "tests" }
    ]
  },
  {
    label: "Placements",
    items: [
      { to: "/admin/drives", label: "Drives", icon: "placement" },
      { to: "/admin/cgpa-requests", label: "CGPA Requests", icon: "requests" }
    ]
  },
  {
    label: "",
    items: [{ to: "/admin/analytics", label: "Analytics", icon: "analytics" }]
  }
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const { userName, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 220 });
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  useLayoutEffect(() => {
    if (!menuOpen || !triggerRef.current) {
      return undefined;
    }

    const updateMenuPosition = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuWidth = Math.max(rect.width, 220);
      const viewportPadding = 16;
      const maxLeft = window.innerWidth - menuWidth - viewportPadding;

      setMenuPosition({
        top: rect.bottom + 10,
        left: Math.max(viewportPadding, Math.min(rect.right - menuWidth, maxLeft)),
        width: menuWidth
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const clickedTrigger = menuRef.current?.contains(event.target);
      const clickedDropdown = dropdownRef.current?.contains(event.target);

      if (!clickedTrigger && !clickedDropdown) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate("/login", { replace: true });
  };

  const handleChangePassword = () => {
    setMenuOpen(false);
    setShowPasswordModal(true);
  };

  const displayName = String(userName || "").trim() === "Super Admin" ? "Admin" : userName || "Admin";
  const userInitial = String(displayName).trim().charAt(0).toUpperCase() || "A";

  return (
    <>
      <AppShell
        containerClassName="admin-shell"
        contentClassName="admin-dashboard-content"
        mainClassName="admin-dashboard-main"
        sidebar={
          <aside className="sidebar admin-sidebar">
            <div className="sidebar-body">
              <div className="sidebar-brand">
                <Logo size={36} showText={false} />
                <div>
                  <p className="sidebar-eyebrow">Admin Portal</p>
                  <div className="sidebar-logo">CampusMentor</div>
                </div>
              </div>

              <div className="sidebar-section-groups">
                {adminNavSections.map((section, index) => (
                  <section className="sidebar-nav-group" key={`${section.label || "section"}-${index}`}>
                    {section.label ? <div className="sidebar-section-label">{section.label}</div> : null}
                    <nav className="sidebar-nav">
                      {section.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
                        >
                          <span className="sidebar-link-marker" aria-hidden />
                          <span className="sidebar-link-icon" aria-hidden>
                            <SidebarIcon name={item.icon} />
                          </span>
                          <span>{item.label}</span>
                        </NavLink>
                      ))}
                    </nav>
                  </section>
                ))}
              </div>
            </div>

            <button className="sidebar-logout" type="button" onClick={handleLogout}>
              Sign Out
            </button>
          </aside>
        }
        header={
          <header className="topbar">
            <div className="topbar-copy">
              <p className="topbar-kicker">Campus operations</p>
              <h1 className="topbar-title">Admin Workspace</h1>
            </div>
            <div className="topbar-actions">
              <div className="topbar-user-menu" ref={menuRef}>
                <button
                  ref={triggerRef}
                  className="topbar-user-trigger"
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                >
                  <span className="topbar-avatar" aria-hidden>
                    {userInitial}
                  </span>
                  <span className="topbar-user-summary">
                    <strong>{displayName}</strong>
                    <span>admin</span>
                  </span>
                  <span className="topbar-user-caret" aria-hidden>
                    v
                  </span>
                </button>
              </div>
            </div>
          </header>
        }
      >
        <Outlet />
      </AppShell>

      {menuOpen
        ? createPortal(
            <div
              ref={dropdownRef}
              className="topbar-dropdown topbar-dropdown-portal"
              role="menu"
              onMouseDown={(event) => event.stopPropagation()}
              style={{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
                width: `${menuPosition.width}px`
              }}
            >
              <button
                className="topbar-dropdown-item cursor-pointer"
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={handleChangePassword}
              >
                Change Password
              </button>
              <button
                className="topbar-dropdown-item danger cursor-pointer"
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>,
            document.body
          )
        : null}

      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </>
  );
};

export default AdminLayout;
