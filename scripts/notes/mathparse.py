"""Shared helpers for sidecars: turn the TeX of a published answer into SymPy objects.

Needs antlr4-python3-runtime==4.11 (what sympy.parsing.latex.parse_latex requires).

  parse_answer(tex)  one exact expression: the right-hand side after the last top-level `=`, `+ C` dropped.
                     Refuses (ValueError) anything it would otherwise misread: several answers joined by
                     "or"/"and"/a comma, `\\pm`, `\\approx`, matrices/vectors, unevaluated integrals and limits.
  parse_list(tex)    several answers, e.g. `x = -1 \\text{ or } x = 4`, `x = \\pm 2`, `x = 1, \\; x = 3`: a list of
                     expressions in the order written.
  parse_approx(tex)  a rounded value, e.g. `\\mathrm{P}(X<3) \\approx 0.342`: (value as a Float, significant figures).
  parse_vector(tex)  a column vector `\\begin{pmatrix}1\\\\-2\\\\3\\end{pmatrix}` (after the last `=`): list of entries.
  parse_point(tex)   a coordinate pair or triple `(2, -3)`: list of entries.
"""
import re

from sympy import Derivative, E, Float, I, Integral, Limit, Product, Sum, Symbol
from sympy.parsing.latex import parse_latex


def _strip_decorations(tex: str) -> str:
    tex = tex.replace("$", "")  # lesson strings wrap maths in $...$
    tex = re.sub(r"\\(?:displaystyle|left|right)", "", tex)
    tex = tex.replace("\\,", " ").replace("\\;", " ").replace("\\!", " ").replace("\\quad", " ")
    tex = re.sub(r"\\[td]frac", r"\\frac", tex)
    tex = re.sub(r"\\mathrm\{e\}", " e ", tex)
    tex = re.sub(r"\\mathrm\{i\}", r" \\iota ", tex)  # imaginary unit; mapped to sympy's I after parsing
    tex = re.sub(r"\\frac(\d)(\d)", r"\\frac{\1}{\2}", tex)  # \frac12 -> \frac{1}{2}
    return tex


def _top_level_cuts(tex: str, pattern: str):
    """Start/end of each top-level (outside any bracket) match of `pattern`."""
    depth, cuts, i = 0, [], 0
    regex = re.compile(pattern)
    while i < len(tex):
        ch = tex[i]
        if ch in "{([":
            depth += 1
        elif ch in "})]":
            depth -= 1
        elif depth == 0:
            match = regex.match(tex, i)
            if match:
                cuts.append((match.start(), match.end()))
                i = match.end()
                continue
        i += 1
    return cuts


def _after_last(tex: str, pattern: str) -> str:
    cuts = _top_level_cuts(tex, pattern)
    return tex[cuts[-1][1]:] if cuts else tex


def _after_last_top_level_equals(tex: str) -> str:
    return _after_last(tex, r"=")


_SEPARATORS = r"\\text\{\s*(?:or|and)\s*\}|,|\\(?:text|mathrm)\{\s*,\s*\}"


def _parse(rhs: str, original: str):
    rhs = re.sub(r"\s*\+\s*C\s*$", "", rhs).strip()
    if not rhs:
        raise ValueError(f"no expression found in {original!r}")
    try:
        expr = parse_latex(rhs)
    except Exception as error:  # noqa: BLE001 - parse_latex raises assorted antlr errors
        raise ValueError(f"cannot parse {original!r} (as {rhs!r}): {type(error).__name__}: {error}") from error
    # An answer that is still an unevaluated integral, derivative, limit, sum or product has not been worked out.
    if expr.has(Integral, Derivative, Limit, Sum, Product):
        raise ValueError(f"answer {original!r} is not evaluated: it still contains an Integral, Derivative, Limit, Sum or Product")
    return expr.subs({Symbol("e"): E, Symbol("iota"): I})


def parse_answer(tex: str):
    """Right-hand side after the last top-level `=`, without a trailing `+ C`, as a sympy expression.

    Raises ValueError with a clear message if the TeX cannot be parsed, or holds more than one answer or a
    rounded value (use parse_list / parse_approx for those), so nothing is silently half-checked.
    """
    cleaned = _strip_decorations(tex)
    if _top_level_cuts(cleaned, _SEPARATORS):
        raise ValueError(f"{tex!r} holds more than one answer; use parse_list")
    if "\\pm" in cleaned or "\\mp" in cleaned:
        raise ValueError(f"{tex!r} uses \\pm; use parse_list")
    if "\\approx" in cleaned:
        raise ValueError(f"{tex!r} is a rounded value; use parse_approx")
    if "\\begin" in cleaned:
        raise ValueError(f"{tex!r} is a matrix or vector; use parse_vector")
    return _parse(_after_last_top_level_equals(cleaned).strip(), tex)


def parse_list(tex: str):
    """Every answer in `x = -1 \\text{ or } x = 4` (or comma / "and" separated, or `x = \\pm 2`), in order."""
    cleaned = _strip_decorations(tex)
    cuts = _top_level_cuts(cleaned, _SEPARATORS)
    pieces, start = [], 0
    for begin, end in cuts:
        pieces.append(cleaned[start:begin])
        start = end
    pieces.append(cleaned[start:])
    values = []
    for piece in pieces:
        rhs = _after_last_top_level_equals(piece).strip()
        if not rhs:
            raise ValueError(f"empty answer in {tex!r}")
        if "\\pm" in rhs or "\\mp" in rhs:
            plus, minus = rhs.replace("\\mp", "\\pm").split("\\pm", 1)
            for sign in ("+", "-"):
                values.append(_parse(f"{plus} {sign} ({minus})" if plus.strip() else f"{sign}({minus})", tex))
        else:
            values.append(_parse(rhs, tex))
    if len(values) < 2:
        raise ValueError(f"{tex!r} holds a single answer; use parse_answer")
    return values


def parse_approx(tex: str):
    """(value, significant figures) of a rounded answer after the last top-level `\\approx` or `=`.

    Trailing words such as `\\text{ (3 s.f.)}` or units are ignored. The value must be a plain decimal number.
    """
    cleaned = _strip_decorations(tex)
    rhs = _after_last(cleaned, r"\\approx|=").strip()
    rhs = re.sub(r"\\(?:text|mathrm)\{[^}]*\}", " ", rhs).strip()
    rhs = re.sub(r"\\%$", "", rhs).strip()
    match = re.fullmatch(r"(-?)(\d+(?:\.\d+)?)(?:\s*\\times\s*10\^\{?(-?\d+)\}?)?", rhs)
    if not match:
        raise ValueError(f"no plain rounded number at the end of {tex!r} (got {rhs!r})")
    sign, mantissa, exponent = match.groups()
    digits = mantissa.replace(".", "").lstrip("0") or "0"
    value = Float(f"{sign}{mantissa}e{exponent or 0}", 30)
    return value, len(digits)


def parse_vector(tex: str):
    """Entries of the column vector (pmatrix/bmatrix) after the last top-level `=`, as sympy expressions."""
    cleaned = _strip_decorations(tex)
    match = re.search(r"\\begin\{([pb]matrix)\}(.*?)\\end\{\1\}\s*$", _after_last_top_level_equals(cleaned).strip(), re.S)
    if not match:
        raise ValueError(f"no column vector at the end of {tex!r}")
    return [_parse(entry.strip(), tex) for entry in match.group(2).split("\\\\")]


def parse_point(tex: str):
    """Entries of the coordinate pair or triple `(a, b)` / `(a, b, c)` after the last top-level `=`."""
    cleaned = _strip_decorations(tex)
    rhs = _after_last_top_level_equals(cleaned).strip()
    if not (rhs.startswith("(") and rhs.endswith(")")):
        raise ValueError(f"no coordinates at the end of {tex!r}")
    inner = rhs[1:-1]
    cuts = _top_level_cuts(inner, r",")
    if not cuts:
        raise ValueError(f"{tex!r} has one coordinate")
    pieces, start = [], 0
    for begin, end in cuts:
        pieces.append(inner[start:begin])
        start = end
    pieces.append(inner[start:])
    return [_parse(piece.strip(), tex) for piece in pieces]
