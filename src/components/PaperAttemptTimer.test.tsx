import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PaperAttemptTimer } from './PaperAttemptTimer';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it.each([45, 75])('uses the paper duration of %i minutes through pause, resume and finish', durationMinutes => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
  render(<PaperAttemptTimer durationMinutes={durationMinutes} />);
  expect(screen.getByText(`Optional timer · ${durationMinutes} minutes`)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Custom duration'));
  expect(screen.getByLabelText('Timer minutes')).toHaveValue(durationMinutes);
  fireEvent.click(screen.getByText('Custom duration'));
  fireEvent.click(screen.getByText('Start timer'));
  expect(screen.getByLabelText('Time remaining')).toHaveTextContent(`${durationMinutes}:00`);
  clock.mockReturnValue(61000);
  fireEvent.click(screen.getByLabelText('Pause timer'));
  expect(screen.getByLabelText('Time remaining')).toHaveTextContent(`${durationMinutes - 1}:00`);
  clock.mockReturnValue(301000);
  fireEvent.click(screen.getByLabelText('Resume timer'));
  fireEvent.click(screen.getByText('Finish practice'));
  expect(screen.getByRole('status')).toHaveTextContent('Practice finished');
});
it('resets when the supplied duration changes', () => {
  const view = render(<PaperAttemptTimer durationMinutes={45} />);
  fireEvent.click(screen.getByText('Start timer'));
  act(() => view.rerender(<PaperAttemptTimer durationMinutes={75} />));
  expect(screen.getByText('Optional timer · 75 minutes')).toBeInTheDocument();
});
