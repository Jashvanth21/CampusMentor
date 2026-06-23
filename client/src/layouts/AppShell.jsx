const joinClassNames = (...values) => values.filter(Boolean).join(" ");

const AppShell = ({
  sidebar,
  header,
  children,
  containerClassName = "",
  contentClassName = "",
  mainClassName = ""
}) => {
  return (
    <div className={joinClassNames("dashboard-container", containerClassName)}>
      {sidebar}
      <div className={joinClassNames("dashboard-content", contentClassName)}>
        {header}
        <main className={joinClassNames("dashboard-main", mainClassName)}>{children}</main>
      </div>
    </div>
  );
};

export default AppShell;
