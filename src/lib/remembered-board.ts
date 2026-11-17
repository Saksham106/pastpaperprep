import { useEffect, useState } from "react";
import { isQualificationId, qualificationIdOfSlug, type QualificationId } from "@/lib/qualifications";

/**
 * One remembered board per browser: the board tabs (home, notes, dashboard, pricing), the bank picker
 * and bank visits all read and write the same key. Client-only; safe in private mode and on the server.
 */
export const QUALIFICATION_KEY = "ppp-qualification";

export function readRememberedBoard(): QualificationId | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(QUALIFICATION_KEY);
    return isQualificationId(value) ? value : null;
  } catch {
    return null;
  }
}

export function rememberBoard(board: QualificationId): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(QUALIFICATION_KEY, board); } catch { /* private mode */ }
}

/** Opening a bank makes its board the remembered one (9709 → A Level). */
export function rememberBoardOfBank(slug: string): void {
  rememberBoard(qualificationIdOfSlug(slug));
}

/**
 * The remembered board, read after hydration so server and first client render agree (the pricing
 * page is CDN-served). Null until then, and when nothing is remembered.
 */
export function useRememberedBoard(): QualificationId | null {
  const [board, setBoard] = useState<QualificationId | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off restore from localStorage after hydration
  useEffect(() => { setBoard(readRememberedBoard()); }, []);
  return board;
}
