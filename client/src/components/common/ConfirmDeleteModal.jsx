const ConfirmDeleteModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  message = "Are you sure you want to delete this item? This action cannot be undone.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  meta = null
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="submit-modal-overlay admin-delete-modal-overlay" role="presentation" onClick={loading ? undefined : onClose}>
      <div
        className="submit-modal admin-student-modal admin-delete-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="confirm-delete-title">{title}</h3>
        <p>{message}</p>
        {meta ? <div className="admin-delete-student-meta">{meta}</div> : null}
        <div className="submit-modal-actions">
          <button type="button" className="topbar-logout" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="button" className="admin-danger-btn" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
