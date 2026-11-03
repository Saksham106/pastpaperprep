"""SymPy assertions for lesson 1.3 (Geometric sequences and series). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed here from the question's own data: terms are built by repeated multiplication (not from the
booklet formula), sums with SymPy's summation, unknowns with solve, and "least n" by testing whole numbers in turn.
Sigma-notation answers are read by a small parser below and compared term by term with the true terms.
"""
import re
import sys
from pathlib import Path

from sympy import Integer, Rational, S, Symbol, nsimplify, real_root, simplify, solve, summation, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_assignments, check_numeric, check_rounded, parse_answer, parse_list  # noqa: E402

k, n, u, r = symbols("k n u r")  # mathparse returns plain symbols


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def same_exact_decimals(tex, truth):
    """Like `same`, but the published decimals (1.2, 0.85) are read as the exact rationals they denote."""
    published = nsimplify(parse_answer(tex), rational=True)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def terms(first, ratio, count):
    """The first `count` terms, built by multiplying by the ratio once per step."""
    out, term = [], S(first)
    for _ in range(count):
        out.append(term)
        term = term * ratio
    return out


def values(tex):
    """One value or several (`r = \\pm 3`), as a sorted list."""
    try:
        found = parse_list(tex)
    except ValueError:
        found = [parse_answer(tex)]  # parse_list refuses a single answer; read it as a list of one
    return sorted(found, key=lambda v: float(v))


def same_values(tex, truth):
    published, truth = values(tex), sorted(truth, key=lambda v: float(v))
    if len(published) != len(truth) or any(simplify(a - b) != 0 for a, b in zip(published, truth)):
        raise AssertionError(f"published {published}, truth {truth}")


SIGMA = re.compile(r"\\sum_\{\s*([a-z])\s*=\s*(-?\d+)\s*\}\^\{\s*(-?\d+)\s*\}(.+)$")


def sigma_terms(tex):
    """Terms of a published `\\sum_{k=a}^{b} expr`, the last thing in the maths."""
    body = tex.strip().strip("$").strip()
    start = body.rfind("\\sum_")
    match = SIGMA.match(body[start:]) if start >= 0 else None
    if not match:
        raise ValueError(f"cannot read sigma notation in {tex!r}")
    counter, low, high, summand = match.groups()
    expr = parse_answer(summand)
    return [expr.subs(Symbol(counter), i) for i in range(int(low), int(high) + 1)]


def same_terms(tex, truth):
    published = sigma_terms(tex)
    if len(published) != len(truth) or any(simplify(a - b) != 0 for a, b in zip(published, truth)):
        raise AssertionError(f"published terms {published} are not {truth}")


def is_geometric(seq):
    if any(t == 0 for t in seq):
        return False
    ratios = {simplify(b / a) for a, b in zip(seq, seq[1:])}
    return len(ratios) == 1


def geometric_option(tex):
    """The published list must be the geometric one (constant ratio between all consecutive terms)."""
    seq = parse_list(tex)
    if len(seq) < 3:
        raise ValueError(f"too few terms in {tex!r}")
    if not is_geometric(seq):
        raise AssertionError(f"{seq} is not geometric")


def terms_to_last(first, ratio, last):
    """Terms from `first` up to and including `last`; the count comes from solving first * ratio^(m-1) = last."""
    m = symbols("m")
    count = [c for c in solve(first * ratio ** (m - 1) - last, m) if c.is_integer and c > 0]
    if len(count) != 1:
        raise RuntimeError(f"{last} is not a term")
    return terms(first, ratio, int(count[0]))


def least_n(condition, start=1, stop=500):
    for m in range(start, stop):
        if condition(m):
            return m
    raise RuntimeError("no n found")


def model_word(tex, data):
    """Word answer: 'Arithmetic, with $d = …$' or 'Geometric, with $r = …$', checked against the data's own pattern."""
    match = re.fullmatch(r"\s*(Arithmetic|Geometric), with \$([dr]) = ([^$]+)\$\s*", tex)
    if not match:
        raise ValueError(f"cannot read model option {tex!r}")
    kind, letter, value = match.groups()
    diffs = {b - a for a, b in zip(data, data[1:])}
    ratios = {Rational(b) / a for a, b in zip(data, data[1:])}
    if len(ratios) == 1 and len(diffs) > 1:
        truth_kind, truth_letter, truth_value = "Geometric", "r", ratios.pop()
    elif len(diffs) == 1 and len(ratios) > 1:
        truth_kind, truth_letter, truth_value = "Arithmetic", "d", diffs.pop()
    else:
        raise RuntimeError("data fits neither model exactly")
    if (kind, letter) != (truth_kind, truth_letter) or simplify(parse_answer(f"${value}$") - truth_value) != 0:
        raise AssertionError(f"published {kind} {letter} = {value}, truth {truth_kind} {truth_letter} = {truth_value}")


# --- truths ---------------------------------------------------------------------------------------------------------

def nth_term_from_two():
    """u1 r^3 = 54 and u1 r^6 = 1458, solved over the reals."""
    sols = [s for s in solve([u * r**3 - 54, u * r**6 - 1458], [u, r], dict=True) if s[r].is_real]
    if len(sols) != 1:
        raise RuntimeError(f"expected one real solution, got {sols}")
    return {"r": sols[0][r], "u_{1}": sols[0][u]}


def ratios_from_even_gap():
    """u1 r = 6 and u1 r^3 = 54: every real r."""
    return [s[r] for s in solve([u * r - 6, u * r**3 - 54], [u, r], dict=True) if s[r].is_real]


def sum_find_first():
    return solve(sum(terms(u, 2, 10)) - 3069, u)[0]


def cases_week():
    weekly = lambda m: sum(terms(40, Rational(8, 5), m))
    return least_n(lambda m: weekly(m) > 10000)


def model_to_sequence(model, first):
    """u_n = model(n - 1): t starts at 0 and n at 1. The model must give the stated first term at t = 0."""
    if simplify(model(0) - first) != 0:
        raise RuntimeError(f"model(0) = {model(0)}, expected u_1 = {first}")
    return model(n - 1)


def bees(t):
    return 1500 * Rational(6, 5) ** t  # P(t) = 1500 * 1.2^t


def medicine(t):
    return 900 * Rational(17, 20) ** t  # A(t) = 900 * 0.85^t


def data_day8():
    """Ratio estimated from u1 = 200 and u5 = 425 (r^4 = 425/200), then three more steps from day 5."""
    est = real_root(Rational(425, 200), 4)
    return 425 * est**3


CHECKS = {
    # before you start
    "before-arith-nth-term": lambda v, tolerance: check_numeric(v, 7 + 4 * 14, sf=3, tolerance=tolerance),
    "before-sigma-arith": lambda v, tolerance: check_numeric(v, summation(2 * k + 1, (k, 1, 5)), sf=3, tolerance=tolerance),
    # nth term
    "check-which-geometric": geometric_option,
    "ex-nth-term-alternating": lambda tex: same(tex, terms(3, -2, 9)[-1]),
    "check-sixth-term": lambda tex: same(tex, terms(48, Rational(24, 48), 6)[-1]),
    "ex-two-terms": lambda tex: check_assignments(tex, nth_term_from_two()),
    "check-even-power-ratio": lambda tex: same_values(tex, ratios_from_even_gap()),
    # sum
    "ex-sum-whole-ratio": lambda tex: same(tex, sum(terms(4, 3, 8))),
    "ex-sum-fraction-ratio": lambda tex: same(tex, sum(terms(64, Rational(48, 64), 6))),
    "check-sum-find-first": lambda v, tolerance: check_numeric(v, sum_find_first(), sf=3, tolerance=tolerance),
    "check-sum-negative-ratio": lambda tex: same(tex, sum(terms(5, Rational(-10, 5), 6))),
    # sigma
    "ex-sigma-write": lambda tex: same_terms(tex, terms_to_last(7, Rational(14, 7), 1792)),
    "check-sigma-write": lambda tex: same_terms(tex, terms_to_last(5, Rational(15, 5), 3645)),
    "ex-sigma-start-three": lambda tex: same(tex, summation(2**k, (k, 3, 10))),
    "check-sigma-evaluate": lambda v, tolerance: check_numeric(v, summation(3 * 2**k, (k, 2, 6)), sf=3, tolerance=tolerance),
    # applications
    "check-identify-ratio": lambda tex: same(tex, Rational(275, 250)),
    "ex-salary-year": lambda tex: check_rounded(tex, terms(38500, Rational(1025, 1000), 12)[-1], dp=0, unit="euros"),
    "ex-cases-total": lambda tex: same(tex, Integer(cases_week())),
    # start of 2020 is u1; start of 2030 is ten falls later
    "check-population": lambda tex: check_rounded(tex, terms(8400, Rational(965, 1000), 11)[-1], dp=0),
    # models
    "ex-model-to-sequence": lambda tex: same_exact_decimals(tex, model_to_sequence(bees, 1500)),
    "check-model-sequence": lambda tex: same_exact_decimals(tex, model_to_sequence(medicine, 900)),
    "ex-data-estimate": lambda tex: check_rounded(tex, data_day8(), sf=3),
    "check-arith-or-geom": lambda tex: model_word(tex, [64, 80, 100, 125]),
}

NUMERIC = {
    "before-arith-nth-term": {"sf": 3},
    "before-sigma-arith": {"sf": 3},
    "check-sum-find-first": {"sf": 3},
    "check-sigma-evaluate": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
