export type PaperAttemptTimer = { status: "running" | "paused" | "finished"; durationMs: number; remaining: number; deadline: number | null };
export function startTimer(minutes: number, now: number): PaperAttemptTimer {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 360) throw new RangeError("Choose 1–360 whole minutes.");
  const durationMs = minutes * 60_000;
  return { status: "running", durationMs, remaining: durationMs, deadline: now + durationMs };
}
export function pauseTimer(timer: PaperAttemptTimer, now: number): PaperAttemptTimer {
  if (timer.status !== "running") return timer;
  const remaining = remainingMs(timer, now);
  return { ...timer, status: remaining ? "paused" : "finished", remaining, deadline: null };
}
export function resumeTimer(timer: PaperAttemptTimer, now: number): PaperAttemptTimer {
  return timer.status === "paused" && timer.remaining > 0 ? { ...timer, status: "running", deadline: now + timer.remaining } : timer;
}
export function finishTimer(timer: PaperAttemptTimer, now: number): PaperAttemptTimer {
  return { ...timer, status: "finished", remaining: remainingMs(timer, now), deadline: null };
}
export function remainingMs(timer: PaperAttemptTimer, now: number): number {
  return Math.max(0, timer.status === "running" && timer.deadline !== null ? timer.deadline - now : timer.remaining);
}
