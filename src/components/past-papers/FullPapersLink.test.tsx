import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FullPapersLink } from './FullPapersLink';

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
describe('FullPapersLink', () => {
  it('points bank question pages at the full papers when the library is on', () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('LOCAL_PAPER_PREVIEW', 'true');
    render(<FullPapersLink bankSlug="igcse" paper={4} />);
    expect(screen.getByRole('link', { name: /Full Paper 4 past papers with mark schemes/ })).toHaveAttribute('href', '/past-papers/igcse-maths-0580/paper-4');
  });
  it('renders nothing while the library is off', () => {
    const { container } = render(<FullPapersLink bankSlug="igcse" paper={4} />);
    expect(container).toBeEmptyDOMElement();
  });
});
