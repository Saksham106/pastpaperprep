"""Answer checks for IB Chemistry lesson 3.10 (proton NMR and combined structural analysis). Not shipped to the browser.

No verify kind reads a 1H NMR prediction (number of signals, area ratio, splitting) or knows which compound a spectrum
belongs to, so these answers are derived here from each compound's structure, written as a small SMILES string:

  - parse_smiles builds the heavy-atom graph (C, O, N, F, Cl, Br, I; branches, double bonds) and gives each atom its
    implicit hydrogens from its valence (C 4, N 3, O 2, halogen 1).
  - Hydrogen environments are the symmetry classes of the H-bearing atoms, found by colour refinement (each atom's
    colour is refined by the multiset of its neighbours' colours until stable). Every molecule here is acyclic, and for
    trees colour refinement gives exactly the symmetry classes. The hydrogens on one atom are taken as equivalent, as
    the IB course does.
  - Area of a signal = the number of hydrogens in that environment.
  - Splitting follows the n + 1 rule as the course teaches it: n is the number of hydrogens on adjacent CARBON atoms
    that are in a different environment; an O-H hydrogen is a singlet and does not split its neighbours.

Modes (CHECKS[id]["mode"]):
  signals        published integers, one per compound, in order ("$3$ signals and $2$ signals"), or a numeric value
  signals-ratio  "$3$ signals, ratio $6:1:3$": the count and the area ratio (any order, compared after reducing)
  ratio          an area ratio a:b:c (multiple-choice options)
  splitting      "triplet (3H), quartet (2H)": every signal's multiplicity with its number of hydrogens
  identify       a compound NAME (an answer or an option); its predicted spectrum must match the question's data
                 (each signal's hydrogens and multiplicity) and its molecular formula must match. Unknown names are a
                 ValueError, so every option must be in NAMES.
A wrong prediction is an AssertionError; unreadable text is a ValueError.
"""
import re
import sys
from collections import Counter
from math import gcd
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import mathparse  # noqa: E402,F401  (kept for the shared sidecar contract)

VALENCE = {"C": 4, "N": 3, "O": 2, "F": 1, "Cl": 1, "Br": 1, "I": 1}
MULTIPLICITY = {1: "singlet", 2: "doublet", 3: "triplet", 4: "quartet", 5: "quintet", 6: "sextet", 7: "septet"}

#: every compound named in an answer or option
NAMES = {
    "ethanol": "CCO",
    "ethanal": "CC=O",
    "propanone": "CC(C)=O",
    "chloroethane": "CCCl",
    "1-chloropropane": "CCCCl",
    "2-chloropropane": "CC(Cl)C",
    "pentan-2-one": "CC(=O)CCC",
    "3-methylbutan-2-one": "CC(C)C(C)=O",
    "2,2-dimethylpropan-1-ol": "CC(C)(C)CO",
    "1,1-dichloroethane": "CC(Cl)Cl",
    "2-bromo-2-methylpropane": "CC(C)(C)Br",
    "1-bromobutane": "CCCCBr",
    "2-bromobutane": "CCC(C)Br",
    "1-bromo-2-methylpropane": "CC(C)CBr",
    "3,3-dimethylbutan-2-one": "CC(=O)C(C)(C)C",
    "hexan-2-one": "CCCCC(C)=O",
    "4-methylpentan-2-one": "CC(C)CC(C)=O",
    "hexanal": "CCCCCC=O",
}


def parse_smiles(smiles):
    """[{el, h, nbrs: [(j, order)]}] for an acyclic SMILES with C N O F Cl Br I, branches and = bonds."""
    atoms, stack, prev, order, i = [], [], None, 1, 0
    while i < len(smiles):
        ch = smiles[i]
        if ch == "(":
            stack.append(prev)
            i += 1
            continue
        if ch == ")":
            prev = stack.pop()
            i += 1
            continue
        if ch == "=":
            order = 2
            i += 1
            continue
        two = smiles[i:i + 2]
        el = two if two in ("Cl", "Br") else ch
        if el not in VALENCE:
            raise ValueError(f"cannot read {smiles!r} at {smiles[i:]!r}")
        atoms.append({"el": el, "nbrs": []})
        k = len(atoms) - 1
        if prev is not None:
            atoms[k]["nbrs"].append((prev, order))
            atoms[prev]["nbrs"].append((k, order))
        prev, order = k, 1
        i += len(el)
    for atom in atoms:
        atom["h"] = VALENCE[atom["el"]] - sum(o for _, o in atom["nbrs"])
        if atom["h"] < 0:
            raise ValueError(f"{smiles!r}: an atom exceeds its valence")
    return atoms


def formula_counts(atoms):
    counts = Counter(a["el"] for a in atoms)
    counts["H"] += sum(a["h"] for a in atoms)
    return {k: v for k, v in counts.items() if v}


def classes(atoms):
    colour = [(a["el"], a["h"], tuple(sorted(o for _, o in a["nbrs"]))) for a in atoms]
    count = len(set(colour))
    while True:
        refined = [(colour[i], tuple(sorted((o, colour[j]) for j, o in a["nbrs"]))) for i, a in enumerate(atoms)]
        labels = {c: n for n, c in enumerate(sorted(set(refined), key=repr))}
        colour = [labels[c] for c in refined]
        if len(set(colour)) == count:
            return colour
        count = len(set(colour))


def spectrum(smiles):
    """[(hydrogens, multiplicity name)] for each environment of the compound."""
    atoms = parse_smiles(smiles)
    cls = classes(atoms)
    signals = {}
    for i, a in enumerate(atoms):
        if not a["h"]:
            continue
        if a["el"] == "C":
            n = sum(atoms[j]["h"] for j, _ in a["nbrs"] if atoms[j]["el"] == "C" and cls[j] != cls[i])
        else:
            n = 0
        name = MULTIPLICITY.get(n + 1, "multiplet")
        hydrogens, seen = signals.get(cls[i], (0, name))
        if seen != name:
            raise ValueError(f"{smiles!r}: one environment with two splittings")
        signals[cls[i]] = (hydrogens + a["h"], name)
    return sorted(signals.values())


def _reduced(parts):
    common = 0
    for part in parts:
        common = gcd(common, part)
    return sorted(part // common for part in parts)


def _plain(text):
    return re.sub(r"\\text\s*\{([^{}]*)\}", r"\1", str(text)).replace("$", " ")


def _integers(text):
    return [int(n) for n in re.findall(r"(?<![\w.])\d+(?![\w.])", _plain(text))]


_RATIO = re.compile(r"\d+(?:\s*:\s*\d+)+")


def _ratio(text):
    match = _RATIO.search(_plain(text))
    if not match:
        raise ValueError(f"no ratio a:b in {text!r}")
    return [int(p) for p in match.group(0).split(":")], _plain(text).replace(match.group(0), " ")


def _formula(text):
    counts = Counter()
    for el, n in re.findall(r"(Cl|Br|[CHONFI])(\d*)", text):
        counts[el] += int(n or 1)
    return dict(counts)


def _compound(text):
    name = re.sub(r"\s+", " ", _plain(text)).strip().rstrip(".").casefold()
    if name not in NAMES:
        raise ValueError(f"unknown compound {text!r}: add it to NAMES")
    return NAMES[name]


#: id -> spec
CHECKS = {
    "ex-count-chloropropanes": {"mode": "signals", "smiles": ["CCCCl", "CC(Cl)C"]},
    "check-count-pentan-2-one": {"mode": "signals", "smiles": ["CC(=O)CCC"]},
    "ex-predict-3-methylbutan-2-one": {"mode": "signals-ratio", "smiles": "CC(C)C(C)=O"},
    "check-ratio-dimethylpropanol": {"mode": "ratio", "smiles": "CC(C)(C)CO"},
    "ex-splitting-chloroethane": {"mode": "splitting", "smiles": "CCCl"},
    "check-identify-doublet-quartet": {"mode": "identify", "target": [(3, "doublet"), (1, "quartet")], "formula": None},
    "ex-identify-c4h9br": {"mode": "identify", "target": [(9, "singlet")], "formula": "C4H9Br"},
    "check-identify-c6h12o": {"mode": "identify", "target": [(9, "singlet"), (3, "singlet")], "formula": "C6H12O"},
}
NUMERIC = {"check-count-pentan-2-one": {"dp": 0}}


def verify(id_, value, tolerance=None):
    spec = CHECKS[id_]
    mode = spec["mode"]
    if mode == "signals":
        want = [len(spectrum(s)) for s in spec["smiles"]]
        if isinstance(value, (int, float)):
            got = [value]
            if len(want) != 1 or abs(float(value) - want[0]) > (tolerance or 0) + 1e-9:
                raise AssertionError(f"{value} signals, expected {want[0]}")
            return None
        got = _integers(value)
        if not got:
            raise ValueError(f"no number of signals in {value!r}")
        if got != want:
            raise AssertionError(f"{value!r} gives {got} signals, expected {want}")
        return None
    if mode in ("signals-ratio", "ratio"):
        signals = spectrum(spec["smiles"])
        parts, rest = _ratio(value)
        if 0 in parts:
            raise AssertionError(f"{value!r} has a zero part")
        if _reduced(parts) != _reduced([h for h, _ in signals]):
            raise AssertionError(f"{value!r} is not the area ratio {[h for h, _ in signals]}")
        if mode == "signals-ratio":
            counts = _integers(rest)
            if not counts:
                raise ValueError(f"no number of signals in {value!r}")
            if counts[0] != len(signals):
                raise AssertionError(f"{value!r}: {counts[0]} signals, expected {len(signals)}")
        return None
    if mode == "splitting":
        pairs = re.findall(r"(singlet|doublet|triplet|quartet|quintet|sextet|septet|multiplet)\s*\(\s*(\d+)\s*H\s*\)", _plain(value))
        if not pairs:
            raise ValueError(f"write each signal as 'triplet (3H)' in {value!r}")
        got = sorted((int(n), word) for word, n in pairs)
        if got != spectrum(spec["smiles"]):
            raise AssertionError(f"{value!r} is not {spectrum(spec['smiles'])}")
        return None
    if mode == "identify":
        smiles = _compound(value)
        if spec["formula"] and formula_counts(parse_smiles(smiles)) != _formula(spec["formula"]):
            raise AssertionError(f"{value!r} is not {spec['formula']}")
        predicted = spectrum(smiles)
        if sorted(spec["target"]) != predicted:
            raise AssertionError(f"{value!r} gives {predicted}, not the spectrum {sorted(spec['target'])}")
        return None
    raise KeyError(f"no assertion for {id_}")


if __name__ == "__main__":
    assert spectrum("CCO") == [(1, "singlet"), (2, "quartet"), (3, "triplet")]
    assert spectrum("CC(C)=O") == [(6, "singlet")]
    assert spectrum("CC(Cl)C") == [(1, "septet"), (6, "doublet")]
    assert len(spectrum("CC(=O)CCC")) == 4
    assert spectrum("CC(C)C(C)=O") == [(1, "septet"), (3, "singlet"), (6, "doublet")]
    assert spectrum("CC(C)(C)CO") == [(1, "singlet"), (2, "singlet"), (9, "singlet")]
    assert spectrum("CC(Cl)Cl") == [(1, "quartet"), (3, "doublet")]
    assert spectrum("CCOCC") == [(4, "quartet"), (6, "triplet")]
    assert spectrum("CC(C)(C)CBr") == [(2, "singlet"), (9, "singlet")]
    assert formula_counts(parse_smiles("CC(C)(C)Br")) == {"C": 4, "H": 9, "Br": 1}
    for name, smiles in NAMES.items():
        print(f"{name:26} {formula_counts(parse_smiles(smiles))} {spectrum(smiles)}")
    print("ok")
