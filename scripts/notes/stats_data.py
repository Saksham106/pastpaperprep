"""GDC-style statistics, distribution and finance helpers, for computing truths in IB Maths AI lessons.

An AI answer usually comes off a graphic display calculator: a normal or binomial probability, a regression
coefficient, a chi-squared p-value, a TVM payment. These functions compute the same values from the question's own
data, so a truth stays computed ("normcdf(-oo, 50, 48, 7)") instead of a typed-in decimal. They are added to the
verify truth namespace in every course (callable helpers only, like the chemistry ones); their names don't clash with
SymPy's. Exact where the maths is exact (binomial, Poisson, means, quartiles); otherwise a SymPy Float to 30 digits.

Lists are Python lists in the truth: avg([3, 5, 9]) or avg([1, 2, 3], [4, 6, 2]) with frequencies.

  Data:           avg(x, f=None)   sdpop(x, f=None) (σx)   sdsample(x, f=None) (sx)   med(x, f=None)
                  quartile1(x, f=None)   quartile3(x, f=None)   (TI / IB method: medians of the halves, the median
                  itself left out when n is odd)
  Bivariate:      pearson(x, y)   spearman(x, y) (ties get their average rank, then Pearson on the ranks)
                  regslope(x, y)   regintercept(x, y)   (y = ax + b on x, least squares: a, b)
                  expreg(x, y) -> (a, b) for y = a*b**x   powreg(x, y) -> (a, b) for y = a*x**b   (as the GDC: least
                  squares on ln y)   polyreg(x, y, degree) -> coefficients, highest power first
  Distributions:  normcdf(lower, upper, mu, sigma)   invnorm(area, mu, sigma) (area to the left)
                  binompdf(n, p, k)   binomcdf(n, p, k) (P(X <= k))   poissonpdf(m, k)   poissoncdf(m, k)
                  tcdf(lower, upper, df)   invt(area, df)   chi2cdf(lower, upper, df)
  Tests:          chi2expected(table) -> Matrix   chi2indep(table) (statistic)   chi2df(table)
                  chi2gof(observed, expected) (statistic)
                  ttest2(x, y, pooled=True) (t statistic, x minus y; pooled by default as IB SL expects,
                  the opposite of the TI's default; pooled=False is Welch's test)   ttest2df(x, y, pooled=True)
                  ttest1(x, mu0) (t statistic)
  Finance (TVM, payments at the end of each period; TI sign convention: money paid out is negative):
                  tvm_fv(n, rate, pv, pmt, py=1, cy=None)   tvm_pv(n, rate, pmt, fv, py=1, cy=None)
                  tvm_pmt(n, rate, pv, fv, py=1, cy=None)   tvm_n(rate, pv, pmt, fv, py=1, cy=None)
                  tvm_rate(n, pv, pmt, fv, py=1, cy=None)  (rate is the nominal annual % I%, as on the GDC)
"""
import mpmath
import sympy
from sympy import (Float, Integer, Matrix, Rational, binomial, erf, exp, factorial, log, oo, sqrt, sympify,
                   uppergamma, gamma)

DIGITS = 30


def _n(value):
    return sympify(value)


def _list(values, name="data"):
    out = [_n(v) for v in values]
    if not out:
        raise ValueError(f"{name} is empty")
    return out


def _expand(x, f=None):
    """The data with frequencies applied: avg([1, 2], [3, 1]) reads 1, 1, 1, 2."""
    x = _list(x)
    if f is None:
        return x
    f = _list(f, "frequencies")
    if len(f) != len(x):
        raise ValueError("values and frequencies differ in length")
    out = []
    for value, count in zip(x, f):
        if not (count.is_integer and count >= 0):
            raise ValueError("frequencies must be whole numbers")
        out += [value] * int(count)
    if not out:
        raise ValueError("every frequency is 0")
    return out


WORK = DIGITS + 10  # mpmath work precision, always set locally with mpmath.workdps(WORK)


def _mp(value):
    """A SymPy number or expression as an mpmath number (call inside mpmath.workdps(WORK))."""
    return mpmath.mpf(str(sympy.N(value, WORK)))


def _float(value):
    with mpmath.workdps(WORK):
        return Float(str(mpmath.mpf(value)), DIGITS)


# ----------------------------------------------------------------------------------------------- one-variable data
def avg(x, f=None):
    data = _expand(x, f)
    return sum(data, Integer(0)) / len(data)


def sdpop(x, f=None):
    data = _expand(x, f)
    m = avg(data)
    return sqrt(sum(((v - m) ** 2 for v in data), Integer(0)) / len(data))


def sdsample(x, f=None):
    data = _expand(x, f)
    if len(data) < 2:
        raise ValueError("sample standard deviation needs 2 or more values")
    m = avg(data)
    return sqrt(sum(((v - m) ** 2 for v in data), Integer(0)) / (len(data) - 1))


def _median_sorted(data):
    n = len(data)
    return data[n // 2] if n % 2 else (data[n // 2 - 1] + data[n // 2]) / 2


def med(x, f=None):
    return _median_sorted(sorted(_expand(x, f)))


def _halves(x, f=None):
    data = sorted(_expand(x, f))
    if len(data) < 2:
        raise ValueError("quartiles need 2 or more values")
    half = len(data) // 2
    return data[:half], data[half + (len(data) % 2):]


def quartile1(x, f=None):
    return _median_sorted(_halves(x, f)[0])


def quartile3(x, f=None):
    return _median_sorted(_halves(x, f)[1])


# ----------------------------------------------------------------------------------------------- bivariate data
def _pairs(x, y):
    x, y = _list(x, "x"), _list(y, "y")
    if len(x) != len(y) or len(x) < 2:
        raise ValueError("x and y need the same length, 2 or more")
    return x, y


def _s(a, b):
    ma, mb = avg(a), avg(b)
    return sum(((p - ma) * (q - mb) for p, q in zip(a, b)), Integer(0))


def pearson(x, y):
    x, y = _pairs(x, y)
    sxx, syy = _s(x, x), _s(y, y)
    if sxx == 0 or syy == 0:
        raise ValueError("r is undefined when one variable is constant")
    return _s(x, y) / sqrt(sxx * syy)


def _ranks(values):
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [Integer(0)] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        shared = Rational(i + j + 2, 2)  # ranks i+1 .. j+1, averaged
        for k in range(i, j + 1):
            ranks[order[k]] = shared
        i = j + 1
    return ranks


def spearman(x, y):
    x, y = _pairs(x, y)
    return pearson(_ranks(x), _ranks(y))


def regslope(x, y):
    x, y = _pairs(x, y)
    sxx = _s(x, x)
    if sxx == 0:
        raise ValueError("regression needs at least two different x values")
    return _s(x, y) / sxx


def regintercept(x, y):
    x, y = _pairs(x, y)
    return avg(y) - regslope(x, y) * avg(x)


def expreg(x, y):
    """(a, b) for y = a*b**x: least squares of ln y on x, as the GDC's ExpReg."""
    x, y = _pairs(x, y)
    if any(v <= 0 for v in y):
        raise ValueError("exponential regression needs positive y")
    ly = [log(v) for v in y]
    return (exp(regintercept(x, ly)), exp(regslope(x, ly)))


def powreg(x, y):
    """(a, b) for y = a*x**b: least squares of ln y on ln x, as the GDC's PwrReg."""
    x, y = _pairs(x, y)
    if any(v <= 0 for v in x + y):
        raise ValueError("power regression needs positive x and y")
    lx, ly = [log(v) for v in x], [log(v) for v in y]
    return (exp(regintercept(lx, ly)), regslope(lx, ly))


def polyreg(x, y, degree):
    """Least-squares polynomial coefficients, highest power first (QuadReg: degree 2, CubicReg: degree 3)."""
    x, y = _pairs(x, y)
    degree = _n(degree)
    if not degree.is_integer:
        raise ValueError("the degree must be a whole number")
    degree = int(degree)
    if degree < 1 or len(x) <= degree:
        raise ValueError("polynomial regression needs more points than its degree")
    A = Matrix([[v ** (degree - j) for j in range(degree + 1)] for v in x])
    coeffs = (A.T * A).LUsolve(A.T * Matrix(y))
    return tuple(coeffs)


# ----------------------------------------------------------------------------------------------- distributions
def _phi(z):
    return (1 + erf(z / sqrt(2))) / 2


def normcdf(lower, upper, mu, sigma):
    lower, upper, mu, sigma = map(_n, (lower, upper, mu, sigma))
    if not sigma > 0:
        raise ValueError("sigma must be positive")
    if lower > upper:
        raise ValueError("lower bound above upper bound")
    hi = Integer(1) if upper == oo else _phi((upper - mu) / sigma)
    lo = Integer(0) if lower == -oo else _phi((lower - mu) / sigma)
    return hi - lo


def invnorm(area, mu, sigma):
    """The x with P(X < x) = area."""
    area, mu, sigma = map(_n, (area, mu, sigma))
    if not (0 < area < 1) or not sigma > 0:
        raise ValueError("invnorm needs 0 < area < 1 and sigma > 0")
    with mpmath.workdps(WORK):
        z = mpmath.sqrt(2) * mpmath.erfinv(2 * _mp(area) - 1)
        return _float(_mp(mu) + _mp(sigma) * z)


def _prob(p):
    p = _n(p)
    if not (0 <= p <= 1):
        raise ValueError("p must be between 0 and 1")
    return p


def _whole(k, name="k"):
    k = _n(k)
    if not (k.is_integer and k >= 0):
        raise ValueError(f"{name} must be a whole number")
    return int(k)


def binompdf(n, p, k):
    n, p, k = _whole(n, "n"), _prob(p), _whole(k)
    return binomial(n, k) * p ** k * (1 - p) ** (n - k) if k <= n else Integer(0)


def binomcdf(n, p, k):
    """P(X <= k)."""
    n, k = _whole(n, "n"), _whole(k)
    return sum((binompdf(n, p, i) for i in range(min(k, n) + 1)), Integer(0))


def poissonpdf(m, k):
    m, k = _n(m), _whole(k)
    if not m > 0:
        raise ValueError("the mean must be positive")
    return exp(-m) * m ** k / factorial(k)


def poissoncdf(m, k):
    """P(X <= k)."""
    return sum((poissonpdf(m, i) for i in range(_whole(k) + 1)), Integer(0))


def _df(df):
    df = _n(df)
    if not df > 0:
        raise ValueError("degrees of freedom must be positive")
    return df


def _tcdf_upper(t, df):
    """P(T <= t), as an mpmath number at WORK digits."""
    with mpmath.workdps(WORK):
        t, df = _mp(t), _mp(df)
        tail = mpmath.betainc(df / 2, mpmath.mpf(1) / 2, 0, df / (df + t * t), regularized=True) / 2
        return 1 - tail if t >= 0 else tail


def tcdf(lower, upper, df):
    lower, upper, df = _n(lower), _n(upper), _df(df)
    if lower > upper:
        raise ValueError("lower bound above upper bound")
    with mpmath.workdps(WORK):
        hi = mpmath.mpf(1) if upper == oo else _tcdf_upper(upper, df)
        lo = mpmath.mpf(0) if lower == -oo else _tcdf_upper(lower, df)
        return _float(hi - lo)


def invt(area, df):
    """The t with P(T < t) = area."""
    area, df = _n(area), _df(df)
    if not (0 < area < 1):
        raise ValueError("invt needs 0 < area < 1")
    with mpmath.workdps(WORK):
        target = _mp(area)
        lo, hi = mpmath.mpf(-1), mpmath.mpf(1)
        while _tcdf_upper(lo, df) > target:  # widen until the bracket holds the answer (df = 1 tails reach 10^4+)
            lo *= 2
        while _tcdf_upper(hi, df) < target:
            hi *= 2
        for _ in range(500):
            mid = (lo + hi) / 2
            if _tcdf_upper(mid, df) < target:
                lo = mid
            else:
                hi = mid
        return _float((lo + hi) / 2)


def chi2cdf(lower, upper, df):
    lower, upper, df = _n(lower), _n(upper), _df(df)
    if lower > upper or lower < 0:
        raise ValueError("chi-squared bounds must satisfy 0 <= lower <= upper")
    upper_tail = lambda x: Integer(0) if x == oo else uppergamma(df / 2, x / 2) / gamma(df / 2)
    return Float((upper_tail(lower) - upper_tail(upper)).evalf(WORK), DIGITS)


# ----------------------------------------------------------------------------------------------- tests
def _table(table):
    rows = [_list(row, "row") for row in table]
    if any(v < 0 for row in rows for v in row):
        raise ValueError("observed frequencies can't be negative")
    if len(rows) < 2 or len({len(r) for r in rows}) != 1 or len(rows[0]) < 2:
        raise ValueError("a contingency table needs 2+ rows of equal length 2+")
    return Matrix(rows)


def chi2expected(table):
    t = _table(table)
    total = sum(t)
    return Matrix(t.rows, t.cols, lambda i, j: sum(t.row(i)) * sum(t.col(j)) / total)


def chi2indep(table):
    t, e = _table(table), chi2expected(table)
    return sum(((t[i] - e[i]) ** 2 / e[i] for i in range(len(t))), Integer(0))


def chi2df(table):
    t = _table(table)
    return Integer((t.rows - 1) * (t.cols - 1))


def chi2gof(observed, expected):
    o, e = _list(observed, "observed"), _list(expected, "expected")
    if len(o) != len(e) or len(o) < 2:
        raise ValueError("observed and expected need the same length, 2 or more")
    if any(v <= 0 for v in e):
        raise ValueError("expected frequencies must be positive")
    if any(v < 0 for v in o):
        raise ValueError("observed frequencies can't be negative")
    if abs(sum(o) - sum(e)) > sum(o) / 100:  # rounded expected values (33.3 x 3) are fine; a wrong list is not
        raise ValueError("observed and expected totals differ by more than rounding")
    return sum(((a - b) ** 2 / b for a, b in zip(o, e)), Integer(0))


def _flag(value, name):
    """A True/False switch: True, False, SymPy's true/false or 0/1. A misspelt name (an unknown Symbol) is refused."""
    if value in (True, sympy.true, 1) and value is not None:
        return True
    if value in (False, sympy.false, 0):
        return False
    raise ValueError(f"{name} must be True or False, not {value!r}")


def ttest2(x, y, pooled=True):
    """The two-sample t statistic for mean(x) - mean(y)."""
    x, y = _list(x, "x"), _list(y, "y")
    if len(x) < 2 or len(y) < 2:
        raise ValueError("each sample needs 2 or more values")
    nx, ny, vx, vy = len(x), len(y), sdsample(x) ** 2, sdsample(y) ** 2
    if _flag(pooled, "pooled"):
        sp2 = ((nx - 1) * vx + (ny - 1) * vy) / (nx + ny - 2)
        se = sqrt(sp2 * (Rational(1, nx) + Rational(1, ny)))
    else:
        se = sqrt(vx / nx + vy / ny)
    return (avg(x) - avg(y)) / se


def ttest2df(x, y, pooled=True):
    x, y = _list(x, "x"), _list(y, "y")
    nx, ny = len(x), len(y)
    if _flag(pooled, "pooled"):
        return Integer(nx + ny - 2)
    a, b = sdsample(x) ** 2 / nx, sdsample(y) ** 2 / ny
    return (a + b) ** 2 / (a ** 2 / (nx - 1) + b ** 2 / (ny - 1))


def ttest1(x, mu0):
    x = _list(x)
    if len(x) < 2:
        raise ValueError("the sample needs 2 or more values")
    return (avg(x) - _n(mu0)) / (sdsample(x) / sqrt(len(x)))


# ----------------------------------------------------------------------------------------------- finance (TVM)
def _cy(py, cy):
    """C/Y defaults to P/Y, as on the GDC (entering P/Y sets C/Y to the same value)."""
    return _n(py) if cy is None else _n(cy)


def _i(rate, py, cy):
    rate, py, cy = _n(rate), _n(py), _cy(py, cy)
    if not (py > 0 and cy > 0):
        raise ValueError("payments and compounding periods per year must be positive")
    if rate <= -100 * cy:
        raise ValueError("I% must be above -100 x C/Y")
    return (1 + rate / 100 / cy) ** (cy / py) - 1


def tvm_fv(n, rate, pv, pmt, py=1, cy=None):
    n, pv, pmt, i = _n(n), _n(pv), _n(pmt), _i(rate, py, cy)
    if i == 0:
        return -(pv + pmt * n)
    g = (1 + i) ** n
    return -(pv * g + pmt * (g - 1) / i)


def tvm_pv(n, rate, pmt, fv, py=1, cy=None):
    n, pmt, fv, i = _n(n), _n(pmt), _n(fv), _i(rate, py, cy)
    if i == 0:
        return -(fv + pmt * n)
    g = (1 + i) ** n
    return -(fv + pmt * (g - 1) / i) / g


def tvm_pmt(n, rate, pv, fv, py=1, cy=None):
    n, pv, fv, i = _n(n), _n(pv), _n(fv), _i(rate, py, cy)
    if n <= 0:
        raise ValueError("n must be positive")
    if i == 0:
        return -(pv + fv) / n
    g = (1 + i) ** n
    return -(pv * g + fv) * i / (g - 1)


def tvm_n(rate, pv, pmt, fv, py=1, cy=None):
    pv, pmt, fv, i = _n(pv), _n(pmt), _n(fv), _i(rate, py, cy)
    if i == 0:
        if pmt == 0:
            raise ValueError("no payments and no interest: n is undefined")
        return -(pv + fv) / pmt
    num, den = pmt - fv * i, pmt + pv * i
    if den == 0 or (num / den) <= 0:
        raise ValueError("no number of periods reaches that future value")
    return log(num / den) / log(1 + i)


def tvm_rate(n, pv, pmt, fv, py=1, cy=None):
    """The nominal annual rate I% (per cent) that makes the cash flows balance; negative for a loss or depreciation."""
    n, pv, pmt, fv, py = map(_n, (n, pv, pmt, fv, py))
    cy = _cy(py, cy)
    if tvm_fv(n, 0, pv, pmt, py, cy) == fv:
        return Integer(0)
    with mpmath.workdps(WORK):
        f = lambda r: _mp(tvm_fv(n, Float(str(r), WORK), pv, pmt, py, cy)) - _mp(fv)
        floor = -100 * _mp(cy)
        grid = [floor * (1 - mpmath.mpf(10) ** -k) for k in range(12, 0, -1)] + [mpmath.mpf(x) for x in (-50, -20, -10, -5, -2, -1, "-0.1", "1e-9", "0.1", 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000)]
        grid = sorted(g for g in grid if g > floor)
        signs = [(g, f(g)) for g in grid]
        exact = [g for g, fg in signs if fg == 0]
        if len(exact) == 1 and not [1 for (_, fa), (_, fb) in zip(signs, signs[1:]) if fa * fb < 0]:
            return _float(exact[0])  # a grid point, such as the 1000% end, is the root itself
        brackets = [(a, b, fa) for (a, fa), (b, fb) in zip(signs, signs[1:]) if fa == 0 or fa * fb < 0]
        if not brackets:
            raise ValueError("no rate above -100% and up to 1000% balances these cash flows")
        if len(brackets) > 1:
            raise ValueError("more than one rate balances these cash flows; the GDC answer depends on its guess")
        lo, hi, flo = brackets[0]
        for _ in range(300):
            mid = (lo + hi) / 2
            fm = f(mid)
            if fm * flo > 0:
                lo, flo = mid, fm
            else:
                hi = mid
        return _float((lo + hi) / 2)


HELPERS = {name: globals()[name] for name in (
    "avg", "sdpop", "sdsample", "med", "quartile1", "quartile3",
    "pearson", "spearman", "regslope", "regintercept", "expreg", "powreg", "polyreg",
    "normcdf", "invnorm", "binompdf", "binomcdf", "poissonpdf", "poissoncdf", "tcdf", "invt", "chi2cdf",
    "chi2expected", "chi2indep", "chi2df", "chi2gof", "ttest2", "ttest2df", "ttest1",
    "tvm_fv", "tvm_pv", "tvm_pmt", "tvm_n", "tvm_rate",
)}
