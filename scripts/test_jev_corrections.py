import json
import unittest
from pathlib import Path

from apply_jev_corrections import load_overlay, validate_overlay, apply_corrections

ROOT = Path(__file__).resolve().parents[1]


class JevCorrectionOverlayTests(unittest.TestCase):
    def test_overlay_is_exactly_63_unique_safe_rows(self):
        overlay = load_overlay(ROOT / "data/classification/jev-2026-09-21/corrections.json")
        report = validate_overlay(ROOT, overlay)
        self.assertEqual(report["targetCount"], 63)
        self.assertEqual(report["changedCount"], 63)
        self.assertEqual(report["decisionCounts"], {"accept": 47, "modify": 16})
        self.assertEqual(report["bankCounts"], {
            "igcse-biology-0610": 19,
            "igcse-chemistry-0620": 37,
            "igcse-economics-0455": 6,
            "igcse": 1,
        })
        self.assertEqual(report["heldCount"], 16)

    def test_apply_preserves_unrelated_and_held_rows_without_loss(self):
        overlay = load_overlay(ROOT / "data/classification/jev-2026-09-21/corrections.json")
        report = apply_corrections(ROOT, overlay, write=False)
        self.assertEqual(report["changedIds"], sorted(report["targetIds"]))
        self.assertEqual(report["rowCounts"], report["baselineRowCounts"])
        self.assertEqual(report["duplicateIds"], [])
        self.assertEqual(report["unchangedNonTargets"], True)
        self.assertEqual(report["heldUnchanged"], True)
        self.assertEqual(report["taxonomyErrors"], [])


if __name__ == "__main__":
    unittest.main()
