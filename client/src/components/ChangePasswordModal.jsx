import { useEffect, useState } from "react";
import apiService from "../api/apiService";

const defaultForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setForm(defaultForm);
      setSubmitting(false);
      setError("");
      setMessage("");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError("All password fields are required.");
      return;
    }

    if (form.newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirm password must match.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiService.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });
      setMessage(response?.message || "Password changed successfully.");
      setForm(defaultForm);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to change password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="student-profile-modal-backdrop change-password-backdrop" onClick={() => !submitting && onClose()}>
      <div className="student-profile-modal change-password-modal" onClick={(event) => event.stopPropagation()}>
        <h3>Change Password</h3>
        <p className="muted-text">Update your password securely. Your current password is required.</p>
        {error ? <p className="dashboard-inline-hint error-text">{error}</p> : null}
        {message ? <p className="dashboard-inline-hint">{message}</p> : null}
        <form className="student-profile-form" onSubmit={handleSubmit}>
          <label className="student-profile-field">
            <span>Current Password</span>
            <input
              type="password"
              name="currentPassword"
              value={form.currentPassword}
              onChange={handleChange}
              autoComplete="current-password"
            />
          </label>
          <label className="student-profile-field">
            <span>New Password</span>
            <input
              type="password"
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </label>
          <label className="student-profile-field">
            <span>Confirm Password</span>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </label>
          <div className="student-profile-actions">
            <button className="auth-button" type="submit" disabled={submitting}>
              {submitting ? "Updating..." : "Update Password"}
            </button>
            <button className="topbar-logout" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default ChangePasswordModal;
