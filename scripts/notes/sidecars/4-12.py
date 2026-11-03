"""SymPy assertions for lesson 4.12 (Standard normal variables). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Normal probabilities come from the exact cumulative distribution function written with erf,
P(X < b) = (1 + erf((b - mu) / (sigma sqrt 2))) / 2, and z-values from erfinv, so no GDC value is typed in.
Unknown means and standard deviations are solved with SymPy from the question's own equations
(x - mu) / sigma = z, and every solution is substituted back into the original probability conditions.
"""
import re
import sys
from pathlib import Path

from sympy import Rational, erf, erfinv, simplify, solve, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, parse_answer  # noqa: E402

R = Rational
mu_s, sigma_s = symbols("mu sigma", real=True)


def cdf(b, mu, sigma):
    """P(X < b) for X ~ N(mu, sigma^2), exact."""
    return (1 + erf((b - mu) / (sigma * sqrt(2)))) / 2


def zval(p):
    """The z with P(Z < z) = p for Z ~ N(0, 1); checked by feeding it back through the cdf."""
    z = sqrt(2) * erfinv(2 * p - 1)
    assert abs((cdf(z, 0, 1) - p).evalf(30)) < 1e-20
    return z


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def holds(mu, sigma, conditions):
    """Each (bound, area to the left) condition is true for N(mu, sigma^2)."""
    for bound, p in conditions:
        assert abs((cdf(bound, mu, sigma) - p).evalf(30)) < 1e-15, (bound, p)


# ------------------------------------------------------------------------------------------------ section 1

def kiwi_z():
    """ex-z-basic: z for 52 in N(64, 8^2)."""
    return R(52 - 64, 8)


def priya_mark():
    """ex-z-compare-marks: solve (b - 58)/6 = (81 - 66)/10, then confirm P(B > b) = P(C > 81)."""
    b = symbols("b")
    (value,) = solve((b - 58) / 6 - R(81 - 66, 10), b)
    assert simplify((1 - cdf(value, 58, 6)) - (1 - cdf(81, 66, 10))) == 0
    return value


_MEANING = re.compile(r"^It is ([0-9.]+) standard deviations (below|above) the mean\.$")


def z_meaning(text):
    """check-z-meaning: a word answer; the count and side must match z for 42 in N(50, 4^2)."""
    match = _MEANING.match(text.strip())
    if not match:
        raise ValueError(f"cannot read {text!r}")
    count, side = R(match.group(1)), match.group(2)
    z = R(42 - 50, 4)
    truth_side = "below" if z < 0 else "above"
    if count != abs(z) or side != truth_side:
        raise AssertionError(f"{text!r} does not describe z = {z}")


# ------------------------------------------------------------------------------------------------ section 2

_Z_BOUND = re.compile(r"^\$\\mathrm\{P\}\(Z < (-?[0-9.]+)\)\$$")


def which_z(text):
    """check-which-z: the option P(Z < c) must have c = (72 - 80)/sqrt(25) and the same probability as P(Y < 72)."""
    match = _Z_BOUND.match(text.strip())
    if not match:
        raise ValueError(f"cannot read {text!r}")
    c = R(match.group(1))
    if simplify(cdf(c, 0, 1) - cdf(72, 80, sqrt(25))) != 0:
        raise AssertionError(f"P(Z < {c}) is not P(Y < 72)")


def within_k():
    """ex-within-k: P(-k < Z < k) = 0.9, so P(Z < k) = 0.95; confirm the middle area."""
    k = zval(R(95, 100))
    assert abs((cdf(k, 0, 1) - cdf(-k, 0, 1) - R(9, 10)).evalf(30)) < 1e-20
    return k


# ------------------------------------------------------------------------------------------------ section 3

def solve_one(equation, unknown):
    roots = [r for r in solve(equation, unknown)]
    assert len(roots) == 1, roots
    return roots[0]


def battery_sigma():
    """ex-unknown-sigma: P(B < 15) = 0.1 with mu = 18."""
    sigma = solve_one((15 - 18) / sigma_s - zval(R(1, 10)), sigma_s)
    assert sigma > 0
    holds(18, sigma, [(15, R(1, 10))])
    return sigma


def honey_mu():
    """ex-unknown-mean: P(M < 450) = 0.04 with sigma = 2.5."""
    mu = solve_one((450 - mu_s) / R(5, 2) - zval(R(4, 100)), mu_s)
    holds(mu, R(5, 2), [(450, R(4, 100))])
    return mu


def check_mu():
    """check-unknown-mean: P(X < 40) = 0.3 with sigma = 6."""
    mu = solve_one((40 - mu_s) / 6 - zval(R(3, 10)), mu_s)
    holds(mu, 6, [(40, R(3, 10))])
    return mu


def game_sigma():
    """check-unknown-sigma: P(S > 80) = 0.2 with mu = 72, so P(S < 80) = 0.8."""
    sigma = solve_one((80 - 72) / sigma_s - zval(R(8, 10)), sigma_s)
    assert sigma > 0
    holds(72, sigma, [(80, R(8, 10))])
    return sigma


def bolts():
    """ex-unknown-both: P(L < 48.2) = 0.06 and P(L > 52.5) = 0.11."""
    lo, hi = R(482, 10), R(525, 10)
    sol = solve(
        [mu_s + zval(R(6, 100)) * sigma_s - lo, mu_s + zval(1 - R(11, 100)) * sigma_s - hi],
        [mu_s, sigma_s],
        dict=True,
    )
    assert len(sol) == 1
    mu, sigma = sol[0][mu_s], sol[0][sigma_s]
    assert sigma > 0
    holds(mu, sigma, [(lo, R(6, 100)), (hi, 1 - R(11, 100))])
    return {"\\mu": mu, "\\sigma": sigma}


def named_rounded(tex, truth, sf=3):
    """`\\mu \\approx 50.6, \\; \\sigma \\approx 1.55`: each named value rounded to sf figures; names must match."""
    pieces = [p.strip() for p in re.split(r",\s*\\;", tex.replace("$", "")) if p.strip()]
    seen = set()
    for piece in pieces:
        if "\\approx" not in piece:
            raise ValueError(f"cannot read a rounded value from {piece!r}")
        name = re.sub(r"\s+", "", piece.split("\\approx")[0])
        if name not in truth:
            raise AssertionError(f"unexpected name {name!r} in {tex!r}")
        check_rounded(piece, truth[name], sf=sf)
        seen.add(name)
    if seen != set(truth):
        raise AssertionError(f"published names {sorted(seen)} are not {sorted(truth)}")


CHECKS = {
    "before-normal-cdf": lambda v, tolerance: check_numeric(v, cdf(33, 30, 4), sf=3, tolerance=tolerance),
    "before-inverse-normal": lambda tex: check_rounded(tex, 120 + sqrt(225) * zval(1 - R(1, 10)), sf=3),
    "ex-z-basic": lambda tex: same(tex, kiwi_z()),
    "ex-z-compare-marks": lambda tex: same(tex, priya_mark()),
    "check-z-direct": lambda v, tolerance: check_numeric(v, (R(27, 10) - R(32, 10)) / R(4, 10), sf=3, tolerance=tolerance),
    "check-z-meaning": z_meaning,
    "ex-z-prob": lambda tex: check_rounded(tex, 1 - cdf(161, 140, 12), sf=3),
    "ex-within-k": lambda tex: check_rounded(tex, within_k(), sf=3),
    "check-which-z": which_z,
    "check-below-sd": lambda v, tolerance: check_numeric(v, cdf(R(-22, 10), 0, 1), sf=3, tolerance=tolerance),
    "ex-unknown-sigma": lambda tex: check_rounded(tex, battery_sigma(), sf=3),
    "ex-unknown-mean": lambda tex: check_rounded(tex, honey_mu(), sf=3),
    "check-unknown-mean": lambda v, tolerance: check_numeric(v, check_mu(), sf=3, tolerance=tolerance),
    "check-unknown-sigma": lambda tex: check_rounded(tex, game_sigma(), sf=3),
    "ex-unknown-both": lambda tex: named_rounded(tex, bolts(), sf=3),
}

NUMERIC = {
    "before-normal-cdf": {"sf": 3},
    "check-z-direct": {"sf": 3},
    "check-below-sd": {"sf": 3},
    "check-unknown-mean": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
