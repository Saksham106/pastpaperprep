"""Answer checks for IB Chemistry lesson 6.16 (nucleophiles and electrophiles). Not shipped to the browser.

Two organic equations need a sidecar. The alkene addition: the chem-equation kind refuses "=" inside an equation (it reads
it as an equals sign), but a structural formula such as $\\ce{CH3CH=CHCH3}$ must show the C=C double bond. The
substitution: chem-equation compares compositions only, so the wrong isomer (butan-1-ol for butan-2-ol) would pass.

CHECKS maps an example id to {"equation": the truth with its structural formulas, "forms": {truth species: [other
accepted ways of writing the same structure]}}. verify(id, text):
  1. takes the last \\ce{...} holding an arrow; an equilibrium arrow is WRONG (these additions are written with ->);
  2. removes each "=" that joins two atoms (in the published text and the truth) and runs the chem-equation kind on the
     result, so the species' compositions, the atom and charge balance and the smallest whole-number coefficients are
     checked exactly as for any other equation;
  3. compares the structures as written: each published species (coefficient and state symbol dropped, spaces removed)
     must be the truth's species or one of its accepted forms, side by side. So the right composition with the wrong
     structure (1-bromobutane for 2-bromobutane, or an alkene written without its "=") is WRONG (AssertionError).
Unreadable text raises ValueError. Everything else in the lesson uses its declarative `verify` block.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import mathparse  # noqa: E402,F401  (kept for the shared sidecar contract)
import chemparse as cp  # noqa: E402
import verify_kinds as vk  # noqa: E402

CHECKS = {
    "ex-but2ene-hbr": {
        "equation": "CH3CH=CHCH3 + HBr -> CH3CHBrCH2CH3",
        "forms": {"CH3CHBrCH2CH3": ["CH3CH2CHBrCH3"]},
    },
    # No C=C here, but chem-equation compares compositions only, so butan-1-ol would pass as butan-2-ol.
    "ex-substitution-chlorobutane": {
        "equation": "CH3CHClCH2CH3 + OH^- -> CH3CH(OH)CH2CH3 + Cl^-",
        "forms": {
            "CH3CHClCH2CH3": ["CH3CH2CHClCH3"],
            "CH3CH(OH)CH2CH3": ["CH3CH2CH(OH)CH3"],
            "OH^-": ["OH-", "HO^-", "HO-"],
            "Cl^-": ["Cl-"],
        },
    },
}

_BOND = re.compile(r"(?<=[A-Za-z0-9)])=(?=[A-Za-z(])")
_STATE = re.compile(r"\((?:s|l|g|aq)\)$")
_COEFFICIENT = re.compile(r"^(?:\d+\s*/\s*\d+|\d+)\s*(?=[A-Z(])")


def _equation_block(text):
    """The last \\ce{...} with an arrow (or the plain text when there is no \\ce{})."""
    text = str(text)
    blocks = []
    for match in re.finditer(r"\\ce\s*\{", text):
        depth, i = 1, match.end()
        while i < len(text) and depth:
            depth += {"{": 1, "}": -1}.get(text[i], 0)
            i += 1
        blocks.append(text[match.end(): i - 1])
    if not blocks:
        return text.replace("$", " ").strip()
    with_arrow = [block for block in blocks if re.search(r"->|<=>", block)]
    if not with_arrow:
        raise ValueError(f"{text!r} has no \\ce{{}} equation with an arrow")
    return with_arrow[-1]


def _structures(block):
    """[[left species as written], [right species as written]], coefficients and state symbols dropped."""
    arrows = re.findall(r"<=>|->", block)
    if len(arrows) != 1:
        raise ValueError(f"{block!r} must hold exactly one arrow")
    sides = []
    for side in re.split(r"<=>|->", block):
        species = []
        for piece in re.split(r"(?<=\S)\s+\+\s+(?=\S)", side.strip()):
            piece = _COEFFICIENT.sub("", piece.strip())
            piece = _STATE.sub("", re.sub(r"\s+", "", piece))
            species.append(piece)
        sides.append(species)
    return sides


def verify(id_, value, tolerance=None):
    spec = CHECKS[id_]
    truth = spec["equation"]
    block = _equation_block(value)
    if "<=>" in block:
        raise AssertionError(f"{value!r}: this addition is written with a one-way arrow ->")
    vk.k_chem_equation(_BOND.sub("", block), _BOND.sub("", truth), {"reversible": False})
    forms = spec.get("forms", {})
    for name, got, want in zip(("reactants", "products"), _structures(block), _structures(truth)):
        remaining = list(want)
        for written in got:
            match = next((species for species in remaining if written == species or written in forms.get(species, [])), None)
            if match is None:
                raise AssertionError(f"{value!r}: {written} is not the structure expected among the {name} ({', '.join(want)})")
            remaining.remove(match)
        if remaining:
            raise AssertionError(f"{value!r}: missing {', '.join(remaining)} among the {name}")
    return None


if __name__ == "__main__":
    verify("ex-but2ene-hbr", r"$\ce{CH3CH=CHCH3 + HBr -> CH3CHBrCH2CH3}$")
    verify("ex-but2ene-hbr", r"$\ce{CH3CH=CHCH3 + HBr -> CH3CH2CHBrCH3}$")
    for wrong in (
        r"$\ce{CH3CH=CHCH3 + HBr -> CH2BrCH2CH2CH3}$",
        r"$\ce{CH3CHCHCH3 + HBr -> CH3CHBrCH2CH3}$",
        r"$\ce{CH3CH=CHCH3 + HBr <=> CH3CHBrCH2CH3}$",
        r"$\ce{CH3CH=CHCH3 + Br2 -> CH3CHBrCHBrCH3}$",
        r"$\ce{2CH3CH=CHCH3 + 2HBr -> 2CH3CHBrCH2CH3}$",
    ):
        try:
            verify("ex-but2ene-hbr", wrong)
        except AssertionError:
            continue
        raise SystemExit(f"accepted a wrong answer: {wrong}")
    verify("ex-substitution-chlorobutane", r"$\ce{CH3CHClCH2CH3 + OH^- -> CH3CH(OH)CH2CH3 + Cl^-}$")
    for wrong in (
        r"$\ce{CH3CHClCH2CH3 + OH^- -> CH3CH2CH2CH2OH + Cl^-}$",
        r"$\ce{CH3CHClCH2CH3 + OH^- -> CH3CH(OH)CH2CH3 + Cl}$",
    ):
        try:
            verify("ex-substitution-chlorobutane", wrong)
        except (AssertionError, ValueError):
            continue
        raise SystemExit(f"accepted a wrong answer: {wrong}")
    print("ok")
