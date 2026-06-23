export const MENTOR_DATA_UPDATED_EVENT = "mentor-data-updated";

export const notifyMentorDataUpdated = (detail = {}) => {
  if (typeof window === "undefined") {
    return;
  }

  const payload = {
    ...detail,
    updatedAt: Date.now()
  };

  try {
    window.localStorage.setItem("mentorDataUpdatedAt", String(payload.updatedAt));
  } catch (error) {
    console.error("[mentorEvents] unable to persist update marker", error);
  }

  window.dispatchEvent(new CustomEvent(MENTOR_DATA_UPDATED_EVENT, { detail: payload }));
};
