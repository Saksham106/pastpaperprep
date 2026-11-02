"""SymPy assertions for lesson 5.18 (first-order differential equations). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Truths are computed independently: dsolve / integrate for exact solutions, an exact Euler recurrence for the
numerical estimates. Where a solution is published implicitly, the assertion checks the properties only the right
curve has: it passes through the given point and satisfies the differential equation there and along the curve.
"""
import sys
from pathlib import Path

from sympy import (Eq, Function, Rational, Symbol, cos, diff, dsolve, exp, integrate, nsolve, simplify, sin, solve,
                   sqrt, symbols)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_antiderivative, check_numeric, check_rounded, parse_answer, parse_equation  # noqa: E402

x, t, k, n = symbols("x t k n")
yf = Function("y")
Y = Symbol("y")
C = Symbol("C")


def same(tex, truth, functions=()):
    published = parse_answer(tex, functions)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def solve_ivp(rhs, x0, y0, var=x):
    """Particular solution of dy/dvar = rhs(var, y) through (x0, y0), by SymPy's dsolve."""
    f = Function("f")
    sol = dsolve(Eq(f(var).diff(var), rhs(var, f(var))), f(var), ics={f(x0): y0})
    return sol.rhs


def is_solution(tex, rhs, x0, y0):
    """Published explicit y(x): compare with dsolve's particular solution, then also substitute back."""
    published = parse_answer(tex)
    truth = solve_ivp(rhs, x0, y0)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not the particular solution {truth}")
    if simplify(diff(published, x) - rhs(x, published)) != 0 or simplify(published.subs(x, x0) - y0) != 0:
        raise AssertionError("published function does not satisfy the equation and the condition")


def general_family(tex, rhs):
    """A published general solution must contain the constant C and satisfy the equation for every C."""
    published = parse_answer(tex)
    if C not in published.free_symbols:
        raise AssertionError(f"published {published} has no arbitrary constant")
    if simplify(diff(published, x) - rhs(x, published)) != 0:
        raise AssertionError(f"published {published} does not satisfy the equation")


def is_solution_of_form(tex, rhs):
    """Multiple choice: which function satisfies dy/dx = rhs(x, y)?"""
    published = parse_answer(tex)
    if simplify(diff(published, x) - rhs(x, published)) != 0:
        raise AssertionError(f"{published} is not a solution")


def sep_parts(tex):
    # e^x dy/dx = x/y, y(0) = 2 -> y dy = x e^{-x} dx. Integrate both sides independently.
    c = Symbol("c")
    lhs = integrate(Y, Y)
    rhs = integrate(x * exp(-x), x) + c
    cval = solve(lhs.subs(Y, 2) - rhs.subs(x, 0), c)[0]
    truth_y2 = simplify(2 * (rhs.subs(c, cval)))
    same(tex, truth_y2)
    # and the curve y = sqrt(published) satisfies the equation
    yy = sqrt(parse_answer(tex))
    if simplify(exp(x) * diff(yy, x) - x / yy) != 0:
        raise AssertionError("y^2 published does not satisfy the equation")


def logistic_rumour(tex):
    published = parse_answer(tex)
    if published.free_symbols - {t}:
        raise AssertionError(f"unexpected symbols in {published}")
    truth = solve_ivp(lambda tt, f: Rational(2, 1000) * f * (500 - f), 0, 50, var=t)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def logistic_time(tex):
    T = solve(Eq(500 / (1 + 9 * exp(-t)), 400), t)
    real = [r for r in T if r.is_real]
    same(tex, real[0])


def homog_pf(tex):
    """Published implicit curve F(x, y) = 0: through (3, 1), and dy/dx = -F_x / F_y equals (x + 3y)/(3x + y)
    at several points of the branch through (3, 1)."""
    F = parse_equation(tex)
    F = F.subs({s: Symbol(s.name) for s in F.free_symbols})
    if simplify(F.subs({x: 3, Y: 1})) != 0:
        raise AssertionError("curve does not pass through (3, 1)")
    slope = -diff(F, x) / diff(F, Y)
    target = (x + 3 * Y) / (3 * x + Y)
    guess = 1.0
    for x0 in (3, 3.2, 3.5, 4, 5):
        y0 = nsolve(F.subs(x, x0), Y, guess)
        guess = float(y0)
        if abs(float((slope - target).subs({x: x0, Y: y0}))) > 1e-9:
            raise AssertionError(f"curve slope at x = {x0} does not match the equation")


def homog_value():
    """dy/dx = (x^2 + y^2)/(xy), y(1) = 2, x, y > 0: dsolve the equation directly, take the positive branch at x = 2."""
    f = Function("f")
    sols = dsolve(Eq(f(x).diff(x), (x**2 + f(x)**2) / (x * f(x))), f(x))
    sols = sols if isinstance(sols, list) else [sols]
    for sol in sols:
        c1 = Symbol("C1")
        for cval in solve(sol.rhs.subs(x, 1) - 2, c1):
            particular = sol.rhs.subs(c1, cval)
            value = particular.subs(x, 2)
            if simplify(particular.subs(x, 1) - 2) == 0 and value.is_real and value > 0:
                return value
    raise RuntimeError("no positive branch through (1, 2)")


def sep_value():
    """y dy/dx = 4x, y(1) = 3, y > 0: integrate y dy from 3 to Y and 4x dx from 1 to 2, take the positive Y."""
    Yend = Symbol("Yend", positive=True)
    return solve(Eq(integrate(Y, (Y, 3, Yend)), integrate(4 * x, (x, 1, 2))), Yend)[0]


def euler(f, x0, y0, h, steps):
    xs, ys = Rational(x0), Rational(y0)
    for _ in range(steps):
        ys = ys + h * f(xs, ys)
        xs = xs + h
    return ys


def concavity_word(text):
    # dy/dx = y^2 => d2y/dx2 = 2y dy/dx = 2y^3, positive for y > 0: concave up, tangents below, underestimate.
    yy = Symbol("y", positive=True)
    second = diff(yy**2, yy) * yy**2
    concave_up = bool(second.is_positive)
    lower = text.lower()
    expected = ("underestimate", "concave up", "below") if concave_up else ("overestimate", "concave down", "above")
    if not all(word in lower for word in expected):
        raise AssertionError(f"option {text!r} does not match the truth {expected}")


CHECKS = {
    "before-int-ln": lambda tex: check_antiderivative(tex, 2 * x / (x**2 + 5)),
    "before-int-pf": lambda tex: check_antiderivative(tex, 2 / (x * (x + 2))),
    "before-int-parts": lambda tex: check_antiderivative(tex, x * exp(-x)),
    "ex-direct-integrate": lambda tex: is_solution(tex, lambda xx, f: 6 * xx**2 - 4, 1, 3),
    "check-is-solution": lambda tex: is_solution_of_form(tex, lambda xx, f: -3 * f),
    "ex-verify-k": lambda tex: same(tex, solve(x * diff(k * x**3, x) - k * x**3 - 4 * x**3, k)[0]),
    "check-direct-value": lambda v, tolerance: check_numeric(
        v, solve_ivp(lambda xx, f: 3 / xx, 1, 2).subs(x, exp(2)), sf=3, tolerance=tolerance),
    "ex-sep-exp": lambda tex: is_solution(tex, lambda xx, f: 3 * xx**2 * f, 0, 5),
    "check-sep-exp": lambda tex: is_solution(tex, lambda xx, f: (2 * xx + 1) * f, 0, 4),
    "ex-sep-parts": sep_parts,
    "check-sep-value": lambda v, tolerance: check_numeric(
        v, sep_value(), sf=3, tolerance=tolerance),
    "ex-logistic-solve": logistic_rumour,
    "check-logistic-pf": lambda tex: same(tex, 1 / (n * (10 - n))),
    "ex-logistic-time": logistic_time,
    "check-logistic-value": lambda v, tolerance: check_numeric(
        v, solve_ivp(lambda tt, f: Rational(1, 10) * f * (10 - f), 0, 2, var=t).subs(t, 1), sf=3, tolerance=tolerance),
    "ex-homog-simple": lambda tex: is_solution(tex, lambda xx, f: (xx + 2 * f) / xx, 1, 3),
    "check-homog-general": lambda tex: general_family(tex, lambda xx, f: 1 + f / xx),
    "ex-homog-pf": homog_pf,
    "check-homog-value": lambda v, tolerance: check_numeric(v, homog_value(), sf=3, tolerance=tolerance),
    "ex-if-linear": lambda tex: is_solution(tex, lambda xx, f: xx + f, 0, 1),
    "check-if-factor": lambda tex: _integrating_factor(tex, 3 * x**2),
    "ex-if-divide": lambda tex: is_solution(tex, lambda xx, f: (1 - f * sin(xx)) / cos(xx), 0, 3),
    "check-if-value": lambda v, tolerance: check_numeric(
        v, solve_ivp(lambda xx, f: exp(-xx) - f, 0, 2).subs(x, 1), sf=3, tolerance=tolerance),
    "ex-euler-hand": lambda tex: same(tex, euler(lambda a, b: 2 * a - b, 0, 1, Rational(1, 2), 2)),  # exact: 3/4
    "check-euler-value": lambda v, tolerance: check_numeric(
        v, euler(lambda a, b: a * b, 1, 2, Rational(1, 10), 2), sf=3, tolerance=tolerance),
    "ex-euler-gdc": lambda tex: check_rounded(tex, euler(lambda a, b: sqrt(a + b), 1, 3, Rational(1, 5), 5), sf=3),
    "check-euler-concavity": concavity_word,
}


def _integrating_factor(tex, P):
    """The published factor I must satisfy I' = P I (so d/dx(I y) = I(y' + P y)); constant multiples aside, it is
    e^{int P}. Compare with the exact e^{int P dx}."""
    published = parse_answer(tex)
    truth = exp(integrate(P, x))
    ratio = simplify(published / truth)
    # I = 0 satisfies I' = P I, but multiplying by zero destroys the equation: the factor must be a nonzero multiple.
    if ratio == 0 or ratio.free_symbols or simplify(diff(published, x) - P * published) != 0:
        raise AssertionError(f"{published} is not an integrating factor for P = {P}")


NUMERIC = {
    "check-direct-value": {"sf": 3},
    "check-sep-value": {"sf": 3},
    "check-logistic-value": {"sf": 3},
    "check-homog-value": {"sf": 3},
    "check-if-value": {"sf": 3},
    "check-euler-value": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
