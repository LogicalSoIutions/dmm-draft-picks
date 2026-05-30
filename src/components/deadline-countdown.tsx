"use client";

import { useEffect, useMemo, useState } from "react";

type DeadlineCountdownProps = {
  deadlineIso: string;
  initialNowMs: number;
  openMessage: string;
  closedMessage: string;
};

const SECOND_MS = 1000;
const MINUTE_SECONDS = 60;
const HOUR_SECONDS = MINUTE_SECONDS * 60;
const DAY_SECONDS = HOUR_SECONDS * 24;

const formatCountdown = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / SECOND_MS));
  const days = Math.floor(totalSeconds / DAY_SECONDS);
  const hours = Math.floor((totalSeconds % DAY_SECONDS) / HOUR_SECONDS);
  const minutes = Math.floor((totalSeconds % HOUR_SECONDS) / MINUTE_SECONDS);
  const seconds = totalSeconds % MINUTE_SECONDS;

  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
};

const formatDeadlineTime = (date: Date, timeZone?: string): string =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);

export function DeadlineCountdown({
  deadlineIso,
  initialNowMs,
  openMessage,
  closedMessage,
}: DeadlineCountdownProps) {
  const deadline = useMemo(() => new Date(deadlineIso), [deadlineIso]);
  const [nowMs, setNowMs] = useState(initialNowMs);
  const [localTimeZone, setLocalTimeZone] = useState<string | null>(null);
  const [localDeadlineLabel, setLocalDeadlineLabel] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
    }, SECOND_MS);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const detectedTimeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Local Time";
    setLocalTimeZone(detectedTimeZone);
    setLocalDeadlineLabel(formatDeadlineTime(deadline));
  }, [deadline]);

  const remainingMs = deadline.getTime() - nowMs;
  const isOpen = remainingMs > 0;
  const easternDeadlineLabel = useMemo(
    () => formatDeadlineTime(deadline, "America/New_York"),
    [deadline],
  );

  return (
    <div className="deadline-countdown">
      <p className="deadline-countdown-message">
        {isOpen ? openMessage : closedMessage}
      </p>
      <p className="deadline-countdown-timer">{formatCountdown(remainingMs)}</p>
      <p className="deadline-countdown-time">
        {localDeadlineLabel && localTimeZone ? (
          <>
            Your local time ({localTimeZone}):{" "}
            <time dateTime={deadline.toISOString()}>{localDeadlineLabel}</time>
          </>
        ) : (
          "Loading your local time..."
        )}
      </p>
      <p className="deadline-countdown-time">
        US Eastern:{" "}
        <time dateTime={deadline.toISOString()}>{easternDeadlineLabel}</time>
      </p>
    </div>
  );
}
