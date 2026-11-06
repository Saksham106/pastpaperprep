"""Answer checks for IB Chemistry lesson 2.12 (polymers). Not shipped to the browser.

No verify kind reads a polymer repeating unit such as $\\ce{-CH2-CH(CN)-}$, or checks that a monomer such as
$\\ce{CH2=CCl2}$ makes a given chain. This sidecar models the two reactions from first principles.

Addition (CHECKS value ("addition-unit", monomer)): the monomer is written as two backbone carbons joined by "=", each
"C" + optional "H"/"H2" + substituents (parenthesised groups, halogens with a count, or one trailing group such as CN).
The double bond opens, so the repeating unit is the same two carbons, joined by a single bond, carrying the same
substituents. The published unit must: start and end with an open (continuation) bond "-", contain no "=", have
exactly two backbone groups, each starting with carbon, and match the monomer's carbons (either way round).

Monomer from a chain (("monomer", segment)): the segment's backbone groups must repeat with period 2; the published
monomer must contain one "=" between two carbon groups whose substituents match that two-carbon repeat. A readable
formula with no C=C (CH3CHCl2) is WRONG, so it can stand as a distractor.

Condensation (("condensation-unit", [monomer formulas], links, "ester" | "amide")): the repeating unit's composition is
the monomers' total minus one H2O per link made, and the unit must contain the named link (COO / OOC for an ester,
CONH / NHCO for an amide, read cyclically because the link may span the two ends) and open bonds at both ends.

A readable but wrong answer raises AssertionError; unreadable text raises ValueError.
"""
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import chemparse as cp  # noqa: E402
import mathparse  # noqa: E402,F401  (kept for the shared sidecar contract)

CHECKS = {
    "ex-repeat-propenenitrile": ("addition-unit", "CH2=CHCN"),
    "check-repeat-ethenyl-ethanoate": ("addition-unit", "CH2=CH(OOCCH3)"),
    "ex-monomer-dichloroethene": ("monomer", "-CH2-CCl2-CH2-CCl2-CH2-CCl2-"),
    "check-monomer-trifluoroethene": ("monomer", "-CF2-CHF-CF2-CHF-CF2-CHF-"),
    "ex-polyester-unit": ("condensation-unit", ["C4H6O4", "C2H6O2"], 2, "ester"),
    "ex-polyamide-unit": ("condensation-unit", ["C4H9NO2"], 1, "amide"),
}

HALOGENS = ("Cl", "Br", "F", "I")


def _strip(tex):
    """The chemistry inside $\\ce{...}$ (or the plain text), without brackets, n, spaces or dollar signs."""
    text = str(tex).strip().strip("$").strip()
    block = cp.last_block(text)
    if block is not None:
        text = block
    text = re.sub(r"_\{?n\}?", "", text)
    text = re.sub(r"\]\s*n\b", "]", text)
    text = text.replace("[", "").replace("]", "")
    return re.sub(r"\s+", "", text)


def _group(text, tex):
    """A backbone carbon: (number of H, Counter of other substituents). AssertionError if it is not a carbon."""
    if "=" in text:
        raise AssertionError(f"{tex!r}: the repeating unit still contains a C=C double bond")
    if not text.startswith("C") or text.startswith(HALOGENS[0]):
        raise AssertionError(f"{tex!r}: {text!r} is not a backbone carbon; only the carbons of the C=C form the chain")
    rest = text[1:]
    hydrogens = 0
    match = re.match(r"H(\d?)", rest)
    if match:
        hydrogens = int(match.group(1) or 1)
        rest = rest[match.end():]
    subs = Counter()
    while rest:
        if rest.startswith("("):
            depth, end = 0, None
            for i, char in enumerate(rest):
                depth += char == "("
                depth -= char == ")"
                if depth == 0:
                    end = i
                    break
            if end is None:
                raise ValueError(f"unbalanced brackets in {tex!r}")
            inner = rest[1:end]
            rest = rest[end + 1:]
            count = re.match(r"\d*", rest).group(0)
            rest = rest[len(count):]
            if inner == "H":
                hydrogens += int(count or 1)
            else:
                subs[inner] += int(count or 1)
            continue
        halogen = re.match(r"(Cl|Br|F|I)(\d?)(?=$|\()", rest)
        if halogen:
            subs[halogen.group(1)] += int(halogen.group(2) or 1)
            rest = rest[halogen.end():]
            continue
        cut = rest.find("(")
        piece, rest = (rest, "") if cut < 0 else (rest[:cut], rest[cut:])
        subs[piece] += 1
    if hydrogens + sum(subs.values()) != 2:
        raise AssertionError(f"{tex!r}: the backbone carbon {text!r} has {hydrogens + sum(subs.values())} groups, not 2")
    return hydrogens, subs


def _same_pair(a, b):
    return (a[0] == b[0] and a[1] == b[1]) or (a[0] == b[1] and a[1] == b[0])


def _monomer(text, tex):
    """The two carbons of a monomer's C=C, as _group results."""
    if text.count("=") != 1:
        raise AssertionError(f"{tex!r} has no single C=C double bond, so it cannot form an addition polymer")
    left, right = text.split("=")
    return [_group(left, tex), _group(right, tex)]


def _chain(text, tex):
    """The backbone groups of a written chain with open bonds at both ends."""
    if not (text.startswith("-") and text.endswith("-")):
        raise AssertionError(f"{tex!r}: show the open (continuation) bond at each end of the chain")
    pieces = text[1:-1].split("-")
    if any(not piece for piece in pieces):
        raise ValueError(f"cannot read the chain {tex!r}")
    return [_group(piece, tex) for piece in pieces]


def check_addition_unit(tex, monomer):
    want = _monomer(monomer, monomer)
    got = _chain(_strip(tex), tex)
    if len(got) != 2:
        raise AssertionError(f"{tex!r}: an addition repeating unit has two backbone carbons, not {len(got)}")
    if not _same_pair(got, want):
        raise AssertionError(f"{tex!r} does not carry the monomer's groups {want}")


def check_monomer(tex, segment):
    chain = _chain(segment, segment)
    if len(chain) % 2 or any(chain[i] != chain[i % 2] for i in range(len(chain))):
        raise ValueError(f"segment {segment!r} does not repeat every two carbons")
    got = _monomer(_strip(tex), tex)
    if not _same_pair(got, chain[:2]):
        raise AssertionError(f"{tex!r} is not the monomer of {segment!r}")


def _composition(text):
    return cp.parse_formula(text.replace("-", "")).key()


def check_condensation_unit(tex, monomers, links, kind):
    text = _strip(tex)
    if not (text.startswith("-") and text.endswith("-")):
        raise AssertionError(f"{tex!r}: show the open (continuation) bond at each end of the repeating unit")
    if "=" in text:
        raise ValueError(f"write the repeating unit with CO for a carbonyl group, not = ({tex!r})")
    total = Counter()
    for formula in monomers:
        for element, count in cp.parse_formula(formula).key()[0]:
            total[element] += count
    total["H"] -= 2 * links
    total["O"] -= links
    want = tuple(sorted((element, count) for element, count in total.items() if count))
    got = _composition(text)
    if got != (want, 0):
        raise AssertionError(f"{tex!r} is {dict(got[0])}, not monomers minus {links} H2O {dict(want)}")
    body = text.strip("-").replace("-", "")
    ring = body + body
    links_found = ("COO", "OOC") if kind == "ester" else ("CONH", "NHCO")
    if not any(link in ring for link in links_found):
        raise AssertionError(f"{tex!r} has no {kind} link")


def verify(id_, value, tolerance=None):
    if id_ not in CHECKS:
        raise KeyError(f"no assertion for {id_}")
    spec = CHECKS[id_]
    if spec[0] == "addition-unit":
        return check_addition_unit(value, spec[1])
    if spec[0] == "monomer":
        return check_monomer(value, spec[1])
    if spec[0] == "condensation-unit":
        return check_condensation_unit(value, *spec[1:])
    raise KeyError(f"unknown check type {spec[0]}")


if __name__ == "__main__":
    check_addition_unit(r"$\ce{-CH2-CH(CN)-}$", "CH2=CHCN")
    check_addition_unit(r"$\ce{-[CH(CN)-CH2]_{n}-}$", "CH2=CHCN")
    for bad in (r"$\ce{-CH2=CH(CN)-}$", r"$\ce{CH2-CH(CN)}$", r"$\ce{-CH2-CH2-CN-}$"):
        try:
            check_addition_unit(bad, "CH2=CHCN")
        except AssertionError:
            pass
        else:
            raise SystemExit(f"accepted {bad}")
    check_monomer(r"$\ce{CH2=CCl2}$", "-CH2-CCl2-CH2-CCl2-")
    check_condensation_unit(r"$\ce{-CO-CH2CH2-CO-O-CH2CH2-O-}$", ["C4H6O4", "C2H6O2"], 2, "ester")
    check_condensation_unit(r"$\ce{-NH-CH2CH2CH2-CO-}$", ["C4H9NO2"], 1, "amide")
    print("ok")
