import { useEffect, useMemo, useRef } from "react";

const pad = (value) => String(value).padStart(2, "0");

const formatMMSS = (totalSeconds) => {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${pad(minutes)}:${pad(seconds)}`;
};

const TestTimer = ({ remainingSeconds, onTick, onTimeUp, useInternalEngine = true }) => {
  const hasTimedOutRef = useRef(false);

  useEffect(() => {
    hasTimedOutRef.current = false;
  }, []);

  useEffect(() => {
    if (!useInternalEngine) {
      return undefined;
    }

    if (typeof onTick !== "function" || typeof onTimeUp !== "function") {
      return undefined;
    }

    if (remainingSeconds <= 0) {
      if (!hasTimedOutRef.current) {
        hasTimedOutRef.current = true;
        onTimeUp();
      }
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      onTick((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [onTick, onTimeUp, remainingSeconds, useInternalEngine]);

  const timerLabel = useMemo(() => formatMMSS(remainingSeconds), [remainingSeconds]);

  return (
    <div className="test-timer">
      <span className="test-timer-label">Time Left</span>
      <strong className={`test-timer-value${remainingSeconds <= 60 ? " danger" : ""}`}>{timerLabel}</strong>
    </div>
  );
};

export default TestTimer;
