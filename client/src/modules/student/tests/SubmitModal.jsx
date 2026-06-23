const SubmitModal = ({ open, attempted, unattempted, submitting, onClose, onConfirm }) => {
  if (!open) return null;

  return (
    <div className="submit-modal-overlay" role="presentation">
      <div className="submit-modal" role="dialog" aria-modal="true" aria-labelledby="submit-modal-title">
        <h3 id="submit-modal-title">Confirm Submission</h3>
        <p>Review your attempt before final submit.</p>

        <div className="submit-modal-stats">
          <div>
            <strong>{attempted}</strong>
            <span>Attempted</span>
          </div>
          <div>
            <strong>{unattempted}</strong>
            <span>Unattempted</span>
          </div>
        </div>

        <div className="submit-modal-actions">
          <button type="button" className="topbar-logout" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="auth-button" onClick={onConfirm} disabled={submitting}>
            {submitting ? "Submitting..." : "Confirm Submit"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubmitModal;
