"""Answer checks for IB Chemistry lesson 6.1 (Bronsted-Lowry acids and bases). Not shipped to the browser.

Only the conjugate acid / conjugate base answers need a sidecar: no verify kind derives a conjugate from a species
(the `formula` kind's helpers build empirical, molecular and ionic formulas only). CHECKS maps an example or check id to
(species, wanted): the species the question gives and "acid" or "base". The expected formula is derived from that
species by the definition of a conjugate pair (the two differ by exactly one H+):
  - conjugate base: one H fewer and the charge one lower;
  - conjugate acid: one H more and the charge one higher.
The published formula (the last \\ce{...} in the answer or option) is read with chemparse; its element counts and
charge must match. A readable but different formula (two protons removed, charge left unchanged, ...) is WRONG
(AssertionError), so it can stand as a distractor; unreadable text is a ValueError.
Everything else in the lesson uses its declarative `verify` block.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import mathparse  # noqa: E402,F401  (kept for the shared sidecar contract)
import chemparse as cp  # noqa: E402

CHECKS = {
    "before-hydrogencarbonate-charge": ("CO3^2-", "acid"),
    "ex-conjugate-base-sulfuric": ("H2SO4", "base"),
    "check-conjugate-acid-carbonate": ("CO3^2-", "acid"),
    "check-conjugate-base-methylammonium": ("CH3NH3^+", "base"),
}


def conjugate(species, wanted):
    """The conjugate acid or base of `species` (mhchem text), as a chemparse Formula."""
    start = cp.parse_formula(species)
    step = {"acid": 1, "base": -1}[wanted]
    counts = dict(start.counts)
    counts["H"] = counts.get("H", 0) + step
    if counts["H"] < 0:
        raise ValueError(f"{species} has no proton to lose")
    return cp.Formula(counts, start.charge + step)


def _published(text):
    block = cp.last_block(str(text))
    if block is None:
        raise ValueError(f"{text!r}: write the formula in \\ce{{...}}")
    return cp.parse_formula(block)


def verify(id_, value, tolerance=None):
    species, wanted = CHECKS[id_]
    want = conjugate(species, wanted)
    got = _published(value)
    if got != want:
        raise AssertionError(f"{value!r} is {got.hill()}, but the conjugate {wanted} of {species} is {want.hill()}")
