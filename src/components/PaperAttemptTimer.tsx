"use client";

import { useEffect, useState } from "react";
import { startTimer, pauseTimer, resumeTimer, finishTimer, remainingMs, type PaperAttemptTimer as TimerState } from "../lib/paper-attempt-timer";
import styles from "./PaperAttemptTimer.module.css";

/** One persistent owner in the reader; changing PDF or Focus view never remounts it. */
export function PaperAttemptTimer({ durationMinutes = 75 }: { durationMinutes?: number }) {
  return <PaperAttemptTimerSession key={durationMinutes} durationMinutes={durationMinutes} />;
}

function PaperAttemptTimerSession({ durationMinutes }: { durationMinutes: number }) {
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [now, setNow] = useState(0);
  const [custom, setCustom] = useState(false);
  const [minutes, setMinutes] = useState(String(durationMinutes));
  const [error, setError] = useState("");
  function start() {
    try {
      const time = Date.now();
      const next = startTimer(custom ? Number(minutes) : durationMinutes, time);
      setNow(time); setTimer(next); setError("");
    } catch { setError("Choose 1–360 whole minutes."); }
  }
  const left = timer ? remainingMs(timer, now) : 0;
  const seconds = Math.ceil(left / 1000);
  const expired = timer !== null && left === 0;
  const ended = expired || timer?.status === "finished";
  useEffect(() => {
    if (timer?.status !== "running" || ended) return;
    const refresh = () => setNow(Date.now());
    const interval = window.setInterval(refresh, 1000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [timer, ended]);
  return <section className={styles.timer} aria-label="Practice timer">
    {!timer ? <><span>Optional timer · {durationMinutes} minutes</span><button type="button" onClick={start}>Start timer</button><button type="button" aria-expanded={custom} onClick={() => setCustom(value => !value)}>Custom duration</button>
      {custom && <label className={styles.custom}>Minutes <input aria-label="Timer minutes" type="number" inputMode="numeric" min={1} max={360} step={1} value={minutes} onChange={event => setMinutes(event.target.value)} /> <small>1–360 whole minutes</small></label>}
      {error && <span role="alert">{error}</span>}
    </> : <>
      <div className={styles.readout}><span>Practice timer</span><strong aria-label="Time remaining">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</strong></div>
      <span>{timer.status === "paused" ? "Paused" : ended ? (expired ? "Time is up" : "Practice finished") : "Remaining"}</span>
      {!ended && <><button type="button" aria-label={timer.status === "paused" ? "Resume timer" : "Pause timer"} onClick={() => { const time = Date.now(); setNow(time); setTimer(timer.status === "paused" ? resumeTimer(timer, time) : pauseTimer(timer, time)); }}>{timer.status === "paused" ? "Resume" : "Pause"}</button><button type="button" onClick={() => { const time = Date.now(); setNow(time); setTimer(finishTimer(timer, time)); }}>Finish practice</button></>}
      {ended && <><button type="button" onClick={() => setTimer(null)}>New timer</button><span role="status">{expired ? "Time is up." : "Practice finished."} You can keep reading and self-marking.</span></>}
    </>}
  </section>;
}
