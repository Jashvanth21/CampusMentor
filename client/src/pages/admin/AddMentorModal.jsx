import { useEffect, useState } from "react";
import { BRANCH_OPTIONS, normalizeBranch } from "../../constants/branches";

const getInitialForm = (mentor) => ({
  name: mentor?.name || "",
  email: mentor?.email || "",
  password: "",
  department: normalizeBranch(mentor?.department) || ""
});

const AddMentorModal = ({
  open,
  onClose,
  onSubmit,
  loading = false,
  mode = "create",
  mentor = null
}) => {
  const [form, setForm] = useState(getInitialForm(mentor));

  useEffect(() => {
    setForm(getInitialForm(mentor));
  }, [mentor, open]);

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
    onSubmit(form);
  };

  return (
    <div className="submit-modal-overlay" role="presentation" onClick={onClose}>
      <div className="submit-modal admin-student-modal" role="presentation" onClick={(event) => event.stopPropagation()}>
        <h3>{mode === "edit" ? "Edit Mentor" : "Add Mentor"}</h3>
        <p>{mode === "edit" ? "Update mentor account details." : "Create a mentor account."}</p>

        <form className="admin-form admin-modal-form" onSubmit={handleSubmit}>
          <div className="admin-form-grid">
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
              Department
              <select
                value={form.department}
                onChange={(event) => handleChange("department", event.target.value)}
              >
                <option value="">Select department</option>
                {BRANCH_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="submit-modal-actions">
            <button type="button" className="topbar-logout" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? "Saving..." : mode === "edit" ? "Update Mentor" : "Add Mentor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMentorModal;
