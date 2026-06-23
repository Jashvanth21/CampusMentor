import { useEffect, useState } from "react";
import apiService from "../../api/apiService";
import { buildStudentOverviewFromStudentApis } from "../../utils/studentOverview";

const toTagList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const pageShellStyle = {
  width: "100%",
  maxWidth: "900px",
  margin: "0 auto",
  display: "grid",
  gap: "16px"
};

const sectionCardStyle = {
  padding: "16px",
  display: "grid",
  gap: "14px"
};

const sectionHeadStyle = {
  display: "grid",
  gap: "4px"
};

const fieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px"
};

const actionRowStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  flexWrap: "wrap"
};

const StudentProfile = () => {
  const [overview, setOverview] = useState(null);
  const [form, setForm] = useState({
    skills: "",
    careerGoal: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestedCGPA, setRequestedCGPA] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError("");
      const [profileResponse, analyticsResponse, attemptHistoryResponse] = await Promise.all([
        apiService.getStudentProfile(),
        apiService.getStudentAnalytics(),
        apiService.getStudentAttemptHistory()
      ]);
      const nextProfile = profileResponse?.profile || null;
      setOverview(
        buildStudentOverviewFromStudentApis({
          profileResponse,
          analyticsResponse,
          attemptHistoryResponse
        })
      );
      setForm({
        skills: Array.isArray(nextProfile?.skills) ? nextProfile.skills.join(", ") : "",
        careerGoal: nextProfile?.careerGoal || ""
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load student profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage("");
      setError("");
      await apiService.updateStudentProfile({
        skills: toTagList(form.skills),
        careerGoal: form.careerGoal.trim()
      });
      setMessage("Profile updated successfully.");
      await loadProfile();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleCgpaRequest = async (event) => {
    event.preventDefault();

    try {
      setRequestSubmitting(true);
      setRequestMessage("");
      await apiService.requestCgpaUpdate(Number(requestedCGPA));
      setRequestMessage("CGPA update request submitted.");
      setRequestedCGPA("");
      setRequestModalOpen(false);
      await loadProfile();
    } catch (requestError) {
      setRequestMessage(requestError?.response?.data?.message || "Unable to submit CGPA request.");
    } finally {
      setRequestSubmitting(false);
    }
  };

  if (loading) {
    return <div className="student-dashboard"><section className="card"><p className="muted-text">Loading profile...</p></section></div>;
  }

  return (
    <div className="student-dashboard">
      <div style={pageShellStyle}>
        <section className="dashboard-header student-profile-header">
          <p className="sidebar-eyebrow">Profile</p>
          <h2>Student Profile</h2>
          <p>Manage your personal details, academic information, and preparation goals in one clean workspace.</p>
        </section>

        {error ? <p className="dashboard-inline-hint error-text">{error}</p> : null}
        {message ? <p className="dashboard-inline-hint">{message}</p> : null}
        {requestMessage ? <p className="dashboard-inline-hint">{requestMessage}</p> : null}

        <form className="student-profile-form" onSubmit={handleSave} style={{ display: "grid", gap: "16px" }}>
          <section className="card student-profile-shell" style={sectionCardStyle}>
            <div style={sectionHeadStyle}>
              <h3>Personal Info</h3>
              <p className="muted-text">Basic account details linked to your student profile.</p>
            </div>
            <div style={fieldGridStyle}>
              <label className="student-profile-field">
                <span>Full Name</span>
                <input value={overview?.personalInfo?.fullName || ""} disabled readOnly />
              </label>
              <label className="student-profile-field">
                <span>Email</span>
                <input value={overview?.personalInfo?.email || ""} disabled readOnly />
              </label>
            </div>
          </section>

          <section className="card student-profile-shell" style={sectionCardStyle}>
            <div style={sectionHeadStyle}>
              <h3>Academic Info</h3>
              <p className="muted-text">Verified academic details and current CGPA request status.</p>
            </div>
            <div style={fieldGridStyle}>
              <label className="student-profile-field">
                <span>Branch</span>
                <input value={overview?.academicInfo?.branch || ""} disabled readOnly />
              </label>
              <label className="student-profile-field">
                <span>Year</span>
                <input value={overview?.academicInfo?.year ?? ""} disabled readOnly />
              </label>
              <label className="student-profile-field">
                <span>CGPA</span>
                <input value={overview?.academicInfo?.cgpa ?? ""} disabled readOnly />
              </label>
              <div className="student-profile-field">
                <span>CGPA Request Status</span>
                <div className="student-profile-status-card">
                  <strong className={`student-profile-status-badge ${overview?.academicInfo?.requestStatusClassName || "status-none"}`}>
                    {overview?.academicInfo?.requestStatusLabel || "No Request"}
                  </strong>
                  <p>{overview?.academicInfo?.requestSummary || "No pending verification workflow."}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="card student-profile-shell" style={sectionCardStyle}>
            <div style={sectionHeadStyle}>
              <h3>Skills &amp; Goals</h3>
              <p className="muted-text">Update the information that powers your recommendations and dashboard previews.</p>
            </div>
            <div style={fieldGridStyle}>
              <label className="student-profile-field">
                <span>Skills</span>
                <input
                  value={form.skills}
                  onChange={(event) => setForm((prev) => ({ ...prev, skills: event.target.value }))}
                  placeholder="React, Java, DBMS"
                />
              </label>
              <label className="student-profile-field">
                <span>Career Goal</span>
                <input
                  value={form.careerGoal}
                  onChange={(event) => setForm((prev) => ({ ...prev, careerGoal: event.target.value }))}
                  placeholder="Backend Developer"
                />
              </label>
            </div>
          </section>

          <div style={actionRowStyle}>
            <button
              className="topbar-logout student-profile-secondary-btn"
              type="button"
              onClick={() => setRequestModalOpen(true)}
            >
              Request CGPA Update
            </button>
            <button className="auth-button student-profile-primary-btn" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>

      {requestModalOpen ? (
        <section className="student-profile-modal-backdrop" onClick={() => !requestSubmitting && setRequestModalOpen(false)}>
          <div className="student-profile-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Request CGPA Update</h3>
            <p className="muted-text">Submit a CGPA change request for admin verification.</p>
            <form onSubmit={handleCgpaRequest}>
              <label className="student-profile-field">
                <span>Requested CGPA</span>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.01"
                  value={requestedCGPA}
                  onChange={(event) => setRequestedCGPA(event.target.value)}
                  required
                />
              </label>
              <div className="student-profile-actions">
                <button className="auth-button" type="submit" disabled={requestSubmitting}>
                  {requestSubmitting ? "Submitting..." : "Submit Request"}
                </button>
                <button className="topbar-logout" type="button" onClick={() => setRequestModalOpen(false)} disabled={requestSubmitting}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default StudentProfile;
