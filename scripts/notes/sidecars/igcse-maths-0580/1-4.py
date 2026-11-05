"""SymPy assertions for 0580 lesson 1.4 (fractions, decimals and percentages). Not shipped to the browser.

Only the answers written in recurring-decimal notation need a sidecar: no verify kind reads dot or bar notation
(`0.41\\dot{6}`, `0.\\dot{3}\\dot{6}`, `0.\\overline{516}`). `recurring` reads the published right-hand side as a
decimal whose repeating block is marked by one dot (one digit), two dots (first and last digit of the block) or a bar,
works out its exact value, and compares it with the fraction in the question. The repeating block must end the
decimal. A plain decimal that stops is read as it stands, so `0.36` for 4/11 is rejected as wrong, not unreadable.
Everything else in the lesson uses its declarative `verify` block.
"""
import re
import sys
from pathlib import Path

from sympy import Integer, Rational

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import _strip_decorations  # noqa: E402

TOKEN = re.compile(r"\\dot\s*\{\s*(\d)\s*\}|\\overline\s*\{\s*(\d+)\s*\}|(\d)")


def read_recurring(tex):
    """Exact value of a decimal in recurring notation (or a plain terminating decimal)."""
    cleaned = _strip_decorations(tex)
    rhs = cleaned.split("=")[-1].strip()
    match = re.fullmatch(r"(\d+)\.(.+)", rhs.replace(" ", ""))
    if not match:
        raise ValueError(f"no decimal at the end of {tex!r} (read {rhs!r})")
    whole, rest = match.group(1), match.group(2)
    digits, marks, bar, position = [], [], None, 0
    for token in TOKEN.finditer(rest):
        if token.start() != position:
            raise ValueError(f"cannot read {rest!r} in {tex!r}")
        position = token.end()
        dotted, overlined, plain = token.groups()
        if dotted:
            marks.append(len(digits))
            digits.append(dotted)
        elif overlined:
            if bar is not None or marks:
                raise ValueError(f"{tex!r} mixes or repeats recurring marks")
            bar = (len(digits), len(digits) + len(overlined) - 1)
            digits.extend(overlined)
        else:
            digits.append(plain)
    if position != len(rest):
        raise ValueError(f"cannot read {rest!r} in {tex!r}")
    if bar is not None:
        start, end = bar
    elif len(marks) == 1:
        start = end = marks[0]
    elif len(marks) == 2:
        start, end = marks
    elif not marks:
        return Integer(whole) + Rational(int("".join(digits)), 10 ** len(digits))
    else:
        raise ValueError(f"{tex!r} has {len(marks)} dots; mark only the first and last digit of the block")
    if end != len(digits) - 1:
        raise AssertionError(f"{tex!r}: the repeating block must end the decimal")
    fixed, block = "".join(digits[:start]), "".join(digits[start:end + 1])
    head = Rational(int(fixed or "0"), 10 ** len(fixed))
    tail = Rational(int(block), (10 ** len(block) - 1) * 10 ** len(fixed))
    return Integer(whole) + head + tail


def recurring(tex, truth):
    value = read_recurring(tex)
    if value != truth:
        raise AssertionError(f"{tex!r} is {value}, not {truth}")


CHECKS = {
    "ex-fraction-to-recurring": lambda tex: recurring(tex, Rational(5, 12)),
    "check-recurring-4-11": lambda tex: recurring(tex, Rational(4, 11)),
    "check-dot-notation": lambda tex: recurring(tex, Rational(3, 10) + Rational(4, 90)),
}
NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
