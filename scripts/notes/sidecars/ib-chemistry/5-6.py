"""Rate equations for IB Chemistry 5.6 (no verify kind reads rate = k[A]^m[B]^n).

CHECKS maps an example or check id to the data its question gives. verify(id, text) derives the expected order for
each species from that data and compares the published rate equation with it:
  - "runs": initial-rate experiments, each ({species: concentration}, rate). For each species the sidecar finds two
    runs in which only that concentration changes, and the order is log(rate ratio) / log(concentration ratio). It must
    be within 0.05 of a whole number (the guide assesses integer orders only), else ValueError. A species with no such
    pair of runs is a ValueError too.
  - "rds": the equation of the rate-determining step, given in the question as the FIRST step of the mechanism (so no
    intermediate comes before it). Each reactant's order is its coefficient in that step.
The published text is rate = k[\\ce{species}]^{n}... (\\text{rate} or rate on the left). A zero-order species may be
left out or written with power 0. A coefficient in front of a bracket, a + between terms, a missing k, a missing or
extra species, or a wrong power is WRONG (AssertionError), so each can stand as a distractor; unreadable text is a
ValueError.
"""
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import chemparse as cp  # noqa: E402
import mathparse  # noqa: E402,F401  (kept for the shared sidecar contract)

CHECKS = {
    "ex-deduce-persulfate": {
        "runs": [
            ({"S2O8^2-": 0.0125, "I-": 0.0350}, 1.75e-6),
            ({"S2O8^2-": 0.0250, "I-": 0.0350}, 3.50e-6),
            ({"S2O8^2-": 0.0125, "I-": 0.105}, 5.25e-6),
        ],
    },
    "ex-deduce-bromate": {
        "runs": [
            ({"BrO3-": 0.0350, "Br-": 0.0750, "H+": 0.120}, 5.67e-4),
            ({"BrO3-": 0.105, "Br-": 0.0750, "H+": 0.120}, 1.70e-3),
            ({"BrO3-": 0.0350, "Br-": 0.225, "H+": 0.120}, 1.70e-3),
            ({"BrO3-": 0.0350, "Br-": 0.0750, "H+": 0.240}, 2.27e-3),
        ],
    },
    "check-deduce-chlorine-dioxide": {
        "runs": [
            ({"ClO2": 0.0120, "OH-": 0.0280}, 1.30e-3),
            ({"ClO2": 0.0360, "OH-": 0.0280}, 1.17e-2),
            ({"ClO2": 0.0120, "OH-": 0.0560}, 2.60e-3),
        ],
    },
    "check-rds-peroxide": {
        "rds": r"\ce{H2O2(aq) + I-(aq) -> H2O(l) + IO-(aq)}",
    },
}

_CE = r"\\ce\s*\{((?:[^{}]|\{[^{}]*\})*)\}"
_TERM = re.compile(r"(\d+(?:\.\d+)?)?\s*\[\s*" + _CE + r"\s*\]\s*(?:\^\s*(?:\{\s*(\d+)\s*\}|(\d)))?")


def _key(species):
    return cp.parse_formula(species).key()


def orders_from_runs(runs):
    species = list(runs[0][0])
    orders = {}
    for name in species:
        found = None
        for i, (conc_a, rate_a) in enumerate(runs):
            for conc_b, rate_b in runs[i + 1:]:
                others_same = all(math.isclose(conc_a[o], conc_b[o]) for o in species if o != name)
                if others_same and not math.isclose(conc_a[name], conc_b[name]):
                    found = math.log(rate_b / rate_a) / math.log(conc_b[name] / conc_a[name])
                    break
            if found is not None:
                break
        if found is None:
            raise ValueError(f"no pair of runs changes only {name}")
        if abs(found - round(found)) > 0.05:
            raise ValueError(f"order for {name} is {found:.3f}, not a whole number")
        orders[_key(name)] = int(round(found))
    return orders


def orders_from_rds(equation):
    left, arrow, _right = cp.parse_equation(equation)
    if arrow != "->":
        raise ValueError(f"{equation!r}: an elementary step is written with ->")
    orders = {}
    for coefficient, formula, _state, _ in left:
        if coefficient.denominator != 1:
            raise ValueError(f"{equation!r}: fractional coefficient in an elementary step")
        orders[formula.key()] = orders.get(formula.key(), 0) + int(coefficient)
    return orders


def expected_orders(id_):
    spec = CHECKS[id_]
    return orders_from_runs(spec["runs"]) if "runs" in spec else orders_from_rds(spec["rds"])


def published_orders(text):
    body = str(text).strip().strip("$").strip()
    if "=" not in body:
        raise ValueError(f"{text!r}: write rate = k[...]")
    lhs, rhs = body.split("=", 1)
    if not re.fullmatch(r"\s*(?:\\text\{\s*rate\s*\}|\\mathrm\{\s*rate\s*\}|rate)\s*", lhs):
        raise ValueError(f"{text!r}: the left side must be rate")
    rhs = rhs.strip()
    if not rhs.startswith("k"):
        if "[" in rhs:
            raise AssertionError(f"{text!r}: the rate equation needs the rate constant k in front")
        raise ValueError(f"cannot read {rhs!r}")
    rest = rhs[1:]
    orders = {}

    def take(match):
        coefficient, species, braced, bare = match.groups()
        if coefficient:
            raise AssertionError(f"{text!r}: {coefficient} written as a multiplier; orders are powers")
        key = _key(species)
        orders[key] = orders.get(key, 0) + int(braced if braced is not None else (bare or 1))
        return " "

    leftover = _TERM.sub(take, rest)
    leftover = re.sub(r"\\(?:cdot|times|,|;|left|right)|\s", "", leftover)
    if "+" in leftover or "-" in leftover:
        raise AssertionError(f"{text!r}: concentrations are multiplied in a rate equation, never added")
    if leftover:
        raise ValueError(f"cannot read {leftover!r} in {text!r}")
    return {key: power for key, power in orders.items() if power != 0}


def verify(id_, value, tolerance=None):
    want = {key: power for key, power in expected_orders(id_).items() if power != 0}
    got = published_orders(value)
    if set(got) != set(want):
        raise AssertionError(f"{value!r} has the wrong species (expected orders {want})")
    for key, power in want.items():
        if got[key] != power:
            raise AssertionError(f"{value!r}: order {got[key]} for a species, expected {power}")
