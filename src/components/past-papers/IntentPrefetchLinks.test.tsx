import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import Link from 'next/link';
import { IntentPrefetchLink } from '@/components/IntentPrefetchLink';
import { PaperMatrix } from './PaperMatrix';
import { buildPaperMatrix } from '@/lib/past-paper-catalog';
import { PastPaperListPage } from './PastPaperListPage';
import { PastPaperPaperPage } from './PastPaperPaperPage';
import { getCatalogBank } from '@/lib/catalog';
import type { WholePaperDetail } from '@/lib/whole-paper-types';
import { IGCSE_PAPERS } from './fixtures';

// Inspect the framework boundary; real Next Link is exercised separately.
vi.mock('next/link', () => ({ default: ({ prefetch, ...props }: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) => <a {...props} data-prefetch={String(prefetch)} /> }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./PaperWorkspace', () => ({ PaperWorkspace: ({ children }: { children: import('react').ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/product-analytics', () => ({ trackProductEvent: vi.fn() }));

describe('repeated related navigation', () => {
  it('defers year and paper browse links but leaves breadcrumbs unchanged', () => {
    const { container } = render(<PastPaperListPage view={{ kind: 'subject', bank: getCatalogBank('igcse')!, papers: IGCSE_PAPERS, practice: false }} />);
    for (const name of ['Browse by year', 'Browse by paper']) {
      for (const link of container.querySelectorAll(`nav[aria-label="${name}"] a`)) expect(link).toHaveAttribute('data-prefetch', 'false');
    }
    expect(container.querySelector('nav[aria-label="Breadcrumb"] a')).toHaveAttribute('data-prefetch', 'undefined');
  });
  it('defers repeated variant and session chips but leaves breadcrumbs unchanged', () => {
    const summary = IGCSE_PAPERS[0];
    const sibling = { ...summary, id: 'sibling', variant: '3', component: '23' };
    const detail = { summary, version: 'v1', documents: {}, sources: {}, questions: [] } as unknown as WholePaperDetail;
    const { container } = render(<PastPaperPaperPage view={{ kind: 'paper', bank: getCatalogBank('igcse')!, detail, all: [...IGCSE_PAPERS, sibling], practice: false }} />);
    const chips = container.querySelectorAll('nav[aria-label="Other variants"] a, nav[aria-label="Same session"] a');
    expect(chips.length).toBeGreaterThan(1);
    for (const link of chips) expect(link).toHaveAttribute('data-prefetch', 'false');
    expect(container.querySelector('nav[aria-label="Breadcrumb"] a')).toHaveAttribute('data-prefetch', 'undefined');
  });
});

describe('intent prefetch', () => {
  it('requires fresh intent when a reused link changes destination', () => {
    const { rerender } = render(<IntentPrefetchLink href="/one">Paper</IntentPrefetchLink>);
    fireEvent.focus(screen.getByRole('link'));
    expect(screen.getByRole('link')).toHaveAttribute('data-prefetch', 'null');
    rerender(<IntentPrefetchLink href="/two">Paper</IntentPrefetchLink>);
    expect(screen.getByRole('link')).toHaveAttribute('data-prefetch', 'false');
    rerender(<IntentPrefetchLink href="/one">Paper</IntentPrefetchLink>);
    expect(screen.getByRole('link')).toHaveAttribute('data-prefetch', 'false');
    fireEvent.touchStart(screen.getByRole('link'));
    expect(screen.getByRole('link')).toHaveAttribute('data-prefetch', 'null');
  });
  it.each(['pointerEnter', 'mouseEnter', 'focus', 'touchStart'] as const)('restores automatic prefetch on %s without cancelling the event', event => {
    const handler = vi.fn();
    const props = { [`on${event[0].toUpperCase()}${event.slice(1)}`]: handler };
    render(<IntentPrefetchLink href="/past-papers/one" {...props}>Paper</IntentPrefetchLink>);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('data-prefetch', 'false');
    expect(fireEvent[event](link)).toBe(true);
    expect(link).toHaveAttribute('data-prefetch', 'null');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].defaultPrevented).toBe(false);
  });
});

describe('dense matrix prefetch policy', () => {
  it('does not prefetch any matrix destination before intent', () => {
    render(<PaperMatrix data={buildPaperMatrix(IGCSE_PAPERS, 'igcse-maths-0580')} tier="all" />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) expect(link).toHaveAttribute('data-prefetch', 'false');
  });
});
