import json
import tempfile
import unittest
from pathlib import Path

from apply_0580_taxonomy_cleanup import apply_overlay


class Apply0580TaxonomyCleanupTests(unittest.TestCase):
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
