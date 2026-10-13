import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** iOS Safari zooms the page when a focused input is under 16px, which throws the marking sheet off screen.
 * jsdom can't compute this, so read the phone media blocks of the real stylesheets. */
const phoneBlock = (file: string) => {
  const css = readFileSync(path.join(process.cwd(), 'src/components', file), 'utf8');
  const start = css.lastIndexOf('@media (max-width: 760px)');
  expect(start, `${file} has a phone block`).toBeGreaterThan(-1);
  return css.slice(start);
};

describe('phone inputs never trigger iOS zoom', () => {
  it.each([
    ['PaperMarkingWorkspace.module.css', '.stepper input'],
    ['PastPaperReader.module.css', '.viewMenu select'],
    ['past-papers/PaperFinder.module.css', '.box input'],
    ['PaperAttemptTimer.module.css', '.custom input'],
  ])('%s sets %s to 16px on phones', (file, selector) => {
    const block = phoneBlock(file);
    const rule = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*font-size:\\s*16px`);
    expect(block).toMatch(rule);
  });

  it('gives marking steppers thumb-sized buttons on phones', () => {
    expect(phoneBlock('PaperMarkingWorkspace.module.css')).toMatch(/\.stepper button\s*\{[^}]*width:\s*4[0-4]px[^}]*height:\s*4[0-4]px/);
  });
});
