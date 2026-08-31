import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "docs/audits/ib-hl-sources/aa-hl-production-target"
BANK = ROOT / "src/data/raw/ib-hl.json"


def test_target_validator_and_app_apply_are_deterministic():
    validator = ROOT / "scripts/aa_hl_production_audit.py"
    args = [
        sys.executable, str(validator), "--bank", str(BANK),
        "--target", str(AUDIT / "reviewed-production-target-841.json"),
        "--baseline", str(AUDIT / "production-baseline-overlay.json"),
        "--corrections", str(AUDIT / "latest-final-corrections.json"),
        "--runtime-taxonomy", str(AUDIT / "runtime-taxonomy.json"),
    ]
    first = subprocess.run(args, cwd=ROOT, check=True, capture_output=True, text=True).stdout
    before = BANK.read_bytes()
    apply_args = [sys.executable, str(ROOT / "scripts/apply_aa_hl_production_target.py")]
    subprocess.run(apply_args, cwd=ROOT, check=True, capture_output=True, text=True)
    after_first = BANK.read_bytes()
    subprocess.run(apply_args, cwd=ROOT, check=True, capture_output=True, text=True)
    after_second = BANK.read_bytes()
    assert before == after_first == after_second
    assert '"status": "PASS"' in first
    assert '"changedCount": 214' in first
    assert '"noOpCount": 627' in first
    assert '"nonClassificationDriftCount": 0' in first
