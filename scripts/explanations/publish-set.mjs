import { createHash } from 'node:crypto';
const hash = (body) => createHash('sha256').update(body).digest('hex');

// Store must implement atomic create-if-absent, never unconditional replacement.
// A complete receipt is persisted before the caller may advertise any ID.
export async function publishSet(items, store, { apply = false, receipt }) {
  const expected = items.map(({ key, body }) => ({ key, sha256: hash(body) })).sort((a,b) => a.key.localeCompare(b.key));
  if (new Set(expected.map(x => x.key)).size !== expected.length) throw new Error('Duplicate publish key');
  const state = { schemaVersion: 1, expected, verified: [], failed: [], complete: false };
  await receipt(state);
  for (const { key, body } of items) {
    try {
      if (apply) {
        try { await store.putIfAbsent(key, body); }
        catch (error) {
          if (error.name !== 'PreconditionFailed' && error.$metadata?.httpStatusCode !== 412) throw error;
          // Another writer or an existing object: only an identical readback is safe.
        }
      }
      if (hash(await store.get(key)) !== hash(body)) throw new Error('read-back conflict');
      state.verified.push(key);
    } catch (error) { state.failed.push({ key, error: String(error.message) }); }
    await receipt(state);
  }
  state.verified.sort();
  if (state.failed.length) throw new Error(`Read-back/upload failed for ${state.failed.length}; availability unchanged`);
  state.complete = true;
  await receipt(state);
  return state.verified;
}
