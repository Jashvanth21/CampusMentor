import { useEffect, useState } from "react";
import apiService from "../../api/apiService";
import AddMentorModal from "./AddMentorModal";
import ConfirmDeleteModal from "../../components/common/ConfirmDeleteModal";
import { BRANCH_FILTER_OPTIONS } from "../../constants/branches";

const AdminMentors = () => {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [deleteLoadingId, setDeleteLoadingId] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [mentorPendingDelete, setMentorPendingDelete] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const loadMentors = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await apiService.getAdminMentors({ department: departmentFilter });
      setMentors(Array.isArray(response?.mentors) ? response.mentors : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load mentors.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentors();
  }, [departmentFilter]);

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedMentor(null);
    setModalOpen(true);
  };

  const openEditModal = (mentor) => {
    setModalMode("edit");
    setSelectedMentor(mentor);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (modalSubmitting) return;
    setModalOpen(false);
    setSelectedMentor(null);
  };

  const handleMentorSubmit = async (payload) => {
    try {
      setModalSubmitting(true);
      setError("");
      if (modalMode === "edit" && selectedMentor?.id) {
        await apiService.updateAdminMentor(selectedMentor.id, payload);
        setToast("Mentor updated successfully.");
      } else {
        await apiService.createAdminMentor(payload);
        setToast("Mentor created successfully.");
      }
      setModalOpen(false);
      setSelectedMentor(null);
      await loadMentors();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to save mentor.");
    } finally {
      setModalSubmitting(false);
    }
  };

  const openDeleteModal = (mentor) => {
    if (deleteLoadingId) return;
    setMentorPendingDelete(mentor);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = (force = false) => {
    if (!force && deleteLoadingId) return;
    setDeleteModalOpen(false);
    setMentorPendingDelete(null);
  };

  const handleDeleteMentor = async () => {
    if (!mentorPendingDelete?.id) {
      return;
    }

    try {
      setDeleteLoadingId(mentorPendingDelete.id);
      setError("");
      setToast("");
      await apiService.deleteAdminMentor(mentorPendingDelete.id);
      setToast("Deleted successfully");
      closeDeleteModal(true);
      await loadMentors();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to delete mentor.");
    } finally {
      setDeleteLoadingId("");
    }
  };

  return (
    <div className="student-dashboard">
      <section className="dashboard-header">
        <h2>Mentors</h2>
        <p>Add mentors and monitor current student assignment load.</p>
      </section>

      {toast ? <div className="admin-toast success">{toast}</div> : null}
      {error ? <div className="admin-toast error">{error}</div> : null}

      <section className="card">
        <div className="admin-students-toolbar">
          <div className="admin-analytics-filters">
            <label>
              Department
              <select
                className="admin-select"
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
              >
                {BRANCH_FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-action-row">
            <button type="button" className="auth-button admin-action-btn" onClick={openCreateModal}>
              Add Mentor
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <h3>Mentor List</h3>
        {loading ? <p className="muted-text">Loading mentors...</p> : null}
        {!loading ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Students Assigned</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mentors.map((mentor) => (
                  <tr key={mentor.id}>
                    <td>{mentor.name || "-"}</td>
                    <td>{mentor.email || "-"}</td>
                    <td>{mentor.department || "-"}</td>
                    <td>{mentor.studentsAssigned ?? 0}</td>
                    <td>
                      <div className="admin-table-actions">
                        <button type="button" className="topbar-logout" onClick={() => openEditModal(mentor)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="topbar-logout"
                          onClick={() => openDeleteModal(mentor)}
                          disabled={deleteLoadingId === mentor.id}
                        >
                          {deleteLoadingId === mentor.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {mentors.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="muted-text">
                      {departmentFilter !== "All"
                        ? "No mentors found for selected department."
                        : "No mentors found."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <AddMentorModal
        open={modalOpen}
        mode={modalMode}
        mentor={selectedMentor}
        loading={modalSubmitting}
        onClose={closeModal}
        onSubmit={handleMentorSubmit}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteMentor}
        title="Confirm Deletion"
        message="Are you sure you want to delete this mentor? This action cannot be undone."
        loading={Boolean(deleteLoadingId)}
        meta={
          <>
            <strong>{mentorPendingDelete?.name || "Mentor"}</strong>
            <span>{mentorPendingDelete?.email || "No email"}</span>
          </>
        }
      />
    </div>
  );
};

export default AdminMentors;
