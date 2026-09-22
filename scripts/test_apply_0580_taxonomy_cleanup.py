import json
import hashlib
import tempfile
import unittest
from pathlib import Path

from apply_0580_taxonomy_cleanup import apply_overlay


class Apply0580TaxonomyCleanupTests(unittest.TestCase):
    def test_release_manifest_changes_only_the_mutable_runtime_hash(self):
        runtime_path = Path(__file__).parents[1] / "src/data/raw/igcse.json"
        manifest_path = Path(__file__).parents[1] / "docs/audits/igcse-0580-classification-v2-overlay-manifest-2026-08.json"
        runtime_hash = hashlib.sha256(runtime_path.read_bytes()).hexdigest()
        manifest = json.loads(manifest_path.read_text())
        self.assertEqual(manifest["questionsSha256"], runtime_hash)
        self.assertEqual(manifest["overlayVersion"], "classification-v2-0580-overlay-1.0")
        self.assertEqual(manifest["bank"], "igcse")
        self.assertEqual(manifest["orderedIdsSha256"], "38ffd96a9f1291ee97adfec5824e8c8db2254a9c66ab4bece052876601fc9b6e")
        self.assertEqual(manifest["reportSha256"], "b91f7411ee3beeb16a33759015e7591bdfb83027f3c2434ffa3e2aa131be920e")

    def test_applies_exact_reviewed_rows_and_fails_on_missing_ids(self):
        runtime = {"questions": [{"id": "q1", "primaryTopic": "Number", "subtopics": []}]}
        overlay = {"researchOnly": True, "rows": [{"id": "q1", "after": {"primaryTopic": "Number", "secondaryTopics": [], "subtopics": ["Number properties"], "detailedSubtopics": ["Number properties"], "contextTags": []}}]}
        result = apply_overlay(runtime, overlay)
        self.assertEqual(result["questions"][0]["subtopics"], ["Number properties"])

        with self.assertRaises(ValueError):
            apply_overlay(runtime, {"researchOnly": True, "rows": [{"id": "missing", "after": {}}]})

    def test_rejects_non_research_or_incomplete_overlay(self):
        runtime = {"questions": [{"id": "q1"}]}
        with self.assertRaises(ValueError):
            apply_overlay(runtime, {"researchOnly": False, "rows": []})


if __name__ == "__main__":
    unittest.main()
