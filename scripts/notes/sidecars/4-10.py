"""SymPy assertions for lesson 4.10 (regression line of x on y and prediction). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Statistics from data (means, least-squares lines in both directions, r) are computed here with exact rationals:
y on x has gradient Sxy / Sxx, x on y has gradient Sxy / Syy, and each passes through the mean point.

Where a question states two regression lines instead of data, the pair is first checked to be a possible pair: both
gradients have the same sign and their product (which equals r^2) lies strictly between 0 and 1. The truths are then
computed from the stated lines: predictions by substituting into the line that predicts the wanted variable, means by
solving the two lines simultaneously.

Word answers (which list, which distances, which use is reliable) are encoded as facts of the set-up, and the true
answer is derived from those facts by a rule. Each option is read into the claim it makes; a claim that disagrees with
the derived truth raises AssertionError, and text that cannot be read raises ValueError.
"""
import re
import sys
from decimal import Decimal
from pathlib import Path

from sympy import Rational, S, nsimplify, simplify, solve, sqrt, symbols

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_assignments, check_numeric, check_rounded, parse_answer, round_half_up,
)

X, Y = symbols("x y")


def exact_value(tex):
    """The published value as the exact rational it states (11.1 -> 111/10)."""
    return nsimplify(str(parse_answer(tex)), rational=True)


def same(tex, truth):
    published = exact_value(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def plain(text):
    text = text.replace("$", "")
    text = re.sub(r"\\text\{([^}]*)\}", r"\1", text)
    return re.sub(r"\s+", " ", text).strip().lower()


def option_claim(text, options):
    key = plain(text)
    if key not in options:
        raise ValueError(f"unknown option {text!r}")
    return options[key]


# ------------------------------------------------------------------------------------------------ statistics

def summary(xs, ys):
    xs, ys = [S(str(v)) for v in xs], [S(str(v)) for v in ys]
    n = len(xs)
    xbar, ybar = sum(xs) / n, sum(ys) / n
    sxx = sum((x - xbar) ** 2 for x in xs)
    syy = sum((y - ybar) ** 2 for y in ys)
    sxy = sum((x - xbar) * (y - ybar) for x, y in zip(xs, ys))
    a, c = sxy / sxx, sxy / syy
    return {"xbar": xbar, "ybar": ybar, "r": sxy / sqrt(sxx * syy),
            "a": a, "b": ybar - a * xbar,  # y on x: y = a x + b
            "c": c, "d": xbar - c * ybar,  # x on y: x = c y + d
            "xmin": min(xs), "xmax": max(xs), "ymin": min(ys), "ymax": max(ys)}


def y_on_x(model, x):
    return model["a"] * x + model["b"]


def x_on_y(model, y):
    return model["c"] * y + model["d"]


def stated_pair(a, b, c, d):
    """Stated lines y = a x + b and x = c y + d: check they could be the two regression lines of one data set."""
    a, b, c, d = (Rational(str(v)) for v in (a, b, c, d))
    assert a * c > 0 and a * c < 1, f"gradients {a} and {c} cannot be a y-on-x / x-on-y pair (a c = r^2)"
    sol = solve([Y - (a * X + b), X - (c * Y + d)], [X, Y], dict=True)[0]
    return {"a": a, "b": b, "c": c, "d": d, "xbar": sol[X], "ybar": sol[Y]}


def rounded_option(text, truth, sf=3):
    """A bare decimal option: it must equal the truth rounded half-up to `sf` figures."""
    if not re.fullmatch(r"\$?-?\d+(\.\d+)?\$?", text.strip()):
        raise ValueError(f"cannot read a number from {text!r}")
    published = Decimal(text.strip().strip("$"))
    expected = round_half_up(truth, sf)
    if published != expected or len(published.as_tuple().digits) != len(expected.as_tuple().digits):
        raise AssertionError(f"published {published} is not {expected}")


# ------------------------------------------------------------------------------------------------ question data

TREES = summary([12, 18, 25, 31, 40, 46, 55, 63], [62, 95, 78, 124, 105, 150, 122, 168])
# The steps quote the stored constants and the rounded lines; pin them to the data.
check_rounded(r"c \approx 0.440", TREES["c"])
check_rounded(r"d \approx -13.4", TREES["d"])
check_rounded(r"a \approx 1.72", TREES["a"])
check_rounded(r"b \approx 50.7", TREES["b"])
check_rounded(r"r \approx 0.869", TREES["r"])
assert (TREES["xmin"], TREES["xmax"], TREES["ymin"], TREES["ymax"]) == (12, 63, 62, 168)

HEATING = stated_pair("-0.8", 30, "-0.9", "31.2")
LAWN = stated_pair("0.6", 26, "1.25", "-22.5")
MEANS = stated_pair("0.5", 13, "1.2", -10)
MEAN_X = stated_pair("0.4", 9, 2, -14)

# ex-find-intercept: the five y-values with their x-values; the stated gradient 0.75 and x-bar = 16 are the real ones.
INTERCEPT = summary([5, 14, 16, 19, 26], [15, 17, 21, 33, 34])
assert INTERCEPT["c"] == Rational(3, 4) and INTERCEPT["xbar"] == 16


def intercept_from_mean(c, xbar, ybar):
    """d from x = c y + d passing through (xbar, ybar)."""
    return solve(Rational(xbar) - (Rational(str(c)) * Rational(ybar) + symbols("d")), symbols("d"))[0]


def check_find_intercept(tex):
    d = intercept_from_mean("0.75", INTERCEPT["xbar"], INTERCEPT["ybar"])
    assert simplify(d - INTERCEPT["d"]) == 0, "d from the mean point must match the least-squares intercept"
    assert INTERCEPT["ymin"] <= 30 <= INTERCEPT["ymax"]  # the steps call y = 30 interpolation
    same(tex, Rational(3, 4) * 30 + d)


# ------------------------------------------------------------------------------------------------ word options

# before-vertical: the line of y on x predicts y, which is measured vertically.
PREDICTED_BY_Y_ON_X = "y"
DIRECTION_OF = {"y": "vertical", "x": "horizontal"}
VERTICAL_OPTIONS = {
    "vertical distances from the points to the line": "vertical",
    "horizontal distances from the points to the line": "horizontal",
    "perpendicular distances from the points to the line": "perpendicular",
}


def check_vertical(text):
    claim = option_claim(text, VERTICAL_OPTIONS)
    truth = DIRECTION_OF[PREDICTED_BY_Y_ON_X]
    if claim != truth:
        raise AssertionError(f"{text!r}; the line of y on x minimises {truth} distances")


# before-extrapolate: data x from 20 to 50, prediction at x = 65.
EXTRA = {"lo": 20, "hi": 50, "at": 65}
EXTRA_OPTIONS = {
    "interpolation, so it is reliable": ("interpolation", True),
    "extrapolation, so it may be unreliable": ("extrapolation", False),
    "reliable, because r is close to 1": (None, True),
}


def check_extrapolate(text):
    kind, reliable = option_claim(text, EXTRA_OPTIONS)
    inside = EXTRA["lo"] <= EXTRA["at"] <= EXTRA["hi"]
    truth = ("interpolation", True) if inside else ("extrapolation", False)
    if (kind, reliable) != truth:
        raise AssertionError(f"{text!r}; x = {EXTRA['at']} inside the data is {inside}")


# check-gdc-lists: the GDC predicts its Y list from its X list; the line of x on y predicts x.
GDC_LISTS = {"predicts": "x"}
LIST_OPTIONS = {
    "the y-values": ("x list", "y"),
    "the x-values": ("x list", "x"),
    "either: both orders give the same line": ("either", None),
}


def check_gdc_lists(text):
    kind, variable = option_claim(text, LIST_OPTIONS)
    if kind == "either":
        # Swapping the lists gives the other regression line; they coincide only if r = +-1.
        if abs(TREES["r"]) != 1:
            raise AssertionError("the two orders give different lines unless r = +-1")
        return
    truth = "y" if GDC_LISTS["predicts"] == "x" else "x"  # the X list holds the variable you are given
    if variable != truth:
        raise AssertionError(f"{text!r}; the X list must hold the {truth}-values")


# check-heating-which: predict y at x = 10 from the household lines.
def check_heating_which(text):
    truth = HEATING["a"] * 10 + HEATING["b"]  # y on x predicts y
    rounded_option(text, truth)


# check-tree-reliable: which use suits the line of x on y (predicts x, needs the given y inside the data)?
RELIABLE_OPTIONS = {
    "the age of a tree with circumference 130 cm": ("x", 130),
    "the circumference of a 50-year-old tree": ("y", 50),
    "the age of a tree with circumference 250 cm": ("x", 250),
}


def check_tree_reliable(text):
    predicts, given = option_claim(text, RELIABLE_OPTIONS)
    if predicts != "x":
        raise AssertionError(f"{text!r} predicts y, which the line of x on y cannot do reliably")
    if not TREES["ymin"] <= given <= TREES["ymax"]:
        raise AssertionError(f"{text!r}: y = {given} is outside the data, so it is extrapolation")


# ------------------------------------------------------------------------------------------------ assertions

def check_heating_predict(tex):
    assert 9 <= 14 <= 27  # the steps call 14 kWh interpolation
    same(tex, x_on_y(HEATING, 14))


def check_lawn(tex):
    check_assignments(tex, {"y": y_on_x(LAWN, 30), "x": x_on_y(LAWN, 60)})
    # The step's warning: the rearranged x-on-y line gives a different (wrong) value at x = 30.
    rearranged = solve(30 - (LAWN["c"] * Y + LAWN["d"]), Y)[0]
    assert rearranged == 42 and rearranged != y_on_x(LAWN, 30)


def check_tree_circumference(tex):
    # Part (b)'s numbers in the steps: the rearranged x-on-y line at x = 20.
    rearranged = (20 - TREES["d"]) / TREES["c"]
    check_rounded(r"y \approx 9.03", y_on_x(TREES, 20) - rearranged)  # "about 9 cm below"
    part_a, part_b = answer_parts(tex, ["(a)", "(b)"])
    check_rounded(part_a, y_on_x(TREES, 20), sf=3, unit="cm")  # (a) the line of y on x
    check_rounded(part_b, rearranged, sf=3, unit="cm")  # (b) the student's rearranged line


def answer_parts(tex, labels):
    """Split a two-part answer at its top-level `, \\;` and drop each part's label (e.g. `\\text{(a) }`)."""
    parts = [part.strip() for part in tex.strip().strip("$").split(r", \;")]
    if len(parts) != len(labels):
        raise AssertionError(f"{tex!r} gives {len(parts)} part(s), {len(labels)} expected")
    stripped = []
    for part, label in zip(parts, labels):
        if label:
            prefix = r"\text{" + label + " }"
            if not part.startswith(prefix):
                raise ValueError(f"{part!r} does not start with the label {label}")
            part = part[len(prefix):].strip()
        stripped.append(part)
    return stripped


def check_rounded_x_on_y(tex, model):
    """A rounded line `x \\approx c y + d`: each constant must be the model's, rounded half-up to 3 s.f."""
    match = re.fullmatch(r"x\s*\\approx\s*(-?\d+(?:\.\d+)?)\s*y\s*([+-])\s*(\d+(?:\.\d+)?)", tex.strip())
    if not match:
        raise ValueError(f"cannot read a line x = c y + d from {tex!r}")
    c, sign, d = match.groups()
    check_rounded(rf"c \approx {c}", model["c"])
    check_rounded(rf"d \approx {'-' if sign == '-' else ''}{d}", model["d"])


def check_tree_age(tex):
    line, age = answer_parts(tex, [None, None])
    check_rounded_x_on_y(line, TREES)  # (a) the line of x on y
    check_rounded(age, x_on_y(TREES, 100), sf=3, unit="years")  # (b) the age at y = 100


CHECKS = {
    "before-mean-point": lambda v, tolerance: check_numeric(v, 3 * 6 - 4, sf=3, tolerance=tolerance),
    "before-vertical": check_vertical,
    "before-extrapolate": check_extrapolate,
    "ex-heating-predict": check_heating_predict,
    "check-heating-20": lambda v, tolerance: check_numeric(v, x_on_y(HEATING, 20), sf=3, tolerance=tolerance),
    "ex-tree-age": check_tree_age,
    "check-gdc-lists": check_gdc_lists,
    "check-tree-140": lambda v, tolerance: check_numeric(v, x_on_y(TREES, 140), sf=3, tolerance=tolerance),
    "ex-tree-circumference": check_tree_circumference,
    "ex-lawn-two-lines": check_lawn,
    "check-heating-which": check_heating_which,
    "check-tree-reliable": check_tree_reliable,
    "ex-means-from-lines": lambda tex: check_assignments(tex, {r"\bar{x}": MEANS["xbar"], r"\bar{y}": MEANS["ybar"]}),
    "ex-find-intercept": check_find_intercept,
    "check-mean-x": lambda v, tolerance: check_numeric(v, MEAN_X["xbar"], sf=3, tolerance=tolerance),
    "check-find-d": lambda v, tolerance: check_numeric(v, intercept_from_mean("1.5", 40, 22), sf=3, tolerance=tolerance),
}

NUMERIC = {
    "before-mean-point": {"sf": 3},
    "check-heating-20": {"sf": 3},
    "check-tree-140": {"sf": 3},
    "check-mean-x": {"sf": 3},
    "check-find-d": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
