"""SymPy assertions for 0580 lesson 7.4 (vector geometry). Not shipped to the browser.

Most answers in this lesson are vectors written with bold letters, such as `\\overrightarrow{OM} = \\frac{1}{2}\\mathbf{a}
+ \\frac{1}{2}\\mathbf{b}`. mathparse reads `\\mathbf{a}` as the product of the letters m, a, t, h, b, f and a, so the
`expression` kind cannot read these answers on its own. This sidecar replaces each `\\mathbf{x}` with the plain symbol x
and then runs the block's OWN verify spec (kind, truth and form, read from the lesson JSON) through verify_kinds.check.
So the truth stays in the lesson, computed from the question's route, and the gate still checks equivalence and the
simplified form. Treating a and b as independent symbols is the "compare the amounts of a and b" rule, which holds
because the lesson's two base vectors are never parallel.

Only blocks with an `expression` verify are routed here; column-vector, ratio and exact answers use their verify block.
"""
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import verify_kinds  # noqa: E402

LESSONS = Path(os.environ.get("AA_NOTES_LESSONS_DIR") or Path(__file__).resolve().parents[4] / "src/content/notes/igcse-maths-0580/lessons")
BOLD = re.compile(r"\\mathbf\{([A-Za-z])\}")


def _blocks(lesson):
    yield from lesson["before"]
    for section in lesson["sections"]:
        for block in section["blocks"]:
            if block.get("type") in ("example", "check"):
                yield block
                if block.get("check"):
                    yield block["check"]


def _specs():
    path = LESSONS / "7-4.json"
    if not path.exists():
        return {}
    lesson = json.loads(path.read_text())
    return {block["id"]: block["verify"] for block in _blocks(lesson) if (block.get("verify") or {}).get("kind") == "expression"}


def plain(tex):
    """`\\mathbf{a}` -> ` a `: a bold vector name becomes a plain symbol."""
    return BOLD.sub(r" \1 ", tex)


SPECS = _specs()
CHECKS = {id_: (lambda tex, spec=spec: verify_kinds.check(spec, plain(tex))) for id_, spec in SPECS.items()}
NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value)
