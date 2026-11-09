"""SymPy assertions for IB Maths AI lesson 5.2 (increasing and decreasing functions). Not shipped to the browser.

Why a sidecar: ex-gdc-reservoir publishes an interval whose end points are GDC values rounded to 3 s.f. The declarative
`inequality` kind compares sets exactly, so it cannot accept rounded end points. Here the true end points are the exact
roots of V'(t) (SymPy), each rounded half-up to 3 s.f., and the published set must EQUAL the set where V'(t) < 0 inside
the model's domain 0 <= t <= 12 with those rounded ends. Only the ids in CHECKS come here; every other block uses its
own `verify` block.
"""
import sys
from pathlib import Path

from sympy import Interval, Rational, Symbol, Union, diff, oo, real_roots, Poly

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import check_same_set, round_half_up  # noqa: E402

t = Symbol("t", real=True)

# ex-gdc-reservoir: V(t) = 0.05t^3 - 0.9t^2 + 3.6t + 40, 0 <= t <= 12. Where is V decreasing?
RESERVOIR = Rational(5, 100) * t**3 - Rational(9, 10) * t**2 + Rational(36, 10) * t + 40
DOMAIN = Interval(0, 12)


def rounded_sign_set(tex, model, var, domain, negative, sf=3):
    """The published set is where model' < 0 (negative=True) or > 0 inside `domain`, with every end point that is a
    root of model' rounded half-up to sf; ends of the domain stay exact. Each piece's sign is tested at its midpoint."""
    derivative = diff(model, var)
    roots = sorted(r for r in real_roots(Poly(derivative, var)) if domain.contains(r))
    edges = [domain.inf] + roots + [domain.sup]
    pieces = []
    for low, high in zip(edges, edges[1:]):
        value = derivative.subs(var, (low + high) / 2).evalf()
        if (value < 0) == negative and value != 0:
            ends = [e if e in (domain.inf, domain.sup) or e in (-oo, oo) else Rational(str(round_half_up(e.evalf(30), sf)))
                    for e in (low, high)]
            pieces.append(Interval(ends[0], ends[1], left_open=low != domain.inf, right_open=high != domain.sup))
    check_same_set(tex, Union(*pieces), var=var.name)


CHECKS = {
    "ex-gdc-reservoir": lambda tex: rounded_sign_set(tex, RESERVOIR, t, DOMAIN, negative=True),
}

NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
