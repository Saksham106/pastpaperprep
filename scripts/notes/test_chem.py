"""Unit tests for the chemistry gate: chem_data.py (data booklet), chemparse.py and the chemistry verify kinds.
Run by scripts/notes/mathparse.test.ts (or directly with the SymPy venv). Each test_* raises on failure.

The booklet transcription test reads the private extracted page text in ../research/course-notes-chemistry and skips
itself when that folder is absent (as on CI).
"""
import re
import sys
import traceback
from pathlib import Path

from sympy import Rational

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import chem_data as cd  # noqa: E402
import chemparse as cp  # noqa: E402
import verify_kinds as vk  # noqa: E402


class Skip(Exception):
    pass


def fails(fn, *errors):
    errors = errors or (AssertionError, ValueError)
    try:
        fn()
    except errors:
        return
    raise AssertionError("expected a rejection, but it was accepted")


def passes(kind, truth, tex, **opts):
    vk.check({"kind": kind, "truth": truth, **opts}, tex, chemistry=True)


def wrong(kind, truth, tex, **opts):
    """Rejected as WRONG (AssertionError), as a multiple-choice distractor must be."""
    fails(lambda: vk.check({"kind": kind, "truth": truth, **opts}, tex, chemistry=True), AssertionError)


def unreadable(kind, truth, tex, **opts):
    fails(lambda: vk.check({"kind": kind, "truth": truth, **opts}, tex, chemistry=True), ValueError)


def truth(source, chemistry=True):
    return vk.evaluate_truth(source, chemistry=chemistry)


# ------------------------------------------------------------------------------------------------------- data booklet

def test_spot_checked_booklet_values():
    """Values read off the booklet PDF by eye (pages 7, 9, 12, 14, 17, 18, 19, 21, 23, 24)."""
    expected = {
        "R": Rational("8.31"), "NA": Rational("6.02e23"), "F": Rational("9.65e4"), "Kw": Rational("1.00e-14"),
        "c_water": Rational("4.18"), "Vm": Rational("22.7"), "h_planck": Rational("6.63e-34"), "c_light": Rational("3.00e8"),
        "e_charge": Rational("1.602177e-19"), "T_STP": Rational("273.15"), "T_SATP": Rational("298.15"), "P_std": 100,
        "Ar('H')": Rational("1.01"), "Ar('C')": Rational("12.01"), "Ar('O')": 16, "Ar('Cl')": Rational("35.45"),
        "Ar('Na')": Rational("22.99"), "Ar('Cu')": Rational("63.55"), "Ar('Fe')": Rational("55.85"), "Ar('I')": Rational("126.90"),
        "Ar('Pb')": Rational("207.20"), "Ar('Tc')": 98, "Ar('U')": Rational("238.03"),
        "BE('C-H')": 414, "BE('C=O')": 804, "BE('O=O')": 498, "BE('O-H')": 463, "BE('N#N')": 945, "BE('N≡N')": 945,
        "BE('H-C')": 414, "BE('C#O')": 1077, "BE('Cl-Cl')": 242, "BE('I-I')": 151,
        "Hf('CH4(g)')": -74, "Hf('H2O(l)')": -286, "Hf('H2O(g)')": -242, "Hf('steam')": -242, "Hf('CO2(g)')": -394,
        "Hf('but-1-ene')": Rational("0.1"), "Hf('C2H5OH(l)')": -278, "Gf('CH4(g)')": -50, "Gf('HI(g)')": 2,
        "S('CH4(g)')": 186, "S('H2O(l)')": 70, "S('dichloromethane')": 178,
        "Hc('CH4(g)')": -891, "Hc('C2H5OH(l)')": -1367, "Hc('octane')": -5470, "Hc('sucrose')": -5640, "Hc('C(s)')": -394,
        "Hc('(COOH)2')": -243,
        "lattice('NaCl')": 790, "lattice('LiF')": 1049, "lattice('CsI')": 613, "lattice('MgO')": 3791, "lattice('AgI')": 892,
        "E0('Cu2+/Cu')": Rational("0.34"), "E0('Zn2+/Zn')": Rational("-0.76"), "E0('Fe3+/Fe2+')": Rational("0.77"),
        "E0('MnO4-/Mn2+')": Rational("1.51"), "E0('Cr2O7 2-/Cr3+')": Rational("1.36"), "E0('Li+/Li')": Rational("-3.04"),
        "E0('F2/F-')": Rational("2.87"), "E0('H+/H2')": 0, "E0('O2/H2O')": Rational("1.23"), "E0('O2/OH-')": Rational("0.40"),
        "pKa_ind('methyl orange')": Rational("3.7"), "pKa_ind('phenolphthalein')": Rational("9.6"),
        "pKa_ind('bromothymol blue')": 7,
        "IE1('Na')": 496, "IE1('He')": 2372, "EA('Cl')": -349, "EA2('O')": 753, "EN('F')": 4, "EN('Cs')": Rational("0.8"),
    }
    for source, value in expected.items():
        got = truth(source)
        assert got == value, f"{source} = {got}, booklet {value}"
    assert truth("pH_range_ind('phenolphthalein')") == (8, 10)


def test_mr_reads_brackets_hydrates_and_charges():
    assert truth("Mr('H2SO4')") == Rational("98.09")
    assert truth("Mr('CuSO4·5H2O')") == Rational("249.72")
    assert truth("Mr('CuSO4.5H2O')") == truth("Mr('CuSO4*5H2O')") == truth("Mr('CuSO4·5H2O')")
    assert truth("Mr('Ca(OH)2')") == Rational("74.10")
    assert truth("Mr('Al2(SO4)3')") == Rational("342.17")
    assert truth("Mr('[Cu(H2O)6]^2+')") == Rational("63.55") + 6 * Rational("18.02")
    assert truth("Mr('SO4^2-')") == Rational("96.07")
    assert truth("0.250*Mr('NaOH')") == Rational("10.0")


def test_unknown_keys_raise_clear_errors():
    for source, hint in [("Ar('Xx')", "not in the IB Chemistry data booklet"), ("BE('C-Xe')", "not in"), ("Hf('unobtainium')", "not in"),
                         ("Hc('CH3OCH3(g)')", "not in"), ("lattice('NaAt')", "not in"), ("E0('Au3+/Au')", "not in"),
                         ("pKa_ind('litmus')", "not in"), ("Mr('Qz2')", "not an element"), ("Gf('pentane')", "no value"),
                         ("Hf('C4H8(g)')", "several booklet entries"), ("BE('CH')", "two element symbols"), ("EN('Ne')", "no electronegativity")]:
        try:
            truth(source)
        except ValueError as error:
            assert hint in str(error), f"{source}: {error}"
        else:
            raise AssertionError(f"{source} was accepted")
    try:
        truth("pKa_ind('methyl orang')")
    except ValueError as error:
        assert "methyl orange" in str(error)


def test_truths_stay_computed():
    vk.check_spec({"kind": "exact", "truth": "Mr('H2SO4')"})
    vk.check_spec({"kind": "rounded", "truth": "0.250*Mr('NaOH')", "sf": 3})
    for literal in ["98.08", "-890", "'CH4'"]:
        fails(lambda literal=literal: vk.check_spec({"kind": "exact", "truth": literal}), ValueError)
    fails(lambda: truth("sympify('2')"), ValueError)
    fails(lambda: truth("Symbol('x') + Mr('H2O')"), ValueError)  # text only as a helper's argument
    fails(lambda: truth("S('__import__(1)')"), ValueError)       # S with text is the entropy lookup, never sympify


def test_constants_only_in_chemistry_courses_and_s_stays_sympy():
    assert truth("R * 2") == Rational("16.62")
    assert str(truth("R * 2", chemistry=False)) == "2*R"  # a maths truth keeps R as a symbol
    assert str(truth("F + NA", chemistry=False)) == "F + NA"
    assert truth("S(1)/3", chemistry=False) == Rational(1, 3)
    assert str(truth("S.Reals", chemistry=False)) == "Reals"
    assert truth("Mr('H2O')", chemistry=False) == Rational("18.02")  # helpers work everywhere


def test_booklet_transcription_matches_the_extracted_pages():
    """Every transcribed number appears in its section's page text (in order, where the page lists rows in order)."""
    pages = None
    for base in (HERE.parents[2], HERE.parents[3], HERE.parents[4]):
        candidate = base / "research" / "course-notes-chemistry" / "extract" / "databooklet"
        if candidate.is_dir():
            pages = candidate
            break
    if pages is None:
        raise Skip("research/course-notes-chemistry is absent")
    page = lambda n: (pages / f"p{n:02d}.txt").read_text().replace("−", "-")  # noqa: E731

    p07 = page(7)
    for name, (mantissa, power, _) in cd.CONSTANTS.items():
        assert mantissa in p07, name
        if power not in (0,):
            assert f"10{power}" in p07, (name, power)
    p09 = page(9)
    for value, _ in cd.CONDITIONS.values():
        assert value in p09

    # p12: symbols and values in reading order, period by period ("All", "Cll", "Tll", "Fll" are the extractor's
    # doubled l). H and He sit either side of the legend, so they are read from the legend's line.
    p12 = page(12)
    assert re.search(r"\bH\b.*\n.*1\.01 Element 4\.00", p12, re.S) and cd.AR_PRINTED["H"] == "1.01" and cd.AR_PRINTED["He"] == "4.00"
    body = p12.split("Element 4.00", 1)[1].replace("Relative atomic", " ")
    symbols = [s for s in (re.sub(r"ll$", "l", token) for token in re.findall(r"\b[A-Z][a-z]?l?\b", body)) if s in cd.AR]
    values = re.findall(r"\(\d+\)|\b\d+\.\d\d\b", body)
    assert len(symbols) == len(values) == len(cd.AR) - 2, (len(symbols), len(values))
    assert dict(zip(symbols, values)) == {s: v for s, v in cd.AR_PRINTED.items() if s not in ("H", "He")}

    p14 = page(14).replace("- 2 0 5", "-205")  # the extractor spaces out Pt's EA; the PDF prints −205
    tokens14 = set(re.findall(r"[-+]?\d+(?:\.\d+)?", p14.replace("- ", "-")))
    for symbol, row in cd.PERIODIC_14.items():
        for value in row:
            assert value is None or value.lstrip("+") in tokens14, (symbol, value)
    for value in cd.EA2_PRINTED.values():
        assert f"({value})" in p14

    p17 = page(17)
    found = {}
    for a, bond, b, value in re.findall(r"([A-Z][a-z]?) (―|\|\||~~) ([A-Z][a-z]?) (\d+)", p17):
        found[f"{a}{ {'―': '-', '||': '=', '~~': '#'}[bond] }{b}".replace(" ", "")] = value
    assert found == cd.BONDS, set(found.items()) ^ set(cd.BONDS.items())

    p18 = page(18)
    rows = []
    for line in p18.splitlines():
        match = re.fullmatch(r"(.+?) (\S+) ([gls]) ((?:[-+]\d+(?:\.\d+)?\s*)+)", line.strip())
        if match:
            rows.append((match.group(1), match.group(2), match.group(3), match.group(4).split()))
    assert [(name, formula, state, [v for v in values if v]) for name, formula, state, *values in cd.THERMO] == rows

    p19 = page(19)
    combustion = re.findall(r"([a-z][a-z0-9,()\- ]*?) (\S+) ([gls]) (-\d+)", p19.split("kJ mol-1", 2)[-1])
    assert sorted(combustion) == sorted(cd.COMBUSTION), set(combustion) ^ set(cd.COMBUSTION)

    p21 = page(21)
    for metal, row in cd._HALIDES.items():
        assert f"{metal} {' '.join(row)}" in p21, metal
    for compound, value in cd.LATTICE.items():
        if compound[:2] not in ("Li", "Na", "Rb", "Cs") and not re.fullmatch(r"K(?:F|Cl|Br|I)", compound):
            assert f"{compound} {value}" in p21, compound

    p23 = page(23)
    for name, (pka, low, high, acid, alkali) in cd.INDICATORS.items():
        assert re.search(rf"{name} {re.escape(pka)} {re.escape(low)}\s*[-–]\s*{re.escape(high)} {acid} {alkali}", p23), name

    p24 = page(24)
    printed24 = re.findall(r"(?<![\d.])[-+]?\d\.\d\d(?=\s*$)", p24, flags=re.M)
    assert printed24 == [value for _, _, value in cd.REDUCTION], printed24


# -------------------------------------------------------------------------------------------------------- chemparse

def test_formulas_read_as_mhchem_renders_them():
    f = cp.parse_formula
    assert f(r"\ce{Fe^3+}").key() == f("Fe^{3+}").key() == ((("Fe", 1),), 3)
    assert f(r"\ce{SO4^2-}").charge == -2 and f(r"$\ce{SO4^{2-}}$").counts == {"S": 1, "O": 4}
    assert f("OH-").charge == -1 and f("NH4+").charge == 1 and f("H+").charge == 1
    assert f("e-").is_electron and f("e^-").is_electron
    assert f("Fe3+").counts == {"Fe": 3} and f("Fe3+").charge == 1  # \ce{Fe3+} renders Fe₃⁺: write Fe^3+
    assert f("Fe3+", lenient=True).key() == f("Fe^3+").key()      # booklet-style ion names in helpers only
    assert f("SO4 2-", lenient=True).key() == f("SO4^2-").key()
    assert f("CuSO4·5H2O").counts == {"Cu": 1, "S": 1, "O": 9, "H": 10}
    assert f("[Cu(H2O)6]^2+").counts == {"Cu": 1, "H": 12, "O": 6}
    assert f("H₂O").counts == {"H": 2, "O": 1} and f("SO₄²⁻").charge == -2
    for bad in ["Xx2", "H2O)", "Fe^3+-", "e^2-", "", "2 H2O"]:
        fails(lambda bad=bad: f(bad), ValueError)


def test_equations_and_arrows():
    left, arrow, right = cp.parse_equation(r"$\ce{2H2(g) + O2(g) -> 2H2O(l)}$")
    assert arrow == "->" and [c for c, *_ in left] == [2, 1] and right[0][2] == "l"
    for text in [r"\ce{N2 + 3H2 <=> 2NH3}", "N2 + 3H2 ⇌ 2NH3", r"N_2 + 3H_2 \rightleftharpoons 2NH_3"]:
        assert cp.parse_equation(text)[1] == "<=>", text
    assert cp.parse_equation("2H2 + O2 → 2H2O")[1] == "->"
    assert cp.parse_equation(r"\ce{H2 + 1/2O2 -> H2O}")[0][1][0] == Rational(1, 2)
    assert cp.parse_equation(r"H2 + ½O2 → H2O")[0][1][0] == Rational(1, 2)
    assert cp.parse_equation(r"\ce{CaCO3 ->[\Delta] CaO + CO2}")[1] == "->"
    for bad in ["H2 + O2", "H2 + O2 = H2O", "H2 + O2 -> H2O -> X", r"\ce{A <-> B}", "H2+O2 -> H2O"]:
        fails(lambda bad=bad: cp.parse_equation(bad), ValueError)


def test_balancing_the_skeleton():
    assert cp.balance(*_sides("Fe2O3 + CO -> Fe + CO2")) == [1, 3, 2, 3]
    assert cp.balance(*_sides("MnO4^- + H^+ + e- -> Mn^2+ + H2O")) == [1, 8, 5, 1, 4]
    assert cp.balance(*_sides("C8H18 + O2 -> CO2 + H2O")) == [2, 25, 16, 18]
    fails(lambda: cp.balance(*_sides("H2O2 + MnO4^- + H^+ -> O2 + Mn^2+ + H2O")), ValueError)  # two independent ways
    fails(lambda: cp.balance(*_sides("H2 + O2 -> H2O2 + H2O")), ValueError)
    fails(lambda: cp.balance(*_sides("Na -> Cl")), ValueError)


def _sides(text):
    left, _, right = cp.parse_equation(text)
    return left, right


# ----------------------------------------------------------------------------------------------- chem-equation kind

def test_kind_chem_equation():
    truth = "Fe2O3 + CO -> Fe + CO2"
    passes("chem-equation", truth, r"$\ce{Fe2O3 + 3CO -> 2Fe + 3CO2}$")
    passes("chem-equation", truth, r"Fe2O3 + 3CO → 2Fe + 3CO2")
    passes("chem-equation", truth, r"$\ce{Fe2O3(s) + 3CO(g) -> 2Fe(l) + 3CO2(g)}$")  # states ignored by default
    wrong("chem-equation", truth, r"$\ce{Fe2O3 + 3CO -> 2Fe + 2CO2}$")               # unbalanced
    wrong("chem-equation", truth, r"$\ce{2Fe2O3 + 6CO -> 4Fe + 6CO2}$")              # not the smallest set
    passes("chem-equation", truth, r"$\ce{2Fe2O3 + 6CO -> 4Fe + 6CO2}$", allowMultiple=True)
    wrong("chem-equation", truth, r"$\ce{Fe2O3 + 3C -> 2Fe + 3CO}$")                 # wrong species
    wrong("chem-equation", truth, r"$\ce{2Fe + 3CO2 -> Fe2O3 + 3CO}$")               # sides swapped
    wrong("chem-equation", truth, r"$\ce{Fe2O3 + 3/2C -> 2Fe + 3/2CO2}$")


def test_kind_chem_equation_ions_charge_and_half_equations():
    half = "MnO4^- + H^+ + e- -> Mn^2+ + H2O"
    passes("chem-equation", half, r"$\ce{MnO4^- + 8H^+ + 5e^- -> Mn^2+ + 4H2O}$")
    passes("chem-equation", half, r"$\ce{MnO4- + 8H+ + 5e- -> Mn^{2+} + 4H2O}$")
    wrong("chem-equation", half, r"$\ce{MnO4- + 8H+ + 3e- -> Mn^2+ + 4H2O}$")       # atoms balance, charge does not
    wrong("chem-equation", half, r"$\ce{MnO4- + 8H+ + 5e- -> Mn^3+ + 4H2O}$")       # wrong charge on a species
    wrong("chem-equation", half, r"$\ce{MnO4- + 8H+ -> Mn^2+ + 4H2O + 5e-}$")       # electrons on the wrong side
    redox = "MnO4^- + H^+ + Fe^2+ -> Mn^2+ + H2O + Fe^3+"
    passes("chem-equation", redox, r"$\ce{MnO4^-(aq) + 8H^+(aq) + 5Fe^2+(aq) -> Mn^2+(aq) + 4H2O(l) + 5Fe^3+(aq)}$")
    wrong("chem-equation", redox, r"$\ce{MnO4^- + 8H^+ + Fe^2+ -> Mn^2+ + 4H2O + Fe^3+}$")
    passes("chem-equation", "CuSO4·5H2O -> CuSO4 + H2O", r"$\ce{CuSO4.5H2O(s) -> CuSO4(s) + 5H2O(g)}$")


def test_kind_chem_equation_ambiguous_skeleton_needs_coefficients():
    unreadable("chem-equation", "H2O2 + MnO4^- + H^+ -> O2 + Mn^2+ + H2O", r"$\ce{5H2O2 + 2MnO4^- + 6H^+ -> 5O2 + 2Mn^2+ + 8H2O}$")
    with_coefficients = "5H2O2 + 2MnO4^- + 6H^+ -> 5O2 + 2Mn^2+ + 8H2O"
    passes("chem-equation", with_coefficients, r"$\ce{5H2O2 + 2MnO4^- + 6H^+ -> 5O2 + 2Mn^2+ + 8H2O}$")
    wrong("chem-equation", with_coefficients, r"$\ce{3H2O2 + 2MnO4^- + 6H^+ -> 4O2 + 2Mn^2+ + 6H2O}$")  # balances, not proportional
    unreadable("chem-equation", "2H2 + O2 -> H2O", r"$\ce{2H2 + O2 -> 2H2O}$")  # a coefficient truth must balance


def test_kind_chem_equation_states_arrows_and_fractions():
    passes("chem-equation", "N2 + H2 -> NH3", r"$\ce{N2(g) + 3H2(g) <=> 2NH3(g)}$", reversible=True, states=True)
    wrong("chem-equation", "N2 + H2 -> NH3", r"$\ce{N2(g) + 3H2(g) -> 2NH3(g)}$", reversible=True)
    wrong("chem-equation", "N2 + H2 -> NH3", r"$\ce{N2 + 3H2 <=> 2NH3}$", reversible=False)
    passes("chem-equation", "N2 + H2 -> NH3", r"$\ce{N2 + 3H2 <=> 2NH3}$")  # either arrow without `reversible`
    wrong("chem-equation", "N2 + H2 -> NH3", r"$\ce{N2(g) + 3H2 <=> 2NH3(g)}$", states=True)  # a missing state
    states_truth = "C2H5OH(l) + O2(g) -> CO2(g) + H2O(l)"
    passes("chem-equation", states_truth, r"$\ce{C2H5OH(l) + 3O2(g) -> 2CO2(g) + 3H2O(l)}$", states=True)
    wrong("chem-equation", states_truth, r"$\ce{C2H5OH(l) + 3O2(g) -> 2CO2(g) + 3H2O(g)}$", states=True)
    combustion = "C2H6 + O2 -> CO2 + H2O"
    passes("chem-equation", combustion, r"$\ce{C2H6(g) + 7/2O2(g) -> 2CO2(g) + 3H2O(l)}$", fractions=True)
    passes("chem-equation", combustion, r"$\ce{C2H6 + \frac{7}{2}O2 -> 2CO2 + 3H2O}$", fractions=True)
    wrong("chem-equation", combustion, r"$\ce{2C2H6 + 7O2 -> 4CO2 + 6H2O}$", fractions=True)  # not per mole of ethane
    wrong("chem-equation", combustion, r"$\ce{C2H6 + 7/2O2 -> 2CO2 + 3H2O}$")                  # fractions not allowed
    passes("chem-equation", "H2 + O2 -> H2O", r"$\ce{H2(g) + 1/2O2(g) -> H2O(l)}$", fractions=True)  # formation: per mole of the product
    wrong("chem-equation", "H2 + O2 -> H2O", r"$\ce{2H2 + O2 -> 2H2O}$", fractions=True)
    passes("chem-equation", "H2 + O2 -> H2O", r"$\ce{2H2 + O2 -> 2H2O}$", fractions=True, per="O2")
    fails(lambda: vk.check_spec({"kind": "chem-equation", "truth": "H2 + O2 -> H2O", "fractions": True, "allowMultiple": True}), ValueError)
    fails(lambda: vk.check_spec({"kind": "chem-equation", "truth": "H2 + O2 -> H2O", "per": "O2"}), ValueError)


# ----------------------------------------------------------------------------------------------------- formula kind

def test_kind_formula():
    hexene = 'empirical_formula({"C": 85.7, "H": 14.3})'
    passes("formula", hexene, r"$\ce{CH2}$")
    passes("formula", hexene, r"The empirical formula is $\ce{CH2}$.")
    wrong("formula", hexene, r"$\ce{C2H4}$")
    wrong("formula", hexene, r"$\ce{CH3}$")
    passes("formula", 'molecular_formula("CH2", 56.1)', r"$\ce{C4H8}$")
    wrong("formula", 'molecular_formula("CH2", 56.1)', r"$\ce{CH2}$")
    passes("formula", 'empirical_formula({"C": 2.4, "H": 0.6})', r"$\ce{CH3}$")                     # masses
    passes("formula", 'empirical_formula({"Fe": 69.9, "O": 30.1})', r"$\ce{Fe2O3}$")                # ratio 1.5 -> x2
    passes("formula", 'empirical_formula({"C": 9.0, "H": 2.0})', r"$\ce{C3H8}$")                    # ratio 2.67 -> x3
    fails(lambda: truth('empirical_formula({"C": 50, "H": 50})'), ValueError)                       # ambiguous data
    passes("formula", 'ionic_formula("Al3+", "SO4 2-")', r"$\ce{Al2(SO4)3}$")
    wrong("formula", 'ionic_formula("Al3+", "SO4 2-")', r"$\ce{Al3(SO4)2}$")
    wrong("formula", 'ionic_formula("Al3+", "SO4 2-")', r"$\ce{AlSO4}$")
    passes("formula", 'ionic_formula("Mg2+", "Cl-")', r"$\ce{MgCl2}$")
    passes("formula", 'formula("SO4^2-")', r"$\ce{SO4^2-}$", given=True)
    wrong("formula", 'formula("SO4^2-")', r"$\ce{SO4^-}$", given=True)                              # wrong charge
    passes("formula", 'formula("C2H5OH")', r"$\ce{C2H6O}$", given=True)                             # composition
    passes("formula", 'formula("CH3CH2OH")', r"$\ce{CH3CH2OH}$", given=True, match="exact")
    wrong("formula", 'formula("CH3CH2OH")', r"$\ce{C2H6O}$", given=True, match="exact")
    wrong("formula", 'formula("CH3CH2OH")', r"$\ce{CH3OCH3}$", given=True, match="exact")
    fails(lambda: vk.check_spec({"kind": "formula", "truth": 'formula("C2H5OH")'}), ValueError)      # needs given: true
    fails(lambda: vk.check_spec({"kind": "formula", "truth": 'empirical_formula({"C": 1})', "given": True}), ValueError)
    fails(lambda: vk.check_spec({"kind": "formula", "truth": "Mr('CH4')"}), ValueError)


# ------------------------------------------------------------------------------------------------ units and signs

def test_number_kinds_accept_units():
    passes("rounded", "0.250*Mr('NaOH')", r"m \approx 10.0\ \text{g}", sf=3)
    passes("rounded", "0.250*Mr('NaOH')", r"m \approx 10.0\ \text{g}", sf=3, unit="g")
    passes("standard-form", "Rational(5, 2) / 1000", r"n = \pu{2.5e-3 mol}", unit="mol")
    passes("standard-form", "Rational(5, 2) / 1000", r"$2.50 \times 10^{-3}\ \text{mol}$", sf=3)
    passes("standard-form", "Rational(5, 2) / 1000", r"$2.50 \times 10^{-3}\ \text{mol}$", sf=3, unit="mol")
    combustion = "Hc('CH4(g)') + 1"
    passes("exact", combustion, r"\Delta H = \pu{-890 kJ mol-1}", unit="kJ mol-1")
    passes("exact", combustion, r"\Delta H = -890\ \text{kJ mol}^{-1}", unit="kJ mol^-1")
    passes("exact", combustion, r"\Delta H = -890\,\mathrm{kJ\,mol^{-1}}", unit="kJ mol-1")
    passes("exact", combustion, "ΔH = −890 kJ mol⁻¹", unit="kJ mol-1")
    passes("exact", combustion, r"\Delta H = \pu{-890 kJ mol-1}")                            # unit allowed without `unit`
    wrong("exact", combustion, r"\Delta H = -890\ \text{kJ}", unit="kJ mol-1")              # unit mismatch
    wrong("exact", combustion, r"\Delta H = -890", unit="kJ mol-1")                         # unit missing
    wrong("exact", combustion, r"\Delta H = \pu{+890 kJ mol-1}", unit="kJ mol-1")           # sign
    passes("rounded", "R*T_SATP/1000", r"RT \approx 2.48\ \text{kJ mol}^{-1}", sf=3, unit="kJ mol-1")
    passes("rounded", "8.31 * 298 / 1000", r"\approx 2.48 \text{ J K}^{-1}\text{ mol}^{-1}", sf=3, unit="J mol-1 K-1")
    passes("rounded", "c_water * 50 * Rational(13, 2)", r"Q \approx 1.36 \times 10^{3}\ \text{J}", sf=3, unit="J")


def test_signed():
    passes("exact", "2*4 - 5", r"+3", signed=True)
    passes("exact", "2*4 - 5", r"\text{oxidation state} = +3", signed=True)
    wrong("exact", "2*4 - 5", r"3", signed=True)                                            # missing +
    passes("exact", "2*4 - 5", r"3")                                                        # no sign needed by default
    passes("exact", "5 - 2*4", r"-3", signed=True)
    wrong("exact", "2*4 - 5", r"-3", signed=True)
    passes("rounded", "Hf('C2H4(g)') + Rational(1, 3)", r"\Delta H \approx +52.3\ \text{kJ mol}^{-1}", sf=3, signed=True, unit="kJ mol-1")
    wrong("rounded", "Hf('C2H4(g)') + Rational(1, 3)", r"\Delta H \approx 52.3\ \text{kJ mol}^{-1}", sf=3, signed=True, unit="kJ mol-1")
    passes("exact", "E0('Cu2+/Cu') - E0('Zn2+/Zn')", r"E^\ominus_{\text{cell}} = +1.10\ \text{V}", signed=True, unit="V")
    wrong("exact", "E0('Cu2+/Cu') - E0('Zn2+/Zn')", r"E^\ominus_{\text{cell}} = 1.10\ \text{V}", signed=True, unit="V")
    vk.check({"kind": "numeric", "truth": "Hf('CH4(g)')", "sf": 2, "signed": True}, -74, tolerance=0)
    fails(lambda: vk.check({"kind": "numeric", "truth": "Hf('CH4(g)')", "sf": 2, "signed": True}, 74, tolerance=0), AssertionError)


def test_maths_units_unchanged():
    passes("exact", "sqrt(5**2 + 12**2)", r"AB = 13\text{ cm}", unit="cm")
    passes("rounded", "pi * 3**2", r"A \approx 28.27\text{ cm}^2", dp=2, unit="cm^2")
    wrong("rounded", "pi * 3**2", r"A \approx 28.27\text{ cm}", dp=2, unit="cm^2")
    passes("exact", "2*x", r"2x")  # a letter in an expression is never a unit
    wrong("exact", "1 + 1", r"2x")


# ----------------------------------------------------------------------------------------------- explanation kind

EXPLAIN = {"kind": "explanation", "truth": "breaking bonds needs energy, so the reaction is endothermic overall",
           "requires": [["absorbs energy", "energy is absorbed", "endothermic"], "$\\Delta H$ is positive"],
           "forbids": ["energy is released when bonds break"]}


def test_kind_explanation():
    ok = lambda text: vk.check(EXPLAIN, text)  # noqa: E731
    ok(r"Breaking bonds is endothermic, so $\Delta H$ is positive.")
    ok("Bond breaking ABSORBS   energy, so ΔH is positive.")
    fails(lambda: ok("Bond breaking absorbs energy."), AssertionError)                                  # missing point
    fails(lambda: ok("Energy is released when bonds break, but overall it is endothermic; ΔH is positive."), AssertionError)  # forbidden
    fails(lambda: ok("Endothermicity means ΔH is positive"), AssertionError)                            # whole words only
    spec = {"kind": "explanation", "truth": "x", "requires": ["$\\ce{H2O}$ molecules", "sp²", "Fe³⁺ ions"]}
    vk.check(spec, r"Water: $\ce{H2O}$ molecules; the carbon is $sp^{2}$ hybridised and $\ce{Fe^3+}$ ions remain.")
    vk.check(spec, "H₂O molecules, sp2 carbon, Fe^3+ ions")
    vk.check({"kind": "explanation", "truth": "x", "requires": ["London (dispersion) forces", "2H2 + O2 → 2H2O"]},
             r"London (dispersion) forces; $\ce{2H2 + O2 -> 2H2O}$")
    vk.check({"kind": "explanation", "truth": "x", "requires": ["first–order", "rate"]}, "It is first-order in rate terms")
    for bad in [{"requires": ["one phrase"]}, {"requires": []}, {"requires": "a, b"}, {"requires": ["a", ""]},
                {"requires": ["a", []]}, {"requires": ["a", "b"], "forbids": [["x"]]}, {"requires": ["a", "b"], "forbids": "x"}]:
        fails(lambda bad=bad: vk.check_spec({"kind": "explanation", "truth": "summary", **bad}), ValueError)
    vk.check_spec({"kind": "explanation", "truth": "a summary in words", "requires": ["a", ["b", "c"]]})  # truth is text


def rejects_with(fn, text):
    try:
        fn()
    except (AssertionError, ValueError) as error:
        assert text in str(error), f"rejected, but the message lacks {text!r}: {error}"
        return
    raise AssertionError("expected a rejection, but it was accepted")


def test_review_471_identity_and_brackets():
    # A structural isomer of a truth species has the right atoms but is a different compound.
    truth = "CH3CH2COOH + NaOH -> CH3CH2COONa + H2O"
    passes("chem-equation", truth, r"$\ce{CH3CH2COOH + NaOH -> CH3CH2COONa + H2O}$")
    wrong("chem-equation", truth, r"$\ce{CH3COOCH3 + NaOH -> CH3CH2COONa + H2O}$")
    # Split isomer: in either order, half the acid replaced by the ester must fail (identity checked before merging).
    wrong("chem-equation", truth, r"$\ce{1/2CH3COOCH3 + 1/2CH3CH2COOH + NaOH -> CH3CH2COONa + H2O}$")
    wrong("chem-equation", truth, r"$\ce{1/2CH3CH2COOH + 1/2CH3COOCH3 + NaOH -> CH3CH2COONa + H2O}$")
    passes("chem-equation", "CH3COOH + NaOH -> CH3COONa + H2O", r"$\ce{CH3CO2H + NaOH -> CH3COONa + H2O}$", aliases={"CH3COOH": ["CH3CO2H"]})
    wrong("chem-equation", "CH3COOH + NaOH -> CH3COONa + H2O", r"$\ce{CH3CO2H + NaOH -> CH3COONa + H2O}$")
    # Booklet lookups match the written formula, never another isomer's row.
    rejects_with(lambda: cd.Hc("CH3CH(OH)CH3(l)"), "propan-1-ol")
    rejects_with(lambda: cd.Hf("CH3CH2CHO(l)"), "propanone")
    assert cd.Hf("propanone") == -248 and cd.Hc("propan-1-ol") == -2021 and cd.Hf("CH4(g)") == -74
    # Brackets close with their own kind.
    rejects_with(lambda: cp.parse_formula("Ca(NO3]2"), "mismatched")
    rejects_with(lambda: cp.parse_formula("[Cu(H2O)6)^2+"), "mismatched")
    assert cp.parse_formula("[Cu(H2O)6]^2+").charge == 2


if __name__ == "__main__":
    failed = 0
    tests = [(name, fn) for name, fn in sorted(globals().items()) if name.startswith("test_") and callable(fn)]
    for name, fn in tests:
        try:
            fn()
            print(f"PASS {name}")
        except Skip as reason:
            print(f"SKIP {name} ({reason})")
        except Exception:  # noqa: BLE001
            failed += 1
            print(f"FAIL {name}\n{traceback.format_exc()}")
    print(f"{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
