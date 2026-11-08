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
  parse_with_unit(tex, unit)       the TeX with its unit removed; the unit must be present and match. Units are
                                   compared token by token in any order, with \\text{}, \\mathrm{}, mhchem \\pu{}, \\,
                                   `^{-1}`, `-1` and `⁻¹` all equivalent: \\text{kJ mol}^{-1} = kJ mol-1 = kJ mol⁻¹.
                                   \\Omega, Ω and the ohm sign U+2126 read Ω; \\mu, μ and µ read µ (\\mu\\text{F} = µF).
                                   Matching is by spelling, not dimension: N s is not kg m s-1, Hz is not s-1.
  split_unit(tex, plain=False)     (TeX without its trailing unit, the normalised unit or None). A unit starts at
                                   \\text / \\mathrm (not a "(3 s.f.)" remark), a degree sign, \\% or \\pu{}; with plain=True
                                   also at a bare SI/chemistry/physics unit such as `mol dm^{-3}`, `kJ mol⁻¹`,
                                   `m s^{-2}`, `rad s^{-1}`, `kΩ`, `MeV`, `T`, `Wb`, `ly`, and (plain only) at Ω / \\Omega
                                   or \\mu\\text{..} after a number, so 4.7\\,\\mu\\text{F} reads as µF.
  parse_degrees(tex)               an exact angle written with ^{\\circ}.
  parse_vector(tex), parse_point(tex), parse_vector_line(tex), parse_set(tex), parse_equation(tex)

Checking (raise AssertionError when the published answer is wrong)
  check_antiderivative(tex, integrand, var="x")      d/dx of the answer equals the integrand, proved symbolically
  check_self_inverse(tex, var="x", domain=R)        f is defined on the domain and f(f(x)) = x is proved (real odd roots)
  check_rounded(tex, truth, sf=3, dp=None, unit=None) exactly the required precision, ROUND_HALF_UP of the truth
  check_rounded_list(tex, truths, ...)              several rounded values, compared as a sorted list
  check_numeric(value, truth, sf=3, dp=None, tolerance=None)  a numeric check's float and its tolerance
  check_assignments(tex, truth)                     named values, names kept
  check_same_line(tex, point, direction)            same line, any point on it and any parallel direction
  check_same_cartesian_line(tex, point, direction)  `(x-x0)/l = (y-y0)/m = (z-z0)/n`, each part affine: the same line
  check_same_set(tex, truth_set, var="x")           inequalities / intervals as sets
  check_same_equation(tex, truth)                   equations equal up to a non-zero constant factor
"""
import contextlib
import re
from decimal import ROUND_HALF_UP, Decimal

from sympy import (
    Abs, Derivative, E, EmptySet, Function, I, Integer, Integral, Interval, Limit, Matrix, Mul, N, Pow, Product, Rational, Sum, Symbol,
    Union, cos, diff, exp, expand, expand_trig, factor, log, nsimplify, oo, pi, real_root, simplify, sin, trigsimp,
)
from sympy import S
from sympy.calculus.util import continuous_domain
from sympy.core.function import AppliedUndef
from sympy.core.relational import Ge, Gt, Le, Lt
from sympy.parsing.latex import parse_latex

_GREEK = r"alpha|beta|gamma|delta|epsilon|theta|lambda|mu|sigma|phi|omega|iota|pi|rho|tau"
_CIS = " CISMARK "
_FUNCS = r"ln|log|exp|sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh"
_NAMED = {"cosec": "csc", **{name: name for name in _FUNCS.split("|")}}


def _expand_pu(tex: str) -> str:
    """mhchem quantities: \\pu{-890 kJ mol-1} -> -890 \\text{kJ mol-1}; \\pu{2.50e-3 mol} -> 2.50 \\times 10^{-3} \\text{mol}."""
    while True:
        match = re.search(r"\\pu\s*\{", tex)
        if not match:
            return tex
        depth, i = 1, match.end()
        while i < len(tex) and depth:
            depth += {"{": 1, "}": -1}.get(tex[i], 0)
            i += 1
        if depth:
            raise ValueError(f"unbalanced braces after \\pu in {tex!r}")
        body = tex[match.end(): i - 1].strip().replace("\u2212", "-")
        number = re.match(r"([-+]?\s*\d+(?:\.\d+)?)(?:\s*(?:[eE]|\*\s*10\s*\^|\\times\s*10\s*\^|\\cdot\s*10\s*\^)\s*\{?\s*([-+]?\d+)\s*\}?)?", body)
        if number:
            value = number.group(1).replace(" ", "") + (f" \\times 10^{{{number.group(2)}}}" if number.group(2) else "")
            rest = body[number.end():].strip()
            body = value + (f" \\text{{{rest}}}" if rest else "")
        else:
            body = f"\\text{{{body}}}"
        tex = tex[: match.start()] + " " + body + " " + tex[i:]


def _strip_decorations(tex: str) -> str:
    tex = tex.replace("$", "")  # lesson strings wrap maths in $...$
    tex = _expand_pu(tex).replace("\u2212", "-")  # \pu{} quantities; a Unicode minus sign is a minus
    tex = re.sub(r"\\l?vert|\\r?vert|\\[lr]Vert", "|", tex)
    tex = re.sub(r"\\(?:displaystyle|left|right|big|Big|bigg|Bigg)(?![a-zA-Z])", "", tex)
    tex = tex.replace("\\,", " ").replace("\\;", " ").replace("\\!", " ").replace("\\ ", " ").replace("\\quad", " ")
    tex = re.sub(r"\\[td]frac", r"\\frac", tex)
    tex = re.sub(r"\\leq(?:slant)?(?![a-zA-Z])", r"\\le ", tex)
    tex = re.sub(r"\\geq(?:slant)?(?![a-zA-Z])", r"\\ge ", tex)
    tex = re.sub(r"\\(?:mathrm|operatorname|text)\{\s*cis\s*\}", _CIS, tex)
    # \operatorname{cosec} x, \mathrm{sin} x -> \csc x, \sin x (SymPy reads the long forms as products of letters).
    tex = re.sub(r"\\(?:mathrm|operatorname)\{\s*([A-Za-z]{2,})\s*\}", lambda m: f"\\{_NAMED[m.group(1)]} " if m.group(1) in _NAMED else m.group(0), tex)
    tex = re.sub(r"\\cosec(?![A-Za-z])", r"\\csc", tex)
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


#: A trailing `+ C` is dropped by default (the AA sidecars rely on it). The declarative kinds turn it off with
#: keep_constant(): outside antiderivatives C is an ordinary symbol, so an extra `+ C` makes an answer wrong.
_STRIP_CONSTANT = True


@contextlib.contextmanager
def strip_constant():
    global _STRIP_CONSTANT
    before, _STRIP_CONSTANT = _STRIP_CONSTANT, True
    try:
        yield
    finally:
        _STRIP_CONSTANT = before


@contextlib.contextmanager
def keep_constant():
    global _STRIP_CONSTANT
    before, _STRIP_CONSTANT = _STRIP_CONSTANT, False
    try:
        yield
    finally:
        _STRIP_CONSTANT = before


def _parse(rhs: str, original: str, functions=()):
    if _STRIP_CONSTANT:
        rhs = re.sub(r"\s*\+\s*C\s*$", "", rhs)
    rhs = rhs.strip()
    if not rhs:
        raise ValueError(f"no expression found in {original!r}")
    if re.search(r"\\log(?!\s*_)", rhs):
        raise ValueError(f"{original!r} uses \\log with no base; write \\log_{{10}} or \\ln")
    if re.search(r"\\(?:mathrm|operatorname)\{\s*[A-Za-z]{2,}\s*\}", rhs):
        raise ValueError(f"{original!r} uses an \\operatorname/\\mathrm name SymPy can't read; write \\sin, \\csc, \\ln, ...")
    _refuse_greedy_argument(rhs, original)
    if _CIS.strip() in rhs:
        modulus, argument = rhs.split(_CIS.strip(), 1)
        r = _parse(modulus, original, functions) if modulus.strip() else 1
        theta = _parse(argument, original, functions)
        return r * (cos(theta) + I * sin(theta))
    try:
        # strict: the whole text must parse. The lenient default silently drops trailing input ("116/15 +", "116/15, 999").
        expr = parse_latex(_products(rhs, functions), strict=True)
    except Exception as error:  # noqa: BLE001 - parse_latex raises assorted antlr errors
        raise ValueError(f"cannot parse {original!r} (as {rhs!r}): {type(error).__name__}: {error}") from error
    _refuse_dropped_letters(rhs, expr, original, functions)
    # An answer that is still an unevaluated integral, derivative, limit, sum or product has not been worked out.
    if expr.has(Integral, Derivative, Limit, Sum, Product):
        raise ValueError(f"answer {original!r} is not evaluated: it still contains an Integral, Derivative, Limit, Sum or Product")
    calls = [call for call in expr.atoms(AppliedUndef) if call.func.__name__ not in functions]
    if calls:
        raise ValueError(f"{original!r} reads as a call to an undeclared function {calls[0]}; pass functions=(...) if it is one")
    return expr.subs({Symbol("e"): E, Symbol("iota"): I, Symbol("pi"): pi})


def _refuse_greedy_argument(rhs: str, original: str):
    """SymPy reads `\\ln 3 \\cdot x` as ln(3x) and `\\sin x \\cdot \\cos x` as sin(x cos x): a function whose argument isn't in
    round brackets swallows a following \\cdot or \\times. Refuse it; `\\ln(3) \\cdot x` or `x \\ln 3` read correctly."""
    for match in re.finditer(rf"\\(?:{_FUNCS})(?![A-Za-z])", rhs):
        rest = rhs[match.end():]
        rest = re.sub(r"^\s*(?:[_^](?:\{[^{}]*\}|\S)\s*)*", "", rest)  # powers and bases: \sin^{2}, \log_{10}
        if rest.startswith("("):
            continue
        depth = 0
        for index, char in enumerate(rest):
            if char in "({[":
                depth += 1
            elif char in ")}]":
                if depth == 0:
                    break
                depth -= 1
            elif depth == 0 and char in "+-=,":
                break
            elif depth == 0 and (rest.startswith("\\cdot", index) or rest.startswith("\\times", index)):
                raise ValueError(f"{original!r} is ambiguous: SymPy reads the \\cdot/\\times into the {match.group(0)} argument; put the argument in round brackets")


def _refuse_dropped_letters(rhs: str, expr, original: str, functions=()):
    """SymPy silently drops a letter in forms like `2x\\ln 3` (it returns 2 ln 3). Every variable letter in the text must
    survive into the expression."""
    text = re.sub(r"\\(?:text|mathrm|operatorname)\{[^{}]*\}", " ", rhs)
    text = re.sub(r"\\[A-Za-z]+", " ", text)
    letters = set(re.findall(r"[A-Za-z]", text)) - {"e", "i", "C"} - set(functions)
    kept = {symbol.name for symbol in expr.free_symbols}
    missing = sorted(letter for letter in letters if letter not in kept)
    if missing and not expr.has(*[Symbol(letter) for letter in missing]):
        raise ValueError(f"{original!r}: SymPy dropped {', '.join(missing)} while parsing; write the product with \\cdot or brackets")


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

_SUPERSCRIPTS = str.maketrans("\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u207b\u207a", "0123456789-+")


def _normal_unit(unit: str) -> str:
    """One spelling for a unit: \\text{kJ mol}^{-1}, kJ\\,mol^{-1}, kJ mol-1 and kJ mol⁻¹ all read "kJ mol-1". Tokens are
    sorted, so J K^{-1} mol^{-1} = J mol^{-1} K^{-1} (a product of units does not depend on the order). \\Omega and the
    ohm sign read Ω; \\mu, μ and µ read µ, joined to the unit after it (\\mu\\text{F} = µF), as k / M / G are to Ω."""
    unit = re.sub(r"\^\s*\{?\s*\\circ\s*\}?|\\degree|°", "°", unit)
    unit = re.sub(r"\\Omega(?![A-Za-z])|\u2126", "\u03a9", unit)
    unit = unit.replace("\u2212", "-").translate(_SUPERSCRIPTS)
    unit = re.sub(r"\\(?:text|mathrm|textrm|operatorname|pu)\s*\{", " ", unit)
    unit = re.sub(r"\\(?:cdot|[,;:! ])|\\q?quad(?![A-Za-z])|[~·]", " ", unit)
    unit = unit.replace("\\%", "%")
    unit = re.sub(r"\\(?:mu|micro)(?![A-Za-z])|\u03bc", "\u00b5", unit)
    unit = unit.replace("{", "").replace("}", "").replace("^", "")
    unit = re.sub(r"\u00b5\s+", "\u00b5", unit)  # \mu\text{F} -> µF: a prefix on its own is never a unit
    unit = re.sub(r"(?<!\S)([kMG])\s+(?=\u03a9)", r"\1", unit)  # \text{k}\,\Omega -> kΩ (but Ω m stays ohm metre)
    unit = re.sub(r"\s+(?=[-+]?\d)", "", unit)  # "mol -1" -> "mol-1"
    unit = re.sub(r"°\s*", "°", unit)  # ^{\circ}\text{C} -> °C
    return " ".join(sorted(unit.split()))


#: After a number: an ohm unit (5\,\Omega, 2.2 k\Omega, 3 Ω) or a micro prefix before \text (4.7\,\mu\text{F}).
_NUMBER_UNIT = re.compile(r"\d\s*((?:[kMG\u00b5\u03bc]|\\mu\s*)?(?:\\Omega(?![A-Za-z])|[\u03a9\u2126])|(?:\\mu\s*|[\u00b5\u03bc])(?=\\(?:text|mathrm)\{))")


def _unit_start(rhs: str):
    match = re.search(r"\^\s*\{?\s*\\circ|\\degree|°|\\%|%|\\(?:text|mathrm)\{(?!\s*\()", rhs)
    return match.start() if match else None


#: A bare unit token: an SI, chemistry or physics unit with an optional prefix and power, as in mol, dm^{-3}, kJ, mol⁻¹,
#: cm^3, m s^{-2}, kΩ, \mu A, MeV, rad, T, Wb, ly, pc, AU, u.
_UNIT_TOKEN = (r"(?:(?:(?:[kMGmcdnpµμ]|\\mu\s*)?(?:mol|g|m|L|J|Pa|s|K|V|Wb|W|N|Hz|eV|A|C|T|F|Ω|\\Omega(?![A-Za-z])))"
               r"|rad|ly|pc|AU|u|atm|min|hr?|ppm|M)"
               r"(?:\s*\^\s*\{?\s*[-\u2212]?\d+\s*\}?|[-\u2212]?\d+|[\u207b]?[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]+)?")
_PLAIN_UNIT = re.compile(rf"(?:(?<=[\d}}\s])|^)((?:{_UNIT_TOKEN})(?:\s*(?:{_UNIT_TOKEN}))*)\s*$")


def split_unit(tex: str, plain: bool = False):
    """(the TeX without its trailing unit, the unit normalised) or (tex unchanged, None) when it has no unit.

    The unit is what follows the number after the last top-level `=` / `\\approx`: from a \\text{...} / \\mathrm{...}
    (not a `\\text{ (3 s.f.)}` remark), a degree sign, a % sign or a \\pu{} quantity, or with plain=True a run of bare
    unit tokens (`mol dm^{-3}`, `kJ mol⁻¹`)."""
    cleaned = _strip_decorations(tex)
    cuts = _top_level_cuts(cleaned, r"\\approx|=")
    offset = cuts[-1][1] if cuts else 0
    rhs = cleaned[offset:]
    start = _unit_start(rhs)
    number = _NUMBER_UNIT.search(rhs) if plain else None
    if number and (start is None or number.start(1) < start):
        start = number.start(1)
    if start is None and plain:
        match = _PLAIN_UNIT.search(rhs)
        if match and re.search(r"\d", rhs[: match.start(1)]):
            start = match.start(1)
    if start is None:
        return tex, None
    return cleaned[: offset + start], _normal_unit(rhs[start:])


def parse_with_unit(tex: str, unit: str) -> str:
    """The TeX with its trailing unit removed. The unit must be there and match `unit` (e.g. "cm^2", "°", "m s^-1",
    "kJ mol-1"); see _normal_unit for what counts as the same unit."""
    stripped, published = split_unit(tex, plain=True)
    if published is None:
        raise ValueError(f"{tex!r} has no unit; expected {unit!r}")
    if published != _normal_unit(unit):
        raise AssertionError(f"{tex!r} has unit {published!r}, expected {_normal_unit(unit)!r}")
    return stripped


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
    match = re.fullmatch(r"([-+]?)\s*(\d+(?:\.\d+)?)(?:\s*\\times\s*10\^\{?(-?\d+)\}?)?", rhs)
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

def _log_of_modulus_as_log(expr):
    """ln|u| -> ln u. Both have derivative u'/u wherever ln|u| is defined, so derivatives can be compared exactly."""
    # SymPy may already have pulled constants out (ln|2x| -> ln(2|x|)), so treat any product of constants and powers of
    # moduli: d/dx ln(c|u|^n) = n u'/u = d/dx ln(c u^n).
    def multiplicative_modulus(arg):
        factors = Mul.make_args(arg)
        return any(f.has(Abs) for f in factors) and all(
            f.is_number or isinstance(f, Abs) or (isinstance(f, Pow) and isinstance(f.base, Abs) and f.exp.is_number) for f in factors)

    return expr.replace(
        lambda e: isinstance(e, log) and multiplicative_modulus(e.args[0]),
        lambda e: log(e.args[0].replace(lambda a: isinstance(a, Abs), lambda a: a.args[0])))


def proves_zero(expr) -> bool:
    """True only when SymPy reduces expr to exactly 0 (simplify, then trig and exponential rewrites). False means
    "not proved", never "proved non-zero"."""
    if expr == 0:
        return True
    attempts = (
        lambda e: simplify(e),
        lambda e: simplify(trigsimp(e)),
        lambda e: simplify(expand_trig(e)),
        lambda e: simplify(expand(e.rewrite(exp))),
    )
    for attempt in attempts:
        try:
            if attempt(expr) == 0:
                return True
        except Exception:  # noqa: BLE001 - a rewrite SymPy cannot do is just "not proved"
            continue
    return False


def check_antiderivative(tex: str, integrand, var="x", samples=None):
    """d/d(var) of the published antiderivative equals the integrand as an identity, proved symbolically (ln|u| is
    differentiated as u'/u). The sample points are a smoke check that names a point where a wrong answer differs."""
    symbol, real = Symbol(var), Symbol(var, real=True)
    with strip_constant():
        published = parse_answer(tex).subs(symbol, real)
    derivative = diff(published, real)
    target = integrand.subs(symbol, real)
    _compare_antiderivative_at_samples(tex, var, real, derivative, target, samples)
    if not proves_zero(diff(_log_of_modulus_as_log(published), real) - target):
        raise AssertionError(f"d/d{var} of {tex!r} could not be proved equal to {integrand}")


def _compare_antiderivative_at_samples(tex, var, real, derivative, target, samples):
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


class RealRoot(Function):
    """RealRoot(a, n): the real n-th root of a real number a, for odd n. Its rules hold for EVERY real a and b:
    RealRoot(a, n)**n = a, RealRoot(b**n, n) = b, RealRoot(-a, n) = -RealRoot(a, n) and RealRoot(ab) splits."""

    @classmethod
    def eval(cls, a, n):
        if not (n.is_Integer and n % 2 == 1):
            raise ValueError(f"RealRoot needs an odd whole index, got {n}")
        if a.is_Rational:
            return real_root(a, n)
        if a.could_extract_minus_sign():
            return -cls(-a, n)
        if a.is_Pow and a.exp.is_Integer and a.exp % n == 0:
            return a.base ** (a.exp // n)
        if a.is_Mul:
            pieces = [cls(f, n) for f in a.args]
            if any(not isinstance(p, cls) for p in pieces):
                out = Integer(1)
                for p in pieces:
                    out *= p
                return out
        return None


def with_real_odd_roots(expr):
    """Every power with an odd-denominator rational exponent becomes a real root, so x^(1/3) means the real cube root
    (as on a GDC) rather than SymPy's complex principal root."""
    def convert(e):
        p, q = e.exp.p, e.exp.q
        return RealRoot(e.base, Integer(q)) ** p
    return expr.replace(lambda e: isinstance(e, Pow) and e.exp.is_Rational and not e.exp.is_Integer and e.exp.q % 2 == 1,
                        convert)


def _normalise_real_roots(expr):
    """Apply RealRoot(a, n)**(kn) = a**k and re-read every root of an expanded, factorised argument, until stable."""
    for _ in range(20):
        before = expr
        expr = expr.replace(
            lambda e: isinstance(e, Pow) and isinstance(e.base, RealRoot) and e.exp.is_Integer and e.exp % e.base.args[1] == 0,
            lambda e: e.base.args[0] ** (e.exp // e.base.args[1]))
        expr = expr.replace(lambda e: isinstance(e, RealRoot), lambda e: RealRoot(factor(expand(e.args[0])), e.args[1]))
        if expr == before:
            break
    return expr


def _as_real_numbers(expr):
    return expr.replace(lambda e: isinstance(e, RealRoot), lambda e: real_root(e.args[0], e.args[1]))


def _defined_on(f, real, domain) -> bool:
    """f is real and continuous on all of `domain`. An odd real root keeps the sign and the zeros of its argument, so
    swapping RealRoot(a, n) for a leaves every domain condition (non-zero denominator, positive log argument) intact."""
    plain = f.replace(lambda e: isinstance(e, RealRoot), lambda e: e.args[0])
    try:
        return domain.is_subset(continuous_domain(plain, real, S.Reals)) is True
    except NotImplementedError:
        return False


def check_self_inverse(tex: str, var="x", domain=Interval(-oo, oo),
                       samples=(0, -3, -1, Rational(1, 2), 2, Rational(17, 5))):
    """The published f is self-inverse on `domain` (default all real numbers): f is defined on all of it, and
    f(f(x)) - x is PROVED to be 0 with real odd roots. Sample points only name a counterexample for a wrong answer;
    agreeing at samples never passes on its own."""
    symbol, real = Symbol(var), Symbol(var, real=True)
    f = with_real_odd_roots(parse_answer(tex).subs(symbol, real))
    if not _defined_on(f, real, domain):
        raise AssertionError(f"{tex!r} is not defined at every point of {domain}")
    difference = _normalise_real_roots(f.subs(real, f) - real)
    if proves_zero(difference):
        return
    twice = _as_real_numbers(_normalise_real_roots(f.subs(real, f)))
    for s in samples:
        value = twice.subs(real, s)
        if value.is_Rational and value != s:
            raise AssertionError(f"{tex!r} is not self-inverse: f(f({s})) = {value}, not {s}")
        if abs(N(value - s, 30)) > 1e-20:
            raise AssertionError(f"{tex!r} is not self-inverse: f(f({s})) = {N(value, 10)}, not {s}")
    raise AssertionError(f"could not prove f(f({var})) = {var} for {tex!r}")


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


def check_same_cartesian_line(tex: str, point, direction):
    """`(x - x0)/l = (y - y0)/m = (z - z0)/n` is exactly the line through `point` with `direction`.

    Each part must be AFFINE in its own coordinate (a x + b with a constant a != 0), one part per coordinate. Then the
    equations say a_i x_i + b_i = mu for one mu, which is the line through (-b_i / a_i) with direction (1 / a_i), and it
    is compared with check_same_line's rule. A part such as (x + 4)^2 / 4 is refused: setting squares equal also
    admits points off the line, so substituting the true line into the parts proves only containment."""
    names = ["x", "y", "z"][: len(point)]
    cleaned = _strip_decorations(tex)
    pieces = _split(cleaned, _top_level_cuts(cleaned, r"="))
    if len(pieces) != len(point):
        raise AssertionError(f"{tex!r} has {len(pieces)} parts, expected {len(point)}")
    by_name = {}
    for piece in pieces:
        expr = _parse(piece.strip(), tex)
        expr = expr.subs({s: Symbol(s.name) for s in expr.free_symbols})
        used = {s.name for s in expr.free_symbols}
        if len(used) != 1 or not used <= set(names):
            raise AssertionError(f"part {expr} must involve exactly one of {names}")
        (name,) = used
        if name in by_name:
            raise AssertionError(f"{tex!r} uses {name} in two parts")
        var = Symbol(name)
        slope = simplify(diff(expr, var))
        if slope.free_symbols or slope == 0 or simplify(expr - slope * var).free_symbols:
            raise AssertionError(f"part {expr} is not of the form a{name} + b with a != 0, so it is not a line")
        by_name[name] = (slope, simplify(expr - slope * var))
    published_point = [-by_name[n][1] / by_name[n][0] for n in names]
    published_direction = [1 / by_name[n][0] for n in names]
    true_d = Matrix(direction).T
    if Matrix.vstack(Matrix(published_direction).T, true_d).rank(simplify=True) != 1:
        raise AssertionError(f"direction {published_direction} is not parallel to {list(direction)}")
    if Matrix.vstack((Matrix(published_point) - Matrix(point)).T, true_d).rank(simplify=True) > 1:
        raise AssertionError(f"point {published_point} is not on the line through {list(point)}")


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
    "parse_answer", "parse_list", "parse_assignments", "parse_approx", "parse_with_unit", "split_unit", "parse_degrees", "parse_vector",
    "parse_vector_line", "parse_point", "parse_set", "parse_equation", "round_half_up", "check_antiderivative", "keep_constant", "strip_constant", "check_rounded",
    "check_rounded_list", "check_numeric", "check_assignments", "check_same_line", "check_same_set", "check_same_equation",
    "check_same_cartesian_line", "check_self_inverse", "proves_zero", "with_real_odd_roots", "RealRoot",
]
