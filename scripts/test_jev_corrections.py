import hashlib
import json
import unittest
from pathlib import Path

from apply_jev_corrections import BANK_PATHS, load_overlay, validate_overlay, apply_corrections, _js_json

ROOT = Path(__file__).resolve().parents[1]


class JevCorrectionOverlayTests(unittest.TestCase):
    def test_overlay_is_exactly_62_corrected_and_17_held_rows(self):
        overlay = load_overlay(ROOT / "data/classification/jev-2026-09-21/corrections.json")
        report = validate_overlay(ROOT, overlay)
        self.assertEqual(report["targetCount"], 62)
        self.assertEqual(report["changedCount"], 62)
        self.assertEqual(report["decisionCounts"], {"accept": 46, "modify": 16})
        self.assertEqual(report["bankCounts"], {
            "igcse-biology-0610": 19,
            "igcse-chemistry-0620": 37,
            "igcse-economics-0455": 6,
        })
        self.assertEqual(report["heldCount"], 17)
        self.assertEqual(report["bankCounts"].get("igcse", 0), 0)

    def test_0580_is_held_with_evidence_and_without_provenance(self):
        overlay = load_overlay(ROOT / "data/classification/jev-2026-09-21/corrections.json")
        held = next(row for row in overlay["heldRows"] if row["id"] == "0580-2026-june-23-q25")
        self.assertEqual(held["decision"], "reject-current-correct")
        self.assertTrue(held["evidence"]["source"] == "origin/main")
        question = json.loads((ROOT / BANK_PATHS["igcse"] ).read_text())["questions"]
        question = next(row for row in question if row["id"] == held["id"])
        self.assertNotIn("jevCorrection", question.get("classificationProvenance", {}))

    def test_apply_preserves_unrelated_and_held_rows_without_loss(self):
        overlay = load_overlay(ROOT / "data/classification/jev-2026-09-21/corrections.json")
        report = apply_corrections(ROOT, overlay, write=False)
        self.assertEqual(report["changedIds"], sorted(report["targetIds"]))
        self.assertEqual(report["rowCounts"], report["baselineRowCounts"])
        self.assertEqual(report["duplicateIds"], [])
        self.assertEqual(report["unchangedNonTargets"], True)
        self.assertEqual(report["heldUnchanged"], True)
        self.assertEqual(report["taxonomyErrors"], [])

    def test_release_identities_are_immutable_and_runtime_seals_are_fresh(self):
        expected = {
            "igcse-biology-0610": ("ae8d6aef098c380bcb3d221e152474d2ef10d666d61c472ee42b6d4077cd4e25", "9e97cd0c0455ae865b1d14dc462f74ce22d1c66fb734e7d4a8baaf414e0ff961"),
            "igcse-economics-0455": ("629eb2cd4ae77ad6fd7cade9b89380b0a8b41a45f42548dab822ce3f0aabcf81", "629eb2cd4ae77ad6fd7cade9b89380b0a8b41a45f42548dab822ce3f0aabcf81"),
            "igcse-chemistry-0620": ("81c706903aa94c6865336cf40027c26b33e0ba514082f4d8da2c576b9bb2cf87", "81c706903aa94c6865336cf40027c26b33e0ba514082f4d8da2c576b9bb2cf87"),
        }
        for bank, (source, original) in expected.items():
            artifact = json.loads((ROOT / {"igcse-biology-0610": "src/data/production/igcse-biology-0610.json", "igcse-economics-0455": "src/data/production/igcse-economics-0455.json", "igcse-chemistry-0620": "src/data/production/igcse-chemistry-0620.json"}[bank]).read_text())
            runtime = artifact["runtimeArtifact"]
            self.assertEqual((runtime["sourceCandidateSha256"], runtime["originalCandidateRuntimeSha256"]), (source, original))
            self.assertEqual(runtime["runtimeSha256"], hashlib.sha256(_js_json({**artifact, "runtimeArtifact": {**runtime, "runtimeSha256": None}}).encode()).hexdigest())
            self.assertEqual(runtime["contentSha256"], hashlib.sha256(_js_json(artifact["questions"]).encode()).hexdigest())
            if bank == "igcse-economics-0455": self.assertEqual(runtime["finalizedContentSha256"], runtime["contentSha256"])

    def test_write_is_byte_idempotent(self):
        overlay = load_overlay(ROOT / "data/classification/jev-2026-09-21/corrections.json")
        paths = [ROOT / BANK_PATHS[bank] for bank in ("igcse-biology-0610", "igcse-chemistry-0620", "igcse-economics-0455", "igcse")]
        paths += [ROOT / "src/lib/bank-index-manifest.ts"]
        apply_corrections(ROOT, overlay, write=True)
        first = {p: p.read_bytes() for p in paths}
        apply_corrections(ROOT, overlay, write=True)
        self.assertEqual(first, {p: p.read_bytes() for p in paths})


if __name__ == "__main__":
    unittest.main()
