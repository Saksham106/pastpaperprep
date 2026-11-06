"""Rate equations deduced from a mechanism for IB Chemistry 5.5 (no verify kind reads rate = k[..][..]).

CHECKS maps an example or check id to the mechanism its question gives: a list of (step equation, "slow" | "fast").
verify(id, text) derives the expected rate equation from that mechanism by the rate-determining-step rule and compares
the published one with it:
  - the slow step is the rate-determining step; each of its reactants is raised to its coefficient in that step;
  - a reactant of the slow step that is made in an earlier fast equilibrium (<=>) is an intermediate: it is replaced by
    the reactants of that equilibrium, each power scaled by (its coefficient / the intermediate's coefficient). The
    lesson only uses equilibria whose sole product is the intermediate, so no inverse powers arise (others raise
    ValueError);
  - species that react only after the slow step do not appear.
The published text is rate = k[\\ce{A}]^{m}[\\ce{B}]... (\\text{rate} allowed); a coefficient written as a multiplier, a
+ between concentrations, a missing or extra species or a wrong power fails (AssertionError). Text that cannot be read
raises ValueError.
"""
import re
import sys
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import chemparse as cp  # noqa: E402

CHECKS = {
    "ex-rate-from-mechanism": [
        (r"\ce{2NO <=> N2O2}", "fast"),
        (r"\ce{N2O2 + H2 -> N2O + H2O}", "slow"),
        (r"\ce{N2O + H2 -> N2 + H2O}", "fast"),
    ],
    "check-rate-equation-no-o2": [
        (r"\ce{NO + O2 <=> NO3}", "fast"),
        (r"\ce{NO3 + NO -> 2NO2}", "slow"),
    ],
}

_CE = r"\\ce\s*\{((?:[^{}]|\{[^{}]*\})*)\}"
_TERM = re.compile(r"(\d+(?:\.\d+)?)?\s*\[\s*" + _CE + r"\s*\]\s*(?:\^\s*(?:\{\s*(\d+)\s*\}|(\d)))?")


def _reactants(side):
    out = {}
    for coefficient, formula, _, _ in side:
        out[formula.key()] = out.get(formula.key(), Fraction(0)) + coefficient
    return out


def expected_orders(steps):
    parsed = [(cp.parse_equation(equation), speed) for equation, speed in steps]
    slow = [i for i, (_, speed) in enumerate(parsed) if speed == "slow"]
    if len(slow) != 1:
        raise ValueError("a mechanism needs exactly one slow step")
    (left, _, _), _ = parsed[slow[0]]
    orders = _reactants(left)
    changed = True
    while changed:
        changed = False
        for key in list(orders):
            for (step_left, arrow, step_right), _ in parsed[: slow[0]]:
                made = _reactants(step_right)
                if key not in made:
                    continue
                if arrow != "<=>" or len(made) != 1:
                    raise ValueError("an intermediate must come from a fast equilibrium whose only product it is")
                power = orders.pop(key) / made[key]
                for other, coefficient in _reactants(step_left).items():
                    orders[other] = orders.get(other, Fraction(0)) + power * coefficient
                changed = True
                break
            if changed:
                break
    return orders


def published_orders(text):
    body = text.strip().strip("$")
    if "=" not in body:
        raise ValueError(f"{text!r}: write rate = k[...]")
    lhs, rhs = body.split("=", 1)
    if not re.fullmatch(r"\s*(?:\\text\s*\{\s*rate\s*\}|rate)\s*", lhs):
        raise ValueError(f"{text!r}: the left side must be rate")
    rhs = rhs.strip()
    if not rhs.startswith("k"):
        raise ValueError(f"{text!r}: the right side must start with k")
    orders = {}

    def take(match):
        coefficient, species, braced, bare = match.groups()
        if coefficient:
            raise AssertionError(f"{text!r}: {coefficient} is written as a multiplier; an order is a power")
        key = cp.parse_formula(species).key()
        orders[key] = orders.get(key, 0) + int(braced or bare or 1)
        return " "

    rest = _TERM.sub(take, rhs[1:])
    rest = re.sub(r"\\(?:cdot|times|left|right)|\s", "", rest)
    if "+" in rest or "-" in rest:
        raise AssertionError(f"{text!r}: concentrations are multiplied in a rate equation, never added")
    if rest:
        raise ValueError(f"cannot read {rest!r} in {text!r}")
    return orders


def verify(id_, value, tolerance=None):
    want = expected_orders(CHECKS[id_])
    got = published_orders(str(value))
    if set(got) != set(want):
        raise AssertionError(f"{value!r} has the wrong species")
    for key, power in want.items():
        if got[key] != power:
            raise AssertionError(f"{value!r}: a concentration has order {got[key]}, expected {power}")
