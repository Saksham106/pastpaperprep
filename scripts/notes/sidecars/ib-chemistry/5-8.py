"""Equilibrium constant expressions for IB Chemistry 5.8 (no verify kind reads K = [..]/[..]).

CHECKS maps an example or check id to the equilibrium equation its question gives. verify(id, text) derives the
expected expression from that equation by the equilibrium law (products over reactants, each concentration raised to
its coefficient; the lesson only uses homogeneous equilibria, so every species is included) and compares the published expression with it:
  - the published text is K = \\frac{...}{...} (or \\dfrac), each part a product of [\\ce{species}]^{n} terms;
  - a coefficient written in front of a bracket (2[\\ce{NO}]) or a + between concentrations is wrong (AssertionError);
  - every species must carry exactly the expected power (an inverted expression or a missing power fails).
Text that cannot be read at all raises ValueError.
"""
import re
import sys
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import chemparse as cp  # noqa: E402

CHECKS = {
    "ex-k-nocl": r"\ce{2NO(g) + Cl2(g) <=> 2NOCl(g)}",
    "ex-k-ammonia-oxidation": r"\ce{4NH3(g) + 5O2(g) <=> 4NO(g) + 6H2O(g)}",
    "check-k-cs2": r"\ce{CH4(g) + 2H2S(g) <=> CS2(g) + 4H2(g)}",
    "check-k-thiocyanate": r"\ce{Fe^3+(aq) + SCN-(aq) <=> FeSCN^2+(aq)}",
}

_CE = r"\\ce\s*\{((?:[^{}]|\{[^{}]*\})*)\}"
_TERM = re.compile(r"(\d+(?:\.\d+)?)?\s*\[\s*" + _CE + r"\s*\]\s*(?:\^\s*(?:\{\s*(\d+)\s*\}|(\d)))?")


def expected_powers(equation):
    left, arrow, right = cp.parse_equation(equation)
    if arrow != "<=>":
        raise ValueError(f"{equation!r} is not an equilibrium")
    powers = {}
    for side, sign in ((left, -1), (right, 1)):
        for coefficient, formula, state, _ in side:
            powers[formula.key()] = powers.get(formula.key(), Fraction(0)) + sign * coefficient
    return powers


def _braced(text, start):
    """(content, end) of the {...} group opening at text[start]."""
    if start >= len(text) or text[start] != "{":
        raise ValueError(f"expected {{ at {start} in {text!r}")
    depth, i = 1, start + 1
    while i < len(text) and depth:
        depth += {"{": 1, "}": -1}.get(text[i], 0)
        i += 1
    if depth:
        raise ValueError(f"unbalanced braces in {text!r}")
    return text[start + 1: i - 1], i


def _part_powers(part, original):
    powers = {}

    def take(match):
        coefficient, species, braced, bare = match.groups()
        if coefficient:
            raise AssertionError(f"{original!r}: {coefficient} is written as a multiplier; a coefficient becomes a power")
        key = cp.parse_formula(species).key()
        powers[key] = powers.get(key, 0) + int(braced or bare or 1)
        return " "

    rest = _TERM.sub(take, part)
    rest = re.sub(r"\\(?:cdot|times|left|right)|\s", "", rest)
    if "+" in rest or "-" in rest:
        raise AssertionError(f"{original!r}: concentrations are multiplied in K, never added or subtracted")
    if rest not in ("", "1"):
        raise ValueError(f"cannot read {rest!r} in {original!r}")
    return powers


def published_powers(text):
    body = text.strip().strip("$")
    if "=" not in body:
        raise ValueError(f"{text!r}: write K = ...")
    lhs, rhs = body.rsplit("=", 1)
    if not re.fullmatch(r"\s*K(?:_\{?c\}?)?\s*", lhs):
        raise ValueError(f"{text!r}: the left side must be K")
    rhs = rhs.strip()
    frac = re.match(r"\\[dt]?frac\s*", rhs)
    if frac:
        numerator, end = _braced(rhs, frac.end())
        denominator, end = _braced(rhs, end)
        if rhs[end:].strip():
            raise ValueError(f"{text!r}: unexpected text after the fraction")
    else:
        numerator, denominator = rhs, ""
    powers = dict(_part_powers(numerator, text))
    for key, value in _part_powers(denominator, text).items():
        powers[key] = powers.get(key, 0) - value
    return powers


def verify(id_, value, tolerance=None):
    want = expected_powers(CHECKS[id_])
    got = published_powers(str(value))
    if set(got) != set(want):
        raise AssertionError(f"{value!r} has the wrong species")
    for key, power in want.items():
        if got[key] != power:
            raise AssertionError(f"{value!r}: a concentration has power {got[key]}, expected {power}")
