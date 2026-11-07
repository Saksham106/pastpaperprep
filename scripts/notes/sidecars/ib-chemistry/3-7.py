"""Answer checks for IB Chemistry lesson 3.7 (IUPAC names and structural isomers). Not shipped to the browser.

No verify kind reads an organic name, so this sidecar works from structures. Every structure is the condensed
structural formula the question prints (CH3CH(CH3)CH2CH3, (CH3)3COH, CH2=CHCH2OH), read into an acyclic molecular graph
by `read_condensed`, or a name read into a graph by `read_name`. Then:
  - `iupac_name(mol)` names the graph from first principles, for the guide's scope (acyclic, saturated or one C=C, up to
    six carbons in the parent chain, one type of functional group: halogeno, hydroxyl, carbonyl or carboxyl; straight
    alkyl branches). Parent chain: most principal groups, then most C=C, then longest, then most substituents (the 1979
    order); the 2013 order (longest before most C=C) is also computed and a compound where the two disagree is refused,
    so the lesson never relies on a rule the editions differ on. Numbering: lowest locants to the suffix group, then
    the C=C, then all prefixes together, then the prefix cited first alphabetically. Prefixes are cited alphabetically
    ignoring di/tri/tetra. A name is correct only if it is one of `accepted_names(mol)`: the canonical form, the
    all-locants form (prop-1-ene beside propene) and propan-2-one / butanone beside propanone / butan-2-one.
  - `isomers(formula, family)` enumerates every acyclic structure with that molecular formula (all trees on the heavy
    atoms, then every placement of the C=C / C=O bonds the hydrogen count needs), deduplicated by a canonical graph
    string, so isomer counts and lists are computed, never typed in.
  - `isomer_type(a, b)`, `degree(mol)` (primary / secondary / tertiary: carbons on the C bearing OH or X, carbons on N for
    amines) and `family(mol)` answer the classification questions.
A wrong name, structure, count or label raises AssertionError; text that cannot be read raises ValueError.
The explanation examples use their declarative `verify` blocks.
"""
import re
import sys
from itertools import combinations
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import mathparse  # noqa: E402,F401  (kept for the shared sidecar contract)

VALENCE = {"C": 4, "N": 3, "O": 2, "F": 1, "Cl": 1, "Br": 1, "I": 1}
HALO = {"F": "fluoro", "Cl": "chloro", "Br": "bromo", "I": "iodo"}
STEMS = {1: "meth", 2: "eth", 3: "prop", 4: "but", 5: "pent", 6: "hex"}
ALKYL = {1: "methyl", 2: "ethyl", 3: "propyl", 4: "butyl"}
MULT = {1: "", 2: "di", 3: "tri", 4: "tetra"}
DEGREE = {0: "primary", 1: "primary", 2: "secondary", 3: "tertiary"}


# ------------------------------------------------------------------------------------------------ molecular graphs

class Mol:
    def __init__(self):
        self.el, self.h, self.bonds = [], [], {}

    def add(self, el, h=0):
        self.el.append(el)
        self.h.append(h)
        return len(self.el) - 1

    def bond(self, i, j, order=1):
        key = frozenset((i, j))
        self.bonds[key] = self.bonds.get(key, 0) + order

    def nbrs(self, i):
        return [next(iter(key - {i})) for key in self.bonds if i in key]

    def order(self, i, j):
        return self.bonds.get(frozenset((i, j)), 0)

    def free(self, i):
        return VALENCE[self.el[i]] - self.h[i] - sum(o for key, o in self.bonds.items() if i in key)

    def fill_h(self):
        for i in range(len(self.el)):
            self.h[i] = 0
            self.h[i] = self.free(i)
            if self.h[i] < 0:
                raise ValueError(f"atom {i} ({self.el[i]}) has too many bonds")
        return self

    def validate(self):
        if any(self.free(i) != 0 for i in range(len(self.el))):
            bad = [f"{self.el[i]}{i}:{self.free(i)}" for i in range(len(self.el)) if self.free(i)]
            raise ValueError(f"valences not satisfied ({', '.join(bad)})")
        if len(self.bonds) != len(self.el) - 1:
            raise ValueError("only acyclic molecules are handled")
        seen, stack = {0}, [0]
        while stack:
            for n in self.nbrs(stack.pop()):
                if n not in seen:
                    seen.add(n)
                    stack.append(n)
        if len(seen) != len(self.el):
            raise ValueError("molecule is not connected")
        return self

    def formula(self):
        counts = {"C": 0, "H": sum(self.h)}
        for el in self.el:
            counts[el] = counts.get(el, 0) + 1
        return {k: v for k, v in counts.items() if v}


def canon(m):
    """A string equal for two graphs exactly when they are the same structure (trees: minimum over all roots)."""
    def rec(v, parent):
        kids = sorted(("=" if m.order(v, c) == 2 else "-") + rec(c, v) for c in m.nbrs(v) if c != parent)
        return f"{m.el[v]}{m.h[v]}(" + ",".join(kids) + ")"
    return min(rec(r, None) for r in range(len(m.el)))


def carbon_skeleton(m):
    sk = Mol()
    index = {}
    for i, el in enumerate(m.el):
        if el == "C":
            index[i] = sk.add("C")
    for key in m.bonds:
        a, b = tuple(key)
        if a in index and b in index:
            sk.bond(index[a], index[b])
    return canon(sk)


def parse_formula(text):
    text = re.sub(r"\\ce\{([^}]*)\}", r"\1", str(text)).replace("$", "").strip()
    out = {}
    for el, n in re.findall(r"(Cl|Br|[CHNOFI])(\d*)", text):
        out[el] = out.get(el, 0) + int(n or 1)
    if not out or "".join(f"{e}{n}" for e, n in re.findall(r"(Cl|Br|[CHNOFI])(\d*)", text)) != text.replace(" ", ""):
        raise ValueError(f"cannot read the formula {text!r}")
    return out


# ------------------------------------------------------------------------------------------------ condensed formulas

_TOKEN = re.compile(r"Cl|Br|C|N|O|F|I|H\d*|\(|\)\d*|=")


def _tokens(text):
    text = re.sub(r"\\ce\s*\{(.*)\}", r"\1", str(text).strip().strip("$").strip()).replace(" ", "")
    tokens, pos = [], 0
    while pos < len(text):
        m = _TOKEN.match(text, pos)
        if not m:
            raise ValueError(f"cannot read {text[pos:]!r} in the condensed formula {text!r}")
        tokens.append(m.group(0))
        pos = m.end()
    return tokens


def read_condensed(text):
    """CH3CH(OH)CH3, (CH3)3CBr, CH3COCH2CH3, CH3CH2COOH, CH2=CHCH3, CH3CH2NHCH3 -> Mol. A carbonyl O is an O with no H
    written after a carbon that still has two free bonds; an ether / ester O is one written where it can only be single."""
    tokens = _tokens(text)
    m = Mol()

    def atom_at(pos):
        lead_h = 0
        while pos < len(tokens) and tokens[pos].startswith("H"):
            lead_h += int(tokens[pos][1:] or 1)
            pos += 1
        if pos >= len(tokens) or tokens[pos] not in VALENCE:
            raise ValueError(f"expected an atom in {text!r}")
        el, pos = tokens[pos], pos + 1
        h = lead_h
        while pos < len(tokens) and tokens[pos].startswith("H"):
            h += int(tokens[pos][1:] or 1)
            pos += 1
        return el, h, pos

    def chain(pos):
        last, pending, order, first = None, [], 1, None
        while pos < len(tokens) and not tokens[pos].startswith(")"):
            if tokens[pos] == "=":
                order, pos = 2, pos + 1
                continue
            if tokens[pos] == "(":
                start = pos + 1
                pos, branch = chain(start)
                if pos >= len(tokens):
                    raise ValueError(f"unclosed bracket in {text!r}")
                copies = [branch] + [chain(start)[1] for _ in range(int(tokens[pos][1:] or 1) - 1)]
                pos += 1
                for b in copies:
                    if last is None:
                        pending.append(b)
                    else:
                        m.bond(last, b)
                continue
            el, h, pos = atom_at(pos)
            i = m.add(el, h)
            if last is None:
                first = last = i
                for b in pending:
                    m.bond(i, b)
                pending = []
                continue
            pendant = (el in HALO or (el == "O" and h == 1) or (el == "N" and h == 2)
                       or (el == "O" and h == 0 and m.el[last] == "C" and m.free(last) >= 2 and order == 1))
            if el == "O" and h == 0 and pendant:
                m.bond(last, i, 2)
            else:
                m.bond(last, i, order)
                if not pendant:
                    last = i
            order = 1
        if pending:
            raise ValueError(f"a bracketed group has nothing to attach to in {text!r}")
        if first is None:
            raise ValueError(f"empty group in {text!r}")
        return pos, first

    pos, _ = chain(0)
    if pos != len(tokens):
        raise ValueError(f"unbalanced brackets in {text!r}")
    return m.validate()


# ------------------------------------------------------------------------------------------------ naming

def _analyse(m):
    halo, hydroxyl, carbonyl = [], [], []
    for i, el in enumerate(m.el):
        if el == "C":
            continue
        nb = m.nbrs(i)
        if any(m.el[n] != "C" for n in nb) or el == "N":
            raise ValueError("only C, O and halogen compounds are named in this lesson")
        if el in HALO:
            halo.append((nb[0], HALO[el]))
        elif len(nb) == 2:
            raise ValueError("ethers and esters are not named in this lesson")
        elif m.order(i, nb[0]) == 2:
            carbonyl.append(nb[0])
        else:
            hydroxyl.append(nb[0])
    acid = [c for c in carbonyl if c in hydroxyl]
    alcohol = [c for c in hydroxyl if c not in acid]
    aldehyde = [c for c in carbonyl if c not in acid and m.h[c] >= 1]
    ketone = [c for c in carbonyl if c not in acid and m.h[c] == 0]
    types = [name for name, group in (("acid", acid), ("aldehyde", aldehyde), ("ketone", ketone), ("alcohol", alcohol), ("halo", halo)) if group]
    if len(types) > 1:
        raise ValueError(f"more than one type of functional group ({types}): outside the guide's naming scope")
    enes = [tuple(key) for key, o in m.bonds.items() if o == 2 and all(m.el[a] == "C" for a in key)]
    if len(enes) > 1:
        raise ValueError("only mono-unsaturated compounds are named in this lesson")
    principal = acid or aldehyde or ketone or alcohol
    kind = types[0] if types and types[0] != "halo" else None
    return kind, principal, halo, enes


def _path(m, a, b):
    parent, stack = {a: None}, [a]
    while stack:
        v = stack.pop()
        for n in m.nbrs(v):
            if m.el[n] == "C" and n not in parent:
                parent[n] = v
                stack.append(n)
    out, v = [], b
    while v is not None:
        out.append(v)
        v = parent[v]
    return out[::-1]


def _branches(m, chain):
    """[(chain carbon, alkyl name)] for every carbon branch; refuses branched or substituted branches."""
    inside, out = set(chain), []
    for c in chain:
        for n in m.nbrs(c):
            if m.el[n] != "C" or n in inside:
                continue
            length, prev, cur = 1, c, n
            while True:
                if any(m.el[x] != "C" for x in m.nbrs(cur)) or any(m.order(cur, x) == 2 for x in m.nbrs(cur)):
                    raise ValueError("a functional group or C=C on a branch: outside this lesson's scope")
                nxt = [x for x in m.nbrs(cur) if x != prev]
                if not nxt:
                    break
                if len(nxt) > 1:
                    raise ValueError("branched substituents are outside this lesson's scope")
                length, prev, cur = length + 1, cur, nxt[0]
            out.append((c, ALKYL[length]))
    return out


def iupac_name(m, full=False):
    kind, principal, halo, enes = _analyse(m)
    carbons = [i for i, el in enumerate(m.el) if el == "C"]
    if not carbons:
        raise ValueError("no carbon")
    chains = {}
    for a in carbons:
        for b in carbons:
            chains[(a, b)] = _path(m, a, b)

    def keys(chain):
        s = set(chain)
        nsuf = sum(1 for c in principal if c in s)
        nene = sum(1 for e in enes if set(e) <= s)
        subs = sum(1 for c, _ in halo if c in s) + sum(1 for c in chain for n in m.nbrs(c) if m.el[n] == "C" and n not in s)
        return (nsuf, nene, len(chain), subs), (nsuf, len(chain), nene, subs)

    k79 = {k: keys(p)[0] for k, p in chains.items()}
    k13 = {k: keys(p)[1] for k, p in chains.items()}
    best79 = {frozenset(chains[k]) for k in chains if k79[k] == max(k79.values())}
    best13 = {frozenset(chains[k]) for k in chains if k13[k] == max(k13.values())}
    if best79 != best13:
        raise ValueError("the 1979 and 2013 parent-chain rules disagree for this compound: avoid it")
    candidates = [chains[k] for k in chains if frozenset(chains[k]) in best79]
    best = None
    for chain in candidates:
        s = set(chain)
        if any(c not in s for c in principal) or any(not set(e) <= s for e in enes) or any(c not in s for c, _ in halo):
            raise ValueError("a group lies off the parent chain: outside this lesson's scope")
        if len(chain) > 6:
            raise ValueError("parent chain longer than six carbons")
        pos = {c: i + 1 for i, c in enumerate(chain)}
        prefixes = [(name, pos[c]) for c, name in halo] + [(name, pos[c]) for c, name in _branches(m, chain)]
        key = (sorted(pos[c] for c in principal), sorted(min(pos[a], pos[b]) for a, b in enes),
               sorted(loc for _, loc in prefixes), [loc for _, loc in sorted(prefixes)])
        if best is None or key < best[0]:
            best = (key, chain, prefixes)
    (suffix_locs, ene_locs, _, _), chain, prefixes = best
    n = len(chain)
    groups = {}
    for name, loc in prefixes:
        groups.setdefault(name, []).append(loc)
    n_groups = len(prefixes) + len(suffix_locs)
    omit = n == 1 or (not full and n == 2 and n_groups <= 1)
    loc = (lambda locs: "") if omit else (lambda locs: ",".join(map(str, sorted(locs))) + "-")
    prefix = "-".join(loc(groups[g]) + MULT[len(groups[g])] + g for g in sorted(groups))
    stem = STEMS[n]
    k = len(suffix_locs)
    if enes:
        omit_ene = not full and (n == 2 or (n == 3 and not k))
        unsat = "en" if omit_ene else f"-{ene_locs[0]}-en"
    else:
        unsat = "an"
    if kind is None:
        tail = "e"
    elif kind in ("aldehyde", "acid"):
        word = "al" if kind == "aldehyde" else "oic acid"
        tail = word if k == 1 else "e" + MULT[k] + word
    else:
        word = "ol" if kind == "alcohol" else "one"
        locs = "" if omit else "-" + ",".join(map(str, suffix_locs)) + "-"
        tail = locs + word if k == 1 else "e" + locs + MULT[k] + word
    name = prefix + stem + unsat + tail
    if name == "propan-2-one" and not full:
        name = "propanone"
    return name


def accepted_names(m):
    names = {iupac_name(m), iupac_name(m, full=True)}
    if "butan-2-one" in names:
        names.add("butanone")
    return names


_PREFIX = re.compile(r"(?:(\d+(?:,\d+)*)-)?(di|tri|tetra)?(fluoro|chloro|bromo|iodo|methyl|ethyl|propyl|butyl)-?")
_REST = re.compile(r"(?:an|-(?P<en>\d+)-en|en)(?P<e>e)?(?:-?(?P<sl>\d+(?:,\d+)*)-)?(?P<mult>di|tri)?(?P<suf>ol|one|al|oic acid)?")


def read_name(name):
    """A name -> Mol (lenient: whether the name is the CORRECT name is checked separately, by accepted_names)."""
    s = re.sub(r"\s+", " ", str(name).strip().strip("$").strip().lower().rstrip("."))
    s = re.sub(r"\\text\{([^}]*)\}", r"\1", s)
    prefixes = []
    while True:
        p = _PREFIX.match(s)
        if not p:
            break
        mult = {None: 1, "di": 2, "tri": 3, "tetra": 4}[p.group(2)]
        locs = [int(x) for x in p.group(1).split(",")] if p.group(1) else None
        if locs is not None and len(locs) != mult:
            raise ValueError(f"{name!r}: the number of locants does not match {p.group(2) or 'one group'}")
        prefixes.append((p.group(3), locs, mult))
        s = s[p.end():]
    stem = re.match(r"meth|eth|prop|but|pent|hex", s)
    if not stem:
        raise ValueError(f"cannot read the parent chain in {name!r}")
    n = {v: k for k, v in STEMS.items()}[stem.group(0)]
    rest = _REST.fullmatch(s[stem.end():])
    if not rest or (not rest.group("suf") and not rest.group("e")):
        raise ValueError(f"cannot read the ending of {name!r}")
    m = Mol()
    chain = [m.add("C") for _ in range(n)]
    for a, b in zip(chain, chain[1:]):
        m.bond(a, b)

    def at(loc):
        if not 1 <= loc <= n:
            raise AssertionError(f"{name!r}: locant {loc} is off a chain of {n} carbons")
        return chain[loc - 1]

    if not s[stem.end():].startswith("an"):
        e = int(rest.group("en") or 1)
        if e >= n:
            raise AssertionError(f"{name!r}: no C=C can start at carbon {e}")
        m.bond(at(e), at(e + 1))
    suf, mult = rest.group("suf"), {None: 1, "di": 2, "tri": 3}[rest.group("mult")]
    if suf:
        if rest.group("sl"):
            locs = [int(x) for x in rest.group("sl").split(",")]
        elif suf in ("al", "oic acid"):
            locs = [1, n][:mult]
        elif suf == "one":
            locs = [2]
        else:
            locs = [1] * mult
        if len(locs) != mult:
            raise ValueError(f"{name!r}: suffix locants do not match")
        for loc in locs:
            c = at(loc)
            if suf in ("al", "oic acid") and loc not in (1, n):
                raise AssertionError(f"{name!r}: an aldehyde or acid carbon must end the chain")
            o = m.add("O")
            m.bond(c, o, 1 if suf == "ol" else 2)
            if suf == "oic acid":
                m.bond(c, m.add("O"))
    for word, locs, k in prefixes:
        for loc in locs or [1] * k:
            c = at(loc)
            if word in ALKYL.values():
                length = {v: q for q, v in ALKYL.items()}[word]
                prev = c
                for _ in range(length):
                    nxt = m.add("C")
                    m.bond(prev, nxt)
                    prev = nxt
            else:
                m.bond(c, m.add({v: q for q, v in HALO.items()}[word]))
    try:
        m.fill_h()
    except ValueError as error:
        raise AssertionError(f"{name!r} describes an impossible structure ({error})") from None
    return m.validate()


def check_name(text, mol):
    got = _clean(text)
    if got not in accepted_names(mol):
        raise AssertionError(f"{text!r} is not the IUPAC name; expected {iupac_name(mol)!r}")


def _clean(text):
    s = str(text).strip().strip("$").strip()
    s = re.sub(r"\\text\{([^}]*)\}", r"\1", s)
    return re.sub(r"\s+", " ", s).lower().rstrip(".")


# ------------------------------------------------------------------------------------------------ isomers and classes

def family(m):
    els = set(m.el)
    if els <= {"C"}:
        return "alkene" if any(o == 2 for o in m.bonds.values()) else "alkane"
    if "N" in els:
        return "amine" if els <= {"C", "N"} and not any(o == 2 for o in m.bonds.values()) else "other"
    if els - {"C"} <= set(HALO):
        return "halogenoalkane" if not any(o == 2 for o in m.bonds.values()) else "other"
    if els - {"C"} == {"O"}:
        if any(o == 2 and "C" in (m.el[a] for a in k) and len({m.el[a] for a in k}) == 1 for k, o in m.bonds.items()):
            return "other"  # C=C with an oxygen group: not needed here
        oxygens = [i for i, el in enumerate(m.el) if el == "O"]
        carbonyl = [m.nbrs(o)[0] for o in oxygens if len(m.nbrs(o)) == 1 and m.order(o, m.nbrs(o)[0]) == 2]
        hydroxyl = [m.nbrs(o)[0] for o in oxygens if len(m.nbrs(o)) == 1 and m.order(o, m.nbrs(o)[0]) == 1]
        bridging = [o for o in oxygens if len(m.nbrs(o)) == 2]
        if len(oxygens) == 1:
            if bridging:
                return "ether"
            if hydroxyl:
                return "alcohol"
            return "aldehyde" if m.h[carbonyl[0]] else "ketone"
        if len(oxygens) == 2 and len(carbonyl) == 1:
            if hydroxyl == carbonyl:
                return "carboxylic acid"
            if bridging and carbonyl[0] in m.nbrs(bridging[0]):
                return "ester"
    return "other"


def isomers(formula, fam=None):
    """Every acyclic structure with this molecular formula (optionally only one family), as {canon: Mol}."""
    target = parse_formula(formula) if isinstance(formula, str) else formula
    heavy = sorted(el for el, k in target.items() if el != "H" for _ in range(k))
    if any(el not in VALENCE for el in heavy):
        raise ValueError(f"unsupported element in {formula!r}")
    doubles2 = sum(VALENCE[el] for el in heavy) - 2 * (len(heavy) - 1) - target.get("H", 0)
    if doubles2 < 0 or doubles2 % 2:
        raise ValueError(f"{formula!r} cannot be an acyclic molecule")
    doubles = doubles2 // 2

    def remaining_after(m):
        left = list(heavy)
        for el in m.el:
            left.remove(el)
        return tuple(left)

    states = {}
    for el in set(heavy):
        m = Mol()
        m.add(el)
        states[(canon(m), remaining_after(m))] = m
    for _ in range(len(heavy) - 1):
        new = {}
        for m in states.values():
            for el in set(remaining_after(m)):
                for i in range(len(m.el)):
                    if m.free(i) <= 0 or (VALENCE[el] < 1):
                        continue
                    c = Mol()
                    c.el, c.h, c.bonds = list(m.el), list(m.h), dict(m.bonds)
                    c.bond(i, c.add(el))
                    new[(canon(c), remaining_after(c))] = c
        states = new
    out = {}
    for tree in states.values():
        eligible = [k for k in tree.bonds if {tree.el[a] for a in k} <= {"C", "O"} and "C" in {tree.el[a] for a in k}]
        for chosen in combinations(eligible, doubles):
            m = Mol()
            m.el, m.h, m.bonds = list(tree.el), [0] * len(tree.el), dict(tree.bonds)
            for k in chosen:
                m.bonds[k] = 2
            if any(m.free(i) < 0 for i in range(len(m.el))):
                continue
            m.fill_h()
            if sum(m.h) != target.get("H", 0):
                continue
            m.validate()
            if fam is None or family(m) == fam:
                out[canon(m)] = m
    return out


def degree(m):
    """primary / secondary / tertiary for an alcohol, halogenoalkane or amine with one such group."""
    sites = []
    for i, el in enumerate(m.el):
        if el == "N":
            sites.append(("N", sum(1 for n in m.nbrs(i) if m.el[n] == "C")))
        elif el in HALO or (el == "O" and m.h[i] == 1 and m.order(i, m.nbrs(i)[0]) == 1):
            c = m.nbrs(i)[0]
            if el == "O" and any(m.el[x] == "O" and m.order(c, x) == 2 for x in m.nbrs(c)):
                continue  # the OH of a carboxyl group
            sites.append(("C", sum(1 for n in m.nbrs(c) if m.el[n] == "C")))
    if len(sites) != 1:
        raise ValueError("degree needs exactly one OH, halogen or amine N")
    kind, count = sites[0]
    if kind == "N":
        return {1: "primary", 2: "secondary", 3: "tertiary"}[count]
    return DEGREE[count]


def isomer_type(a, b):
    if a.formula() != b.formula():
        return "not isomers"
    if canon(a) == canon(b):
        return "same compound"
    if family(a) != family(b):
        return "functional group"
    if carbon_skeleton(a) != carbon_skeleton(b):
        if family(a) in ("alcohol", "halogenoalkane", "amine") and degree(a) != degree(b):
            raise ValueError("chain and position both change: ambiguous, avoid this pair")
        return "chain"
    return "position"


# ------------------------------------------------------------------------------------------------ the lesson's checks

CHECKS = {
    "ex-name-branched-alkane": ("name", "CH3CH(CH3)CH2CH(CH3)CH2CH3"),
    "ex-name-bromo-tie": ("name", "CH3CHBrCH2CH(CH3)CH3"),
    "check-name-longest-chain": ("name", "CH3CH(CH2CH3)CH2CH3"),
    "check-name-chloro": ("name", "CH3CHClCH(CH3)CH2CH3"),
    "ex-name-ketone": ("name", "CH3COCH2CH(CH3)CH3"),
    "ex-name-acid": ("name", "CH3CH2CH(CH3)COOH"),
    "check-name-alkene": ("name", "CH2=CHCH(CH3)CH3"),
    "check-structure-from-name": ("structure", "pentan-3-ol"),
    "ex-isomers-c5h12": ("isomer-names", "C5H12", None),
    "check-isomer-type": ("isomer-type", "CH2=CHCH2CH2CH3", "CH3CH=CHCH2CH3"),
    "check-count-c6h14": ("count", "C6H14", None),
    "check-isomer-of": ("isomer-of", "CH3COCH2CH2CH3"),
    "ex-name-classify": ("name-degree", "CH3CH2C(CH3)2Br"),
    "check-secondary-alcohol": ("has-degree", "secondary", "alcohol"),
    "check-amine-class": ("degree", "CH3CH2NHCH3"),
}
NUMERIC = {"check-count-c6h14": {"dp": 0}}

_DEGREE_WORDS = ("primary", "secondary", "tertiary")


def _split_names(text):
    s = _clean(text)
    return [part.strip() for part in re.split(r",\s+|\s+and\s+", s) if part.strip()]


def verify(id_, value, tolerance=None):
    if id_ not in CHECKS:
        raise KeyError(f"no assertion for {id_}")
    spec = CHECKS[id_]
    what = spec[0]
    if what == "name":
        return check_name(value, read_condensed(spec[1]))
    if what == "structure":
        want = read_name(spec[1])
        check_name(spec[1], want)
        if canon(read_condensed(value)) != canon(want):
            raise AssertionError(f"{value!r} is not {spec[1]}")
        return None
    if what == "isomer-names":
        want = {iupac_name(m) for m in isomers(spec[1], spec[2]).values()}
        got = _split_names(value)
        mols = [read_name(n) for n in got]
        for n, m in zip(got, mols):
            check_name(n, m)
        if len({canon(m) for m in mols}) != len(mols):
            raise AssertionError(f"{value!r} names one structure twice")
        if {iupac_name(m) for m in mols} != want:
            raise AssertionError(f"{value!r} is not the full list {sorted(want)}")
        return None
    if what == "isomer-type":
        truth = isomer_type(read_condensed(spec[1]), read_condensed(spec[2]))
        got = re.sub(r"\s+isomer(s|ism)?$", "", _clean(value))
        if got != truth:
            raise AssertionError(f"{value!r}: the pair are {truth} isomers")
        return None
    if what == "count":
        truth = len(isomers(spec[1], spec[2]))
        number = float(value) if not isinstance(value, str) else float(re.sub(r"[^0-9.]", "", value))
        if tolerance is not None and tolerance > 0.5:
            raise AssertionError("a count needs an exact answer")
        if abs(number - truth) > (tolerance or 0) or number != round(number):
            raise AssertionError(f"{value!r}: there are {truth} isomers")
        return None
    if what == "isomer-of":
        ref, m = read_condensed(spec[1]), read_name(value)
        check_name(value, m)
        kind = isomer_type(ref, m)
        if kind in ("not isomers", "same compound"):
            raise AssertionError(f"{value!r} is {kind.replace('same', 'the same')}, not a structural isomer")
        return None
    if what == "name-degree":
        m = read_condensed(spec[1])
        s = _clean(value)
        words = [w for w in _DEGREE_WORDS if re.search(rf"(?<![a-z]){w}(?![a-z])", s)]
        if words != [degree(m)]:
            raise AssertionError(f"{value!r}: the compound is {degree(m)}")
        name = re.split(r",\s+|;\s*|\s+is\s+", s)[0]
        return check_name(name, m)
    if what == "has-degree":
        m = read_name(value)
        check_name(value, m)
        if family(m) != spec[2]:
            raise AssertionError(f"{value!r} is not an {spec[2]}")
        if degree(m) != spec[1]:
            raise AssertionError(f"{value!r} is {degree(m)}, not {spec[1]}")
        return None
    if what == "degree":
        truth = degree(read_condensed(spec[1]))
        if _clean(value) != truth:
            raise AssertionError(f"{value!r}: it is {truth}")
        return None
    raise KeyError(f"unknown check type {what}")


def _self_test():
    """Known names (independent of the lesson) and invariants; runs on import, so a broken namer fails the gate."""
    known = {
        "CH4": "methane", "CH3CH2Cl": "chloroethane", "CH3CH2OH": "ethanol", "CH3CH2CH2OH": "propan-1-ol",
        "CH3CH(OH)CH3": "propan-2-ol", "(CH3)3COH": "2-methylpropan-2-ol", "CH3COCH3": "propanone",
        "CH3CH2COCH3": "butan-2-one", "HCHO": "methanal", "CH3CHO": "ethanal", "HCOOH": "methanoic acid",
        "CH3CH2CH2COOH": "butanoic acid", "CH2=CHCH3": "propene", "CH3CH=CHCH3": "but-2-ene",
        "CH2=C(CH3)CH3": "2-methylpropene", "CH3CHBrC(CH3)3": "3-bromo-2,2-dimethylbutane",
        "CH2BrCH2Br": "1,2-dibromoethane", "CH3CH2CH(CH2CH3)CH2CH3": "3-ethylpentane",
        "HOCH2CH2OH": "ethane-1,2-diol", "CH3CH(CH3)CH(CH3)CH2CH3": "2,3-dimethylpentane",
        "CH2=CHCH2OH": "prop-2-en-1-ol", "CH3COCH2COCH3": "pentane-2,4-dione",
        "CH3CH2CH2CH(CH3)CH2Cl": "1-chloro-2-methylpentane",
    }
    for formula, name in known.items():
        m = read_condensed(formula)
        assert iupac_name(m) == name, (formula, iupac_name(m), name)
        assert canon(read_name(name)) == canon(m), (name, formula)
    assert len(isomers("C4H10")) == 2 and len(isomers("C5H12")) == 3 and len(isomers("C6H14")) == 5
    assert len(isomers("C4H9Br")) == 4 and len(isomers("C4H10O", "alcohol")) == 4 and len(isomers("C4H10O", "ether")) == 3
    assert len(isomers("C4H8", "alkene")) == 3 and len(isomers("C5H10O", "aldehyde")) == 4 and len(isomers("C5H10O", "ketone")) == 3
    for f in ("C6H14", "C5H11Cl", "C5H12O", "C5H10O", "C5H10", "C4H8O2"):
        for m in isomers(f).values():
            try:
                name = iupac_name(m)
            except ValueError:
                continue
            assert canon(read_name(name)) == canon(m), (f, name)
    assert degree(read_condensed("(CH3)3CNH2")) == "primary" and degree(read_condensed("(CH3)3N")) == "tertiary"


_self_test()

if __name__ == "__main__":
    for key in CHECKS:
        print(key, CHECKS[key])
    print("ok")
