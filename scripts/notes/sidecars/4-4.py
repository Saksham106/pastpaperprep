"""SymPy assertions for lesson 4.4 (correlation and regression, y on x). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every statistic (means, Pearson's r, the least-squares a and b, predictions) is computed here from each question's own
data with exact SymPy rationals: r = Sxy / sqrt(Sxx Syy), a = Sxy / Sxx, b = ybar - a xbar.

Correlation words come from r by the lesson's own rough guide: |r| >= 0.75 strong, 0.25 <= |r| < 0.75 weak, below 0.25
no correlation; the sign gives the direction. Every r used is asserted to sit at least 0.05 away from a cut-off, so the
word is never a borderline call. Significance compares |r| with the critical value the question gives, and each given
critical value is itself checked against the true two-tailed 5% value, r_crit = t / sqrt(n - 2 + t^2) with t the 0.975
quantile of Student's t on n - 2 degrees of freedom.

Word answers that are not a correlation word (which line to use, what a or b means, which variable is a third cause)
are encoded as facts of the question's set-up, and the true answer is derived from those facts by a rule. Each option is
read into the claim it makes; a claim that disagrees with the derived truth raises AssertionError, and text that cannot
be read raises ValueError.
"""
import re
import sys
from pathlib import Path

from sympy import Rational, S, N, nsimplify, nsolve, simplify, sqrt, symbols
from sympy.stats import StudentT, cdf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, check_rounded, check_same_equation, parse_answer, parse_with_unit  # noqa: E402

X, Y = symbols("x y")


def same(tex, truth, unit=None):
    """Exact comparison; a published decimal such as 11.1 is read as the rational it states. With `unit`, the answer
    must end with that unit (parse_with_unit raises otherwise) and the value before it is compared."""
    published = nsimplify(str(parse_answer(parse_with_unit(tex, unit) if unit else tex)), rational=True)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def plain(text):
    """Option or answer text with $, \\text{...} wrappers and extra spaces removed, lower case."""
    text = text.replace("$", "")
    text = re.sub(r"\\text\{([^}]*)\}", r"\1", text)
    text = text.replace("\\,", "").replace("\\;", " ")
    return re.sub(r"\s+", " ", text).strip().lower()


# ------------------------------------------------------------------------------------------------ statistics

def exact(values):
    return [S(str(v)) for v in values]


def summary(xs, ys):
    xs, ys = exact(xs), exact(ys)
    n = len(xs)
    xbar, ybar = sum(xs) / n, sum(ys) / n
    sxx = sum((x - xbar) ** 2 for x in xs)
    syy = sum((y - ybar) ** 2 for y in ys)
    sxy = sum((x - xbar) * (y - ybar) for x, y in zip(xs, ys))
    a = sxy / sxx
    return {"xbar": xbar, "ybar": ybar, "sxy": sxy, "r": sxy / sqrt(sxx * syy), "a": a, "b": ybar - a * xbar,
            "xmin": min(xs), "xmax": max(xs)}


def describe(r):
    """The lesson's rough guide, refusing any r within 0.05 of a cut-off."""
    size = abs(float(N(r, 15)))
    assert all(abs(size - cut) >= 0.05 for cut in (0.25, 0.75)), f"r = {N(r)} is too close to a cut-off"
    if size < 0.25:
        return "no correlation"
    strength = "strong" if size >= 0.75 else "weak"
    return f"{strength} {'positive' if r > 0 else 'negative'} correlation"


def check_description(tex, r):
    published = plain(tex)
    if not re.fullmatch(r"(strong|weak) (positive|negative) correlation|no correlation", published):
        raise ValueError(f"cannot read a correlation description from {tex!r}")
    if published != describe(r):
        raise AssertionError(f"{tex!r}, but r = {N(r, 6)} gives {describe(r)}")


_T = symbols("t")


def true_critical_value(n):
    """Two-tailed 5% critical value of r for n pairs."""
    t = nsolve(cdf(StudentT("T", n - 2))(_T) - Rational(975, 1000), _T, 2.3)
    return t / sqrt(n - 2 + t**2)


def significant(r, given_critical, n):
    """|r| against the critical value the question gives, after checking that value is the real one (3 d.p.)."""
    given = S(str(given_critical))
    assert abs(N(true_critical_value(n), 15) - given) < Rational(5, 10000), f"critical value {given} wrong for n = {n}"
    r = S(str(r))
    assert abs(abs(r) - given) > Rational(1, 100), "too close to the critical value to judge"
    return abs(r) > given


def check_significance(tex, r, given_critical, n):
    published = plain(tex)
    claims = {"significant linear correlation": True, "no significant linear correlation": False}
    if published not in claims:
        raise ValueError(f"cannot read a significance verdict from {tex!r}")
    truth = significant(r, given_critical, n)
    if claims[published] != truth:
        raise AssertionError(f"{tex!r}, but |r| = {abs(S(str(r)))} vs {given_critical} gives significant = {truth}")


def check_rounded_line(tex, a, b, sf=3):
    """`y \\approx 2.68x + 5.83`: each coefficient must be the truth rounded half-up to `sf` figures."""
    match = re.fullmatch(r"\$?\s*y\s*\\approx\s*(-?\d+(?:\.\d+)?)\s*x\s*([+-])\s*(\d+(?:\.\d+)?)\s*\$?", tex.strip())
    if not match:
        raise ValueError(f"cannot read y = ax + b from {tex!r}")
    slope, sign, intercept = match.groups()
    check_rounded(rf"a \approx {slope}", a, sf=sf)
    check_rounded(rf"b \approx {'-' if sign == '-' else ''}{intercept}", b, sf=sf)


# ------------------------------------------------------------------------------------------------ question data

ALTITUDE = summary([2, 5, 8, 11, 14, 17, 20, 24], ["24.1", "22.6", "20.2", "18.9", "16.4", "15.1", "12.3", "10.2"])
BALL = summary([0, 1, 2, 3, 4, 5, 6], [30 * t - 5 * t**2 for t in range(7)])
PRINT = summary([3, 7, 10, 14, 18, 20], [21, 30, 36, 47, 55, 63])
CYCLE = summary([12, 18, 25, 30, 34, 41, 47], [38, 55, 71, 88, 95, 118, 131])
assert CYCLE["r"] > Rational(99, 100)  # the steps call the correlation very strong


def print_line():
    """The by-eye line through the data's mean point and the second point (2, 18) read off it."""
    mean = (PRINT["xbar"], PRINT["ybar"])
    m = (mean[1] - 18) / (mean[0] - 2)
    return m, 18 - m * 2


def check_print_line(tex):
    m, c = print_line()
    check_same_equation(tex, Y - (m * X + c))


# ------------------------------------------------------------------------------------------------ word options

def option_claim(text, options):
    key = plain(text)
    if key not in options:
        raise ValueError(f"unknown option {text!r}")
    return options[key]


# check-car-direction: price tends to fall as age rises.
CAR_TREND = "falls"
DIRECTION_FROM_TREND = {"rises": "positive", "falls": "negative", "none": "zero"}
CAR_OPTIONS = {"positive correlation": "positive", "negative correlation": "negative", "zero correlation": "zero"}


def check_car(text):
    claim = option_claim(text, CAR_OPTIONS)
    truth = DIRECTION_FROM_TREND[CAR_TREND]
    if claim != truth:
        raise AssertionError(f"{text!r}; y {CAR_TREND} as x rises, so the correlation is {truth}")


# check-r-meaning: r = -0.97. r describes strength and direction only; it is not a rate of change.
R_MEANING = S("-0.97")
R_OPTIONS = {
    "there is strong negative linear correlation": ("describe", "strong negative correlation"),
    "there is weak negative linear correlation": ("describe", "weak negative correlation"),
    "y falls by 0.97 for each increase of 1 in x": ("rate", R_MEANING),
}


def check_r_meaning(text):
    kind, claim = option_claim(text, R_OPTIONS)
    if kind == "rate":
        raise AssertionError(f"{text!r} reads r as a gradient; r measures strength and direction only")
    if claim != describe(R_MEANING):
        raise AssertionError(f"{text!r}, but r = {R_MEANING} gives {describe(R_MEANING)}")


# check-critical: n = 10, r = -0.58, critical value 0.632. The test compares |r|, so a negative r is allowed.
CRIT_OPTIONS = {
    "there is significant negative linear correlation": ("verdict", True),
    "there is no significant linear correlation": ("verdict", False),
    "the critical value can't be used, because r is negative": ("test invalid", None),
}


def check_critical(text):
    kind, claim = option_claim(text, CRIT_OPTIONS)
    if kind == "test invalid":
        raise AssertionError("the critical value test uses |r|, so it applies to a negative r")
    truth = significant("-0.58", "0.632", 10)
    if claim != truth:
        raise AssertionError(f"{text!r}, but significant = {truth}")


# check-shoe-reading: age drives both shoe size and reading; neither variable can change the other.
SHOE = {"third_variable": "age", "x_changes_y": False, "y_changes_x": False}
SHOE_OPTIONS = {
    "having bigger feet helps children to read": "x_changes_y",
    "reading more makes children's feet grow": "y_changes_x",
    "older children tend to have bigger feet and also read better": "third_variable",
}


def check_shoe(text):
    claim = option_claim(text, SHOE_OPTIONS)
    holds = bool(SHOE[claim])
    if not holds:
        raise AssertionError(f"{text!r} claims a causal link that the set-up rules out")


# check-library-accidents: n = 14, r = 0.83, critical value 0.532. Significance is computed from the data; whatever
# the verdict, a correlation alone never establishes causation (population is a plausible third variable).
LIBRARY = {"r": "0.83", "critical": "0.532", "n": 14, "correlation_shows_causation": False}
LIBRARY_OPTIONS = {
    "the claim is proved, because the correlation is significant": (True, True),
    "the correlation is significant, but population could drive both, so it does not show causation": (True, False),
    "the correlation is not significant, so there is no link": (False, False),
}


def check_library(text):
    claims_significant, claims_causation = option_claim(text, LIBRARY_OPTIONS)
    truth = significant(LIBRARY["r"], LIBRARY["critical"], LIBRARY["n"])
    if claims_significant != truth:
        raise AssertionError(f"{text!r}, but |r| = {LIBRARY['r']} vs {LIBRARY['critical']} gives significant = {truth}")
    if claims_causation != LIBRARY["correlation_shows_causation"]:
        raise AssertionError(f"{text!r} treats correlation as proof of causation")


# check-interpret-a / -b: the cycling model, with a and b computed from the data.
A_OPTIONS = {
    "a ride takes about 2.68 minutes": ("value", "2.68"),
    "the ride time increases as the distance increases": ("direction only", None),
    "each extra kilometre adds about 2.68 minutes, on average": ("rate", "2.68"),
}


def check_interpret_a(text):
    kind, number = option_claim(text, A_OPTIONS)
    if kind != "rate":
        raise AssertionError(f"{text!r} is not the rate of change of y per unit x")
    check_rounded(rf"a \approx {number}", CYCLE["a"], sf=3)


B_OPTIONS = {
    "the predicted time for a 0 km ride, which has no real meaning": ("value at x = 0", False),
    "the extra time for each kilometre": ("rate", None),
    "the time of the shortest ride": ("data value", None),
}


def check_interpret_b(text):
    kind, meaningful = option_claim(text, B_OPTIONS)
    if kind != "value at x = 0":
        raise AssertionError(f"{text!r}: b is the predicted y at x = 0")
    truth = CYCLE["xmin"] <= 0 <= CYCLE["xmax"]  # b means something only if x = 0 is inside the data
    if meaningful != truth:
        raise AssertionError(f"{text!r}: x = 0 inside data is {truth}")


# check-which-line: given y, estimate x. Each regression line predicts the variable it is "of"; never rearrange.
WHICH = {"given": "y", "wanted": "x"}
WHICH_OPTIONS = {
    "rearrange the y on x line for x": ("rearrange", "y on x"),
    "use the line of x on y": ("use", "x on y"),
    "substitute y into the y on x line in place of x": ("swap", "y on x"),
}


def check_which_line(text):
    action, line = option_claim(text, WHICH_OPTIONS)
    truth = f"{WHICH['wanted']} on {WHICH['given']}"
    if action != "use" or line != truth:
        raise AssertionError(f"{text!r}; predicting {WHICH['wanted']} from {WHICH['given']} needs the line of {truth}")


# check-extrapolation: data runs from x = 10 to 60; the reliable prediction is the one inside the range.
EXTRA_RANGE = (10, 60)
EXTRA_OPTIONS = [35, 75, 0]
assert sum(EXTRA_RANGE[0] <= v <= EXTRA_RANGE[1] for v in EXTRA_OPTIONS) == 1


def check_extrapolation(tex):
    value = parse_answer(tex)
    if value not in EXTRA_OPTIONS:
        raise ValueError(f"unknown option {tex!r}")
    if not EXTRA_RANGE[0] <= value <= EXTRA_RANGE[1]:
        raise AssertionError(f"x = {value} is outside {EXTRA_RANGE}: extrapolation")


# ------------------------------------------------------------------------------------------------ assertions

def predict(model, x):
    return model["a"] * x + model["b"]


def check_tree(tex):
    """The answer is the significance verdict; the steps also call r = 0.812 strong positive, so check that too."""
    check_significance(tex, "0.812", "0.666", 9)
    assert describe(S("0.812")) == "strong positive correlation", "the steps call r = 0.812 strong positive"


def check_fire(tex):
    """The answer is the description; the steps also call r = 0.88 significant for 15 pairs, so check that too."""
    check_description(tex, S("0.88"))
    assert significant("0.88", "0.514", 15), "the steps call r = 0.88 significant"


CHECKS = {
    "before-gradient": lambda v, tolerance: check_numeric(
        v, (parse_answer("y = 12 - 1.5x").diff(X)), sf=3, tolerance=tolerance),
    "before-substitute": lambda v, tolerance: check_numeric(v, S("0.4") * 30 + 15, sf=3, tolerance=tolerance),
    "before-mean": lambda v, tolerance: check_numeric(v, Rational(14 + 9 + 21 + 16, 4), sf=3, tolerance=tolerance),
    "ex-altitude-scatter": lambda tex: check_description(tex, ALTITUDE["r"]),
    "check-car-direction": check_car,
    "ex-print-line": check_print_line,
    "check-print-estimate": lambda v, tolerance: check_numeric(
        v, print_line()[0] * 16 + print_line()[1], sf=3, tolerance=tolerance),
    "ex-ball-r-zero": lambda tex: same(tex, BALL["r"]),
    "ex-tree-critical": check_tree,
    "check-r-meaning": check_r_meaning,
    "check-critical": check_critical,
    "ex-fire-stations": check_fire,
    "ex-app-scores": lambda tex: check_significance(tex, "0.41", "0.576", 12),
    "check-shoe-reading": check_shoe,
    "check-library-accidents": check_library,
    "ex-cycle-regression": lambda tex: check_rounded_line(tex, CYCLE["a"], CYCLE["b"]),
    "check-cycle-22": lambda v, tolerance: check_numeric(v, predict(CYCLE, 22), sf=3, tolerance=tolerance),
    "ex-taxi-interpret": lambda tex: same(tex, 6 * Rational(185, 100), unit="dollars"),
    "check-interpret-a": check_interpret_a,
    "check-interpret-b": check_interpret_b,
    "ex-cycle-reliability": lambda tex: check_rounded(tex, predict(CYCLE, 40), sf=3, unit="minutes"),
    "ex-child-height": lambda tex: same(tex, Rational(61, 10) * 8 + 77, unit="cm"),
    "check-which-line": check_which_line,
    "check-extrapolation": check_extrapolation,
}

NUMERIC = {
    "before-gradient": {"sf": 3},
    "before-substitute": {"sf": 3},
    "before-mean": {"sf": 3},
    "check-print-estimate": {"sf": 3},
    "check-cycle-22": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
