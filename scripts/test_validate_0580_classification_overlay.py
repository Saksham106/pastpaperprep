from __future__ import annotations

import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from typing import Any

from validate_0580_classification_overlay import canonical_bytes, sha256_bytes, validate_overlay


EXPECTED_COUNT = 2684
COMMIT = "0123456789abcdef0123456789abcdef01234567"
TAXONOMY_VERSION = "0580-refined-taxonomy-2026.08.1"


def write_json(path: Path, value: Any) -> None:
    path.write_bytes(canonical_bytes(value))


class OverlayFixture:
    """A complete, small-field fixture with the real 0580 coverage cardinality."""

    def __init__(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.source_path = self.root / "frozen-source.json"
        self.taxonomy_path = self.root / "refined-taxonomy.json"
        self.review_path = self.root / "production-review-validation.json"
        self.output_path = self.root / "candidate-output.json"
        self.rebuild_one = self.root / "rebuild-1.json"
        self.rebuild_two = self.root / "rebuild-2.json"
        self.locked_path = self.root / "locked-delivery.json"
        self.overlay_path = self.root / "0580-overlay.json"

        self.taxonomy = {
            "schemaVersion": "0580-refined-taxonomy-1.0",
            "bank": "igcse",
            "version": TAXONOMY_VERSION,
            "topics": [
                {"id": "number", "label": "Number", "subtopics": [
                    {"id": "fractions", "label": "Fractions, decimals and percentages", "filterable": True, "ownerTopicId": "number"},
                    {"id": "properties", "label": "Number properties", "filterable": True, "ownerTopicId": "number"},
                ]},
                {"id": "geometry", "label": "Geometry", "subtopics": [
                    {"id": "angles", "label": "Angles and polygons", "filterable": True, "ownerTopicId": "geometry"},
                    {"id": "volume", "label": "Volume and surface area", "filterable": True, "ownerTopicId": "geometry"},
                ]},
            ],
        }
        self.source_questions = [self._source_question(index) for index in range(EXPECTED_COUNT)]
        write_json(self.source_path, {"questions": self.source_questions})
        write_json(self.taxonomy_path, self.taxonomy)

        self.output_questions = [self._candidate_question(question, index) for index, question in enumerate(self.source_questions)]
        write_json(self.output_path, {"questions": self.output_questions})
        output_hash = sha256_bytes(self.output_path.read_bytes())
        self.rebuild_one.write_bytes(self.output_path.read_bytes())
        self.rebuild_two.write_bytes(self.output_path.read_bytes())
        locked = [self._locked_question(question) for question in self.output_questions]
        write_json(self.locked_path, {"questions": locked})

        source_hash = sha256_bytes(self.source_path.read_bytes())
        taxonomy_hash = sha256_bytes(self.taxonomy_path.read_bytes())
        validation = {
            "schemaVersion": "0580-production-review-validation-1.0",
            "status": "PASS",
            "complete": True,
            "bank": "igcse",
            "reviewed": EXPECTED_COUNT,
            "expected": EXPECTED_COUNT,
            "sourceSha256": source_hash,
            "taxonomySha256": taxonomy_hash,
            "outputSha256": output_hash,
            "nonClassificationUnchanged": True,
            "deterministicRebuildsMatch": True,
            "unresolvedTaxonomyGaps": 0,
        }
        write_json(self.review_path, validation)

        self.overlay = {
            "schemaVersion": "0580-classification-overlay-1.0",
            "bank": "igcse",
            "questionCount": EXPECTED_COUNT,
            "source": {"path": str(self.source_path), "commit": COMMIT, "sha256": source_hash},
            "taxonomy": {"path": str(self.taxonomy_path), "version": TAXONOMY_VERSION, "sha256": taxonomy_hash},
            "productionReview": {
                "path": str(self.review_path),
                "sha256": sha256_bytes(self.review_path.read_bytes()),
                "validationSha256": sha256_bytes(canonical_bytes(validation)),
            },
            "output": {"path": str(self.output_path), "sha256": output_hash},
            "rebuilds": [
                {"path": str(self.rebuild_one), "sha256": output_hash},
                {"path": str(self.rebuild_two), "sha256": output_hash},
            ],
            "lockedDelivery": {"path": str(self.locked_path)},
            "provenance": {
                "sourceCommit": COMMIT,
                "sourceSha256": source_hash,
                "taxonomySha256": taxonomy_hash,
                "productionReviewValidationSha256": sha256_bytes(canonical_bytes(validation)),
                "outputSha256": output_hash,
            },
            "menus": {
                "Number": ["Fractions, decimals and percentages", "Number properties"],
                "Geometry": ["Angles and polygons", "Volume and surface area"],
            },
            "records": [
                {
                    "id": question["id"],
                    "primaryTopic": question["primaryTopic"],
                    "secondaryTopics": question["secondaryTopics"],
                    "skills": question["skills"],
                    "taxonomyGap": None,
                }
                for question in self.output_questions
            ],
        }
        write_json(self.overlay_path, self.overlay)

    @staticmethod
    def _source_question(index: int) -> dict[str, Any]:
        cross_topic = index == 1
        primary = "Number"
        secondary = ["Geometry"] if cross_topic else []
        skills = ["Fractions, decimals and percentages"]
        if cross_topic:
            skills.append("Angles and polygons")
        return {
            "id": f"0580-fixture-{index:04d}",
            "paperId": "fixture-paper",
            "number": index + 1,
            "accessibleText": f"Question {index + 1} protected text",
            "summary": f"Summary {index + 1}",
            "solution": f"Solution {index + 1}",
            "questionImages": [f"questions/q-{index:04d}.webp"],
            "markschemeImages": [f"markschemes/q-{index:04d}.webp"],
            "primaryTopic": primary,
            "secondaryTopics": secondary,
            "subtopics": skills[:1],
            "detailedSubtopics": skills,
            "classificationEvidence": {"basis": "question+markscheme", "confidence": "high"},
            "reviewStatus": "reviewed",
        }

    @staticmethod
    def _candidate_question(source: dict[str, Any], index: int) -> dict[str, Any]:
        question = copy.deepcopy(source)
        question["skills"] = list(source["detailedSubtopics"])
        question["searchText"] = " ".join([
            question["primaryTopic"],
            *question["secondaryTopics"],
            *question["skills"],
            question["accessibleText"],
        ]).casefold()
        return question

    @staticmethod
    def _locked_question(candidate: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": candidate["id"],
            "primaryTopic": candidate["primaryTopic"],
            "secondaryTopics": candidate["secondaryTopics"],
            "skills": candidate["skills"],
            "subtopics": candidate["subtopics"],
            "searchText": " ".join([
                candidate["primaryTopic"],
                *candidate["secondaryTopics"],
                *candidate["skills"],
            ]).casefold(),
            "accessibleText": "",
            "summary": "",
            "solution": None,
            "questionImages": [],
            "markschemeImages": [],
            "questionAssetPaths": [],
            "markschemeAssetPaths": [],
            "sourceQuestionUrl": None,
            "sourceMarkSchemeUrl": None,
        }

    def mutate(self, fn) -> None:
        fn(self.overlay)
        write_json(self.overlay_path, self.overlay)

    def close(self) -> None:
        self.tmp.cleanup()


class Validate0580OverlayTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixture = OverlayFixture()
        self.addCleanup(self.fixture.close)

    def test_accepts_complete_0580_overlay_fixture(self) -> None:
        report = validate_overlay(self.fixture.overlay_path)
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(report["questionCount"], EXPECTED_COUNT)
        self.assertEqual(report["topicCount"], 2)

    def test_rejects_wrong_count_duplicate_or_reordered_ids(self) -> None:
        cases = [
            ("count", lambda overlay: overlay.__setitem__("records", overlay["records"][:-1]), "count"),
            ("duplicate", lambda overlay: overlay["records"].__setitem__(1, copy.deepcopy(overlay["records"][0])), "duplicate"),
            ("order", lambda overlay: overlay["records"].__setitem__(slice(0, 2), list(reversed(overlay["records"][:2]))), "ordered"),
        ]
        for name, mutate, expected in cases:
            with self.subTest(name=name):
                self.fixture.mutate(mutate)
                with self.assertRaisesRegex(ValueError, expected):
                    validate_overlay(self.fixture.overlay_path)
                self.setUp()

    def test_rejects_nonclassification_field_drift_even_with_rehashed_output(self) -> None:
        self.fixture.output_questions[0]["accessibleText"] = "changed protected text"
        write_json(self.fixture.output_path, {"questions": self.fixture.output_questions})
        self.fixture.mutate(lambda overlay: overlay["output"].__setitem__("sha256", sha256_bytes(self.fixture.output_path.read_bytes())))
        with self.assertRaisesRegex(ValueError, "non-classification fields"):
            validate_overlay(self.fixture.overlay_path)

    def test_rejects_unowned_final_labels_and_taxonomy_gaps(self) -> None:
        self.fixture.mutate(lambda overlay: overlay["records"][0].__setitem__("skills", ["Angles and polygons"]))
        with self.assertRaisesRegex(ValueError, "owned"):
            validate_overlay(self.fixture.overlay_path)
        self.setUp()
        self.fixture.mutate(lambda overlay: overlay["records"][0].__setitem__("taxonomyGap", "missing syllabus method"))
        with self.assertRaisesRegex(ValueError, "taxonomy gap"):
            validate_overlay(self.fixture.overlay_path)

    def test_rejects_rich_label_loss_filter_leakage_and_locked_content_leak(self) -> None:
        self.fixture.output_questions[0]["searchText"] = "number fractions"
        write_json(self.fixture.output_path, {"questions": self.fixture.output_questions})
        self.fixture.mutate(lambda overlay: overlay["output"].__setitem__("sha256", sha256_bytes(self.fixture.output_path.read_bytes())))
        with self.assertRaisesRegex(ValueError, "discoverable|search"):
            validate_overlay(self.fixture.overlay_path)
        self.setUp()
        self.fixture.mutate(lambda overlay: overlay["menus"]["Number"].append("Angles and polygons"))
        with self.assertRaisesRegex(ValueError, "menu leakage"):
            validate_overlay(self.fixture.overlay_path)
        self.setUp()
        locked = json.loads(self.fixture.locked_path.read_text())
        locked["questions"][0]["accessibleText"] = "protected"
        write_json(self.fixture.locked_path, locked)
        with self.assertRaisesRegex(ValueError, "protected content"):
            validate_overlay(self.fixture.overlay_path)

    def test_rejects_provenance_or_deterministic_rebuild_drift(self) -> None:
        self.fixture.mutate(lambda overlay: overlay["provenance"].__setitem__("sourceCommit", "f" * 40))
        with self.assertRaisesRegex(ValueError, "provenance"):
            validate_overlay(self.fixture.overlay_path)
        self.setUp()
        self.fixture.rebuild_two.write_bytes(b"different rebuild")
        with self.assertRaisesRegex(ValueError, "deterministic"):
            validate_overlay(self.fixture.overlay_path)


class RealOverlayContractTests(unittest.TestCase):
    def test_accepts_the_real_generator_manifest(self) -> None:
        manifest = Path("/tmp/ppp-overlay-final-a/overlay-manifest.json")
        report = validate_overlay(
            manifest,
            [Path("/tmp/ppp-overlay-final-b/overlay-manifest.json")],
        )
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(report["questionCount"], 2684)
        self.assertEqual(report["deterministicRebuilds"], 2)
        self.assertEqual(report["unresolvedTaxonomyGaps"], 0)


if __name__ == "__main__":
    unittest.main()
