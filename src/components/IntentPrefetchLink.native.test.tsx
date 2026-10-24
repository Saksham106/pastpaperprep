import { createRef } from 'react';
import { renderToString } from 'react-dom/server';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IntentPrefetchLink } from './IntentPrefetchLink';

// No next/link stand-in: exercise the installed package entry's anchor/events.
// Vitest resolves this entry to the Pages Router. App Router prefetch scheduling
// requires the production build/browser (its RSC modules use Next bundler aliases).
describe('IntentPrefetchLink with native Next Link', () => {
  it('server-renders a discoverable anchor with its original attributes', () => {
    const html = renderToString(<IntentPrefetchLink href="/past-papers/example" title="Paper 42" className="paper" data-route="Extended" data-done aria-current="page">42</IntentPrefetchLink>);
    const container = document.createElement('div');
    container.innerHTML = html;
    const anchor = container.querySelector('a')!;
    expect(anchor.outerHTML).toBe('<a title="Paper 42" class="paper" data-route="Extended" data-done="true" aria-current="page" href="/past-papers/example">42</a>');
    expect(anchor).not.toHaveAttribute('disabled');
    expect(anchor).not.toHaveAttribute('tabindex');
  });

  it('preserves the ref, focus, pointer and touch handlers and consumer click cancellation', () => {
    const ref = createRef<HTMLAnchorElement>();
    const onFocus = vi.fn(), onMouseEnter = vi.fn(), onPointerEnter = vi.fn(), onTouchStart = vi.fn();
    const onClick = vi.fn((event: React.MouseEvent<HTMLAnchorElement>) => event.preventDefault());
    render(<IntentPrefetchLink href="/past-papers/example" ref={ref} onFocus={onFocus} onMouseEnter={onMouseEnter} onPointerEnter={onPointerEnter} onTouchStart={onTouchStart} onClick={onClick}>Paper</IntentPrefetchLink>);
    const link = screen.getByRole('link', { name: 'Paper' });
    expect(ref.current).toBe(link);
    expect(fireEvent.focus(link)).toBe(true);
    expect(fireEvent.pointerEnter(link)).toBe(true);
    expect(fireEvent.mouseEnter(link)).toBe(true);
    expect(fireEvent.touchStart(link)).toBe(true);
    for (const handler of [onFocus, onMouseEnter, onPointerEnter, onTouchStart]) expect(handler).toHaveBeenCalledTimes(1);
    // Consumer intentionally cancels; don't request unsupported jsdom navigation.
    expect(fireEvent.click(link)).toBe(false);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(ref.current).toBe(link);
    expect(link).toHaveAttribute('href', '/past-papers/example');
  });
});
