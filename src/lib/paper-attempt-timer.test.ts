import { describe, expect, it } from "vitest";
import { startTimer, remainingMs, pauseTimer, resumeTimer, finishTimer } from "./paper-attempt-timer";

describe("paper attempt timer", () => {
  it("freezes on pause, resumes from a new deadline and finishes without restarting", () => {
    const paused = pauseTimer(startTimer(75, 1000), 61_000);
    expect(remainingMs(paused, 999_000)).toBe(4_440_000);
    const resumed = resumeTimer(paused, 999_000);
    expect(remainingMs(resumed, 1_059_000)).toBe(4_380_000);
    const finished = finishTimer(resumed, 1_059_000);
    expect(finished.status).toBe("finished");
    expect(remainingMs(finished, 9_000_000)).toBe(4_380_000);
    expect(resumeTimer(finished, 9_000_000)).toEqual(finished);
    expect(resumeTimer(pauseTimer(startTimer(1, 0), 70_000), 80_000).status).toBe("finished");
  });
  it("rejects invalid custom durations before starting", () => {
    for (const minutes of [0, -1, NaN, Infinity, 361, 1.5]) expect(() => startTimer(minutes, 1000)).toThrow();
    expect(remainingMs(startTimer(1, 0), 0)).toBe(60_000);
    expect(remainingMs(startTimer(360, 0), 0)).toBe(21_600_000);
  });
  it("derives the 75-minute countdown from a deadline, even after a hidden-tab gap", () => {
    const timer = startTimer(75, 1000);
    expect(remainingMs(timer, 1000)).toBe(4_500_000);
    expect(remainingMs(timer, 121_000)).toBe(4_380_000);
    expect(remainingMs(timer, 5_000_000)).toBe(0);
  });
});
