import { useEffect, useMemo, useRef, useState } from "react";
import apiService from "../../api/apiService";
import ConfirmDeleteModal from "../../components/common/ConfirmDeleteModal";
import { BRANCH_OPTIONS, normalizeBranchList } from "../../constants/branches";

const initialForm = {
  companyName: "",
  role: "",
  package: "",
  location: "",
  cgpaCriteria: "",
  branchesEligible: "",
  eligibleBatches: "",
  testType: "",
  driveDate: "",
  applicationDeadline: "",
  applyLink: "",
  description: ""
};

const EMPTY_SUMMARY = {
  totalDrives: 0,
  activeDrives: 0,
  totalApplications: 0,
  totalPlaced: 0,
  totalPlacedStudents: 0,
  recentPlacements: []
};

const STATUS_FILTERS = [
  { value: "all", label: "Show All" },
  { value: "applied", label: "Applied" },
  { value: "selected", label: "Placed" },
  { value: "rejected", label: "Rejected" }
];

const normalizePipelineStatus = (status) => {
  const normalizedStatus = String(status || "applied").trim().toLowerCase();
  if (normalizedStatus === "placed") return "selected";
  if (normalizedStatus === "selected") return "selected";
  if (normalizedStatus === "rejected") return "rejected";
  return "applied";
};

const getStatusLabel = (status) => {
  const normalizedStatus = normalizePipelineStatus(status);
  if (normalizedStatus === "selected") return "Placed";
  if (normalizedStatus === "rejected") return "Rejected";
  return "Applied";
};

const getFilterLabel = (value) => {
  if (value === "all") return "All";
  return getStatusLabel(value);
};

const getStatusBadgeClass = (status) => {
  const normalizedStatus = normalizePipelineStatus(status);
  const className = normalizedStatus === "selected" ? "placed" : normalizedStatus;
  return `status-badge admin-drive-status-badge status-${className}`;
};

const getDriveApplications = (drive) => {
  const driveApplications = Array.isArray(drive?.applications) ? drive.applications : [];
  const seen = new Set();

  return driveApplications
    .map((application) => ({
      ...application,
      status: normalizePipelineStatus(application?.status)
    }))
    .filter((application) => {
      const key = String(application?.id || `${application?.studentId || "student"}-${application?.status || "applied"}`);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort(
      (left, right) =>
        new Date(right?.updatedAt || right?.createdAt || 0).getTime() -
        new Date(left?.updatedAt || left?.createdAt || 0).getTime()
    );
};

const getDriveCounts = (applications = []) => ({
  total: applications.length,
  applied: applications.filter((application) => application.status === "applied").length,
  selected: applications.filter((application) => application.status === "selected").length,
  rejected: applications.filter((application) => application.status === "rejected").length
});

const ActionIcon = ({ type }) => {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: "admin-drive-action-icon"
  };

  if (type === "placed") {
    return (
      <svg {...commonProps}>
        <path d="m5 13 4 4L19 7" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="m18 6-12 12" />
      <path d="m6 6 12 12" />
    </svg>
  );
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
};

const formatCgpa = (value) => {
  if (!Number.isFinite(Number(value))) return "-";
  return Number(value).toFixed(1);
};

const isDriveCompleted = (value) => {
  if (!value) return false;
  const driveDate = new Date(value);
  if (Number.isNaN(driveDate.getTime())) return false;
  return new Date() >= driveDate;
};

const AdminPlacement = () => {
  const [drives, setDrives] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState("");
  const [deleteLoadingId, setDeleteLoadingId] = useState("");
  const [toggleLoadingId, setToggleLoadingId] = useState("");
  const [openMenuId, setOpenMenuId] = useState("");
  const [statusFilters, setStatusFilters] = useState({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [drivePendingDelete, setDrivePendingDelete] = useState(null);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const actionsMenuRef = useRef(null);
  const branchDropdownRef = useRef(null);

  const loadDrives = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await apiService.getPlacementDrives();
      setDrives(Array.isArray(response?.drives) ? response.drives : []);
      setSummary(response?.summary || EMPTY_SUMMARY);
    } catch (requestError) {
      setError("Unable to load placement drives.");
      setDrives([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrives();
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!actionsMenuRef.current?.contains(event.target)) {
        setOpenMenuId("");
      }
      if (!branchDropdownRef.current?.contains(event.target)) {
        setBranchDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!branchDropdownOpen) {
      setBranchSearch("");
    }
  }, [branchDropdownOpen]);

  const selectedBranches = useMemo(
    () => normalizeBranchList(form.branchesEligible),
    [form.branchesEligible]
  );

  const filteredBranchOptions = useMemo(() => {
    const query = branchSearch.trim().toLowerCase();
    if (!query) return BRANCH_OPTIONS;
    return BRANCH_OPTIONS.filter((option) => option.toLowerCase().includes(query));
  }, [branchSearch]);

  const allBranchesSelected = selectedBranches.length === BRANCH_OPTIONS.length;

  const payload = useMemo(
    () => ({
      companyName: form.companyName.trim(),
      role: form.role.trim(),
      package: Number(form.package) || 0,
      location: form.location.trim(),
      cgpaCriteria: Number(form.cgpaCriteria) || 0,
      branchesEligible: normalizeBranchList(form.branchesEligible),
      eligibleBatches: form.eligibleBatches
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item)),
      testType: form.testType.trim(),
      driveDate: form.driveDate || null,
      applicationDeadline: form.applicationDeadline || null,
      applyLink: form.applyLink.trim(),
      description: form.description.trim()
    }),
    [form]
  );

  const resetForm = () => {
    setForm(initialForm);
    setEditingId("");
    setBranchDropdownOpen(false);
    setBranchSearch("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBranchEligibilityChange = (nextBranches) => {
    setForm((prev) => ({ ...prev, branchesEligible: normalizeBranchList(nextBranches).join(", ") }));
  };

  const handleBranchToggle = (branch) => {
    const nextBranches = selectedBranches.includes(branch)
      ? selectedBranches.filter((item) => item !== branch)
      : [...selectedBranches, branch];

    handleBranchEligibilityChange(nextBranches);
  };

  const handleAllBranchesToggle = () => {
    handleBranchEligibilityChange(allBranchesSelected ? [] : BRANCH_OPTIONS);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      if (editingId) {
        await apiService.updatePlacementDrive(editingId, payload);
        setMessage("Placement drive updated.");
      } else {
        await apiService.createPlacementDrive(payload);
        setMessage("Placement drive created.");
      }
      resetForm();
      await loadDrives();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to save placement drive.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (drive) => {
    setEditingId(String(drive.id));
    setForm({
      companyName: drive.companyName || "",
      role: drive.role || "",
      package: String(drive.package ?? ""),
      location: drive.location || "",
      cgpaCriteria: String(drive.cgpaCriteria ?? ""),
      branchesEligible: normalizeBranchList(drive.branchesEligible).join(", "),
      eligibleBatches: Array.isArray(drive.eligibleBatches) ? drive.eligibleBatches.join(", ") : "",
      testType: drive.testType || "",
      driveDate: toDateInputValue(drive.driveDate),
      applicationDeadline: toDateInputValue(drive.applicationDeadline),
      applyLink: drive.applyLink || "",
      description: drive.description || ""
    });
  };

  const openDeleteModal = (drive) => {
    if (deleteLoadingId) return;
    setDrivePendingDelete(drive);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = (force = false) => {
    if (!force && deleteLoadingId) return;
    setDeleteModalOpen(false);
    setDrivePendingDelete(null);
  };

  const handleDelete = async () => {
    if (!drivePendingDelete?.id) {
      return;
    }

    try {
      setDeleteLoadingId(drivePendingDelete.id);
      setError("");
      setMessage("");
      await apiService.deletePlacementDrive(drivePendingDelete.id);
      setMessage("Deleted successfully");
      if (String(editingId) === String(drivePendingDelete.id)) {
        resetForm();
      }
      closeDeleteModal(true);
      await loadDrives();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Failed to delete placement drive.");
    }
    finally {
      setDeleteLoadingId("");
    }
  };

  const handleToggleDriveStatus = async (driveId) => {
    try {
      setToggleLoadingId(driveId);
      setError("");
      setMessage("");
      const response = await apiService.togglePlacementDriveStatus(driveId);
      const updatedDrive = response?.drive || null;

      setDrives((current) =>
        current.map((drive) => (String(drive.id) === String(driveId) && updatedDrive ? updatedDrive : drive))
      );
      setSummary((current) => {
        const nextDrives = drives.map((drive) =>
          String(drive.id) === String(driveId) && updatedDrive ? updatedDrive : drive
        );
        return {
          ...current,
          activeDrives: nextDrives.filter((drive) => drive?.isActive).length
        };
      });
      setMessage(response?.message || "Drive status updated.");
      await loadDrives();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to update drive status.");
    } finally {
      setToggleLoadingId("");
    }
  };

  const handleStatusUpdate = async (driveId, applicationId, status) => {
    try {
      setActionLoadingKey(`${driveId}-${applicationId}-${status}`);
      setError("");
      setMessage("");
      setOpenMenuId("");
      await apiService.updatePlacementApplicationStatus(
        driveId,
        applicationId,
        status === "selected" ? "placed" : status
      );
      setMessage(
        status === "selected"
          ? "Student marked as placed."
          : "Application updated."
      );
      await loadDrives();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to update application status.");
    } finally {
      setActionLoadingKey("");
    }
  };

  const handleDriveFilterChange = (driveId, nextFilter) => {
    setStatusFilters((current) => ({
      ...current,
      [driveId]: nextFilter
    }));
  };

  const summaryCards = [
    { label: "Total Drives", value: summary.totalDrives },
    { label: "Active Drives", value: summary.activeDrives },
    { label: "Total Applications", value: summary.totalApplications },
    { label: "Total Placed", value: summary.totalPlacedStudents || summary.totalPlaced }
  ];

  return (
    <div className="student-dashboard admin-drives-page">
      <section className="dashboard-header">
        <h2>Placement Management</h2>
        <p>Create drives, review applicants, mark placements, and track company-wise outcomes.</p>
        {error ? <span className="dashboard-inline-hint error-text">{error}</span> : null}
        {message ? <span className="dashboard-inline-hint">{message}</span> : null}
      </section>

      <section className="stats-grid admin-drives-summary-grid">
        {summaryCards.map((card) => (
          <article className="stat-card admin-drives-summary-card" key={card.label}>
            <p className="stat-label">{card.label}</p>
            <p className="stat-value">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="card">
        <h3>{editingId ? "Edit Drive" : "Add Drive"}</h3>
        <form className="admin-form admin-form-grid" onSubmit={handleSubmit}>
          <label>
            Company Name
            <input name="companyName" value={form.companyName} onChange={handleChange} required />
          </label>
          <label>
            Role
            <input name="role" value={form.role} onChange={handleChange} required />
          </label>
          <label>
            Package (LPA)
            <input name="package" type="number" min="0" step="0.1" value={form.package} onChange={handleChange} />
          </label>
          <label>
            Location
            <input name="location" value={form.location} onChange={handleChange} />
          </label>
          <label>
            CGPA Criteria
            <input
              name="cgpaCriteria"
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={form.cgpaCriteria}
              onChange={handleChange}
            />
          </label>
          <label className="admin-branch-multiselect-label">
            Eligible Branches
            <div
              className={`admin-branch-multiselect ${branchDropdownOpen ? "open" : ""}`}
              ref={branchDropdownRef}
            >
              <button
                type="button"
                className="admin-branch-multiselect-trigger"
                onClick={() => setBranchDropdownOpen((current) => !current)}
                aria-haspopup="listbox"
                aria-expanded={branchDropdownOpen}
              >
                <span className="admin-branch-chip-row">
                  {selectedBranches.length === 0 ? (
                    <span className="admin-branch-placeholder">Select branches</span>
                  ) : (
                    selectedBranches.map((branch) => (
                      <span className="admin-branch-chip" key={branch}>
                        {branch}
                      </span>
                    ))
                  )}
                </span>
                <span className="admin-branch-chevron" aria-hidden>
                  v
                </span>
              </button>

              {branchDropdownOpen ? (
                <div className="admin-branch-dropdown" role="listbox" aria-multiselectable="true">
                  <input
                    className="admin-branch-search"
                    type="search"
                    placeholder="Search branches"
                    value={branchSearch}
                    onChange={(event) => setBranchSearch(event.target.value)}
                  />
                  <button
                    type="button"
                    className={`admin-branch-option admin-branch-option-all ${allBranchesSelected ? "selected" : ""}`}
                    onClick={handleAllBranchesToggle}
                  >
                    <span className="admin-branch-checkbox" aria-hidden />
                    <span>All branches</span>
                  </button>
                  <div className="admin-branch-option-list">
                    {filteredBranchOptions.map((option) => {
                      const selected = selectedBranches.includes(option);

                      return (
                        <button
                          type="button"
                          className={`admin-branch-option ${selected ? "selected" : ""}`}
                          key={option}
                          onClick={() => handleBranchToggle(option)}
                          role="option"
                          aria-selected={selected}
                        >
                          <span className="admin-branch-checkbox" aria-hidden />
                          <span>{option}</span>
                        </button>
                      );
                    })}
                    {filteredBranchOptions.length === 0 ? (
                      <p className="admin-branch-empty">No branches found</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </label>
          <label>
            Eligible Batches (comma separated)
            <input
              name="eligibleBatches"
              placeholder="2025,2026"
              value={form.eligibleBatches}
              onChange={handleChange}
            />
          </label>
          <label>
            Test Type
            <input name="testType" value={form.testType} onChange={handleChange} />
          </label>
          <label>
            Drive Date
            <input name="driveDate" type="date" value={form.driveDate} onChange={handleChange} />
          </label>
          <label>
            Application Deadline
            <input
              name="applicationDeadline"
              type="date"
              value={form.applicationDeadline}
              onChange={handleChange}
            />
          </label>
          <label>
            Apply Link
            <input name="applyLink" type="url" value={form.applyLink} onChange={handleChange} />
          </label>
          <label className="admin-field-full">
            Description
            <input name="description" value={form.description} onChange={handleChange} />
          </label>

          <div className="admin-action-row admin-field-full">
            <button type="submit" className="auth-button" disabled={submitting}>
              {submitting ? "Saving..." : editingId ? "Update Drive" : "Add Drive"}
            </button>
            {editingId ? (
              <button type="button" className="topbar-logout" onClick={resetForm}>
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <h3>Drive List</h3>
            <p className="admin-dashboard-card-copy">Review drive details, active applicants, and placed students for each company.</p>
          </div>
          <span className="practice-chip">{summary.totalApplications} applications</span>
        </div>

        {loading ? <p className="muted-text">Loading placement drives...</p> : null}
        {!loading && drives.length === 0 ? <p className="muted-text">No placement drives available.</p> : null}

        {!loading && drives.length > 0 ? (
          <div className="placement-grid admin-drive-grid">
            {drives.map((drive) => (
              <article className="placement-card admin-drive-card" key={drive.id}>
                {(() => {
                  const driveApplications = getDriveApplications(drive);
                  const driveCounts = getDriveCounts(driveApplications);
                  const visibleFilter = statusFilters[drive.id] || "all";
                  const filteredPipelineStudents = driveApplications.filter((application) => {
                    if (visibleFilter === "all") {
                      return true;
                    }
                    return application.status === visibleFilter;
                  });
                  const isDriveDateCompleted = isDriveCompleted(drive.driveDate);

                  return (
                    <>
                <div className="placement-card-head admin-drive-card-head">
                  <div>
                    <h3>{drive.companyName}</h3>
                    <p className="admin-drive-role">{drive.role}</p>
                  </div>
                  <div className="admin-drive-head-badges">
                    <span className={`eligibility-badge ${drive.isActive ? "eligible" : "warning"}`}>
                      {drive.isActive ? "Active" : "Inactive"}
                    </span>
                    <span className={`eligibility-badge ${isDriveCompleted(drive.driveDate) ? "eligible" : "student-application-status status-neutral"}`}>
                      {isDriveCompleted(drive.driveDate) ? "Drive Completed" : "Drive Upcoming"}
                    </span>
                  </div>
                </div>

                <section className="admin-drive-section">
                  <div className="admin-drive-section-head">
                    <h4>Drive Details</h4>
                  </div>
                  <div className="admin-drive-detail-grid">
                    <p><strong>Package:</strong> {drive.package || 0} LPA</p>
                    <p><strong>Location:</strong> {drive.location || "-"}</p>
                    <p><strong>CGPA Criteria:</strong> {drive.cgpaCriteria ?? 0}</p>
                    <p><strong>Test Type:</strong> {drive.testType || "-"}</p>
                    <p><strong>Branches:</strong> {(drive.branchesEligible || []).join(", ") || "All"}</p>
                    <p><strong>Batches:</strong> {(drive.eligibleBatches || []).join(", ") || "All"}</p>
                    <p><strong>Drive Date:</strong> {formatDate(drive.driveDate)}</p>
                    <p><strong>Deadline:</strong> {formatDate(drive.applicationDeadline)}</p>
                  </div>
                </section>

                <section className="admin-drive-section">
                  <div className="admin-drive-section-head">
                    <h4>Applicant Pipeline ({driveCounts.total})</h4>
                    <span className="admin-drive-section-copy">
                      Manage all applications in one pipeline.
                    </span>
                  </div>
                  <div className="admin-drive-filter-row" role="tablist" aria-label={`Application filters for ${drive.companyName}`}>
                    {STATUS_FILTERS.map((filter) => (
                      <button
                        key={`${drive.id}-${filter.value}`}
                        type="button"
                        className={`admin-drive-filter-chip${visibleFilter === filter.value ? " active" : ""}`}
                        onClick={() => handleDriveFilterChange(drive.id, filter.value)}
                      >
                        {getFilterLabel(filter.value)} ({filter.value === "all" ? driveCounts.total : driveCounts[filter.value] || 0})
                      </button>
                    ))}
                  </div>
                  {filteredPipelineStudents.length > 0 ? (
                    <div className="admin-drive-list admin-drive-list-scroll">
                      {filteredPipelineStudents.map((application) => {
                        const menuId = `${drive.id}:${application.id}`;
                        const isMenuOpen = openMenuId === menuId;
                        const markingPlaced = actionLoadingKey === `${drive.id}-${application.id}-selected`;
                        const rejecting = actionLoadingKey === `${drive.id}-${application.id}-rejected`;

                        return (
                        <article className="admin-drive-student-row" key={application.id}>
                          <div className="admin-drive-student-main">
                            <div>
                              <strong>{application.studentName}</strong>
                              <p>
                                {application.branch} | CGPA {formatCgpa(application.cgpa)}
                              </p>
                            </div>
                            <span className={getStatusBadgeClass(application.status)}>
                              {getStatusLabel(application.status)}
                            </span>
                          </div>
                          <div className="admin-drive-row-actions" ref={isMenuOpen ? actionsMenuRef : null}>
                            <button
                              type="button"
                              className={`topbar-logout admin-drive-action-trigger${isMenuOpen ? " open" : ""}`}
                              onClick={() => setOpenMenuId((current) => (current === menuId ? "" : menuId))}
                            >
                              Actions
                              <span className="admin-drive-action-trigger-dots" aria-hidden>
                                ...
                              </span>
                            </button>
                            {isMenuOpen ? (
                              <div className="admin-drive-actions-menu">
                                <button
                                  type="button"
                                  className="admin-drive-actions-menu-item"
                                  disabled={markingPlaced || !isDriveDateCompleted || application.status === "selected"}
                                  title={
                                    isDriveDateCompleted
                                      ? "Mark student as placed"
                                      : "Mark as placed is available only after the drive date"
                                  }
                                  onClick={() => handleStatusUpdate(drive.id, application.id, "selected")}
                                >
                                  <ActionIcon type="placed" />
                                  <span>{markingPlaced ? "Updating..." : application.status === "selected" ? "Placed" : "Mark as Placed"}</span>
                                </button>
                                <button
                                  type="button"
                                  className="admin-drive-actions-menu-item danger"
                                  disabled={rejecting || application.status === "rejected"}
                                  onClick={() => handleStatusUpdate(drive.id, application.id, "rejected")}
                                >
                                  <ActionIcon type="rejected" />
                                  <span>{rejecting ? "Updating..." : application.status === "rejected" ? "Rejected" : "Reject"}</span>
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="muted-text">
                      {visibleFilter === "all"
                        ? "No applicants."
                        : `No ${getStatusLabel(visibleFilter).toLowerCase()} applicants.`}
                    </p>
                  )}
                </section>

                <div className="placement-actions admin-drive-card-actions">
                  <button
                    type="button"
                    className={`placement-apply-btn ${drive.isActive ? "auth-button" : "topbar-logout"}`}
                    onClick={() => handleToggleDriveStatus(drive.id)}
                    disabled={toggleLoadingId === drive.id}
                  >
                    {toggleLoadingId === drive.id ? "Updating..." : drive.isActive ? "Active" : "Inactive"}
                  </button>
                  <button type="button" className="auth-button placement-apply-btn" onClick={() => handleEdit(drive)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="topbar-logout placement-apply-btn"
                    onClick={() => openDeleteModal(drive)}
                    disabled={deleteLoadingId === drive.id}
                  >
                    {deleteLoadingId === drive.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
                    </>
                  );
                })()}
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        title="Confirm Deletion"
        message="Are you sure you want to delete this drive? This action cannot be undone."
        loading={Boolean(deleteLoadingId)}
        meta={
          <>
            <strong>{drivePendingDelete?.companyName || "Drive"}</strong>
            <span>{drivePendingDelete?.role || "No role"}</span>
          </>
        }
      />
    </div>
  );
};

export default AdminPlacement;
