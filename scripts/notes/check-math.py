#!/usr/bin/env python3
"""Verify the published maths of a lesson with SymPy and print one pass/fail line per example, check and distractor.

Usage:
  check-math.py <item>                      (e.g. 5.16 or 5-16) check every example and check in the lesson
  check-math.py --verify <item> <id> <tex>  check one answer given on the command line (used by the tests)

The sidecar scripts/notes/sidecars/<item-dashed>.py defines CHECKS (a dict: id -> assertion) and verify(id, value),
which raises AssertionError when the published value is wrong. This script reads the lesson JSON and hands the
sidecar the lesson's OWN published text:
  - an example's `answer` TeX;
  - a multiple-choice check's correct option TeX, which must pass, and EVERY other option, each of which must be
    rejected with an AssertionError (so two equivalent answers offered as options fail the gate);
  - a numeric check's value, whose `tolerance` must be at most half a unit in the value's last decimal place.
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
LESSONS = Path(os.environ.get("AA_NOTES_LESSONS_DIR") or HERE.parents[1] / "src" / "content" / "notes" / "ib-math-aa" / "lessons")
SIDECARS = Path(os.environ.get("AA_NOTES_SIDECARS_DIR") or HERE / "sidecars")


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
                "distractors": [o["text"] for o in check["options"] if not o["correct"]],
            })
        else:
            answer = check["answer"]
            items.append({"id": check["id"], "kind": "numeric", "value": answer["value"], "tolerance": answer["tolerance"]})

    for check in lesson.get("before", []):
        add_check(check)
    for section in lesson.get("sections", []):
        for block in section.get("blocks", []):
            if block["type"] == "example":
                items.append({"id": block["id"], "kind": "example", "value": block["answer"]})
                add_check(block.get("check"))
            elif block["type"] == "check":
                add_check(block)
    return items


def load(item):
    dashed = item.replace(".", "-")
    sidecar = SIDECARS / f"{dashed}.py"
    lesson = json.loads((LESSONS / f"{dashed}.json").read_text())
    return lesson, (runpy.run_path(str(sidecar)) if sidecar.exists() else None), sidecar


def run_one(verify, id_, value):
    try:
        if value is None:
            raise ValueError("no single correct answer to verify")
        verify(id_, float(value) if isinstance(value, (int, float)) else value)
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


def half_unit(value):
    """Half a unit in the last decimal place of the published numeric value (0.342 -> 0.0005, 12 -> 0.5)."""
    exponent = Decimal(repr(value)).normalize().as_tuple().exponent if isinstance(value, float) else 0
    return Decimal(1).scaleb(min(exponent, 0)) / 2


def main():
    argv = sys.argv[1:]
    if argv[:1] == ["--verify"] and len(argv) == 4:
        _, namespace, _ = load(argv[1])
        ok, detail = run_one(namespace["verify"], argv[2], argv[3])
        print(f"{'PASS' if ok else 'FAIL'} {argv[2]}{detail}")
        return 0 if ok else 1
    if len(argv) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    lesson, namespace, sidecar = load(argv[0])
    if namespace is None:
        print(f"FAIL {lesson['item']}: no sidecar {sidecar.name}")
        return 1
    failed = False

    def report(ok, line):
        nonlocal failed
        print(f"{'PASS' if ok else 'FAIL'} {line}")
        failed = failed or not ok

    verify = namespace["verify"]
    items = published_items(lesson)
    for entry in items:
        ok, detail = run_one(verify, entry["id"], entry["value"])
        report(ok, f"{entry['id']}{detail}")
        for k, text in enumerate(entry.get("distractors", [])):
            ok, detail = reject_one(verify, entry["id"], text)
            report(ok, f"{entry['id']} distractor {k + 1} rejected{detail}")
        if entry["kind"] == "numeric":
            limit = half_unit(entry["value"])
            ok = Decimal(repr(float(entry["tolerance"]))) <= limit
            report(ok, f"{entry['id']} tolerance {entry['tolerance']}{'' if ok else f' is looser than half a unit in the last place ({limit})'}")
    checks = namespace.get("CHECKS", namespace.get("_CHECKS"))
    if not isinstance(checks, dict):
        report(False, f"{sidecar.name}: define CHECKS = {{id: assertion}} so stale ids can be found")
    else:
        for stale in sorted(set(checks) - {entry["id"] for entry in items}):
            report(False, f"{stale} (stale: the sidecar checks an id the lesson no longer has)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
