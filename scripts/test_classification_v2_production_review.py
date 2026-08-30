from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from generate_classification_v2_production_review import asset_refs, generate
from validate_classification_v2_production_review import validate

AUDIT_VERSION = "classification-contract-v2.0"
SOURCE_COMMIT = "0123456789abcdef0123456789abcdef01234567"


def canonical(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def sha(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


class Fixture:
    def __init__(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.assets = self.root / "assets"
        (self.assets / "questions").mkdir(parents=True)
        (self.assets / "markschemes").mkdir()
        self.source = self.root / "source.json"
        self.taxonomy = self.root / "refined-taxonomy.json"
        self.adjudication = self.root / "adjudication"
        self.output = self.root / "production-review"
        for question_id in ("q1", "q2", "q3"):
            (self.assets / "questions" / f"{question_id}.webp").write_bytes(f"question-{question_id}".encode())
            (self.assets / "markschemes" / f"{question_id}.webp").write_bytes(f"markscheme-{question_id}".encode())

        self.taxonomy_value = {
            "Number": ["Decimals", "Fractions", "Gap Skill", "Indices"],
            "Geometry": ["Angles"],
        }
        self.taxonomy.write_bytes(canonical({"version": "0580-refined-1", "igcse": self.taxonomy_value}))
        self.questions = [
            self.question("q1", "Number", [], ["Fractions"]),
            self.question("q2", "Geometry", [], ["Angles"]),
            self.question("q3", "Geometry", [], ["Angles"]),
        ]
        self.source.write_bytes(canonical({"version": 2, "questions": self.questions}))
        self._write_adjudication()

    def question(self, question_id: str, primary: str, secondary: list[str], skills: list[str]) -> dict:
        return {
            "id": question_id,
            "paperId": f"paper-{question_id}",
            "marks": 2,
            "accessibleText": f"Question {question_id}",
            "questionImages": [str((self.assets / "questions" / f"{question_id}.webp").resolve())],
            "markschemeImages": [str((self.assets / "markschemes" / f"{question_id}.webp").resolve())],
            "primaryTopic": primary,
            "secondaryTopics": secondary,
            "subtopics": skills,
            "detailedSubtopics": skills,
            "reviewStatus": "source-structured-draft",
        }

    def queue_record(self, question: dict, blind: dict, *, gap: str | None = None) -> dict:
        source = {
            "primaryTopic": question["primaryTopic"],
            "secondaryTopics": question["secondaryTopics"],
            "skills": question["subtopics"],
            "taxonomyGap": None,
        }
        return {
            "bank": "igcse",
            "id": question["id"],
            "category": "primary+skill",
            "mismatchTypes": ["primary", "skill"],
            "source": source,
            "blind": {**blind, "taxonomyGap": gap},
            "questionAssets": question["questionImages"],
            "markschemeAssets": question["markschemeImages"],
            "officialMarkschemeUnavailable": False,
        }

    def result_row(self, question: dict, *, verdict: str, primary: str, skills: list[str], gap: str | None = None) -> dict:
        return {
            "bank": "igcse",
            "id": question["id"],
            "verdict": verdict,
            "primaryTopic": primary,
            "secondaryTopics": [],
            "skills": skills,
            "confidence": "high",
            "taxonomyGap": gap,
            "evidence": ["The official markscheme credits this independently assessed method."],
            "rationale": "The proposed tuple is tied to the credited work in the paired assets.",
            "inspectedQuestionAssets": question["questionImages"],
            "inspectedMarkschemeAssets": question["markschemeImages"],
        }

    def _write_adjudication(self) -> None:
        inputs = self.adjudication / "adjudication-inputs"
        results = self.adjudication / "adjudication-results"
        inputs.mkdir(parents=True)
        results.mkdir(exist_ok=True)
        q1, q2, q3 = self.questions
        records = [
            self.queue_record(q1, {"primaryTopic": "Number", "secondaryTopics": [], "skills": ["Indices"]}),
            self.queue_record(q2, {"primaryTopic": "Number", "secondaryTopics": [], "skills": ["Indices"]}),
            self.queue_record(q3, {"primaryTopic": "Number", "secondaryTopics": [], "skills": ["Gap Skill"]}, gap="Missing controlled method"),
        ]
        queue = {
            "auditVersion": AUDIT_VERSION,
            "bank": "igcse",
            "count": 3,
            "counts": {"source": 3, "blind": 3, "mismatches": 3},
            "provenance": {"taxonomy": {"canonicalBankSha256": sha(canonical(self.taxonomy_value))}},
            "records": records,
        }
        queue_path = self.adjudication / "adjudication-queue.json"
        queue_path.write_bytes(canonical(queue))
        packet_core = {
            "auditVersion": AUDIT_VERSION,
            "bank": "igcse",
            "batch": 1,
            "count": 3,
            "taxonomy": self.taxonomy_value,
            "records": records,
        }
        packet = {**packet_core, "inputSha256": sha(canonical(packet_core))}
        input_path = inputs / "batch-01.json"
        input_path.write_bytes(canonical(packet))
        result = {
            "auditVersion": AUDIT_VERSION,
            "batch": 1,
            "inputSha256": packet["inputSha256"],
            "count": 3,
            "judgments": [
                self.result_row(q1, verdict="modified", primary="Number", skills=["Decimals"]),
                self.result_row(q2, verdict="modified", primary="Number", skills=["Fractions"]),
                self.result_row(q3, verdict="taxonomy_gap", primary="Number", skills=["Gap Skill"], gap="Missing controlled method"),
            ],
        }
        (results / "batch-01.json").write_bytes(canonical(result))
        manifest = {
            "auditVersion": AUDIT_VERSION,
            "bank": "igcse",
            "queueSha256": sha(queue_path.read_bytes()),
            "count": 3,
            "batchCount": 1,
            "batchSize": 3,
            "orderedIdSha256": sha(canonical(["q1", "q2", "q3"])),
            "provenance": {"taxonomy": {"canonicalBankSha256": sha(canonical(self.taxonomy_value))}},
            "batches": {"batch-01.json": {"count": 3, "sha256": sha(input_path.read_bytes())}},
        }
        (self.adjudication / "adjudication-manifest.json").write_bytes(canonical(manifest))

    def close(self) -> None:
        self.tmp.cleanup()


class ProductionReviewTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixture = Fixture()
        self.addCleanup(self.fixture.close)

    def test_generates_all_changed_candidates_in_stable_order_with_pinned_provenance(self) -> None:
        report = generate(
            self.fixture.source,
            SOURCE_COMMIT,
            self.fixture.adjudication,
            self.fixture.taxonomy,
            self.fixture.output,
            asset_root=self.fixture.root,
        )
        self.assertEqual(report["count"], 3)
        packet = json.loads((self.fixture.output / "production-review-inputs" / "batch-01.json").read_text())
        self.assertEqual([row["id"] for row in packet["records"]], ["q1", "q2", "q3"])
        self.assertEqual(packet["records"][0]["candidateBefore"]["skills"], ["Fractions"])
        self.assertEqual(packet["records"][0]["candidateAfter"]["skills"], ["Decimals"])
        self.assertEqual(packet["records"][2]["taxonomyGap"], "Missing controlled method")
        manifest = json.loads((self.fixture.output / "production-review-manifest.json").read_text())
        self.assertEqual(manifest["provenance"]["source"]["commit"], SOURCE_COMMIT)
        self.assertEqual(manifest["provenance"]["refinedTaxonomy"]["sha256"], sha(self.fixture.taxonomy.read_bytes()))
        self.assertEqual(manifest["orderedIdSha256"], sha(canonical(["q1", "q2", "q3"])))
        self.assertEqual(report["provenance"]["adjudicationCorpus"]["validated"], True)

    def test_accepts_hierarchical_refined_taxonomy_with_stable_ids(self) -> None:
        hierarchical = {
            "bank": "igcse",
            "taxonomyVersion": "igcse-0580-taxonomy-v3-test",
            "topics": [
                {
                    "id": "topic.number",
                    "label": "Number",
                    "subtopics": [
                        {"id": "number.decimals", "label": "Decimals", "filterable": True, "ownerTopicId": "topic.number"},
                        {"id": "number.fractions", "label": "Fractions", "filterable": True, "ownerTopicId": "topic.number"},
                        {"id": "number.gap", "label": "Gap Skill", "filterable": True, "ownerTopicId": "topic.number"},
                        {"id": "number.indices", "label": "Indices", "filterable": True, "ownerTopicId": "topic.number"},
                    ],
                },
                {
                    "id": "topic.geometry",
                    "label": "Geometry",
                    "subtopics": [
                        {"id": "geometry.angles", "label": "Angles", "filterable": True, "ownerTopicId": "topic.geometry"},
                    ],
                },
            ],
            "contextTags": [
                {"id": "context.only", "label": "Context only", "filterable": False, "ownerTopicId": "topic.number"},
            ],
        }
        self.fixture.taxonomy.write_bytes(canonical(hierarchical))
        report = generate(
            self.fixture.source,
            SOURCE_COMMIT,
            self.fixture.adjudication,
            self.fixture.taxonomy,
            self.fixture.output,
            asset_root=self.fixture.root,
        )
        self.assertEqual(report["count"], 3)

    def test_validator_accepts_exclusive_keep_accept_and_modify_decisions(self) -> None:
        generate(self.fixture.source, SOURCE_COMMIT, self.fixture.adjudication, self.fixture.taxonomy, self.fixture.output, asset_root=self.fixture.root)
        packet_path = self.fixture.output / "production-review-inputs" / "batch-01.json"
        packet = json.loads(packet_path.read_text())
        rows = []
        for index, record in enumerate(packet["records"]):
            if index == 0:
                decision = "keep_current"
                final = record["candidateBefore"]
            elif index == 1:
                decision = "accept_recommended"
                final = record["candidateAfter"]
            else:
                decision = "modify"
                final = {"primaryTopic": "Number", "secondaryTopics": ["Geometry"], "skills": ["Angles", "Gap Skill"]}
            rows.append({
                "id": record["id"],
                "decision": decision,
                "final": final,
                "confidence": "high",
                "evidence": ["The paired question and official markscheme identify the credited method."],
                "rationale": "The final decision is supported by the exact reviewed assets.",
                "inspectedQuestionAssets": record["questionAssets"],
                "inspectedMarkschemeAssets": record["markschemeAssets"],
                "nonClassificationSha256": record["nonClassificationSha256"],
            })
        results = self.fixture.output / "production-review-results"
        results.mkdir(exist_ok=True)
        result = {
            "reviewVersion": packet["reviewVersion"],
            "batch": 1,
            "inputSha256": packet["inputSha256"],
            "count": len(rows),
            "decisions": rows,
        }
        (results / "batch-01.json").write_bytes(canonical(result))
        report = validate(self.fixture.output, source_questions=self.fixture.source, refined_taxonomy=self.fixture.taxonomy, asset_root=self.fixture.root)
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(report["decisions"], {"keep_current": 1, "accept_recommended": 1, "modify": 1})

    def test_validator_rejects_noop_modify_and_incomplete_coverage(self) -> None:
        generate(self.fixture.source, SOURCE_COMMIT, self.fixture.adjudication, self.fixture.taxonomy, self.fixture.output, asset_root=self.fixture.root)
        packet = json.loads((self.fixture.output / "production-review-inputs" / "batch-01.json").read_text())
        decisions = [{
            "id": "q1",
            "decision": "modify",
            "final": packet["records"][0]["candidateBefore"],
            "confidence": "high",
            "evidence": ["The paired question and official markscheme identify the credited method."],
            "rationale": "This deliberately attempts a no-op modification.",
            "inspectedQuestionAssets": packet["records"][0]["questionAssets"],
            "inspectedMarkschemeAssets": packet["records"][0]["markschemeAssets"],
            "nonClassificationSha256": packet["records"][0]["nonClassificationSha256"],
        }]
        for record in packet["records"][1:]:
            decisions.append({
                "id": record["id"],
                "decision": "accept_recommended",
                "final": record["candidateAfter"],
                "confidence": "high",
                "evidence": ["The paired question and official markscheme identify the credited method."],
                "rationale": "The final decision is supported by the exact reviewed assets.",
                "inspectedQuestionAssets": record["questionAssets"],
                "inspectedMarkschemeAssets": record["markschemeAssets"],
                "nonClassificationSha256": record["nonClassificationSha256"],
            })
        result = {
            "reviewVersion": packet["reviewVersion"],
            "batch": 1,
            "inputSha256": packet["inputSha256"],
            "count": len(decisions),
            "decisions": decisions,
        }
        results = self.fixture.output / "production-review-results"
        results.mkdir(exist_ok=True)
        (results / "batch-01.json").write_bytes(canonical(result))
        with self.assertRaisesRegex(ValueError, "modify"):
            validate(self.fixture.output, source_questions=self.fixture.source, refined_taxonomy=self.fixture.taxonomy, asset_root=self.fixture.root)

    def test_validator_rejects_tampered_review_report(self) -> None:
        generate(self.fixture.source, SOURCE_COMMIT, self.fixture.adjudication, self.fixture.taxonomy, self.fixture.output, asset_root=self.fixture.root)
        packet = json.loads((self.fixture.output / "production-review-inputs" / "batch-01.json").read_text())
        results = self.fixture.output / "production-review-results"
        results.mkdir(exist_ok=True)
        rows = []
        for record in packet["records"]:
            rows.append({
                "id": record["id"], "decision": "accept_recommended", "final": record["candidateAfter"],
                "confidence": "high", "evidence": ["The paired question and official markscheme identify the credited method."],
                "rationale": "The final decision is supported by the exact reviewed assets.",
                "inspectedQuestionAssets": record["questionAssets"], "inspectedMarkschemeAssets": record["markschemeAssets"],
                "nonClassificationSha256": record["nonClassificationSha256"],
            })
        (results / "batch-01.json").write_bytes(canonical({
            "reviewVersion": packet["reviewVersion"], "batch": 1, "inputSha256": packet["inputSha256"],
            "count": len(rows), "decisions": rows,
        }))
        self.fixture.output.joinpath("production-review.json").write_text("tampered", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "report hash"):
            validate(self.fixture.output, source_questions=self.fixture.source, refined_taxonomy=self.fixture.taxonomy, asset_root=self.fixture.root)

    def test_generator_fails_closed_before_writing_when_refined_taxonomy_is_missing(self) -> None:
        missing = self.fixture.root / "missing-taxonomy.json"
        with self.assertRaisesRegex(ValueError, "refined taxonomy"):
            generate(self.fixture.source, SOURCE_COMMIT, self.fixture.adjudication, missing, self.fixture.output, asset_root=self.fixture.root)
        self.assertFalse(self.fixture.output.exists())

    def test_allows_explicitly_unavailable_official_markscheme_assets(self) -> None:
        self.assertEqual(asset_refs({"id": "q1", "questionImages": ["q.webp"]}, "markschemeImages"), [])

    def test_requires_question_assets(self) -> None:
        with self.assertRaisesRegex(ValueError, "questionImages"):
            asset_refs({"id": "q1"}, "questionImages")


if __name__ == "__main__":
    unittest.main()
