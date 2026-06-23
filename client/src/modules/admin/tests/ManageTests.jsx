import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../../../api/apiService";
import ConfirmDeleteModal from "../../../components/common/ConfirmDeleteModal";

const formatTestDateTime = (value) => {
  if (!value) {
    return "Not Available";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Not Available";
  }

  return parsedDate.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

const ManageTests = () => {
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [togglingId, setTogglingId] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [testPendingDelete, setTestPendingDelete] = useState(null);
  const resolveTestId = (test) => String(test?._id || test?.id || "");

  const loadTests = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await apiService.getTests();
      const mapped = (response?.tests || []).map((test) => ({
        ...test,
        id: String(test.id || test._id || ""),
        _id: String(test._id || test.id || ""),
        duration: test.duration || "-",
        isPublished: Boolean(test.isPublished),
        startDate: test.startDate || null,
        endDate: test.endDate || null
      }));
      setTests(mapped);
    } catch (requestError) {
      setError("Unable to load tests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTests();
  }, []);

  const onEdit = (testId) => {
    navigate(`/admin/edit-test/${testId}`);
  };

  const openDeleteModal = (test) => {
    if (deletingId) return;
    setTestPendingDelete(test);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = (force = false) => {
    if (!force && deletingId) return;
    setDeleteModalOpen(false);
    setTestPendingDelete(null);
  };

  const onDelete = async () => {
    const testId = resolveTestId(testPendingDelete);
    if (!testId) {
      return;
    }

    try {
      setDeletingId(testId);
      setError("");
      await apiService.deleteMockTest(testId);
      setToast("Deleted successfully");
      closeDeleteModal(true);
      await loadTests();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to delete test.");
    } finally {
      setDeletingId("");
    }
  };

  const onTogglePublish = async (testId) => {
    try {
      setTogglingId(testId);
      setError("");
      await apiService.toggleMockTestPublish(testId);
      await loadTests();
      setToast("Publish status updated successfully.");
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to update publish status.");
    } finally {
      setTogglingId("");
    }
  };

  return (
    <div className="student-dashboard">
      <section className="dashboard-header">
        <h2>Manage Tests</h2>
        <p>Review tests and manage publish workflow.</p>
      </section>

      {toast ? <div className="admin-toast success">{toast}</div> : null}
      {error ? <div className="admin-toast error">{error}</div> : null}

      <section className="card">
        {loading ? <p className="muted-text">Loading tests...</p> : null}

        {!loading ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Subject</th>
                  <th>Duration</th>
                  <th>Published</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test) => (
                  <tr key={resolveTestId(test)}>
                    <td>{test.title}</td>
                    <td>{test.subject === "DSA" ? "Technical" : (test.subject || "Technical")}</td>
                    <td>{test.duration}</td>
                    <td>{test.isPublished ? "Yes" : "No"}</td>
                    <td>{formatTestDateTime(test.startDate)}</td>
                    <td>{formatTestDateTime(test.endDate)}</td>
                    <td>
                      <div className="admin-table-actions">
                        <button type="button" className="topbar-logout" onClick={() => onEdit(resolveTestId(test))}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="topbar-logout"
                          disabled={deletingId === resolveTestId(test)}
                          onClick={() => openDeleteModal(test)}
                        >
                          {deletingId === resolveTestId(test) ? "Deleting..." : "Delete"}
                        </button>
                        <button
                          type="button"
                          className="topbar-logout"
                          disabled={togglingId === resolveTestId(test)}
                          onClick={() => onTogglePublish(resolveTestId(test))}
                        >
                          {togglingId === resolveTestId(test) ? "Updating..." : "Toggle Publish"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {tests.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="muted-text">
                      No tests found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={onDelete}
        title="Confirm Deletion"
        message="Are you sure you want to delete this test? This action cannot be undone."
        loading={Boolean(deletingId)}
        meta={
          <>
            <strong>{testPendingDelete?.title || "Test"}</strong>
            <span>{testPendingDelete?.subject || "No subject"}</span>
          </>
        }
      />
    </div>
  );
};

export default ManageTests;
