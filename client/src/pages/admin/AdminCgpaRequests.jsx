import { useEffect, useState } from "react";
import apiService from "../../api/apiService";

const formatDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString();
};

const AdminCgpaRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState("");

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await apiService.getAdminCgpaRequests();
      setRequests(Array.isArray(response?.requests) ? response.requests : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load CGPA requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleReview = async (requestId, status) => {
    try {
      setActionLoadingId(requestId);
      setError("");
      await apiService.reviewAdminCgpaRequest(requestId, status);
      await loadRequests();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to review CGPA request.");
    } finally {
      setActionLoadingId("");
    }
  };

  return (
    <div className="student-dashboard">
      <section className="dashboard-header">
        <p className="sidebar-eyebrow">Verification Queue</p>
        <h2>CGPA Requests</h2>
        <p>Approve or reject student CGPA change requests after verification.</p>
      </section>

      {error ? <p className="dashboard-inline-hint error-text">{error}</p> : null}

      <section className="card">
        <div className="section-head">
          <h3>Pending and Reviewed Requests</h3>
          <span className="score-chip">{requests.length} total</span>
        </div>
        {loading ? (
          <p className="muted-text">Loading CGPA requests...</p>
        ) : requests.length === 0 ? (
          <p className="muted-text">No CGPA requests found.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Current CGPA</th>
                  <th>Requested CGPA</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.studentName || "Student"}</strong>
                      <br />
                      <span className="muted-text">{item.studentEmail || "-"}</span>
                    </td>
                    <td>{item.currentCGPA}</td>
                    <td>{item.requestedCGPA}</td>
                    <td>{item.status}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      {item.status === "pending" ? (
                        <div className="admin-cgpa-actions">
                          <button
                            className="admin-table-action-btn"
                            type="button"
                            disabled={actionLoadingId === item.id}
                            onClick={() => handleReview(item.id, "approved")}
                          >
                            Approve
                          </button>
                          <button
                            className="admin-table-action-btn admin-table-action-btn-danger"
                            type="button"
                            disabled={actionLoadingId === item.id}
                            onClick={() => handleReview(item.id, "rejected")}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="muted-text">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminCgpaRequests;
