"""Answer checks for IB Chemistry lesson 6.19 (electrophilic addition). Not shipped to the browser.

No verify kind reads a condensed structural formula with a C=C double bond, or tells structural isomers apart
(chem-equation and formula compare atom counts only, so 1-bromopropane would pass for 2-bromopropane). This sidecar does.

CHECKS maps an example or check id to its set-up: the alkene as a condensed structural formula ("CH3CH=CH2",
"(CH3)2C=CH2") and the reagent ("HBr", "HCl", "HI", "Br2", "Cl2", "I2" or "H2O"). The sidecar works out the product
itself:
  - a halogen X2 adds one X atom to each carbon of the double bond;
  - HX or H2O adds H to one double-bond carbon and X (or OH) to the other. The X or OH goes to the carbon that carries
    the positive charge in the more stable carbocation, i.e. the one bonded to more carbon atoms (tertiary > secondary >
    primary). That is Markovnikov's rule. If both carbocations are equally substituted and the two products differ,
    the set-up is refused: there would be no single major product.
The published text is either an equation $\\ce{alkene + reagent -> product}$ (reactants in either order, no
coefficients, a one-way arrow, state symbols ignored) or one $\\ce{product}$. Structures are compared as molecules
(atoms, hydrogen counts, bonds and bond orders), so CH3CHBrCH3, CH3CH(Br)CH3 and (CH3)2CHBr are the same answer, while
CH3CH2CH2Br is a different one. A readable structure with the wrong product, or a carbon without four bonds, is WRONG
(AssertionError), so it can stand as a distractor; unreadable text is a ValueError.
Everything else in the lesson uses its declarative `verify` block.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import chemparse as cp  # noqa: E402

CHECKS = {
    "ex-hbr-but-2-ene": {"alkene": "CH3CH=CHCH3", "reagent": "HBr"},
    "check-hi-ethene": {"alkene": "CH2=CH2", "reagent": "HI"},
    "ex-chlorine-hex-3-ene": {"alkene": "CH3CH2CH=CHCH2CH3", "reagent": "Cl2"},
    "check-bromine-dimethylbutene": {"alkene": "(CH3)2C=C(CH3)2", "reagent": "Br2"},
    "ex-hydration-ethene": {"alkene": "CH2=CH2", "reagent": "H2O"},
    "ex-hi-pent-1-ene": {"alkene": "CH2=CHCH2CH2CH3", "reagent": "HI"},
    "check-hcl-methylbut-1-ene": {"alkene": "CH2=C(CH3)CH2CH3", "reagent": "HCl"},
    "check-water-methylpropene": {"alkene": "(CH3)2C=CH2", "reagent": "H2O"},
}

VALENCE = {"C": 4, "O": 2, "Br": 1, "Cl": 1, "I": 1, "F": 1}
HALOGENS = {"Br", "Cl", "I"}
_TOKEN = re.compile(r"\s*(?:(?P<open>\()|(?P<close>\))|(?P<double>=)|(?P<num>\d+)|(?P<atom>Br|Cl|C|O|I|F|H))")


class Molecule:
    """Heavy atoms with implicit hydrogen counts; bonds as {(i, j): order} with i < j."""

    def __init__(self):
        self.elements, self.hydrogens, self.bonds = [], [], {}

    def add(self, element, hydrogens=0):
        self.elements.append(element)
        self.hydrogens.append(hydrogens)
        return len(self.elements) - 1

    def bond(self, i, j, order=1):
        key = (min(i, j), max(i, j))
        if i == j or key in self.bonds:
            raise ValueError("an atom cannot bond to itself or twice to the same atom")
        self.bonds[key] = order

    def neighbours(self, i):
        for (a, b), order in self.bonds.items():
            if a == i:
                yield b, order
            elif b == i:
                yield a, order

    def copy(self):
        other = Molecule()
        other.elements, other.hydrogens, other.bonds = list(self.elements), list(self.hydrogens), dict(self.bonds)
        return other

    def check_valence(self, text):
        for i, element in enumerate(self.elements):
            total = self.hydrogens[i] + sum(order for _, order in self.neighbours(i))
            if total != VALENCE[element]:
                raise AssertionError(f"{text!r}: a {element} atom has {total} bonds, not {VALENCE[element]}")
        if len(self.bonds) != len(self.elements) - 1:
            raise ValueError(f"{text!r} is not a single chain (rings are not handled)")
        seen, stack = {0}, [0]
        while stack:
            for j, _ in self.neighbours(stack.pop()):
                if j not in seen:
                    seen.add(j)
                    stack.append(j)
        if len(seen) != len(self.elements):
            raise ValueError(f"{text!r} is not one molecule")

    def canonical(self):
        """A string that is the same for two drawings of one molecule (tree canonical form, minimised over roots)."""
        def label(i):
            return f"{self.elements[i]}H{self.hydrogens[i]}"

        def walk(i, parent):
            branches = sorted(("=" if order == 2 else "-") + walk(j, i) for j, order in self.neighbours(i) if j != parent)
            return label(i) + "(" + ",".join(branches) + ")"

        return min(walk(i, None) for i in range(len(self.elements)))


def _tokens(text):
    out, i = [], 0
    while i < len(text):
        match = _TOKEN.match(text, i)
        if not match or match.end() == i:
            raise ValueError(f"cannot read {text!r} as a condensed structural formula (stuck at {text[i:]!r})")
        out.append((match.lastgroup, match.group(match.lastgroup)))
        i = match.end()
    return out


def parse_structure(text):
    """A Molecule from a condensed structural formula: CH3CH=CH2, (CH3)2C=CHCH3, CH3CH(OH)CH3, BrCH2CH2Br, HOCH2CH3."""
    body = cp.normalise(text).strip()
    body = re.sub(r"\s*\(\s*(s|l|g|aq)\s*\)\s*$", "", body)
    tokens = _tokens(body)
    molecule = Molecule()
    position = [0]

    def peek():
        return tokens[position[0]] if position[0] < len(tokens) else (None, None)

    def take():
        token = peek()
        position[0] += 1
        return token

    def count():
        kind, value = peek()
        if kind == "num":
            take()
            return int(value)
        return 1

    def sequence(stop_at_close):
        """Read atoms until the end (or a closing bracket); return the first atom, which joins the outside."""
        first, current, pending, order = None, None, [], 1
        while True:
            kind, value = peek()
            if kind is None or (kind == "close" and stop_at_close):
                break
            if kind == "close":
                raise ValueError(f"unmatched ) in {text!r}")
            take()
            if kind == "double":
                if current is None:
                    raise ValueError(f"= with no carbon before it in {text!r}")
                order = 2
            elif kind == "open":
                start = position[0]
                roots = [sequence(True)]
                if take()[0] != "close":
                    raise ValueError(f"unclosed ( in {text!r}")
                end = position[0]
                for _ in range(count() - 1):
                    position[0] = start
                    roots.append(sequence(True))
                    position[0] = end
                    count()  # skip the multiplier again
                for root in roots:
                    if current is None:
                        pending.append(root)
                    else:
                        molecule.bond(current, root)
                if first is None:
                    first = roots[0]
            elif kind == "atom" and value == "C":
                atom = molecule.add("C", count() if peek()[1] == "H" and take() else 0)
                if current is not None:
                    molecule.bond(current, atom, order)
                    order = 1
                for root in pending:
                    molecule.bond(atom, root)
                pending = []
                current = atom
                if first is None:
                    first = atom
            elif kind == "atom" and value == "H":
                # a leading H of HO-: the O comes next
                if peek() != ("atom", "O"):
                    raise ValueError(f"a lone H in {text!r}")
                take()
                atom = molecule.add("O", 1)
                if current is None:
                    pending.append(atom)
                else:
                    molecule.bond(current, atom)
                if first is None:
                    first = atom
            elif kind == "atom":
                hydrogens = 0
                if value == "O" and peek()[1] == "H":
                    take()
                    hydrogens = count()
                copies = 1 if hydrogens else count()  # CCl2: two Cl atoms on that carbon
                for _ in range(copies):
                    atom = molecule.add(value, hydrogens)
                    if current is None:
                        pending.append(atom)
                    else:
                        molecule.bond(current, atom)
                    if first is None:
                        first = atom
            else:
                raise ValueError(f"cannot read {text!r} (unexpected {value!r})")
        if pending and current is None and stop_at_close and len(pending) == 1:
            return pending[0]  # a bracketed substituent such as (OH) or (Br)
        if pending:
            raise ValueError(f"{text!r} has groups with no carbon to join")
        if first is None:
            raise ValueError(f"empty group in {text!r}")
        return first

    sequence(False)
    if position[0] != len(tokens):
        raise ValueError(f"unmatched ) in {text!r}")
    molecule.check_valence(text)
    return molecule


def _carbocation_degree(molecule, carbon):
    return sum(1 for j, _ in molecule.neighbours(carbon) if molecule.elements[j] == "C")


def product(alkene_text, reagent):
    """The (major) addition product of the alkene with the reagent, as a Molecule."""
    alkene = parse_structure(alkene_text)
    doubles = [key for key, order in alkene.bonds.items() if order == 2]
    if len(doubles) != 1 or any(alkene.elements[i] != "C" for i in doubles[0]):
        raise ValueError(f"{alkene_text!r} must have exactly one C=C")
    a, b = doubles[0]
    reagent_formula = cp.parse_formula(reagent)
    if reagent_formula.counts in ({x: 2} for x in HALOGENS):
        (halogen,) = reagent_formula.counts
        result = alkene.copy()
        result.bonds[(a, b)] = 1
        result.bond(a, result.add(halogen))
        result.bond(b, result.add(halogen))
        return result
    adds = {frozenset({("H", 1), (x, 1)}): (x, 0) for x in HALOGENS}
    adds[frozenset({("H", 2), ("O", 1)})] = ("O", 1)
    key = frozenset(reagent_formula.counts.items())
    if key not in adds:
        raise ValueError(f"{reagent!r} is not a reagent this lesson adds")
    element, hydrogens = adds[key]
    options = []
    for h_carbon, cation in ((a, b), (b, a)):
        result = alkene.copy()
        result.bonds[(a, b)] = 1
        result.hydrogens[h_carbon] += 1
        result.bond(cation, result.add(element, hydrogens))
        options.append((_carbocation_degree(alkene, cation), result))
    (degree_1, first), (degree_2, second) = options
    if degree_1 != degree_2:
        return first if degree_1 > degree_2 else second
    if first.canonical() != second.canonical():
        raise ValueError(f"{alkene_text!r} + {reagent}: both carbocations are equally stable, so no single major product")
    return first


_CE = re.compile(r"\\ce\s*\{((?:[^{}]|\{[^{}]*\})*)\}")


def _species(text):
    text = text.strip()
    if re.match(r"\d+\s*(?=[A-Z(])", text):
        raise AssertionError(f"{text!r}: every coefficient in this addition is 1")
    return text


def verify(id_, value):
    setup = CHECKS[id_]
    expected = product(setup["alkene"], setup["reagent"]).canonical()
    blocks = _CE.findall(str(value))
    if len(blocks) != 1:
        raise ValueError(f"expected one \\ce{{...}} in {value!r}")
    body = cp.normalise(blocks[0])
    if "<=>" in body or "⇌" in body:
        raise AssertionError(f"{value!r}: use a one-way arrow")
    if "->" not in body:
        if parse_structure(_species(body)).canonical() != expected:
            raise AssertionError(f"{value!r} is not the major product")
        return
    left, right = body.split("->", 1)
    reactants = [_species(s) for s in re.split(r"\s\+\s", left)]
    products = [_species(s) for s in re.split(r"\s\+\s", right)]
    if len(reactants) != 2 or len(products) != 1:
        raise AssertionError(f"{value!r}: an addition has two reactants and one product")
    alkene = parse_structure(setup["alkene"]).canonical()
    reagent = cp.parse_formula(setup["reagent"])
    matched = False
    for first, second in (reactants, reactants[::-1]):
        try:
            same_alkene = parse_structure(first).canonical() == alkene
        except (ValueError, AssertionError):
            continue
        if same_alkene and cp.parse_species(second)[0] == reagent:
            matched = True
    if not matched:
        raise AssertionError(f"{value!r}: the reactants are not {setup['alkene']} and {setup['reagent']}")
    if parse_structure(products[0]).canonical() != expected:
        raise AssertionError(f"{value!r}: {products[0]} is not the major product")
