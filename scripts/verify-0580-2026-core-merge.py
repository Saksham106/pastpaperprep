"""Prove the 0580 Core 2026 merge is a pure insertion into the historical raw bank.

  python3 scripts/verify-0580-2026-core-merge.py [--base-ref origin/main]

Reads the historical src/data/raw/igcse.json from Git, checks every pre-existing row, paper and
header value is unchanged and in the same order, and that removing the receipt's additions and
re-serializing (Python json.dumps(indent=2, ensure_ascii=False), the bank's writer) reproduces
the historical file's SHA-256 byte for byte."""
import argparse, hashlib, json, pathlib, subprocess
ROOT = pathlib.Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(); p.add_argument('--base-ref', default='origin/main'); args = p.parse_args()
old_bytes = subprocess.run(['git', '-C', str(ROOT), 'show', f'{args.base_ref}:src/data/raw/igcse.json'], check=True, capture_output=True).stdout
new = json.loads((ROOT / 'src/data/raw/igcse.json').read_bytes()); old = json.loads(old_bytes)
receipt = json.loads((ROOT / 'docs/igcse-0580-2026-core-addition.json').read_text())
assert hashlib.sha256(old_bytes).hexdigest() == receipt['base']['rawSha256'], 'base ref is not the pinned historical bank'
ids, papers = set(receipt['addedQuestionIds']), set(receipt['paperIds'])
kept_q = [q for q in new['questions'] if q['id'] not in ids]; kept_p = [x for x in new['papers'] if x['id'] not in papers]
assert kept_q == old['questions'], 'a historical row changed or moved'
assert kept_p == old['papers'], 'a historical paper changed or moved'
assert [q['id'] for q in new['questions'] if q['id'] in ids] == receipt['addedQuestionIds'], 'added rows out of receipt order'
base = {k: (kept_q if k == 'questions' else kept_p if k == 'papers' else v) for k, v in new.items() if k != receipt['headerAddition']['key']}
assert list(base) == list(old) and all(base[k] == old[k] for k in old), 'a historical header value changed'
rebuilt = (json.dumps(base, indent=2, ensure_ascii=False) + '\n').encode()
assert rebuilt == old_bytes, 'removing the additions does not reproduce the historical bytes'
print(json.dumps({'historicalRowsUnchanged': len(kept_q), 'historicalPapersUnchanged': len(kept_p), 'addedRows': len(ids), 'addedPapers': len(papers),
  'baseSha256': hashlib.sha256(rebuilt).hexdigest(), 'mergedSha256': hashlib.sha256((ROOT / 'src/data/raw/igcse.json').read_bytes()).hexdigest()}))
