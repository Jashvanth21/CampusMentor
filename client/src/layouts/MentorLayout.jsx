import { Outlet } from "react-router-dom";
import AppShell from "./AppShell";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const MentorLayout = () => {
  return (
    <AppShell sidebar={<Sidebar />} header={<Topbar />}>
      <Outlet />
    </AppShell>
  );
};

export default MentorLayout;
