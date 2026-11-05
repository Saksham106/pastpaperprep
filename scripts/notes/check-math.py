#!/usr/bin/env python3
"""Verify the published maths of a lesson with SymPy and print one pass/fail line per example, check and distractor.

Usage:
  check-math.py [--course <slug>] <item>                      (e.g. 5.16 or 5-16) check every example and check in the lesson
  check-math.py [--course <slug>] --verify <item> <id> <tex>  check one answer given on the command line (used by the tests)

--course names a folder under src/content/notes/ (default ib-math-aa). Lessons are read from its lessons/ folder and
sidecars from the folder its course.json names in gate.sidecars (AA: scripts/notes/sidecars).

Each example and check is verified by its sidecar entry if there is one, else by its declarative `verify` block
({ kind, truth, ...options }, implemented once in scripts/notes/verify_kinds.py); a block with neither FAILS.
The sidecar <sidecars>/<item-dashed>.py (optional) defines CHECKS (a dict: id -> assertion) and verify(id, value),
which raises AssertionError when the published value is wrong. This script reads the lesson JSON and hands the
sidecar, or the verify kind, the lesson's OWN published text:
  - an example's `answer` TeX;
  - a multiple-choice check's correct option TeX, which must pass, and EVERY other option, each of which must be
    rejected with an AssertionError (so two equivalent answers offered as options fail the gate);
  - a numeric check's value and tolerance, as verify(id, value, tolerance=...). The sidecar declares each numeric
    check's required precision in NUMERIC = {id: {"sf": 3}} (or {"dp": 2}); a `numeric` verify block declares it as
    its own sf / dp. The tolerance must be at most half a unit in that required place, so 0.34 +/- 0.005 cannot
    stand in for a 3 s.f. answer.
Parsing is done by scripts/notes/mathparse.py; text that cannot be parsed FAILS, it is never skipped.
Exit status is non-zero if anything fails, if an example/check id has no assertion, or if CHECKS has a stale id.

What this proves: every final answer and every distractor a student sees is right / wrong as labelled.
What it does NOT prove: intermediate steps, calculator keystrokes, hints or explanations, or that the wording of a
question matches the sidecar's set-up. The verifier reviews those.

AA_NOTES_LESSONS_DIR and AA_NOTES_SIDECARS_DIR override the lesson and sidecar folders (used by the tests).
"""
import json
import os
import runpy
import sys
from decimal import Decimal
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import verify_kinds  # noqa: E402
REPO = HERE.parents[1]
DEFAULT_COURSE = "ib-math-aa"
LESSONS = SIDECARS = None


def use_course(slug):
    """Point LESSONS and SIDECARS at a course's folders (environment overrides win, as the tests rely on)."""
    global LESSONS, SIDECARS
    root = REPO / "src" / "content" / "notes" / slug
    config_file = root / "course.json"
    if not config_file.exists():
        raise SystemExit(f"Unknown course {slug}: no {config_file}")
    config = json.loads(config_file.read_text())
    LESSONS = Path(os.environ.get("AA_NOTES_LESSONS_DIR") or root / "lessons")
    SIDECARS = Path(os.environ.get("AA_NOTES_SIDECARS_DIR") or REPO / config["gate"]["sidecars"])


def take_course(argv):
    """Strip `--course <slug>` / `--course=<slug>` from argv; returns (slug, the other arguments)."""
    slug, rest, i = DEFAULT_COURSE, [], 0
    while i < len(argv):
        if argv[i] == "--course" and i + 1 < len(argv):
            slug, i = argv[i + 1], i + 2
            continue
        if argv[i].startswith("--course="):
            slug = argv[i].split("=", 1)[1]
        else:
            rest.append(argv[i])
        i += 1
    return slug, rest


def published_items(lesson):
    """One record per example and check: id, kind, the published value, distractors and numeric tolerance."""
    items = []

    def add_check(check):
        if not check:
            return
        if check.get("options"):
            correct = [o["text"] for o in check["options"] if o["correct"]]
            items.append({
                "id": check["id"], "kind": "choice", "value": correct[0] if len(correct) == 1 else None,
                "distractors": [o["text"] for o in check["options"] if not o["correct"]], "verify": check.get("verify"),
            })
        else:
            answer = check["answer"]
            items.append({"id": check["id"], "kind": "numeric", "value": answer["value"], "tolerance": answer["tolerance"], "verify": check.get("verify")})

    for check in lesson.get("before", []):
        add_check(check)
    for section in lesson.get("sections", []):
        for block in section.get("blocks", []):
            if block["type"] == "example":
                items.append({"id": block["id"], "kind": "example", "value": block["answer"], "verify": block.get("verify")})
                add_check(block.get("check"))
            elif block["type"] == "check":
                add_check(block)
    return items


def load(item):
    dashed = item.replace(".", "-")
    sidecar = SIDECARS / f"{dashed}.py"
    lesson = json.loads((LESSONS / f"{dashed}.json").read_text())
    return lesson, (runpy.run_path(str(sidecar)) if sidecar.exists() else None), sidecar


def sidecar_checks(namespace):
    """The sidecar's CHECKS dict ({} without a sidecar)."""
    if namespace is None:
        return {}
    checks = namespace.get("CHECKS", namespace.get("_CHECKS"))
    return checks if isinstance(checks, dict) else {}


def checker_for(entry, namespace):
    """(verify function, source) for one example/check: its sidecar entry if there is one, else its verify block."""
    if namespace is not None and entry["id"] in sidecar_checks(namespace):
        return namespace["verify"], "sidecar"
    if entry.get("verify"):
        spec = entry["verify"]
        return (lambda _id, value, tolerance=None: verify_kinds.check(spec, value, tolerance)), "verify"
    return None, None


def run_one(verify, id_, value, tolerance=None):
    try:
        if value is None:
            raise ValueError("no single correct answer to verify")
        if tolerance is None:
            verify(id_, value)
        else:
            verify(id_, float(value), tolerance=float(tolerance))
    except KeyError as error:
        return False, f" ({error.args[0]})"
    except Exception as error:  # noqa: BLE001 - any error is a failure, including parse errors
        return False, f" ({type(error).__name__}: {error})"
    return True, ""


def reject_one(verify, id_, text):
    """A distractor must be rejected as WRONG (AssertionError), not merely unreadable."""
    try:
        verify(id_, text)
    except AssertionError:
        return True, ""
    except Exception as error:  # noqa: BLE001
        return False, f" (could not be checked: {type(error).__name__}: {error})"
    return False, " (accepted as correct: a distractor must be wrong)"


def required_half_unit(value, precision):
    """Half a unit in the REQUIRED place: `dp` decimal places, or the `sf`-th significant figure of the value."""
    if "dp" in precision:
        return Decimal(1).scaleb(-int(precision["dp"])) / 2
    magnitude = Decimal(repr(float(value))).adjusted() if value else 0
    return Decimal(1).scaleb(magnitude - int(precision["sf"]) + 1) / 2


def main():
    slug, argv = take_course(sys.argv[1:])
    use_course(slug)
    if argv[:1] == ["--verify"] and len(argv) == 4:
        lesson, namespace, _ = load(argv[1])
        entry = next((e for e in published_items(lesson) if e["id"] == argv[2]), {"id": argv[2]})
        verify, source = checker_for(entry, namespace)
        if verify is None:
            print(f"FAIL {argv[2]} (no assertion for {argv[2]}: no sidecar entry and no verify block)")
            return 1
        value = argv[3]
        if entry.get("kind") == "numeric" and source == "verify":
            try:
                value = float(value)
            except ValueError:
                pass
        ok, detail = run_one(verify, argv[2], value)
        print(f"{'PASS' if ok else 'FAIL'} {argv[2]}{detail}")
        return 0 if ok else 1
    if len(argv) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    lesson, namespace, sidecar = load(argv[0])
    failed = False

    def report(ok, line):
        nonlocal failed
        print(f"{'PASS' if ok else 'FAIL'} {line}")
        failed = failed or not ok

    items = published_items(lesson)
    numeric_spec = namespace.get("NUMERIC", {}) if namespace is not None else {}
    for entry in items:
        verify, source = checker_for(entry, namespace)
        if verify is None:
            report(False, f"{entry['id']} (no assertion for {entry['id']}: add a verify block, or a sidecar entry in {sidecar.name})")
            continue
        ok, detail = run_one(verify, entry["id"], entry["value"], entry.get("tolerance"))
        report(ok, f"{entry['id']}{detail}")
        for k, text in enumerate(entry.get("distractors", [])):
            ok, detail = reject_one(verify, entry["id"], text)
            report(ok, f"{entry['id']} distractor {k + 1} rejected{detail}")
        if entry["kind"] == "numeric":
            if source == "verify":
                precision = {key: entry["verify"][key] for key in ("sf", "dp") if key in entry["verify"]}
            else:
                precision = numeric_spec.get(entry["id"]) if isinstance(numeric_spec, dict) else None
            if not precision or not ({"sf", "dp"} & set(precision)):
                if source == "verify":
                    report(False, f"{entry['id']} tolerance: its verify block must declare its precision as sf or dp")
                else:
                    report(False, f"{entry['id']} tolerance: the sidecar must declare its precision in NUMERIC, e.g. {{\"{entry['id']}\": {{\"sf\": 3}}}}")
                continue
            if source == "verify" and entry["verify"].get("reading"):
                continue  # a reading from a graph: k_numeric checked the band against its declared maxTolerance
            limit = required_half_unit(entry["value"], precision)
            place = f"{precision['dp']} d.p." if "dp" in precision else f"{precision['sf']} s.f."
            ok = Decimal(repr(float(entry["tolerance"]))) <= limit
            report(ok, f"{entry['id']} tolerance {entry['tolerance']}{'' if ok else f' is looser than half a unit at {place} ({limit})'}")
    checks = namespace.get("CHECKS", namespace.get("_CHECKS")) if namespace is not None else {}
    if not isinstance(checks, dict):
        report(False, f"{sidecar.name}: define CHECKS = {{id: assertion}} so stale ids can be found")
    else:
        for stale in sorted(set(checks) - {entry["id"] for entry in items}):
            report(False, f"{stale} (stale: the sidecar checks an id the lesson no longer has)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
