"""Declarative answer checks: an example or check block carries `verify: { kind, truth, ...opts }` instead of a sidecar.

`truth` is a SymPy expression built from the question's own data ("sqrt(5**2 + 12**2)", "Rational(3, 8) * Rational(2, 7)").
evaluate_truth() reads it in a restricted namespace: SymPy names only, no imports, no lambdas or comprehensions, no names
or attributes starting with "_", string constants only as identifier keys of a dict. Whole numbers become Integer and
decimals exact Rationals, so 1/3 is a third and 12.5 is exactly 25/2. Unknown names become symbols (x, y, n).

check(verify, published, tolerance=None) raises AssertionError when the published answer is wrong (including a wrong
form: an unsimplified ratio, 24 x 10^2, 4 s.f. where 3 are required) and ValueError when the text or the verify spec
cannot be read. Both FAIL the gate; a multiple-choice distractor must raise AssertionError (it is wrong, not unreadable).

Each kind is one function below; KINDS lists them with their options (validate.ts keeps the same table, and
mathparse.test.ts compares the two). Property-style kinds reject degenerate answers by construction: an equation
must equal the true one up to a NON-ZERO constant factor (so 0 = 0 and a squared equation fail), `expression` with
`scale` needs a non-zero constant ratio (so 0 or a constant is not an integrating factor), sets must be equal (not
contained). Identities are proved symbolically, never by agreeing at sample points.
"""
import ast
import json
import re
import sys
from decimal import Decimal
from math import gcd
from pathlib import Path

import sympy
from sympy import (
    Add, And, Eq, FiniteSet, Integer, Mul, Or, Poly, Pow, Rational, S, Set, Symbol, Tuple, expand, factor_list, fraction,
    gcd as poly_gcd, nsimplify, simplify, together,
)
from sympy.core.parameters import evaluate
from sympy.core.relational import Relational
from sympy.parsing.latex import parse_latex

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mathparse as mp  # noqa: E402

parse_latex("x")  # load the parser now: importing it under evaluate(False) breaks sympy.physics

# ------------------------------------------------------------------------------------------------------------ the spec

PRECISION = ("sf", "dp")
#: kind -> {"required": options that must be present, "oneOf": exactly one of these, "optional": other allowed options,
#:          "on": which blocks may use it ("example", "choice" = multiple-choice check, "numeric" = numeric check)}
KINDS = {
    "exact": {"optional": ["unit"], "on": ["example", "choice"]},
    "rounded": {"oneOf": list(PRECISION), "optional": ["unit"], "on": ["example", "choice"]},
    "numeric": {"oneOf": list(PRECISION), "on": ["numeric"]},
    "list": {"optional": list(PRECISION), "on": ["example", "choice"]},
    "assignments": {"on": ["example", "choice"]},
    "point": {"optional": list(PRECISION), "on": ["example", "choice"]},
    "vector": {"on": ["example", "choice"]},
    "equation": {"on": ["example", "choice"]},
    "inequality": {"optional": ["var"], "on": ["example", "choice"]},
    "set": {"optional": ["var"], "on": ["example", "choice"]},
    "ratio": {"on": ["example", "choice"]},
    "standard-form": {"optional": ["sf", "unit"], "on": ["example", "choice"]},
    "money": {"optional": ["dp"], "on": ["example", "choice"]},
    "time": {"required": ["form"], "on": ["example", "choice"]},
    "bearing": {"optional": ["dp"], "on": ["example", "choice"]},
    "angle": {"optional": list(PRECISION), "on": ["example", "choice"]},
    "fraction": {"optional": ["simplest", "form"], "on": ["example", "choice"]},
    "expression": {"optional": ["form", "scale"], "on": ["example", "choice"]},
    "antiderivative": {"optional": ["var"], "on": ["example", "choice"]},
    "choice": {"on": ["choice"]},
}
ENUMS = {"time.form": ["clock", "duration"], "fraction.form": ["mixed", "improper"], "expression.form": ["factorised", "expanded", "simplified"]}
BOOLEANS = {"fraction.simplest", "expression.scale"}


def check_spec(verify: dict):
    """ValueError unless `verify` names a known kind with a non-empty truth and exactly its allowed options."""
    if not isinstance(verify, dict):
        raise ValueError("verify must be an object { kind, truth, ...options }")
    kind, truth = verify.get("kind"), verify.get("truth")
    if kind not in KINDS:
        raise ValueError(f"unknown verify kind {kind!r}; expected one of {', '.join(KINDS)}")
    if not isinstance(truth, str) or not truth.strip():
        raise ValueError(f"verify.truth must be a non-empty string ({kind})")
    spec = KINDS[kind]
    options = {key: value for key, value in verify.items() if key not in ("kind", "truth")}
    allowed = set(spec.get("required", [])) | set(spec.get("oneOf", [])) | set(spec.get("optional", []))
    for key in options:
        if key not in allowed:
            raise ValueError(f"{kind} does not take option {key!r} (allowed: {', '.join(sorted(allowed)) or 'none'})")
    for key in spec.get("required", []):
        if key not in options:
            raise ValueError(f"{kind} needs option {key!r}")
    one_of = [key for key in spec.get("oneOf", []) if key in options]
    if spec.get("oneOf") and len(one_of) != 1:
        raise ValueError(f"{kind} needs exactly one of {' / '.join(spec['oneOf'])}")
    if "sf" in options and "dp" in options:
        raise ValueError(f"{kind}: give sf or dp, not both")
    for key in PRECISION:
        if key in options and not (isinstance(options[key], int) and not isinstance(options[key], bool) and options[key] >= (1 if key == "sf" else 0)):
            raise ValueError(f"{kind}: {key} must be a whole number{' of at least 1' if key == 'sf' else ''}")
    for key, value in options.items():
        name = f"{kind}.{key}"
        if name in ENUMS and value not in ENUMS[name]:
            raise ValueError(f"{name} must be one of {', '.join(ENUMS[name])}")
        if name in BOOLEANS and not isinstance(value, bool):
            raise ValueError(f"{name} must be true or false")
        if key in ("unit", "var") and not (isinstance(value, str) and value.strip()):
            raise ValueError(f"{name} must be a non-empty string")
    if kind == "money" and options.get("dp", 2) not in (0, 2):
        raise ValueError("money.dp must be 2 (or 0 for whole amounts)")


# ---------------------------------------------------------------------------------------------------------- the truth

_DENIED = {
    "lambdify", "preview", "var", "init_printing", "init_session", "sympify", "parse_expr", "plot", "plot_implicit", "plot_parametric",
    "pprint", "pprint_use_unicode", "print_python", "print_tree", "print_latex", "print_mathml", "print_rcode", "print_fcode",
    "print_ccode", "print_gtk", "python", "test", "doctest", "source", "srepr", "interactive_traversal", "rational_interpolate",
}
NAMESPACE = {name: getattr(sympy, name) for name in sympy.__all__ if name not in _DENIED and not name.startswith("_")}

_ALLOWED_NODES = (
    ast.Expression, ast.BinOp, ast.UnaryOp, ast.Call, ast.Name, ast.Load, ast.Constant, ast.Tuple, ast.List, ast.Dict,
    ast.keyword, ast.Attribute, ast.Subscript, ast.Compare, ast.Slice,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod, ast.FloorDiv, ast.USub, ast.UAdd,
    ast.Lt, ast.LtE, ast.Gt, ast.GtE,
)
_IDENTIFIER = re.compile(r"[A-Za-z][A-Za-z0-9]*\Z")


class _Exact(ast.NodeTransformer):
    """Whole numbers -> Integer(n), decimals -> Rational("12.5"), unknown names -> Symbol("x")."""

    def visit_Constant(self, node):
        if isinstance(node.value, bool) or node.value is None:
            raise ValueError("truth may not use True, False or None")
        if isinstance(node.value, int):
            return ast.copy_location(ast.Call(ast.Name("Integer", ast.Load()), [ast.Constant(node.value)], []), node)
        if isinstance(node.value, float):
            return ast.copy_location(ast.Call(ast.Name("Rational", ast.Load()), [ast.Constant(repr(node.value))], []), node)
        return node

    def visit_Name(self, node):
        if node.id in NAMESPACE:
            return node
        return ast.copy_location(ast.Call(ast.Name("Symbol", ast.Load()), [ast.Constant(node.id)], []), node)


def evaluate_truth(source: str):
    """The SymPy value of a verify.truth string, evaluated with SymPy names only (see the module docstring)."""
    if not isinstance(source, str) or not source.strip():
        raise ValueError("truth is empty")
    try:
        tree = ast.parse(source.strip(), mode="eval")
    except SyntaxError as error:
        raise ValueError(f"truth {source!r} is not an expression: {error.msg}") from error
    for node in ast.walk(tree):
        if not isinstance(node, _ALLOWED_NODES):
            raise ValueError(f"truth {source!r} uses {type(node).__name__}, which is not allowed")
        if isinstance(node, ast.Name) and not _IDENTIFIER.match(node.id) and node.id not in NAMESPACE:
            raise ValueError(f"truth {source!r} uses the name {node.id!r}")
        if isinstance(node, ast.Name) and node.id.startswith("_"):
            raise ValueError(f"truth {source!r} uses the name {node.id!r}")
        if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
            raise ValueError(f"truth {source!r} uses the attribute {node.attr!r}")
        if isinstance(node, ast.Call) and not isinstance(node.func, (ast.Name, ast.Attribute)):
            raise ValueError(f"truth {source!r} calls something that is not a SymPy name")
    # String constants only as identifier keys of a dict ({"x": 2, "y": -1}), never as an argument SymPy could parse.
    keys = {id(key) for node in ast.walk(tree) if isinstance(node, ast.Dict) for key in node.keys}
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str) and not (id(node) in keys and _IDENTIFIER.match(node.value)):
            raise ValueError(f"truth {source!r}: text is allowed only as a variable name key, as in {{\"x\": 2}}")
    tree = ast.fix_missing_locations(_Exact().visit(tree))
    try:
        return eval(compile(tree, "<truth>", "eval"), {"__builtins__": {}}, dict(NAMESPACE))  # noqa: S307 - restricted above
    except Exception as error:  # noqa: BLE001
        raise ValueError(f"truth {source!r} could not be evaluated: {type(error).__name__}: {error}") from error


# --------------------------------------------------------------------------------------------------------- helpers

def _plain(expr):
    """Symbols compared by name only (the lesson's x and the truth's x are the same x)."""
    try:
        return expr.subs({s: Symbol(s.name) for s in expr.free_symbols})
    except AttributeError:
        return expr


def _same(a, b) -> bool:
    return mp.proves_zero(simplify(_plain(S(a)) - _plain(S(b))))


def _number(truth, kind):
    value = S(truth)
    if not (value.is_number and value.is_real):
        raise ValueError(f"{kind} needs a real number as its truth, got {truth}")
    return value


def _rhs(tex):
    """Cleaned text after the last top-level = or \\approx, and which relation it was ("=" when there is none)."""
    cleaned = mp._strip_decorations(tex)
    cuts = mp._top_level_cuts(cleaned, r"\\approx|=")
    relation = cleaned[cuts[-1][0]:cuts[-1][1]] if cuts else "="
    return (cleaned[cuts[-1][1]:] if cuts else cleaned).strip(), relation


def _items(truth):
    if isinstance(truth, (list, tuple, Tuple)):
        return list(truth)
    if isinstance(truth, FiniteSet):
        return sorted(truth, key=lambda value: sympy.default_sort_key(value))
    if hasattr(truth, "args") and type(truth).__name__.startswith("Point"):
        return list(truth.args)
    if isinstance(truth, sympy.MatrixBase):
        return list(truth)
    raise ValueError(f"truth must be a list or tuple of values, got {truth}")


def _unevaluated(tex):
    """The published expression exactly as written (no automatic simplification), for structural form checks."""
    rhs = mp._after_last_top_level_equals(mp._strip_decorations(tex)).strip()
    rhs = re.sub(r"\s*\+\s*C\s*$", "", rhs)
    try:
        with evaluate(False):
            return parse_latex(mp._products(rhs), strict=True)
    except Exception as error:  # noqa: BLE001
        raise ValueError(f"cannot parse {tex!r}: {type(error).__name__}: {error}") from error


def _flat(expr, kind):
    """Arguments of nested unevaluated Adds (kind=Add) or Muls (kind=Mul), flattened."""
    if isinstance(expr, kind):
        return [piece for arg in expr.args for piece in _flat(arg, kind)]
    return [expr]


def _reduced_fraction_errors(expr):
    """Unsimplified number fractions written into an expression, such as 6/8 in \\frac{6}{8}x."""
    found = []
    for node in sympy.preorder_traversal(expr):
        if isinstance(node, Mul):
            ints = [arg for arg in node.args if isinstance(arg, Integer)]
            inverse = [arg.base for arg in node.args if isinstance(arg, Pow) and isinstance(arg.base, Integer) and arg.exp == -1]
            for top in ints:
                for bottom in inverse:
                    if gcd(int(top), int(bottom)) > 1:
                        found.append(f"{top}/{bottom}")
    return found


# ------------------------------------------------------------------------------------------------------------ kinds

def k_exact(tex, truth, opts):
    published = mp.parse_answer(mp.parse_with_unit(tex, opts["unit"]) if "unit" in opts else tex)
    if not _same(published, truth):
        raise AssertionError(f"published {published} is not {truth}")


def k_rounded(tex, truth, opts):
    mp.check_rounded(tex, _number(truth, "rounded"), sf=opts.get("sf"), dp=opts.get("dp"), unit=opts.get("unit"))


def k_numeric(value, truth, opts, tolerance=None):
    mp.check_numeric(value, _number(truth, "numeric"), sf=opts.get("sf"), dp=opts.get("dp"), tolerance=tolerance)


def k_list(tex, truth, opts):
    truths = _items(truth)
    if not truths:
        raise ValueError("list needs at least one true value")
    if "sf" in opts or "dp" in opts:
        mp.check_rounded_list(tex, truths, sf=opts.get("sf"), dp=opts.get("dp"))
        return
    try:
        published = mp.parse_list(tex)
    except ValueError as error:
        if "single answer" not in str(error):
            raise
        published = [mp.parse_answer(tex)]
    if len(published) != len(truths):
        raise AssertionError(f"{tex!r} gives {len(published)} value(s), {len(truths)} expected")
    remaining = list(published)
    for value in truths:
        match = next((i for i, got in enumerate(remaining) if _same(got, value)), None)
        if match is None:
            raise AssertionError(f"{value} is missing from {tex!r} (published {published})")
        remaining.pop(match)


def k_assignments(tex, truth, opts):
    if isinstance(truth, dict):
        expected = {str(key): value for key, value in truth.items()}
    else:
        pairs = _items(truth) if not isinstance(truth, Eq) else [truth]
        if not all(isinstance(pair, Eq) and isinstance(pair.lhs, Symbol) for pair in pairs):
            raise ValueError("assignments truth must be a dict {\"x\": 2} or a list of Eq(x, 2)")
        expected = {pair.lhs.name: pair.rhs for pair in pairs}
    published = mp.parse_assignments(tex)
    if set(published) != set(expected):
        raise AssertionError(f"published names {sorted(published)} are not {sorted(expected)}")
    for name, value in expected.items():
        if not _same(published[name], value):
            raise AssertionError(f"published {name} = {published[name]} is not {value}")


def _coordinates(tex):
    rhs, relation = _rhs(tex)
    if not (rhs.startswith("(") and rhs.endswith(")")):
        raise ValueError(f"no coordinates at the end of {tex!r}")
    inner = rhs[1:-1]
    return [piece.strip() for piece in mp._split(inner, mp._top_level_cuts(inner, r","))], relation


def k_point(tex, truth, opts):
    truths = _items(truth)
    pieces, relation = _coordinates(tex)
    if len(pieces) != len(truths):
        raise AssertionError(f"{tex!r} has {len(pieces)} coordinate(s), {len(truths)} expected")
    for piece, value in zip(pieces, truths):
        if "sf" in opts or "dp" in opts:
            mp.check_rounded(f"{relation} {piece}", _number(value, "point"), sf=opts.get("sf"), dp=opts.get("dp"))
        elif not _same(mp._parse(piece, tex), value):
            raise AssertionError(f"coordinate {piece} is not {value}")


def k_vector(tex, truth, opts):
    truths = _items(truth)
    published = mp.parse_vector(tex)
    if len(published) != len(truths):
        raise AssertionError(f"{tex!r} has {len(published)} component(s), {len(truths)} expected")
    for got, value in zip(published, truths):
        if not _same(got, value):
            raise AssertionError(f"component {got} is not {value}")


def k_equation(tex, truth, opts):
    target = truth.lhs - truth.rhs if isinstance(truth, Eq) else S(truth)
    if not _plain(target).free_symbols or simplify(target) == 0:
        raise ValueError(f"equation truth {truth} must involve a variable")
    published = _plain(mp.parse_equation(tex))
    ratio = simplify(published / _plain(target))
    if ratio.free_symbols or ratio == 0 or not ratio.is_finite:
        raise AssertionError(f"published equation {published} = 0 is not {target} = 0 up to a non-zero constant factor")


def _as_set(truth, var):
    if isinstance(truth, Set):
        return truth
    if isinstance(truth, (Relational, And, Or)):
        symbols = truth.free_symbols
        if len(symbols) != 1:
            raise ValueError(f"inequality truth {truth} must use one variable")
        return truth.as_set()
    if isinstance(truth, (list, tuple, Tuple)):
        return FiniteSet(*truth)
    raise ValueError(f"set truth must be a set, an interval or an inequality, got {truth}")


_EMPTY = re.compile(r"^\s*(?:\\varnothing|\\emptyset|\\\{\s*\\\}|\{\s*\})\s*$")


def _finite_set(tex):
    cleaned = mp._strip_decorations(tex).strip()
    cleaned = re.sub(r"^\s*[A-Za-z]\s*(?:=|\\in)\s*", "", cleaned)
    if _EMPTY.match(cleaned):
        return []
    cleaned = re.sub(r"^\\\{\s*|\s*\\\}$", "", cleaned)
    pieces = mp._split(cleaned, mp._top_level_cuts(cleaned, mp._SEPARATORS))
    return [mp._parse(re.sub(r"^\s*[A-Za-z]\s*=", "", piece).strip(), tex) for piece in pieces if piece.strip()]


def k_set(tex, truth, opts):
    var = opts.get("var", "x")
    target = _as_set(truth, var)
    looks_empty = bool(_EMPTY.match(re.sub(r"^\s*[A-Za-z]\s*(?:=|\\in)\s*", "", mp._strip_decorations(tex).strip())))
    if target == S.EmptySet:
        if not looks_empty:
            raise AssertionError(f"{tex!r} is not the empty set")
        return
    if isinstance(target, FiniteSet):
        published = _finite_set(tex)
        if len({sympy.srepr(simplify(value)) for value in published}) != len(published):
            raise AssertionError(f"{tex!r} lists a value twice")
        if FiniteSet(*published) != target:
            raise AssertionError(f"published set {FiniteSet(*published)} is not {target}")
        return
    if looks_empty:
        raise AssertionError(f"published the empty set, but the solution set is {target}")
    mp.check_same_set(tex, target, var)


def k_ratio(tex, truth, opts):
    truths = [_number(value, "ratio") for value in _items(truth)]
    if len(truths) < 2 or any(value <= 0 for value in truths):
        raise ValueError("ratio truth needs two or more positive parts")
    rhs, _ = _rhs(tex)
    rhs = re.sub(r"\\(?:colon|mathbin\{:\}|mathrel\{:\})", ":", rhs)
    parts = [part.strip() for part in rhs.split(":")]
    if len(parts) < 2:
        raise ValueError(f"no ratio a : b in {tex!r}")
    if len(parts) != len(truths):
        raise AssertionError(f"{tex!r} has {len(parts)} parts, {len(truths)} expected")
    if not all(re.fullmatch(r"\d+", part) for part in parts):
        raise AssertionError(f"{tex!r}: each part of a ratio in its simplest form is a whole number")
    numbers = [int(part) for part in parts]
    if 0 in numbers:
        raise AssertionError(f"{tex!r} has a zero part")
    common = 0
    for number in numbers:
        common = gcd(common, number)
    if common != 1:
        raise AssertionError(f"{tex!r} is not in its simplest form (every part divides by {common})")
    if any(numbers[i] * truths[0] != numbers[0] * truths[i] for i in range(len(truths))):
        raise AssertionError(f"{tex!r} is not the ratio {' : '.join(str(t) for t in truths)}")


_STANDARD = re.compile(r"(-?)\s*(\d+(?:\.\d+)?)\s*(?:\\times|\\cdot)\s*10\s*\^\s*\{?\s*(-?\d+)\s*\}?")


def k_standard_form(tex, truth, opts):
    value = _number(truth, "standard-form")
    text = mp.parse_with_unit(tex, opts["unit"]) if "unit" in opts else tex
    rhs, relation = _rhs(text)
    rhs = re.sub(r"\\(?:text|mathrm)\{\s*\([^}]*\)\s*\}", " ", rhs).strip()
    match = _STANDARD.fullmatch(rhs)
    if not match:
        if re.search(r"\d", rhs):
            raise AssertionError(f"{tex!r} is not written as a \\times 10^{{k}}")
        raise ValueError(f"no number in {tex!r}")
    mantissa = match.group(2)
    if not re.fullmatch(r"[1-9](?:\.\d+)?", mantissa):
        raise AssertionError(f"{tex!r} is not standard form: a must satisfy 1 <= a < 10 (got {mantissa})")
    published = Decimal(f"{match.group(1)}{mantissa}").scaleb(int(match.group(3)))
    if "sf" in opts:
        figures = len(mantissa.replace(".", ""))
        if figures != opts["sf"]:
            raise AssertionError(f"{tex!r} shows {figures} significant figures, {opts['sf']} required")
        if relation == "=" and nsimplify(str(published), rational=True) != value:
            raise AssertionError(f"{tex!r} uses = but is not exactly {value}; write \\approx")
        if published != mp.round_half_up(value, sf=opts["sf"]):
            raise AssertionError(f"published {published} is not {value} rounded ({mp.round_half_up(value, sf=opts['sf'])})")
        return
    if nsimplify(str(published), rational=True) != value:
        raise AssertionError(f"{tex!r} is {published}, not {value}" + ("" if relation == "=" else "; declare sf for a rounded value"))


_CURRENCY = re.compile(r"\\\$|\\text\{\s*\\\$\s*\}|\\textdollar|\\pounds|\\euro|\\texteuro|£|€|¥|\\yen")


def k_money(tex, truth, opts):
    value = _number(truth, "money")
    dp = opts.get("dp", 2)
    text = _CURRENCY.sub(" ", tex)
    text = re.sub(r"\\(?:text|mathrm)\{\s*[A-Za-z. ]*\s*\}", " ", text)  # \text{ dollars}, \text{USD}
    rhs, _ = _rhs(text)
    rhs = re.sub(r"\{,\}|(?<=\d),(?=\d{3}\b)", "", rhs)
    rhs = re.sub(r"\b(?:dollars?|cents?|USD|euros?|pounds?|rupees?|rand|yen|pesos?)\b", " ", rhs).strip()
    match = re.fullmatch(r"(-?)\s*(\d+)(?:\.(\d+))?", rhs)
    if not match:
        if re.search(r"\d", rhs):
            raise AssertionError(f"{tex!r} is not an amount of money such as $12.50 (read {rhs!r})")
        raise ValueError(f"no amount in {tex!r}")
    places = len(match.group(3) or "")
    if places != dp:
        raise AssertionError(f"{tex!r} shows {places} decimal places; money is written to {dp}")
    published = Decimal(f"{match.group(1)}{match.group(2)}{'.' + match.group(3) if match.group(3) else ''}")
    expected = mp.round_half_up(value, dp=dp)
    if published != expected:
        raise AssertionError(f"published {published} is not {expected}")


def _plain_text(tex):
    text = tex.replace("$", " ")
    text = re.sub(r"\\(?:text|mathrm|textrm)\{([^{}]*)\}", r" \1 ", text)
    text = re.sub(r"\\[,;:! ]|\\quad|\\qquad", " ", text)
    text = text.replace("{", " ").replace("}", " ")
    return re.sub(r"\s+", " ", text).strip()


def k_time(tex, truth, opts):
    minutes = _number(truth, "time")
    if not minutes.is_integer:
        raise ValueError(f"time truth must be a whole number of minutes, got {truth}")
    minutes = int(minutes)
    text = _plain_text(tex)
    rhs = re.split(r"=|\\approx", text)[-1].strip().lower()
    if not re.search(r"\d", rhs):
        raise ValueError(f"no time in {tex!r}")
    if opts["form"] == "clock":
        if re.search(r"\b(?:a\.?m\.?|p\.?m\.?)\b", rhs):
            raise AssertionError(f"{tex!r} uses the 12-hour clock; write a 24-hour time such as 14:35")
        match = re.fullmatch(r"(\d{2})\s*(?::|\\colon)?\s*(\d{2})", rhs)
        if not match:
            raise AssertionError(f"{tex!r} is not a 24-hour time hh:mm such as 09:05 or 14:35")
        hours, mins = int(match.group(1)), int(match.group(2))
        if hours > 23 or mins > 59:
            raise AssertionError(f"{tex!r} is not a real time of day")
        if hours * 60 + mins != minutes % 1440:
            raise AssertionError(f"{tex!r} is not {minutes % 1440 // 60:02d}:{minutes % 60:02d}")
        return
    match = re.fullmatch(r"(?:(\d+)\s*(?:h|hr|hrs|hours?))?\s*(?:(\d+)\s*(?:min|mins|minutes?))?", rhs)
    if not match or not (match.group(1) or match.group(2)):
        raise AssertionError(f"{tex!r} is not a duration in hours and minutes, such as 2 h 35 min")
    hours, mins = int(match.group(1) or 0), int(match.group(2) or 0)
    if match.group(1) and mins > 59:
        raise AssertionError(f"{tex!r}: minutes must be under 60 once hours are written")
    if hours * 60 + mins != minutes:
        raise AssertionError(f"{tex!r} is {hours * 60 + mins} minutes, not {minutes}")


_DEGREE = re.compile(r"\^\s*\{?\s*\\circ\s*\}?|\\degree|°")


def k_bearing(tex, truth, opts):
    value = _number(truth, "bearing") % 360
    rhs, relation = _rhs(_DEGREE.sub(" ", tex))
    match = re.fullmatch(r"(\d+)(?:\.(\d+))?", rhs)
    if not match:
        raise ValueError(f"no bearing in {tex!r}")
    if len(match.group(1)) != 3:
        raise AssertionError(f"{tex!r}: a bearing is written with three figures, such as 045°")
    places = len(match.group(2) or "")
    dp = opts.get("dp")
    if dp is None:
        if not value.is_integer:
            raise ValueError(f"bearing {value} is not a whole number of degrees; declare dp")
        if places or int(match.group(1)) != int(value):
            raise AssertionError(f"{tex!r} is not {int(value):03d}°")
        return
    if places != dp:
        raise AssertionError(f"{tex!r} shows {places} decimal places, {dp} required")
    published = Decimal(rhs)
    if relation == "=" and nsimplify(rhs, rational=True) != value:
        raise AssertionError(f"{tex!r} uses = for a rounded bearing; write \\approx")
    if published != mp.round_half_up(value, dp=dp):
        raise AssertionError(f"published {published} is not {mp.round_half_up(value, dp=dp)}")


def k_angle(tex, truth, opts):
    value = _number(truth, "angle")
    if not _DEGREE.search(tex):
        raise AssertionError(f"{tex!r}: write the angle in degrees with °")
    stripped = mp.parse_with_unit(tex, "°")
    published, _, places, relation = mp.parse_approx(stripped)
    if relation == "=":
        if nsimplify(str(published), rational=True) != value:
            raise AssertionError(f"{tex!r} uses = but {published}° is not exactly {value}°; write \\approx to {opts.get('dp', 1)} d.p.")
        return
    if value.is_integer:
        raise AssertionError(f"{tex!r}: the angle is exactly {value}°, so write = {value}°")
    mp.check_rounded(stripped, value, sf=opts.get("sf"), dp=opts.get("dp", 1 if "sf" not in opts else None))


_FRAC = r"\\frac\{\s*(-?\d+)\s*\}\{\s*(\d+)\s*\}"


def k_fraction(tex, truth, opts):
    value = _number(truth, "fraction")
    if not value.is_rational:
        raise ValueError(f"fraction truth {truth} is not a rational number")
    simplest = opts.get("simplest", True)
    rhs, _ = _rhs(tex)
    rhs = re.sub(r"\s+", " ", rhs)
    whole, written = None, "fraction"
    if match := re.fullmatch(rf"(-)?\s*(\d+)\s*{_FRAC}", rhs):
        sign, whole, top, bottom = match.group(1), int(match.group(2)), int(match.group(3)), int(match.group(4))
    elif match := re.fullmatch(rf"(-)?\s*{_FRAC}", rhs):
        sign, top, bottom = match.group(1), int(match.group(2)), int(match.group(3))
    elif match := re.fullmatch(r"(-)?\s*(\d+)\s*/\s*(\d+)", rhs):
        sign, top, bottom = match.group(1), int(match.group(2)), int(match.group(3))
    elif match := re.fullmatch(r"(-?)\s*(\d+)", rhs):
        sign, top, bottom, written = match.group(1), int(match.group(2)), 1, "whole"
    elif re.fullmatch(r"-?\s*\d*\.\d+", rhs):
        raise AssertionError(f"{tex!r} is a decimal; give the answer as a fraction")
    else:
        raise ValueError(f"no fraction at the end of {tex!r} (read {rhs!r})")
    if bottom == 0:
        raise AssertionError(f"{tex!r} divides by zero")
    if whole is not None and top < 0:
        raise AssertionError(f"{tex!r}: a mixed number has a positive fraction part")
    published = (-1 if sign else 1) * (Rational(whole or 0) + Rational(top, bottom))
    if published != value:
        raise AssertionError(f"{tex!r} is {published}, not {value}")
    if simplest:
        if gcd(abs(top), bottom) != 1:
            raise AssertionError(f"{tex!r} is not in its simplest form")
        if bottom == 1 and written != "whole":
            raise AssertionError(f"{tex!r}: write the whole number {value} without a fraction")
        if whole is not None and abs(top) >= bottom:
            raise AssertionError(f"{tex!r}: the fraction part of a mixed number is less than 1")
    form = opts.get("form")
    if form == "mixed" and abs(value) > 1 and not value.is_integer and whole is None:
        raise AssertionError(f"{tex!r}: give a mixed number")
    if form == "improper" and whole is not None:
        raise AssertionError(f"{tex!r}: give an improper fraction, not a mixed number")


def _factorised_errors(written):
    """Why an unevaluated product is not fully factorised over the integers (empty when it is)."""
    factors = []
    for piece in _flat(written, Mul):
        if isinstance(piece, Pow) and piece.exp.is_Integer and piece.exp > 0:
            factors += [piece.base] * int(piece.exp)
        else:
            factors.append(piece)
    variable = [piece for piece in factors if piece.doit().free_symbols]
    if not variable:
        return ["it has no factor with a variable"]
    if len(variable) == 1 and len(factors) == 1 and isinstance(written, Add):
        return ["it is a sum, not a product"]
    errors = []
    for piece in variable:
        value = expand(piece.doit())
        symbols = sorted(value.free_symbols, key=lambda s: s.name)
        try:
            poly = Poly(value, *symbols)
        except sympy.PolynomialError:
            continue
        content, _ = poly.primitive()
        if abs(content) != 1:
            errors.append(f"{piece.doit()} still has a common factor {content}")
        _, parts = factor_list(value)
        if len(parts) > 1 or (parts and parts[0][1] > 1):
            errors.append(f"{piece.doit()} factorises further")
    return errors


def k_expression(tex, truth, opts):
    target = _plain(S(truth))
    published = _plain(mp.parse_answer(tex))
    if opts.get("scale"):
        if not target.free_symbols:
            raise ValueError("expression with scale needs a truth that involves a variable")
        ratio = simplify(published / target)
        if ratio.free_symbols or ratio == 0 or not ratio.is_finite:
            raise AssertionError(f"published {published} is not a non-zero constant multiple of {target}")
    elif not _same(published, target):
        raise AssertionError(f"published {published} is not equivalent to {target}")
    form = opts.get("form")
    if not form:
        return
    written = _unevaluated(tex)
    if form == "factorised":
        errors = _factorised_errors(written)
        if errors:
            raise AssertionError(f"{tex!r} is not fully factorised: {'; '.join(errors)}")
        return
    terms = _flat(written, Add)
    if form == "expanded":
        for term in terms:
            value = term.doit()
            if isinstance(value, Add) or expand(value) != value:
                raise AssertionError(f"{tex!r} still has brackets to expand ({value})")
        if len(terms) != len(Add.make_args(expand(target))):
            raise AssertionError(f"{tex!r} has {len(terms)} terms; collect like terms ({len(Add.make_args(expand(target)))} expected)")
        return
    # simplified: like terms collected, no number fraction left unreduced, no common factor top and bottom.
    if len(terms) != len(Add.make_args(written.doit())):
        raise AssertionError(f"{tex!r} has like terms to collect")
    reducible = _reduced_fraction_errors(written)
    if reducible:
        raise AssertionError(f"{tex!r} has an unsimplified fraction {reducible[0]}")
    top, bottom = fraction(together(published))
    if bottom.free_symbols and poly_gcd(top, bottom).free_symbols:
        raise AssertionError(f"{tex!r}: top and bottom share the factor {poly_gcd(top, bottom)}")


def k_antiderivative(tex, truth, opts):
    integrand = S(truth)
    if simplify(integrand) == 0:
        raise ValueError("antiderivative truth (the integrand) must not be 0")
    mp.check_antiderivative(tex, integrand, var=opts.get("var", "x"))


def k_choice(text, truth, opts):
    normal = lambda value: re.sub(r"\s+", " ", str(value)).strip()  # noqa: E731
    if normal(text) != normal(truth):
        raise AssertionError(f"{text!r} is not the correct option {truth!r}")


CHECKERS = {
    "exact": k_exact, "rounded": k_rounded, "list": k_list, "assignments": k_assignments, "point": k_point, "vector": k_vector,
    "equation": k_equation, "inequality": k_set, "set": k_set, "ratio": k_ratio, "standard-form": k_standard_form, "money": k_money,
    "time": k_time, "bearing": k_bearing, "angle": k_angle, "fraction": k_fraction, "expression": k_expression,
    "antiderivative": k_antiderivative, "choice": k_choice,
}


def check(verify: dict, published, tolerance=None):
    """Raise AssertionError if `published` (an answer's TeX, an option's text, or a numeric check's value) is wrong."""
    check_spec(verify)
    kind = verify["kind"]
    opts = {key: value for key, value in verify.items() if key not in ("kind", "truth")}
    if kind == "choice":
        return k_choice(published, verify["truth"], opts)
    truth = evaluate_truth(verify["truth"])
    if kind == "numeric":
        if isinstance(published, str):
            raise ValueError("numeric verify is for a numeric check's value, not text")
        return k_numeric(published, truth, opts, tolerance)
    if not isinstance(published, str):
        raise ValueError(f"{kind} checks published text, got {published!r}")
    return CHECKERS[kind](published, truth, opts)


if __name__ == "__main__":
    if sys.argv[1:] == ["--spec"]:
        print(json.dumps({"kinds": KINDS, "enums": ENUMS, "booleans": sorted(BOOLEANS)}, sort_keys=True))
    else:
        print("Usage: verify_kinds.py --spec", file=sys.stderr)
        sys.exit(2)
