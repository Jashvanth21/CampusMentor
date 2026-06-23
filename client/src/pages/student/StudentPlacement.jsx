import { useEffect, useMemo, useState } from "react";
import apiService from "../../api/apiService";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const getStatusLabel = (status) => {
  if (status === "placed") return "Placed";
  if (status === "rejected") return "Rejected";
  return "Applied";
};

const getDriveStatusClass = (status) =>
  status === "Inactive" ? "student-drive-visibility-badge closed" : "student-drive-visibility-badge open";

const isDeadlinePassed = (value) => {
  if (!value) return false;
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return false;
  return new Date() > deadline;
};

const getApplyState = (drive) => {
  if (drive?.isActive === false) {
    return {
      label: "Inactive",
      disabled: true,
      kind: "inactive"
    };
  }

  if (isDeadlinePassed(drive?.applicationDeadline)) {
    return {
      label: "Closed",
      disabled: true,
      kind: "closed"
    };
  }

  if (!drive?.cgpaEligible) {
    return {
      label: "Not Eligible",
      disabled: true,
      kind: "ineligible"
    };
  }

  if (drive?.alreadyApplied || drive?.applicationStatus) {
    return {
      label: "Applied",
      disabled: true,
      kind: "applied"
    };
  }

  return {
    label: "Apply",
    disabled: false,
    kind: "apply"
  };
};

const StudentPlacement = () => {
  const [placements, setPlacements] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionDriveId, setActionDriveId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPlacements = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await apiService.getStudentPlacements();
      setPlacements(Array.isArray(response?.placements) ? response.placements : []);
      setMyApplications(Array.isArray(response?.myApplications) ? response.myApplications : []);
    } catch (requestError) {
      setError("Unable to load placement drives.");
      setPlacements([]);
      setMyApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlacements();
  }, []);

  const availablePlacements = useMemo(() => placements, [placements]);

  const handleApply = async (driveId) => {
    try {
      setActionDriveId(driveId);
      setError("");
      setMessage("");
      await apiService.applyToPlacementDrive(driveId);
      setMessage("Application submitted successfully.");
      await loadPlacements();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to apply for this drive.");
    } finally {
      setActionDriveId("");
    }
  };

  return (
    <div className="student-dashboard">
      <section className="dashboard-header">
        <h2>Placement Opportunities</h2>
        <p>Track your own applications privately and apply to eligible drives from one place.</p>
        {error ? <span className="dashboard-inline-hint error-text">{error}</span> : null}
        {message ? <span className="dashboard-inline-hint">{message}</span> : null}
      </section>

      <section className="card">
        <div className="section-head">
          <h3>My Applications</h3>
          <span className="score-chip">{myApplications.length} tracked</span>
        </div>

        {loading ? <p className="muted-text">Loading your applications...</p> : null}
        {!loading && myApplications.length === 0 ? <p className="muted-text">You have not applied to any drives yet.</p> : null}

        {!loading && myApplications.length > 0 ? (
          <div className="placement-grid student-application-grid">
            {myApplications.map((application) => (
              <article className="placement-card" key={application.id}>
                <div className="placement-card-head">
                  <h3 className="placement-company">
                    <span>{application.companyName || "Company"}</span>
                  </h3>
                  <div className="student-placement-badge-stack">
                    <span className={getDriveStatusClass(application.driveStatus)}>
                      {application.driveStatus || "Active"}
                    </span>
                    <span className={`eligibility-badge student-application-status status-${application.status}`}>
                      {getStatusLabel(application.status)}
                    </span>
                  </div>
                </div>

                <p><strong>Role:</strong> {application.role || "-"}</p>
                <p><strong>Package:</strong> {application.package || 0} LPA</p>
                <p><strong>Location:</strong> {application.location || "-"}</p>
                <p><strong>Applied On:</strong> {formatDate(application.appliedAt)}</p>
                <p><strong>Drive Date:</strong> {formatDate(application.driveDate)}</p>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="card">
        <div className="section-head">
          <h3>Available Drives</h3>
          <span className="practice-chip">Only your view</span>
        </div>

        {loading ? <p className="muted-text">Loading placement drives...</p> : null}
        {!loading && availablePlacements.length === 0 ? <p className="muted-text">No placement drives available.</p> : null}

        {!loading && availablePlacements.length > 0 ? (
          <div className="placement-grid">
            {availablePlacements.map((drive) => {
              const applyState = getApplyState(drive);
              const driveStatusLabel = drive?.isActive === false ? "Inactive" : "Active";

              return (
                <article className="placement-card" key={drive.id}>
                  <div className="placement-card-head">
                    <h3 className="placement-company">
                      <span>{drive.companyName || "Company"}</span>
                    </h3>
                    <div className="student-placement-badge-stack">
                      <span className={getDriveStatusClass(driveStatusLabel)}>
                        {driveStatusLabel}
                      </span>
                      <span
                        className={`eligibility-badge ${
                          drive.applicationStatus
                            ? `student-application-status status-${drive.applicationStatus}`
                            : drive.eligible
                              ? "eligible"
                              : "student-application-status status-neutral"
                        }`}
                      >
                        {drive.applicationStatus
                          ? getStatusLabel(drive.applicationStatus)
                          : drive.eligible
                            ? "Eligible"
                            : drive.cgpaEligible
                              ? "Not Eligible"
                              : "CGPA Not Met"}
                      </span>
                    </div>
                  </div>

                  <p><strong>Role:</strong> {drive.role || "-"}</p>
                  <p><strong>Package:</strong> {drive.package || 0} LPA</p>
                  <p><strong>Location:</strong> {drive.location || "-"}</p>
                  <p><strong>Drive Date:</strong> {formatDate(drive.driveDate)}</p>
                  <p><strong>Deadline:</strong> {formatDate(drive.applicationDeadline)}</p>
                  <p><strong>CGPA Required:</strong> {drive.cgpaCriteria ?? 0}</p>
                  {!drive.applicationStatus && !drive.cgpaEligible ? (
                    <p className="error-text">Not eligible (CGPA requirement not met)</p>
                  ) : null}
                  {!drive.applicationStatus && drive.reason && drive.cgpaEligible ? (
                    <p className="muted-text">{drive.reason}</p>
                  ) : null}

                  <div className="placement-actions">
                    <button
                      type="button"
                      className={applyState.disabled ? "topbar-logout placement-apply-btn" : "auth-button placement-apply-btn"}
                      disabled={applyState.disabled || actionDriveId === drive.id}
                      onClick={applyState.disabled ? undefined : () => handleApply(drive.id)}
                    >
                      {actionDriveId === drive.id ? "Applying..." : applyState.label}
                    </button>
                    {drive.applyLink ? (
                      <button
                        type="button"
                        className="topbar-logout placement-apply-btn"
                        onClick={() => window.open(drive.applyLink, "_blank", "noopener,noreferrer")}
                      >
                        Apply Link
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default StudentPlacement;
