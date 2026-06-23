import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import apiService from "../api/apiService";
import ChangePasswordModal from "../components/ChangePasswordModal";

const routeTitles = {
  student: {
    dashboard: "Dashboard",
    profile: "Student Profile",
    "mock-tests": "Mock Tests",
    "attempt-history": "Attempt History",
    placement: "Placement",
    analytics: "Analytics",
    recommendations: "Recommendations",
    test: "Test Workspace"
  },
  mentor: {
    dashboard: "Dashboard",
    students: "Students",
    analytics: "Analytics",
    student: "Student Profile"
  },
  admin: {
    dashboard: "Dashboard",
    "cgpa-requests": "CGPA Requests",
    students: "Students",
    mentors: "Mentors",
    "create-test": "Create Test",
    "edit-test": "Edit Test",
    "manage-tests": "Manage Tests",
    analytics: "Analytics",
    drives: "Placement Drives"
  }
};

const Topbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userName, userRole, logout, setUserProfile } = useAuth();
  const [displayName, setDisplayName] = useState(userName || "Student");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 220 });
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric"
      }).format(new Date()),
    []
  );

  const pageTitle = useMemo(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    const role = segments[0];
    const pageKey = segments[1] || "dashboard";
    return routeTitles[role]?.[pageKey] || "Workspace";
  }, [location.pathname]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await apiService.getCurrentUser();
        if (user?.name) {
          setDisplayName(user.name);
          setUserProfile({ name: user.name, role: user.role });
        } else if (userName) {
          setDisplayName(userName);
        }
      } catch (error) {
        if (userName) {
          setDisplayName(userName);
        }
      }
    };

    loadCurrentUser();
  }, [setUserProfile, userName]);

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
    logout();
    navigate("/login", { replace: true });
  };

  const handleProfile = () => {
    setMenuOpen(false);
    navigate("/student/profile");
  };

  const handleChangePassword = () => {
    setMenuOpen(false);
    setShowPasswordModal(true);
  };

  const userInitial = String(displayName || "U").trim().charAt(0).toUpperCase() || "U";

  return (
    <>
      <header className="topbar">
        <div className="topbar-copy">
          <p className="topbar-kicker">{todayLabel}</p>
          <h1 className="topbar-title">{pageTitle}</h1>
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
                <span>{userRole || "user"}</span>
              </span>
              <span className="topbar-user-caret" aria-hidden>
                v
              </span>
            </button>
          </div>
        </div>
      </header>

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
              {userRole === "student" ? (
                <button
                  className="topbar-dropdown-item cursor-pointer"
                  type="button"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={handleProfile}
                >
                  Profile
                </button>
              ) : null}
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

export default Topbar;
