"""Unit tests for scripts/notes/mathparse.py. Run by scripts/notes/mathparse.test.ts (or directly with the SymPy venv).

Each test_* function raises on failure. `fails(fn)` asserts that a published answer is REJECTED (AssertionError for a
wrong answer, ValueError for text the helper refuses to read).
"""
import sys
import traceback
from pathlib import Path

from sympy import E, I, Interval, Rational, Symbol, Union, acos, cos, oo, pi, simplify, sin, sqrt, symbols
from sympy.core.function import AppliedUndef

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mathparse as mp  # noqa: E402

x, y, z, n = symbols("x y z n")


def equal(a, b):
    assert simplify(a - b) == 0, f"{a} != {b}"


def fails(fn, *errors):
    errors = errors or (AssertionError, ValueError)
    try:
        fn()
    except errors:
        return
    raise AssertionError("expected the published answer to be rejected, but it was accepted")


# 2. Single-letter "function calls" are products.
def test_single_letter_calls_are_products():
    equal(mp.parse_answer(r"x(2x+1)"), x * (2 * x + 1))
    equal(mp.parse_answer(r"S_n = \frac{n(n+1)}{2}"), n * (n + 1) / 2)
    equal(mp.parse_answer(r"x\left(x-2\right)"), x * (x - 2))
    equal(mp.parse_answer(r"2x(3x+1)^{4}"), 2 * x * (3 * x + 1) ** 4)
    equal(mp.parse_answer(r"\lambda(x+1)"), Symbol("lambda") * (x + 1))


def test_real_functions_still_work():
    equal(mp.parse_answer(r"\sin(x) + \ln(x)"), sin(x) + mp.parse_answer(r"\ln x"))
    declared = mp.parse_answer(r"g(x) = 2f(x)", functions=("f",))
    assert declared.atoms(AppliedUndef), declared
    assert not mp.parse_answer(r"2f(x)").atoms(AppliedUndef)


# 3. Absolute values and ln|...|.
def test_absolute_value_bars():
    equal(mp.parse_answer(r"\lvert x - 1\rvert"), mp.parse_answer(r"|x-1|"))
    equal(mp.parse_answer(r"\left|x - 1\right|"), mp.parse_answer(r"|x-1|"))


def test_check_antiderivative_with_ln_abs():
    mp.check_antiderivative(r"\int \frac{2}{2x+1}\,\mathrm{d}x = \ln|2x+1| + C", 2 / (2 * x + 1))
    mp.check_antiderivative(r"\ln\lvert x\rvert + C", 1 / x)
    fails(lambda: mp.check_antiderivative(r"\ln|2x+1| + C", 1 / (2 * x + 1)))
    fails(lambda: mp.check_antiderivative(r"2\ln|2x+1| + C", 2 / (2 * x + 1)))


# 4. Rounded answers: exact precision, ROUND_HALF_UP, no plain "=" for a rounded value, several values.
def test_check_rounded_precision():
    mp.check_rounded(r"\mathrm{P}(X \le 3) \approx 0.342", Rational(3421, 10000))
    fails(lambda: mp.check_rounded(r"\approx 0.3", Rational(342, 1000)))
    fails(lambda: mp.check_rounded(r"\approx 0.3420", Rational(342, 1000)))
    fails(lambda: mp.check_rounded(r"x = 2", Rational(24, 10)))
    fails(lambda: mp.check_rounded(r"\approx 0.343", Rational(3421, 10000)))
    mp.check_rounded(r"x = 2.4", Rational(24, 10))  # exact value written with "=" is fine


def test_check_rounded_half_up():
    mp.check_rounded(r"\approx 0.124", Rational(1235, 10000))
    fails(lambda: mp.check_rounded(r"\approx 0.123", Rational(1235, 10000)))
    mp.check_rounded(r"\approx 2.35", Rational(2345, 1000), dp=2)
    fails(lambda: mp.check_rounded(r"\approx 2.345", Rational(2345, 1000), dp=2))
    mp.check_rounded(r"\approx 1.23 \times 10^{-4}", Rational(12345, 100000000))


def test_rounded_refuses_several_values_and_checks_lists():
    fails(lambda: mp.parse_approx(r"x \approx 1.23 \text{ or } x \approx 4.56"), ValueError)
    mp.check_rounded_list(r"x \approx 1.23 \text{ or } x \approx 4.56", [Rational(45612, 10000), Rational(12345, 10000)])
    fails(lambda: mp.check_rounded_list(r"x \approx 1.23 \text{ or } x \approx 4.57", [Rational(12345, 10000), Rational(45612, 10000)]))
    fails(lambda: mp.check_rounded_list(r"x \approx 1.23", [Rational(12345, 10000), Rational(45612, 10000)]))


def test_check_numeric_uses_the_required_precision():
    truth = Rational(3421, 10000)
    mp.check_numeric(0.342, truth)
    fails(lambda: mp.check_numeric(0.34, truth))
    fails(lambda: mp.check_numeric(0.3421, truth))
    mp.check_numeric(0.342, truth, tolerance=0.0005)
    fails(lambda: mp.check_numeric(0.342, truth, tolerance=0.005))
    mp.check_numeric(12.0, 12, dp=0)
    mp.check_numeric(2.35, Rational(2345, 1000), dp=2)


def test_bare_log_is_refused():
    fails(lambda: mp.parse_answer(r"\log 100"), ValueError)
    fails(lambda: mp.parse_answer(r"x = \log(5)"), ValueError)
    equal(mp.parse_answer(r"\log_{10} 100"), 2)


def test_trailing_input_is_refused():
    equal(mp.parse_answer(r"\frac{116}{15}"), Rational(116, 15))
    fails(lambda: mp.parse_answer(r"\frac{116}{15} +"), ValueError)
    fails(lambda: mp.parse_answer(r"\frac{116}{15}, 999"), ValueError)
    fails(lambda: mp.parse_answer(r"x^{2} )"), ValueError)


def test_function_names_and_silent_misreads():
    equal(mp.parse_answer(r"\operatorname{cosec} x"), 1 / sin(x))
    equal(mp.parse_answer(r"\mathrm{cosec}\,x"), 1 / sin(x))
    fails(lambda: mp.parse_answer(r"\operatorname{foo} x"), ValueError)
    # SymPy reads ln 3 . x as ln(3x) and drops the x in 2x ln 3: both must be refused, not misread.
    fails(lambda: mp.parse_answer(r"\ln 3 \cdot x"), ValueError)
    fails(lambda: mp.parse_answer(r"\sin x \cdot \cos x"), ValueError)
    fails(lambda: mp.parse_answer(r"2x\ln 3"), ValueError)
    equal(mp.parse_answer(r"\ln(3) \cdot x"), x * mp.parse_answer(r"\ln 3"))
    equal(mp.parse_answer(r"2x \cdot \ln 3"), 2 * x * mp.parse_answer(r"\ln 3"))
    equal(mp.parse_answer(r"\sin x \cos x"), sin(x) * cos(x))


# 5. Common answer forms.
def test_degrees():
    angle = acos(Rational(2, 3)) * 180 / pi  # 48.18968...
    mp.check_rounded(r"\theta \approx 48.2^{\circ}", angle, unit="°")
    mp.check_rounded(r"\theta \approx 48.2^\circ", angle, unit="°")
    fails(lambda: mp.check_rounded(r"\theta \approx 48.2", angle, unit="°"))
    equal(mp.parse_degrees(r"\angle ABC = 60^{\circ}"), 60)


def test_units():
    mp.check_rounded(r"A \approx 5.24\text{ cm}^{2}", Rational(5236, 1000), unit="cm^2")
    fails(lambda: mp.check_rounded(r"A \approx 5.24\text{ cm}^{2}", Rational(5236, 1000), unit="cm"))
    fails(lambda: mp.check_rounded(r"A \approx 5.24", Rational(5236, 1000), unit="cm^2"))
    assert mp.parse_with_unit(r"v = 12\ \text{m s}^{-1}", "m s^-1").strip().endswith("12")


def test_cis():
    truth = 2 * (cos(pi / 3) + I * sin(pi / 3))
    equal(mp.parse_answer(r"z = 2\,\mathrm{cis}\,\frac{\pi}{3}"), truth)
    equal(mp.parse_answer(r"z = 2\operatorname{cis}\left(\frac{\pi}{3}\right)"), truth)
    equal(mp.parse_answer(r"z = 3 + 4\mathrm{i}"), 3 + 4 * I)


def test_pi_is_the_number_pi():
    equal(mp.parse_answer(r"\sin\frac{\pi}{6}"), Rational(1, 2))
    equal(mp.parse_answer(r"x = \frac{\pi}{3}"), pi / 3)


def test_plus_minus_inside_braces():
    roots = mp.parse_list(r"x = \frac{3 \pm \sqrt{5}}{2}")
    assert len(roots) == 2
    equal(roots[0], (3 + sqrt(5)) / 2)
    equal(roots[1], (3 - sqrt(5)) / 2)
    equal(mp.parse_list(r"x = \pm 2")[1], -2)


def test_vector_line():
    line = r"\boldsymbol{r} = \begin{pmatrix}1\\2\\3\end{pmatrix} + \lambda\begin{pmatrix}2\\0\\-1\end{pmatrix}"
    mp.check_same_line(line, point=(3, 2, 2), direction=(-4, 0, 2))
    fails(lambda: mp.check_same_line(line, point=(3, 2, 3), direction=(-4, 0, 2)))
    fails(lambda: mp.check_same_line(line, point=(1, 2, 3), direction=(2, 1, -1)))
    point, direction = mp.parse_vector_line(line)
    assert point == [1, 2, 3] and direction == [2, 0, -1]


def test_sets_and_intervals():
    mp.check_same_set(r"x < -1 \text{ or } x > 4", Union(Interval.open(-oo, -1), Interval.open(4, oo)))
    mp.check_same_set(r"x \in \left]1, 3\right[", Interval.open(1, 3))
    mp.check_same_set(r"]1,3[", Interval.open(1, 3))
    mp.check_same_set(r"[1,3]", Interval(1, 3))
    mp.check_same_set(r"-1 < x \le 3", Interval.Lopen(-1, 3))
    mp.check_same_set(r"x \geq 2", Interval(2, oo))
    fails(lambda: mp.check_same_set(r"]1,3[", Interval(1, 3)))
    fails(lambda: mp.check_same_set(r"x < -1 \text{ or } x > 4", Union(Interval.open(-oo, -1), Interval(4, oo))))


# 6. Equations and named values.
def test_parse_equation_up_to_scalar():
    mp.check_same_equation(r"\Pi: 2x + y - z = 3", -4 * x - 2 * y + 2 * z + 6)
    fails(lambda: mp.check_same_equation(r"2x + y - z = 3", 2 * x + y - z - 4))
    mp.check_same_equation(r"(x-1)^{2} + (y+2)^{2} = 9", x**2 - 2 * x + y**2 + 4 * y - 4)
    mp.check_same_equation(r"y = 3x - 2", y - 3 * x + 2)
    fails(lambda: mp.check_same_equation(r"y = 3x - 2", y - 3 * x - 2))
    equal(mp.parse_equation(r"y = 3x - 2"), y - 3 * x + 2)


def test_named_values_keep_their_names():
    mp.check_assignments(r"x = 1, y = 2", {x: 1, y: 2})
    mp.check_assignments(r"x = 1 \text{ and } y = 2", {"x": 1, "y": 2})
    fails(lambda: mp.check_assignments(r"x = 2, y = 1", {x: 1, y: 2}))
    fails(lambda: mp.parse_list(r"x = 1, y = 2"), ValueError)
    assert mp.parse_list(r"x = -1 \text{ or } x = 4") == [-1, 4]


# Earlier behaviour that must stay.
def test_existing_refusals():
    fails(lambda: mp.parse_answer(r"x = 2 \text{ or } x = 3"), ValueError)
    fails(lambda: mp.parse_answer(r"\approx 0.342"), ValueError)
    fails(lambda: mp.parse_answer(r"\int x\,\mathrm{d}x"), ValueError)
    equal(mp.parse_answer(r"\tfrac12 x\,\mathrm{e}^{2x} - \tfrac14\mathrm{e}^{2x} + C"), x * E ** (2 * x) / 2 - E ** (2 * x) / 4)


if __name__ == "__main__":
    failed = 0
    tests = [(name, fn) for name, fn in sorted(globals().items()) if name.startswith("test_") and callable(fn)]
    for name, fn in tests:
        try:
            fn()
            print(f"PASS {name}")
        except Exception:  # noqa: BLE001
            failed += 1
            print(f"FAIL {name}\n{traceback.format_exc()}")
    print(f"{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
