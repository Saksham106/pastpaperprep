"""SymPy assertions for lesson 4.9 (Normal distribution). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Normal probabilities are computed exactly from the cumulative distribution function written with erf,
P(X < b) = (1 + erf((b - mu) / (sigma sqrt 2))) / 2, and inverse normal values from erfinv, so no GDC value is typed in.
Paper 1 items that use symmetry or the 68-95-99.7 rule are checked against the rule's own values, computed from the
question's data (the rule is what those questions examine, not the exact normal area).
"""
import sys
from pathlib import Path

from sympy import Rational, erf, erfinv, simplify, sqrt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, check_rounded_list, parse_answer  # noqa: E402

R = Rational


def cdf(b, mu, sigma):
    """P(X < b) for X ~ N(mu, sigma^2), exact."""
    return (1 + erf((b - mu) / (sigma * sqrt(2)))) / 2


def inv(p, mu, sigma):
    """The k with P(X < k) = p for X ~ N(mu, sigma^2)."""
    k = mu + sigma * sqrt(2) * erfinv(2 * p - 1)
    # Independent property check: feeding k back through the cdf returns p.
    assert abs((cdf(k, mu, sigma) - p).evalf(30)) < 1e-20
    return k


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


# Rule values (68-95-99.7), exact.
ONE, TWO, THREE = R(68, 100), R(95, 100), R(997, 1000)


def symmetry_tomato():
    """ex-curve-symmetry: P(H < 38) = P(H > 54) = 0.12, so mu is the midpoint and P(38 < H < mu) = (1 - 2(0.12)) / 2."""
    mu = R(38 + 54, 2)
    assert mu == 46  # the question's upper bound is the mean
    return (1 - 2 * R(12, 100)) / 2


def tail_symmetry():
    """check-tail-symmetry: 69 and 81 are equidistant from 75, so P(X < 69) = 0.3 and P(69 < X < 75) = 0.5 - 0.3."""
    assert 75 - 69 == 81 - 75
    return R(1, 2) - R(3, 10)


def pear_count():
    """ex-rule-count: 138 = mu - sigma, 174 = mu + 2 sigma for N(150, 12^2); 600 x (0.68/2 + 0.95/2)."""
    mu, sigma = 150, 12
    assert 138 == mu - sigma and 174 == mu + 2 * sigma
    return 600 * (ONE / 2 + TWO / 2)


def pear_within():
    """ex-rule-within: 126 and 174 are mu -/+ 2 sigma, so the rule gives 0.95 (the rule's own 2 s.f.)."""
    assert 126 == 150 - 2 * 12 and 174 == 150 + 2 * 12
    return TWO


def battery_sigma():
    """check-rule-sigma: 95% within mu +/- 2 sigma, interval [410, 490]."""
    mu = R(410 + 490, 2)
    return (490 - mu) / 2


def rule_tail():
    """check-rule-tail: 14 = 20 - 3(2) = mu - 3 sigma, so each tail holds (1 - 0.997) / 2."""
    assert 14 == 20 - 3 * 2
    return (1 - THREE) / 2


def parcel_conditional():
    """ex-gdc-conditional: {W < 2} lies inside {W < 2.5}, so the overlap is W < 2."""
    return cdf(2, R(23, 10), R(4, 10)) / cdf(R(5, 2), R(23, 10), R(4, 10))


def paint_conditional():
    """check-gdc-conditional: {V > 3.5} lies inside {V > 3}."""
    mu, sigma = R(32, 10), R(25, 100)
    return (1 - cdf(R(35, 10), mu, sigma)) / (1 - cdf(3, mu, sigma))


def central_c():
    """check-inverse-central: P(12 - c < X < 12 + c) = 0.8, each tail 0.1, so 12 + c has area 0.9 to its left."""
    return inv(R(9, 10), 12, R(3, 2)) - 12


CHECKS = {
    "before-sd-from-variance": lambda v, tolerance: check_numeric(v, sqrt(36), sf=3, tolerance=tolerance),
    "before-conditional": lambda tex: same(tex, R(12, 100) / R(4, 10)),
    "before-sum-to-one": lambda v, tolerance: check_numeric(v, 1 - R(2, 10) - R(45, 100), sf=3, tolerance=tolerance),
    # Symmetry: P(M >= mu) = P(M > mu) = 1 - P(M < mu), computed from the cdf at the mean.
    "ex-curve-half": lambda tex: same(tex, 1 - cdf(62, 62, 5)),
    # A single value of a continuous variable: P(L = 40) = P(L < 40) - P(L <= 40) = cdf(40) - cdf(40) = 0.
    "check-point-prob": lambda tex: same(tex, cdf(40, 40, 3) - cdf(40, 40, 3)),
    "ex-curve-symmetry": lambda tex: same(tex, symmetry_tomato()),
    "check-tail-symmetry": lambda v, tolerance: check_numeric(v, tail_symmetry(), sf=3, tolerance=tolerance),
    "ex-rule-within": lambda tex: check_rounded(tex, pear_within(), sf=2),
    "ex-rule-count": lambda tex: check_rounded(tex, pear_count(), sf=3),
    "check-rule-sigma": lambda v, tolerance: check_numeric(v, battery_sigma(), sf=3, tolerance=tolerance),
    "check-rule-tail": lambda tex: same(tex, rule_tail()),
    "ex-gdc-between": lambda tex: check_rounded(tex, cdf(55, 48, 7) - cdf(40, 48, 7), sf=3),
    "check-gdc-above": lambda v, tolerance: check_numeric(v, 1 - cdf(35, R(315, 10), R(28, 10)), sf=3, tolerance=tolerance),
    "ex-gdc-conditional": lambda tex: check_rounded(tex, parcel_conditional(), sf=3),
    "check-gdc-conditional": lambda tex: check_rounded(tex, paint_conditional(), sf=3),
    "ex-inverse-left": lambda tex: check_rounded(tex, inv(R(15, 100), 58, 11), sf=3),
    "ex-inverse-right": lambda tex: check_rounded(tex, inv(1 - R(2, 100), 507, 4), sf=3),
    "ex-inverse-central": lambda tex: check_rounded_list(tex, [inv(R(15, 100), 84, 9), inv(R(85, 100), 84, 9)], sf=3),
    "check-inverse-tail": lambda tex: check_rounded(tex, inv(1 - R(3, 10), 40, 5), sf=3),
    "check-inverse-central": lambda v, tolerance: check_numeric(v, central_c(), sf=3, tolerance=tolerance),
}

NUMERIC = {
    "before-sd-from-variance": {"sf": 3},
    "before-sum-to-one": {"sf": 3},
    "check-tail-symmetry": {"sf": 3},
    "check-rule-sigma": {"sf": 3},
    "check-gdc-above": {"sf": 3},
    "check-inverse-central": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
