"""SymPy assertions for lesson 4.2 (data presentation). Not shipped to the browser.

check-math.py passes verify(id, value) the lesson's own published text: an example's `answer`, a check's correct
option (must pass) and each distractor (must raise AssertionError). A numeric check gets verify(id, value, tolerance=...)
and must declare its required precision in NUMERIC.

Every truth is computed here from the question's own data with exact SymPy rationals:
- frequency tables by counting the raw lists into their classes (class membership tested from the inequalities);
- cumulative frequencies as running totals, and graph readings by exact linear interpolation along the straight
  segments the lesson's graph is drawn with (forward for a count, inverse for a percentile or quartile);
- quartiles of a frequency table by expanding it and taking the medians of the lower and upper halves (median left
  out when n is odd), the method the GDCs use;
- outliers from the 1.5 x IQR fences.

Word answers are derived from the data by a rule: a class from the inequality the value satisfies; a histogram's shape
from the sign and size of the moment skewness of the grouped data; "may be normal" from the symmetry of the box and
whiskers. Each option is read into the claim it makes; a wrong claim raises AssertionError, an unreadable option raises ValueError.
"""
import re
import sys
from pathlib import Path

from sympy import Rational, S, simplify, sqrt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mathparse import check_numeric, parse_answer  # noqa: E402


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


def published_numbers(tex, label):
    """`$\\text{label: } 4, 7, 6$` -> [4, 7, 6] as exact rationals."""
    match = re.fullmatch(re.escape(label) + r":\s*(.+)", plain(tex))
    if not match:
        raise ValueError(f"cannot read {label!r} from {tex!r}")
    pieces = [p.strip() for p in match.group(1).split(",")]
    if not all(re.fullmatch(r"-?\d+(\.\d+)?", p) for p in pieces):
        raise ValueError(f"cannot read numbers from {tex!r}")
    return [Rational(p) for p in pieces]


def check_numbers(tex, label, truth):
    published = published_numbers(tex, label)
    if published != [S(t) for t in truth]:
        raise AssertionError(f"published {label} {published}, truth {truth}")


# ------------------------------------------------------------------------------------------------ classes

def in_class(value, lower, upper, closed_lower=True):
    """`lower <= v < upper` (closed_lower) or `lower < v <= upper`."""
    return (lower <= value < upper) if closed_lower else (lower < value <= upper)


def tally(values, edges, closed_lower=True):
    counts = []
    for lower, upper in zip(edges, edges[1:]):
        counts.append(sum(1 for v in values if in_class(v, lower, upper, closed_lower)))
    assert sum(counts) == len(values), "a value fell outside every class"
    return counts


CAKES = [2, 1, 0, 3, 1, 2, 4, 1, 0, 2, 3, 1, 5, 2, 0, 1, 3, 2, 1, 4, 3, 0, 2, 1, 3]
RUN = [S(v) for v in ("27.3 31.4 22.6 25.0 35.0 28.8 30.0 24.9 26.1 33.8 37.2 21.8 29.5 32.2 26.7 23.4 34.6 27.9 "
                      "30.9 38.5 25.6 24.1 31.7 28.2").split()]
RUN_EDGES = [20, 25, 30, 35, 40]


def cake_table(tex):
    assert len(CAKES) == 25
    check_numbers(tex, "frequencies", [CAKES.count(v) for v in range(0, 6)])


def run_table(tex):
    assert len(RUN) == 24
    check_numbers(tex, "frequencies", tally(RUN, RUN_EDGES))


def run_histogram(tex):
    # Equal class widths, so each bar's height is the class frequency.
    widths = {b - a for a, b in zip(RUN_EDGES, RUN_EDGES[1:])}
    assert len(widths) == 1
    check_numbers(tex, "bar heights", tally(RUN, RUN_EDGES))


def parse_class(text):
    """`$30 \\le t < 35$` -> (30, 35, closed_lower=True); `either class` -> "both"."""
    key = plain(text)
    if key == "either class":
        return "both"
    match = re.fullmatch(r"(\d+)\s*\\le\s*t\s*<\s*(\d+)", key)
    if not match:
        raise ValueError(f"cannot read a class from {text!r}")
    return int(match.group(1)), int(match.group(2))


def check_boundary_class(text, value=35):
    classes = list(zip(RUN_EDGES, RUN_EDGES[1:]))
    truth = [c for c in classes if in_class(value, *c)]
    assert len(truth) == 1
    claim = parse_class(text)
    if claim == "both" or claim != truth[0]:
        raise AssertionError(f"{text!r}: {value} belongs only to {truth[0]}")


# ------------------------------------------------------------------------------------------------ histograms

WAIT_EDGES = [0, 10, 20, 30, 40, 50, 60]
WAIT_FREQS = [5, 12, 15, 9, 6, 3]
QUIZ_EDGES = [0, 10, 20, 30, 40, 50]
QUIZ_FREQS = [2, 4, 7, 12, 9]


def freq_where(edges, freqs, keep):
    return sum(f for (a, b), f in zip(zip(edges, edges[1:]), freqs) if keep(a, b))


def grouped_skewness(edges, freqs):
    """Moment coefficient of skewness from class midpoints (exact up to the final square root)."""
    mids = [Rational(a + b, 2) for a, b in zip(edges, edges[1:])]
    n = sum(freqs)
    mean = sum(m * f for m, f in zip(mids, freqs)) / n
    m2 = sum(f * (m - mean) ** 2 for m, f in zip(mids, freqs)) / n
    m3 = sum(f * (m - mean) ** 3 for m, f in zip(mids, freqs)) / n
    return m3 / sqrt(m2) ** 3


def shape(edges, freqs):
    """|skewness| below 0.2 reads as roughly symmetric; otherwise the sign gives the direction of the tail."""
    g = grouped_skewness(edges, freqs)
    if abs(g) < Rational(1, 5):
        return "symmetric"
    return "positive" if g > 0 else "negative"


SHAPE_OPTIONS = {
    "roughly symmetric": "symmetric",
    "positively skewed: the tail is to the right": "positive",
    "negatively skewed: the tail is to the left": "negative",
}


def check_shape(text, edges, freqs):
    key = plain(text)
    if key not in SHAPE_OPTIONS:
        raise ValueError(f"unknown option {text!r}")
    truth = shape(edges, freqs)
    if SHAPE_OPTIONS[key] != truth:
        raise AssertionError(f"{text!r}, but the data is {truth}")


# ------------------------------------------------------------------------------------------------ cumulative frequency

DELIVERY_EDGES = [10, 15, 20, 25, 30, 35]
DELIVERY_FREQS = [20, 40, 80, 40, 20]


def running_totals(freqs):
    totals, total = [], 0
    for f in freqs:
        total += f
        totals.append(total)
    return totals


def cf_points():
    return list(zip(DELIVERY_EDGES, [0] + running_totals(DELIVERY_FREQS)))


def cf_at(t):
    """Cumulative frequency read up from time t on the straight-segment graph."""
    t = S(t)
    for (t0, c0), (t1, c1) in zip(cf_points(), cf_points()[1:]):
        if t0 <= t <= t1:
            return c0 + (t - t0) / (t1 - t0) * (c1 - c0)
    raise ValueError(f"time {t} is off the graph")


def time_at(c):
    """Time read across from cumulative frequency c and down (inverse reading)."""
    c = S(c)
    for (t0, c0), (t1, c1) in zip(cf_points(), cf_points()[1:]):
        if c0 <= c <= c1 and c1 > c0:
            return t0 + (c - c0) / (c1 - c0) * (t1 - t0)
    raise ValueError(f"cumulative frequency {c} is off the graph")


N_ORDERS = sum(DELIVERY_FREQS)


def percentile(k):
    return time_at(Rational(k, 100) * N_ORDERS)


def deliveries_read(tex):
    """`\\text{median} = m, \\; \\mathrm{IQR} = a, \\; T = b, \\; N = c`: median at n/2, IQR from the
    quartile readings, T at the 90th percentile (the slowest 10% lie above it), N = orders above 28 minutes (the graph
    counts orders at or below a time)."""
    found = dict(re.findall(r"(\\text\{median\}|\\mathrm\{IQR\}|\bT|\bN)\s*=\s*(-?\d+(?:\.\d+)?)", tex))
    if set(found) != {"\\text{median}", "\\mathrm{IQR}", "T", "N"}:
        raise ValueError(f"cannot read the median, IQR, T and N from {tex!r}")
    truth = {"\\text{median}": percentile(50), "\\mathrm{IQR}": percentile(75) - percentile(25), "T": percentile(90),
             "N": N_ORDERS - cf_at(28)}
    published = {k: Rational(v) for k, v in found.items()}
    if published != truth:
        raise AssertionError(f"published {published}, truth {truth}")


# ------------------------------------------------------------------------------------------------ box plots

def median(values):
    ordered = sorted(values)
    n = len(ordered)
    middle = n // 2
    return ordered[middle] if n % 2 else (S(ordered[middle - 1]) + ordered[middle]) / 2


def quartiles(values):
    """(Q1, median, Q3), quartiles as medians of the lower and upper halves (median left out when n is odd)."""
    ordered = sorted(values)
    half = len(ordered) // 2
    lower = ordered[:half]
    upper = ordered[half + 1:] if len(ordered) % 2 else ordered[half:]
    return median(lower), median(ordered), median(upper)


def fences(q1, q3):
    iqr = q3 - q1
    return q1 - Rational(3, 2) * iqr, q3 + Rational(3, 2) * iqr


def outliers(candidates, q1, q3):
    low, high = fences(q1, q3)
    return sorted(S(v) for v in candidates if v < low or v > high)


def published_outliers(tex):
    match = re.search(r"outliers:\s*(.+)$", plain(tex))
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


ORDER_ITEMS = [1, 2, 3, 4, 5, 6, 7, 8, 12]
ORDER_FREQS = [4, 9, 11, 8, 6, 3, 2, 1, 1]


def orders(tex):
    data = [x for x, f in zip(ORDER_ITEMS, ORDER_FREQS) for _ in range(f)]
    assert len(data) == 45
    q1, med, q3 = quartiles(data)
    found = dict(re.findall(r"(q_\{1\}|median|q_\{3\})\s*=\s*(\d+(?:\.\d+)?)", plain(tex)))
    if set(found) != {"q_{1}", "median", "q_{3}"}:
        raise ValueError(f"cannot read Q1, median and Q3 from {tex!r}")
    published = (Rational(found["q_{1}"]), Rational(found["median"]), Rational(found["q_{3}"]))
    if published != (q1, med, q3):
        raise AssertionError(f"published {published}, truth {(q1, med, q3)}")
    check_outliers(tex, sorted(set(data)), q1, q3)


CLASS_A = [30, 48, 57, 66, 84]
CLASS_B = [35, 58, 65, 69, 78]


def compare_iqrs(tex):
    found = dict(re.findall(r"\\mathrm\{IQR\}_\{([AB])\}\s*=\s*(\d+(?:\.\d+)?)", tex))
    if set(found) != {"A", "B"}:
        raise ValueError(f"cannot read both IQRs from {tex!r}")
    truth = {"A": CLASS_A[3] - CLASS_A[1], "B": CLASS_B[3] - CLASS_B[1]}
    published = {k: Rational(v) for k, v in found.items()}
    if published != truth:
        raise AssertionError(f"published {published}, truth {truth}")


def whisker_end(q1, q3, top_values):
    """The upper whisker ends at the largest value that is not above the upper fence."""
    high = fences(q1, q3)[1]
    return max(v for v in top_values if v <= high)


def may_be_normal(summary):
    """Symmetric box and whiskers: the median's gaps to the quartiles, and the two whisker lengths, each agree to
    within a tenth of the range. That is the 'judge from symmetry' rule in numbers."""
    lo, q1, med, q3, hi = summary
    tol = Rational(hi - lo, 10)
    return abs((med - q1) - (q3 - med)) <= tol and abs((q1 - lo) - (hi - q3)) <= tol


def check_normal_shape(text):
    pieces = [p.strip() for p in plain(text).split(",")]
    if len(pieces) != 5 or not all(re.fullmatch(r"\d+", p) for p in pieces):
        raise ValueError(f"cannot read a five-number summary from {text!r}")
    summary = [int(p) for p in pieces]
    assert summary == sorted(summary)
    if not may_be_normal(summary):
        raise AssertionError(f"{summary} is not symmetric, so it is unlikely to be normal")


# ------------------------------------------------------------------------------------------------ before checks

def data_type(how):
    return {"counted": "discrete", "measured": "continuous"}[how]


BEFORE_OPTIONS = {
    "the time taken to run 100 m": "measured",
    "the number of goals in a match": "counted",
    "the mass of a parcel": "measured",
}


def check_discrete(text):
    key = plain(text)
    if key not in BEFORE_OPTIONS:
        raise ValueError(f"unknown option {text!r}")
    if data_type(BEFORE_OPTIONS[key]) != "discrete":
        raise AssertionError(f"{text!r} is continuous")


FENCE_OPTIONS = {
    "yes, because it lies on the fence": True,
    "no, because an outlier must be less than 18": False,
}


def check_fence_equal(text, value=18, lower_fence=18):
    key = plain(text)
    if key not in FENCE_OPTIONS:
        raise ValueError(f"unknown option {text!r}")
    truth = value < lower_fence
    if FENCE_OPTIONS[key] != truth:
        raise AssertionError(f"{text!r}: {value} < {lower_fence} is {truth}")


CHECKS = {
    "before-data-type": check_discrete,
    "before-upper-fence": lambda v, tolerance: check_numeric(v, fences(12, 20)[1], sf=3, tolerance=tolerance),
    "before-fence-equal": check_fence_equal,
    "ex-cakes-table": cake_table,
    "ex-fun-run-table": run_table,
    "check-boundary-class": check_boundary_class,
    "check-missing-frequency": lambda v, tolerance: check_numeric(v, 32 - (9 + 7 + 4), sf=3, tolerance=tolerance),
    "ex-fun-run-histogram": run_histogram,
    "ex-waits-histogram": lambda tex: same(tex, freq_where(WAIT_EDGES, WAIT_FREQS, lambda a, b: a >= 30)),
    "check-waits-below-20": lambda v, tolerance: check_numeric(
        v, freq_where(WAIT_EDGES, WAIT_FREQS, lambda a, b: b <= 20), sf=3, tolerance=tolerance),
    "check-quiz-shape": lambda text: check_shape(text, QUIZ_EDGES, QUIZ_FREQS),
    "ex-deliveries-cf": lambda tex: check_numbers(tex, "cumulative frequencies", running_totals(DELIVERY_FREQS)),
    "ex-deliveries-read": deliveries_read,
    "check-cf-30th-percentile": lambda v, tolerance: check_numeric(v, percentile(30), sf=3, tolerance=tolerance),
    "check-cf-more-than-25": lambda v, tolerance: check_numeric(v, N_ORDERS - cf_at(25), sf=3, tolerance=tolerance),
    "ex-orders-box-plot": orders,
    "ex-compare-classes": compare_iqrs,
    "check-whisker-end": lambda v, tolerance: check_numeric(v, whisker_end(40, 52, [66, 70, 71]), sf=3, tolerance=tolerance),
    "check-normal-shape": check_normal_shape,
}

NUMERIC = {
    "before-upper-fence": {"sf": 3},
    "check-missing-frequency": {"sf": 3},
    "check-waits-below-20": {"sf": 3},
    "check-cf-30th-percentile": {"sf": 3},
    "check-cf-more-than-25": {"sf": 3},
    "check-whisker-end": {"sf": 3},
}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
