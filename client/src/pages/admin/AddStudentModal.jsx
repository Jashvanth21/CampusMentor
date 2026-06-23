import { useEffect, useState } from "react";
import { BRANCH_OPTIONS, normalizeBranch } from "../../constants/branches";

const getInitialForm = (student) => ({
  name: student?.name || "",
  email: student?.email || "",
  password: "",
  branch: normalizeBranch(student?.branch) || "",
  year: student?.year ?? "",
  batch: student?.batch ?? "",
  section: student?.section || "",
  rollNumber: student?.rollNumber || "",
  cgpa: student?.cgpa ?? "",
  status: student?.status || "Active"
});

const AddStudentModal = ({
  open,
  onClose,
  onSubmit,
  error = "",
  loading = false,
  mode = "create",
  student = null
}) => {
  const [form, setForm] = useState(getInitialForm(student));

  useEffect(() => {
    setForm(getInitialForm(student));
  }, [student, open]);

  if (!open) {
    return null;
  }

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      ...form,
      year: form.year === "" ? null : Number(form.year),
      batch: form.batch === "" ? null : Number(form.batch),
      cgpa: form.cgpa === "" ? null : Number(form.cgpa)
    });
  };

  return (
    <div className="submit-modal-overlay" role="presentation" onClick={onClose}>
      <div className="submit-modal admin-student-modal" role="presentation" onClick={(event) => event.stopPropagation()}>
        <h3>{mode === "edit" ? "Edit Student" : "Add Student"}</h3>
        <p>{mode === "edit" ? "Update student account details." : "Create a student account."}</p>

        <form className="admin-form admin-modal-form" onSubmit={handleSubmit}>
          {error ? (
            <div className="error-box" role="alert">
              {error}
            </div>
          ) : null}

          <section className="admin-student-form-section">
            <h4>Basic Information</h4>
            <div className="admin-student-form-grid">
              <label>
                Name
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => handleChange("name", event.target.value)}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => handleChange("email", event.target.value)}
                  required
                />
              </label>
              <label>
                Password {mode === "edit" ? "(Optional)" : ""}
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => handleChange("password", event.target.value)}
                  required={mode !== "edit"}
                  minLength={mode !== "edit" ? 8 : 0}
                  placeholder={mode === "edit" ? "Leave blank to keep current password" : ""}
                />
              </label>
              <label>
                Branch
                <select
                  value={form.branch}
                  onChange={(event) => handleChange("branch", event.target.value)}
                >
                  <option value="">Select branch</option>
                  {BRANCH_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="admin-student-form-section">
            <h4>Academic Information</h4>
            <div className="admin-student-form-grid">
              <label>
                Year
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={form.year}
                  onChange={(event) => handleChange("year", event.target.value)}
                />
              </label>
              <label>
                Batch
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={form.batch}
                  placeholder="Enter batch (e.g., 2024)"
                  onChange={(event) => handleChange("batch", event.target.value)}
                />
              </label>
              <label>
                Section
                <input
                  type="text"
                  value={form.section}
                  onChange={(event) => handleChange("section", event.target.value)}
                />
              </label>
              <label>
                Roll Number
                <input
                  type="text"
                  value={form.rollNumber}
                  onChange={(event) => handleChange("rollNumber", event.target.value)}
                  required
                />
              </label>
            </div>
          </section>

          <section className="admin-student-form-section">
            <h4>Performance</h4>
            <div className="admin-student-form-grid">
              <label>
                CGPA
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.01"
                  value={form.cgpa}
                  onChange={(event) => handleChange("cgpa", event.target.value)}
                />
              </label>
              {mode === "edit" ? (
                <label>
                  Status
                  <select
                    value={form.status}
                    onChange={(event) => handleChange("status", event.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Graduated">Graduated</option>
                  </select>
                </label>
              ) : (
                <div />
              )}
            </div>
          </section>

          <div className="submit-modal-actions admin-modal-actions-split">
            <button type="button" className="topbar-logout" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? "Saving..." : mode === "edit" ? "Update Student" : "Add Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStudentModal;
