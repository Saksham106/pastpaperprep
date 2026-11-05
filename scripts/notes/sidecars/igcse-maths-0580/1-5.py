"""SymPy assertions for 0580 lesson 1.5 (ordering). Not shipped to the browser.

No verify kind checks ORDER or the truth of a comparison: `list` accepts any order, so it would pass a distractor that
lists the right numbers in the wrong order. Three helpers cover the lesson:

- `ordered` reads a chain such as `a < b < c`, checks every symbol is `<` (or `>` when the question asks for the largest
  first) and that the values appear in exactly the order the question's own numbers sort into.
- `relation` reads one statement `a ? b`, checks its two sides have the question's values and the symbol is true.
- `true_statement` reads one statement and checks the symbol is true (for "which statement is true?" checks).

Each expected order is computed here by sorting the question's numbers, never typed in. A term may be a fraction,
decimal, power, root, pi or a percentage (`38.5\\%`, read as 38.5/100). Everything else uses its `verify` block.
"""
import re
import sys
from pathlib import Path

from sympy import N, Rational, sqrt

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import _strip_decorations, parse_answer  # noqa: E402

RELATION = re.compile(r"(\\leqslant|\\geqslant|\\leq|\\geq|\\le|\\ge|\\neq|\\ne|<|>|=)(?![a-zA-Z])")
CANONICAL = {"\\leqslant": "<=", "\\leq": "<=", "\\le": "<=", "\\geqslant": ">=", "\\geq": ">=", "\\ge": ">=",
             "\\neq": "!=", "\\ne": "!=", "<": "<", ">": ">", "=": "="}
CLOSE = 10 ** -12


def value_of(term, tex):
    term = term.strip()
    if not term:
        raise ValueError(f"empty term in {tex!r}")
    percent = re.fullmatch(r"(.*?)\s*\\%", term)
    if percent:
        return N(parse_answer(f"${percent.group(1)}$") / 100, 50)
    return N(parse_answer(f"${term}$"), 50)


def chain(tex):
    """[values], [relations] of a published chain `a < b <= c`."""
    cleaned = _strip_decorations(tex)
    pieces = RELATION.split(cleaned)
    terms, relations = pieces[0::2], [CANONICAL[symbol] for symbol in pieces[1::2]]
    if not relations:
        raise ValueError(f"no comparison symbol in {tex!r}")
    return [value_of(term, tex) for term in terms], relations


def holds(a, relation, b):
    equal = abs(a - b) < CLOSE
    return {"<": a < b and not equal, ">": a > b and not equal, "<=": a < b or equal, ">=": a > b or equal,
            "=": equal, "!=": not equal}[relation]


def ordered(tex, numbers, largest_first=False):
    expected = sorted(numbers, key=lambda value: N(value, 50), reverse=largest_first)
    values, relations = chain(tex)
    want = ">" if largest_first else "<"
    if any(relation != want for relation in relations):
        raise AssertionError(f"{tex!r} should use only {want} between the numbers")
    if len(values) != len(expected):
        raise AssertionError(f"{tex!r} has {len(values)} numbers, {len(expected)} expected")
    for got, value in zip(values, expected):
        if abs(got - N(value, 50)) >= CLOSE:
            raise AssertionError(f"{tex!r} is not in order: expected {[str(v) for v in expected]}")


def relation(tex, left, right):
    values, relations = chain(tex)
    if len(values) != 2:
        raise ValueError(f"{tex!r} should compare exactly two quantities")
    if abs(values[0] - N(left, 50)) >= CLOSE or abs(values[1] - N(right, 50)) >= CLOSE:
        raise AssertionError(f"{tex!r} does not compare {left} with {right}")
    if not holds(values[0], relations[0], values[1]):
        raise AssertionError(f"{tex!r} is false")
    if relations[0] not in ("<", ">", "="):
        raise AssertionError(f"{tex!r}: use <, > or = as the question asks")


def true_statement(tex):
    values, relations = chain(tex)
    if len(values) != 2:
        raise ValueError(f"{tex!r} should compare exactly two quantities")
    if not holds(values[0], relations[0], values[1]):
        raise AssertionError(f"{tex!r} is false")


R = Rational
CHECKS = {
    "ex-symbol-both-sides": lambda tex: relation(tex, R(5, 10) * 18, 3**2),
    "check-not-equal": true_statement,
    "ex-order-decimals": lambda tex: ordered(tex, [R("0.408"), R("0.48"), R("0.0849"), R("0.4"), R("0.084")]),
    "ex-order-temperatures": lambda tex: ordered(tex, [R(-3), R(2), R("-7.5"), R(0), R("-3.5")]),
    "check-order-negatives": lambda tex: ordered(tex, [R("-0.6"), R(-6), R("0.06"), R("-0.06")], largest_first=True),
    "ex-order-fractions": lambda tex: ordered(tex, [R(7, 10), R(16, 25), R(33, 50), R(69, 100)]),
    "check-compare-fractions": lambda tex: relation(tex, R(5, 6), R(7, 9)),
    "ex-order-mixed": lambda tex: ordered(tex, [R("0.35"), R(1, 3), R(34, 100), R(3, 8)]),
    "ex-order-calculator": lambda tex: ordered(tex, [R(7, 18), R("0.39"), R("38.5") / 100, sqrt(R("0.15"))]),
    "check-true-statement": true_statement,
    "check-order-ninths": lambda tex: ordered(tex, [R(2, 9), R("0.2"), R(21, 100), R(1, 4)]),
}
NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
