"""Shared helper for sidecars: turn the TeX of a published answer into a SymPy expression.

Needs antlr4-python3-runtime==4.11 (what sympy.parsing.latex.parse_latex requires).
"""
import re

from sympy import E, Symbol
from sympy.parsing.latex import parse_latex


def _strip_decorations(tex: str) -> str:
    tex = tex.replace("$", "")  # lesson strings wrap maths in $...$
    tex = re.sub(r"\\(?:displaystyle|left|right)", "", tex)
    tex = tex.replace("\\,", " ").replace("\\;", " ").replace("\\!", " ")
    tex = re.sub(r"\\[td]frac", r"\\frac", tex)
    tex = re.sub(r"\\mathrm\{e\}", " e ", tex)
    tex = re.sub(r"\\frac(\d)(\d)", r"\\frac{\1}{\2}", tex)  # \frac12 -> \frac{1}{2}
    return tex


def _after_last_top_level_equals(tex: str) -> str:
    depth, cut = 0, -1
    for i, ch in enumerate(tex):
        if ch in "{([":
            depth += 1
        elif ch in "})]":
            depth -= 1
        elif ch == "=" and depth == 0:
            cut = i
    return tex[cut + 1:]


def parse_answer(tex: str):
    """Right-hand side after the last top-level `=`, without a trailing `+ C`, as a sympy expression.

    Raises ValueError with a clear message if the TeX cannot be parsed.
    """
    cleaned = _strip_decorations(tex)
    rhs = _after_last_top_level_equals(cleaned).strip()
    rhs = re.sub(r"\s*\+\s*C\s*$", "", rhs).strip()
    if not rhs:
        raise ValueError(f"no expression found in {tex!r}")
    try:
        expr = parse_latex(rhs)
    except Exception as error:  # noqa: BLE001 - parse_latex raises assorted antlr errors
        raise ValueError(f"cannot parse {tex!r} (as {rhs!r}): {type(error).__name__}: {error}") from error
    return expr.subs(Symbol("e"), E)
