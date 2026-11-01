#!/usr/bin/env python3
"""Run a lesson's SymPy sidecar and print one pass/fail line per example or check id.

Usage: check-math.py <item>   (e.g. 5.16 or 5-16)

The sidecar scripts/notes/sidecars/<item-dashed>.py defines CHECKS: dict[id, callable returning True].
Exit status is non-zero if any assertion fails or raises, if an example/check id in the lesson has no
assertion, or if the sidecar asserts an id the lesson no longer has.
"""
import json
import runpy
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LESSONS = HERE.parents[1] / "src" / "content" / "notes" / "ib-math-aa" / "lessons"


def lesson_ids(lesson):
    ids = []

    def add_check(check):
        if check:
            ids.append(check["id"])

    for check in lesson.get("before", []):
        add_check(check)
    for section in lesson.get("sections", []):
        for block in section.get("blocks", []):
            if block["type"] == "example":
                ids.append(block["id"])
                add_check(block.get("check"))
            elif block["type"] == "check":
                add_check(block)
    return ids


def main():
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    dashed = sys.argv[1].replace(".", "-")
    lesson = json.loads((LESSONS / f"{dashed}.json").read_text())
    sidecar = HERE / "sidecars" / f"{dashed}.py"
    if not sidecar.exists():
        print(f"FAIL {lesson['item']}: no sidecar {sidecar.name}")
        return 1
    checks = runpy.run_path(str(sidecar))["CHECKS"]
    failed = False
    wanted = lesson_ids(lesson)
    for id_ in wanted:
        if id_ not in checks:
            print(f"FAIL {id_}: no assertion in sidecar")
            failed = True
            continue
        try:
            ok = checks[id_]() is True
            detail = "" if ok else " (assertion returned a non-True value)"
        except Exception as error:  # noqa: BLE001 - any error is a failure
            ok, detail = False, f" ({type(error).__name__}: {error})"
        print(f"{'PASS' if ok else 'FAIL'} {id_}{detail}")
        failed = failed or not ok
    for id_ in checks:
        if id_ not in wanted:
            print(f"FAIL {id_}: sidecar asserts an id the lesson does not have")
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
