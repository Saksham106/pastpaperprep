"""Indicator Ka expressions for IB Chemistry 6.6 (no verify kind reads K = [..]/[..]). Not shipped to the browser.

Adapted from 6-4.py. The guide writes a general indicator as HInd, which chemparse cannot read as a formula (Ind is
not an element), so species are compared as normalized mhchem text instead of parsed formulas. CHECKS maps an example
or check id to the expected powers of each species in K_a, derived by the equilibrium law from the equilibrium its
question gives (products over reactants, each to its coefficient, water left out as the solvent). verify(id, text):
  - the published text is K_a = \\frac{...}{...} (or \\dfrac, K_\\mathrm{a}), each part a product of [\\ce{species}]
    terms, optionally with a power;
  - the left side must be K_a;
  - [\\ce{H2O}] anywhere, a coefficient written as a multiplier, or a + between concentrations is wrong (AssertionError);
  - every species must carry exactly the expected power (an inverted expression fails).
Text that cannot be read at all raises ValueError.
Everything else in the lesson uses its declarative `verify` block.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import mathparse  # noqa: E402,F401  (kept for the shared sidecar contract)

# id -> (equation the question gives, {species: power in K_a})
CHECKS = {
    "ex-ka-hind-hydronium": (
        r"\ce{HInd(aq) + H2O(l) <=> H3O^+(aq) + Ind^-(aq)}",
        {"H3O^+": 1, "Ind^-": 1, "HInd": -1},
    ),
    "check-ka-hind": (
        r"\ce{HInd(aq) <=> H^+(aq) + Ind^-(aq)}",
        {"H^+": 1, "Ind^-": 1, "HInd": -1},
    ),
}

_CE = r"\\ce\s*\{((?:[^{}]|\{[^{}]*\})*)\}"
_TERM = re.compile(r"(\d+(?:\.\d+)?)?\s*\[\s*" + _CE + r"\s*\]\s*(?:\^\s*(?:\{\s*(\d+)\s*\}|(\d)))?")
_LHS = re.compile(r"\s*K_\s*(?:\{\s*)?(?:\\mathrm\s*\{\s*([a-z])\s*\}|([a-z]))(?:\s*\})?\s*")


def normalize(species):
    """mhchem species text -> canonical key: no spaces, charges written with a caret (H+ -> H^+, Ind- -> Ind^-)."""
    s = re.sub(r"\s", "", species)
    s = re.sub(r"\(aq\)|\(l\)|\(g\)|\(s\)$", "", s)
    s = re.sub(r"(?<!\^)([+-])$", r"^\1", s)
    s = s.replace("^{+}", "^+").replace("^{-}", "^-")
    return s


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
        key = normalize(species)
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
    """(subscript, powers) of a published K_a expression."""
    body = str(text).strip().strip("$")
    if "=" not in body:
        raise ValueError(f"{text!r}: write K_a = ...")
    lhs, rhs = body.rsplit("=", 1)
    match = _LHS.fullmatch(lhs)
    if not match:
        raise ValueError(f"{text!r}: the left side must be K_a")
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
    _equation, want = CHECKS[id_]
    got_subscript, got = published(value)
    if got_subscript != "a":
        raise AssertionError(f"{value!r} is K_{got_subscript}; the question asks for K_a")
    if "H2O" in got:
        raise AssertionError(f"{value!r} includes water, the solvent; leave it out of K_a")
    if set(got) != set(want):
        raise AssertionError(f"{value!r} has the wrong species")
    for key, power in want.items():
        if got[key] != power:
            raise AssertionError(f"{value!r}: a concentration has power {got[key]}, expected {power}")
