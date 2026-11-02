"""Shared helpers for sidecars: read the TeX of a published answer and check it against an independent SymPy truth.

Needs antlr4-python3-runtime==4.11 (what sympy.parsing.latex.parse_latex requires).
Every helper raises ValueError for text it cannot read and AssertionError for a wrong answer; both FAIL the gate.

Reading
  parse_answer(tex, functions=())  one exact expression, right of the last top-level `=`, `+ C` dropped. Single letters
                                   before a bracket are products (`x(2x+1)`, `n(n+1)`), unless named in `functions`.
                                   Handles \\mathrm{e}, \\mathrm{i}, |..|, \\lvert..\\rvert, `r\\,\\mathrm{cis}\\,\\theta`.
                                   Refuses several answers, \\pm, \\approx, vectors and unevaluated integrals/limits/sums.
  parse_list(tex)                  several values of ONE unknown: `x = -1 \\text{ or } x = 4`, `x = \\frac{3 \\pm \\sqrt{5}}{2}`.
  parse_assignments(tex)           named values: `x = 1, y = 2` -> {"x": 1, "y": 2}.
  parse_approx(tex, unit=None)     one rounded value: (Decimal value, significant figures, decimal places, relation).
  parse_with_unit(tex, unit)       the TeX with its unit removed; the unit must be present and match.
  parse_degrees(tex)               an exact angle written with ^{\\circ}.
  parse_vector(tex), parse_point(tex), parse_vector_line(tex), parse_set(tex), parse_equation(tex)

Checking (raise AssertionError when the published answer is wrong)
  check_antiderivative(tex, integrand, var="x")      d/dx of the answer equals the integrand at sample points
  check_rounded(tex, truth, sf=3, dp=None, unit=None) exactly the required precision, ROUND_HALF_UP of the truth
  check_rounded_list(tex, truths, ...)              several rounded values, compared as a sorted list
  check_numeric(value, truth, sf=3, dp=None, tolerance=None)  a numeric check's float and its tolerance
  check_assignments(tex, truth)                     named values, names kept
  check_same_line(tex, point, direction)            same line, any point on it and any parallel direction
  check_same_set(tex, truth_set, var="x")           inequalities / intervals as sets
  check_same_equation(tex, truth)                   equations equal up to a non-zero constant factor
"""
import re
from decimal import ROUND_HALF_UP, Decimal

from sympy import (
    Derivative, E, EmptySet, I, Integral, Interval, Limit, Matrix, N, Product, Rational, Sum, Symbol, Union, cos, diff, nsimplify, oo, pi, simplify, sin,
)
from sympy.core.function import AppliedUndef
from sympy.core.relational import Ge, Gt, Le, Lt
from sympy.parsing.latex import parse_latex

_GREEK = r"alpha|beta|gamma|delta|epsilon|theta|lambda|mu|sigma|phi|omega|iota|pi|rho|tau"
_CIS = " CISMARK "


def _strip_decorations(tex: str) -> str:
    tex = tex.replace("$", "")  # lesson strings wrap maths in $...$
    tex = re.sub(r"\\l?vert|\\r?vert|\\[lr]Vert", "|", tex)
    tex = re.sub(r"\\(?:displaystyle|left|right|big|Big|bigg|Bigg)(?![a-zA-Z])", "", tex)
    tex = tex.replace("\\,", " ").replace("\\;", " ").replace("\\!", " ").replace("\\ ", " ").replace("\\quad", " ")
    tex = re.sub(r"\\[td]frac", r"\\frac", tex)
    tex = re.sub(r"\\leq(?:slant)?(?![a-zA-Z])", r"\\le ", tex)
    tex = re.sub(r"\\geq(?:slant)?(?![a-zA-Z])", r"\\ge ", tex)
    tex = re.sub(r"\\(?:mathrm|operatorname|text)\{\s*cis\s*\}", _CIS, tex)
    tex = re.sub(r"\\mathrm\{e\}", " e ", tex)
    tex = re.sub(r"\\mathrm\{i\}", r" \\iota ", tex)  # imaginary unit; mapped to sympy's I after parsing
    tex = re.sub(r"\\frac(\d)(\d)", r"\\frac{\1}{\2}", tex)  # \frac12 -> \frac{1}{2}
    return tex


def _products(tex: str, functions=()) -> str:
    """`x(2x+1)` -> `x \\cdot (2x+1)`: a lone letter (or Greek letter) before a bracket is a product, not a call."""
    def letter(match):
        return match.group(0) if match.group(1) in functions else f"{match.group(1)} \\cdot "
    tex = re.sub(r"(?<![\\A-Za-z])([A-Za-z])\s*(?=\()", letter, tex)
    return re.sub(rf"\\({_GREEK})\s*(?=\()", r"\\\1 \\cdot ", tex)


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


def _split(tex: str, cuts):
    pieces, start = [], 0
    for begin, end in cuts:
        pieces.append(tex[start:begin])
        start = end
    pieces.append(tex[start:])
    return pieces


def _after_last(tex: str, pattern: str) -> str:
    cuts = _top_level_cuts(tex, pattern)
    return tex[cuts[-1][1]:] if cuts else tex


def _after_last_top_level_equals(tex: str) -> str:
    return _after_last(tex, r"=")


_SEPARATORS = r"\\text\{\s*(?:or|and)\s*\}|,|\\(?:text|mathrm)\{\s*,\s*\}"


def _parse(rhs: str, original: str, functions=()):
    rhs = re.sub(r"\s*\+\s*C\s*$", "", rhs).strip()
    if not rhs:
        raise ValueError(f"no expression found in {original!r}")
    if re.search(r"\\log(?!\s*_)", rhs):
        raise ValueError(f"{original!r} uses \\log with no base; write \\log_{{10}} or \\ln")
    if _CIS.strip() in rhs:
        modulus, argument = rhs.split(_CIS.strip(), 1)
        r = _parse(modulus, original, functions) if modulus.strip() else 1
        theta = _parse(argument, original, functions)
        return r * (cos(theta) + I * sin(theta))
    try:
        expr = parse_latex(_products(rhs, functions))
    except Exception as error:  # noqa: BLE001 - parse_latex raises assorted antlr errors
        raise ValueError(f"cannot parse {original!r} (as {rhs!r}): {type(error).__name__}: {error}") from error
    # An answer that is still an unevaluated integral, derivative, limit, sum or product has not been worked out.
    if expr.has(Integral, Derivative, Limit, Sum, Product):
        raise ValueError(f"answer {original!r} is not evaluated: it still contains an Integral, Derivative, Limit, Sum or Product")
    calls = [call for call in expr.atoms(AppliedUndef) if call.func.__name__ not in functions]
    if calls:
        raise ValueError(f"{original!r} reads as a call to an undeclared function {calls[0]}; pass functions=(...) if it is one")
    return expr.subs({Symbol("e"): E, Symbol("iota"): I, Symbol("pi"): pi})


def parse_answer(tex: str, functions=()):
    """Right-hand side after the last top-level `=`, without a trailing `+ C`, as a sympy expression.

    Raises ValueError with a clear message if the TeX cannot be parsed, or holds more than one answer or a
    rounded value (use parse_list / parse_approx for those), so nothing is silently half-checked.
    """
    cleaned = _strip_decorations(tex)
    if _top_level_cuts(cleaned, _SEPARATORS):
        raise ValueError(f"{tex!r} holds more than one answer; use parse_list or parse_assignments")
    if "\\pm" in cleaned or "\\mp" in cleaned:
        raise ValueError(f"{tex!r} uses \\pm; use parse_list")
    if "\\approx" in cleaned:
        raise ValueError(f"{tex!r} is a rounded value; use check_rounded")
    if "\\begin" in cleaned:
        raise ValueError(f"{tex!r} is a matrix or vector; use parse_vector or parse_vector_line")
    return _parse(_after_last_top_level_equals(cleaned).strip(), tex, functions)


def _expand_pm(text: str):
    if "\\pm" not in text and "\\mp" not in text:
        return [text]
    variants = [text.replace("\\pm", "+").replace("\\mp", "-"), text.replace("\\pm", "-").replace("\\mp", "+")]
    return [re.sub(r"(^|[{(=]\s*)\+", r"\1", variant.strip()) for variant in variants]


def _named_pieces(tex: str):
    """[(name or None, rhs)] for each answer separated by "or" / "and" / a comma."""
    cleaned = _strip_decorations(tex)
    result = []
    for piece in _split(cleaned, _top_level_cuts(cleaned, _SEPARATORS)):
        cuts = _top_level_cuts(piece, r"=")
        name = re.sub(r"\s+", "", piece[: cuts[-1][0]]) if cuts else None
        rhs = piece[cuts[-1][1]:] if cuts else piece
        if not rhs.strip():
            raise ValueError(f"empty answer in {tex!r}")
        result.append((name or None, rhs))
    return result


def parse_list(tex: str, functions=()):
    """Every value of one unknown, in written order: `x = -1 \\text{ or } x = 4`, `x = \\frac{3 \\pm \\sqrt{5}}{2}`."""
    pieces = _named_pieces(tex)
    names = {name for name, _ in pieces if name}
    if len(names) > 1:
        raise ValueError(f"{tex!r} gives values of different unknowns {sorted(names)}; use parse_assignments")
    values = [_parse(variant, tex, functions) for _, rhs in pieces for variant in _expand_pm(rhs)]
    if len(values) < 2:
        raise ValueError(f"{tex!r} holds a single answer; use parse_answer")
    return values


def parse_assignments(tex: str, functions=()):
    """Named values: `x = 1, y = 2` or `x = 1 \\text{ and } y = 2` -> {"x": 1, "y": 2}."""
    result = {}
    for name, rhs in _named_pieces(tex):
        if not name:
            raise ValueError(f"{tex!r}: every value needs a name, as in x = 1")
        if name in result:
            raise ValueError(f"{tex!r}: {name} is given twice")
        result[name] = _parse(rhs, tex, functions)
    return result


def check_assignments(tex: str, truth):
    published = parse_assignments(tex)
    expected = {str(key): value for key, value in truth.items()}
    if set(published) != set(expected):
        raise AssertionError(f"published names {sorted(published)} are not {sorted(expected)}")
    for name, value in expected.items():
        if simplify(published[name] - value) != 0:
            raise AssertionError(f"published {name} = {published[name]} is not {value}")


# ---------------------------------------------------------------------------------------------------- units, rounding

def _normal_unit(unit: str) -> str:
    unit = re.sub(r"\^\s*\{?\s*\\circ\s*\}?|\\degree|°", "°", unit)
    unit = re.sub(r"\\(?:text|mathrm)\{", "", unit).replace("{", "").replace("}", "").replace("\\ ", " ")
    return re.sub(r"\s+", " ", unit).strip()


def _unit_start(rhs: str):
    match = re.search(r"\^\s*\{?\s*\\circ|\\degree|°|\\(?:text|mathrm)\{(?!\s*\()", rhs)
    return match.start() if match else None


def parse_with_unit(tex: str, unit: str) -> str:
    """The TeX with its trailing unit removed. The unit must be there and match `unit` (e.g. "cm^2", "°", "m s^-1")."""
    cleaned = _strip_decorations(tex)
    cuts = _top_level_cuts(cleaned, r"\\approx|=")
    offset = cuts[-1][1] if cuts else 0
    start = _unit_start(cleaned[offset:])
    if start is None:
        raise ValueError(f"{tex!r} has no unit; expected {unit!r}")
    published = _normal_unit(cleaned[offset + start:])
    if published != _normal_unit(unit):
        raise AssertionError(f"{tex!r} has unit {published!r}, expected {_normal_unit(unit)!r}")
    return cleaned[: offset + start]


def parse_degrees(tex: str):
    """An exact angle written in degrees, e.g. `\\angle ABC = 60^{\\circ}` -> 60."""
    return parse_answer(parse_with_unit(tex, "°"))


def parse_approx(tex: str, unit=None):
    """(value, significant figures, decimal places, relation) of ONE rounded number after the last `\\approx` or `=`.

    `relation` is "\\approx" or "=". A trailing remark such as `\\text{ (3 s.f.)}` is ignored.
    """
    cleaned = _strip_decorations(parse_with_unit(tex, unit) if unit else tex)
    if _top_level_cuts(cleaned, _SEPARATORS):
        raise ValueError(f"{tex!r} holds several values; use check_rounded_list")
    cuts = _top_level_cuts(cleaned, r"\\approx|=")
    relation = cleaned[cuts[-1][0]:cuts[-1][1]] if cuts else "="
    rhs = cleaned[cuts[-1][1]:] if cuts else cleaned
    rhs = re.sub(r"\\(?:text|mathrm)\{\s*\([^}]*\)\s*\}", " ", rhs).strip()
    rhs = re.sub(r"\\%$", "", rhs).strip()
    match = re.fullmatch(r"(-?)\s*(\d+(?:\.\d+)?)(?:\s*\\times\s*10\^\{?(-?\d+)\}?)?", rhs)
    if not match:
        raise ValueError(f"no plain decimal number at the end of {tex!r} (got {rhs!r})")
    sign, mantissa, exponent = match.groups()
    exponent = int(exponent or 0)
    digits = mantissa.replace(".", "").lstrip("0") or "0"
    decimals = (len(mantissa.split(".")[1]) if "." in mantissa else 0) - exponent
    value = Decimal(f"{sign}{mantissa}").scaleb(exponent)
    return value, len(digits), decimals, relation


def _decimal(truth) -> Decimal:
    return Decimal(str(N(truth, 40)))


def round_half_up(truth, sf=3, dp=None) -> Decimal:
    """The truth rounded the way IB mark schemes round: half away from zero, to `dp` places or `sf` figures."""
    value = _decimal(truth)
    if dp is not None:
        return value.quantize(Decimal(1).scaleb(-dp), rounding=ROUND_HALF_UP)
    return value.quantize(Decimal(1).scaleb(value.adjusted() - sf + 1), rounding=ROUND_HALF_UP)


def check_rounded(tex: str, truth, sf=3, dp=None, unit=None):
    """A rounded answer: written with \\approx, at exactly `sf` figures (or `dp` places), equal to the truth rounded half-up.

    An answer written with `=` must be the exact truth: a rounded value presented with `=` fails.
    """
    value, figures, places, relation = parse_approx(tex, unit)
    if relation == "=":
        if simplify(nsimplify(str(value), rational=True) - truth) != 0:
            raise AssertionError(f"{tex!r} uses = but {value} is not exactly {truth}; write \\approx and round correctly")
        return
    if dp is not None and places != dp:
        raise AssertionError(f"{tex!r} shows {places} decimal places, {dp} required")
    if dp is None and figures != sf:
        raise AssertionError(f"{tex!r} shows {figures} significant figures, {sf} required")
    expected = round_half_up(truth, sf, dp)
    if value != expected:
        raise AssertionError(f"published {value} is not {N(truth, 12)} rounded ({expected})")


def check_numeric(value, truth, sf=3, dp=None, tolerance=None):
    """A numeric check's value must be the truth rounded half-up to `sf` figures (or `dp` places), and its
    tolerance, if given, at most half a unit in that required place."""
    expected = round_half_up(truth, sf, dp)
    if float(value) != float(expected):
        raise AssertionError(f"published {value} is not {N(truth, 12)} rounded ({expected})")
    if tolerance is not None:
        limit = Decimal(1).scaleb(expected.as_tuple().exponent) / 2
        if Decimal(repr(float(tolerance))) > limit:
            raise AssertionError(f"tolerance {tolerance} is looser than half a unit in the required place ({limit})")


def check_rounded_list(tex: str, truths, sf=3, dp=None, unit=None):
    """Several rounded values (`x \\approx 1.23 \\text{ or } x \\approx 4.56`), compared in increasing order."""
    cleaned = _strip_decorations(tex)
    pieces = _split(cleaned, _top_level_cuts(cleaned, _SEPARATORS))
    if len(pieces) != len(truths):
        raise AssertionError(f"{tex!r} gives {len(pieces)} value(s), {len(truths)} expected")
    published = sorted(pieces, key=lambda piece: parse_approx(piece, unit)[0])
    for piece, truth in zip(published, sorted(truths, key=lambda value: float(N(value)))):
        check_rounded(piece, truth, sf, dp, unit)


# ------------------------------------------------------------------------------------------------ calculus, geometry

def check_antiderivative(tex: str, integrand, var="x", samples=None):
    """d/d(var) of the published antiderivative equals the integrand wherever both are real (handles ln|x|)."""
    symbol, real = Symbol(var), Symbol(var, real=True)
    derivative = diff(parse_answer(tex).subs(symbol, real), real)
    target = integrand.subs(symbol, real)
    compared = 0
    for point in samples or [-3.7, -2.3, -1.3, -0.65, -0.15, 0.35, 0.8, 1.3, 2.7, 4.1]:
        try:
            got, want = complex(N(derivative.subs(real, point))), complex(N(target.subs(real, point)))
        except (TypeError, ValueError):
            continue
        if any(v != v or abs(v) == float("inf") for v in (got, want)) or abs(want.imag) > 1e-12:
            continue
        compared += 1
        if abs(got - want) > 1e-8 * max(1, abs(want)):
            raise AssertionError(f"d/d{var} of {tex!r} is {got.real:.6g} at {var} = {point}, integrand is {want.real:.6g}")
    if compared < 3:
        raise ValueError(f"only {compared} sample point(s) inside the domain; pass samples=[...]")


def parse_vector(tex: str):
    """Entries of the column vector (pmatrix/bmatrix) after the last top-level `=`, as sympy expressions."""
    cleaned = _strip_decorations(tex)
    match = re.search(r"\\begin\{([pb]matrix)\}(.*?)\\end\{\1\}\s*$", _after_last_top_level_equals(cleaned).strip(), re.S)
    if not match:
        raise ValueError(f"no column vector at the end of {tex!r}")
    return [_parse(entry.strip(), tex) for entry in match.group(2).split("\\\\")]


def parse_vector_line(tex: str):
    """(point, direction) of `\\boldsymbol{r} = \\begin{pmatrix}..\\end{pmatrix} + \\lambda\\begin{pmatrix}..\\end{pmatrix}`."""
    rhs = _after_last_top_level_equals(_strip_decorations(tex)).strip()
    match = re.fullmatch(
        r"\\begin\{([pb])matrix\}(.*?)\\end\{\1matrix\}\s*\+\s*(?:\\lambda|\\mu|t|s)\s*(?:\\cdot)?\s*\\begin\{([pb])matrix\}(.*?)\\end\{\3matrix\}",
        rhs, re.S)
    if not match:
        raise ValueError(f"{tex!r} is not of the form r = (point) + lambda (direction) with column vectors")
    entries = lambda body: [_parse(entry.strip(), tex) for entry in body.split("\\\\")]  # noqa: E731
    return entries(match.group(2)), entries(match.group(4))


def check_same_line(tex: str, point, direction):
    """The published line is the true line: its direction is parallel to `direction` and its point lies on the line."""
    p, d = parse_vector_line(tex)
    if len(p) != len(point) or len(d) != len(direction):
        raise AssertionError(f"{tex!r} has the wrong dimension")
    true_d = Matrix(direction).T
    if all(simplify(entry) == 0 for entry in d):
        raise AssertionError(f"{tex!r} has a zero direction vector")
    if Matrix.vstack(Matrix(d).T, true_d).rank(simplify=True) != 1:
        raise AssertionError(f"direction {d} is not parallel to {list(direction)}")
    if Matrix.vstack((Matrix(p) - Matrix(point)).T, true_d).rank(simplify=True) > 1:
        raise AssertionError(f"point {p} is not on the line through {list(point)}")


def parse_set(tex: str, var="x"):
    """A set of real numbers from inequalities (`x < -1 \\text{ or } x > 4`, `-1 < x \\le 3`) or intervals (`]1,3[`)."""
    cleaned = re.sub(r"^\s*[A-Za-z]\s*\\in\s*", "", _strip_decorations(tex).strip())
    symbol = Symbol(var)
    parts = []
    for piece in re.split(r"\\text\{\s*or\s*\}|\\cup", cleaned):
        piece = piece.strip()
        interval = re.fullmatch(r"([\[\]])\s*(.+?)\s*,\s*(.+?)\s*([\[\]])", piece)
        if interval:
            left, a, b, right = interval.groups()
            parts.append(Interval(_parse(a, tex), _parse(b, tex), left_open=left == "]", right_open=right == "["))
            continue
        tokens = re.split(r"(\\le |\\ge |\\le(?![a-z])|\\ge(?![a-z])|<|>)", piece)
        if len(tokens) < 3:
            raise ValueError(f"cannot read {piece!r} in {tex!r} as an inequality or an interval")
        exprs = [_parse(token, tex) for token in tokens[0::2]]
        ops = {"<": Lt, ">": Gt, "\\le": Le, "\\ge": Ge}
        current = Interval(-oo, oo)
        for left, op, right in zip(exprs, tokens[1::2], exprs[1:]):
            relation = ops[op.strip()](left, right)
            if relation.free_symbols != {symbol}:
                raise ValueError(f"{piece!r} must compare {var} with numbers")
            current = current.intersect(relation.as_set())
        parts.append(current)
    return Union(*parts)


def check_same_set(tex: str, truth, var="x"):
    published = parse_set(tex, var)
    if published.complement(truth) != EmptySet or truth.complement(published) != EmptySet:
        raise AssertionError(f"published set {published} is not {truth}")


def parse_equation(tex: str, functions=()):
    """lhs - rhs of an equation such as `2x + y - z = 3` or `\\Pi: 2x + y - z = 3`."""
    cleaned = re.sub(r"^\s*\\?[A-Za-z]+(?:_\{?\w+\}?)?\s*:", "", _strip_decorations(tex))
    cuts = _top_level_cuts(cleaned, r"=")
    if len(cuts) != 1:
        raise ValueError(f"{tex!r} must be one equation with exactly one =")
    lhs, rhs = _split(cleaned, cuts)
    return _parse(lhs, tex, functions) - _parse(rhs, tex, functions)


def check_same_equation(tex: str, truth):
    """The published equation equals the true one up to a non-zero constant factor (planes, lines, circles)."""
    published = parse_equation(tex)
    truth = truth.lhs - truth.rhs if hasattr(truth, "lhs") else truth
    published = published.subs({s: Symbol(s.name) for s in published.free_symbols})
    ratio = simplify(published / truth)
    if ratio.free_symbols or ratio == 0 or not ratio.is_finite:
        raise AssertionError(f"published equation {published} = 0 is not {truth} = 0")


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
    return [_parse(piece.strip(), tex) for piece in _split(inner, cuts)]


__all__ = [
    "parse_answer", "parse_list", "parse_assignments", "parse_approx", "parse_with_unit", "parse_degrees", "parse_vector",
    "parse_vector_line", "parse_point", "parse_set", "parse_equation", "round_half_up", "check_antiderivative", "check_rounded",
    "check_rounded_list", "check_numeric", "check_assignments", "check_same_line", "check_same_set", "check_same_equation",
]
