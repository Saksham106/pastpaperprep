"""SymPy assertions for lesson 5.8 (Extrema, inflexion and optimisation). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed from the question's own function: stationary points from solveset(f'(x) = 0), their nature
from the sign of f' just either side (the first derivative test), points of inflexion from f''(x) = 0 with a sign
change of f'', and optimisation answers from the critical points and the end points of the allowed interval.
Nothing below types in a final answer.
"""
import re
import sys
from pathlib import Path

from sympy import (
    FiniteSet, Interval, Rational, S, cos, diff, exp, nsolve, oo, pi, simplify, sin, solve, solveset, sqrt, symbols,
)
from sympy.solvers.inequalities import solve_univariate_inequality

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_numeric, check_rounded, check_same_set, parse_answer, parse_point, parse_with_unit,
)

x = symbols("x")  # mathparse returns plain symbols
xr = symbols("xr", real=True)  # for inequalities, which need a real symbol
h, t = symbols("h t")

# Half-width of the window used to read signs either side of a point. Every function here has its critical points
# at least 1 apart, so nothing else lies inside a +/- 1/100 window.
EPS = Rational(1, 100)


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def sign_at(expr, value):
    v = expr.subs(x, value).evalf(30)
    return 1 if v > 0 else -1 if v < 0 else 0


def nature(f_prime, a):
    """The set of true labels at x = a, where f'(a) = 0, from the signs of f' (and f'') either side."""
    if simplify(f_prime.subs(x, a)) != 0:
        raise AssertionError(f"f'({a}) is not 0, so x = {a} is not stationary")
    left, right = sign_at(f_prime, a - EPS), sign_at(f_prime, a + EPS)
    labels = {"max"} if (left, right) == (1, -1) else {"min"} if (left, right) == (-1, 1) else {"neither"}
    f_second = diff(f_prime, x)
    if sign_at(f_second, a - EPS) * sign_at(f_second, a + EPS) < 0:
        labels.add("inflexion")
    return labels


def stationary(f, domain=S.Reals):
    """[(a, f(a), labels)] for every stationary point of f in the domain."""
    f_prime = diff(f, x)
    roots = solveset(f_prime, x, domain)
    if not isinstance(roots, FiniteSet):
        raise AssertionError(f"cannot list the stationary points of {f}")
    return [(a, f.subs(x, a), nature(f_prime, a)) for a in roots]


def inflexions(f, domain=S.Reals):
    """[(a, f(a))] where f''(a) = 0 and f'' changes sign."""
    f_second = diff(f, x, 2)
    roots = solveset(f_second, x, domain)
    if not isinstance(roots, FiniteSet):
        raise AssertionError(f"cannot list the zeros of f'' for {f}")
    return [(a, f.subs(x, a)) for a in roots if sign_at(f_second, a - EPS) * sign_at(f_second, a + EPS) < 0]


def same_point(published, truth):
    if len(published) != len(truth) or any(simplify(p - q) != 0 for p, q in zip(published, truth)):
        raise AssertionError(f"published point {published} is not {truth}")


# "Local maximum $(a, b)$, local minimum $(c, d)$": each named point, in any order.
NAMED = re.compile(r"[Ll]ocal (maximum|minimum) \$([^$]+)\$")


def named_points(text, f, domain=S.Reals):
    pieces = NAMED.findall(text)
    if not pieces or ", ".join(f"{'L' if i == 0 else 'l'}ocal {k} ${p}$" for i, (k, p) in enumerate(pieces)) != text.strip():
        raise ValueError(f"cannot read named points in {text!r}")
    published = sorted((("max" if kind == "maximum" else "min"), parse_point(f"${point}$")) for kind, point in pieces)
    truth = [("max" if "max" in labels else "min", [a, b]) for a, b, labels in stationary(f, domain) if labels & {"max", "min"}]
    if len(published) != len(truth):
        raise AssertionError(f"published {len(published)} points, truth has {len(truth)}: {truth}")
    for kind, point in published:
        matches = [q for k, q in truth if k == kind and all(simplify(p - r) == 0 for p, r in zip(point, q))]
        if len(point) != 2 or not matches:
            raise AssertionError(f"local {kind} {point} is not one of {truth}")


def local_max_point(tex, f, domain):
    maxima = [[a, b] for a, b, labels in stationary(f, domain) if "max" in labels]
    if len(maxima) != 1:
        raise AssertionError(f"expected one local maximum, found {maxima}")
    same_point(parse_point(tex), maxima[0])


def inflexion_points(tex, f):
    cleaned = tex.strip().strip("$")
    pieces = [p.strip() for p in re.split(r"\\text\{\s*and\s*\}", cleaned)]
    published = sorted((parse_point(f"${p}$") for p in pieces), key=lambda q: float(q[0]))
    truth = sorted(([a, b] for a, b in inflexions(f)), key=lambda q: float(q[0]))
    if len(published) != len(truth):
        raise AssertionError(f"published {published}, truth {truth}")
    for p, q in zip(published, truth):
        same_point(p, q)


# Word options naming the nature of a stationary point.
WORDS = {
    "A local maximum": "max",
    "A local minimum": "min",
    "A point of inflexion": "inflexion",
    "Neither a maximum nor a minimum": "neither",
}


def word_is(text, f_prime, a):
    if text not in WORDS:
        raise ValueError(f"cannot read option {text!r}")
    truth = nature(f_prime, a)
    if WORDS[text] not in truth:
        raise AssertionError(f"at x = {a} the point is {truth}, not {WORDS[text]}")


def second_test_word(text, f, a):
    """The prompt asks for the second derivative test: f''(a) < 0 max, > 0 min. The first derivative test must agree."""
    if text not in WORDS:
        raise ValueError(f"cannot read option {text!r}")
    value = diff(f, x, 2).subs(x, a)
    if value == 0:
        raise AssertionError("the second derivative test is inconclusive here")
    truth = "min" if value > 0 else "max"
    if truth not in nature(diff(f, x), a):
        raise AssertionError("the two tests disagree")
    if WORDS[text] != truth:
        raise AssertionError(f"f''({a}) = {value}, so the point is a {truth}, not {WORDS[text]}")


# check-quartic-inflexion: each option claims yes/no and gives a reason; both must be true.
G_QUARTIC = x**4 + 4 * x


def g_second_changes_sign_at_0():
    g2 = diff(G_QUARTIC, x, 2)
    return sign_at(g2, -EPS) * sign_at(g2, EPS) < 0


REASONED = {
    r"No, because $g''(x)$ does not change sign at $x = 0$": (False, lambda: not g_second_changes_sign_at_0()),
    r"Yes, because $g''(0) = 0$": (True, lambda: diff(G_QUARTIC, x, 2).subs(x, 0) == 0),
    r"Yes, because $g''(x)$ changes sign at $x = 0$": (True, g_second_changes_sign_at_0),
}


def reasoned_inflexion(text):
    if text not in REASONED:
        raise ValueError(f"cannot read option {text!r}")
    claim, reason = REASONED[text]
    truth = any(simplify(a) == 0 for a, _ in inflexions(G_QUARTIC))
    if claim != truth:
        raise AssertionError(f"there {'is' if truth else 'is no'} point of inflexion at x = 0")
    if not reason():
        raise AssertionError("the reason given is false")


def where(expr, relation):
    """Real x where expr > 0 ('>') or expr < 0 ('<')."""
    e = expr.subs(x, xr)
    return solve_univariate_inequality(e > 0 if relation == ">" else e < 0, xr, relational=False)


def best_on(f, interval, kind):
    """The largest (kind='max') or smallest value of f on a closed interval: critical points and end points."""
    candidates = [interval.start, interval.end] + list(solveset(diff(f, x), x, interval))
    values = [f.subs(x, c) for c in candidates]
    return max(values, key=lambda v: float(v)) if kind == "max" else min(values, key=lambda v: float(v))


def interior_max(f, interval):
    """The value of f at its single critical point inside an open interval, proved a maximum by f'' < 0 there."""
    crit = list(solveset(diff(f, x), x, interval))
    if len(crit) != 1:
        raise AssertionError(f"expected one critical point in {interval}, found {crit}")
    if not diff(f, x, 2).subs(x, crit[0]) < 0:
        raise AssertionError("the critical point is not a maximum")
    return f.subs(x, crit[0])


def box_volume(tex):
    # Open box, square base x, height h: x^2 + 4xh = 300. Part (a) is checked too: V = x^2 h = 75x - x^3/4.
    height = solve(x**2 + 4 * x * h - 300, h)[0]
    volume = x**2 * height
    if simplify(volume - (75 * x - x**3 / 4)) != 0:
        raise AssertionError("part (a): V is not 75x - x^3/4")
    same(parse_with_unit(tex, "cm^3"), interior_max(volume, Interval.open(0, sqrt(300))))


def temperature_max():
    """Max of T on [0, 10]: T' sign changes found on a 0.05 grid, each root bisected, plus both end points."""
    T = 20 + 15 * exp(-t / 10) * sin(t / 2)
    dT = diff(T, t)
    grid = [Rational(k, 20) for k in range(0, 201)]
    roots = []
    for a, b in zip(grid, grid[1:]):
        if (dT.subs(t, a) * dT.subs(t, b)).evalf(30) < 0:
            roots.append(nsolve(dT, t, (a, b), solver="bisect", prec=40))
    candidates = [S(0), S(10)] + roots
    return max((T.subs(t, c).evalf(40) for c in candidates), key=float)


def constraint_area(tex):
    # Perimeter 24 with width x: 2x + 2L = 24.
    length = solve(2 * x + 2 * symbols("L") - 24, symbols("L"))[0]
    same(tex, x * length)


def y_coordinate_of_min(tex):
    f = x**3 - 12 * x + 7
    if "min" not in nature(diff(f, x), 2):
        raise AssertionError("x = 2 is not a local minimum of f")
    same(tex, f.subs(x, 2))


CHECKS = {
    "before-decreasing": lambda tex: check_same_set(tex, where(3 * x**2 - 12, "<")),
    "before-second-derivative": lambda tex: same(tex, diff(x**4 - 2 * x**3 + 5 * x, x, 2)),
    "ex-stationary-cubic": lambda text: named_points(text, 2 * x**3 - 3 * x**2 - 12 * x + 5),
    "check-y-coordinate": y_coordinate_of_min,
    "ex-stationary-exp": lambda text: named_points(text, (x**2 - 3) * exp(x)),
    "check-no-sign-change": lambda text: word_is(text, (x + 2) * (x - 4) ** 2, 4),
    "ex-second-test-reciprocal": lambda text: named_points(text, 2 * x + 8 / x, Interval.open(0, oo)),
    "ex-second-test-trig": lambda tex: local_max_point(tex, x + 2 * cos(x), Interval(0, pi)),
    "check-second-test": lambda text: second_test_word(text, x**3 - 6 * x**2 + 5, 0),
    "check-flat-quartic": lambda text: word_is(text, diff((x - 1) ** 4 + 2, x), 1),
    "check-constraint": constraint_area,
    "ex-box-volume": box_volume,
    "check-profit": lambda v, tolerance: check_numeric(
        v, best_on(-x**3 + 6 * x**2 + 135 * x - 200, Interval(0, 15), "max"), sf=3, tolerance=tolerance
    ),
    "ex-temperature-gdc": lambda tex: check_rounded(tex, temperature_max(), sf=3, unit="°C"),
    "ex-inflexion-cubic": lambda tex: inflexion_points(tex, x**3 - 6 * x**2 + 9 * x + 1),
    "ex-inflexion-quartic": lambda tex: inflexion_points(tex, x**4 - 4 * x**3 + 10),
    "check-concave-down": lambda tex: check_same_set(tex, where(diff(x**3 + 3 * x**2 - 5 * x + 2, x, 2), "<")),
    "check-quartic-inflexion": reasoned_inflexion,
}

NUMERIC = {"check-profit": {"sf": 3}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
