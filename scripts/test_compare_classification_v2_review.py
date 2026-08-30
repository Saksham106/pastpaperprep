from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from compare_classification_v2_review import compare


AUDIT_VERSION = "classification-contract-v2.0"


def canonical_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def sha_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


class Fixture:
    def __init__(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.blind = self.root / "blind"
        self.blind_inputs = self.blind / "blind-inputs"
        self.blind_results = self.blind / "blind-results"
        self.output = self.root / "out"
        self.blind_inputs.mkdir(parents=True)
        self.blind_results.mkdir()
        self.assets = self.root / "assets"
        (self.assets / "questions").mkdir(parents=True)
        (self.assets / "markschemes").mkdir()
        for name in ("q1", "q2", "q3"):
            (self.assets / "questions" / f"{name}.webp").write_bytes(f"question-{name}".encode())
            (self.assets / "markschemes" / f"{name}.webp").write_bytes(f"markscheme-{name}".encode())
        self.source_path = self.root / "questions.json"
        self.taxonomy_path = self.root / "taxonomy.json"
        self.manifest_path = self.blind / "manifest.json"
        self.taxonomy = {
            "igcse": {
                "Geometry": ["Angles"],
                "Number": ["Fractions", "Indices"],
                "Statistics": ["Averages"],
            }
        }
        self.taxonomy_path.write_bytes(canonical_bytes(self.taxonomy))
        self.questions = [
            self.question("q1", "Number", [], ["Fractions"], ["Fractions", "Indices"]),
            self.question("q2", "Geometry", ["Number"], ["Angles"], ["Angles"]),
            self.question("q3", "Statistics", [], ["Averages"], ["Averages"]),
        ]
        self.source_path.write_bytes(canonical_bytes({"version": 2, "questions": self.questions}))

    def question(self, question_id: str, primary: str, secondary: list[str], subtopics: list[str], detailed: list[str]) -> dict:
        return {
            "id": question_id,
            "primaryTopic": primary,
            "secondaryTopics": secondary,
            "subtopics": subtopics,
            "detailedSubtopics": detailed,
            "questionImages": [str((self.assets / "questions" / f"{question_id}.webp").resolve())],
            "markschemeImages": [str((self.assets / "markschemes" / f"{question_id}.webp").resolve())],
        }

    def blind_row(self, question: dict, *, primary: str | None = None, secondary: list[str] | None = None,
                  skills: list[str] | None = None, gap: str | None = None) -> dict:
        return {
            "bank": "igcse",
            "id": question["id"],
            "primaryTopic": primary if primary is not None else question["primaryTopic"],
            "secondaryTopics": secondary if secondary is not None else question["secondaryTopics"],
            "skills": skills if skills is not None else list(question["subtopics"]),
            "confidence": "high",
            "taxonomyGap": gap,
            "evidence": ["The official markscheme credits the listed method."],
            "rationale": "The listed labels are tied to independently credited work.",
            "inspectedQuestionAssets": question["questionImages"],
            "inspectedMarkschemeAssets": question["markschemeImages"],
            "officialMarkschemeUnavailable": False,
        }

    def write(self, rows: list[dict], *, source_ids: list[str] | None = None) -> None:
        packet = {
            "auditVersion": AUDIT_VERSION,
            "bank": "igcse",
            "batch": 1,
            "count": len(rows),
            "taxonomy": self.taxonomy["igcse"],
            "records": [
                {"bank": "igcse", "id": row["id"], "questionAssets": row["inspectedQuestionAssets"],
                 "markschemeAssets": row["inspectedMarkschemeAssets"], "officialMarkschemeUnavailable": False}
                for row in rows
            ],
        }
        packet["inputSha256"] = sha_bytes(canonical_bytes({k: packet[k] for k in packet if k != "inputSha256"}))
        packet_path = self.blind_inputs / "batch-01.json"
        packet_path.write_bytes(canonical_bytes(packet))
        result = {"auditVersion": AUDIT_VERSION, "bank": "igcse", "batch": 1,
                  "inputSha256": packet["inputSha256"], "count": len(rows), "judgments": rows}
        (self.blind_results / "batch-01.json").write_bytes(canonical_bytes(result))
        ids = source_ids if source_ids is not None else [row["id"] for row in rows]
        manifest = {
            "auditVersion": AUDIT_VERSION,
            "bank": "igcse",
            "sourceQuestions": str(self.source_path.resolve()),
            "sourceQuestionsSha256": sha_bytes(self.source_path.read_bytes()),
            "taxonomySha256": sha_bytes(canonical_bytes(self.taxonomy["igcse"])),
            "reviewCount": len(ids),
            "batchSize": len(rows),
            "batchCount": 1,
            "orderedIdSha256": sha_bytes(canonical_bytes(ids)),
            "packetSha256": {"batch-01.json": sha_bytes(packet_path.read_bytes())},
        }
        self.manifest_path.write_bytes(canonical_bytes(manifest))

    def close(self) -> None:
        self.tmp.cleanup()


class CompareClassificationV2ReviewTests(unittest.TestCase):
    def test_queues_legacy_source_taxonomy_violations_instead_of_hiding_them(self) -> None:
        fixture = Fixture()
        self.addCleanup(fixture.close)
        fixture.questions[0]["detailedSubtopics"] = ["Fractions", "Angles", "Legacy exact method"]
        fixture.source_path.write_bytes(canonical_bytes({"version": 2, "questions": fixture.questions}))
        rows = [fixture.blind_row(question) for question in fixture.questions]
        fixture.write(rows)

        report = compare(fixture.source_path, fixture.manifest_path, fixture.taxonomy_path, fixture.blind, fixture.output)

        first = report["records"][0]
        self.assertEqual(first["mismatchTypes"], ["skill", "source-taxonomy"])
        self.assertEqual(first["source"]["taxonomyViolations"], [
            {"skill": "Angles", "kind": "unowned"},
            {"skill": "Legacy exact method", "kind": "uncontrolled"},
        ])
        self.assertEqual(report["counts"]["sourceTaxonomyViolationRows"], 1)
        self.assertEqual(report["counts"]["sourceTaxonomyViolationLabels"], 2)

    def test_generates_disjoint_category_counts_and_paired_adjudication_input(self) -> None:
        fixture = Fixture()
        self.addCleanup(fixture.close)
        rows = [
            fixture.blind_row(fixture.questions[0], skills=["Indices", "Fractions"]),
            fixture.blind_row(fixture.questions[1], secondary=[], gap="Missing controlled method: angle chase"),
            fixture.blind_row(fixture.questions[2], primary="Number", skills=["Indices"]),
        ]
        rows[0]["evidence"] = {"question": "A fraction method is requested.", "markscheme": "The method earns credit."}
        fixture.write(rows)

        report = compare(fixture.source_path, fixture.manifest_path, fixture.taxonomy_path, fixture.blind, fixture.output)

        self.assertEqual(report["counts"], {
            "source": 3,
            "blind": 3,
            "exact": 1,
            "mismatches": 2,
            "taxonomyGaps": 1,
            "sourceTaxonomyViolationRows": 0,
            "sourceTaxonomyViolationLabels": 0,
            "adjudicationInputs": 2,
            "categories": {"primary+skill": 1, "secondary+taxonomy-gap": 1},
        })
        self.assertEqual(report["records"][0]["source"]["skills"], ["Fractions", "Indices"])
        queue = json.loads((fixture.output / "adjudication-queue.json").read_text())
        self.assertEqual([row["id"] for row in queue["records"]], ["q2", "q3"])
        self.assertEqual(queue["records"][0]["questionAssets"], fixture.questions[1]["questionImages"])
        self.assertEqual(queue["records"][0]["markschemeAssets"], fixture.questions[1]["markschemeImages"])
        self.assertEqual(queue["records"][0]["mismatchTypes"], ["secondary", "taxonomy-gap"])
        self.assertEqual(queue["records"][1]["mismatchTypes"], ["primary", "skill"])
        adjudication = json.loads((fixture.output / "adjudication-inputs" / "batch-01.json").read_text())
        self.assertEqual([row["id"] for row in adjudication["records"]], ["q2", "q3"])
        self.assertIn("source", adjudication["records"][0])
        self.assertIn("blind", adjudication["records"][0])

    def test_fails_closed_on_incomplete_results_and_writes_no_output(self) -> None:
        fixture = Fixture()
        self.addCleanup(fixture.close)
        fixture.write([fixture.blind_row(question) for question in fixture.questions])
        (fixture.blind_results / "batch-01.json").unlink()

        with self.assertRaisesRegex(ValueError, "missing result"):
            compare(fixture.source_path, fixture.manifest_path, fixture.taxonomy_path, fixture.blind, fixture.output)
        self.assertFalse(fixture.output.exists())

    def test_fails_closed_on_unowned_label(self) -> None:
        fixture = Fixture()
        self.addCleanup(fixture.close)
        row = fixture.blind_row(fixture.questions[0], skills=["not-owned"])
        fixture.write([row] + [fixture.blind_row(q) for q in fixture.questions[1:]])

        with self.assertRaisesRegex(ValueError, "unowned skill"):
            compare(fixture.source_path, fixture.manifest_path, fixture.taxonomy_path, fixture.blind, fixture.output)
        self.assertFalse(fixture.output.exists())

    def test_fails_closed_on_missing_asset_or_source_provenance_drift(self) -> None:
        fixture = Fixture()
        self.addCleanup(fixture.close)
        rows = [fixture.blind_row(question) for question in fixture.questions]
        rows[0]["inspectedQuestionAssets"] = [str(fixture.assets / "questions" / "missing.webp")]
        fixture.write(rows)

        with self.assertRaisesRegex(ValueError, "missing asset"):
            compare(fixture.source_path, fixture.manifest_path, fixture.taxonomy_path, fixture.blind, fixture.output)
        self.assertFalse(fixture.output.exists())

        fixture = Fixture()
        self.addCleanup(fixture.close)
        fixture.write([fixture.blind_row(question) for question in fixture.questions])
        fixture.source_path.write_bytes(fixture.source_path.read_bytes() + b" ")
        with self.assertRaisesRegex(ValueError, "source questions hash drift"):
            compare(fixture.source_path, fixture.manifest_path, fixture.taxonomy_path, fixture.blind, fixture.output)
        self.assertFalse(fixture.output.exists())


if __name__ == "__main__":
    unittest.main()
