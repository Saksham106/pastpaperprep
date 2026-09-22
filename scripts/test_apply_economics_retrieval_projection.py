import unittest
from apply_economics_retrieval_projection import apply_projection


class EconomicsRetrievalProjectionTests(unittest.TestCase):
    def test_projection_adds_era_qualified_codes_and_facets_without_changing_labels(self):
        runtime = {"questions": [{"id": "q1", "primaryTopic": "Global economy", "detailedSubtopics": ["Trade"]}]}
        reconciliation = {"rows": [{"id": "q1", "official_code_refs": ["legacy_pre_2022/3.1"], "curated_facet_ids": ["facet.trade-and-advantage"]}]}
        result = apply_projection(runtime, reconciliation)
        self.assertEqual(result["questions"][0]["officialCodeRefs"], ["legacy_pre_2022/3.1"])
        self.assertEqual(result["questions"][0]["retrievalFacets"], ["facet.trade-and-advantage"])
        self.assertEqual(result["questions"][0]["primaryTopic"], "Global economy")

    def test_fails_closed_on_unmatched_rows(self):
        with self.assertRaises(ValueError):
            apply_projection({"questions": [{"id": "q1"}]}, {"rows": [{"id": "missing", "official_code_refs": [], "curated_facet_ids": []}]})


if __name__ == "__main__":
    unittest.main()
