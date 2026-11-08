"""Unit tests for the physics gate: phys_data.py (data booklet), the physics namespace, degree trigonometry and physics
units on number kinds. Run by scripts/notes/mathparse.test.ts (or directly with the SymPy venv). Each test_* raises on
failure.

The booklet transcription test reads the private extracted page text in ../research/course-notes-physics and skips
itself when that folder is absent (as on CI).
"""
import re
import sys
import traceback
from pathlib import Path

from sympy import E, Integer, Rational, Symbol, pi

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import phys_data as pd  # noqa: E402
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
    vk.check({"kind": kind, "truth": truth, **opts}, tex, physics=True)


def wrong(kind, truth, tex, **opts):
    """Rejected as WRONG (AssertionError), as a multiple-choice distractor must be."""
    fails(lambda: vk.check({"kind": kind, "truth": truth, **opts}, tex, physics=True), AssertionError)


def truth(source, physics=True, chemistry=False):
    return vk.evaluate_truth(source, physics=physics, chemistry=chemistry)


# ------------------------------------------------------------------------------------------------------- data booklet

#: Read off the booklet PDF (version 1.1) by eye: p3 fundamental constants, p4 multipliers and conversions, p8 Wien.
BOOKLET = {
    "g": "9.8", "G": "6.67e-11", "NA": "6.02e23", "R": "8.31", "kB": "1.38e-23", "sigma": "5.67e-8", "k_e": "8.99e9",
    "eps0": "8.85e-12", "c": "3.00e8", "h": "6.63e-34", "e": "1.60e-19", "me": "9.110e-31", "mp": "1.673e-27",
    "mn": "1.675e-27", "u_kg": "1.661e-27", "S_solar": "1.36e3", "R0": "1.20e-15",
    "me_u": "0.000549", "mp_u": "1.007276", "mn_u": "1.008665", "me_MeV": "0.511", "mp_MeV": "938", "mn_MeV": "940",
    "u_MeV": "931.5", "ly": "9.46e15", "pc_ly": "3.26", "AU": "1.50e11", "kWh": "3.60e6", "hc": "1.99e-25",
    "hc_eV": "1.24e-6", "zero_celsius": "273", "wien_b": "2.9e-3", "eV": "1.60e-19", "keV": "1.60e-16",
    "MeV": "1.60e-13", "GeV": "1.60e-10",
}


def test_spot_checked_booklet_values():
    names = pd.namespace()
    for name, value in BOOKLET.items():
        assert names[name] == Rational(value), f"{name} = {names[name]}, booklet {value}"
        assert truth(f"{name} * 1") == Rational(value), name
    assert names["mu0"] == 4 * pi * Rational("1e-7")
    assert names["pc"] == Rational("3.26") * Rational("9.46e15")
    assert {name: power for name, (_, power) in pd.PREFIXES.items()} == {
        "peta": 15, "tera": 12, "giga": 9, "mega": 6, "kilo": 3, "hecto": 2, "deca": 1, "deci": -1, "centi": -2,
        "milli": -3, "micro": -6, "nano": -9, "pico": -12, "femto": -15}
    assert set(BOOKLET) | {"mu0", "pc"} == {name for name, value in names.items() if not callable(value)}


def test_constants_only_in_physics_courses():
    assert truth("m*g") == Rational("9.8") * Symbol("m")
    for source in ["g * 2", "G * 2", "R * 2", "c * 2", "h * 2", "e * 2"]:
        name = source.split()[0]
        assert str(truth(source, physics=False)) == f"2*{name}", source  # a maths truth keeps them as symbols
    assert truth("e", physics=False) == Symbol("e")                       # maths: e unchanged (an unknown name)
    assert truth("E", physics=False) == E and truth("E") == E              # Euler's number is E in every course
    assert truth("exp(1)") == E
    vk.check({"kind": "exact", "truth": "exp(2)"}, r"\mathrm{e}^{2}")                    # a published e is Euler's
    vk.check({"kind": "exact", "truth": "exp(2)"}, r"\mathrm{e}^{2}", physics=True)      # in physics too
    fails(lambda: truth("k_e * 2", physics=False), ValueError)            # physics-only names are unknown elsewhere
    fails(lambda: truth("sind(30)", physics=False), ValueError)


def test_chemistry_and_physics_stay_separate():
    assert truth("R * 1") == Rational("8.31") and truth("R * 1", physics=False, chemistry=True) == Rational("8.31")
    assert str(truth("F + Kw", physics=True)) == "F + Kw"                 # chemistry constants are symbols in physics
    assert str(truth("g + c", physics=False, chemistry=True)) == "c + g"  # physics constants are symbols in chemistry
    assert truth("Mr('H2O')") == Rational("18.02")                        # the text helpers still work everywhere
    fails(lambda: truth("R * 1", physics=True, chemistry=True), ValueError)


def test_truths_stay_computed():
    for literal in ["g", "-e", "c"]:
        fails(lambda literal=literal: vk.check_spec({"kind": "exact", "truth": literal}), ValueError)
    vk.check_spec({"kind": "rounded", "truth": "20*cosd(35)", "sf": 3})
    vk.check_spec({"kind": "rounded", "truth": "2.0*g", "sf": 2})


def test_degree_trigonometry():
    assert truth("sind(30)") == Rational(1, 2) and truth("cosd(60)") == Rational(1, 2) and truth("tand(45)") == 1
    assert truth("asind(Rational(1, 2))") == 30 and truth("acosd(0)") == 90 and truth("atand(1)") == 45
    assert truth("sind(90) + cosd(180)") == 0
    passes("rounded", "20*cosd(35)", r"F_x \approx 16.4\ \text{N}", sf=3, unit="N")
    wrong("rounded", "20*cosd(35)", r"F_x \approx 16.4\ \text{N}", sf=3, unit="J")
    wrong("rounded", "20*cos(35)", r"F_x \approx 16.4\ \text{N}", sf=3, unit="N")     # radians: -18.0, not 16.4
    # Degree answers: the angle kind needs the ° and is exact or rounded; radians use rounded with unit rad.
    passes("angle", "atand(Rational(3, 4))", r"\theta \approx 36.9^{\circ}", sf=3)
    passes("angle", "asind(Rational(1, 2))", r"\theta = 30^{\circ}")
    wrong("angle", "atand(Rational(3, 4))", r"\theta \approx 36.9", sf=3)              # no degree sign
    wrong("angle", "atand(Rational(3, 4))", r"\theta \approx 0.644^{\circ}", sf=3)     # radians written as degrees
    passes("rounded", "atan(Rational(3, 4))", r"\theta \approx 0.644\ \text{rad}", sf=3, unit="rad")
    passes("rounded", "atand(Rational(3, 4))", r"\theta \approx 36.9^{\circ}", sf=3, unit="°")


# ----------------------------------------------------------------------------------------------------------- units

#: unit declared -> ways a writer may publish it after the number 6 (plain, \text, \mathrm, \, spacing, ^{-1}, ⁻¹, \pu).
UNIT_FAMILIES = {
    # mechanics
    "m s-1": [r"6\ \text{m s}^{-1}", r"6\,\mathrm{m\,s^{-1}}", "6 m s⁻¹", r"\pu{6 m s-1}", r"6\text{ m s}^{-1}", r"6\ \text{m}\,\text{s}^{-1}"],
    "m s-2": [r"6\ \text{m s}^{-2}", "6 m s⁻²", r"\pu{6 m s-2}"],
    "N": [r"6\ \text{N}", r"\pu{6 N}", "6 N"],
    "J": [r"6\ \text{J}", r"\pu{6 J}"],
    "W": [r"6\ \text{W}", r"6\,\mathrm{W}"],
    "Pa": [r"6\ \text{Pa}", r"\pu{6 Pa}"],
    "kg m s-1": [r"6\ \text{kg m s}^{-1}", r"6\ \text{kg}\,\text{m}\,\text{s}^{-1}", "6 kg m s⁻¹", r"\pu{6 kg m s-1}"],
    "N s": [r"6\ \text{N s}", r"6\,\text{N}\,\text{s}", r"6\ \text{N}\cdot\text{s}"],
    "N m": [r"6\ \text{N m}", r"\pu{6 N m}"],
    # rotation
    "rad s-1": [r"6\ \text{rad s}^{-1}", "6 rad s⁻¹", r"\pu{6 rad s-1}"],
    "rad s-2": [r"6\ \text{rad s}^{-2}", r"6\,\mathrm{rad\,s^{-2}}"],
    "kg m2": [r"6\ \text{kg m}^{2}", "6 kg m²", r"\pu{6 kg m2}", r"6\ \text{kg m}^2"],
    "Hz": [r"6\ \text{Hz}", r"\pu{6 Hz}"],
    # electricity and magnetism
    "V": [r"6\ \text{V}", "6 V"],
    "A": [r"6\ \text{A}", r"\pu{6 A}"],
    "Ω": [r"6\,\Omega", r"6\ \Omega", "6 Ω", "6 Ω", r"6\ \text{Ω}", r"6\,\mathrm{\Omega}"],
    "kΩ": [r"6\,\text{k}\Omega", r"6\ \mathrm{k\Omega}", "6 kΩ", r"6\ \text{k}\,\Omega", r"6\,k\Omega"],
    "Ω m": [r"6\ \Omega\,\text{m}", r"6\ \text{Ω m}"],
    "C": [r"6\ \text{C}", r"\pu{6 C}"],
    "T": [r"6\ \text{T}", r"\pu{6 T}", "6 T"],
    "Wb": [r"6\ \text{Wb}", r"\pu{6 Wb}"],
    "F": [r"6\ \text{F}", "6 F"],
    "V m-1": [r"6\ \text{V m}^{-1}", "6 V m⁻¹"],
    "N C-1": [r"6\ \text{N C}^{-1}", r"\pu{6 N C-1}"],
    # energy
    "eV": [r"6\ \text{eV}", "6 eV"],
    "keV": [r"6\ \text{keV}", r"\pu{6 keV}"],
    "MeV": [r"6\ \text{MeV}", "6 MeV"],
    "GeV": [r"6\ \text{GeV}", r"\pu{6 GeV}"],
    # thermal
    "K": [r"6\ \text{K}", "6 K"],
    "°C": [r"6\,^{\circ}\text{C}", "6 °C", r"6\ \degree\text{C}", r"6^\circ\mathrm{C}"],
    "J kg-1 K-1": [r"6\ \text{J kg}^{-1}\,\text{K}^{-1}", "6 J kg⁻¹ K⁻¹", r"\pu{6 J kg-1 K-1}", r"6\ \text{J K}^{-1}\text{ kg}^{-1}"],
    "J kg-1": [r"6\ \text{J kg}^{-1}", "6 J kg⁻¹"],
    # matter, radiation, astronomy
    "m3": [r"6\ \text{m}^{3}", "6 m³", r"\pu{6 m3}"],
    "kg m-3": [r"6\ \text{kg m}^{-3}", "6 kg m⁻³", r"\pu{6 kg m-3}"],
    "mol": [r"6\ \text{mol}", "6 mol"],
    "W m-2": [r"6\ \text{W m}^{-2}", "6 W m⁻²", r"\pu{6 W m-2}"],
    "ly": [r"6\ \text{ly}", "6 ly"],
    "pc": [r"6\ \text{pc}", "6 pc"],
    "AU": [r"6\ \text{AU}", "6 AU"],
    # prefixes
    "µA": [r"6\,\mu\text{A}", "6 μA", "6 µA", r"6\ \text{µA}", r"6\ \mu\mathrm{A}"],
    "µF": [r"6\,\mu\text{F}", r"6\ \text{μF}", "6 µF"],
    "nm": [r"6\ \text{nm}", r"\pu{6 nm}", "6 nm"],
    "pF": [r"6\ \text{pF}", "6 pF"],
    "kJ": [r"6\ \text{kJ}", "6 kJ"],
    "MW": [r"6\ \text{MW}", "6 MW"],
    "GW": [r"6\ \text{GW}", "6 GW"],
}


def _marked(tex):
    """A unit marked up (\\text, \\mathrm, \\pu, a degree sign) with no bare \\Omega / \\mu before the markup: exact
    without `unit` strips it. Bare units (6 m s⁻¹, 6\\,\\Omega) need `unit`, since they could be letters of an expression."""
    head = re.split(r"\\(?:text|mathrm|pu)\{|\^\s*\\circ|\\degree|°", tex)[0]
    return head != tex and not re.search(r"\\mu|\\Omega|[\u03a9\u2126\u00b5\u03bc]", head)


def test_physics_units_on_number_kinds():
    for unit, writings in UNIT_FAMILIES.items():
        for tex in writings:
            try:
                passes("exact", "2*3", tex, unit=unit)
                if _marked(tex):
                    passes("exact", "2*3", tex)  # without `unit`, a marked-up trailing unit is allowed and ignored
            except Exception as error:  # noqa: BLE001
                raise AssertionError(f"{tex!r} with unit {unit!r}: {type(error).__name__}: {error}") from error
    passes("exact", "2*3", r"6\ \text{m s}^{-1}", unit="m s^-1")
    passes("exact", "2*3", r"6\ \text{m s}^{-1}", unit="m s⁻¹")
    passes("exact", "2*3", r"6\ \text{m s}^{-1}", unit=r"\text{m s}^{-1}")
    passes("exact", "2*3", r"6\,\Omega", unit=r"\Omega")
    passes("exact", "2*3", r"6\,\mu\text{A}", unit=r"\mu A")


def test_physics_unit_mismatches_are_wrong():
    for tex, unit in [
        (r"6\ \text{m s}^{-1}", "m s-2"), (r"6\ \text{m s}^{-2}", "m s-1"), (r"6\ \text{N m}", "N s"), (r"6\ \text{N s}", "kg m s-1"),
        (r"6\,\text{k}\Omega", "Ω"), (r"6\,\Omega", "kΩ"), (r"6\ \Omega\,\text{m}", "mΩ"), (r"6\,\mu\text{F}", "F"), (r"6\ \text{F}", "µF"),
        (r"6\ \text{MeV}", "eV"), (r"6\ \text{J kg}^{-1}", "J kg-1 K-1"), (r"6\ \text{rad s}^{-1}", "rad s-2"), (r"6\ \text{Hz}", "s-1"),
        (r"6\,^{\circ}\text{C}", "K"), (r"6\ \text{ly}", "pc"), (r"6\ \text{kg m}^{2}", "kg m-2"), (r"6\ \text{nm}", "m"), ("6", "m"),
    ]:
        try:
            wrong("exact", "2*3", tex, unit=unit)
        except AssertionError as error:
            raise AssertionError(f"{tex!r} was accepted as {unit!r}") from error


def test_physics_units_with_rounding_and_standard_form():
    passes("rounded", "2.0*g/4", r"a \approx 4.90\ \text{m s}^{-2}", sf=3, unit="m s-2")
    passes("rounded", "2.0*g/4", r"a \approx 4.90 m s^{-2}", sf=3, unit="m s-2")                     # plain
    wrong("rounded", "2.0*g/4", r"a \approx 4.90\ \text{m s}^{-1}", sf=3, unit="m s-2")
    passes("standard-form", "h*c/(500*10**-9)", r"E \approx 3.98 \times 10^{-19}\ \text{J}", sf=3, unit="J")
    passes("standard-form", "h*c/(500*10**-9)", r"E \approx \pu{3.98e-19 J}", sf=3, unit="J")
    passes("rounded", "h*c/(500*10**-9)/eV", r"E \approx 2.49\ \text{eV}", sf=3, unit="eV")
    passes("rounded", "12/(4.7*10**3)*1000", r"I \approx 2.55\ \text{mA}", sf=3, unit="mA")
    passes("rounded", "9/(2.2*10**3)", r"I \approx 4.09\times 10^{-3}", sf=3)
    passes("rounded", "6/Rational(22, 10)", r"R \approx 2.73\,\text{k}\Omega", sf=3, unit="kΩ")
    passes("rounded", "wien_b/5800*10**9", r"\lambda_{\max} \approx 500\ \text{nm}", sf=3, unit="nm")
    passes("exact", "100 + zero_celsius", r"T = 373\ \text{K}", unit="K")
    passes("rounded", "4*pi**2*AU**3/(G*(365*24*3600)**2)", r"M \approx 2.0\times 10^{30}\ \text{kg}", sf=2, unit="kg")
    vk.check({"kind": "numeric", "truth": "2.0*g/4", "sf": 3}, 4.90, tolerance=0.005, physics=True)


def test_maths_units_unchanged():
    vk.check({"kind": "exact", "truth": "sqrt(5**2 + 12**2)", "unit": "cm"}, r"AB = 13\text{ cm}")
    vk.check({"kind": "rounded", "truth": "pi * 3**2", "dp": 2, "unit": "cm^2"}, r"A \approx 28.27\text{ cm}^2")
    vk.check({"kind": "exact", "truth": "2*x"}, r"2x")                         # a letter in an expression is never a unit
    vk.check({"kind": "exact", "truth": "2*Omega"}, r"2\Omega")              # nor is \Omega without the unit option
    fails(lambda: vk.check({"kind": "exact", "truth": "2*3"}, r"6\,\Omega", physics=True), AssertionError)  # so declare unit
    fails(lambda: vk.check({"kind": "exact", "truth": "1 + 1"}, r"2T"), AssertionError)


# ----------------------------------------------------------------------------------------------- explanation kind

def test_kind_explanation_for_physics():
    spec = {"kind": "explanation", "truth": "the forces balance, so the resultant force is zero",
            "requires": ["net force", "zero"], "forbids": ["no forces act"]}
    vk.check(spec, "The forces on the car balance, so the net force is zero and its velocity is constant.", physics=True)
    vk.check(spec, r"Weight and drag balance: the NET force $F_{\text{net}}$ is zero.", physics=True)
    fails(lambda: vk.check(spec, "The net force is small.", physics=True), AssertionError)                        # missing point
    fails(lambda: vk.check(spec, "No forces act, so the net force is zero.", physics=True), AssertionError)       # misconception


# ------------------------------------------------------------------------------------------- booklet transcription

def _digits_after(line, label):
    """The digits of a constants row after its quantity name and its symbol (ε0 and R0 carry a digit of their own)."""
    return re.sub(r"\D", "", line.split(label, 1)[1].split(None, 1)[1])


def test_booklet_transcription_matches_the_extracted_pages():
    """Every transcribed number appears in its row of the extracted page text. The extractor scrambles each row (the
    mantissa's digits, then "10", then the exponent, then the unit powers, with the decimal point moved to the end), so
    each row is compared as its digit stream: it must start with the mantissa's digits and contain the exponent."""
    pages = None
    for base in (HERE.parents[2], HERE.parents[3], HERE.parents[4]):
        candidate = base / "research" / "course-notes-physics" / "extract" / "databooklet"
        if candidate.is_dir():
            pages = candidate
            break
    if pages is None:
        raise Skip("research/course-notes-physics is absent")
    page = lambda n: (pages / f"p{n:02d}.txt").read_text()  # noqa: E731
    assert "Version 1.1" in page(1)

    def row(text, label):
        lines = text.splitlines()
        index = next(i for i, line in enumerate(lines) if label in line)
        line = lines[index]
        if not re.search(r"\d", line.split(label, 1)[1]):
            return lines[index + 1], ""  # the value wraps onto the next line (μ0)
        return line, label

    def appears(text, label, mantissa, power=0, extra=()):
        line, cut = row(text, label)
        digits = _digits_after(line, cut) if cut else re.sub(r"\D", "", line)
        # With a power of ten the mantissa is followed by the 10 of "x 10", so 9.11 cannot pass for 9.110.
        assert digits.startswith(mantissa.replace(".", "") + ("10" if power else "")), (label, mantissa, digits)
        if power:
            assert f"10{abs(power)}" in digits or ("10" in digits and str(abs(power)) in digits), (label, power, digits)
            assert power > 0 or "−" in line, (label, power, line)  # unit powers print minus signs too, so only this way
        for value in extra:
            assert value.replace(".", "") in digits, (label, value, digits)

    p07 = page(7)
    labels = {
        "g": "Acceleration of free fall", "G": "Gravitational constant", "NA": "Avogadro constant", "R": "Gas constant",
        "kB": "Boltzmann constant", "sigma": "Stefan–Boltzmann constant", "k_e": "Coulomb constant",
        "eps0": "Permittivity of free space", "c": "Speed of light in vacuum", "h": "Planck constant",
        "e": "Elementary charge", "me": "Electron rest mass", "mp": "Proton rest mass", "mn": "Neutron rest mass",
        "u_kg": "(Unified) atomic mass unit", "S_solar": "Solar constant", "R0": "Fermi radius",
    }
    assert set(labels) == set(pd.CONSTANTS)
    masses = {"me": ("me_u", "me_MeV"), "mp": ("mp_u", "mp_MeV"), "mn": ("mn_u", "mn_MeV"), "u_kg": ("u_MeV",)}
    for name, (mantissa, power, _) in pd.CONSTANTS.items():
        extra = [pd.MASSES[key][0].lstrip("0").lstrip(".").lstrip("0") for key in masses.get(name, ())]
        appears(p07, f"{labels[name]} ", mantissa, power, extra)
    appears(p07, "Permeability of free space", pd.MU0[0], pd.MU0[1])
    assert "π" in row(p07, "Permeability of free space")[0]

    p08 = page(8)
    for name, label in [("ly", "1 light year"), ("AU", "1 astronomical unit"), ("kWh", "1 kilowatt-hour")]:
        mantissa, power, _ = pd.CONVERSIONS[name]
        appears(p08, label, mantissa, power)
    appears(p08, "1 parsec", pd.PC_LY)
    appears(p08, "hc =", pd.CONVERSIONS["hc"][0], pd.CONVERSIONS["hc"][1], [pd.CONVERSIONS["hc_eV"][0], "6"])
    assert re.search(rf"temperature° C {pd.ZERO_CELSIUS}\b", p08)
    for name, (abbreviation, power) in pd.PREFIXES.items():
        printed = f"{name} {abbreviation} 10" + (f"{power}" if power > 0 else f" {-power}−")
        assert printed in p08, (name, printed)

    p12 = page(12)
    line = next(line for line in p12.splitlines() if "max" in line and "mK" in line)
    assert re.sub(r"\D", "", line) == pd.WIEN[0].replace(".", "") + "10" + str(-pd.WIEN[1]), line


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
