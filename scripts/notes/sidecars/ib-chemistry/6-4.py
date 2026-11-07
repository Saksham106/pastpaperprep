"""Ka and Kb expressions for IB Chemistry 6.4 (no verify kind reads K = [..]/[..]). Not shipped to the browser.

Adapted from 5-8.py. CHECKS maps an example or check id to (subscript, equation): the K the question asks for ("a" or
"b") and the acid-base equilibrium its question gives. verify(id, text) derives the expected expression from that
equation by the equilibrium law (products over reactants, each concentration raised to its coefficient), leaving out
water, the solvent, whose concentration is effectively constant and is part of Ka and Kb. It then compares:
  - the published text is K_a = \\frac{...}{...} (or K_\\mathrm{b}, \\dfrac ...), each part a product of [\\ce{species}]
    terms, optionally with a power;
  - the left side must name the K asked for (a Kb written for a Ka question is wrong);
  - [\\ce{H2O}] anywhere, a coefficient written as a multiplier, or a + between concentrations is wrong (AssertionError);
  - every species must carry exactly the expected power (an inverted expression fails).
Text that cannot be read at all raises ValueError.
Everything else in the lesson uses its declarative `verify` block.
"""
import re
import sys
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import mathparse  # noqa: E402,F401  (kept for the shared sidecar contract)
import chemparse as cp  # noqa: E402

CHECKS = {
    "ex-kb-methylamine": ("b", r"\ce{CH3NH2(aq) + H2O(l) <=> CH3NH3^+(aq) + OH^-(aq)}"),
    "check-ka-ammonium": ("a", r"\ce{NH4^+(aq) + H2O(l) <=> NH3(aq) + H3O^+(aq)}"),
}

WATER = cp.parse_formula("H2O").key()
_CE = r"\\ce\s*\{((?:[^{}]|\{[^{}]*\})*)\}"
_TERM = re.compile(r"(\d+(?:\.\d+)?)?\s*\[\s*" + _CE + r"\s*\]\s*(?:\^\s*(?:\{\s*(\d+)\s*\}|(\d)))?")
_LHS = re.compile(r"\s*K_\s*(?:\{\s*)?(?:\\mathrm\s*\{\s*([a-z])\s*\}|([a-z]))(?:\s*\})?\s*")


def expected_powers(equation):
    left, arrow, right = cp.parse_equation(equation)
    if arrow != "<=>":
        raise ValueError(f"{equation!r} is not an equilibrium")
    powers = {}
    for side, sign in ((left, -1), (right, 1)):
        for coefficient, formula, state, _ in side:
            if formula.key() == WATER:
                continue  # the solvent: its concentration is part of Ka / Kb
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


def published(text):
    """(subscript, powers) of a published K_a / K_b expression."""
    body = str(text).strip().strip("$")
    if "=" not in body:
        raise ValueError(f"{text!r}: write K_a = ... or K_b = ...")
    lhs, rhs = body.rsplit("=", 1)
    match = _LHS.fullmatch(lhs)
    if not match:
        raise ValueError(f"{text!r}: the left side must be K_a or K_b")
    subscript = match.group(1) or match.group(2)
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
    return subscript, powers


def verify(id_, value, tolerance=None):
    subscript, equation = CHECKS[id_]
    want = expected_powers(equation)
    got_subscript, got = published(value)
    if got_subscript != subscript:
        raise AssertionError(f"{value!r} is K_{got_subscript}; the question asks for K_{subscript}")
    if WATER in got:
        raise AssertionError(f"{value!r} includes water, the solvent; leave it out of K_{subscript}")
    if set(got) != set(want):
        raise AssertionError(f"{value!r} has the wrong species")
    for key, power in want.items():
        if got[key] != power:
            raise AssertionError(f"{value!r}: a concentration has power {got[key]}, expected {power}")
