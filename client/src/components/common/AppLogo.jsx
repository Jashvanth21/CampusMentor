import campusMentorLogo from "../../assets/campusmentor-logo.png";

const AppLogo = ({ size = 40, className = "", alt = "CampusMentor Logo", style = {} }) => {
  const classNames = String(className);
  const isNavbarLogo = classNames.includes("brand-mark__logo");
  const isLoginLogo = classNames.includes("auth-logo-image");
  const isCompactLogo = typeof size === "number" && size <= 40;

  const dimension = (() => {
    if (isLoginLogo) {
      return "clamp(72px, 10vw, 84px)";
    }

    if (isNavbarLogo) {
      return "clamp(38px, 3.5vw, 44px)";
    }

    if (isCompactLogo) {
      return "clamp(52px, 5vw, 64px)";
    }

    return typeof size === "number" ? `${size}px` : size;
  })();

  return (
    <img
      src={campusMentorLogo}
      alt={alt}
      className={className}
      style={{
        width: dimension,
        height: dimension,
        objectFit: "contain",
        objectPosition: "center",
        display: "block",
        flexShrink: 0,
        maxWidth: isNavbarLogo ? "none" : "100%",
        maxHeight: isNavbarLogo ? "none" : "100%",
        imageRendering: "auto",
        filter: isLoginLogo
          ? "drop-shadow(0 0 10px rgba(80,120,255,0.45))"
          : "drop-shadow(0 0 8px rgba(59,130,246,0.5))",
        transition: "all 0.3s ease",
        ...style
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = "scale(1.03)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = style.transform || "";
      }}
      onError={(event) => {
        event.currentTarget.style.visibility = "hidden";
      }}
    />
  );
};

export default AppLogo;
