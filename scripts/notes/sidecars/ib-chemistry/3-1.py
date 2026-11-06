"""Answer checks for IB Chemistry lesson 3.1 (the periodic table and periodicity). Not shipped to the browser.

No verify kind reads an electron configuration or a position in the periodic table, so these answers use this sidecar.

- Configurations copy the approach of 1-4.py: `ground_state(Z, charge)` builds the ground state from first principles
  for Z <= 36 (Aufbau order 1s 2s 2p 3s 3p 4s 3d 4p, Pauli capacities, the Cr and Cu exceptions; a cation loses its
  highest-n electrons first, an anion keeps filling). The published text is read sublevel by sublevel, a noble-gas core
  is expanded, and the occupancies must match. "Gallium: <configuration>" also checks the element named before the colon.
- Positions are computed from Z the same way: the period is the highest occupied main level; the block is the sublevel
  the Aufbau filling ends in (helium is s-block); the group is the s count (s-block), 2 + the d count (d-block) or
  12 + the p count (p-block), with helium in group 18. The published text must state "period P" and "group G" and,
  when the id asks for them, the block ("p-block") and type (metal, metalloid or non-metal, using the usual metalloid
  list B, Si, Ge, As, Sb, Te). A named element ("Manganese:" or \\ce{Mn}) must be the element with that Z.
- "Extreme" checks: the option species must be the one with the largest (or smallest) value of a data-booklet property
  among the options offered: radius (section 10, transcribed below) or first ionization energy (chem_data.IE1).
A readable but wrong answer is an AssertionError (so it can stand as a distractor); unreadable text is a ValueError.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import chem_data  # noqa: E402
import mathparse  # noqa: E402,F401  (kept for the shared sidecar contract)

SYMBOLS = ("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr").split()
NAMES = ("hydrogen helium lithium beryllium boron carbon nitrogen oxygen fluorine neon sodium magnesium aluminium silicon "
         "phosphorus sulfur chlorine argon potassium calcium scandium titanium vanadium chromium manganese iron cobalt "
         "nickel copper zinc gallium germanium arsenic selenium bromine krypton").split()
ORDER = ["1s", "2s", "2p", "3s", "3p", "4s", "3d", "4p"]
CAPACITY = {"s": 2, "p": 6, "d": 10, "f": 14}
LETTERS = "spdf"
CORES = {"He": 2, "Ne": 10, "Ar": 18, "Kr": 36}
METALLOIDS = {"B", "Si", "Ge", "As", "Sb", "Te"}
NON_METALS = {"H", "He", "C", "N", "O", "F", "Ne", "P", "S", "Cl", "Ar", "Se", "Br", "Kr"}

#: Data booklet section 10, radii in 10^-12 m: atomic (covalent) radius for an atom, ionic radius for an ion.
RADIUS = {
    ("Li", 0): 130, ("Na", 0): 160, ("Mg", 0): 140, ("Al", 0): 124, ("Si", 0): 114, ("P", 0): 109, ("S", 0): 104,
    ("Cl", 0): 100, ("Ar", 0): 101, ("K", 0): 200, ("Ca", 0): 174, ("F", 0): 60, ("Br", 0): 117,
    ("Li", 1): 76, ("Na", 1): 102, ("K", 1): 138, ("Mg", 2): 72, ("Ca", 2): 100, ("Al", 3): 54,
    ("O", -2): 140, ("F", -1): 133, ("S", -2): 184, ("Cl", -1): 181, ("Br", -1): 196,
}


def _fill(electrons):
    occupancy, left = {}, electrons
    for sub in ORDER:
        if left <= 0:
            break
        take = min(left, CAPACITY[sub[1]])
        occupancy[sub] = take
        left -= take
    if left > 0:
        raise ValueError(f"{electrons} electrons is beyond Z = 36")
    return occupancy


def ground_state(z, charge=0):
    """{sublevel: electrons} for element Z with the given ion charge (positive for cations)."""
    atom = _fill(z)
    if z == 24:
        atom.update({"4s": 1, "3d": 5})
    if z == 29:
        atom.update({"4s": 1, "3d": 10})
    if charge < 0:
        return _fill(z - charge)
    occupancy = dict(atom)
    for _ in range(charge):
        sub = max((s for s, n in occupancy.items() if n > 0), key=lambda s: (int(s[0]), LETTERS.index(s[1])))
        occupancy[sub] -= 1
    return {s: n for s, n in occupancy.items() if n > 0}


def position(z):
    """(period, group, block, type) of element Z <= 36, from its electron configuration."""
    filled = _fill(z)
    period = max(int(sub[0]) for sub in filled)
    last = list(filled)[-1]
    block = "s" if z == 2 else last[1]
    if z == 2:
        group = 18
    elif block == "s":
        group = filled[last]
    elif block == "d":
        group = 2 + filled[last]
    else:
        group = 12 + filled[last]
    symbol = SYMBOLS[z - 1]
    kind = "metalloid" if symbol in METALLOIDS else "non-metal" if symbol in NON_METALS else "metal"
    return period, group, block, kind


def _clean(tex):
    text = str(tex).replace("$", " ").strip()
    text = re.sub(r"\\(?:mathrm|text|textrm)\s*", "", text)
    text = re.sub(r"\\[,;:!]|\\quad|~", " ", text)
    text = text.replace("{", "").replace("}", "")
    if ":" in text:
        text = text.rsplit(":", 1)[1]
    return text.strip()


TOKEN = re.compile(r"\s*(\d)([spdf])\s*\^?\s*(\d+)\s*")


def read_configuration(tex):
    """(core symbol or None, {sublevel: electrons}) as written. Impossible sublevels raise AssertionError."""
    text = _clean(tex)
    core = None
    match = re.match(r"\s*\[(He|Ne|Ar|Kr)\]\s*", text)
    if match:
        core = match.group(1)
        text = text[match.end():]
    occupancy, pos = {}, 0
    if core:
        occupancy.update(_fill(CORES[core]))
    written = []
    while pos < len(text):
        token = TOKEN.match(text, pos)
        if not token:
            raise ValueError(f"cannot read the configuration {tex!r} at {text[pos:]!r}")
        n, letter, count = int(token.group(1)), token.group(2), int(token.group(3))
        sub = f"{n}{letter}"
        if LETTERS.index(letter) >= n:
            raise AssertionError(f"{tex!r}: there is no {sub} sublevel")
        if count > CAPACITY[letter]:
            raise AssertionError(f"{tex!r}: {sub} holds at most {CAPACITY[letter]} electrons, not {count}")
        if sub in written or (core and sub in occupancy):
            raise AssertionError(f"{tex!r}: {sub} is written twice")
        written.append(sub)
        occupancy[sub] = count
        pos = token.end()
    if not written and not core:
        raise ValueError(f"no configuration in {tex!r}")
    return core, {s: n for s, n in occupancy.items() if n > 0}


def _named_element(text):
    """Z of the element named in the text (a name or a \\ce{} symbol), or None."""
    words = re.findall(r"[a-z]+", re.sub(r"\\ce\{[^}]*\}", " ", str(text)).lower())
    named = [NAMES.index(word) + 1 for word in words if word in NAMES]
    symbol = re.search(r"\\ce\{\s*([A-Z][a-z]?)\s*\}", str(text))
    if symbol:
        if symbol.group(1) not in SYMBOLS:
            raise ValueError(f"unknown element {symbol.group(1)!r}")
        named.append(SYMBOLS.index(symbol.group(1)) + 1)
    if len(set(named)) > 1:
        raise AssertionError(f"{text!r} names more than one element")
    return named[0] if named else None


def check_configuration(tex, z, charge=0, form="any", named=False):
    if named:
        head = str(tex).split(":", 1)[0] if ":" in str(tex) else ""
        found = _named_element(head)
        if found is None:
            raise ValueError(f"{tex!r}: name the element before the colon")
        if found != z:
            raise AssertionError(f"{tex!r} names element {found}, not element {z}")
    core, published = read_configuration(tex)
    want = ground_state(z, charge)
    if published != want:
        raise AssertionError(f"{tex!r} is {published}, not the ground state {want}")
    if form == "full" and core:
        raise AssertionError(f"{tex!r}: the full configuration writes every sublevel, with no [{core}] core")


def check_position(text, z, need=()):
    period, group, block, kind = position(z)
    plain = str(text).replace("$", " ")
    got_period = re.search(r"period\s*(\d+)", plain, re.I)
    got_group = re.search(r"group\s*(\d+)", plain, re.I)
    if not got_period or not got_group:
        raise ValueError(f"{text!r}: state the period and the group")
    if int(got_period.group(1)) != period:
        raise AssertionError(f"{text!r}: period {got_period.group(1)}, not {period}")
    if int(got_group.group(1)) != group:
        raise AssertionError(f"{text!r}: group {got_group.group(1)}, not {group}")
    got_block = re.search(r"\b([spdf])-block", plain)
    if got_block and got_block.group(1) != block:
        raise AssertionError(f"{text!r}: {got_block.group(1)}-block, not {block}-block")
    if "block" in need and not got_block:
        raise ValueError(f"{text!r}: state the block")
    got_kind = re.search(r"metalloid|non-metal|metal", plain, re.I)
    if got_kind and got_kind.group(0).lower() != kind:
        raise AssertionError(f"{text!r}: a {got_kind.group(0)}, not a {kind}")
    if "type" in need and not got_kind:
        raise ValueError(f"{text!r}: state metal, metalloid or non-metal")
    found = _named_element(plain.split(":", 1)[0] if ":" in plain else plain)
    if found is not None and found != z:
        raise AssertionError(f"{text!r} names element {found}, not element {z}")
    if "element" in need and found is None:
        raise ValueError(f"{text!r}: name the element")


def _species(tex):
    match = re.fullmatch(r"\s*\$?\s*\\ce\{\s*([A-Z][a-z]?)\s*(?:\^\{?\s*(\d*)\s*([+-])\s*\}?)?\s*\}\s*\$?\s*", str(tex))
    if not match:
        raise ValueError(f"cannot read a species in {tex!r}")
    symbol, size, sign = match.groups()
    charge = int(size or 1) * (1 if sign == "+" else -1) if sign else 0
    return symbol, charge


def _value(prop, species):
    if prop == "radius":
        if species not in RADIUS:
            raise ValueError(f"no data booklet radius transcribed for {species}")
        return RADIUS[species]
    if prop == "IE1":
        symbol, charge = species
        if charge:
            raise ValueError("first ionization energy is for atoms")
        return chem_data.IE1(symbol)
    raise ValueError(f"unknown property {prop!r}")


def check_extreme(tex, prop, which, candidates):
    species = _species(tex)
    pool = [_species(option) for option in candidates]
    if species not in pool:
        raise ValueError(f"{tex!r} is not one of the options")
    values = {item: _value(prop, item) for item in pool}
    best = (max if which == "max" else min)(values, key=values.get)
    if species != best:
        raise AssertionError(f"{tex!r} has {prop} {values[species]}, but {best} has {values[best]}")


#: id -> (Z, charge, form, named) for a configuration answer
CONFIGS = {
    "before-sulfur-config": (16, 0, "full", False),
    "ex-config-from-position": (31, 0, "full", True),
    "check-config-group-5": (23, 0, "any", False),
}
#: id -> (Z, what the answer must state besides period and group)
POSITIONS = {
    "ex-germanium-position": (32, ("block", "type")),
    "ex-position-from-config": (25, ("block", "element")),
    "check-position-from-config": (34, ()),
}
#: id -> (property, "max" or "min", the options offered)
EXTREMES = {
    "check-largest-species": ("radius", "max", [r"$\ce{S^2-}$", r"$\ce{Cl^-}$", r"$\ce{K^+}$", r"$\ce{Ca^2+}$"]),
    "check-highest-ie": ("IE1", "max", [r"$\ce{N}$", r"$\ce{P}$", r"$\ce{As}$", r"$\ce{Si}$"]),
}

CHECKS = {
    **{key: "configuration" for key in CONFIGS},
    **{key: "position in the table" for key in POSITIONS},
    **{key: "largest or smallest data-booklet value" for key in EXTREMES},
}


def verify(id_, value, tolerance=None):
    if id_ in CONFIGS:
        z, charge, form, named = CONFIGS[id_]
        return check_configuration(value, z, charge, form, named)
    if id_ in POSITIONS:
        return check_position(value, *POSITIONS[id_])
    if id_ in EXTREMES:
        return check_extreme(value, *EXTREMES[id_])
    raise KeyError(f"no assertion for {id_}")


if __name__ == "__main__":
    assert position(32) == (4, 14, "p", "metalloid")
    assert position(25) == (4, 7, "d", "metal")
    assert position(34) == (4, 16, "p", "non-metal")
    assert position(2) == (1, 18, "s", "non-metal")
    assert position(24) == (4, 6, "d", "metal")
    assert position(29) == (4, 11, "d", "metal")
    assert position(31) == (4, 13, "p", "metal")
    check_position("Period 4, group 14, p-block; a metalloid.", 32, ("block", "type"))
    check_position("Manganese: period 4, group 7, d-block.", 25, ("block", "element"))
    check_configuration(r"Gallium: $\mathrm{1s^{2}\,2s^{2}\,2p^{6}\,3s^{2}\,3p^{6}\,4s^{2}\,3d^{10}\,4p^{1}}$", 31, 0, "full", True)
    check_extreme(r"$\ce{S^2-}$", *EXTREMES["check-largest-species"])
    check_extreme(r"$\ce{N}$", *EXTREMES["check-highest-ie"])
    print("ok")
