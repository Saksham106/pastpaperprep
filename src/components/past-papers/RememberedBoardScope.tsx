'use client';

import { useRouter } from 'next/navigation';
import { useLayoutEffect } from 'react';
import type { QualificationId } from '@/lib/qualifications';
import { readRememberedBoard, rememberBoard } from '@/lib/remembered-board';

/**
 * Students study one board. On a board's past-paper pages it becomes the remembered board, the same one the
 * home tabs, pricing and bank visits use. On /past-papers it opens the remembered board's hub straight away,
 * so "Past papers" lands on IGCSE, IB or A Level rather than every board. With nothing remembered (and for
 * crawlers) /past-papers stays the full index.
 */
export function RememberedBoardScope({ board, available }: { board?: QualificationId; available?: readonly QualificationId[] }) {
  const router = useRouter();
  useLayoutEffect(() => {
    if (board) {
      rememberBoard(board);
      return;
    }
    const remembered = readRememberedBoard();
    if (remembered && (!available || available.includes(remembered))) router.replace(`/past-papers/${remembered}`);
  }, [board, available, router]);
  return null;
}
