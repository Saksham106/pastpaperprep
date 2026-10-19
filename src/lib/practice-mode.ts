// Browser-only helpers for the remembered practice mode (By topic / Full papers) on the course switch.
export const PRACTICE_MODE_KEY = "ppp-practice-mode";
const PRACTICE_MODE_EVENT = "ppp-practice-mode";

/** A link that means one mode (the nav's "Practice by topic") sets it, including on the page that's already open. */
export function requestPracticeMode(id: string) {
  try { window.localStorage.setItem(PRACTICE_MODE_KEY, id); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent<string>(PRACTICE_MODE_EVENT, { detail: id }));
}

export function onPracticeModeRequest(listener: (id: string) => void) {
  const handle = (event: Event) => listener((event as CustomEvent<string>).detail);
  window.addEventListener(PRACTICE_MODE_EVENT, handle);
  return () => window.removeEventListener(PRACTICE_MODE_EVENT, handle);
}
