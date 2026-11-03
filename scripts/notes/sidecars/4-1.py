"""SymPy assertions for lesson 4.1 (sampling, data quality and outliers). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Numbers (means, scaled estimates, quartiles, fences, stratum sizes, systematic intervals) are computed here from each
question's own data with exact SymPy rationals. Quartiles are computed independently as the medians of the lower and
upper halves of the ordered data (median left out when n is odd), the method the GDCs use.

Word answers (data type, sampling method, source of bias, outlier handling) cannot be "computed" symbolically, so each
question's set-up is encoded as facts (counted or measured; random or not; group counts fixed or not; who chose the
sample) and the true word is derived from those facts by a rule. Each option is read into the claim it makes; an option
whose claim disagrees with the derived truth raises AssertionError, and an option that cannot be read raises ValueError.
"""
import re
import sys
from pathlib import Path

from sympy import Rational, S, floor, simplify

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_assignments, check_numeric, check_rounded, parse_answer  # noqa: E402


def same(tex, truth):
    published = parse_answer(tex)
    if simplify(published - truth) != 0:
        raise AssertionError(f"published {published} is not {truth}")


def plain(text):
    """Option or answer text with $, \\text{...} wrappers, thin spaces and extra spaces removed, lower case."""
    text = text.replace("$", "")
    text = re.sub(r"\\text\{([^}]*)\}", r"\1", text)
    text = text.replace("\\,", "").replace("\\;", " ")
    return re.sub(r"\s+", " ", text).strip().lower()


# ------------------------------------------------------------------------------------------------ statistics helpers

def mean(values):
    return sum(values, S(0)) / len(values)


def median(values):
    ordered = sorted(values)
    n = len(ordered)
    middle = n // 2
    return ordered[middle] if n % 2 else (ordered[middle - 1] + ordered[middle]) / 2


def quartiles(values):
    """(Q1, Q3) as medians of the lower and upper halves; the median itself is left out when n is odd."""
    ordered = sorted(values)
    half = len(ordered) // 2
    lower = ordered[:half]
    upper = ordered[half + 1:] if len(ordered) % 2 else ordered[half:]
    return median(lower), median(upper)


def fences(q1, q3):
    iqr = q3 - q1
    return q1 - Rational(3, 2) * iqr, q3 + Rational(3, 2) * iqr


def outliers(candidates, q1, q3):
    low, high = fences(q1, q3)
    return sorted(v for v in candidates if v < low or v > high)


def published_outliers(tex):
    """`\\text{outliers: } 61` or `\\text{outliers: none}` -> sorted list of values."""
    text = plain(tex)
    match = re.fullmatch(r"outliers:\s*(.+)", text)
    if not match:
        raise ValueError(f"cannot read outliers from {tex!r}")
    body = match.group(1).strip()
    if body == "none":
        return []
    pieces = [p.strip() for p in re.split(r",|\band\b", body) if p.strip()]
    if not all(re.fullmatch(r"-?\d+(\.\d+)?", p) for p in pieces):
        raise ValueError(f"cannot read outliers from {tex!r}")
    return sorted(Rational(p) for p in pieces)


def check_outliers(tex, candidates, q1, q3):
    published = published_outliers(tex)
    truth = outliers(candidates, q1, q3)
    if published != truth:
        raise AssertionError(f"published outliers {published}, truth {truth}")


def stratified(groups, sample):
    """Proportional allocation by floor + largest remainders: round every share down, then give the places still
    missing, one each, to the strata with the largest fractional parts. A tie across the last place has no single
    answer, so it fails. Sizes are never negative and always add up to the sample."""
    population = sum(groups.values())
    shares = {name: Rational(size, population) * sample for name, size in groups.items()}
    sizes = {name: int(floor(share)) for name, share in shares.items()}
    leftover = sample - sum(sizes.values())
    assert 0 <= leftover < len(groups), leftover
    order = sorted(shares, key=lambda name: shares[name] - sizes[name], reverse=True)
    if 0 < leftover < len(order):
        last_in, first_out = order[leftover - 1], order[leftover]
        assert shares[last_in] - sizes[last_in] != shares[first_out] - sizes[first_out], "tie for the last place"
    for name in order[:leftover]:
        sizes[name] += 1
    assert sum(sizes.values()) == sample and all(v >= 0 for v in sizes.values()), sizes
    return sizes


# The reviewer's case for the old "take one from the smallest decimal part" repair, which gave -1. Floor + largest
# remainders never goes negative: strata 1, 16, 16, 17 of 50, sample 5 -> shares 0.1, 1.6, 1.6, 1.7 -> floors 0, 1, 1, 1,
# then the two spare places go to 1.7 and to one of the tied 1.6s (a genuine tie, so the helper refuses to pick).
assert stratified({"a": 1, "b": 16, "c": 17}, 5) == {"a": 0, "b": 2, "c": 3}
try:
    stratified({"a": 1, "b": 16, "c": 16, "d": 17}, 5)
    raise RuntimeError("a tie for the last place must be refused")
except AssertionError:
    pass


def check_strata(tex, groups, sample):
    pairs = re.findall(r"\\text\{\s*([a-z]+)\s*\}\s*(\d+)", tex)
    if len(pairs) != len(groups) or not re.fullmatch(r"\$.*\$", tex.strip()):
        raise ValueError(f"cannot read group sizes from {tex!r}")
    published = {name: int(value) for name, value in pairs}
    truth = stratified(groups, sample)
    if published != truth:
        raise AssertionError(f"published {published}, truth {truth}")


# ------------------------------------------------------------------------------------------------ word answers

def data_type(how):
    """Counted data is discrete; measured data is continuous."""
    return {"counted": "discrete", "measured": "continuous"}[how]


# ex-data-types: how each quantity is obtained.
CYCLING = {"a": "counted", "b": "measured", "c": "counted", "d": "measured"}  # races, ride time, gears, mass


def check_data_types(tex):
    found = re.findall(r"\(([a-d])\)\s*(discrete|continuous)", plain(tex))
    if len(found) != len(CYCLING):
        raise ValueError(f"cannot read four classifications from {tex!r}")
    published = dict(found)
    truth = {part: data_type(how) for part, how in CYCLING.items()}
    if published != truth:
        raise AssertionError(f"published {published}, truth {truth}")


# check-continuous: how each option's quantity is obtained.
PHONE_OPTIONS = {
    "the time a phone battery lasts on one charge": "measured",
    "the number of apps on a phone": "counted",
    "the number of messages sent in a day": "counted",
}


def check_continuous(text):
    key = plain(text)
    if key not in PHONE_OPTIONS:
        raise ValueError(f"unknown option {text!r}")
    if data_type(PHONE_OPTIONS[key]) != "continuous":
        raise AssertionError(f"{text!r} is {data_type(PHONE_OPTIONS[key])}")


# check-population: the question is about every adult in the town; 400 of them were asked.
TOWN_ADULTS, ASKED = 18000, 400


def check_population(text):
    key = plain(text)
    numbers = [int(n) for n in re.findall(r"\d+", key)]
    if numbers:
        if numbers != [TOWN_ADULTS] or "all" not in key:
            raise AssertionError(f"{text!r} names {numbers}, not all {TOWN_ADULTS} adults")
        return
    if "bus route" in key:
        raise AssertionError(f"{text!r} is only part of the town's adults")
    raise ValueError(f"unknown option {text!r}")


# check-self-selection: the callers decided for themselves to take part.
RADIO = {"chosen_by": "self"}
BIAS_FROM_CHOICE = {"self": "self-selection", "collector": "collector choice", "random": "none"}
RADIO_OPTIONS = {
    "the callers chose themselves, so people with strong views are over-represented": "self-selection",
    "the sample is too small to be useful": "sample size",
    "a percentage as high as 85% cannot be accurate": "percentage",
}


def check_self_selection(text):
    key = plain(text).replace("\\%", "%")
    if key not in RADIO_OPTIONS:
        raise ValueError(f"unknown option {text!r}")
    truth = BIAS_FROM_CHOICE[RADIO["chosen_by"]]
    if RADIO_OPTIONS[key] != truth:
        raise AssertionError(f"{text!r} blames {RADIO_OPTIONS[key]}, the problem is {truth}")


# check-source-reliability: who ran the survey and where its members came from.
DRINKS_SURVEY = {"collector_gains_from_result": True, "members_from_collector_customers": True, "size": 300}
MIN_USEFUL_SIZE = 30  # a sample this size or larger is not "too small to be useful" for a single proportion
DRINKS_OPTIONS = {
    "the company gains from the result, and its own shop's customers already like its drinks": "collector interest",
    "a sample of 300 shoppers is too small to be useful": "sample size",
    "the company should have asked every lemonade drinker instead": "census needed",
}


def source_problem(facts):
    """The main reason to doubt a source, derived from who collected the data and how members were chosen."""
    if facts["collector_gains_from_result"] and facts["members_from_collector_customers"]:
        return "collector interest"
    if facts["size"] < MIN_USEFUL_SIZE:
        return "sample size"
    return "none"


def check_source_reliability(text):
    key = plain(text)
    if key not in DRINKS_OPTIONS:
        raise ValueError(f"unknown option {text!r}")
    truth = source_problem(DRINKS_SURVEY)
    # A census is never what makes a survey trustworthy, so "census needed" is never the main problem.
    if DRINKS_OPTIONS[key] != truth:
        raise AssertionError(f"{text!r} blames {DRINKS_OPTIONS[key]}, the problem is {truth}")


# Sampling methods by two facts: is the choice random, and are the group counts fixed in proportion?
METHODS = {
    "simple random": {"random": True, "group_counts_fixed": False},
    "systematic": {"random": True, "group_counts_fixed": False, "every_kth": True},
    "stratified": {"random": True, "group_counts_fixed": True},
    "quota": {"random": False, "group_counts_fixed": True},
    "convenience": {"random": False, "group_counts_fixed": False},
}


def method_name(text):
    key = plain(text)
    match = re.fullmatch(r"(simple random|systematic|stratified|quota|convenience) sampling", key)
    if not match:
        raise ValueError(f"unknown option {text!r}")
    return match.group(1)


def methods_matching(facts):
    return [name for name, props in METHODS.items()
            if all(props.get(key, False) == value for key, value in facts.items())]


def check_method(text, facts):
    candidates = methods_matching(facts)
    assert len(candidates) == 1, f"facts {facts} do not pick out one method: {candidates}"
    chosen = method_name(text)
    if chosen != candidates[0]:
        raise AssertionError(f"{text!r}, but the facts describe {candidates[0]} sampling")


# check-name-quota: 30 men and 30 women fixed in advance; the researcher picks whom to ask; no list, no interval.
QUOTA_SCENE = {"random": False, "group_counts_fixed": True, "every_kth": False}
# check-best-method: the hospital needs a random sample with each staff group in the right proportion.
HOSPITAL_NEEDS = {"random": True, "group_counts_fixed": True, "every_kth": False}


# check-outlier-context: chess club ages. A recorded age is possible only up to the oldest verified human age, 122.
CHESS_Q1, CHESS_Q3, CHESS_AGES, OLDEST_POSSIBLE = 14, 19, [67, 145], 122
CHESS_OPTIONS = {
    "both are outliers; 67 is probably valid but 145 must be an error": ([67, 145], {67: "keep", 145: "error"}),
    "both are outliers, so both should be removed": ([67, 145], {67: "error", 145: "error"}),
    "only 145 is an outlier": ([145], None),
}


def check_outlier_context(text):
    key = plain(text)
    if key not in CHESS_OPTIONS:
        raise ValueError(f"unknown option {text!r}")
    claimed, handling = CHESS_OPTIONS[key]
    truth = outliers(CHESS_AGES, CHESS_Q1, CHESS_Q3)
    if claimed != truth:
        raise AssertionError(f"{text!r} claims outliers {claimed}, truth {truth}")
    true_handling = {age: ("keep" if age <= OLDEST_POSSIBLE else "error") for age in truth}
    if handling != true_handling:
        raise AssertionError(f"{text!r} handles them as {handling}, truth {true_handling}")


# ------------------------------------------------------------------------------------------------ question data

EGGS = [S("58.2"), S("61.0"), S("5.97"), S("59.4"), S("62.3"), S("60.1"), S("57.8")]
EGG_RECHECKED = S("59.7")
TEMPERATURES = [S("14.2"), S("15.0"), None, S("13.6"), S("14.8")]  # None: the failed reading logged as 0
PUZZLE = [42, 38, 51, 45, 47, 40, 112, 44, 49, 36, 46]
SCORES = [52, 55, 58, 60, 61, 63, 95]


def egg_mean():
    """The error is the one mass less than half the median of the others; replace it with the re-weighed mass."""
    suspects = [m for m in EGGS if m < median([o for o in EGGS if o != m]) / 2]
    assert suspects == [S("5.97")], suspects
    corrected = [EGG_RECHECKED if m in suspects else m for m in EGGS]
    return mean(corrected)


def puzzle_outliers(tex):
    q1, q3 = quartiles(PUZZLE)
    assert (q1, q3) == (40, 49), (q1, q3)  # the values the worked steps read off the GDC
    check_outliers(tex, PUZZLE, q1, q3)


def systematic_last(tex):
    population, sample, start = 1350, 45, 17
    k = Rational(population, sample)
    assert k.q == 1
    t = start + (sample - 1) * k
    assert t <= population < t + k  # exactly `sample` loaves fit
    check_assignments(tex, {"k": k, "t": t})


CHECKS = {
    "before-mean": lambda v, tolerance: check_numeric(v, mean([7, 9, 4, 12, 8]), sf=3, tolerance=tolerance),
    "before-median": lambda v, tolerance: check_numeric(v, median([3, 5, 7, 10, 11, 14]), sf=3, tolerance=tolerance),
    "before-fraction-of": lambda v, tolerance: check_numeric(v, Rational(3, 8) * 240, sf=3, tolerance=tolerance),
    "ex-data-types": check_data_types,
    "ex-sample-estimate": lambda tex: same(tex, Rational(9, 60) * 1500),
    "check-continuous": check_continuous,
    "check-population": check_population,
    "ex-recording-error": lambda tex: check_rounded(tex, egg_mean(), sf=3, unit="g"),
    "ex-gym-bias": lambda tex: same(tex, Rational(38, 50) * 2000),
    "check-self-selection": check_self_selection,
    "check-source-reliability": check_source_reliability,
    "check-missing-mean": lambda v, tolerance: check_numeric(
        v, mean([t for t in TEMPERATURES if t is not None]), sf=3, tolerance=tolerance),
    "ex-largest-not-outlier": lambda tex: same(tex, floor(fences(15, 27)[1])),
    "ex-gdc-puzzle": puzzle_outliers,
    "check-scores-fence": lambda v, tolerance: check_numeric(v, fences(*quartiles(SCORES))[1], sf=3, tolerance=tolerance),
    "check-outlier-context": check_outlier_context,
    "ex-stratified-rounding": lambda tex: check_strata(tex, {"day": 212, "evening": 158, "night": 94}, 50),
    "ex-systematic": systematic_last,
    "check-name-quota": lambda text: check_method(text, QUOTA_SCENE),
    "check-stratified-year1": lambda v, tolerance: check_numeric(v, Rational(432, 1080) * 75, sf=3, tolerance=tolerance),
    "check-best-method": lambda text: check_method(text, HOSPITAL_NEEDS),
}

NUMERIC = {
    "before-mean": {"sf": 3},
    "before-median": {"sf": 3},
    "before-fraction-of": {"sf": 3},
    "check-missing-mean": {"sf": 3},
    "check-scores-fence": {"sf": 3},
    "check-stratified-year1": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
