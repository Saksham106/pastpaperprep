from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from typing import Any

from generate_classification_v2_production_review import generate as generate_review
from generate_classification_v2_overlay import generate, nonclassification_hash
from test_classification_v2_production_review import Fixture as ReviewFixture

SOURCE_COMMIT = "0123456789abcdef0123456789abcdef01234567"


def canonical(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class Fixture:
    def __init__(self) -> None:
        self.base = ReviewFixture()
        self.root = self.base.root
        self.source = self.base.source
        self.taxonomy = self.base.taxonomy
        self.review = self.root / "production-review"
        self.output = self.root / "overlay-one"
        self.output_two = self.root / "overlay-two"
        self.base.questions.append(self.base.question("q4", "Number", [], ["Fractions"]))
        for question in self.base.questions:
            question["classificationEvidence"] = {
                "terms": [f"old evidence {question['id']}"],
                "method": "old method",
                "confidence": "medium",
                "reviewStatus": "old-status",
                "version": "old-taxonomy",
            }
        self.source.write_bytes(canonical({"version": 2, "questions": self.base.questions}))
        generate_review(self.source, SOURCE_COMMIT, self.base.adjudication, self.taxonomy, self.review, asset_root=self.root)

    def seal_review_results(self, *, context_tags: bool = False) -> None:
        packet_path = self.review / "production-review-inputs" / "batch-01.json"
        packet = json.loads(packet_path.read_text())
        decisions: list[dict[str, Any]] = []
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
            row = {
                "id": record["id"],
                "decision": decision,
                "final": final,
                "confidence": "high",
                "evidence": ["The paired question and official markscheme identify the credited method."],
                "rationale": "The final decision is supported by the exact reviewed assets.",
                "inspectedQuestionAssets": record["questionAssets"],
                "inspectedMarkschemeAssets": record["markschemeAssets"],
                "nonClassificationSha256": record["nonClassificationSha256"],
            }
            if context_tags and index == 2:
                row["contextTags"] = ["contextual-model"]
            decisions.append(row)
        result = {
            "reviewVersion": packet["reviewVersion"],
            "batch": 1,
            "inputSha256": packet["inputSha256"],
            "count": len(decisions),
            "decisions": decisions,
        }
        (self.review / "production-review-results" / "batch-01.json").write_bytes(canonical(result))

    def close(self) -> None:
        self.base.close()


class GenerateClassificationV2OverlayTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixture = Fixture()
        self.addCleanup(self.fixture.close)

    def test_builds_new_canonical_questions_and_preserves_nonclassification_fields(self) -> None:
        self.fixture.seal_review_results()
        source_before = self.fixture.source.read_bytes()
        before = json.loads(source_before)
        report = generate(
            self.fixture.source,
            self.fixture.taxonomy,
            self.fixture.review,
            self.fixture.output,
            expected_source_count=4,
            expected_reviewed=3,
            expected_exact=1,
            asset_root=self.fixture.root,
        )
        output = json.loads((self.fixture.output / "questions.json").read_text())
        self.assertEqual(report["counts"]["outputQuestions"], 4)
        self.assertEqual([question["id"] for question in output["questions"]], ["q1", "q2", "q3", "q4"])
        self.assertEqual(output["questions"][0]["paperId"], before["questions"][0]["paperId"])
        self.assertEqual(output["questions"][0]["detailedSubtopics"], ["Fractions"])
        self.assertNotIn("skills", output["questions"][0])
        self.assertNotIn("searchText", output["questions"][0])
        self.assertEqual(output["questions"][1]["subtopics"], ["Fractions"])
        self.assertEqual(output["questions"][1]["detailedSubtopics"], ["Fractions"])
        self.assertEqual(output["questions"][2]["primaryTopic"], "Number")
        self.assertEqual(output["questions"][2]["secondaryTopics"], ["Geometry"])
        self.assertEqual(output["questions"][2]["detailedSubtopics"], ["Angles", "Gap Skill"])
        self.assertEqual(output["questions"][3]["primaryTopic"], before["questions"][3]["primaryTopic"])
        self.assertEqual(output["questions"][3]["secondaryTopics"], before["questions"][3]["secondaryTopics"])
        self.assertEqual(output["questions"][3]["subtopics"], before["questions"][3]["subtopics"])
        self.assertEqual(output["questions"][3]["detailedSubtopics"], before["questions"][3]["detailedSubtopics"])
        self.assertEqual(output["questions"][3]["reviewStatus"], before["questions"][3]["reviewStatus"])
        self.assertEqual(output["questions"][1]["classificationEvidence"]["version"], "0580-refined-1")
        self.assertEqual(output["questions"][1]["classificationEvidence"]["confidence"], "high")
        self.assertEqual(report["counts"]["changeCategories"], {
            "primary+secondary+skill+taxonomy-gap": 1,
            "primary+skill": 1,
            "unchanged": 2,
        })
        self.assertEqual(self.fixture.source.read_bytes(), source_before)

    def test_applies_explicit_gap_context_tags_only_when_source_schema_has_field(self) -> None:
        self.fixture.base.questions[2]["contextTags"] = ["existing-context"]
        self.fixture.source.write_bytes(canonical({"version": 2, "questions": self.fixture.base.questions}))
        # Rebuild the sealed packet against the changed frozen source.
        self.fixture.review = self.fixture.root / "production-review-with-context"
        generate_review(self.fixture.source, SOURCE_COMMIT, self.fixture.base.adjudication, self.fixture.taxonomy, self.fixture.review, asset_root=self.fixture.root)
        self.fixture.seal_review_results(context_tags=True)
        output_root = self.fixture.root / "overlay-context"
        report = generate(self.fixture.source, self.fixture.taxonomy, self.fixture.review, output_root, expected_source_count=4, expected_reviewed=3, expected_exact=1, asset_root=self.fixture.root)
        output = json.loads((output_root / "questions.json").read_text())
        self.assertEqual(output["questions"][2]["contextTags"], ["contextual-model"])
        self.assertNotIn("contextTags", output["questions"][0])
        self.assertEqual(report["counts"]["outputQuestions"], 4)

    def test_rebuilds_twice_to_identical_hashes(self) -> None:
        self.fixture.seal_review_results()
        first = generate(self.fixture.source, self.fixture.taxonomy, self.fixture.review, self.fixture.output, expected_source_count=4, expected_reviewed=3, expected_exact=1, asset_root=self.fixture.root)
        second = generate(self.fixture.source, self.fixture.taxonomy, self.fixture.review, self.fixture.output_two, expected_source_count=4, expected_reviewed=3, expected_exact=1, asset_root=self.fixture.root)
        self.assertEqual(first["hashes"], second["hashes"])
        self.assertEqual((self.fixture.output / "questions.json").read_bytes(), (self.fixture.output_two / "questions.json").read_bytes())

    def test_refuses_existing_output_and_does_not_mutate_source(self) -> None:
        self.fixture.seal_review_results()
        before = self.fixture.source.read_bytes()
        self.fixture.output.mkdir()
        with self.assertRaisesRegex(ValueError, "output"):
            generate(self.fixture.source, self.fixture.taxonomy, self.fixture.review, self.fixture.output, expected_source_count=4, expected_reviewed=3, expected_exact=1, asset_root=self.fixture.root)
        self.assertEqual(self.fixture.source.read_bytes(), before)

    def test_rejects_pinned_nonclassification_hash_drift_before_writing(self) -> None:
        self.fixture.seal_review_results()
        result_path = self.fixture.review / "production-review-results" / "batch-01.json"
        result = json.loads(result_path.read_text())
        result["decisions"][1]["nonClassificationSha256"] = "0" * 64
        result_path.write_bytes(canonical(result))
        with self.assertRaisesRegex(ValueError, "non-classification"):
            generate(self.fixture.source, self.fixture.taxonomy, self.fixture.review, self.fixture.output, expected_source_count=4, expected_reviewed=3, expected_exact=1, asset_root=self.fixture.root)
        self.assertFalse(self.fixture.output.exists())

    def test_rejects_inconsistent_exact_partition_before_writing(self) -> None:
        self.fixture.seal_review_results()
        with self.assertRaisesRegex(ValueError, "source/blind exact coverage"):
            generate(self.fixture.source, self.fixture.taxonomy, self.fixture.review, self.fixture.output, expected_source_count=4, expected_reviewed=3, expected_exact=2, asset_root=self.fixture.root)
        self.assertFalse(self.fixture.output.exists())

    def test_nonclassification_hash_is_stable_for_source_record(self) -> None:
        question = self.fixture.base.questions[0]
        first = nonclassification_hash(question)
        question["marks"] = 3
        self.assertNotEqual(first, nonclassification_hash(question))


if __name__ == "__main__":
    unittest.main()
