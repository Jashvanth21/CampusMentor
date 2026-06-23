import { Navigate, Route, Routes } from "react-router-dom";
import Home from "../pages/Home";
import Login from "../pages/auth/Login";
import ProtectedRoute from "./ProtectedRoute";
import StudentLayout from "../layouts/StudentLayout";
import MentorLayout from "../layouts/MentorLayout";
import AdminLayout from "../modules/admin/layout/AdminLayout";
import StudentDashboard from "../pages/student/StudentDashboard";
import ChangePassword from "../pages/student/ChangePassword";
import StudentProfile from "../pages/student/StudentProfile";
import StudentAnalytics from "../pages/student/StudentAnalytics";
import StudentRecommendations from "../pages/student/StudentRecommendations";
import StudentMockTests from "../pages/student/StudentMockTests";
import StudentPlacement from "../pages/student/StudentPlacement";
import StartTest from "../modules/student/tests/StartTest";
import TestResult from "../modules/student/tests/TestResult";
import DetailedAnalysis from "../modules/student/tests/DetailedAnalysis";
import AttemptHistory from "../modules/student/analytics/AttemptHistory";
import AttemptReview from "../modules/student/analytics/AttemptReview";
import MentorDashboard from "../pages/mentor/Dashboard";
import MentorStudents from "../pages/mentor/MentorStudents";
import MentorAnalytics from "../modules/mentor/analytics/MentorAnalytics";
import StudentAnalyticsPage from "../modules/mentor/studentProfile/StudentAnalytics";
import StudentFeedbackPage from "../modules/mentor/studentProfile/StudentFeedback";
import MentorAttemptReview from "../modules/mentor/studentProfile/MentorAttemptReview";
import AdminDashboard from "../modules/admin/pages/AdminDashboard";
import CreateTest from "../modules/admin/tests/CreateTest";
import EditTest from "../modules/admin/tests/EditTest";
import ManageTests from "../modules/admin/tests/ManageTests";
import AdminAnalytics from "../pages/admin/AdminAnalytics";
import AdminCgpaRequests from "../pages/admin/AdminCgpaRequests";
import AdminPlacement from "../pages/admin/AdminPlacement";
import AdminStudents from "../pages/admin/AdminStudents";
import AdminStudentPerformance from "../pages/admin/AdminStudentPerformance";
import AdminMentors from "../pages/admin/AdminMentors";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Navigate to="/login" replace />} />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute allowedRole="student">
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRole="student">
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<StudentDashboard />} />
        <Route path="profile" element={<StudentProfile />} />
        <Route path="mock-tests" element={<StudentMockTests />} />
        <Route path="test/:testId" element={<StartTest />} />
        <Route path="test/:testId/result" element={<TestResult />} />
        <Route path="test/:testId/analysis" element={<DetailedAnalysis />} />
        <Route path="placement" element={<StudentPlacement />} />
        <Route path="attempt-history" element={<AttemptHistory />} />
        <Route path="attempt-review/:id" element={<AttemptReview />} />
        <Route path="analytics" element={<StudentAnalytics />} />
        <Route path="recommendations" element={<StudentRecommendations />} />
      </Route>

      <Route
        path="/mentor"
        element={
          <ProtectedRoute allowedRole="mentor">
            <MentorLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<MentorDashboard />} />
        <Route path="students" element={<MentorStudents />} />
        <Route path="analytics" element={<MentorAnalytics />} />
        <Route path="student/:studentId" element={<StudentAnalyticsPage />} />
        <Route path="student/:studentId/feedback" element={<StudentFeedbackPage />} />
        <Route path="student/:studentId/attempt/:attemptId" element={<MentorAttemptReview />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="cgpa-requests" element={<AdminCgpaRequests />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="student-performance" element={<AdminStudentPerformance />} />
        <Route path="mentors" element={<AdminMentors />} />
        <Route path="create-test" element={<CreateTest />} />
        <Route path="edit-test/:id" element={<EditTest />} />
        <Route path="manage-tests" element={<ManageTests />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="drives" element={<AdminPlacement />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
