"""SymPy assertions for IB Maths AI lesson 2.2 (function concepts, domain and range). Not shipped to the browser.

Why a sidecar: a range is written with the function's output, as the IB does (`3 \\le g(x) \\le 12`, `f(x) \\le 5`).
The declarative `inequality` kind compares one plain letter with numbers, and reads `g(x)` as the product g*x, so it
cannot check these. Here the output name (`g(x)`, `H(t)`, ...) is read as one unknown y and the published set must
EQUAL the true set (not just contain it). Truths come from SymPy's continuous_domain and function_range, applied to
each question's own rule and domain; a rounded end is checked to 3 s.f. (half-up). Only the ids in CHECKS come here;
every other block uses its own `verify` block.
"""
import re
import sys
from pathlib import Path

from sympy import EmptySet, Interval, Rational, S, Symbol, sqrt
from sympy.calculus.util import continuous_domain, function_range

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import parse_set, round_half_up  # noqa: E402

x, t = Symbol("x"), Symbol("t")


def same_set(published, truth):
    if published.complement(truth) != EmptySet or truth.complement(published) != EmptySet:
        raise AssertionError(f"published set {published} is not {truth}")


def body(tex):
    return tex.strip().strip("$").strip()


def output_set(tex, name):
    """The set described by a range written with the output `name`, e.g. `3 \\le g(x) \\le 12`."""
    if name not in tex:
        raise AssertionError(f"{tex!r} does not describe the outputs {name}")
    return parse_set(body(tex).replace(name, "y"), var="y")


def split_domain_range(tex):
    m = re.fullmatch(r"\\text\{domain: \}(.+?),\s*\\quad\s*\\text\{range: \}(.+?)", body(tex))
    if not m:
        raise AssertionError(f"cannot split {tex!r} into domain and range")
    return m.group(1), m.group(2)


def domain_and_range(tex, rule, var, given_domain, name):
    """`\\text{domain: } ..., \\quad \\text{range: } ...`. With no given domain, the domain is where the rule is real."""
    dom_tex, ran_tex = split_domain_range(tex)
    dom = given_domain if given_domain is not None else continuous_domain(rule, var, S.Reals)
    same_set(parse_set(dom_tex, var=var.name), dom)
    same_set(output_set(ran_tex, name), function_range(rule, var, dom))


def range_on(tex, rule, var, dom, name):
    same_set(output_set(tex, name), function_range(rule, var, dom))


# ex-domain-range-root: f(x) = 5 - sqrt(x + 3), no domain given.
ROOT = 5 - sqrt(x + 3)

# ex-balloon-model: H(t) = 850 - 12.5t until it lands (H = 0).
BALLOON = 850 - Rational(25, 2) * t
BALLOON_DOMAIN = Interval(0, 850 / Rational(25, 2))

# ex-greenhouse-range: T(t) = 0.04t^3 - 0.9t^2 + 5.4t + 12, 0 <= t <= 14.
GREENHOUSE = Rational(4, 100) * t**3 - Rational(9, 10) * t**2 + Rational(54, 10) * t + 12


def greenhouse_range(tex):
    """Lower end exact (T(0) = 12 is the least value on [0, 14]); upper end the maximum rounded half-up to 3 s.f."""
    exact = function_range(GREENHOUSE, t, Interval(0, 14))
    published = output_set(tex, "T(t)")
    if not isinstance(published, Interval) or published.left_open or published.right_open:
        raise AssertionError(f"{published} is not one closed interval")
    if published.inf != exact.inf:
        raise AssertionError(f"lower end {published.inf} is not {exact.inf}")
    rounded = round_half_up(exact.sup, sf=3)
    if Rational(str(published.sup)) != Rational(str(rounded)) or str(rounded) not in tex:
        raise AssertionError(f"upper end {published.sup} is not the maximum {exact.sup.evalf()} to 3 s.f. ({rounded})")


CHECKS = {
    "ex-domain-range-root": lambda tex: domain_and_range(tex, ROOT, x, None, "f(x)"),
    # g(x) = x^2 - 4x + 7 on 0 <= x <= 5.
    "ex-range-restricted": lambda tex: range_on(tex, x**2 - 4 * x + 7, x, Interval(0, 5), "g(x)"),
    # h(x) = 10 - (x - 3)^2 on 1 <= x <= 6.
    "check-range-ends": lambda tex: range_on(tex, 10 - (x - 3) ** 2, x, Interval(1, 6), "h(x)"),
    "ex-balloon-model": lambda tex: domain_and_range(tex, BALLOON, t, BALLOON_DOMAIN, "H(t)"),
    "ex-greenhouse-range": greenhouse_range,
}

NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
