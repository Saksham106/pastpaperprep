from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from typing import Any

from validate_classification_v2_adjudication import validate


AUDIT_VERSION = "classification-contract-v2.0"


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def sha_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


class Fixture:
    def __init__(self, *, two_rows: bool = True) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.inputs = self.root / "adjudication-inputs"
        self.results = self.root / "adjudication-results"
        self.inputs.mkdir()
        self.results.mkdir()
        self.assets = self.root / "assets"
        self.assets.mkdir()
        for name in ("q1.webp", "m1.webp", "q2.webp", "m2.webp"):
            (self.assets / name).write_bytes(name.encode())
        self.taxonomy = {"Geometry": ["Angles"], "Number": ["Fractions", "Indices"]}
        self.records = [self.record("q1")]
        if two_rows:
            self.records.append(self.record("q2"))
        self.queue = {
            "auditVersion": AUDIT_VERSION,
            "bank": "igcse",
            "count": len(self.records),
            "counts": {"source": len(self.records), "blind": len(self.records)},
            "provenance": {},
            "records": self.records,
        }
        self.write_inputs_and_manifest()

    def record(self, question_id: str) -> dict[str, Any]:
        if question_id == "q1":
            source = {"primaryTopic": "Geometry", "secondaryTopics": [], "skills": ["Angles"]}
            blind = {"primaryTopic": "Number", "secondaryTopics": [], "skills": ["Fractions"], "taxonomyGap": None}
        else:
            source = {"primaryTopic": "Number", "secondaryTopics": [], "skills": ["Fractions"]}
            blind = {"primaryTopic": "Geometry", "secondaryTopics": [], "skills": ["Angles"], "taxonomyGap": None}
        return {
            "bank": "igcse",
            "id": question_id,
            "category": "primary+skill",
            "mismatchTypes": ["primary", "skill"],
            "source": source,
            "blind": blind,
            "questionAssets": [str(self.assets / f"{question_id}.webp")],
            "markschemeAssets": [str(self.assets / f"m{question_id[1:]}.webp")],
            "officialMarkschemeUnavailable": False,
        }

    def write_inputs_and_manifest(self) -> None:
        queue_path = self.root / "adjudication-queue.json"
        queue_path.write_bytes(canonical_bytes(self.queue))
        packet_core = {
            "auditVersion": AUDIT_VERSION,
            "bank": "igcse",
            "batch": 1,
            "count": len(self.records),
            "taxonomy": self.taxonomy,
            "records": self.records,
        }
        packet = {**packet_core, "inputSha256": sha_bytes(canonical_bytes(packet_core))}
        input_path = self.inputs / "batch-01.json"
        input_path.write_bytes(canonical_bytes(packet))
        manifest = {
            "auditVersion": AUDIT_VERSION,
            "bank": "igcse",
            "queueSha256": sha_bytes(queue_path.read_bytes()),
            "count": len(self.records),
            "batchCount": 1,
            "batchSize": len(self.records),
            "orderedIdSha256": sha_bytes(canonical_bytes([r["id"] for r in self.records])),
            "provenance": {"taxonomy": {"canonicalBankSha256": sha_bytes(canonical_bytes(self.taxonomy))}},
            "batches": {"batch-01.json": {"count": len(self.records), "sha256": sha_bytes(input_path.read_bytes())}},
        }
        (self.root / "adjudication-manifest.json").write_bytes(canonical_bytes(manifest))

    def result_row(self, question_id: str, *, verdict: str = "source_correct", gap: str | None = None) -> dict[str, Any]:
        record = next(row for row in self.records if row["id"] == question_id)
        source = record["source"]
        if verdict == "source_correct":
            values = source
        elif verdict == "blind_correct":
            values = record["blind"]
        elif verdict == "modified":
            values = {"primaryTopic": "Number", "secondaryTopics": ["Geometry"], "skills": ["Fractions", "Angles"]}
        else:
            values = source
        return {
            "bank": "igcse",
            "id": question_id,
            "verdict": verdict,
            "primaryTopic": values["primaryTopic"],
            "secondaryTopics": values["secondaryTopics"],
            "skills": values["skills"],
            "confidence": "high",
            "taxonomyGap": gap,
            "evidence": ["The official markscheme credits the selected method."],
            "rationale": "The proposed tuple follows the independently assessed work.",
            "inspectedQuestionAssets": record["questionAssets"],
            "inspectedMarkschemeAssets": record["markschemeAssets"],
        }

    def write_result(self, rows: list[dict[str, Any]]) -> None:
        packet = json.loads((self.inputs / "batch-01.json").read_text())
        result = {
            "auditVersion": AUDIT_VERSION,
            "batch": 1,
            "inputSha256": packet["inputSha256"],
            "count": len(rows),
            "judgments": rows,
        }
        (self.results / "batch-01.json").write_bytes(canonical_bytes(result))

    def close(self) -> None:
        self.tmp.cleanup()


class ValidateClassificationV2AdjudicationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixture = Fixture()
        self.addCleanup(self.fixture.close)

    def test_validates_complete_source_correct_batch(self) -> None:
        self.fixture.write_result([self.fixture.result_row("q1"), self.fixture.result_row("q2")])
        report = validate(self.fixture.root)
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(report["reviewed"], 2)
        self.assertTrue(report["complete"])

    def test_requires_complete_coverage_unless_allowed(self) -> None:
        with self.assertRaisesRegex(ValueError, "missing result"):
            validate(self.fixture.root)
        report = validate(self.fixture.root, allow_incomplete=True)
        self.assertEqual(report["reviewed"], 0)
        self.assertFalse(report["complete"])

    def test_rejects_input_hash_drift_even_when_result_is_valid(self) -> None:
        self.fixture.write_result([self.fixture.result_row("q1"), self.fixture.result_row("q2")])
        input_path = self.fixture.inputs / "batch-01.json"
        input_path.write_bytes(input_path.read_bytes() + b" ")
        with self.assertRaisesRegex(ValueError, "input hash drift"):
            validate(self.fixture.root)

    def test_rejects_taxonomy_drift_even_when_input_and_manifest_hashes_are_rewritten(self) -> None:
        self.fixture.write_result([self.fixture.result_row("q1"), self.fixture.result_row("q2")])
        input_path = self.fixture.inputs / "batch-01.json"
        packet = json.loads(input_path.read_text())
        packet["taxonomy"]["Geometry"].append("Drifted skill")
        packet["inputSha256"] = sha_bytes(canonical_bytes({k: packet[k] for k in packet if k != "inputSha256"}))
        input_path.write_bytes(canonical_bytes(packet))
        manifest_path = self.fixture.root / "adjudication-manifest.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["batches"]["batch-01.json"]["sha256"] = sha_bytes(input_path.read_bytes())
        manifest_path.write_bytes(canonical_bytes(manifest))
        result_path = self.fixture.results / "batch-01.json"
        result = json.loads(result_path.read_text())
        result["inputSha256"] = packet["inputSha256"]
        result_path.write_bytes(canonical_bytes(result))
        with self.assertRaisesRegex(ValueError, "taxonomy hash drift"):
            validate(self.fixture.root)

    def test_rejects_verdict_semantic_violations_and_requires_gap_detail(self) -> None:
        cases = [
            ("source_correct", {"skills": ["Fractions"]}, None, "source_correct"),
            ("blind_correct", {"primaryTopic": "Geometry", "secondaryTopics": [], "skills": ["Angles"]}, None, "blind_correct"),
            ("modified", {"primaryTopic": "Geometry", "secondaryTopics": [], "skills": ["Angles"]}, None, "modified"),
            ("taxonomy_gap", {"primaryTopic": "Geometry", "secondaryTopics": [], "skills": ["Angles"]}, "Missing method", "taxonomy_gap"),
        ]
        for verdict, _values, gap, expected in cases:
            with self.subTest(verdict=verdict):
                row = self.fixture.result_row("q1", verdict=verdict, gap=gap)
                if verdict == "source_correct":
                    row["skills"] = ["Angles"]
                elif verdict == "blind_correct":
                    row["primaryTopic"] = "Number"
                    row["skills"] = ["Fractions"]
                elif verdict == "modified":
                    row.update(primaryTopic="Geometry", secondaryTopics=["Number"], skills=["Angles", "Fractions"])
                else:
                    row.update(primaryTopic="Geometry", secondaryTopics=[], skills=["Angles"])
                self.fixture.write_result([row, self.fixture.result_row("q2")])
                report = validate(self.fixture.root)
                self.assertEqual(report["status"], "PASS")
                self.assertEqual(report["verdicts"]["q1"], expected)

        row = self.fixture.result_row("q1", verdict="taxonomy_gap")
        row["taxonomyGap"] = "  "
        self.fixture.write_result([row, self.fixture.result_row("q2")])
        with self.assertRaisesRegex(ValueError, "taxonomy gap"):
            validate(self.fixture.root)

    def test_rejects_row_key_order_ownership_and_duplicate_ids(self) -> None:
        rows = [self.fixture.result_row("q1"), self.fixture.result_row("q2")]
        bad = dict(rows[0])
        bad["skills"] = ["not-owned"]
        self.fixture.write_result([bad, rows[1]])
        with self.assertRaisesRegex(ValueError, "owned"):
            validate(self.fixture.root)

        rows = [self.fixture.result_row("q1"), self.fixture.result_row("q1")]
        self.fixture.write_result(rows)
        with self.assertRaisesRegex(ValueError, "duplicate"):
            validate(self.fixture.root)

        row = self.fixture.result_row("q1")
        result = {
            "auditVersion": AUDIT_VERSION,
            "batch": 1,
            "inputSha256": json.loads((self.fixture.inputs / "batch-01.json").read_text())["inputSha256"],
            "count": 2,
            "judgments": [row, self.fixture.result_row("q2")],
        }
        (self.fixture.results / "batch-01.json").write_text(json.dumps(result), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "top keys"):
            validate(self.fixture.root)


if __name__ == "__main__":
    unittest.main()
