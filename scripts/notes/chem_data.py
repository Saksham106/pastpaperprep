"""IB Chemistry data booklet values, for computing truths in chemistry lessons.

Source: IB Diploma Programme Chemistry data booklet, first assessment 2025, version 1.1 (updated February 2024).
Every value is transcribed exactly as printed, as a decimal string, and becomes an exact SymPy Rational, so
"0.250*Mr('NaOH')" is exactly 0.250 x 40.00. test_chem_data.py checks each number against the booklet's page text.

Helpers usable in a verify truth (verify_kinds.py puts them in the truth namespace):
  Ar("Cl")                    relative atomic mass (p12), e.g. 35.45. Bracketed mass numbers, e.g. Tc (98), are included.
  Mr("CuSO4·5H2O")            sum of booklet Ar values; brackets, hydrates (. * ·) and charges ("SO4^2-") are read.
  BE("C-H"), BE("C=O"), BE("N#N") / BE("N≡N")   bond enthalpy, kJ mol-1 (p17); either order: BE("H-C").
  Hf("CH4(g)"), Gf("CH4(g)"), S("CH4(g)")       ΔHf⦵ / ΔGf⦵ (kJ mol-1) and S⦵ (J K-1 mol-1) (p18), by formula (with
                              its state when the formula has two, as H2O(l) / H2O(g)) or by name ("but-1-ene").
                              S(...) with a number is still SymPy's S (S(1)/3, S.Reals); with text it is the entropy.
  Hc("C2H5OH(l)")            ΔHc⦵, kJ mol-1 (p19), by formula or name.
  lattice("NaCl")            lattice enthalpy, kJ mol-1 (p21).
  E0("Cu2+/Cu")              standard reduction potential, V (p24). Couples: "Fe3+/Fe2+", "MnO4-/Mn2+", "Cr2O7 2-/Cr3+",
                              "O2/H2O" (acid), "O2/OH-" (alkali), "H2O/H2", "H+/H2", "I2/I-", "SO4 2-/H2SO3", ...
  pKa_ind("methyl orange")   indicator pKa (p23); pH_range_ind(name) gives (low, high).
  IE1("Na"), EA("Cl"), EA2("O"), EN("F")   first ionization energy, electron affinity (kJ mol-1) and
                              electronegativity (p14). EA2 is the second electron affinity (O, S only).
  Constants (p07, p09): R 8.31 J K-1 mol-1, NA 6.02e23 mol-1, F 9.65e4 C mol-1, Kw 1.00e-14 mol2 dm-6,
                              c_water 4.18 J g-1 K-1, Vm 22.7 dm3 mol-1 (ideal gas at STP), T_STP 273.15 K,
                              T_SATP 298.15 K, P_std 100 kPa, h_planck 6.63e-34 J s, c_light 3.00e8 m s-1,
                              e_charge 1.602177e-19 C.
Unknown keys raise ValueError naming the key and, where it helps, close matches.

The booklet's equations (p06), for reference:
  c = fλ;  E = hf;  n = m/M;  n = CV;  PV = nRT;  P1V1/T1 = P2V2/T2;  Q = mcΔT;
  % atom economy = (molar mass of desired product / molar mass of all reactants) x 100;
  ΔH⦵ = Σ ΔHf⦵(products) − Σ ΔHf⦵(reactants);  ΔH⦵ = Σ ΔHc⦵(reactants) − Σ ΔHc⦵(products);
  ΔG⦵ = ΔH⦵ − TΔS⦵;  ΔG = ΔG⦵ + RT ln Q;  ΔG⦵ = −RT ln K;  ΔG⦵ = −nFE⦵;
  k = A e^(−Ea/RT);  ln k = −Ea/(RT) + ln A;  ln(k1/k2) = (Ea/R)(1/T2 − 1/T1);
  pH = −log10[H3O+] or −log10[H+];  Kw = [H+][OH−];  pOH = −log10[OH−].
"""
import difflib
import re
from fractions import Fraction

from sympy import Integer, Rational

# ------------------------------------------------------------------------------------------------- p07, p09: constants
#: name -> (mantissa, power of ten, unit) exactly as printed.
CONSTANTS = {
    "e_charge": ("1.602177", -19, "C"),
    "m_electron": ("9.109384", -31, "kg"),
    "m_proton": ("1.672622", -27, "kg"),
    "m_neutron": ("1.674927", -27, "kg"),
    "c_light": ("3.00", 8, "m s-1"),
    "h_planck": ("6.63", -34, "J s"),
    "NA": ("6.02", 23, "mol-1"),
    "R": ("8.31", 0, "J K-1 mol-1"),
    "Vm_m3": ("2.27", -2, "m3 mol-1"),
    "Vm": ("22.7", 0, "dm3 mol-1"),
    "c_water": ("4.18", 0, "J g-1 K-1"),
    "Kw": ("1.00", -14, "mol2 dm-6"),
    "F": ("9.65", 4, "C mol-1"),
}
#: p09: standard conditions.
CONDITIONS = {"T_STP": ("273.15", "K"), "T_SATP": ("298.15", "K"), "P_std": ("100", "kPa")}

# --------------------------------------------------------------------------------------- p12: relative atomic masses
#: As printed; "(98)" marks a mass number printed in brackets (no stable isotope).
AR_PRINTED = {
    "H": "1.01", "He": "4.00",
    "Li": "6.94", "Be": "9.01", "B": "10.81", "C": "12.01", "N": "14.01", "O": "16.00", "F": "19.00", "Ne": "20.18",
    "Na": "22.99", "Mg": "24.31", "Al": "26.98", "Si": "28.09", "P": "30.97", "S": "32.07", "Cl": "35.45", "Ar": "39.95",
    "K": "39.10", "Ca": "40.08", "Sc": "44.96", "Ti": "47.87", "V": "50.94", "Cr": "52.00", "Mn": "54.94", "Fe": "55.85",
    "Co": "58.93", "Ni": "58.69", "Cu": "63.55", "Zn": "65.38", "Ga": "69.72", "Ge": "72.63", "As": "74.92", "Se": "78.96",
    "Br": "79.90", "Kr": "83.80",
    "Rb": "85.47", "Sr": "87.62", "Y": "88.91", "Zr": "91.22", "Nb": "92.91", "Mo": "95.96", "Tc": "(98)", "Ru": "101.07",
    "Rh": "102.91", "Pd": "106.42", "Ag": "107.87", "Cd": "112.41", "In": "114.82", "Sn": "118.71", "Sb": "121.76",
    "Te": "127.60", "I": "126.90", "Xe": "131.29",
    "Cs": "132.91", "Ba": "137.33", "La": "138.91", "Hf": "178.49", "Ta": "180.95", "W": "183.84", "Re": "186.21",
    "Os": "190.23", "Ir": "192.22", "Pt": "195.08", "Au": "196.97", "Hg": "200.59", "Tl": "204.38", "Pb": "207.20",
    "Bi": "208.98", "Po": "(209)", "At": "(210)", "Rn": "(222)",
    "Fr": "(223)", "Ra": "(226)", "Ac": "(227)", "Rf": "(267)", "Db": "(268)", "Sg": "(269)", "Bh": "(270)", "Hs": "(269)",
    "Mt": "(278)", "Ds": "(281)", "Rg": "(281)", "Cn": "(285)", "Nh": "(286)", "Fl": "(289)", "Mc": "(288)", "Lv": "(293)",
    "Ts": "(294)", "Og": "(294)",
    "Ce": "140.12", "Pr": "140.91", "Nd": "144.24", "Pm": "(145)", "Sm": "150.36", "Eu": "151.96", "Gd": "157.25",
    "Tb": "158.93", "Dy": "162.50", "Ho": "164.93", "Er": "167.26", "Tm": "168.93", "Yb": "173.05", "Lu": "174.97",
    "Th": "232.04", "Pa": "231.04", "U": "238.03", "Np": "(237)", "Pu": "(244)", "Am": "(243)", "Cm": "(247)", "Bk": "(247)",
    "Cf": "(251)", "Es": "(252)", "Fm": "(257)", "Md": "(258)", "No": "(259)", "Lr": "(262)",
}
AR = {symbol: printed.strip("()") for symbol, printed in AR_PRINTED.items()}

# ---------------------------------------------- p14: first ionization energy, electron affinity, electronegativity
#: symbol -> (first IE / kJ mol-1, EA / kJ mol-1, electronegativity); None where the booklet leaves the cell blank.
#: Dy's EA is printed "< 0" and is left out.
PERIODIC_14 = {
    "H": ("1312", "-73", "2.2"), "He": ("2372", None, None),
    "Li": ("520", "-60", "1.0"), "Be": ("900", None, "1.6"), "B": ("801", "-27", "2.0"), "C": ("1086", "-122", "2.6"),
    "N": ("1402", None, "3.0"), "O": ("1314", "-141", "3.4"), "F": ("1681", "-328", "4.0"), "Ne": ("2081", None, None),
    "Na": ("496", "-53", "0.9"), "Mg": ("738", None, "1.3"), "Al": ("578", "-42", "1.6"), "Si": ("787", "-134", "1.9"),
    "P": ("1012", "-72", "2.2"), "S": ("1000", "-200", "2.6"), "Cl": ("1251", "-349", "3.2"), "Ar": ("1520", None, None),
    "K": ("419", "-48", "0.8"), "Ca": ("590", "-2", "1.0"), "Sc": ("633", "-18", "1.4"), "Ti": ("659", "-8", "1.5"),
    "V": ("651", "-51", "1.6"), "Cr": ("653", "-64", "1.7"), "Mn": ("717", None, "1.6"), "Fe": ("762", "-15", "1.8"),
    "Co": ("760", "-64", "1.9"), "Ni": ("737", "-112", "1.9"), "Cu": ("745", "-119", "1.9"), "Zn": ("906", None, "1.6"),
    "Ga": ("579", "-41", "1.8"), "Ge": ("762", "-119", "2.0"), "As": ("944", "-78", "2.2"), "Se": ("941", "-195", "2.6"),
    "Br": ("1140", "-325", "3.0"), "Kr": ("1351", None, None),
    "Rb": ("403", "-47", "0.8"), "Sr": ("549", "-5", "1.0"), "Y": ("600", "-30", "1.2"), "Zr": ("640", "-41", "1.3"),
    "Nb": ("652", "-88", "1.6"), "Mo": ("684", "-72", "2.2"), "Tc": ("702", "-53", "2.1"), "Ru": ("710", "-101", "2.2"),
    "Rh": ("720", "-110", "2.3"), "Pd": ("804", "-54", "2.2"), "Ag": ("731", "-126", "1.9"), "Cd": ("868", None, "1.7"),
    "In": ("558", "-29", "1.8"), "Sn": ("709", "-107", "2.0"), "Sb": ("831", "-101", "2.0"), "Te": ("869", "-190", "2.1"),
    "I": ("1008", "-295", "2.7"), "Xe": ("1170", None, None),
    "Cs": ("376", "-46", "0.8"), "Ba": ("503", "-14", "0.9"), "La": ("538", "-45", "1.1"), "Hf": ("659", "-1", "1.3"),
    "Ta": ("728", "-31", "1.5"), "W": ("759", "-79", "1.7"), "Re": ("756", "-14", "1.9"), "Os": ("814", "-106", "2.2"),
    "Ir": ("865", "-151", "2.2"), "Pt": ("864", "-205", "2.2"), "Au": ("890", "-223", "2.4"), "Hg": ("1007", None, "1.9"),
    "Tl": ("589", "-36", "1.8"), "Pb": ("716", "-35", "1.8"), "Bi": ("703", "-91", "1.9"), "Po": ("812", "-183", "2.0"),
    "At": (None, "-270", "2.2"), "Rn": ("1037", None, None),
    "Fr": ("393", "-47", "0.7"), "Ra": ("509", "-10", "0.9"), "Ac": ("499", "-34", "1.1"),
    "Ce": ("534", "-63", "1.1"), "Pr": ("528", "-93", "1.1"), "Nd": ("533", "-185", "1.1"), "Pm": ("539", None, None),
    "Sm": ("545", None, "1.2"), "Eu": ("547", "-83", None), "Gd": ("593", None, "1.2"), "Tb": ("566", "-112", None),
    "Dy": ("573", None, "1.2"), "Ho": ("581", None, "1.2"), "Er": ("589", None, "1.2"), "Tm": ("597", "-99", "1.3"),
    "Yb": ("603", "2", None), "Lu": ("524", "-33", "1.0"),
    "Th": ("609", None, "1.3"), "Pa": ("568", None, "1.5"), "U": ("598", None, "1.7"), "Np": ("605", None, "1.3"),
    "Pu": ("581", None, "1.3"), "Am": ("576", None, None), "Cm": ("578", None, None), "Bk": ("598", None, None),
    "Cf": ("606", None, None), "Es": ("619", None, None), "Fm": ("627", None, None), "Md": ("635", None, None),
    "No": ("642", None, None), "Lr": ("473", None, None),
}
#: Second electron affinities, printed in brackets: O (+753), S (+545).
EA2_PRINTED = {"O": "+753", "S": "+545"}

# ------------------------------------------------------------------------------------------- p17: bond enthalpies
#: "-" single, "=" double, "#" triple (the booklet's — = ≡), kJ mol-1.
BONDS = {
    "H-H": "436", "H-F": "567", "H-Cl": "431", "H-Br": "366", "H-I": "298",
    "C-H": "414", "C-C": "346", "C-N": "286", "C-O": "358", "C-Si": "307", "C-P": "264", "C-S": "289", "C-F": "492",
    "C-Cl": "324", "C-Br": "285", "C-I": "228",
    "N-H": "391", "N-N": "158", "N-O": "214", "N-F": "278", "N-Cl": "192",
    "O-H": "463", "O-O": "144", "O-Si": "466", "O-P": "363", "O-F": "191", "O-Cl": "206", "O-Br": "201", "O-I": "201",
    "Si-H": "323", "Si-Si": "226", "Si-S": "293", "Si-F": "597", "Si-Cl": "400", "Si-Br": "330", "Si-I": "234",
    "P-H": "322", "P-P": "198", "P-F": "490", "P-Cl": "322", "P-Br": "264", "P-I": "184",
    "S-H": "364", "S-S": "266", "S-F": "327", "S-Cl": "271", "S-Br": "218",
    "F-F": "159", "F-Cl": "255", "F-Br": "249", "F-I": "280",
    "Cl-Cl": "242", "Cl-Br": "219", "Cl-I": "211", "Br-Br": "193", "Br-I": "178", "I-I": "151",
    "C=C": "614", "C=N": "615", "C=O": "804", "C=S": "536", "N=N": "470", "N=O": "587", "O=O": "498", "O=S": "522",
    "S=S": "429", "C#C": "839", "C#N": "890", "C#O": "1077", "N#N": "945",
}

# ------------------------------------------------------------------------------------- p18: thermodynamic data
#: (name, formula, state, ΔHf⦵ / kJ mol-1, ΔGf⦵ / kJ mol-1, S⦵ / J K-1 mol-1); None where the cell is blank.
THERMO = [
    ("methane", "CH4", "g", "-74", "-50", "+186"),
    ("ethane", "C2H6", "g", "-84", "-32", "+230"),
    ("propane", "C3H8", "g", "-105", "-24", "+270"),
    ("butane", "C4H10", "g", "-126", "-17", "+310"),
    ("pentane", "C5H12", "l", "-173", None, None),
    ("hexane", "C6H14", "l", "-199", None, None),
    ("ethene", "C2H4", "g", "+52", "+68", "+220"),
    ("propene", "C3H6", "g", "+20", "+62", "+267"),
    ("but-1-ene", "C4H8", "g", "+0.1", "+71", "+306"),
    ("cis-but-2-ene", "C4H8", "g", "-7", "+66", "+301"),
    ("trans-but-2-ene", "C4H8", "g", "-11", "+63", "+297"),
    ("ethyne", "C2H2", "g", "+228", "+211", "+201"),
    ("propyne", "C3H4", "g", "+185", "+194", "+248"),
    ("buta-1,3-diene", "C4H6", "g", "+110", "+151", "+279"),
    ("cyclohexane", "C6H12", "l", "-156", None, None),
    ("benzene", "C6H6", "l", "+49", "+125", "+173"),
    ("methylbenzene", "C6H5CH3", "l", "+12", None, None),
    ("ethylbenzene", "C6H5CH2CH3", "l", "-12", None, None),
    ("phenylethene", "C6H5CHCH2", "l", "+104", None, None),
    ("chloromethane", "CH3Cl", "g", "-82", "-58", "+235"),
    ("dichloromethane", "CH2Cl2", "l", "-124", None, "+178"),
    ("trichloromethane", "CHCl3", "l", "-134", "-74", "+202"),
    ("bromomethane", "CH3Br", "g", "-36", "-26", "+246"),
    ("iodomethane", "CH3I", "l", "-14", None, "+163"),
    ("chloroethane", "C2H5Cl", "g", "-137", "-53", None),
    ("bromoethane", "C2H5Br", "l", "-90", "-26", "+199"),
    ("chlorobenzene", "C6H5Cl", "l", "+11", None, None),
    ("methanol", "CH3OH", "l", "-239", "-167", "+127"),
    ("ethanol", "C2H5OH", "l", "-278", "-175", "+161"),
    ("phenol", "C6H5OH", "s", "-165", None, "+144"),
    ("methanal", "HCHO", "g", "-109", "-102", "+219"),
    ("ethanal", "CH3CHO", "g", "-166", "-133", "+264"),
    ("propanone", "(CH3)2CO", "l", "-248", None, "+200"),
    ("methanoic acid", "HCOOH", "l", "-425", "-361", "+129"),
    ("ethanoic acid", "CH3COOH", "l", "-484", "-390", "+160"),
    ("benzoic acid", "C6H5COOH", "s", "-385", None, "+168"),
    ("methylamine", "CH3NH2", "g", "-23", "+32", "+243"),
    ("water", "H2O", "l", "-286", "-237", "+70"),
    ("steam", "H2O", "g", "-242", "-229", "+189"),
    ("carbon monoxide", "CO", "g", "-111", "-137", "+198"),
    ("carbon dioxide", "CO2", "g", "-394", "-394", "+214"),
    ("hydrogen bromide", "HBr", "g", "-36", "-53", "+199"),
    ("hydrogen chloride", "HCl", "g", "-92", "-95", "+187"),
    ("hydrogen fluoride", "HF", "g", "-273", "-275", "+174"),
    ("hydrogen iodide", "HI", "g", "+26", "+2", "+207"),
]

# --------------------------------------------------------------------------------------- p19: enthalpies of combustion
COMBUSTION = [
    ("hydrogen", "H2", "g", "-286"), ("sulfur", "S", "s", "-297"), ("carbon (graphite)", "C", "s", "-394"),
    ("carbon monoxide", "CO", "g", "-283"), ("methane", "CH4", "g", "-891"), ("ethane", "C2H6", "g", "-1561"),
    ("propane", "C3H8", "g", "-2219"), ("butane", "C4H10", "g", "-2878"), ("pentane", "C5H12", "l", "-3509"),
    ("hexane", "C6H14", "l", "-4163"), ("octane", "C8H18", "l", "-5470"), ("cyclohexane", "C6H12", "l", "-3920"),
    ("ethene", "C2H4", "g", "-1411"), ("buta-1,3-diene", "C4H6", "g", "-2541"), ("ethyne", "C2H2", "g", "-1301"),
    ("benzene", "C6H6", "l", "-3268"), ("methylbenzene", "C6H5CH3", "l", "-3910"), ("naphthalene", "C10H8", "s", "-5156"),
    ("chloroethane", "C2H5Cl", "g", "-1413"), ("iodoethane", "C2H5I", "l", "-1463"), ("trichloromethane", "CHCl3", "l", "-473"),
    ("methanol", "CH3OH", "l", "-726"), ("ethanol", "C2H5OH", "l", "-1367"),
    ("propan-1-ol", "C3H7OH", "l", "-2021"), ("butan-1-ol", "C4H9OH", "l", "-2676"), ("cyclohexanol", "C6H11OH", "s", "-3728"),
    ("phenol", "C6H5OH", "s", "-3053"), ("ethoxyethane", "(C2H5)2O", "l", "-2724"), ("methanal", "HCHO", "g", "-571"),
    ("ethanal", "CH3CHO", "g", "-1167"), ("benzaldehyde", "C6H5CHO", "l", "-3525"), ("propanone", "(CH3)2CO", "l", "-1790"),
    ("pentan-3-one", "(C2H5)2CO", "l", "-3100"), ("phenylethanone", "CH3COC6H5", "l", "-4149"),
    ("methanoic acid", "HCOOH", "l", "-255"), ("ethanoic acid", "CH3COOH", "l", "-874"), ("benzoic acid", "C6H5COOH", "s", "-3228"),
    ("ethanedioic acid", "(COOH)2", "s", "-243"), ("ethyl ethanoate", "CH3COOC2H5", "l", "-2238"),
    ("ethanamide", "CH3CONH2", "s", "-1186"), ("methylamine", "CH3NH2", "g", "-1086"), ("phenylamine", "C6H5NH2", "l", "-3393"),
    ("nitrobenzene", "C6H5NO2", "l", "-3088"), ("urea", "CO(NH2)2", "s", "-633"), ("glucose", "C6H12O6", "s", "-2803"),
    ("sucrose", "C12H22O11", "s", "-5640"),
]

# --------------------------------------------------------------------------------------------- p21: lattice enthalpies
_HALIDES = {"Li": ("1049", "864", "820", "764"), "Na": ("930", "790", "754", "705"), "K": ("829", "720", "691", "650"),
            "Rb": ("795", "695", "668", "632"), "Cs": ("759", "670", "647", "613")}
LATTICE = {f"{metal}{halogen}": value for metal, row in _HALIDES.items() for halogen, value in zip(("F", "Cl", "Br", "I"), row)}
LATTICE.update({
    "CaF2": "2651", "BeCl2": "3033", "MgCl2": "2540", "CaCl2": "2271", "SrCl2": "2170", "BaCl2": "2069", "MgO": "3791",
    "CaO": "3401", "SrO": "3223", "BaO": "3054", "CuCl2": "2824", "AgF": "974", "AgCl": "918", "AgBr": "905", "AgI": "892",
})

# -------------------------------------------------------------------------------------------------- p23: indicators
#: name -> (pKa, pH range low, high, acid colour, alkali colour)
INDICATORS = {
    "methyl orange": ("3.7", "3.1", "4.4", "red", "yellow"),
    "bromophenol blue": ("4.2", "3.0", "4.6", "yellow", "blue"),
    "bromocresol green": ("4.7", "4.0", "5.6", "yellow", "blue"),
    "methyl red": ("5.1", "4.4", "6.2", "red", "yellow"),
    "bromothymol blue": ("7.0", "6.0", "7.6", "yellow", "blue"),
    "phenol red": ("7.9", "6.4", "8.0", "yellow", "red"),
    "phenolphthalein": ("9.6", "8.0", "10.0", "colourless", "pink"),
}

# --------------------------------------------------------------------------------- p24: standard reduction potentials
#: (oxidized species / reduced species couple, the half-equation as printed, E⦵ / V)
REDUCTION = [
    ("Li+/Li", "Li+(aq) + e- <=> Li(s)", "-3.04"),
    ("K+/K", "K+(aq) + e- <=> K(s)", "-2.93"),
    ("Ca2+/Ca", "Ca^2+(aq) + 2e- <=> Ca(s)", "-2.87"),
    ("Na+/Na", "Na+(aq) + e- <=> Na(s)", "-2.71"),
    ("Mg2+/Mg", "Mg^2+(aq) + 2e- <=> Mg(s)", "-2.37"),
    ("Al3+/Al", "Al^3+(aq) + 3e- <=> Al(s)", "-1.66"),
    ("Mn2+/Mn", "Mn^2+(aq) + 2e- <=> Mn(s)", "-1.18"),
    ("H2O/H2", "H2O(l) + e- <=> 1/2H2(g) + OH-(aq)", "-0.83"),
    ("Zn2+/Zn", "Zn^2+(aq) + 2e- <=> Zn(s)", "-0.76"),
    ("Fe2+/Fe", "Fe^2+(aq) + 2e- <=> Fe(s)", "-0.45"),
    ("Ni2+/Ni", "Ni^2+(aq) + 2e- <=> Ni(s)", "-0.26"),
    ("Sn2+/Sn", "Sn^2+(aq) + 2e- <=> Sn(s)", "-0.14"),
    ("Pb2+/Pb", "Pb^2+(aq) + 2e- <=> Pb(s)", "-0.13"),
    ("H+/H2", "H+(aq) + e- <=> 1/2H2(g)", "0.00"),
    ("Cu2+/Cu+", "Cu^2+(aq) + e- <=> Cu+(aq)", "+0.15"),
    ("SO4 2-/H2SO3", "SO4^2-(aq) + 4H+(aq) + 2e- <=> H2SO3(aq) + H2O(l)", "+0.17"),
    ("Cu2+/Cu", "Cu^2+(aq) + 2e- <=> Cu(s)", "+0.34"),
    ("O2/OH-", "1/2O2(g) + H2O(l) + 2e- <=> 2OH-(aq)", "+0.40"),
    ("Cu+/Cu", "Cu+(aq) + e- <=> Cu(s)", "+0.52"),
    ("I2/I-", "1/2I2(s) + e- <=> I-(aq)", "+0.54"),
    ("Fe3+/Fe2+", "Fe^3+(aq) + e- <=> Fe^2+(aq)", "+0.77"),
    ("Ag+/Ag", "Ag+(aq) + e- <=> Ag(s)", "+0.80"),
    ("Br2/Br-", "1/2Br2(l) + e- <=> Br-(aq)", "+1.09"),
    ("O2/H2O", "1/2O2(g) + 2H+(aq) + 2e- <=> H2O(l)", "+1.23"),
    ("Cr2O7 2-/Cr3+", "Cr2O7^2-(aq) + 14H+(aq) + 6e- <=> 2Cr^3+(aq) + 7H2O(l)", "+1.36"),
    ("Cl2/Cl-", "1/2Cl2(g) + e- <=> Cl-(aq)", "+1.36"),
    ("MnO4-/Mn2+", "MnO4-(aq) + 8H+(aq) + 5e- <=> Mn^2+(aq) + 4H2O(l)", "+1.51"),
    ("F2/F-", "1/2F2(g) + e- <=> F-(aq)", "+2.87"),
]


# =========================================================================================================== helpers

def _exact(printed: str):
    return Rational(printed.lstrip("+"))


def _unknown(kind: str, key: str, choices):
    close = difflib.get_close_matches(str(key), [str(c) for c in choices], n=3, cutoff=0.6)
    hint = f"; did you mean {', '.join(repr(c) for c in close)}?" if close else ""
    return ValueError(f"{kind}({key!r}): not in the IB Chemistry data booklet{hint}")


def _text(value, helper):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{helper} needs text, as in {helper}(\"...\")")
    return value.strip()


def Ar(symbol):
    """Relative atomic mass from the booklet's periodic table (p12), e.g. Ar("Cl") = 35.45."""
    symbol = _text(symbol, "Ar")
    if symbol not in AR:
        raise _unknown("Ar", symbol, AR)
    return _exact(AR[symbol])


def Mr(formula):
    """Relative formula mass, the sum of booklet Ar values: Mr("H2SO4"), Mr("CuSO4·5H2O"), Mr("Ca(OH)2")."""
    from chemparse import Formula, parse_formula  # noqa: PLC0415

    parsed = formula if isinstance(formula, Formula) else parse_formula(_text(formula, "Mr"), lenient=True)
    if not parsed.counts:
        raise ValueError(f"Mr({formula!r}): no atoms")
    return sum((Ar(element) * n for element, n in parsed.counts.items()), Integer(0))


_BOND_ORDER = {"-": "-", "—": "-", "―": "-", "–": "-", "−": "-", "=": "=", "#": "#", "≡": "#"}


def BE(bond):
    """Bond enthalpy (p17), kJ mol-1: BE("C-H"), BE("C=O"), BE("N#N") or BE("N≡N"); either order."""
    text = re.sub(r"\s+", "", _text(bond, "BE"))
    match = re.fullmatch(r"([A-Z][a-z]?)([-—―–−=#≡])([A-Z][a-z]?)", text)
    if not match:
        raise ValueError(f"BE({bond!r}): write a bond as two element symbols joined by - = or #, as in BE(\"C=O\")")
    a, order, b = match.group(1), _BOND_ORDER[match.group(2)], match.group(3)
    for key in (f"{a}{order}{b}", f"{b}{order}{a}"):
        if key in BONDS:
            return _exact(BONDS[key])
    raise _unknown("BE", f"{a}{order}{b}", BONDS)


def _lookup(table, column, key, helper):
    """A row of THERMO / COMBUSTION by name, or by formula with an optional state (composition-compared)."""
    from chemparse import parse_species  # noqa: PLC0415

    text = _text(key, helper)
    named = [row for row in table if row[0] == text.lower()]
    if not named:
        try:
            formula, state = parse_species(text)
        except ValueError:
            raise _unknown(helper, text, [row[0] for row in table] + [f"{row[1]}({row[2]})" for row in table]) from None
        named = [row for row in table if parse_species(row[1])[0] == formula and (state is None or row[2] == state)]
        written = [row for row in named if row[1] == re.sub(r"\(\s*(?:s|l|g|aq)\s*\)$", "", text).strip()]
        if len(named) > 1 and len(written) == 1:
            named = written  # C2H5OH, not dimethyl ether
    if not named:
        raise _unknown(helper, text, [f"{row[1]}({row[2]})" for row in table])
    if len(named) > 1:
        options = ", ".join(f"{row[0]!r} ({row[1]}({row[2]}))" for row in named)
        raise ValueError(f"{helper}({text!r}) matches several booklet entries: {options}; name the state or the compound")
    value = named[0][column]
    if value is None:
        raise ValueError(f"{helper}({text!r}): the booklet gives no value for {named[0][0]}")
    return _exact(value)


def Hf(key):
    """Standard enthalpy of formation (p18), kJ mol-1: Hf("CH4(g)"), Hf("H2O(l)"), Hf("but-1-ene")."""
    return _lookup(THERMO, 3, key, "Hf")


def Gf(key):
    """Standard Gibbs energy of formation (p18), kJ mol-1."""
    return _lookup(THERMO, 4, key, "Gf")


def S_std(key):
    """Standard entropy (p18), J K-1 mol-1 (S("CH4(g)") in a truth)."""
    return _lookup(THERMO, 5, key, "S")


def Hc(key):
    """Standard enthalpy of combustion (p19), kJ mol-1: Hc("C2H5OH(l)"), Hc("glucose")."""
    return _lookup(COMBUSTION, 3, key, "Hc")


def lattice(compound):
    """Lattice enthalpy (p21), kJ mol-1, endothermic (positive): lattice("NaCl"), lattice("MgO")."""
    text = re.sub(r"\s+", "", _text(compound, "lattice"))
    if text not in LATTICE:
        raise _unknown("lattice", text, LATTICE)
    return _exact(LATTICE[text])


def _couple_key(text):
    from chemparse import parse_formula  # noqa: PLC0415

    parts = text.split("/")
    if len(parts) != 2:
        raise ValueError(f"E0({text!r}): write a couple as oxidized/reduced, as in E0(\"Cu2+/Cu\")")
    return tuple(parse_formula(part.strip(), lenient=True).key() for part in parts)


def E0(couple):
    """Standard reduction potential (p24), V: E0("Cu2+/Cu"), E0("Fe3+/Fe2+"), E0("MnO4-/Mn2+"), E0("O2/H2O")."""
    text = _text(couple, "E0")
    try:
        key = _couple_key(text)
    except ValueError as error:
        if "oxidized/reduced" in str(error):
            raise
        raise _unknown("E0", text, [row[0] for row in REDUCTION]) from None
    for name, _, value in REDUCTION:
        if _couple_key(name) == key:
            return _exact(value)
    raise _unknown("E0", text, [row[0] for row in REDUCTION])


def _indicator(name, helper):
    text = re.sub(r"\s+", " ", _text(name, helper)).lower()
    if text not in INDICATORS:
        raise _unknown(helper, text, INDICATORS)
    return INDICATORS[text]


def pKa_ind(name):
    """Indicator pKa (p23): pKa_ind("methyl orange") = 3.7."""
    return _exact(_indicator(name, "pKa_ind")[0])


def pH_range_ind(name):
    """Indicator pH range (p23) as (low, high): pH_range_ind("phenolphthalein") = (8.0, 10.0)."""
    row = _indicator(name, "pH_range_ind")
    return (_exact(row[1]), _exact(row[2]))


def _periodic(symbol, column, helper, what):
    text = _text(symbol, helper)
    if text not in PERIODIC_14:
        raise _unknown(helper, text, PERIODIC_14)
    value = PERIODIC_14[text][column]
    if value is None:
        raise ValueError(f"{helper}({text!r}): the booklet gives no {what} for {text}")
    return _exact(value)


def IE1(symbol):
    """First ionization energy (p14), kJ mol-1."""
    return _periodic(symbol, 0, "IE1", "first ionization energy")


def EA(symbol):
    """First electron affinity (p14), kJ mol-1 (negative: energy released)."""
    return _periodic(symbol, 1, "EA", "electron affinity")


def EA2(symbol):
    """Second electron affinity (p14), kJ mol-1: O +753, S +545."""
    text = _text(symbol, "EA2")
    if text not in EA2_PRINTED:
        raise _unknown("EA2", text, EA2_PRINTED)
    return _exact(EA2_PRINTED[text])


def EN(symbol):
    """Pauling electronegativity (p14)."""
    return _periodic(symbol, 2, "EN", "electronegativity")


def constant(name):
    mantissa, power, _ = CONSTANTS[name]
    return Rational(mantissa) * Integer(10) ** power


# ---------------------------------------------------------------------------------------------- formula helpers

def _amounts(data, helper):
    if not isinstance(data, dict) or not data:
        raise ValueError(f"{helper} needs a dict of element percentages or masses, as in {helper}({{\"C\": 85.7, \"H\": 14.3}})")
    amounts = {}
    for element, value in data.items():
        element = str(element)
        if element not in AR:
            raise ValueError(f"{helper}: {element!r} is not an element symbol")
        number = Rational(value)
        if not number > 0:
            raise ValueError(f"{helper}: the amount of {element} must be positive")
        amounts[element] = number / Ar(element)
    return amounts


#: Mole ratios are rounded only when every one is within this of a whole number (after the multiplier).
RATIO_TOLERANCE = Fraction(8, 100)


def empirical_formula(data):
    """Empirical formula from percentages or masses by element, with booklet Ar values:
    empirical_formula({"C": 85.7, "H": 14.3}) -> CH2.

    Each amount / Ar is divided by the smallest. The ratios are multiplied by 1, 2, 3, 4 (in that order) until every one is
    within 0.08 of a whole number (1.5 -> x2, 1.33 -> x3, 1.25 -> x4). Data that fits none is ambiguous: ValueError."""
    from chemparse import Formula  # noqa: PLC0415

    amounts = _amounts(data, "empirical_formula")
    smallest = min(amounts.values())
    ratios = {element: Fraction(str(float(value / smallest))) for element, value in amounts.items()}
    for multiplier in (1, 2, 3, 4):
        scaled = {element: ratio * multiplier for element, ratio in ratios.items()}
        if all(abs(value - round(value)) <= RATIO_TOLERANCE for value in scaled.values()):
            return Formula({element: round(value) for element, value in scaled.items()})
    shown = ", ".join(f"{element} {float(ratio):.3f}" for element, ratio in ratios.items())
    raise ValueError(f"empirical_formula: the mole ratios ({shown}) are not close to whole numbers after x1..x4; the data is ambiguous")


def molecular_formula(empirical, molar_mass):
    """Molecular formula from an empirical formula and Mr: molecular_formula("CH2", 56.1) -> C4H8. The ratio
    Mr / Mr(empirical) must be within 2 % of a whole number."""
    from chemparse import Formula, parse_formula  # noqa: PLC0415

    base = empirical if isinstance(empirical, Formula) else parse_formula(_text(empirical, "molecular_formula"), lenient=True)
    ratio = Rational(molar_mass) / Mr(base)
    n = round(float(ratio))
    if n < 1 or abs(float(ratio) - n) > 0.02 * n:
        raise ValueError(f"molecular_formula: Mr {molar_mass} / Mr({base.text}) = {float(ratio):.3f} is not a whole number")
    return Formula({element: count * n for element, count in base.counts.items()}, base.charge * n)


def ionic_formula(cation, anion):
    """Neutral formula of an ionic compound: ionic_formula("Al3+", "SO4 2-") -> Al2(SO4)3."""
    from chemparse import Formula, charge_text, parse_formula  # noqa: PLC0415

    plus = parse_formula(_text(cation, "ionic_formula"), lenient=True)
    minus = parse_formula(_text(anion, "ionic_formula"), lenient=True)
    if plus.charge <= 0 or minus.charge >= 0:
        raise ValueError(f"ionic_formula({cation!r}, {anion!r}): give a cation then an anion, each with its charge")
    lcm = plus.charge * -minus.charge // _gcd(plus.charge, -minus.charge)
    a, b = lcm // plus.charge, lcm // -minus.charge
    counts = {}
    for formula, n in ((plus, a), (minus, b)):
        for element, k in formula.counts.items():
            counts[element] = counts.get(element, 0) + k * n

    def part(formula, n):
        body = formula.text[: len(formula.text) - len(charge_text(formula.charge))] if charge_text(formula.charge) else formula.text
        if n == 1:
            return body
        return f"({body}){n}" if len(formula.counts) > 1 or sum(formula.counts.values()) > 1 else f"{body}{n}"

    return Formula(counts, 0, part(plus, a) + part(minus, b))


def _gcd(a, b):
    while b:
        a, b = b, a % b
    return a


def formula(text):
    """A formula stated in the question itself (verify needs given: true): formula("C2H5OH")."""
    from chemparse import parse_formula  # noqa: PLC0415

    return parse_formula(_text(text, "formula"))


#: Helpers that take text arguments (verify_kinds allows string constants only as their arguments).
TEXT_HELPERS = {"Ar", "Mr", "BE", "Hf", "Gf", "S", "Hc", "lattice", "E0", "pKa_ind", "pH_range_ind", "IE1", "EA", "EA2", "EN",
                "molecular_formula", "ionic_formula", "formula"}
#: Helpers whose value is a Formula (the truth of a `formula` verify).
FORMULA_HELPERS = {"empirical_formula", "molecular_formula", "ionic_formula", "formula"}


def namespace():
    """Names added to the verify truth namespace."""
    names = {
        "Ar": Ar, "Mr": Mr, "BE": BE, "Hf": Hf, "Gf": Gf, "Hc": Hc, "lattice": lattice, "E0": E0, "pKa_ind": pKa_ind,
        "pH_range_ind": pH_range_ind, "IE1": IE1, "EA": EA, "EA2": EA2, "EN": EN, "empirical_formula": empirical_formula,
        "molecular_formula": molecular_formula, "ionic_formula": ionic_formula, "formula": formula,
    }
    for name in ("R", "NA", "F", "Kw", "c_water", "Vm", "h_planck", "c_light", "e_charge"):
        names[name] = constant(name)
    for name, (value, _) in CONDITIONS.items():
        names[name] = Rational(value)
    return names
