"""Answer checks for IB Chemistry lesson 3.4 (ionization energy trends and transition elements). Not shipped to the browser.

Copied from the 1.4 sidecar (same rules), with this lesson's ids.

Only the electron-configuration answers need a sidecar: no verify kind reads a configuration such as
$\\mathrm{[Ar]\\,4s^{1}\\,3d^{5}}$. `ground_state(Z, charge)` builds the ground-state configuration from first
principles for Z <= 36: fill 1s 2s 2p 3s 3p 4s 3d 4p in order (Aufbau), cap each sublevel at 2 x its orbitals (Pauli),
apply the two exceptions up to Z = 36 (Cr 4s1 3d5, Cu 4s1 3d10), then for a cation remove electrons from the highest n
first (4p, then 4s, then 3d) and for an anion keep filling. The published text is read sublevel by sublevel, a noble-gas
core is expanded, and the occupancies must match. `form` "full" refuses a noble-gas core; "condensed" requires the core
of the noble gas just before the element. A readable but impossible configuration (1p, 2d, 2p^8) is WRONG
(AssertionError), so it can stand as a distractor; unreadable text is a ValueError.
Everything else in the lesson uses its declarative `verify` block.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import mathparse  # noqa: E402,F401  (kept for the shared sidecar contract)

SYMBOLS = ("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr").split()
ORDER = ["1s", "2s", "2p", "3s", "3p", "4s", "3d", "4p"]
CAPACITY = {"s": 2, "p": 6, "d": 10, "f": 14}
LETTERS = "spdf"
CORES = {"He": 2, "Ne": 10, "Ar": 18, "Kr": 36}


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
        # highest n first; within one n, the higher sublevel (p before s) first
        sub = max((s for s, n in occupancy.items() if n > 0), key=lambda s: (int(s[0]), LETTERS.index(s[1])))
        occupancy[sub] -= 1
    return {s: n for s, n in occupancy.items() if n > 0}


def _clean(tex):
    text = str(tex).strip().strip("$")
    text = re.sub(r"\\(?:mathrm|text|textrm)\s*", "", text)
    text = re.sub(r"\\[,;:!]|\\quad|~", " ", text)
    text = text.replace("{", "").replace("}", "")
    if ":" in text:
        text = text.rsplit(":", 1)[1]
    if "=" in text:
        text = text.rsplit("=", 1)[1]
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
            raise AssertionError(f"{tex!r}: there is no {sub} sublevel (level {n} has only {n} sublevels)")
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


def check_configuration(tex, z, charge=0, form="any"):
    core, published = read_configuration(tex)
    want = ground_state(z, charge)
    if published != want:
        raise AssertionError(f"{tex!r} is {published}, not the ground state {want}")
    if form == "full" and core:
        raise AssertionError(f"{tex!r}: the full configuration writes every sublevel, with no [{core}] core")
    if form == "condensed":
        expected = max((name for name, count in CORES.items() if count < z), key=CORES.get)
        if core != expected:
            raise AssertionError(f"{tex!r}: the condensed form starts from [{expected}]")


def _species(tex):
    match = re.fullmatch(r"\s*\$?\s*\\ce\{\s*([A-Z][a-z]?)\s*(?:\^\{?\s*(\d*)\s*([+-])\s*\}?)?\s*\}\s*\$?\s*", str(tex))
    if not match:
        raise ValueError(f"cannot read a species in {tex!r}")
    symbol, size, sign = match.groups()
    if symbol not in SYMBOLS:
        raise ValueError(f"unknown element {symbol!r}")
    charge = int(size or 1) * (1 if sign == "+" else -1) if sign else 0
    return SYMBOLS.index(symbol) + 1, charge


#: id -> (Z, charge, form) for a configuration answer
CONFIGS = {
    "before-iron-atom": (26, 0, "condensed"),
    "ex-vanadium-ion": (23, 3, "any"),
    "check-copper1-config": (29, 1, "any"),
}
#: id -> (Z, charge): the option naming a species must have this configuration
SPECIES = {
    "check-same-as-mn2": (25, 2),
}

CHECKS = {**{key: "configuration" for key in CONFIGS}, **{key: "species" for key in SPECIES}}


def verify(id_, value, tolerance=None):
    if id_ in CONFIGS:
        z, charge, form = CONFIGS[id_]
        return check_configuration(value, z, charge, form)
    if id_ in SPECIES:
        z, charge = _species(value)
        want = ground_state(*SPECIES[id_])
        got = ground_state(z, charge)
        if got != want:
            raise AssertionError(f"{value!r} has configuration {got}, not {want}")
        return None
    raise KeyError(f"no assertion for {id_}")


if __name__ == "__main__":
    assert ground_state(24) == {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "4s": 1, "3d": 5}
    assert ground_state(26, 2) == {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 6}
    assert ground_state(16, -2) == ground_state(18)
    assert ground_state(31, 3) == {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 10}
    check_configuration(r"$\mathrm{[Ar]\,4s^{1}\,3d^{5}}$", 24)
    check_configuration(r"$\mathrm{[Ar]\,3d^{2}}$", 23, 3)
    check_configuration(r"$\mathrm{[Ar]\,3d^{10}}$", 29, 1)
    assert ground_state(26, 3) == ground_state(25, 2)
    print("ok")
