"""SymPy assertions for lesson 4.3 (central tendency and dispersion). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every statistic is computed here from the question's own data with exact SymPy rationals: frequency tables are
expanded into the full list of values, and the mean, median, mode, quartiles, variance and standard deviation are
computed from that list by their definitions. Quartiles use the GDC method the lesson teaches (medians of the lower and
upper halves, median left out when n is odd); the "keep the median" method is computed separately where the lesson
compares the two. The standard deviation is the n-divisor one (sigma_x on the GDC).

Questions that give only a mean and a standard deviation (shifting and scaling) are checked on a concrete two-value data
set with exactly that mean and standard deviation: the transformed data's statistics are then computed directly, so the
shift-and-scale rules themselves are never assumed.

Word answers (which class, which statement) are read into the claim they make and compared with the claim derived
from computed statistics; a wrong claim raises AssertionError and an unknown option raises ValueError.
"""
import re
import sys
from pathlib import Path

from sympy import Interval, Rational, S, Symbol, nsimplify, simplify, solve, sqrt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import (  # noqa: E402
    check_assignments, check_numeric, check_rounded, parse_answer, parse_assignments, parse_set, parse_with_unit,
)


def plain(text):
    """Option text with $, \\text{...} wrappers and extra spaces removed, lower case."""
    text = text.replace("$", "")
    text = re.sub(r"\\text\{([^}]*)\}", r"\1", text)
    return re.sub(r"\s+", " ", text).strip().lower()


def same(tex, truth):
    published = nsimplify(parse_answer(tex), rational=True)  # a written decimal such as 7.2 is that exact rational
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


# ------------------------------------------------------------------------------------------------ statistics

def expand(table):
    """{value: frequency} -> the full list of data values."""
    return [S(value) for value, frequency in table.items() for _ in range(frequency)]


def mean(values):
    return sum(values, S(0)) / len(values)


def median(values):
    ordered = sorted(values)
    n, middle = len(ordered), len(ordered) // 2
    return ordered[middle] if n % 2 else (ordered[middle - 1] + ordered[middle]) / 2


def modes(values):
    counts = {v: values.count(v) for v in set(values)}
    top = max(counts.values())
    return sorted(v for v, c in counts.items() if c == top)


def quartiles(values, keep_median=False):
    """(Q1, Q3) as the medians of the lower and upper halves. GDC method: the median is left out when n is odd."""
    ordered = sorted(values)
    half = len(ordered) // 2
    if len(ordered) % 2 and keep_median:
        lower, upper = ordered[: half + 1], ordered[half:]
    else:
        lower, upper = ordered[:half], ordered[len(ordered) - half:]
    return median(lower), median(upper)


def variance(values):
    """Population variance: the mean of the squared distances from the mean (n divisor, sigma_x squared)."""
    m = mean(values)
    return sum(((v - m) ** 2 for v in values), S(0)) / len(values)


def sd(values):
    return sqrt(variance(values))


def with_mean_sd(m, s):
    """A concrete data set with exactly this mean and (population) standard deviation."""
    data = [S(m) - S(s), S(m) + S(s)]
    assert mean(data) == S(m) and simplify(sd(data) - S(s)) == 0
    return data


def grouped_mean(classes):
    """Estimated mean from [(lower, upper, frequency)] using mid-interval values."""
    total = sum(f for _, _, f in classes)
    return sum(((S(a) + S(b)) / 2 * f for a, b, f in classes), S(0)) / total


def modal_class(classes):
    widths = {S(b) - S(a) for a, b, _ in classes}
    assert len(widths) == 1, "modal class needs equal class widths"
    top = max(f for _, _, f in classes)
    winners = [Interval.Ropen(S(a), S(b)) for a, b, f in classes if f == top]
    assert len(winners) == 1
    return winners[0]


# ------------------------------------------------------------------------------------------------ answer readers

def pieces(tex):
    """Top-level pieces of an answer joined by `, \\;`."""
    return [p.strip() for p in re.split(r",\s*\\;", tex.replace("$", "")) if p.strip()]


def check_named_values(tex, truth, sf=3):
    """`\\bar{x} = 3.125, \\; \\sigma \\approx 1.29`: an exact value after `=` must equal the truth; a value after
    `\\approx` must be the truth rounded to `sf` significant figures. Names must match the truth's keys."""
    seen = {}
    for piece in pieces(tex):
        if "\\approx" in piece:
            name = re.sub(r"\s+", "", piece.split("\\approx")[0])
            if name not in truth:
                raise AssertionError(f"unexpected name {name!r} in {tex!r}")
            check_rounded(piece, truth[name], sf=sf)
        else:
            found = parse_assignments(piece)
            if len(found) != 1:
                raise ValueError(f"cannot read one named value from {piece!r}")
            (name, value), = found.items()
            if name not in truth:
                raise AssertionError(f"unexpected name {name!r} in {tex!r}")
            if simplify(value - truth[name]) != 0:
                raise AssertionError(f"published {name} = {value} is not {truth[name]}")
        seen[name] = True
    if set(seen) != set(truth):
        raise AssertionError(f"published names {sorted(seen)} are not {sorted(truth)}")


# ------------------------------------------------------------------------------------------------ question data

PETS = {0: 5, 1: 8, 2: 4, 3: 3}
MASS_CLASSES = [(40, 50), (50, 60), (60, 70)]
QUIZ = [S(v) for v in (2, 5, 1, 4, 3, 4, 0, 4, 4)]
CARS = {1: 14, 2: 9, 3: 4, 4: 2, 5: 1}
TABLE_MEAN = {0: 4, 1: 7, 2: 6, 3: 3}
COMMUTE = [(0, 10, 6), (10, 20, 15), (20, 30, 11), (30, 40, 8)]
APPLES = [(80, 100, 5), (100, 120, 13), (120, 140, 21), (140, 160, 14), (160, 180, 7)]
SMALL_GROUPED = [(0, 4, 3), (4, 8, 5), (8, 12, 2)]
SEEDLINGS = [(10, 20, 7), (20, 30, 12), (30, 40, 15), (40, 50, 6)]
CHOIR = [S(v) for v in (34, 19, 52, 41, 27, 63, 45, 38, 29, 56, 47)]
GOALS = {0: 7, 1: 11, 2: 9, 3: 7, 4: 4, 5: 2}
EVEN_IQR = [S(v) for v in (4, 7, 9, 10, 12, 15, 17, 20)]
METHODS = [S(v) for v in (2, 4, 5, 7, 11)]
BY_HAND = [S(v) for v in (2, 4, 4, 5, 10)]
NESTS = {1: 4, 2: 9, 3: 13, 4: 8, 5: 4, 6: 2}
WHICH_SD = [S(v) for v in (3, 5, 7, 9)]
RUNNERS = {"ana": (Rational("58.2"), Rational("0.6")), "bea": (Rational("57.9"), Rational("1.4"))}


def before_class_holds(text):
    mass = S(60)
    truth = [Interval.Ropen(S(a), S(b)) for a, b in MASS_CLASSES if Interval.Ropen(S(a), S(b)).contains(mass)]
    assert len(truth) == 1
    if plain(text).startswith("neither"):
        raise AssertionError(f"{text!r}: {mass} lies in the class {truth[0]}")
    published = parse_set(text, var="m")
    if published != truth[0]:
        raise AssertionError(f"published class {published}, the class holding {mass} is {truth[0]}")


def quiz_averages(tex):
    assert len(modes(QUIZ)) == 1
    check_assignments(tex, {"\\bar{x}": mean(QUIZ), "\\text{median}": median(QUIZ), "\\text{mode}": modes(QUIZ)[0]})


def car_averages(tex):
    data = expand(CARS)
    assert len(data) == 30 and len(modes(data)) == 1
    check_assignments(tex, {"\\bar{x}": mean(data), "\\text{median}": median(data), "\\text{mode}": modes(data)[0]})


def missing_value(value, tolerance):
    y = Symbol("y")
    ninth = solve((8 * 6 + y) / 9 - 7, y)  # eight numbers with mean 6, plus y, have mean 7
    assert len(ninth) == 1
    check_numeric(value, ninth[0], sf=3, tolerance=tolerance)


def commute_grouped(tex):
    parts = pieces(tex)
    if len(parts) != 2:
        raise ValueError(f"cannot read a modal class and an estimated mean from {tex!r}")
    modal_text = re.sub(r"^\\text\{\s*modal class:\s*\}", "", parts[0]).strip()
    if modal_text == parts[0]:
        raise ValueError(f"no modal class in {tex!r}")
    published_class = parse_set(modal_text, var="t")
    if published_class != modal_class(COMMUTE):
        raise AssertionError(f"published modal class {published_class}, truth {modal_class(COMMUTE)}")
    if not re.match(r"^\\text\{\s*estimated mean\s*\}", parts[1]):
        raise ValueError(f"no estimated mean in {tex!r}")
    same(parse_with_unit(parts[1], "min"), grouped_mean(COMMUTE))


def modal_class_option(text):
    if "\\le" in text:
        published = parse_set(text, var="h")
        if published != modal_class(SEEDLINGS):
            raise AssertionError(f"published class {published}, truth {modal_class(SEEDLINGS)}")
        return
    value = parse_answer(text)  # a single number is a frequency or a mid-interval value, never a class
    raise AssertionError(f"{value} is a number, but the modal class is the interval {modal_class(SEEDLINGS)}")


def choir_quartiles(tex):
    q1, q3 = quartiles(CHOIR)
    check_assignments(tex, {"Q_{1}": q1, "Q_{3}": q3, "\\mathrm{IQR}": q3 - q1})


def goals_quartiles(tex):
    data = expand(GOALS)
    q1, q3 = quartiles(data)
    iqr = q3 - q1
    assert q1 - Rational(3, 2) * iqr <= min(data) and max(data) <= q3 + Rational(3, 2) * iqr  # part (b): no outliers
    check_assignments(tex, {"Q_{1}": q1, "Q_{3}": q3})


def even_iqr(value, tolerance):
    assert quartiles(EVEN_IQR) == quartiles(EVEN_IQR, keep_median=True)  # n even: the two methods agree
    q1, q3 = quartiles(EVEN_IQR)
    check_numeric(value, q3 - q1, sf=3, tolerance=tolerance)


# check-methods-differ: the student's 4 and the GDC's 3. Each option makes a claim about where they come from.
METHOD_OPTIONS = {
    "the gdc is wrong, so q_{1} = 4": "gdc wrong",
    "she made an arithmetic slip, so q_{1} = 3": "student slip",
    "they use different methods, and each value is right for its method": "different methods",
}
STUDENT_Q1, GDC_Q1 = S(4), S(3)


def methods_differ(text):
    key = plain(text)
    if key not in METHOD_OPTIONS:
        raise ValueError(f"unknown option {text!r}")
    keep, leave_out = quartiles(METHODS, keep_median=True)[0], quartiles(METHODS)[0]
    if keep == STUDENT_Q1 and leave_out == GDC_Q1:
        truth = "different methods"
    elif leave_out == GDC_Q1:
        truth = "student slip"
    else:
        truth = "gdc wrong"
    if METHOD_OPTIONS[key] != truth:
        raise AssertionError(f"{text!r} claims {METHOD_OPTIONS[key]}; the computed quartiles show {truth}")


def sd_by_hand(tex):
    check_named_values(tex, {"\\sigma^{2}": variance(BY_HAND), "\\sigma": sd(BY_HAND)})


def nests(tex):
    data = expand(NESTS)
    assert len(data) == 40
    check_named_values(tex, {"\\bar{x}": mean(data), "\\sigma": sd(data), "\\sigma^{2}": variance(data)})


RUNNER_OPTIONS = {  # option -> (who is faster on average, who is more consistent)
    "ana is faster on average and more consistent": ("ana", "ana"),
    "bea is faster on average and more consistent": ("bea", "bea"),
    "bea is faster on average, but ana is more consistent": ("bea", "ana"),
}


def runners(text):
    key = plain(text)
    if key not in RUNNER_OPTIONS:
        raise ValueError(f"unknown option {text!r}")
    true_faster = min(RUNNERS, key=lambda r: RUNNERS[r][0])  # lower mean time
    true_consistent = min(RUNNERS, key=lambda r: RUNNERS[r][1])  # smaller standard deviation
    if RUNNER_OPTIONS[key] != (true_faster, true_consistent):
        raise AssertionError(f"{text!r}: faster {true_faster}, more consistent {true_consistent}")


def fahrenheit(tex):
    celsius = with_mean_sd(Rational("18.5"), Rational("3.2"))
    f = [Rational("1.8") * c + 32 for c in celsius]
    check_named_values(tex, {"\\bar{F}": mean(f), "\\sigma_{F}": sd(f), "\\sigma_{F}^{2}": variance(f)})


def find_a_b(tex):
    a, b = Symbol("a", positive=True), Symbol("b")
    changed = [a * x + b for x in with_mean_sd(12, Rational("2.5"))]
    solutions = solve([mean(changed) - 50, variance(changed) - 10 ** 2], [a, b], dict=True)
    assert len(solutions) == 1, solutions
    check_assignments(tex, {"a": solutions[0][a], "b": solutions[0][b]})


def ages_later(value, tolerance):
    later = [age + 5 for age in with_mean_sd(40, Rational("7.3"))]  # any mean works; 40 is a stand-in
    check_numeric(value, sd(later), sf=3, tolerance=tolerance)


def triple_variance(text):
    tripled = [3 * x for x in with_mean_sd(0, 3)]  # variance 9
    same(text, variance(tripled))


CHECKS = {
    "before-cumulative-count": lambda v, tolerance: check_numeric(
        v, sum(f for x, f in PETS.items() if x < 2), sf=3, tolerance=tolerance),
    "before-class-holds": before_class_holds,
    "before-box-half": lambda v, tolerance: check_numeric(
        v, (Rational(3, 4) - Rational(1, 4)) * 100, sf=3, tolerance=tolerance),  # Q3 has 3/4 below it, Q1 has 1/4
    "ex-quiz-averages": quiz_averages,
    "ex-car-occupants": car_averages,
    "check-median-even": lambda v, tolerance: check_numeric(
        v, median([S(x) for x in (12, 7, 15, 9, 10, 18)]), sf=3, tolerance=tolerance),
    "check-table-mean": lambda text: same(text, mean(expand(TABLE_MEAN))),
    "check-missing-value": missing_value,
    "ex-commute-grouped": commute_grouped,
    "ex-apples-gdc": lambda tex: check_rounded(tex, grouped_mean(APPLES), sf=3, unit="g"),
    "check-grouped-mean": lambda v, tolerance: check_numeric(v, grouped_mean(SMALL_GROUPED), sf=3, tolerance=tolerance),
    "check-modal-class": modal_class_option,
    "ex-choir-quartiles": choir_quartiles,
    "ex-goals-gdc": goals_quartiles,
    "check-iqr-even": even_iqr,
    "check-methods-differ": methods_differ,
    "ex-sd-by-hand": sd_by_hand,
    "ex-nests-gdc": nests,
    "check-which-sd": lambda text: check_rounded(text, sd(WHICH_SD), sf=3),
    "check-consistent": runners,
    "ex-fahrenheit": fahrenheit,
    "ex-find-a-b": find_a_b,
    "check-ages-later": ages_later,
    "check-triple-variance": triple_variance,
}

NUMERIC = {
    "before-cumulative-count": {"sf": 3},
    "before-box-half": {"sf": 3},
    "check-median-even": {"sf": 3},
    "check-missing-value": {"sf": 3},
    "check-grouped-mean": {"sf": 3},
    "check-iqr-even": {"sf": 3},
    "check-ages-later": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
