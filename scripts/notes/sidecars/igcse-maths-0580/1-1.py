"""SymPy assertions for 0580 lesson 1.1 (types of number). Not shipped to the browser.

Only the "product of prime factors" answers need a sidecar: no verify kind checks FORM for a product of numbers, so
`exact` would accept 2^3 x 75 for 600. `prime_product` checks the published right-hand side is a product of factors
p or p^k, every base p prime and every power k a whole number of at least 1, and that its value equals the number in
the question. Everything else in the lesson uses its declarative `verify` block.
"""
import re
import sys
from pathlib import Path

from sympy import Integer, isprime

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import _strip_decorations, parse_answer  # noqa: E402

FACTOR = re.compile(r"(\d+)(?:\s*\^\s*\{?\s*(\d+)\s*\}?)?")


def prime_product(tex, truth):
    cleaned = _strip_decorations(tex)
    rhs = cleaned.split("=")[-1].strip()
    pieces = [piece.strip() for piece in re.split(r"\\times|\\cdot|×", rhs)]
    if not pieces or any(not piece for piece in pieces):
        raise ValueError(f"cannot read a product in {tex!r}")
    value = Integer(1)
    for piece in pieces:
        match = FACTOR.fullmatch(piece)
        if not match:
            parse_answer(f"${piece}$")  # unreadable text raises ValueError; readable text is the wrong form
            raise AssertionError(f"{piece!r} in {tex!r} is not a prime or a power of a prime")
        base, power = Integer(match.group(1)), Integer(match.group(2) or 1)
        if not isprime(base):
            raise AssertionError(f"{base} in {tex!r} is not prime")
        if power < 1:
            raise AssertionError(f"power {power} in {tex!r} is not a positive whole number")
        value *= base**power
    if value != truth:
        raise AssertionError(f"{tex!r} is {value}, not {truth}")


CHECKS = {
    "ex-prime-factors-360": lambda tex: prime_product(tex, Integer(360)),
    "check-prime-factors-600": lambda tex: prime_product(tex, Integer(600)),
}
NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
