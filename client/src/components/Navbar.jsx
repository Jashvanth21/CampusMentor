import { Link } from "react-router-dom";
import AppLogo from "./common/AppLogo";

const BrandMark = () => (
  <span className="brand-mark" aria-hidden="true">
    <AppLogo size={34} className="brand-mark__logo" alt="" />
  </span>
);

const Navbar = () => {
  return (
    <header className="home-navbar">
      <div className="home-navbar-inner">
        <div className="brand">
          <BrandMark />
          <span className="brand-text">CampusMentor</span>
        </div>
        <div className="home-nav-actions">
          <Link to="/login" className="nav-btn nav-btn-outline">
            LOGIN
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
