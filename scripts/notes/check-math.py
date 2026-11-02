#!/usr/bin/env python3
"""Verify the published maths of a lesson with SymPy and print one pass/fail line per example or check id.

Usage:
  check-math.py <item>                      (e.g. 5.16 or 5-16) check every example and check in the lesson
  check-math.py --verify <item> <id> <tex>  check one answer given on the command line (used by the tests)

The sidecar scripts/notes/sidecars/<item-dashed>.py defines verify(id, value) -> None, raising on mismatch.
This script reads the lesson JSON and hands the sidecar the lesson's OWN published answer: for an example
its `answer` TeX, for a check the TeX of the option marked correct (or the numeric answer). Parsing is done
by scripts/notes/mathparse.py; text that cannot be parsed FAILS, it is never skipped.
Exit status is non-zero if any assertion fails or raises, or if an example/check id has no assertion.

What this proves: the final answer text a student sees for each worked example and each check is
mathematically correct (derivative of an indefinite answer equals the integrand; definite values are exact).
What it does NOT prove: intermediate steps, calculator key sequences, distractor options, hints or
explanations, or that the wording of a question matches the sidecar's integrand. Review covers those.
"""
import json
import runpy
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LESSONS = HERE.parents[1] / "src" / "content" / "notes" / "ib-math-aa" / "lessons"


def published_answers(lesson):
    """id -> TeX (or float) of the answer the lesson publishes."""
    answers = {}

    def add_check(check):
        if not check:
            return
        if check.get("options"):
            correct = [o["text"] for o in check["options"] if o["correct"]]
            answers[check["id"]] = correct[0] if len(correct) == 1 else None
        else:
            answers[check["id"]] = float(check["answer"]["value"])

    for check in lesson.get("before", []):
        add_check(check)
    for section in lesson.get("sections", []):
        for block in section.get("blocks", []):
            if block["type"] == "example":
                answers[block["id"]] = block["answer"]
                add_check(block.get("check"))
            elif block["type"] == "check":
                add_check(block)
    return answers


def load(item):
    dashed = item.replace(".", "-")
    sidecar = HERE / "sidecars" / f"{dashed}.py"
    lesson = json.loads((LESSONS / f"{dashed}.json").read_text())
    return lesson, (runpy.run_path(str(sidecar)) if sidecar.exists() else None), sidecar


def run_one(verify, id_, value):
    try:
        if value is None:
            raise ValueError("no single correct answer to verify")
        verify(id_, value)
    except KeyError as error:
        return False, f" ({error.args[0]})"
    except Exception as error:  # noqa: BLE001 - any error is a failure, including parse errors
        return False, f" ({type(error).__name__}: {error})"
    return True, ""


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
    for id_, value in published_answers(lesson).items():
        ok, detail = run_one(namespace["verify"], id_, value)
        print(f"{'PASS' if ok else 'FAIL'} {id_}{detail}")
        failed = failed or not ok
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
