"""SymPy assertions for lesson 1.5 (Exponents and introductory logarithms). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed here from the question's own data: exponent expressions are built and simplified by SymPy,
unknown exponents and log equations are solved with `solve`, and logarithms are evaluated with SymPy's `log`.
Two option styles need small readers below: a log statement `\\log_{a} b = x` (read as its three numbers) and a bare
logarithm (read as its base and argument, to decide whether it exists).
"""
import re
import sys
from pathlib import Path

from sympy import Eq, Rational, S, exp, expand, log, simplify, solve, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer  # noqa: E402

x, y, a = symbols("x y a")  # mathparse returns plain symbols
n_real = symbols("n", real=True)
x_real = symbols("x", real=True)
x_pos = symbols("x", positive=True)
h_pos = symbols("h", positive=True)


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def only_solution(equation, var):
    """The single real solution of `equation` in `var`."""
    sols = [s for s in solve(equation, var) if s.is_real]
    if len(sols) != 1:
        raise RuntimeError(f"expected one real solution, got {sols}")
    return sols[0]


LOG_STATEMENT = re.compile(r"^\$\\log_\{(\d+)\}\s*(\d+)\s*=\s*(\d+)\$$")


def log_statement(tex, base, power):
    """Option `$\\log_{a} b = x$` for the exponent statement base^power = base**power: a, b and x must all match."""
    match = LOG_STATEMENT.match(tex.strip())
    if not match:
        raise ValueError(f"cannot read log statement {tex!r}")
    pa, pb, px = (int(g) for g in match.groups())
    if (pa, pb, px) != (base, base**power, power):
        raise AssertionError(f"published log_{pa} {pb} = {px}, truth log_{base} {base**power} = {power}")


BARE_LOG = re.compile(r"^\$\\log_\{(\d+)\}\s*(.+)\$$")


def log_exists(tex):
    """(base, argument) of a bare `$\\log_{a} (...)$`; True when the logarithm is a real number."""
    match = BARE_LOG.match(tex.strip())
    if not match:
        raise ValueError(f"cannot read logarithm {tex!r}")
    base, argument = S(int(match.group(1))), parse_answer(f"${match.group(2)}$")
    if not (base > 0 and base != 1):
        raise ValueError(f"bad base in {tex!r}")
    return bool(argument > 0)


def _published_rhs(tex):
    """The TeX after the last top-level `=` of a published answer, without the `$` delimiters."""
    body = tex.strip().strip("$").strip()
    depth, cut = 0, -1
    for i, ch in enumerate(body):
        depth += ch == "{"
        depth -= ch == "}"
        if ch == "=" and depth == 0:
            cut = i
    return body[cut + 1:].strip()


# SymPy simplifies while it parses (x^6/x^4 -> x^2, 5/(2x^3) -> 5/2 x^-3), so the asked-for *form* can only be
# checked on the published TeX itself. These readers accept only that form; anything else raises AssertionError.
MONOMIAL = re.compile(r"^(\d+)((?:[a-z](?:\^\{\d+\})?)+)$")
FACTOR = re.compile(r"([a-z])(?:\^\{(\d+)\})?")


def simplified_monomial(tex, truth):
    """Answer must be one term `c x^{m} y^{n}`: a whole-number coefficient, each letter once, no fraction."""
    same(tex, truth)
    rhs = re.sub(r"\s+", "", _published_rhs(tex))
    match = MONOMIAL.match(rhs)
    if not match:
        raise AssertionError(f"{rhs!r} is not a single simplified term")
    powers = {}
    for letter, power in FACTOR.findall(match.group(2)):
        if letter in powers:
            raise AssertionError(f"{letter} appears twice in {rhs!r}, so it is not simplified")
        powers[letter] = int(power or 1)
    coeff, rest = truth.as_coeff_Mul()
    truth_powers = {str(base): int(exp_) for base, exp_ in rest.as_powers_dict().items()}
    if int(match.group(1)) != coeff or powers != truth_powers:
        raise AssertionError(f"published {match.group(1)} {powers}, truth {coeff} {truth_powers}")


POWER_TERM = re.compile(r"^(\d+|\\frac\{\d+\}\{\d+\})?x(?:\^\{(-?\d+)\})?$")


def power_form(tex, truth):
    """Answer must be a sum of terms `a x^{p}`: a number times a power of x, with no x in any denominator."""
    same(tex, truth)
    rhs = re.sub(r"\s+", "", _published_rhs(tex))
    terms, depth, start = [], 0, 0
    for i, ch in enumerate(rhs):  # split at top-level + and -, so the minus in x^{-3} stays inside its term
        depth += ch == "{"
        depth -= ch == "}"
        if ch in "+-" and depth == 0 and i > 0:
            terms.append(rhs[start:i])
            start = i
    terms.append(rhs[start:])
    terms = [(t[0], t[1:]) if t[0] in "+-" else ("", t) for t in terms]
    published = {}
    for sign, term in terms:
        match = POWER_TERM.match(term)
        if not match:
            raise AssertionError(f"term {term!r} is not a number times a power of x")
        coeff = parse_answer(f"${match.group(1)}$") if match.group(1) else S(1)
        power = int(match.group(2) or 1)
        if power in published:
            raise AssertionError(f"two terms in x^{power} in {rhs!r}")
        published[power] = -coeff if sign == "-" else coeff
    truth_terms = {}
    for term, coeff in expand(truth).as_coefficients_dict().items():
        unit, power = term.as_coeff_exponent(x)
        truth_terms[int(power)] = coeff * unit
    if published.keys() != truth_terms.keys() or any(simplify(published[k] - truth_terms[k]) != 0 for k in truth_terms):
        raise AssertionError(f"published terms {published}, truth {truth_terms}")


def undefined_log(tex):
    if log_exists(tex):
        raise AssertionError(f"{tex!r} is a real number, so it does exist")


CHECKS = {
    # before you start
    "before-power-value": lambda v, tolerance: check_numeric(v, S(3) ** 4, sf=3, tolerance=tolerance),
    "before-minus-square": lambda tex: same(tex, -(S(3) ** 2)),
    "before-reciprocal": lambda tex: same(tex, 1 / Rational(2, 5)),
    # laws
    "ex-laws-algebra": lambda tex: simplified_monomial(tex, (3 * x**2 * y) ** 3 / (9 * x**4 * y)),
    "check-laws-bracket": lambda tex: same(tex, (2 * a**3) ** 4),
    "ex-laws-find-n": lambda tex: same(tex, only_solution(Eq(S(9) ** 4 * 27 / S(3) ** n_real, S(3) ** 5), n_real)),
    "check-laws-find-n": lambda v, tolerance: check_numeric(
        v, only_solution(Eq(S(8) ** 2 * S(2) ** n_real, S(4) ** 5), n_real), sf=3, tolerance=tolerance),
    # zero and negative exponents
    "ex-negative-evaluate": lambda tex: same(tex, S(4) ** -2 + Rational(2, 5) ** -1 - S(9) ** 0),
    "check-coefficient-negative": lambda tex: same(tex, 3 * x**-2),
    "ex-negative-form": lambda tex: power_form(tex, 5 / (2 * x**3) - 4 / x),
    "check-negative-fraction": lambda tex: same(tex, Rational(2, 3) ** -3),
    # logarithms
    "check-log-form": lambda tex: log_statement(tex, 6, 3),
    "ex-log-negative-value": lambda tex: same(tex, log(Rational(1, 125), 5)),
    "check-log-undefined": undefined_log,
    "ex-log-solve-argument": lambda tex: same(tex, only_solution(Eq(log(x_real + 3, 2), 5), x_real)),
    "check-log-solve": lambda tex: same(tex, only_solution(Eq(log(x_pos) / log(3), -2), x_pos)),
    # base 10, base e and the calculator
    "ex-solve-e-power": lambda tex: check_rounded(tex, only_solution(Eq(exp(2 * x_real), 30), x_real), sf=3),
    "check-ten-solve": lambda v, tolerance: check_numeric(
        v, only_solution(Eq(10**x_real, Rational(3, 10)), x_real), sf=3, tolerance=tolerance),
    "ex-gdc-base-two": lambda tex: check_rounded(tex, only_solution(Eq(2**x_real, 50), x_real), sf=3),
    "check-ph-concentration": lambda tex: check_rounded(
        tex, only_solution(Eq(-log(h_pos, 10), Rational(56, 10)), h_pos), sf=3),
}

NUMERIC = {
    "before-power-value": {"sf": 3},
    "check-laws-find-n": {"sf": 3},
    "check-ten-solve": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
