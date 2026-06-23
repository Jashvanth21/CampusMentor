import { useCallback, useEffect, useMemo, useState } from "react";
import apiService from "../../api/apiService";
import AddStudentModal from "./AddStudentModal";
import ConfirmDeleteModal from "../../components/common/ConfirmDeleteModal";
import { BRANCH_FILTER_OPTIONS } from "../../constants/branches";

const YEAR_OPTIONS = ["All", "1", "2", "3", "4"];
const MENTOR_ASSIGNMENT_OPTIONS = [
  { value: "all", label: "All" },
  { value: "assigned", label: "Assigned" },
  { value: "unassigned", label: "Unassigned" }
];
const AdminStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [deleteLoadingId, setDeleteLoadingId] = useState("");
  const [assignLoadingId, setAssignLoadingId] = useState("");
  const [branchFilter, setBranchFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [mentorFilter, setMentorFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [studentPendingDelete, setStudentPendingDelete] = useState(null);
  const [promoteBatchModalOpen, setPromoteBatchModalOpen] = useState(false);
  const [selectedBatchForPromotion, setSelectedBatchForPromotion] = useState("");
  const [promoteBatchLoading, setPromoteBatchLoading] = useState(false);

  const [assignForm, setAssignForm] = useState({
    studentId: "",
    mentorId: ""
  });
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetStudent, setAssignTargetStudent] = useState(null);
  const [availableMentors, setAvailableMentors] = useState([]);
  const [availableMentorsLoading, setAvailableMentorsLoading] = useState(false);

  const mentorOptions = useMemo(() => availableMentors || [], [availableMentors]);
  const batchOptions = useMemo(() => {
    const uniqueBatches = new Set(
      students
        .map((student) => Number(student?.batch))
        .filter((batch) => Number.isFinite(batch))
    );
    return Array.from(uniqueBatches).sort((a, b) => a - b);
  }, [students]);
  const loadStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const studentResponse = await apiService.getAdminStudents({
        branch: branchFilter,
        year: yearFilter,
        mentor: mentorFilter
      });
      setStudents(Array.isArray(studentResponse?.students) ? studentResponse.students : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load students.");
    } finally {
      setLoading(false);
    }
  }, [branchFilter, yearFilter, mentorFilter]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedStudent(null);
    setModalError("");
    setModalOpen(true);
  };

  const openEditModal = (student) => {
    setModalMode("edit");
    setSelectedStudent(student);
    setModalError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (modalSubmitting) return;
    setModalOpen(false);
    setSelectedStudent(null);
    setModalError("");
  };

  const handleStudentSubmit = async (payload) => {
    try {
      setModalSubmitting(true);
      setModalError("");
      if (modalMode === "edit" && selectedStudent?.id) {
        await apiService.updateAdminStudent(selectedStudent.id, payload);
        setToast("Student updated successfully.");
      } else {
        await apiService.createAdminStudent(payload);
        setToast("Student created successfully.");
      }
      setModalOpen(false);
      setSelectedStudent(null);
      await loadStudents();
    } catch (requestError) {
      const apiMessage = requestError?.response?.data?.message || "";
      const duplicateRollNumber =
        apiMessage.toLowerCase().includes("roll number already exists") ||
        apiMessage.toLowerCase().includes("student with this roll number already exists");
      setModalError(
        duplicateRollNumber
          ? "Roll number already exists. Please enter a different roll number."
          : apiMessage || "Unable to save student."
      );
    } finally {
      setModalSubmitting(false);
    }
  };

  const openDeleteModal = (student) => {
    if (deleteLoadingId) return;
    setStudentPendingDelete(student);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = (force = false) => {
    if (!force && deleteLoadingId) return;
    setDeleteModalOpen(false);
    setStudentPendingDelete(null);
  };

  const handleDeleteStudent = async () => {
    if (!studentPendingDelete?.id) {
      return;
    }

    try {
      setDeleteLoadingId(studentPendingDelete.id);
      setError("");
      setToast("");
      await apiService.deleteAdminStudent(studentPendingDelete.id);
      setToast("Student deleted successfully.");
      closeDeleteModal(true);
      await loadStudents();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to delete student.");
    } finally {
      setDeleteLoadingId("");
    }
  };

  const openAssignMentor = (student) => {
    const studentBranch = String(student?.branch || "").trim();
    setAssignForm({
      studentId: student.id,
      mentorId: student.mentorId || ""
    });
    setAssignTargetStudent(student);
    setAvailableMentors([]);
    setAssignModalOpen(true);

    if (!studentBranch) {
      return;
    }

    const loadMentorsForBranch = async () => {
      try {
        setAvailableMentorsLoading(true);
        const mentorResponse = await apiService.getAvailableMentorsByBranch(studentBranch);
        setAvailableMentors(Array.isArray(mentorResponse?.mentors) ? mentorResponse.mentors : []);
      } catch (requestError) {
        setError(requestError?.response?.data?.message || "Unable to load mentors for this branch.");
      } finally {
        setAvailableMentorsLoading(false);
      }
    };

    loadMentorsForBranch();
  };

  const closeAssignModal = (force = false) => {
    if (!force && assignLoadingId) return;
    setAssignModalOpen(false);
    setAssignTargetStudent(null);
    setAvailableMentors([]);
    setAvailableMentorsLoading(false);
    setAssignForm({
      studentId: "",
      mentorId: ""
    });
  };

  const handleAssignMentor = async () => {
    if (!assignForm.studentId || !assignForm.mentorId) {
      setError("Select a mentor before saving.");
      return;
    }

    try {
      setAssignLoadingId(assignForm.studentId);
      setError("");
      await apiService.assignMentorToStudent(assignForm);
      setToast("Mentor assigned successfully.");
      closeAssignModal(true);
      await loadStudents();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to assign mentor.");
    } finally {
      setAssignLoadingId("");
    }
  };

  const openPromoteBatchModal = () => {
    setError("");
    setSelectedBatchForPromotion(batchOptions.length > 0 ? String(batchOptions[0]) : "");
    setPromoteBatchModalOpen(true);
  };

  const closePromoteBatchModal = () => {
    if (promoteBatchLoading) return;
    setPromoteBatchModalOpen(false);
    setSelectedBatchForPromotion("");
  };

  const handlePromoteBatch = async () => {
    const batchValue = Number(selectedBatchForPromotion);
    if (!Number.isFinite(batchValue)) {
      setError("Please select a valid batch.");
      return;
    }

    try {
      setPromoteBatchLoading(true);
      setError("");
      const response = await apiService.promoteBatch(batchValue);
      setToast(response?.message || "Batch promoted successfully.");
      closePromoteBatchModal();
      await loadStudents();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to promote selected batch.");
    } finally {
      setPromoteBatchLoading(false);
    }
  };

  return (
    <div className="student-dashboard">
      <section className="dashboard-header">
        <h2>Students</h2>
        <p>Create, manage, and assign mentors to student accounts.</p>
      </section>

      {toast ? <div className="admin-toast success">{toast}</div> : null}
      {error ? <div className="admin-toast error">{error}</div> : null}

      <section className="card admin-students-toolbar-card">
        <div className="admin-students-toolbar">
          <div className="admin-students-filter-group">
            <label>
              Branch
              <select
                className="admin-select"
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
              >
                {BRANCH_FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Year
              <select
                className="admin-select"
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
              >
                {YEAR_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mentor Assignment
              <select
                className="admin-select"
                value={mentorFilter}
                onChange={(event) => setMentorFilter(event.target.value)}
              >
                {MENTOR_ASSIGNMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-students-toolbar-action">
            <button
              type="button"
              className="topbar-logout admin-action-btn"
              onClick={openPromoteBatchModal}
              disabled={batchOptions.length === 0}
            >
              Promote Batch
            </button>
            <button type="button" className="auth-button admin-action-btn" onClick={openCreateModal}>
              Add Student
            </button>
          </div>
        </div>
      </section>

      <section className="card admin-students-table-card">
        <h3>Student Directory</h3>
        {loading ? <p className="muted-text">Loading students...</p> : null}

        {!loading ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Roll Number</th>
                  <th>Branch</th>
                  <th>Year</th>
                  <th>Batch</th>
                  <th>Section</th>
                  <th>CGPA</th>
                  <th>Status</th>
                  <th>Assigned Mentor</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.name || "-"}</td>
                    <td>{student.rollNumber || "-"}</td>
                    <td>{student.branch || "-"}</td>
                    <td>{student.year ?? "-"}</td>
                    <td>{student.batch ?? "-"}</td>
                    <td>{student.section || "-"}</td>
                    <td>{student.cgpa ?? "-"}</td>
                    <td>
                      {student.status === "Graduated" ? (
                        <span className="status-badge status-badge-graduated">Graduated</span>
                      ) : (
                        <span className="status-badge status-badge-active">Active</span>
                      )}
                    </td>
                    <td>
                      <div className="admin-mentor-cell">
                        {student.mentorName ? (
                          <>
                            <span>{student.mentorName}</span>
                            <span className="status-badge status-badge-assigned">Assigned</span>
                          </>
                        ) : (
                          <>
                            <span>Not Assigned</span>
                            <span className="status-badge status-badge-unassigned">Not Assigned</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="admin-table-actions">
                        <button
                          type="button"
                          className="topbar-logout admin-table-action-btn"
                          onClick={() => openEditModal(student)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="topbar-logout admin-table-action-btn"
                          onClick={() => openDeleteModal(student)}
                          disabled={deleteLoadingId === student.id}
                        >
                          {deleteLoadingId === student.id ? "Deleting..." : "Delete"}
                        </button>
                        <button
                          type="button"
                          className="topbar-logout admin-table-action-btn"
                          onClick={() => openAssignMentor(student)}
                        >
                          Assign Mentor
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {students.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="muted-text">
                      {mentorFilter === "unassigned"
                        ? "No unassigned students found."
                        : mentorFilter === "assigned"
                          ? "No assigned students found."
                          : "No students found for selected filters."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <AddStudentModal
        open={modalOpen}
        mode={modalMode}
        student={selectedStudent}
        error={modalError}
        loading={modalSubmitting}
        onClose={closeModal}
        onSubmit={handleStudentSubmit}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteStudent}
        title="Confirm Deletion"
        message="Are you sure you want to delete this student? This action cannot be undone."
        loading={Boolean(deleteLoadingId)}
        meta={
          <>
            <strong>{studentPendingDelete?.name || "Student"}</strong>
            <span>{studentPendingDelete?.rollNumber || "No roll number"}</span>
          </>
        }
      />

      {promoteBatchModalOpen ? (
        <div className="submit-modal-overlay" role="presentation" onClick={closePromoteBatchModal}>
          <div
            className="submit-modal admin-student-modal"
            role="presentation"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Promote Batch</h3>
            <p>Select the batch to promote.</p>

            <label className="admin-assign-label">
              Select Batch
              <select
                className="admin-select"
                value={selectedBatchForPromotion}
                onChange={(event) => setSelectedBatchForPromotion(event.target.value)}
                disabled={promoteBatchLoading}
              >
                {batchOptions.map((batch) => (
                  <option key={batch} value={batch}>
                    {batch}
                  </option>
                ))}
              </select>
            </label>

            <div className="submit-modal-actions">
              <button
                type="button"
                className="topbar-logout"
                onClick={closePromoteBatchModal}
                disabled={promoteBatchLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="auth-button"
                onClick={handlePromoteBatch}
                disabled={promoteBatchLoading || batchOptions.length === 0}
              >
                {promoteBatchLoading ? "Promoting..." : "Promote Batch"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {assignModalOpen ? (
        <div className="submit-modal-overlay" role="presentation" onClick={closeAssignModal}>
          <div
            className="submit-modal admin-student-modal admin-assign-modal"
            role="presentation"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Assign Mentor</h3>
            <div className="admin-assign-meta">
              <p>
                <strong>Student:</strong> {assignTargetStudent?.name || "-"}
              </p>
              <p>
                <strong>Branch:</strong> {assignTargetStudent?.branch || "-"}
              </p>
            </div>

            <label className="admin-assign-label">
              Mentor
              <select
                className="admin-select"
                value={assignForm.mentorId}
                onChange={(event) => setAssignForm((prev) => ({ ...prev, mentorId: event.target.value }))}
                disabled={availableMentorsLoading || mentorOptions.length === 0}
              >
                <option value="">Select mentor</option>
                {mentorOptions.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.name} ({mentor.department || "-"})
                  </option>
                ))}
              </select>
            </label>

            {availableMentorsLoading ? (
              <p className="muted-text">Loading mentors...</p>
            ) : null}

            {!availableMentorsLoading && mentorOptions.length === 0 ? (
              <p className="muted-text">No mentors available for this branch.</p>
            ) : null}

            <div className="submit-modal-actions">
              <button type="button" className="topbar-logout" onClick={closeAssignModal} disabled={Boolean(assignLoadingId)}>
                Cancel
              </button>
              <button
                type="button"
                className="auth-button"
                onClick={handleAssignMentor}
                disabled={Boolean(assignLoadingId) || mentorOptions.length === 0}
              >
                {assignLoadingId ? "Saving..." : "Assign Mentor"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminStudents;
