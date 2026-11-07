"""Answer checks for IB Chemistry lesson 3.6 (organic formulas, functional groups and homologous series). Not shipped
to the browser.

The `formula` verify kind needs a formula stated in the question (formula("...") with given: true) or a helper that
works from masses or Mr. Two kinds of answer in this lesson have neither:
  - a molecular or empirical formula read from a structure the lesson DRAWS (a skeletal figure) or from a condensed
    formula when the answer is the empirical formula;
  - the molecular formula of a member of a homologous series ("the fifth alcohol", "the alkyne with seven carbons").

CHECKS maps each such id to its set-up:
  ("molecular", "<condensed structural formula of the drawn structure>")  -> that composition;
  ("empirical", "<condensed structural formula>")                          -> the composition divided by the HCF;
  ("member", "<series>", k)   -> the k-th member of the series, counting from the series' first member;
  ("carbons", "<series>", n)  -> the member with n carbon atoms.
Series compositions are built from first principles for saturated, unbranched-or-branched acyclic members with one
functional group: start from the alkane CnH2n+2 and apply the group (C=C removes 2 H, C#C removes 4 H, -OH adds O,
C=O replaces 2 H by O, -COOH adds one O to that, -O- in the chain adds O, -NH2 adds NH, -CONH2 is an amide C=O plus NH).
The published answer is the last \\ce{...} of the answer or option; its element counts must equal the expected ones.
A readable wrong formula raises AssertionError (so it can stand as a distractor); unreadable text raises ValueError.
Everything else in the lesson uses its declarative `verify` block.
"""
import sys
from math import gcd
from functools import reduce
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import mathparse  # noqa: E402,F401  (kept for the shared sidecar contract)
import chemparse as cp  # noqa: E402

#: carbon count of each series' first member
FIRST = {
    "alkane": 1, "alkene": 2, "alkyne": 2, "alcohol": 1, "aldehyde": 1, "ketone": 3, "carboxylic acid": 1,
    "ether": 2, "amine": 1, "amide": 1, "ester": 2,
}

CHECKS = {
    "before-empirical-hexene": ("empirical", "C6H12"),
    "ex-skeletal-to-molecular": ("molecular", "HOCH2CH2CH(CH3)CH3"),
    "check-diol-empirical": ("empirical", "HOCH2CH2CH2CH2OH"),
    "ex-fifth-alcohol": ("member", "alcohol", 5),
    "check-alkyne-formula": ("carbons", "alkyne", 7),
}


def series_counts(series, n):
    """{element: count} for the member of `series` with n carbon atoms."""
    if series not in FIRST:
        raise ValueError(f"unknown series {series!r}")
    if n < FIRST[series]:
        raise ValueError(f"a {series} needs at least {FIRST[series]} carbon atoms")
    h = 2 * n + 2  # the alkane
    o = nitrogen = 0
    if series == "alkene":
        h -= 2
    elif series == "alkyne":
        h -= 4
    elif series in ("alcohol", "ether"):
        o = 1  # O inserted into a C-H (alcohol) or a C-C bond (ether): H unchanged
    elif series in ("aldehyde", "ketone"):
        h, o = h - 2, 1  # two H on one carbon replaced by =O
    elif series in ("carboxylic acid", "ester"):
        h, o = h - 2, 2  # C=O plus an O inserted next to it
    elif series == "amine":
        h, nitrogen = h + 1, 1  # NH2 replaces one H: +N, +1 H
    elif series == "amide":
        h, o, nitrogen = h - 1, 1, 1  # CH3 end becomes C(=O)NH2: -3 H +2 H, +O, +N
    counts = {"C": n, "H": h, "O": o, "N": nitrogen}
    return {element: count for element, count in counts.items() if count}


def expected(spec):
    kind = spec[0]
    if kind == "molecular":
        return dict(cp.parse_formula(spec[1]).counts)
    if kind == "empirical":
        counts = dict(cp.parse_formula(spec[1]).counts)
        divisor = reduce(gcd, counts.values())
        return {element: count // divisor for element, count in counts.items()}
    if kind == "member":
        return series_counts(spec[1], FIRST[spec[1]] + spec[2] - 1)
    if kind == "carbons":
        return series_counts(spec[1], spec[2])
    raise ValueError(f"unknown check {spec!r}")


def published(value):
    text = str(value)
    block = cp.last_block(text)
    if block is None:
        raise ValueError(f"{text!r}: write the formula in \\ce{{...}}")
    return dict(cp.parse_formula(block).counts)


def verify(id_, value, tolerance=None):
    want = expected(CHECKS[id_])
    got = published(value)
    if got != want:
        hill = lambda counts: cp.Formula(counts).hill()  # noqa: E731
        raise AssertionError(f"{value!r} is {hill(got)}, not {hill(want)}")
