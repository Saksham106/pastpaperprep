"""Read chemical formulas and equations as a student sees them (mhchem `\\ce{}`, plain LaTeX or plain text) and balance them.

Used by the `formula` and `chem-equation` verify kinds (verify_kinds.py) and the data booklet helpers (chem_data.py).
Every reader raises ValueError for text it cannot read; it never guesses.

Notation (the published text is read the way mhchem renders it, so the gate checks what the student sees)
  Digits after a symbol or a bracket are subscripts:     H2SO4, Ca(OH)2, [Cu(H2O)6]^2+
  A charge needs ^ or stands alone at the end:            Fe^3+, Fe^{3+}, SO4^2-, OH-, H+, NH4+, e-, e^-
  So `Fe3+` is Fe3 with charge 1+ (that is how \\ce{Fe3+} renders); write Fe^3+.
  Hydrates join with . or * or a middle dot:              CuSO4.5H2O, CuSO4*5H2O, CuSO4·5H2O, CuSO4\\cdot 5H2O
  State symbols:                                          (s) (l) (g) (aq)
  Species are separated by " + " with spaces (as in mhchem); coefficients go in front: 2H2O, 1/2O2, ½O2, \\frac{1}{2}O2.
  Arrows: -> → \\rightarrow \\longrightarrow \\to (one way); <=> ⇌ \\rightleftharpoons (equilibrium).
  mhchem conditions over an arrow (->[\\Delta], <=>[catalyst]) are ignored.

Lenient ion notation (data booklet helpers only, never published text): "Al3+", "Fe2+", "O2-", "SO4 2-", "Cu2+/Cu".
A single element followed by digits and a sign is that ion's charge, and a charge may follow a space.
"""
import re
from fractions import Fraction
from math import gcd

_SUB = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")
_SUP = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻", "0123456789+-")
_VULGAR = {"½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4"}


def _unwrap(text: str, command: str) -> str:
    """\\command{...} -> ... (brace-matched, every occurrence)."""
    pattern = re.compile(r"\\" + command + r"\s*\{")
    while True:
        match = pattern.search(text)
        if not match:
            return text
        depth, i = 1, match.end()
        while i < len(text) and depth:
            depth += {"{": 1, "}": -1}.get(text[i], 0)
            i += 1
        if depth:
            raise ValueError(f"unbalanced braces after \\{command} in {text!r}")
        text = text[: match.start()] + " " + text[match.end(): i - 1] + " " + text[i:]


def last_block(text: str, command: str = "ce"):
    """The contents of the last \\ce{...} (or \\pu{...}) in text, or None."""
    found = None
    for match in re.finditer(r"\\" + command + r"\s*\{", text):
        depth, i = 1, match.end()
        while i < len(text) and depth:
            depth += {"{": 1, "}": -1}.get(text[i], 0)
            i += 1
        if depth:
            raise ValueError(f"unbalanced braces after \\{command} in {text!r}")
        found = text[match.end(): i - 1]
    return found


def normalise(text: str) -> str:
    """mhchem / LaTeX / Unicode chemistry -> one plain notation: H2O, Fe^3+, 1/2O2, CuSO4·5H2O, ->, <=>."""
    text = str(text).replace("$", " ")
    text = text.replace("−", "-").replace("–", "-").replace("‐", "-").replace("‑", "-")
    for glyph, plain in _VULGAR.items():
        text = text.replace(glyph, f" {plain}")
    text = text.translate(_SUB)
    text = re.sub(r"[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+", lambda m: "^" + m.group(0).translate(_SUP), text)
    text = re.sub(r"\\[td]?frac\s*\{\s*(\d+)\s*\}\s*\{\s*(\d+)\s*\}", r" \1/\2", text)
    text = re.sub(r"\\[td]?frac\s*(\d)(\d)", r" \1/\2", text)
    text = re.sub(r"\\xrightarrow\s*(?:\[[^\]]*\])?\s*\{[^{}]*\}", " -> ", text)
    text = re.sub(r"\\xrightleftharpoons\s*(?:\[[^\]]*\])?\s*\{[^{}]*\}", " <=> ", text)
    for command in ("ce", "pu", "mathrm", "text", "textrm", "mathit", "mathbf", "operatorname"):
        text = _unwrap(text, command)
    text = re.sub(r"\\(?:rightleftharpoons|leftrightharpoons|rightleftarrows|leftrightarrows|longleftrightarrow|rightleftharpoon)(?![A-Za-z])", " <=> ", text)
    text = re.sub(r"\\(?:longrightarrow|rightarrow|to)(?![A-Za-z])", " -> ", text)
    text = re.sub(r"\\(?:cdot|bullet|centerdot)(?![A-Za-z])", "·", text)
    text = re.sub(r"\\(?:left|right|rm|displaystyle)(?![A-Za-z])", "", text)
    text = re.sub(r"\\[,;:! ]|\\q?quad(?![A-Za-z])|~", " ", text)
    text = text.replace("⇌", " <=> ").replace("⇄", " <=> ").replace("⟶", " -> ").replace("→", " -> ")
    text = re.sub(r"<<=>|<=>>|<->", lambda m: " <=> " if m.group(0) != "<->" else " <-> ", text)
    text = re.sub(r"_\s*\{\s*([^{}]*?)\s*\}", r"\1", text)
    text = re.sub(r"_\s*(\d)", r"\1", text)
    text = re.sub(r"\^\s*\{\s*([^{}]*?)\s*\}", lambda m: "^" + m.group(1).replace(" ", ""), text)
    text = text.replace("{", " ").replace("}", " ")
    text = re.sub(r"(->|<=>)\s*\[[^\]]*\](?:\s*\[[^\]]*\])?", r"\1", text)  # mhchem ->[heat][cat]
    return re.sub(r"\s+", " ", text).strip()


class Formula:
    """A chemical species: element counts, charge and its written form (for match: "exact")."""

    def __init__(self, counts, charge=0, text=""):
        self.counts = {element: int(n) for element, n in counts.items() if n}
        self.charge = int(charge)
        self.text = text or self.hill()

    @property
    def is_electron(self):
        return not self.counts and self.charge == -1

    def key(self):
        return (tuple(sorted(self.counts.items())), self.charge)

    def hill(self) -> str:
        """Hill order: C, H, then alphabetical (alphabetical when there is no carbon), with the charge."""
        order = sorted(self.counts, key=lambda e: (0, e) if e == "C" else (1, e) if e == "H" and "C" in self.counts else (2, e))
        body = "".join(f"{e}{self.counts[e] if self.counts[e] != 1 else ''}" for e in order) or "e"
        return body + charge_text(self.charge)

    def __eq__(self, other):
        return isinstance(other, Formula) and self.key() == other.key()

    def __hash__(self):
        return hash(self.key())

    def __repr__(self):
        return f"Formula({self.text})"

    __str__ = __repr__


def charge_text(charge: int) -> str:
    if not charge:
        return ""
    return "^" + (str(abs(charge)) if abs(charge) != 1 else "") + ("+" if charge > 0 else "-")


def _elements():
    from chem_data import AR  # noqa: PLC0415 - avoid a circular import
    return AR


def _parse_body(body: str, original: str):
    """Element counts of a formula body without charge or state: Ca(OH)2, [Cu(H2O)6], CuSO4·5H2O."""
    elements = _elements()
    total = {}
    for part in re.split(r"\s*[.·*•]\s*", body):
        match = re.match(r"(\d+)\s*(?=[A-Z(\[])", part)
        multiplier = int(match.group(1)) if match else 1
        part = part[match.end():] if match else part
        counts, end = _parse_group(part, 0, original, elements)
        if end != len(part) or not part:
            raise ValueError(f"cannot read {original!r} as a formula (stuck at {part[end:] or 'an empty part'!r})")
        for element, n in counts.items():
            total[element] = total.get(element, 0) + multiplier * n
    return total


def _parse_group(text, i, original, elements):
    counts = {}
    while i < len(text):
        ch = text[i]
        if ch in "([":
            inner, i = _parse_group(text, i + 1, original, elements)
            closer = ")" if ch == "(" else "]"
            if i >= len(text) or text[i] not in ")]":
                raise ValueError(f"unclosed bracket in {original!r}")
            if text[i] != closer:
                raise ValueError(f"mismatched brackets in {original!r}: {ch!r} closed by {text[i]!r}")
            i += 1
        elif ch in ")]":
            return counts, i
        elif ch.isupper():
            match = re.match(r"[A-Z][a-z]?", text[i:])
            symbol = match.group(0)
            if symbol not in elements:
                raise ValueError(f"{symbol!r} in {original!r} is not an element symbol")
            inner, i = {symbol: 1}, i + len(symbol)
        else:
            return counts, i
        digits = re.match(r"\d+", text[i:])
        n = int(digits.group(0)) if digits else 1
        i += len(digits.group(0)) if digits else 0
        for element, k in inner.items():
            counts[element] = counts.get(element, 0) + k * n
    return counts, i


_STATE = re.compile(r"\s*\(\s*(s|l|g|aq)\s*\)\s*$")


def parse_species(text: str, lenient: bool = False):
    """(Formula, state or None) of one species written without a coefficient: H2O(l), Fe^3+(aq), e-, CuSO4·5H2O.

    lenient=True reads booklet-style ion names: "Al3+" (a lone element's digits are its charge), "SO4 2-" (a charge
    after a space). Published text is always read strictly, the way mhchem renders it."""
    original = text
    text = normalise(text)
    state = None
    match = _STATE.search(text)
    if match:
        state, text = match.group(1), text[: match.start()].strip()
    charge, body = 0, text
    caret = re.search(r"\^\(?(\d*)([+-])\)?$|\^\(?([+-])(\d+)\)?$", text)
    spaced = re.search(r"\s+(\d*)([+-])$", text) if lenient else None
    bare = re.search(r"(?<=[A-Za-z0-9)\]])([+-]+)$", text)
    if caret:
        digits, sign = (caret.group(1), caret.group(2)) if caret.group(2) else (caret.group(4), caret.group(3))
        charge, body = (int(digits) if digits else 1) * (1 if sign == "+" else -1), text[: caret.start()]
    elif spaced:
        charge, body = (int(spaced.group(1)) if spaced.group(1) else 1) * (1 if spaced.group(2) == "+" else -1), text[: spaced.start()]
    elif bare:
        signs = bare.group(1)
        if len(set(signs)) != 1:
            raise ValueError(f"cannot read the charge of {original!r}")
        charge, body = len(signs) * (1 if signs[0] == "+" else -1), text[: bare.start()]
        lone = re.fullmatch(r"([A-Z][a-z]?)(\d+)", body)
        if lenient and lone:
            body, charge = lone.group(1), int(lone.group(2)) * (1 if charge > 0 else -1)
    body = body.strip()
    if body == "e":
        if charge != -1:
            raise ValueError(f"an electron has charge 1-, not {original!r}")
        return Formula({}, -1, "e^-"), state
    if not body or not re.fullmatch(r"[A-Za-z0-9()\[\].·*• ]+", body) or " " in body.strip():
        raise ValueError(f"cannot read {original!r} as a chemical formula")
    counts = _parse_body(body, original)
    written = re.sub(r"\s+", "", body).replace("*", "·").replace(".", "·").replace("•", "·") + charge_text(charge)
    return Formula(counts, charge, written), state


def parse_formula(text: str, lenient: bool = False) -> Formula:
    return parse_species(text, lenient)[0]


# ------------------------------------------------------------------------------------------------------------ equations

class Side(list):
    """[(coefficient Fraction, Formula, state or None, coefficient written?)] for one side of an equation."""


_COEFFICIENT = re.compile(r"(\d+\s*/\s*\d+|\d+(?:\.\d+)?)\s*(?=[A-Z(\[]|e\b|e[-^])")


def _parse_side(text: str, original: str) -> Side:
    side = Side()
    if not text.strip():
        raise ValueError(f"{original!r} has an empty side")
    for piece in re.split(r"(?<=\S)\s+\+\s+(?=\S)", text.strip()):
        piece = piece.strip()
        match = _COEFFICIENT.match(piece)
        coefficient, written = Fraction(1), False
        if match:
            coefficient, written = Fraction(match.group(1).replace(" ", "")), True
            piece = piece[match.end():].strip()
        if coefficient <= 0:
            raise ValueError(f"{original!r}: a coefficient must be positive")
        try:
            formula, state = parse_species(piece)
        except ValueError as error:
            if "+" in piece.rstrip("+") and " + " not in piece:
                raise ValueError(f"cannot read {piece!r} in {original!r}: separate species with ' + ' (spaces around the +), as mhchem does") from error
            raise
        side.append((coefficient, formula, state, written))
    return side


def parse_equation(text: str):
    """(left Side, arrow "->" or "<=>", right Side) of a chemical equation. The equation is the last \\ce{} block
    holding an arrow, or the whole text when there is no \\ce{}."""
    original = text
    blocks = []
    for match in re.finditer(r"\\ce\s*\{", text):
        depth, i = 1, match.end()
        while i < len(text) and depth:
            depth += {"{": 1, "}": -1}.get(text[i], 0)
            i += 1
        blocks.append(text[match.end(): i - 1])
    with_arrow = [block for block in blocks if re.search(r"->|<=>|<->|\\(?:right|long)|→|⇌", block)]
    if blocks and not with_arrow:
        raise ValueError(f"{original!r} has no \\ce{{}} equation with an arrow")
    plain = normalise(f"\\ce{{{with_arrow[-1]}}}" if with_arrow else text)
    if "<->" in plain:
        raise ValueError(f"{original!r} uses <-> (resonance); an equation needs -> or <=>")
    if re.search(r"(?<![<-])<-(?!>)", plain):
        raise ValueError(f"{original!r} uses a backwards arrow; write reactants on the left")
    arrows = re.findall(r"<=>|->", plain)
    if len(arrows) != 1:
        raise ValueError(f"{original!r} must hold exactly one reaction arrow (-> or ⇌), found {len(arrows)}")
    left, right = re.split(r"<=>|->", plain)
    if re.search(r"(?<![<>-])=(?![>])", left + right):
        raise ValueError(f"{original!r}: use an arrow, not =")
    return _parse_side(left, original), arrows[0], _parse_side(right, original)


def imbalance(left: Side, right: Side):
    """[(element or "charge", left total, right total)] where the equation does not balance (empty when it does)."""
    out = []
    for name in sorted({e for _, f, _, _ in left + right for e in f.counts} | {"charge"}):
        lhs = sum(c * (f.counts.get(name, 0) if name != "charge" else f.charge) for c, f, _, _ in left)
        rhs = sum(c * (f.counts.get(name, 0) if name != "charge" else f.charge) for c, f, _, _ in right)
        if lhs != rhs:
            out.append((name, lhs, rhs))
    return out


def balance(left: Side, right: Side):
    """The coefficients (left then right) that balance the skeleton, smallest whole numbers. ValueError when it cannot be
    balanced with every species taking part, or balances in more than one independent way."""
    from sympy import Matrix, ilcm  # noqa: PLC0415

    species = [f for _, f, _, _ in left] + [f for _, f, _, _ in right]
    names = sorted({e for f in species for e in f.counts}) + ["charge"]
    rows = [[(1 if i < len(left) else -1) * (f.counts.get(name, 0) if name != "charge" else f.charge) for i, f in enumerate(species)] for name in names]
    basis = Matrix(rows).nullspace()
    if not basis:
        raise ValueError("the skeleton cannot be balanced (check the species and charges)")
    if len(basis) > 1:
        raise ValueError(f"the skeleton balances in {len(basis)} independent ways; give the truth with its coefficients (e.g. \"2MnO4^- + 5H2O2 + 6H^+ -> ...\")")
    vector = basis[0]
    scale = ilcm(*[value.q for value in vector])
    numbers = [int(value * scale) for value in vector]
    if any(n == 0 for n in numbers):
        raise ValueError("the skeleton balances only if a species drops out; remove it")
    if not (all(n > 0 for n in numbers) or all(n < 0 for n in numbers)):
        raise ValueError("the skeleton balances only with a species on the other side; check which side each species is on")
    common = 0
    for n in numbers:
        common = gcd(common, abs(n))
    return [Fraction(abs(n) // common) for n in numbers]

