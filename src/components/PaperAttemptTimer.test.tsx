import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PaperAttemptTimer } from './PaperAttemptTimer';

const analytics = vi.hoisted(() => ({ trackProductEvent: vi.fn() }));
vi.mock('@/lib/product-analytics', () => analytics);
afterEach(() => { cleanup(); vi.restoreAllMocks(); analytics.trackProductEvent.mockClear(); });
it.each([45, 75])('uses the paper duration of %i minutes through pause, resume and finish', durationMinutes => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
  render(<PaperAttemptTimer durationMinutes={durationMinutes} />);
  expect(screen.getByRole('button', { name: 'Start timer' })).toHaveTextContent(`${durationMinutes}:00`);
  fireEvent.click(screen.getByRole('button', { name: 'Custom duration' }));
  expect(screen.getByLabelText('Timer minutes')).toHaveValue(durationMinutes);
  fireEvent.click(screen.getByRole('button', { name: 'Custom duration' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start timer' }));
  expect(screen.getByLabelText('Time remaining')).toHaveTextContent(`${durationMinutes}:00`);
  clock.mockReturnValue(61000);
  fireEvent.click(screen.getByLabelText('Pause timer'));
  expect(screen.getByLabelText('Time remaining')).toHaveTextContent(`${durationMinutes - 1}:00`);
  clock.mockReturnValue(301000);
  fireEvent.click(screen.getByLabelText('Resume timer'));
  fireEvent.click(screen.getByRole('button', { name: 'Finish practice' }));
  expect(screen.getByRole('status')).toHaveTextContent('Practice finished');
});
it('resets when the supplied duration changes', () => {
  const view = render(<PaperAttemptTimer durationMinutes={45} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start timer' }));
  act(() => view.rerender(<PaperAttemptTimer durationMinutes={75} />));
  expect(screen.getByRole('button', { name: 'Start timer' })).toHaveTextContent('75:00');
});
it('reports a timer start for the paper’s bank', () => {
  render(<PaperAttemptTimer durationMinutes={45} analyticsBank="igcse" />);
  fireEvent.click(screen.getByRole('button', { name: 'Start timer' }));
  expect(analytics.trackProductEvent).toHaveBeenCalledWith('past_paper_timer_start', { bank: 'igcse' });
});
it('ends on a single row: just the clock and a New timer button', () => {
  vi.spyOn(Date, 'now').mockReturnValue(1000);
  render(<PaperAttemptTimer durationMinutes={45} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start timer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish practice' }));
  expect(screen.getByRole('button', { name: 'New timer' })).toBeInTheDocument();
  expect(screen.queryByText(/Keep reading/)).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveClass(/visuallyHidden/);
});
