import AppLogo from "./AppLogo";

const Logo = ({ size = 40, showText = true, textStyle = {} }) => {
  const defaultTextStyle = {
    fontSize: "16px",
    fontWeight: "600",
    color: "#ffffff",
    marginLeft: "8px",
    ...textStyle
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <AppLogo
        size={size}
        alt="CampusMentor Logo"
        style={{
          borderRadius: "4px",
          flexShrink: 0
        }}
      />
      {showText && <span style={defaultTextStyle}>CampusMentor</span>}
    </div>
  );
};

export default Logo;
