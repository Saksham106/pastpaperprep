"""Unit tests for stats_data.py (GDC statistics, distributions, tests and TVM helpers) and their use in verify truths.
Reference values are what a TI-84 / standard tables give. Run by scripts/notes/mathparse.test.ts (or directly with
the SymPy venv). Each test_* raises on failure.
"""
import sys
import traceback
from pathlib import Path

import sympy
from sympy import Integer, Rational, oo

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import stats_data as sd  # noqa: E402
import verify_kinds as vk  # noqa: E402


def close(value, want, tol=1e-9):
    got = float(sympy.N(value, 30))
    assert abs(got - want) <= tol * max(1, abs(want)), f"got {got}, want {want}"


def fails(fn, *errors):
    errors = errors or (AssertionError, ValueError)
    try:
        fn()
    except errors:
        return
    raise AssertionError("expected a rejection, but it was accepted")


def test_one_variable():
    assert sd.avg([3, 5, 10]) == 6
    assert sd.avg([1, 2, 3], [4, 6, 2]) == Rational(11, 6)
    close(sd.sdpop([2, 4, 4, 4, 5, 5, 7, 9]), 2.0)
    close(sd.sdsample([2, 4, 4, 4, 5, 5, 7, 9]), 2.138089935299395)
    # TI / IB quartiles: medians of the halves, the median left out when n is odd
    odd = [1, 2, 3, 4, 5, 6, 7]
    assert (sd.quartile1(odd), sd.med(odd), sd.quartile3(odd)) == (2, 4, 6)
    even = [1, 2, 3, 4, 5, 6, 7, 8]
    assert (sd.quartile1(even), sd.med(even), sd.quartile3(even)) == (Rational(5, 2), Rational(9, 2), Rational(13, 2))
    assert sd.quartile1([7, 1, 3, 5, 2, 6, 4]) == 2  # unsorted input
    assert sd.med([10, 20], [3, 1]) == 10
    fails(lambda: sd.avg([]))
    fails(lambda: sd.avg([1, 2], [1]))
    fails(lambda: sd.avg([1, 2], [1, Rational(1, 2)]))
    fails(lambda: sd.sdsample([4]))


def test_bivariate():
    x, y = [1, 2, 3, 4, 5], [2, 4, 5, 4, 5]
    close(sd.pearson(x, y), 0.7745966692414834)
    assert sd.regslope(x, y) == Rational(3, 5) and sd.regintercept(x, y) == Rational(11, 5)
    assert sd.spearman([1, 2, 3, 4], [10, 20, 30, 40]) == 1
    assert sd.spearman([1, 2, 3, 4], [40, 30, 20, 10]) == -1
    # ties take the average rank: ranks of y are 1, 2.5, 2.5, 4
    close(sd.spearman([1, 2, 3, 4], [5, 7, 7, 9]), sd.pearson([1, 2, 3, 4], [1, 2.5, 2.5, 4]))
    a, b = sd.expreg([0, 1, 2, 3], [3, 6, 12, 24])
    close(a, 3) and close(b, 2)
    close(a, 3); close(b, 2)
    a, b = sd.powreg([1, 2, 4, 8], [5, 20, 80, 320])
    close(a, 5); close(b, 2)
    c2, c1, c0 = sd.polyreg([0, 1, 2, 3, 4], [1, 2, 5, 10, 17], 2)
    assert (c2, c1, c0) == (1, 0, 1)
    fails(lambda: sd.pearson([1, 1, 1], [2, 3, 4]))
    fails(lambda: sd.regslope([1, 2], [3]))
    fails(lambda: sd.expreg([1, 2], [3, -1]))
    fails(lambda: sd.polyreg([1, 2], [3, 4], 2))
    fails(lambda: sd.polyreg([0, 1, 2, 3], [1, 2, 5, 10], Rational(5, 2)))


def test_distributions():
    close(sd.normcdf(40, 55, 48, 7), 0.7147948, 1e-6)
    close(sd.normcdf(-oo, 0, 0, 1), 0.5)
    close(sd.normcdf(-oo, oo, 3, 2), 1)
    close(sd.invnorm(0.98, 507, 4), 515.2149966, 1e-8)
    close(sd.invnorm(0.5, 10, 3), 10)
    close(sd.binompdf(10, Rational(3, 10), 3), 0.266827932)
    close(sd.binomcdf(10, Rational(3, 10), 3), 0.6496107184)
    assert sd.binomcdf(5, Rational(1, 2), 5) == 1
    close(sd.poissonpdf(Rational(5, 2), 3), 0.2137630172, 1e-9)
    close(sd.poissoncdf(Rational(5, 2), 3), 0.7575761331, 1e-9)
    close(sd.tcdf(-oo, 2, 10), 0.9633062, 1e-6)
    close(2 * sd.tcdf(Rational("2.228138852"), oo, 10), 0.05, 1e-8)
    close(sd.invt(Rational(975, 1000), 10), 2.228138852, 1e-8)
    close(sd.invt(Rational(1, 40), 10), -2.228138852, 1e-8)
    close(sd.invt(Rational(9999, 10000), 1), float(sympy.tan(sympy.pi * Rational(4999, 10000))), 1e-8)
    close(sd.chi2cdf(Rational("3.841458821"), oo, 1), 0.05, 1e-8)
    close(sd.chi2cdf(0, Rational("11.07049769"), 5), 0.95, 1e-8)
    fails(lambda: sd.normcdf(2, 1, 0, 1))
    fails(lambda: sd.normcdf(0, 1, 0, 0))
    fails(lambda: sd.invnorm(1, 0, 1))
    fails(lambda: sd.binompdf(10, Rational(3, 2), 2))
    fails(lambda: sd.binomcdf(Rational(5, 2), Rational(1, 2), 1))
    fails(lambda: sd.chi2cdf(-1, 2, 1))


def test_tests():
    table = [[10, 20], [20, 10]]
    assert sd.chi2expected(table) == sympy.Matrix([[15, 15], [15, 15]])
    assert sd.chi2indep(table) == Rational(20, 3) and sd.chi2df(table) == 1
    close(sd.chi2cdf(sd.chi2indep(table), oo, sd.chi2df(table)), 0.009823274507, 1e-8)
    assert sd.chi2df([[1, 2, 3], [4, 5, 6], [7, 8, 9]]) == 4
    assert sd.chi2gof([30, 20, 50], [25, 25, 50]) == 2
    fails(lambda: sd.chi2gof([30, 20], [25, 30]))
    close(sd.chi2gof([30, 20, 50], [Rational("33.3")] * 3), float(sum((o - Rational("33.3")) ** 2 / Rational("33.3") for o in (30, 20, 50))))
    fails(lambda: sd.chi2gof([-5, 55], [25, 25]))
    fails(lambda: sd.chi2indep([[5, -2], [3, 4]]))
    # Welch path needs unequal sizes (equal sizes give the same t)
    x, y = [12, 15, 11, 14, 13, 19], [16, 18, 15, 17]
    close(sd.ttest2(x, y, pooled=False), -1.889822365, 1e-8)
    close(sd.ttest2df(x, y, pooled=False), 7.407615, 1e-6)
    close(sd.ttest2(x, y), -1.632993162, 1e-8)
    assert sd.ttest2df(x, y) == 8
    fails(lambda: sd.ttest2(x, y, pooled=sympy.Symbol("Flase")))
    fails(lambda: sd.chi2indep([[1, 2], [3]]))
    assert sd.ttest2([1, 2, 3, 4, 5], [2, 3, 4, 5, 6]) == -1
    assert sd.ttest2df([1, 2, 3, 4, 5], [2, 3, 4, 5, 6]) == 8
    close(sd.ttest2([1, 2, 3, 4, 5], [2, 4, 6, 8, 10], pooled=False), -1.897366596)
    close(sd.ttest2df([1, 2, 3, 4, 5], [2, 4, 6, 8, 10], pooled=False), 5.882352941)
    close(sd.ttest1([5, 7, 9], 5), 1.732050808)


BALANCE = 195876.18629331814  # 200000(1+i)^12 - M((1+i)^12 - 1)/i, i = 0.05/12, M the 25-year payment


def test_tvm():
    close(sd.tvm_fv(10, 5, -1000, 0), 1628.894627)
    close(sd.tvm_pmt(300, 5, 200000, 0, 12, 12), -1169.180083, 1e-8)
    close(sd.tvm_pv(10, 5, 0, 1628.894627), -1000, 1e-8)
    close(sd.tvm_n(5, -1000, 0, 2000), 14.20669908)
    close(sd.tvm_rate(10, -1000, 0, Rational("1628.894627")), 5, 1e-8)
    close(sd.tvm_rate(300, 200000, Rational("-1169.180083"), 0, 12, 12), 5, 1e-6)
    # balance after 12 monthly payments of the loan above = FV with n = 12
    close(sd.tvm_fv(12, 5, 200000, sd.tvm_pmt(300, 5, 200000, 0, 12, 12), 12, 12), -BALANCE, 1e-9)
    # monthly payments, interest compounded yearly: i = 1.05^(1/12) - 1
    close(sd.tvm_fv(12, 5, -1000, 0, 12, 1), 1050)
    assert sd.tvm_fv(4, 0, -100, -10) == 140
    # review fixes: C/Y defaults to P/Y; negative rates; I% <= -100 x C/Y refused
    close(sd.tvm_pmt(60, Rational(45, 10), 15000, 0, 12), -279.6452886, 1e-9)
    close(sd.tvm_fv(12, 5, -1000, 0, 12), 1051.161898, 1e-9)
    close(sd.tvm_rate(5, -20000, 0, 12000), (0.6 ** 0.2 - 1) * 100, 1e-9)
    assert sd.tvm_rate(4, -100, 0, 100) == 0
    fails(lambda: sd.tvm_fv(10, -150, -1000, 0))
    fails(lambda: sd.tvm_n(5, 1000, 0, 2000))
    fails(lambda: sd.tvm_rate(10, 1000, 0, 2000))


def test_names_and_truths():
    for name in sd.HELPERS:
        assert name not in sympy.__all__, f"{name} shadows a SymPy name"
        assert vk.NAMESPACE.get(name) is sd.HELPERS[name], f"{name} is not in the truth namespace"
    vk.check({"kind": "rounded", "truth": "normcdf(40, 55, 48, 7)", "sf": 3}, "\\approx 0.715")
    fails(lambda: vk.check({"kind": "rounded", "truth": "normcdf(40, 55, 48, 7)", "sf": 3}, "\\approx 0.714"), AssertionError)
    vk.check({"kind": "rounded", "truth": "1 - binomcdf(20, 0.35, 9)", "sf": 3}, "\\approx 0.122")
    vk.check({"kind": "rounded", "truth": "chi2cdf(chi2indep([[12, 18], [25, 15]]), oo, 1)", "sf": 3}, "\\approx 0.0620")
    vk.check({"kind": "money", "truth": "-tvm_pmt(60, 4.5, 15000, 0, 12, 12)", "dp": 2}, "279.65")
    fails(lambda: vk.check({"kind": "money", "truth": "-tvm_pmt(60, 4.5, 15000, 0, 12, 12)", "dp": 2}, "279.64"), AssertionError)
    vk.check({"kind": "rounded", "truth": "pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])", "sf": 3}, "\\approx 0.775")
    vk.check({"kind": "rounded", "truth": "2*tcdf(Abs(ttest2([12, 15, 11, 14], [16, 18, 15, 17])), oo, ttest2df([12, 15, 11, 14], [16, 18, 15, 17]))", "sf": 3}, "\\approx 0.0203")
    vk.check({"kind": "exact", "truth": "quartile3([3, 8, 1, 9, 4, 7])"}, "8")
    fails(lambda: vk.evaluate_truth("ttest2df([1, 2, 3, 4, 5], [2, 4, 6, 8, 10], pooled=Flase)"))
    assert vk.evaluate_truth("ttest2df([12, 15, 11, 14, 13, 19], [16, 18, 15, 17], pooled=False)") != 8
    # precision does not depend on which helper ran first
    first = sympy.N(sd.chi2cdf(Rational(20, 3), oo, 1), 30)
    sd.invnorm(Rational(1, 2), 0, 1)
    assert sympy.N(sd.chi2cdf(Rational(20, 3), oo, 1), 30) == first
    assert abs(first - sympy.N(sympy.erfc(sympy.sqrt(Rational(10, 3))), 30)) < 1e-25


if __name__ == "__main__":
    failed = 0
    tests = [(name, fn) for name, fn in sorted(globals().items()) if name.startswith("test_") and callable(fn)]
    for name, fn in tests:
        try:
            fn()
            print(f"PASS {name}")
        except Exception:
            failed += 1
            print(f"FAIL {name}")
            traceback.print_exc()
    print(f"{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
