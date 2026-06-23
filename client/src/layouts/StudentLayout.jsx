import { Outlet, useLocation } from "react-router-dom";
import "../styles/student-dashboard.css";
import AppShell from "./AppShell";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import StudentChatbot from "../modules/student/chat/StudentChatbot";

const StudentLayout = () => {
  const location = useLocation();
  const showChatbotRoutes = [
    "/student/dashboard",
    "/student/recommendations",
    "/student/analytics",
    "/student/placement"
  ];
  const shouldShowChatbot = showChatbotRoutes.some((route) => location.pathname.startsWith(route));

  return (
    <AppShell sidebar={<Sidebar />} header={<Topbar />}>
      <Outlet />
      {shouldShowChatbot ? <StudentChatbot /> : null}
    </AppShell>
  );
};

export default StudentLayout;
