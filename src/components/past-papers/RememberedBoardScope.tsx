'use client';

import { useEffect } from 'react';
import type { QualificationId } from '@/lib/qualifications';
import { rememberBoard } from '@/lib/remembered-board';

/**
 * Students study one board. Opening a board's past-paper hub or a subject's paper page makes that board the
 * remembered one, the same one the home tabs, pricing and bank visits use, so the header's "Full past papers"
 * link opens it next time. /past-papers itself never redirects: it stays the all-board index (breadcrumbs, search).
 */
export function RememberedBoardScope({ board }: { board: QualificationId }) {
  useEffect(() => { rememberBoard(board); }, [board]);
  return null;
}
