"""IB Physics data booklet values, for computing truths in physics lessons.

Source: IB Diploma Programme Physics data booklet, first assessment 2025, version 1.1 (published February 2023,
updated May 2023). Every value is transcribed exactly as printed, as a decimal string, and becomes an exact SymPy
Rational, so "m*g" with m = 2.0 is exactly 2.0 x 9.8. test_phys.py checks each number against the booklet's page text.

Names usable in a verify truth of a physics course (verify_kinds.py adds them only with physics=True, so a maths truth
keeps g, G, R, c, h and e as ordinary symbols, and e there stays Euler's number E):
  p3 Fundamental constants
    g 9.8 m s-2                 G 6.67e-11 N m2 kg-2       NA 6.02e23 mol-1           R 8.31 J K-1 mol-1
    kB 1.38e-23 J K-1           sigma 5.67e-8 W m-2 K-4    k_e 8.99e9 N m2 C-2 (Coulomb constant k)
    eps0 8.85e-12 C2 N-1 m-2    mu0 4*pi*1e-7 T m A-1      c 3.00e8 m s-1             h 6.63e-34 J s
    e 1.60e-19 C                me 9.110e-31 kg            mp 1.673e-27 kg            mn 1.675e-27 kg
    u_kg 1.661e-27 kg           S_solar 1.36e3 W m-2       R0 1.20e-15 m (Fermi radius)
    me_u 0.000549, mp_u 1.007276, mn_u 1.008665 (u);  me_MeV 0.511, mp_MeV 938, mn_MeV 940, u_MeV 931.5 (MeV c-2)
  p4 Unit conversions
    ly 9.46e15 m      pc_ly 3.26 (ly)      pc = pc_ly*ly (m)      AU 1.50e11 m      kWh 3.60e6 J
    hc 1.99e-25 J m   hc_eV 1.24e-6 eV m   zero_celsius 273 (T/K = T/°C + 273)
  p8 B.1  wien_b 2.9e-3 m K (λmax T = 2.9 x 10^-3 m K)
  Derived (not printed as their own line): eV = e x 1 V = 1.60e-19 J; keV, MeV, GeV the same x 1e3, 1e6, 1e9.
  Not printed in this booklet: the specific heat capacity of water (give it in the question).
  The metric multipliers (p4) are in PREFIXES for reference; a truth writes them as powers of ten (3.2*10**-6), so the
  one-letter prefixes never shadow variables.

Degree-mode trigonometry (physics only): sind(35), cosd, tand take degrees; asind(0.5), acosd, atand return degrees.
All stay exact SymPy (sind(30) is 1/2), so "20*cosd(35)" is a computed truth.
"""
from sympy import Integer, Rational, acos, asin, atan, cos, pi, sin, tan

# --------------------------------------------------------------------------------------- p3: fundamental constants
#: name -> (mantissa, power of ten, unit) exactly as printed. mu0 is printed as 4π x 10^-7 and is built below.
CONSTANTS = {
    "g": ("9.8", 0, "m s-2"),
    "G": ("6.67", -11, "N m2 kg-2"),
    "NA": ("6.02", 23, "mol-1"),
    "R": ("8.31", 0, "J K-1 mol-1"),
    "kB": ("1.38", -23, "J K-1"),
    "sigma": ("5.67", -8, "W m-2 K-4"),
    "k_e": ("8.99", 9, "N m2 C-2"),
    "eps0": ("8.85", -12, "C2 N-1 m-2"),
    "c": ("3.00", 8, "m s-1"),
    "h": ("6.63", -34, "J s"),
    "e": ("1.60", -19, "C"),
    "me": ("9.110", -31, "kg"),
    "mp": ("1.673", -27, "kg"),
    "mn": ("1.675", -27, "kg"),
    "u_kg": ("1.661", -27, "kg"),
    "S_solar": ("1.36", 3, "W m-2"),
    "R0": ("1.20", -15, "m"),
}
#: The rest masses in other units, from the same rows (p3).
MASSES = {
    "me_u": ("0.000549", "u"), "mp_u": ("1.007276", "u"), "mn_u": ("1.008665", "u"),
    "me_MeV": ("0.511", "MeV c-2"), "mp_MeV": ("938", "MeV c-2"), "mn_MeV": ("940", "MeV c-2"), "u_MeV": ("931.5", "MeV c-2"),
}
#: mu0 = 4π x 10^-7 T m A-1 (p3).
MU0 = ("4", -7, "T m A-1")

# ----------------------------------------------------------------------------------------- p4: unit conversions
CONVERSIONS = {
    "ly": ("9.46", 15, "m"),
    "AU": ("1.50", 11, "m"),
    "kWh": ("3.60", 6, "J"),
    "hc": ("1.99", -25, "J m"),
    "hc_eV": ("1.24", -6, "eV m"),
}
#: 1 parsec (pc) = 3.26 ly; Temperature (K) = temperature (°C) + 273; 1 radian = 180°/π.
PC_LY = "3.26"
ZERO_CELSIUS = "273"

# ------------------------------------------------------------------------------------------ p4: metric multipliers
#: Prefix -> (abbreviation, power of ten) exactly as printed.
PREFIXES = {
    "peta": ("P", 15), "tera": ("T", 12), "giga": ("G", 9), "mega": ("M", 6), "kilo": ("k", 3), "hecto": ("h", 2),
    "deca": ("da", 1), "deci": ("d", -1), "centi": ("c", -2), "milli": ("m", -3), "micro": ("μ", -6), "nano": ("n", -9),
    "pico": ("p", -12), "femto": ("f", -15),
}

# --------------------------------------------------------------------------------------------- p8: Wien's law (B.1)
WIEN = ("2.9", -3, "m K")


def _value(mantissa, power=0):
    return Rational(mantissa) * Integer(10) ** power


def constant(name):
    """A booklet constant or conversion by its truth name (see the module docstring)."""
    return namespace()[name]


# ------------------------------------------------------------------------------------------- degree trigonometry

def sind(degrees):
    return sin(degrees * pi / 180)


def cosd(degrees):
    return cos(degrees * pi / 180)


def tand(degrees):
    return tan(degrees * pi / 180)


def asind(value):
    return asin(value) * 180 / pi


def acosd(value):
    return acos(value) * 180 / pi


def atand(value):
    return atan(value) * 180 / pi


TRIG = {"sind": sind, "cosd": cosd, "tand": tand, "asind": asind, "acosd": acosd, "atand": atand}


def namespace():
    """Names added to the verify truth namespace of a physics course."""
    names = {name: _value(mantissa, power) for name, (mantissa, power, _) in CONSTANTS.items()}
    names.update({name: _value(mantissa) for name, (mantissa, _) in MASSES.items()})
    names["mu0"] = Integer(4) * pi * Integer(10) ** MU0[1]
    names.update({name: _value(mantissa, power) for name, (mantissa, power, _) in CONVERSIONS.items()})
    names["pc_ly"] = _value(PC_LY)
    names["pc"] = names["pc_ly"] * names["ly"]
    names["zero_celsius"] = _value(ZERO_CELSIUS)
    names["wien_b"] = _value(WIEN[0], WIEN[1])
    names["eV"] = names["e"]
    names["keV"] = names["e"] * Integer(10) ** 3
    names["MeV"] = names["e"] * Integer(10) ** 6
    names["GeV"] = names["e"] * Integer(10) ** 9
    names.update(TRIG)
    return names
