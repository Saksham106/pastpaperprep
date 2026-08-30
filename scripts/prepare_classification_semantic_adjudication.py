#!/usr/bin/env python3
"""Split semantic disagreements into deterministic adjudication batches."""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

ROOT = Path("/tmp/ppp-semantic-audit-2026-08")
MAX_BATCH = 35


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def main() -> None:
    queue = json.loads((ROOT / "adjudication-queue.json").read_text())
    out = ROOT / "adjudication-inputs"
    results = ROOT / "adjudication-results"
    out.mkdir(exist_ok=True)
    results.mkdir(exist_ok=True)
    for path in out.glob("*.json"):
        path.unlink()
    rows = queue["records"]
    batch_count = max(1, math.ceil(len(rows) / MAX_BATCH))
    batches = [[] for _ in range(batch_count)]
    for index, row in enumerate(rows):
        batches[index % batch_count].append(row)
    manifest = {"auditVersion": queue["auditVersion"], "queueSha256": hashlib.sha256((ROOT / "adjudication-queue.json").read_bytes()).hexdigest(), "count": len(rows), "batchCount": batch_count, "batches": {}}
    for index, records in enumerate(batches, start=1):
        packet = {"auditVersion": queue["auditVersion"], "batch": index, "count": len(records), "taxonomyByBank": queue["taxonomyByBank"], "records": records}
        packet["inputSha256"] = hashlib.sha256(canonical_bytes(packet)).hexdigest()
        path = out / f"batch-{index:02d}.json"
        path.write_bytes(canonical_bytes(packet))
        manifest["batches"][path.name] = {"count": len(records), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    (ROOT / "adjudication-manifest.json").write_bytes(canonical_bytes(manifest))
    print(json.dumps(manifest, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
