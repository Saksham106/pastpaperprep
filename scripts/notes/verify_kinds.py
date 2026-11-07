"""Declarative answer checks: an example or check block carries `verify: { kind, truth, ...opts }` instead of a sidecar.

`truth` is a SymPy expression built from the question's own data ("sqrt(5**2 + 12**2)", "Rational(3, 8) * Rational(2, 7)").
evaluate_truth() reads it in a restricted namespace: SymPy names only, no imports, no lambdas or comprehensions, no names
or attributes starting with "_", string constants only as identifier keys of a dict. Whole numbers become Integer and
decimals exact Rationals, so 1/3 is a third and 12.5 is exactly 25/2. Unknown names become symbols (x, y, n).

check(verify, published, tolerance=None) raises AssertionError when the published answer is wrong (including a wrong
form: an unsimplified ratio, 24 x 10^2, 4 s.f. where 3 are required) and ValueError when the text or the verify spec
cannot be read. Both FAIL the gate; a multiple-choice distractor must raise AssertionError (it is wrong, not unreadable).

Each kind is one function below; KINDS lists them with their options (validate.ts keeps the same table, and
mathparse.test.ts compares the two).

Chemistry (IB Chemistry lessons): the data booklet helpers of chem_data.py are available in every truth (Ar("Cl"),
Mr("CuSO4·5H2O"), BE("C=O"), Hf("CH4(g)"), Gf(...), S("CH4(g)"), Hc(...), lattice("NaCl"), E0("Cu2+/Cu"),
pKa_ind("methyl orange"), IE1, EA, EA2, EN, empirical_formula, molecular_formula, ionic_formula, formula). Text is
allowed only as the argument of these helpers. S(...) with text is the booklet entropy; with a number it is SymPy's S.
The booklet constants R, NA, F, Kw, c_water, Vm, T_STP, T_SATP, P_std, h_planck, c_light and e_charge are names only in a
chemistry course (check(..., chemistry=True); check-math.py turns it on for course.json gate.chemistry or an
"ib-chemistry" edition), so a maths truth keeps R or F as an ordinary symbol. Number kinds accept a trailing unit
(\\text{}, \\pu{}, `kJ mol⁻¹`), and `unit` / `signed` check it and the sign. chem-equation, formula and explanation
are the chemistry kinds (see their docstrings). Property-style kinds reject degenerate answers by construction: an equation
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
import chem_data  # noqa: E402
import chemparse as cp  # noqa: E402
import mathparse as mp  # noqa: E402

parse_latex("x")  # load the parser now: importing it under evaluate(False) breaks sympy.physics

# ------------------------------------------------------------------------------------------------------------ the spec

PRECISION = ("sf", "dp")
#: kind -> {"required": options that must be present, "oneOf": exactly one of these, "optional": other allowed options,
#:          "on": which blocks may use it ("example", "choice" = multiple-choice check, "numeric" = numeric check)}
KINDS = {
    "exact": {"optional": ["unit", "signed"], "on": ["example", "choice"]},
    "rounded": {"oneOf": list(PRECISION), "optional": ["unit", "signed"], "on": ["example", "choice"]},
    "numeric": {"oneOf": list(PRECISION), "optional": ["reading", "maxTolerance", "signed"], "on": ["numeric"]},
    "list": {"optional": list(PRECISION), "on": ["example", "choice"]},
    "assignments": {"on": ["example", "choice"]},
    "solutions": {"optional": list(PRECISION), "on": ["example", "choice"]},
    "point": {"optional": list(PRECISION), "on": ["example", "choice"]},
    "vector": {"on": ["example", "choice"]},
    "equation": {"on": ["example", "choice"]},
    "inequality": {"optional": ["var"], "on": ["example", "choice"]},
    "set": {"optional": ["var"], "on": ["example", "choice"]},
    "ratio": {"on": ["example", "choice"]},
    "standard-form": {"optional": ["sf", "unit", "signed"], "on": ["example", "choice"]},
    "money": {"optional": ["dp"], "on": ["example", "choice"]},
    "time": {"required": ["form"], "on": ["example", "choice"]},
    "bearing": {"optional": ["dp"], "on": ["example", "choice"]},
    "angle": {"optional": list(PRECISION), "on": ["example", "choice"]},
    "fraction": {"optional": ["simplest", "form"], "on": ["example", "choice"]},
    "expression": {"optional": ["form", "scale"], "on": ["example", "choice"]},
    "antiderivative": {"optional": ["var"], "on": ["example", "choice"]},
    "choice": {"on": ["choice"]},
    "chem-equation": {"optional": ["states", "reversible", "allowMultiple", "fractions", "per", "aliases"], "on": ["example", "choice"]},
    "formula": {"optional": ["match", "given"], "on": ["example", "choice"]},
    "explanation": {"required": ["requires"], "optional": ["forbids"], "on": ["example"]},
}
ENUMS = {
    "time.form": ["clock", "duration"], "fraction.form": ["mixed", "improper"], "expression.form": ["factorised", "expanded", "simplified"],
    "formula.match": ["composition", "exact"],
}
BOOLEANS = {
    "fraction.simplest", "expression.scale", "exact.signed", "rounded.signed", "numeric.signed", "standard-form.signed",
    "chem-equation.states", "chem-equation.reversible", "chem-equation.allowMultiple", "chem-equation.fractions", "formula.given",
}
#: Options that are lists of phrases. An entry of `requires` may itself be a list of alternatives.
ARRAYS = {"explanation.requires", "explanation.forbids"}
#: Kinds whose truth is text, not a SymPy computation: the literal-truth rule does not apply.
TEXT_TRUTH = {"choice", "explanation", "chem-equation"}


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
        if key in ("unit", "var", "per") and not (isinstance(value, str) and value.strip()):
            raise ValueError(f"{name} must be a non-empty string")
        if name in ARRAYS:
            _check_phrases(name, value)
    if kind == "numeric" and ("reading" in options or "maxTolerance" in options):
        if options.get("reading") is not True:
            raise ValueError("numeric.reading must be true (and is only for estimates read from a graph)")
        cap = options.get("maxTolerance")
        if not (isinstance(cap, (int, float)) and not isinstance(cap, bool) and cap > 0):
            raise ValueError("numeric.reading needs maxTolerance, a positive number")
    if kind == "money" and options.get("dp", 2) not in (0, 2):
        raise ValueError("money.dp must be 2 (or 0 for whole amounts)")
    if kind == "chem-equation":
        if options.get("allowMultiple") and options.get("fractions"):
            raise ValueError("chem-equation: give allowMultiple or fractions, not both")
        if "per" in options and not options.get("fractions"):
            raise ValueError("chem-equation.per names the species with coefficient 1, so it needs fractions: true")
    if kind == "explanation" and len(options.get("requires", [])) < 2:
        raise ValueError("explanation.requires needs at least 2 phrases (the marking points)")
    if kind == "formula":
        _check_formula_truth(truth, options)
    elif kind not in TEXT_TRUTH:
        require_computed(truth)


def _check_phrases(name, value):
    """`requires`: non-empty phrases, each a string or a non-empty list of alternative strings. `forbids`: strings."""
    if not isinstance(value, list) or not value:
        raise ValueError(f"{name} must be a non-empty list of phrases")
    for entry in value:
        alternatives = entry if isinstance(entry, list) and name.endswith("requires") else [entry]
        if not alternatives or not all(isinstance(text, str) and _normal_prose(text) for text in alternatives):
            raise ValueError(f"{name}: every entry must be a non-empty phrase" + (" or a list of alternative phrases" if name.endswith("requires") else ""))


def _check_formula_truth(truth, options):
    """A formula truth calls a formula helper. formula("...") (a formula typed in) is only for a formula the question
    itself states, and must say so with given: true."""
    try:
        tree = ast.parse(str(truth).strip(), mode="eval").body
    except SyntaxError:
        return  # evaluate_truth reports unreadable text
    name = tree.func.id if isinstance(tree, ast.Call) and isinstance(tree.func, ast.Name) else None
    if name not in chem_data.FORMULA_HELPERS:
        raise ValueError(f"formula truth {truth!r} must call {', '.join(sorted(chem_data.FORMULA_HELPERS))}")
    if name == "formula" and options.get("given") is not True:
        raise ValueError("formula(\"...\") types the formula in; use it only for a formula stated in the question, with given: true")
    if name != "formula" and "given" in options:
        raise ValueError("formula.given is only for a formula(\"...\") truth stated in the question")


# ---------------------------------------------------------------------------------------------------------- the truth

def _is_literal(node) -> bool:
    """True for an answer typed in: a bare number, name or string, a signed one, a relational between literals, or a
    list / tuple / dict of literals. An arithmetic operation or a function call is a computation."""
    if isinstance(node, (ast.Constant, ast.Name)):
        return True
    if isinstance(node, ast.Attribute):
        return _is_literal(node.value)
    if isinstance(node, ast.UnaryOp):
        return _is_literal(node.operand)
    if isinstance(node, (ast.Tuple, ast.List)):
        return all(_is_literal(item) for item in node.elts)
    if isinstance(node, ast.Dict):
        return all(item is not None and _is_literal(item) for item in [*node.keys, *node.values])
    if isinstance(node, ast.Compare):
        return all(_is_literal(item) for item in [node.left, *node.comparators])
    return False


def require_computed(source: str):
    """ValueError when a truth is only a literal (the answer typed in), not computed from the question's data."""
    try:
        tree = ast.parse(str(source).strip(), mode="eval")
    except SyntaxError:
        return  # evaluate_truth reports unreadable text
    if _is_literal(tree.body):
        raise ValueError(f"truth {source!r} is a literal: truth must be computed from the question's data (e.g. `sqrt(7**2+24**2)`), not the answer typed in")


_DENIED = {
    "lambdify", "preview", "var", "init_printing", "init_session", "sympify", "parse_expr", "plot", "plot_implicit", "plot_parametric",
    "pprint", "pprint_use_unicode", "print_python", "print_tree", "print_latex", "print_mathml", "print_rcode", "print_fcode",
    "print_ccode", "print_gtk", "python", "test", "doctest", "source", "srepr", "interactive_traversal", "rational_interpolate",
}
NAMESPACE = {name: getattr(sympy, name) for name in sympy.__all__ if name not in _DENIED and not name.startswith("_")}


class _EntropyOrS:
    """S("CH4(g)") is the booklet standard entropy; S(1)/3, S.Reals are SymPy's S. Text never reaches sympify."""

    def __call__(self, value, *args, **kwargs):
        if isinstance(value, str):
            return chem_data.S_std(value)
        return sympy.S(value, *args, **kwargs)

    def __getattr__(self, name):
        return getattr(sympy.S, name)


_CHEM_FUNCTIONS = {name: value for name, value in chem_data.namespace().items() if callable(value)}
_CHEM_CONSTANTS = {name: value for name, value in chem_data.namespace().items() if not callable(value)}
NAMESPACE.update(_CHEM_FUNCTIONS)
NAMESPACE["S"] = _EntropyOrS()


def _namespace(chemistry=False):
    return {**NAMESPACE, **_CHEM_CONSTANTS} if chemistry else NAMESPACE

_ALLOWED_NODES = (
    ast.Expression, ast.BinOp, ast.UnaryOp, ast.Call, ast.Name, ast.Load, ast.Constant, ast.Tuple, ast.List, ast.Dict,
    ast.keyword, ast.Attribute, ast.Subscript, ast.Compare, ast.Slice,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod, ast.FloorDiv, ast.USub, ast.UAdd,
    ast.Lt, ast.LtE, ast.Gt, ast.GtE,
)
_IDENTIFIER = re.compile(r"[A-Za-z][A-Za-z0-9]*\Z")


class _Exact(ast.NodeTransformer):
    """Whole numbers -> Integer(n), decimals -> Rational("12.5"), unknown names -> Symbol("x")."""

    def __init__(self, namespace=None):
        self.namespace = NAMESPACE if namespace is None else namespace

    def visit_Constant(self, node):
        if isinstance(node.value, bool) or node.value is None:
            raise ValueError("truth may not use True, False or None")
        if isinstance(node.value, int):
            return ast.copy_location(ast.Call(ast.Name("Integer", ast.Load()), [ast.Constant(node.value)], []), node)
        if isinstance(node.value, float):
            return ast.copy_location(ast.Call(ast.Name("Rational", ast.Load()), [ast.Constant(repr(node.value))], []), node)
        return node

    def visit_keyword(self, node):
        if isinstance(node.value, ast.Constant) and isinstance(node.value.value, bool):
            return node  # solve(..., dict=True): a flag for SymPy, not part of the truth
        return self.generic_visit(node)

    def visit_Name(self, node):
        if node.id in self.namespace:
            return node
        return ast.copy_location(ast.Call(ast.Name("Symbol", ast.Load()), [ast.Constant(node.id)], []), node)


def evaluate_truth(source: str, chemistry=False):
    """The SymPy value of a verify.truth string, evaluated with SymPy names (and the chemistry helpers) only (see the module
    docstring). chemistry=True adds the data booklet constants R, NA, F, Kw, c_water, Vm, ..."""
    namespace = _namespace(chemistry)
    if not isinstance(source, str) or not source.strip():
        raise ValueError("truth is empty")
    try:
        tree = ast.parse(source.strip(), mode="eval")
    except SyntaxError as error:
        raise ValueError(f"truth {source!r} is not an expression: {error.msg}") from error
    for node in ast.walk(tree):
        if not isinstance(node, _ALLOWED_NODES):
            raise ValueError(f"truth {source!r} uses {type(node).__name__}, which is not allowed")
        if isinstance(node, ast.Name) and not _IDENTIFIER.match(node.id) and node.id not in namespace:
            raise ValueError(f"truth {source!r} uses the name {node.id!r}")
        if isinstance(node, ast.Name) and node.id.startswith("_"):
            raise ValueError(f"truth {source!r} uses the name {node.id!r}")
        if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
            raise ValueError(f"truth {source!r} uses the attribute {node.attr!r}")
        if isinstance(node, ast.Call) and not isinstance(node.func, (ast.Name, ast.Attribute)):
            raise ValueError(f"truth {source!r} calls something that is not a SymPy name")
    # String constants only as identifier keys of a dict ({"x": 2, "y": -1}) or as the argument of a data booklet helper
    # (Mr("H2SO4")), never as an argument SymPy could parse.
    keys = {id(key) for node in ast.walk(tree) if isinstance(node, ast.Dict) for key in node.keys}
    helper_args = {id(arg) for node in ast.walk(tree) if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                   and node.func.id in chem_data.TEXT_HELPERS for arg in node.args}
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str) and not (id(node) in keys and _IDENTIFIER.match(node.value)) and id(node) not in helper_args:
            raise ValueError(f"truth {source!r}: text is allowed only as a variable name key, as in {{\"x\": 2}}, or as a data booklet helper's argument, as in Mr(\"H2O\")")
    tree = ast.fix_missing_locations(_Exact(namespace).visit(tree))
    try:
        return eval(compile(tree, "<truth>", "eval"), {"__builtins__": {}}, dict(namespace))  # noqa: S307 - restricted above
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

def _without_unit(tex, opts, plain):
    """The published TeX without its trailing unit. With `unit`, the unit must be there and match (else the answer is
    wrong); without it, a trailing unit is allowed and ignored (plain=False: only a \\text / \\mathrm / \\pu / % unit, so a
    letter in an expression is never taken for a unit)."""
    if "unit" in opts:
        stripped, published = mp.split_unit(tex, plain=True)
        if published is None:
            raise AssertionError(f"{tex!r} has no unit; expected {opts['unit']!r}")
        if published != mp._normal_unit(opts["unit"]):
            raise AssertionError(f"{tex!r} has unit {published!r}, expected {mp._normal_unit(opts['unit'])!r}")
        return stripped
    return mp.split_unit(tex, plain=plain)[0]


def _check_signed(text, truth, tex):
    """signed: true: a positive answer carries an explicit + (oxidation states, ΔH, E⦵), as in +3 or +52 kJ mol-1."""
    value = _number(truth, "signed")
    rhs, _ = _rhs(text)
    if value > 0 and not rhs.lstrip().startswith("+"):
        raise AssertionError(f"{tex!r}: the sign is part of the answer here; write it with +")


def k_exact(tex, truth, opts):
    """An exact value. `unit`: the published unit must match it (\\text{kJ mol}^{-1}, \\pu{-890 kJ mol-1}, kJ mol⁻¹ are
    all "kJ mol-1"); without `unit` a \\text / \\pu unit after the value is ignored. `signed: true`: a positive value is
    written with + (oxidation state +3)."""
    text = _without_unit(tex, opts, plain=False)
    if opts.get("signed"):
        _check_signed(text, truth, tex)
    published = mp.parse_answer(text)
    if not _same(published, truth):
        raise AssertionError(f"published {published} is not {truth}")


def k_rounded(tex, truth, opts):
    """A rounded value to exactly `sf` figures or `dp` places, written with \\approx. A trailing unit is allowed (`unit`
    checks it, as for exact); `signed: true` requires the + of a positive value (ΔH = +52 kJ mol-1)."""
    text = _without_unit(tex, opts, plain=True)
    if opts.get("signed"):
        _check_signed(text, truth, tex)
    mp.check_rounded(text, _number(truth, "rounded"), sf=opts.get("sf"), dp=opts.get("dp"))


def k_numeric(value, truth, opts, tolerance=None):
    """A numeric check's value. A JSON number has no + sign, so `signed: true` only requires the value's sign to be the
    truth's (no rounding to 0); the check's prompt should ask for the sign."""
    if opts.get("signed") and _number(truth, "numeric") != 0 and (float(value) > 0) != (_number(truth, "numeric") > 0):
        raise AssertionError(f"published {value} has the wrong sign")
    if opts.get("reading"):
        # A value read off a graph: the truth must sit inside the declared band, and the band within the declared cap.
        tolerance = 0 if tolerance is None else float(tolerance)
        if tolerance > float(opts["maxTolerance"]):
            raise AssertionError(f"tolerance {tolerance} is looser than the declared maxTolerance {opts['maxTolerance']}")
        if abs(float(value) - float(sympy.N(_number(truth, "numeric"), 12))) > tolerance + 1e-9:
            raise AssertionError(f"published {value} +/- {tolerance} does not contain {sympy.N(truth, 12)}")
        return
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


_SOLUTION_BREAK = r"\\text\{\s*or\s*\}|;"
_NAMED_VALUE = re.compile(r"\s*([A-Za-z][A-Za-z0-9]*)\s*(=|\\approx)(.*)\Z", re.S)
_POINT = re.compile(r"\s*(?:[A-Za-z][A-Za-z0-9]*\s*(?:=|\\approx)\s*)?\(.*\)\s*\Z", re.S)


def _truth_solutions(truth):
    """[(names or None, values)]: dict solutions are named (values in name order), plain tuples are positional."""
    items = [truth] if isinstance(truth, (dict, Eq)) else list(truth) if isinstance(truth, (list, tuple, Tuple, FiniteSet)) else None
    if not items:
        raise ValueError("solutions truth must be a non-empty list of solutions, as from solve(..., dict=True)")
    result = []
    for item in items:
        if isinstance(item, dict):
            named = {str(key): S(value) for key, value in item.items()}
        elif isinstance(item, Eq) or (isinstance(item, (list, tuple, Tuple)) and item and all(isinstance(part, Eq) for part in item)):
            parts = [item] if isinstance(item, Eq) else list(item)
            if not all(isinstance(part.lhs, Symbol) for part in parts):
                raise ValueError("solutions truth: write each Eq with a symbol on the left, as Eq(x, 2)")
            named = {part.lhs.name: part.rhs for part in parts}
        elif isinstance(item, (list, tuple, Tuple)):
            result.append((None, [S(value) for value in item]))
            continue
        else:
            raise ValueError(f"solutions truth: cannot read the solution {item}")
        names = sorted(named)
        result.append((names, [named[name] for name in names]))
    if len({len(values) for _, values in result}) != 1:
        raise ValueError("solutions truth: every solution must have the same number of values")
    return result


def _published_solutions(tex):
    """[(names or None, [(relation, text)])]: points `(3, 5)` are positional, `x = 3, y = 5` are named."""
    cleaned = mp._strip_decorations(tex).strip()
    flat = [piece.strip() for piece in mp._split(cleaned, mp._top_level_cuts(cleaned, rf"{_SOLUTION_BREAK}|\\text\{{\s*and\s*\}}|,"))]
    if flat and all(_POINT.match(piece) for piece in flat):
        result = []
        for piece in flat:
            pieces, relation = _coordinates(piece)
            result.append((None, [(relation, text) for text in pieces]))
        return result
    result = []
    for chunk in mp._split(cleaned, mp._top_level_cuts(cleaned, _SOLUTION_BREAK)):
        names, values = [], []
        for piece in mp._split(chunk, mp._top_level_cuts(chunk, rf"\\text\{{\s*and\s*\}}|,")):
            if not piece.strip():
                continue
            match = _NAMED_VALUE.match(piece)
            if not match:
                raise ValueError(f"{tex!r}: every value needs a name, as in x = 1 (read {piece.strip()!r})")
            names.append(match.group(1))
            values.append((match.group(2), match.group(3).strip()))
        if not names:
            raise ValueError(f"no solution in {tex!r}")
        if len(set(names)) != len(names):
            raise ValueError(f"{tex!r}: a name is given twice in one solution")
        result.append((names, values))
    return result


def _value_matches(relation, text, want, opts, tex):
    if "sf" in opts or "dp" in opts:
        try:
            mp.check_rounded(f"{relation} {text}", _number(want, "solutions"), sf=opts.get("sf"), dp=opts.get("dp"))
        except AssertionError:
            return False
        return True
    return _same(mp._parse(text, tex), want)


def k_solutions(tex, truth, opts):
    wanted = _truth_solutions(truth)
    published = _published_solutions(tex)
    if len(published) != len(wanted):
        raise AssertionError(f"{tex!r} gives {len(published)} solution(s), {len(wanted)} expected")
    remaining = list(published)
    for names, values in wanted:
        for i, (got_names, got_values) in enumerate(remaining):
            if len(got_values) != len(values):
                continue
            if got_names is None:
                order = list(range(len(values)))  # a point lists the values in name order
            else:
                if names is None:
                    raise ValueError("solutions truth has no variable names, so named answers cannot be checked; use solve(..., dict=True)")
                if set(got_names) != set(names):
                    continue
                order = [got_names.index(name) for name in names]
            if all(_value_matches(*got_values[j], want, opts, tex) for j, want in zip(order, values)):
                remaining.pop(i)
                break
        else:
            shown = names and {name: str(value) for name, value in zip(names, values)} or [str(value) for value in values]
            raise AssertionError(f"the solution {shown} is missing from {tex!r}")


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


def _has_variable_denominator(expr) -> bool:
    return any(isinstance(node, Pow) and node.exp.is_negative and node.base.free_symbols for node in sympy.preorder_traversal(expr))


def k_equation(tex, truth, opts):
    target = truth.lhs - truth.rhs if isinstance(truth, Eq) else S(truth)
    if not _plain(target).free_symbols or simplify(target) == 0:
        raise ValueError(f"equation truth {truth} must involve a variable")
    raw = mp.parse_equation(tex)
    if _has_variable_denominator(raw) and not _has_variable_denominator(truth.lhs - truth.rhs if isinstance(truth, Eq) else S(truth)):
        raise AssertionError("a denominator in the published equation excludes values the true equation allows; clear the fractions first (use a sidecar for rational equations)")
    published = _plain(raw)
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


_STANDARD = re.compile(r"([-+]?)\s*(\d+(?:\.\d+)?)\s*(?:\\times|\\cdot)\s*10\s*\^\s*\{?\s*(-?\d+)\s*\}?")


def k_standard_form(tex, truth, opts):
    """a x 10^k with 1 <= a < 10 (`sf`: exactly that many figures, and then \\approx). A trailing unit is allowed
    (\\pu{2.50e-3 mol} reads as 2.50 x 10^{-3} mol); `unit` and `signed` as for exact."""
    value = _number(truth, "standard-form")
    text = _without_unit(tex, opts, plain=True)
    if opts.get("signed"):
        _check_signed(text, truth, tex)
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
    """A word answer in multiple choice ("exothermic", "trigonal planar", "sp²"): the option text equals the truth."""
    normal = lambda value: re.sub(r"\s+", " ", str(value)).strip()  # noqa: E731
    if normal(text) != normal(truth):
        raise AssertionError(f"{text!r} is not the correct option {truth!r}")


def _side_map(side):
    """{species key: (Formula, total coefficient, states)} for one side; a species written twice is summed."""
    out = {}
    for coefficient, formula, state, _ in side:
        _, total, states = out.get(formula.key(), (formula, 0, set()))
        out[formula.key()] = (formula, total + coefficient, states | {state})
    return out


def _names(mapping):
    return " + ".join(formula.text for formula, _, _ in mapping.values())


def k_chem_equation(tex, truth, opts):
    """A chemical equation, in mhchem ($\\ce{2H2(g) + O2(g) -> 2H2O(l)}$) or plain (2H2 + O2 → 2H2O), with -> / → or
    <=> / ⇌ / \\rightleftharpoons. Ions carry ^ charges (Fe^{3+}, \\ce{SO4^2-}, OH-), electrons are e- (charge 1-).

    `truth` is the skeleton, e.g. "Fe2O3 + CO -> Fe + CO2" (or a half-equation "MnO4^- + H^+ + e- -> Mn^2+ + H2O"); the
    gate balances it (atoms and charge, SymPy nullspace). A skeleton that balances in more than one independent way is
    refused: give the truth with its coefficients, and the answer must then be proportional to it.
    The published equation must: balance in atoms and charge; have exactly the truth's species on each side (state
    symbols ignored unless `states: true`, which needs one on every species, matching the truth's where it gives them);
    use the smallest whole-number coefficients, unless `allowMultiple: true` (any whole-number multiple) or
    `fractions: true` (per mole: the species `per`, by default the only product or else the first reactant, has
    coefficient 1, and the others may be fractions such as ½ / \\frac{1}{2} / 1/2).
    `reversible: true` requires ⇌ and rejects →; `reversible: false` requires →; without it either arrow is accepted.
    Species are matched by composition for balancing, then by their written formula: a structural isomer of a truth
    species fails. `aliases: {"CH3COOH": ["CH3CO2H"]}` lists other writings of the same compound that are accepted."""
    true_left, _, true_right = cp.parse_equation(truth)
    if any(written for *_, written in true_left + true_right):
        if cp.imbalance(true_left, true_right):
            raise ValueError(f"truth {truth!r} has coefficients but does not balance")
        target = [coefficient for coefficient, *_ in true_left + true_right]
    else:
        target = cp.balance(true_left, true_right)
    left, arrow, right = cp.parse_equation(tex)
    reversible = opts.get("reversible")
    if reversible is True and arrow != "<=>":
        raise AssertionError(f"{tex!r}: this is an equilibrium; use the ⇌ arrow")
    if reversible is False and arrow != "->":
        raise AssertionError(f"{tex!r}: this reaction goes one way; use the → arrow")
    want = [_side_map(true_left), _side_map(true_right)]
    got = [_side_map(left), _side_map(right)]
    # The written formula identifies the compound (CH3COOCH3 is not CH3CH2COOH). Check every species as written, before
    # same-composition species are merged, so a wrong isomer can't hide behind a right one on the same side.
    aliases = {cp.parse_formula(k).text: {cp.parse_formula(v).text for v in vs} for k, vs in (opts.get("aliases") or {}).items()}
    for side, truth_side in ((left, true_left), (right, true_right)):
        allowed = {}
        for _, formula, _, _ in truth_side:
            allowed.setdefault(formula.key(), set()).update({formula.text} | aliases.get(formula.text, set()))
        for _, formula, _, _ in side:
            names = allowed.get(formula.key())
            if names and formula.text not in names:
                raise AssertionError(f"{tex!r}: {formula.text} has the right atoms but is not {' or '.join(sorted(names))}; write the compound as the question does (or list a vetted alias)")
    for name, have, need in zip(("reactants", "products"), got, want):
        if set(have) != set(need):
            raise AssertionError(f"{tex!r}: the {name} are {_names(have)}, not {_names(need)}")
    problems = cp.imbalance(left, right)
    if problems:
        detail = "; ".join(f"{name} {float(lhs):g} on the left, {float(rhs):g} on the right" for name, lhs, rhs in problems)
        raise AssertionError(f"{tex!r} is not balanced ({detail})")
    # The truth's coefficient for each species (its balanced skeleton, or its own coefficients).
    true_coefficient = {}
    for side, index in ((true_left, 0), (true_right, 1)):
        for (_, formula, _, _), value in zip(side, target[:len(true_left)] if index == 0 else target[len(true_left):]):
            key = (index, formula.key())
            true_coefficient[key] = true_coefficient.get(key, 0) + value
    published = {(index, key): total for index, mapping in enumerate(got) for key, (_, total, _) in mapping.items()}
    ratios = {published[key] / value for key, value in true_coefficient.items()}
    if len(ratios) != 1:
        raise AssertionError(f"{tex!r} balances, but not with the truth's coefficients {' : '.join(str(v) for v in true_coefficient.values())}")
    ratio = ratios.pop()
    whole = all(value.denominator == 1 for value in published.values())
    if opts.get("fractions"):
        per = cp.parse_formula(opts["per"]).key() if "per" in opts else (next(iter(want[1])) if len(want[1]) == 1 else next(iter(want[0])))
        sides = [index for index in (0, 1) if per in want[index]]
        if not sides:
            raise ValueError(f"chem-equation.per {opts['per']!r} is not a species of the equation")
        if published[(sides[0], per)] != 1:
            raise AssertionError(f"{tex!r}: per mole of {want[sides[0]][per][0].text}, its coefficient must be 1 (fractions allowed elsewhere)")
    elif opts.get("allowMultiple"):
        if not whole:
            raise AssertionError(f"{tex!r}: use whole-number coefficients")
    else:
        if not whole:
            raise AssertionError(f"{tex!r}: use the smallest whole-number coefficients, not fractions")
        if ratio != 1:
            raise AssertionError(f"{tex!r}: the coefficients are not the smallest whole numbers (all divide by {ratio})")
    if opts.get("states"):
        for name, have, need in zip(("reactant", "product"), got, want):
            for key, (formula, _, states) in have.items():
                if None in states:
                    raise AssertionError(f"{tex!r}: the {name} {formula.text} needs a state symbol")
                truth_states = need[key][2] - {None}
                if truth_states and states != truth_states:
                    raise AssertionError(f"{tex!r}: {formula.text} is ({'/'.join(sorted(states))}), not ({'/'.join(sorted(truth_states))})")


def _published_formula(tex):
    """The formula in an answer: the last \\ce{...}, else the text after the last = or :."""
    block = cp.last_block(tex)
    if block is None:
        block = re.split(r"=|:|\\approx", tex.replace("$", " "))[-1]
    return cp.parse_species(f"\\ce{{{block}}}")[0]


def k_formula(tex, truth, opts):
    """A chemical formula, mhchem ($\\ce{C2H4}$, $\\ce{Al2(SO4)3}$, $\\ce{SO4^2-}$) or plain. `match: "composition"` (the
    default) compares element counts and charge; `match: "exact"` compares the formula as written (after normalising
    mhchem and spacing), for condensed structural formulas such as CH3CH2OH vs C2H6O.

    The truth calls a helper: empirical_formula({"C": 85.7, "H": 14.3}) (percentages or masses, booklet Ar values;
    ratios near 1.5 / 1.33 / 1.25 are scaled by 2 / 3 / 4, other non-whole ratios are refused as ambiguous),
    molecular_formula("CH2", 56.1), ionic_formula("Al3+", "SO4 2-"), or formula("C2H5OH") with given: true when the
    question itself states the formula."""
    if not isinstance(truth, cp.Formula):
        raise ValueError(f"formula truth must be a formula helper's result, got {truth}")
    published = _published_formula(tex)
    if published != truth:
        raise AssertionError(f"{tex!r} is {published.hill()}, not {truth.hill()}")
    if opts.get("match") == "exact" and published.text != truth.text:
        raise AssertionError(f"{tex!r} is written {published.text}, not {truth.text}")


_PROSE_GREEK = {name: chr(code) for name, code in (
    ("Delta", 0x394), ("delta", 0x3B4), ("alpha", 0x3B1), ("beta", 0x3B2), ("gamma", 0x3B3), ("lambda", 0x3BB),
    ("mu", 0x3BC), ("nu", 0x3BD), ("pi", 0x3C0), ("sigma", 0x3C3), ("theta", 0x3B8), ("ominus", 0x29B5),
    ("circ", 0xB0), ("times", 0xD7), ("pm", 0xB1))}


def _math_prose(segment):
    """Maths as it reads: \\text{} keeps its spaces, other spaces vanish (TeX ignores them), commands become symbols."""
    segment = re.sub(r"\\(?:text|textrm|mathrm)\s*\{([^{}]*)\}", lambda m: "\\text{" + m.group(1).replace(" ", "\x00") + "}", segment)
    segment = re.sub(r"\\([A-Za-z]+)", lambda m: _PROSE_GREEK.get(m.group(1), m.group(0)), segment)
    segment = cp.normalise(segment)
    segment = re.sub(r"\\[A-Za-z]+", "", segment)
    return re.sub(r"\s+", "", segment).replace("\x00", " ")


def _normal_prose(text):
    """Text compared case-, space-, KaTeX/mhchem-, dash- and sub/superscript-insensitively ("ΔH" = "$\\Delta H$",
    "H₂O" = "$\\ce{H2O}$", "sp²" = "sp^2", "–" = "-")."""
    pieces = str(text).split("$")
    joined = " ".join(_math_prose(piece) if index % 2 else piece for index, piece in enumerate(pieces))
    joined = cp.normalise(joined).replace("^", "").replace("_", "").casefold()
    joined = re.sub(r"\s+", " ", joined).strip()
    return re.sub(r"\s*([^\w\s])\s*", r"\1", joined)


def _contains(text, phrase):
    phrase = _normal_prose(phrase)
    before = r"(?<!\w)" if phrase[:1].isalnum() else ""
    after = r"(?!\w)" if phrase[-1:].isalnum() else ""
    return re.search(before + re.escape(phrase) + after, text) is not None


def k_explanation(text, truth, opts):
    """A prose answer ("Explain why ...", "Outline ..."), on worked examples only (checks stay multiple choice or
    numeric). `truth` is a one-line summary of the expected answer (text; the literal-truth rule does not apply).
    `requires` (at least 2): the marking points, each a phrase that must appear, or a list of alternative phrases (any one
    will do). `forbids` (optional): misconception phrases that must not appear ("energy is released when bonds break").
    Matching ignores case, spacing, KaTeX/mhchem markup, Unicode dashes and sub/superscripts, and is by whole words."""
    if not isinstance(text, str):
        raise ValueError("explanation checks published text")
    answer = _normal_prose(text)
    for entry in opts["requires"]:
        alternatives = entry if isinstance(entry, list) else [entry]
        if not any(_contains(answer, phrase) for phrase in alternatives):
            raise AssertionError(f"the answer does not state {' / '.join(repr(phrase) for phrase in alternatives)}")
    for phrase in opts.get("forbids", []):
        if _contains(answer, phrase):
            raise AssertionError(f"the answer says {phrase!r}, a misconception")


CHECKERS = {
    "exact": k_exact, "rounded": k_rounded, "list": k_list, "assignments": k_assignments, "solutions": k_solutions, "point": k_point, "vector": k_vector,
    "equation": k_equation, "inequality": k_set, "set": k_set, "ratio": k_ratio, "standard-form": k_standard_form, "money": k_money,
    "time": k_time, "bearing": k_bearing, "angle": k_angle, "fraction": k_fraction, "expression": k_expression,
    "antiderivative": k_antiderivative, "choice": k_choice, "formula": k_formula,
}


def check(verify: dict, published, tolerance=None, chemistry=False):
    """Raise AssertionError if `published` (an answer's TeX, an option's text, or a numeric check's value) is wrong.
    chemistry=True makes the data booklet constants (R, NA, F, ...) names in the truth."""
    check_spec(verify)
    kind = verify["kind"]
    opts = {key: value for key, value in verify.items() if key not in ("kind", "truth")}
    if kind == "choice":
        return k_choice(published, verify["truth"], opts)
    if kind in ("explanation", "chem-equation"):
        if not isinstance(published, str):
            raise ValueError(f"{kind} checks published text, got {published!r}")
        return (k_explanation if kind == "explanation" else k_chem_equation)(published, verify["truth"], opts)
    truth = evaluate_truth(verify["truth"], chemistry=chemistry)
    if kind != "antiderivative":
        with mp.keep_constant():
            return _check_kind(verify, kind, opts, truth, published, tolerance)
    return _check_kind(verify, kind, opts, truth, published, tolerance)


def _check_kind(verify, kind, opts, truth, published, tolerance):
    if kind == "numeric":
        if isinstance(published, str):
            raise ValueError("numeric verify is for a numeric check's value, not text")
        return k_numeric(published, truth, opts, tolerance)
    if not isinstance(published, str):
        raise ValueError(f"{kind} checks published text, got {published!r}")
    return CHECKERS[kind](published, truth, opts)


if __name__ == "__main__":
    if sys.argv[1:] == ["--spec"]:
        print(json.dumps({"kinds": KINDS, "enums": ENUMS, "booleans": sorted(BOOLEANS), "arrays": sorted(ARRAYS)}, sort_keys=True))
    else:
        print("Usage: verify_kinds.py --spec", file=sys.stderr)
        sys.exit(2)
