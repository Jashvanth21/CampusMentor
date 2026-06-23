import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiService from "../../../api/apiService";
import { notifyMentorDataUpdated } from "../../../utils/mentorEvents";
import {
  buildFeedbackFormState,
  FEEDBACK_OPTIONS
} from "./studentProfileHelpers";
import "../../../styles/mentor-feedback-page.css";

const StudentFeedback = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState({
    action: "",
    loading: false,
    error: "",
    success: ""
  });
  const [feedbackForm, setFeedbackForm] = useState(buildFeedbackFormState());

  const fetchStudentProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiService.getMentorStudentDetail(studentId);
      const mentorFeedback = data?.profile?.mentorFeedback || {};
      setDetail(data || null);
      setFeedbackForm(buildFeedbackFormState(mentorFeedback));
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load student feedback form.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) {
      fetchStudentProfile();
    } else {
      setLoading(false);
      setError("Invalid student id.");
    }
  }, [fetchStudentProfile, studentId]);

  const profile = detail?.profile || {};
  const toastClassName = saveState.error ? "admin-toast error" : "admin-toast success";

  const toggleWeakArea = (value) => {
    setFeedbackForm((current) => ({
      ...current,
      weak_areas: current.weak_areas.includes(value)
        ? current.weak_areas.filter((item) => item !== value)
        : [...current.weak_areas, value]
    }));
  };

  const persistMentorFeedback = async (payload, successMessage, action) => {
    try {
      setSaveState({
        action,
        loading: true,
        error: "",
        success: ""
      });

      const response = await apiService.saveMentorFeedback(studentId, payload);
      const updatedFeedback = response?.mentorFeedback || null;

      if (updatedFeedback) {
        setDetail((current) => ({
          ...(current || {}),
          profile: {
            ...((current && current.profile) || {}),
            mentorFeedback: updatedFeedback
          }
        }));
        setFeedbackForm(buildFeedbackFormState(updatedFeedback));
      }

      notifyMentorDataUpdated({
        studentId,
        reviewed: payload?.reviewed,
        focusArea: payload?.focusArea ?? payload?.focus_area ?? "",
        action
      });

      setSaveState({
        action: "",
        loading: false,
        error: "",
        success: successMessage
      });
    } catch (requestError) {
      setSaveState({
        action: "",
        loading: false,
        error: requestError?.response?.data?.message || "Unable to save mentor feedback.",
        success: ""
      });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    await persistMentorFeedback(
      {
        comment: feedbackForm.mentor_feedback,
        sincerityScore: feedbackForm.sincerity_score,
        weakAreas: feedbackForm.weak_areas,
        focusArea: feedbackForm.focus_area,
        reviewed: feedbackForm.reviewed
      },
      "Feedback saved successfully",
      "feedback"
    );
  };

  const handleMarkReviewed = async () => {
    await persistMentorFeedback(
      {
        reviewed: true,
        comment: feedbackForm.mentor_feedback,
        sincerityScore: feedbackForm.sincerity_score,
        weakAreas: feedbackForm.weak_areas,
        focusArea: feedbackForm.focus_area
      },
      "Marked as reviewed",
      "reviewed"
    );
  };

  const handleSaveFocusArea = async () => {
    await persistMentorFeedback(
      {
        focusArea: feedbackForm.focus_area
      },
      "Focus area updated",
      "focus-area"
    );
  };

  if (loading) {
    return (
      <section className="card">
        <p className="muted-text">Loading feedback form...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card">
        <p className="dashboard-inline-hint error-text">{error}</p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => navigate(`/mentor/student/${studentId}`)}
        >
          Back to Analytics
        </button>
      </section>
    );
  }

  return (
    <div className="mentor-feedback-page">
      {saveState.success || saveState.error ? (
        <div className={`mentor-feedback-page__toast ${toastClassName}`}>{saveState.error || saveState.success}</div>
      ) : null}

      <section className="card mentor-feedback-page__shell">
        <div className="mentor-feedback-page__header">
          <div className="mentor-feedback-page__header-copy">
            <p className="sidebar-eyebrow">Mentor Workspace</p>
            <h2>Mentor Feedback</h2>
            <p>
              {profile?.name || "Student"} | {profile?.email || "-"} | Branch: {profile?.branch || "-"} | Year: {profile?.year || "-"}
            </p>
          </div>
          <button
            type="button"
            className="secondary-button mentor-feedback-page__back-btn"
            onClick={() => navigate(`/mentor/student/${studentId}`)}
          >
            Back to Analytics
          </button>
        </div>

        <form className="mentor-feedback-page__form" onSubmit={handleSubmit}>
          <section className="mentor-feedback-page__section">
            <div className="mentor-feedback-page__section-head">
              <h3>Mentor Feedback</h3>
              <span className="practice-chip">Human-in-the-loop</span>
            </div>
            <textarea
              className="mentor-feedback-page__textarea"
              value={feedbackForm.mentor_feedback}
              onChange={(event) => setFeedbackForm((current) => ({ ...current, mentor_feedback: event.target.value }))}
              placeholder="Add specific observations, blockers, and next mentoring steps."
              rows={6}
            />
          </section>

          <section className="mentor-feedback-page__section">
            <div className="mentor-feedback-page__inline-head">
              <h3>Sincerity Score</h3>
              <span className="mentor-feedback-page__score-value">{feedbackForm.sincerity_score}/10</span>
            </div>
            <input
              className="mentor-feedback-page__slider"
              type="range"
              min="1"
              max="10"
              value={feedbackForm.sincerity_score}
              onChange={(event) =>
                setFeedbackForm((current) => ({ ...current, sincerity_score: Number(event.target.value) }))
              }
            />
          </section>

          <section className="mentor-feedback-page__section">
            <div className="mentor-feedback-page__section-head mentor-feedback-page__section-head--compact">
              <h3>Focus Area</h3>
            </div>
            <div className="mentor-feedback-page__focus-row">
              <input
                className="mentor-feedback-page__input"
                type="text"
                value={feedbackForm.focus_area}
                onChange={(event) => setFeedbackForm((current) => ({ ...current, focus_area: event.target.value }))}
                placeholder="Example: DSA revision and coding consistency"
              />
              <button
                type="button"
                className="primary-button mentor-feedback-page__focus-btn"
                disabled={saveState.loading || !feedbackForm.focus_area.trim()}
                onClick={handleSaveFocusArea}
              >
                {saveState.loading && saveState.action === "focus-area" ? "Saving..." : "Assign Focus Area"}
              </button>
            </div>
          </section>

          <section className="mentor-feedback-page__section">
            <div className="mentor-feedback-page__section-head mentor-feedback-page__section-head--compact">
              <h3>Weak Areas</h3>
            </div>
            <div className="mentor-feedback-page__weak-grid">
              {FEEDBACK_OPTIONS.map((option) => (
                <label className="mentor-feedback-page__weak-chip" key={option}>
                  <input
                    type="checkbox"
                    checked={feedbackForm.weak_areas.includes(option)}
                    onChange={() => toggleWeakArea(option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </section>

          <div className="mentor-feedback-page__review-row">
            <label className="mentor-feedback-page__review-toggle">
              <input
                type="checkbox"
                checked={feedbackForm.reviewed}
                onChange={(event) => setFeedbackForm((current) => ({ ...current, reviewed: event.target.checked }))}
              />
              <span>Mark this student as reviewed</span>
            </label>

            {profile?.mentorFeedback?.updatedAt ? (
              <p className="mentor-feedback-page__updated-at">
                Last updated: {new Date(profile.mentorFeedback.updatedAt).toLocaleString()}
              </p>
            ) : null}
          </div>

          {saveState.error ? <p className="dashboard-inline-hint error-text">{saveState.error}</p> : null}

          <div className="mentor-feedback-page__actions">
            <button type="submit" className="primary-button mentor-feedback-page__primary-btn" disabled={saveState.loading}>
              {saveState.loading && saveState.action === "feedback" ? "Saving..." : "Save Feedback"}
            </button>
            <button
              type="button"
              className="secondary-button mentor-feedback-page__secondary-btn"
              disabled={saveState.loading || feedbackForm.reviewed}
              onClick={handleMarkReviewed}
            >
              {saveState.loading && saveState.action === "reviewed" ? "Saving..." : "Mark as Reviewed"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default StudentFeedback;
