"use client";

import { useEffect, useState } from "react";
import { DotsThree, Pause, Play, Stop } from "@phosphor-icons/react/dist/ssr";
import { startTimer, pauseTimer, resumeTimer, finishTimer, remainingMs, type PaperAttemptTimer as TimerState } from "../lib/paper-attempt-timer";
import { trackProductEvent } from "@/lib/product-analytics";
import styles from "./PaperAttemptTimer.module.css";

/** One persistent owner in the reader; changing PDF or Focus view never remounts it. */
export function PaperAttemptTimer({ durationMinutes = 75, analyticsBank }: { durationMinutes?: number; analyticsBank?: string }) {
  return <PaperAttemptTimerSession key={durationMinutes} durationMinutes={durationMinutes} analyticsBank={analyticsBank} />;
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

function PaperAttemptTimerSession({ durationMinutes, analyticsBank }: { durationMinutes: number; analyticsBank?: string }) {
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [now, setNow] = useState(0);
  const [custom, setCustom] = useState(false);
  const [minutes, setMinutes] = useState(String(durationMinutes));
  const [error, setError] = useState("");
  function start() {
    try {
      const time = Date.now();
      const next = startTimer(custom ? Number(minutes) : durationMinutes, time);
      setNow(time); setTimer(next); setError(""); setCustom(false);
      if (analyticsBank) trackProductEvent("past_paper_timer_start", { bank: analyticsBank });
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
  const planned = custom && Number.isInteger(Number(minutes)) && Number(minutes) > 0 ? Number(minutes) : durationMinutes;
  return <section className={styles.timer} aria-label="Practice timer">
    {!timer ? <>
      <button type="button" className={styles.start} aria-label="Start timer" onClick={start}><Play aria-hidden="true" weight="fill" /><span>{clock(planned * 60)}</span></button>
      <button type="button" className={styles.more} aria-label="Custom duration" aria-expanded={custom} onClick={() => setCustom(value => !value)}><DotsThree aria-hidden="true" weight="bold" /></button>
      {custom && <label className={styles.custom}>Minutes <input aria-label="Timer minutes" type="number" inputMode="numeric" min={1} max={360} step={1} value={minutes} onChange={event => setMinutes(event.target.value)} /></label>}
      {error && <span className={styles.alert} role="alert">{error}</span>}
    </> : <>
      <strong className={`${styles.readout} ${timer.status === "paused" ? styles.paused : ""} ${ended ? styles.ended : ""}`} aria-label="Time remaining">{clock(seconds)}</strong>
      {!ended && <>
        <button type="button" className={styles.icon} aria-label={timer.status === "paused" ? "Resume timer" : "Pause timer"} onClick={() => { const time = Date.now(); setNow(time); setTimer(timer.status === "paused" ? resumeTimer(timer, time) : pauseTimer(timer, time)); }}>{timer.status === "paused" ? <Play aria-hidden="true" weight="fill" /> : <Pause aria-hidden="true" weight="fill" />}</button>
        <button type="button" className={styles.icon} aria-label="Finish practice" onClick={() => { const time = Date.now(); setNow(time); setTimer(finishTimer(timer, time)); }}><Stop aria-hidden="true" weight="fill" /></button>
      </>}
      {ended && <>
        <span className={styles.status} role="status">{expired ? "Time is up." : "Practice finished."}<span className={styles.hint}> Keep reading and marking.</span></span>
        <button type="button" className={styles.text} onClick={() => setTimer(null)}>New timer</button>
      </>}
    </>}
  </section>;
}
