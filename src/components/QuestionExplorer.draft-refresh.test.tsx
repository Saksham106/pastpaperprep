import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QuestionExplorer } from '@/components/QuestionExplorer';
import { loadBankQuestions } from '@/lib/question-fixtures';
import { isPreviewQuestion } from '@/lib/access';
import { setSessionHint } from '@/lib/supabase/auth-cookie';
const paid = { authenticated: true, bankAccess: true, canExportPdf: true };
const anon = { authenticated: false, bankAccess: false, canExportPdf: false };
const questions = loadBankQuestions('ib-sl').filter(q => !isPreviewQuestion(q.bankSlug, q.id)).slice(0, 2);
const state = { search: '', sort: 'paper' as const, filters: {}, freeOnly: false, savedOnly: false, courseRoute: 'all' as const, visible: 24 };
const json = (p: unknown) => new Response(JSON.stringify(p), { status: 200 });
function owner(v: string) { document.cookie = `sb-final-auth-token=${v}; path=/`; setSessionHint(true); }
beforeEach(() => {
  owner('A');
  window.history.replaceState({}, '', '/banks/ib-sl?worksheet=7f1b6a2e-0000-4000-8000-000000000000&mode=edit');
});
afterEach(() => { cleanup(); document.cookie = 'sb-final-auth-token=; Max-Age=0; path=/'; vi.unstubAllGlobals(); });
it('reviewer acceptance: preserves unsaved saved-worksheet draft after same-account token refresh', async () => {
  let reads = 0;
  let patch: unknown;
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url) === '/member') return json({ accountId: 'verified-A', access: paid, studyState: { savedIds: [], attemptedIds: [] } });
    if (String(url).startsWith('/api/worksheets/')) {
      if (init?.method === 'PATCH') { patch = JSON.parse(String(init.body)); return new Response(JSON.stringify({ error: 'Concurrent edit: reload before saving' }), { status: 409 }); }
      reads++; return json({ worksheet: { bank_slug: 'ib-sl', title: 'Original title', question_ids: questions.map(q => q.id), content_mode: 'both', revision: 1 } });
    }
    if (String(url) === '/api/assets/sign') { const { requests } = JSON.parse(String(init?.body)); return json({ expiresIn: 600, assets: requests.map((r: object) => ({ ...r, urls: ['https://assets.example/q.webp'] })) }); }
    return new Response(null, { status: 404 });
  }));
  render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={anon} bootstrapUrl="/member" initialState={state} hydrateFromLocation />);
  fireEvent.change(await screen.findByDisplayValue('Original title'), { target: { value: 'Unsaved work' } });
  fireEvent.click(screen.getByRole('button', { name: `Move question ${questions[0].id} down` }));
  fireEvent.click(screen.getByRole('radio', { name: 'Answers' }));
  act(() => owner('A-refreshed'));
  await waitFor(() => expect(screen.getByDisplayValue('Unsaved work')).toBeTruthy());
  expect(reads).toBe(1);
  await waitFor(() => {
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });
  expect(screen.getByRole('radio', { name: 'Answers' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByText('Concurrent edit: reload before saving');
  expect(patch).toEqual({ bank: 'ib-sl', name: 'Unsaved work', questionIds: [questions[1].id, questions[0].id], contentMode: 'answers', revision: 1 });
  fireEvent.click(screen.getByRole('button', { name: 'View worksheet' }));
  expect(await screen.findByRole('dialog', { name: 'Unsaved worksheet changes' })).toBeTruthy();
});

it('does not submit an obsolete draft under a changed cookie before session observation', async () => {
  const patches: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url) === '/member') return json({ accountId: 'verified-A', access: paid, studyState: { savedIds: [], attemptedIds: [] } });
    if (String(url).startsWith('/api/worksheets/')) {
      if (init?.method === 'PATCH') { patches.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ error: 'Conflict' }), { status: 409 }); }
      return json({ worksheet: { bank_slug: 'ib-sl', title: 'Original title', question_ids: [questions[0].id], content_mode: 'both', revision: 1 } });
    }
    if (String(url) === '/api/assets/sign') { const { requests } = JSON.parse(String(init?.body)); return json({ expiresIn: 600, assets: requests.map((r: object) => ({ ...r, urls: ['https://assets.example/q.webp'] })) }); }
    return new Response(null, { status: 404 });
  }));
  render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={anon} bootstrapUrl="/member" initialState={state} hydrateFromLocation />);
  fireEvent.change(await screen.findByDisplayValue('Original title'), { target: { value: 'Private A draft' } });
  document.cookie = 'sb-final-auth-token=B; path=/';
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await act(async () => {});
  expect(patches).toHaveLength(0);
});

it.each(['different account', 'anonymous', 'missing identity', 'transient failure', 'signout', 'rapid signout/signin', 'different worksheet', 'stale bootstrap'] as const)('quarantines draft until server identity is confirmed: %s', async (scenario) => {
  let release!: (response: Response) => void;
  let boots = 0;
  let reads = 0;
  const confirmed = (accountId = 'verified-A', access = paid) => json({ accountId, access, studyState: { savedIds: [], attemptedIds: [] } });
  const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url) === '/member') {
      boots++;
      if (boots === 2) return new Promise<Response>(resolve => { release = resolve; });
      return confirmed();
    }
    if (String(url).startsWith('/api/worksheets/')) { reads++; return json({ worksheet: { bank_slug: 'ib-sl', title: 'Original title', question_ids: [questions[0].id], content_mode: 'both', revision: 1 } }); }
    if (String(url) === '/api/assets/sign') { const { requests } = JSON.parse(String(init?.body)); return json({ expiresIn: 600, assets: requests.map((r: object) => ({ ...r, urls: ['https://assets.example/q.webp'] })) }); }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetcher);
  render(<QuestionExplorer questions={questions} bankSlug="ib-sl" access={anon} bootstrapUrl="/member" initialState={state} hydrateFromLocation />);
  fireEvent.change(await screen.findByDisplayValue('Original title'), { target: { value: 'Private unsaved title' } });
  if (scenario === 'different worksheet') window.history.replaceState({}, '', '/banks/ib-sl?worksheet=other&mode=edit');
  act(() => owner('rotated'));
  await waitFor(() => expect(boots).toBe(2));
  expect(screen.queryByDisplayValue('Private unsaved title')).toBeNull();
  expect(screen.queryByText('Private unsaved title')).toBeNull();
  expect(reads).toBe(1);

  if (scenario === 'rapid signout/signin') {
    act(() => {
      document.cookie = 'sb-final-auth-token=; Max-Age=0; path=/'; setSessionHint(false);
      owner('signed-back-in');
    });
    await screen.findByDisplayValue('Original title');
    await act(async () => { release(confirmed()); });
  } else if (scenario === 'signout') {
    act(() => { document.cookie = 'sb-final-auth-token=; Max-Age=0; path=/'; setSessionHint(false); });
    await act(async () => { release(confirmed()); });
    act(() => owner('signed-back-in'));
    await screen.findByDisplayValue('Original title');
  } else if (scenario === 'stale bootstrap') {
    act(() => owner('rotated-again'));
    await screen.findByDisplayValue('Private unsaved title');
    await act(async () => { release(confirmed('verified-B')); });
    expect(screen.getByDisplayValue('Private unsaved title')).toBeTruthy();
    return;
  } else {
    const response = scenario === 'different account' ? confirmed('verified-B')
      : scenario === 'anonymous' ? confirmed('verified-A', anon)
      : scenario === 'missing identity' ? json({ access: paid, studyState: { savedIds: [], attemptedIds: [] } })
      : scenario === 'transient failure' ? new Response(null, { status: 503 }) : confirmed();
    await act(async () => { release(response); });
    expect(screen.queryByDisplayValue('Private unsaved title')).toBeNull();
    act(() => owner('rotated-after-result'));
    if (scenario === 'transient failure') {
      await screen.findByDisplayValue('Private unsaved title');
      return;
    }
    await screen.findByDisplayValue('Original title');
  }
  expect(screen.queryByDisplayValue('Private unsaved title')).toBeNull();
});
