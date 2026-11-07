"""Answer checks for IB Chemistry lesson 2.1 (the ionic model). Not shipped to the browser.

Only the electron-configuration answers need a sidecar: no verify kind reads a configuration such as
$\\mathrm{[Ar]\\,3d^{9}}$. This copies the approach of 1-4.py: `ground_state(Z, charge)` builds the ground-state
configuration from first principles for Z <= 36 (Aufbau order 1s 2s 2p 3s 3p 4s 3d 4p, Pauli capacities, the Cr and Cu
exceptions; a cation loses electrons from the highest n first, so 4s before 3d; an anion keeps filling). The published
text is read sublevel by sublevel, a noble-gas core is expanded, and the occupancies must match. A readable but wrong
configuration is an AssertionError (so it can stand as a distractor); unreadable text is a ValueError.

ex-phosphide-ion asks for the ion's charge as well: its answer is "$\\ce{P^3-}$: $\\mathrm{...}$", and the species
before the colon must be phosphorus with charge 3-, the charge the configuration step deduces.
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
        sub = max((s for s, n in occupancy.items() if n > 0), key=lambda s: (int(s[0]), LETTERS.index(s[1])))
        occupancy[sub] -= 1
    return {s: n for s, n in occupancy.items() if n > 0}


def _clean(text):
    text = str(text).strip().strip("$").strip()
    text = re.sub(r"\\(?:mathrm|text|textrm)\s*", "", text)
    text = re.sub(r"\\[,;:!]|\\quad|~", " ", text)
    return text.replace("{", "").replace("}", "").strip()


TOKEN = re.compile(r"\s*(\d)([spdf])\s*\^?\s*(\d+)\s*")


def read_configuration(tex):
    """(core symbol or None, {sublevel: electrons}) as written. Impossible sublevels raise AssertionError."""
    text = _clean(tex)
    core = None
    match = re.match(r"\s*\[(He|Ne|Ar|Kr)\]\s*", text)
    occupancy = {}
    if match:
        core = match.group(1)
        text = text[match.end():]
        occupancy.update(_fill(CORES[core]))
    written, pos = [], 0
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


def check_configuration(tex, z, charge=0, form="any"):
    core, published = read_configuration(tex)
    want = ground_state(z, charge)
    if published != want:
        raise AssertionError(f"{tex!r} is {published}, not the ground state {want}")
    if form == "full" and core:
        raise AssertionError(f"{tex!r}: the full configuration writes every sublevel, with no [{core}] core")


def _species(tex):
    match = re.fullmatch(r"\s*\$?\s*\\ce\{\s*([A-Z][a-z]?)\s*(?:\^\{?\s*(\d*)\s*([+-])\s*\}?)?\s*\}\s*\$?\s*", str(tex))
    if not match:
        raise ValueError(f"cannot read a species in {tex!r}")
    symbol, size, sign = match.groups()
    if symbol not in SYMBOLS:
        raise ValueError(f"unknown element {symbol!r}")
    charge = int(size or 1) * (1 if sign == "+" else -1) if sign else 0
    return SYMBOLS.index(symbol) + 1, charge


def check_ion_and_configuration(tex, z, charge, form="any"):
    """"$\\ce{X^n-}$: $configuration$": the species must be element z with this charge, then the configuration."""
    text = str(tex)
    if ":" not in text:
        raise ValueError(f"{tex!r}: write the ion, a colon, then its configuration")
    species, config = text.split(":", 1)
    got = _species(species)
    if got != (z, charge):
        raise AssertionError(f"{species.strip()!r} is Z = {got[0]} with charge {got[1]}, not Z = {z} with charge {charge}")
    check_configuration(config, z, charge, form)


#: id -> (Z, charge, form) for a configuration answer
CONFIGS = {
    "check-copper-ion": (29, 2, "any"),
}
#: id -> (Z, charge, form) for an "ion: configuration" answer
IONS = {
    "ex-phosphide-ion": (15, -3, "full"),
}

CHECKS = {**{key: "configuration" for key in CONFIGS}, **{key: "ion and configuration" for key in IONS}}


def verify(id_, value, tolerance=None):
    if id_ in CONFIGS:
        return check_configuration(value, *CONFIGS[id_])
    if id_ in IONS:
        return check_ion_and_configuration(value, *IONS[id_])
    raise KeyError(f"no assertion for {id_}")


if __name__ == "__main__":
    assert ground_state(29, 2) == {"1s": 2, "2s": 2, "2p": 6, "3s": 2, "3p": 6, "3d": 9}
    assert ground_state(15, -3) == ground_state(18)
    check_configuration(r"$\mathrm{[Ar]\,3d^{9}}$", 29, 2)
    check_ion_and_configuration(r"$\ce{P^3-}$: $\mathrm{1s^{2}\,2s^{2}\,2p^{6}\,3s^{2}\,3p^{6}}$", 15, -3, "full")
    for wrong in (r"$\mathrm{[Ar]\,4s^{2}\,3d^{7}}$", r"$\mathrm{[Ar]\,4s^{1}\,3d^{8}}$", r"$\mathrm{[Ar]\,3d^{10}}$"):
        try:
            check_configuration(wrong, 29, 2)
        except AssertionError:
            continue
        raise SystemExit(f"{wrong} passed")
    print("ok")
