"""Radical equations and radical species for IB Chemistry 6.15 (radicals). Not shipped to the browser.

No verify kind reads a radical: chemparse treats the radical dot (\\bullet, rendered as a middle dot) as a hydrate
joiner and refuses `Cl·`. CHECKS maps an example or check id to the expected species or equation, written in the
lesson's own notation (\\ce{Cl\\bullet}, \\ce{\\bullet CH3}, \\ce{Cl2 -> 2Cl\\bullet}).

verify(id, text) reads the published \\ce{} text species by species:
  - each species' radical dots are counted and removed, then the rest is read by chemparse (element counts, charge);
  - a species is (formula, charge, number of dots); the same species written twice on one side is summed
    (Cl\\bullet + Cl\\bullet is 2Cl\\bullet);
  - the published species (or each side of the equation, with its arrow) must equal the expected one exactly:
    a missing dot, an ion in place of a radical (Cl^+ + Cl^-), H\\bullet in place of HCl, a different step or the sides
    swapped is WRONG (AssertionError). Text that cannot be read is a ValueError.
Limit: species are compared by element counts, so isomeric radicals (CH3CH2CH2\\bullet and CH3CH\\bullet CH3) are not
told apart. The lesson only verifies equations whose radicals have no isomer in play (methyl, ethyl, Cl, Br, I).
Every expected equation is checked to balance (atoms and charge) when the sidecar loads.
"""
import re
import sys
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import mathparse  # noqa: E402,F401  (kept for the shared sidecar contract)
import chemparse as cp  # noqa: E402

CHECKS = {
    "check-hydroxyl-radical": r"\ce{\bullet OH}",
    "ex-bromine-fission": r"\ce{Br2 -> 2Br\bullet}",
    "check-iodine-fission": r"\ce{I2 -> 2I\bullet}",
    "ex-ethane-propagation": r"\ce{CH3CH3 + Cl\bullet -> CH3CH2\bullet + HCl}",
    "check-termination-bromoethane": r"\ce{CH3CH2\bullet + Br\bullet -> CH3CH2Br}",
    "ex-termination-butane": r"\ce{2CH3CH2\bullet -> CH3CH2CH2CH3}",
}

_COEFFICIENT = re.compile(r"^(\d+)\s*(?=[A-Z(\[·])")


def _plain(text):
    """The last \\ce{} block of the published text, normalised (\\bullet and • become ·)."""
    text = str(text).replace("•", r" \bullet ")
    block = cp.last_block(text)
    if block is None:
        raise ValueError(f"{text!r}: write the species or equation in \\ce{{}}")
    if re.search(r"\^\s*\{?\s*\.", block):
        raise ValueError(f"{text!r}: write the radical dot as \\bullet, not ^{{.}}")
    return cp.normalise(f"\\ce{{{block}}}")


def _species(piece, original):
    """(coefficient, (formula key, dots)) of one written species."""
    piece = piece.strip()
    dots = piece.count("·")
    piece = piece.replace("·", " ").strip()
    coefficient = Fraction(1)
    match = _COEFFICIENT.match(piece)
    if match:
        coefficient = Fraction(int(match.group(1)))
        piece = piece[match.end():].strip()
    piece = re.sub(r"\s+", "", piece)
    if not piece:
        raise ValueError(f"cannot read a species in {original!r}")
    formula, _state = cp.parse_species(piece)
    return coefficient, (formula.key(), dots), formula


def _side(text, original):
    totals, formulas = {}, {}
    for piece in re.split(r"(?<=\S)\s+\+\s+(?=\S)", text.strip()):
        coefficient, key, formula = _species(piece, original)
        totals[key] = totals.get(key, 0) + coefficient
        formulas[key] = formula
    return totals, formulas


def read(text):
    """{"species": {...}} or {"arrow": ..., "left": {...}, "right": {...}}, each map {(formula key, dots): coefficient}."""
    plain = _plain(text)
    arrows = re.findall(r"<=>|->", plain)
    if not arrows:
        return {"species": _side(plain, text)[0]}
    if len(arrows) != 1:
        raise ValueError(f"{text!r} must hold exactly one arrow")
    left, right = re.split(r"<=>|->", plain)
    (lmap, lform), (rmap, rform) = _side(left, text), _side(right, text)
    return {"arrow": arrows[0], "left": lmap, "right": rmap, "_formulas": (lform, rform)}


def _balanced(parsed):
    """Atoms, charge and radical dots per side: [(name, left, right)] that differ (dots may differ: radicals pair up)."""
    out = []
    lform, rform = parsed["_formulas"]
    names = {e for f in list(lform.values()) + list(rform.values()) for e in f.counts} | {"charge"}
    for name in sorted(names):
        totals = []
        for side, forms in ((parsed["left"], lform), (parsed["right"], rform)):
            totals.append(sum(c * (forms[k].counts.get(name, 0) if name != "charge" else forms[k].charge) for k, c in side.items()))
        if totals[0] != totals[1]:
            out.append((name, *totals))
    return out


for _id, _expected in CHECKS.items():
    _parsed = read(_expected)
    if "arrow" in _parsed and _balanced(_parsed):
        raise ValueError(f"sidecar expectation for {_id} does not balance: {_balanced(_parsed)}")


def verify(id_, value, tolerance=None):
    want = read(CHECKS[id_])
    got = read(value)
    if "species" in want:
        if "species" not in got:
            raise AssertionError(f"{value!r} is an equation; a single species was expected")
        if got["species"] != want["species"]:
            raise AssertionError(f"{value!r} is not the expected species (check the formula, charge and radical dot)")
        return
    if "arrow" not in got:
        raise AssertionError(f"{value!r} is a species; an equation was expected")
    if got["arrow"] != want["arrow"]:
        raise AssertionError(f"{value!r} uses the wrong arrow")
    if got["left"] != want["left"] or got["right"] != want["right"]:
        problems = _balanced(got)
        detail = f" (it does not balance: {problems})" if problems else ""
        raise AssertionError(f"{value!r} is not the expected step{detail}: check each species and its radical dot")
