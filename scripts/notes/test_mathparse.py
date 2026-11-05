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


def test_antiderivative_accepts_constant_multiples_inside_ln_modulus():
    mp.check_antiderivative(r"\ln|2x| + C", 1 / x)
    mp.check_antiderivative(r"\frac{1}{2}\ln|4x^{2} - 1| + C", 4 * x / (4 * x**2 - 1))
    fails(lambda: mp.check_antiderivative(r"\ln(|x| + 1) + C", 1 / x))
    fails(lambda: mp.check_antiderivative(r"\ln|2x| + x + C", 1 / x))


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


# A Cartesian line must be affine in each coordinate: equal squares contain the line but also extra points (PR #465).
def test_same_cartesian_line_is_equivalence_not_containment():
    point, direction = (-4, 3, 1), (2, -5, 3)
    mp.check_same_cartesian_line(r"\frac{x + 4}{2} = \frac{y - 3}{-5} = \frac{z - 1}{3}", point, direction)
    mp.check_same_cartesian_line(r"\frac{x}{2} = \frac{y + 7}{-5} = \frac{z - 7}{3}", point, direction)
    mp.check_same_cartesian_line(r"\frac{x + 4}{-4} = \frac{y - 3}{10} = \frac{z - 1}{-6}", point, direction)
    mp.check_same_cartesian_line(r"x + 4 = \frac{2(y - 3)}{-5} = \frac{2(z - 1)}{3}", point, direction)
    mp.check_same_cartesian_line(r"\frac{y - 3}{-5} = \frac{x + 4}{2} = \frac{z - 1}{3}", point, direction)
    # The reviewer's equal-squares answer: every part is t^2 on the line, but (-2, 8, 4) also satisfies it.
    fails(lambda: mp.check_same_cartesian_line(
        r"\frac{(x + 4)^{2}}{4} = \frac{(y - 3)^{2}}{25} = \frac{(z - 1)^{2}}{9}", point, direction), AssertionError)
    fails(lambda: mp.check_same_cartesian_line(r"\frac{x^{3} + 4}{2} = \frac{y - 3}{-5} = \frac{z - 1}{3}", point, direction))
    fails(lambda: mp.check_same_cartesian_line(r"\frac{x + 4}{2} = \frac{y - 3}{5} = \frac{z - 1}{3}", point, direction))
    fails(lambda: mp.check_same_cartesian_line(r"\frac{x + 4}{2} = \frac{y - 3}{-5} = \frac{z + 1}{3}", point, direction))
    fails(lambda: mp.check_same_cartesian_line(r"\frac{x + 4}{2} = \frac{x - 3}{-5} = \frac{z - 1}{3}", point, direction))
    fails(lambda: mp.check_same_cartesian_line(r"\frac{x + 4}{2} = \frac{y - 3}{-5}", point, direction))


# Self-inverse means f(f(x)) = x proved for every x in the domain, not at a few sample points (PR #465).
def test_self_inverse_is_proved_not_sampled():
    mp.check_self_inverse(r"\sqrt[3]{8 - x^{3}}")
    mp.check_self_inverse(r"\sqrt[5]{3 - x^{5}}")
    mp.check_self_inverse(r"6 - x")
    mp.check_self_inverse(r"-\sqrt[3]{x^{3} + 8}")
    # Fixes 1/2, 1 and 19/10 (the old sample points) but g(g(0)) = -72067/8000.
    fails(lambda: mp.check_self_inverse(r"x + (x - \tfrac{1}{2})(x - 1)(x - \tfrac{19}{10})"), AssertionError)
    fails(lambda: mp.check_self_inverse(r"8 - x^{3}"), AssertionError)
    fails(lambda: mp.check_self_inverse(r"\sqrt[3]{8 - x}"), AssertionError)
    # Self-inverse where defined, but not defined at x = 0, so not on all real numbers.
    fails(lambda: mp.check_self_inverse(r"\frac{1}{x}"), AssertionError)
    mp.check_self_inverse(r"\frac{1}{x}", domain=Interval.open(0, oo))


# An antiderivative is proved by differentiating, with ln|u| handled; agreeing at the sample points is not enough.
def test_antiderivative_is_proved_not_sampled():
    mp.check_antiderivative(r"\ln|4x + 3| + C", 4 / (4 * x + 3))
    mp.check_antiderivative(r"-\ln|\cos x| + C", sin(x) / cos(x))
    mp.check_antiderivative(r"\frac{1}{2}x^{2} + C", x)
    samples = [-3.7, -2.3, -1.3, -0.65, -0.15, 0.35, 0.8, 1.3, 2.7, 4.1]
    bump = "".join(f"(x - {s})" for s in samples)
    # Its derivative is x at every default sample point (each sample is a double root of the extra term), not elsewhere.
    wrong = rf"\frac{{1}}{{2}}x^{{2}} + {bump}{bump} + C"
    fails(lambda: mp.check_antiderivative(wrong, x), AssertionError)



# ------------------------------------------------------------------------------------------- declarative verify kinds
# Each kind: the correct answer passes and at least two plausible wrong answers fail (form errors included).

import verify_kinds as vk  # noqa: E402


def passes(kind, truth, tex, **opts):
    vk.check({"kind": kind, "truth": truth, **opts}, tex)


def wrong(kind, truth, tex, **opts):
    """A wrong answer must be rejected as WRONG (AssertionError), as a multiple-choice distractor is."""
    fails(lambda: vk.check({"kind": kind, "truth": truth, **opts}, tex), AssertionError)


def test_truth_is_evaluated_exactly_in_a_sympy_only_namespace():
    equal(vk.evaluate_truth("sqrt(5**2 + 12**2)"), 13)
    equal(vk.evaluate_truth("1/3"), Rational(1, 3))
    equal(vk.evaluate_truth("12.5 * 1.08"), Rational(27, 2))
    equal(vk.evaluate_truth("x**2 - 1"), x**2 - 1)
    assert vk.evaluate_truth('{"x": 2, "y": -1}') == {"x": 2, "y": -1}
    for bad in ["__import__('os')", "().__class__", "x.__class__", "open('f')", "(lambda: 1)()", "[i for i in range(3)]",
                "sympify('2')", "S('__import__(1)')", "Symbol('x')", "lambdify(x, 'x')", "{'__x': 1}", "import os", ""]:
        fails(lambda bad=bad: vk.evaluate_truth(bad), ValueError)


def test_spec_rejects_unknown_kinds_and_options():
    for bad in [{"kind": "nope", "truth": "1"}, {"kind": "exact", "truth": " "}, {"kind": "rounded", "truth": "1"},
                {"kind": "rounded", "truth": "1", "sf": 3, "dp": 2}, {"kind": "exact", "truth": "1", "sf": 3},
                {"kind": "time", "truth": "60"}, {"kind": "time", "truth": "60", "form": "noon"}, {"kind": "money", "truth": "1", "dp": 1},
                {"kind": "rounded", "truth": "1", "sf": 0}, {"kind": "expression", "truth": "x", "scale": "yes"}]:
        fails(lambda bad=bad: vk.check_spec(bad), ValueError)
    vk.check_spec({"kind": "rounded", "truth": "1", "dp": 2})


def test_kind_exact():
    passes("exact", "gcd(24, 36)", r"\text{HCF} = 12")
    passes("exact", "sqrt(5**2 + 12**2)", r"AB = 13\text{ cm}", unit="cm")
    wrong("exact", "gcd(24, 36)", r"\text{HCF} = 6")
    wrong("exact", "Rational(1, 3)", r"0.333")
    wrong("exact", "sqrt(8)", r"4\sqrt{2}")
    fails(lambda: passes("exact", "sqrt(2)", r"\approx 1.41"), ValueError)  # a rounded value is not an exact answer


def test_kind_rounded():
    passes("rounded", "sqrt(5**2 + 7**2)", r"x \approx 8.60", sf=3)
    passes("rounded", "pi * 3**2", r"A \approx 28.27\text{ cm}^2", dp=2, unit="cm^2")
    wrong("rounded", "sqrt(5**2 + 7**2)", r"x \approx 8.6", sf=3)       # 2 s.f. where 3 are required
    wrong("rounded", "sqrt(5**2 + 7**2)", r"x \approx 8.602", sf=3)     # 4 s.f.
    wrong("rounded", "Rational(1235, 10000)", r"\approx 0.123", sf=3)   # rounded down, not half up
    wrong("rounded", "sqrt(5**2 + 7**2)", r"x = 8.60", sf=3)            # a rounded value written with =


def test_kind_numeric():
    vk.check({"kind": "numeric", "truth": "lcm(6, 8)", "sf": 2}, 24, tolerance=0)
    vk.check({"kind": "numeric", "truth": "sqrt(2)", "sf": 3}, 1.41, tolerance=0.005)
    fails(lambda: vk.check({"kind": "numeric", "truth": "lcm(6, 8)", "sf": 2}, 48, tolerance=0), AssertionError)
    fails(lambda: vk.check({"kind": "numeric", "truth": "sqrt(2)", "sf": 3}, 1.4, tolerance=0.05), AssertionError)
    fails(lambda: vk.check({"kind": "numeric", "truth": "sqrt(2)", "sf": 3}, 1.41, tolerance=0.05), AssertionError)


def test_kind_list():
    passes("list", "[2, 3]", r"x = 3 \text{ or } x = 2")
    passes("list", "[1 + sqrt(2), 1 - sqrt(2)]", r"x = 1 \pm \sqrt{2}")
    passes("list", "[(-5 + sqrt(17))/2, (-5 - sqrt(17))/2]", r"x \approx -0.438 \text{ or } x \approx -4.56", sf=3)
    wrong("list", "[2, 3]", r"x = 2")
    wrong("list", "[2, 3]", r"x = 2 \text{ or } x = -3")
    wrong("list", "[2, 3]", r"x = 2 \text{ or } x = 3 \text{ or } x = 0")


def test_kind_assignments():
    passes("assignments", '{"x": 2, "y": -1}', r"x = 2, \; y = -1")
    passes("assignments", "[Eq(x, 2), Eq(y, -1)]", r"y = -1 \text{ and } x = 2")
    wrong("assignments", '{"x": 2, "y": -1}', r"x = -1, \; y = 2")
    wrong("assignments", '{"x": 2, "y": -1}', r"x = 2")


def test_kind_point():
    passes("point", "(2, -3)", r"P = (2, -3)")
    passes("point", "(sqrt(2), pi)", r"P \approx (1.41, 3.14)", sf=3)
    wrong("point", "(2, -3)", r"(-3, 2)")
    wrong("point", "(2, -3)", r"(2, -3, 0)")
    wrong("point", "(sqrt(2), pi)", r"P = (1.41, 3.14)", sf=3)


def test_kind_vector():
    passes("vector", "[3, -4]", r"\overrightarrow{AB} = \begin{pmatrix}3\\-4\end{pmatrix}")
    wrong("vector", "[3, -4]", r"\begin{pmatrix}-3\\4\end{pmatrix}")
    wrong("vector", "[3, -4]", r"\begin{pmatrix}3\\-4\\0\end{pmatrix}")


def test_kind_equation_is_equivalence_up_to_a_non_zero_factor():
    passes("equation", "Eq(y, 2*x + 3)", r"y = 2x + 3")
    passes("equation", "Eq(y, 2*x + 3)", r"2y - 4x = 6")
    wrong("equation", "Eq(y, 2*x + 3)", r"y = 3x + 2")
    wrong("equation", "Eq(y, 2*x + 3)", r"(y - 2x - 3)(x - 1) = 0")  # contains the line, is not the line
    wrong("equation", "Eq(y, 2*x + 3)", r"(y - 2x - 3)^{2} = 0")      # the squared-line counterexample
    wrong("equation", "Eq(y, 2*x + 3)", r"0 = 0")                     # degenerate


def test_kind_inequality_and_set_compare_solution_sets():
    passes("inequality", "x > 3", r"x > 3")
    passes("inequality", "And(x >= -1, x < 4)", r"-1 \le x < 4")
    passes("set", "Union(Interval.open(-oo, -1), Interval.open(4, oo))", r"x < -1 \text{ or } x > 4")
    passes("set", "FiniteSet(-1, 0, 1, 2)", r"n = -1, 0, 1, 2", var="n")
    passes("set", "FiniteSet(-1, 0, 1, 2)", r"\{-1, 0, 1, 2\}")
    wrong("inequality", "x > 3", r"x \ge 3")
    wrong("inequality", "x > 3", r"x > 4")                            # contained in, not equal to
    wrong("inequality", "x > 3", r"\varnothing")                      # degenerate
    wrong("set", "FiniteSet(-1, 0, 1, 2)", r"\{0, 1, 2\}")
    wrong("set", "FiniteSet(-1, 0, 1, 2)", r"\{-1, 0, 1, 2, 3\}")


def test_kind_ratio_must_be_in_simplest_form():
    passes("ratio", "(12, 18)", r"2 : 3")
    passes("ratio", "(Rational(1, 2), Rational(1, 3), 1)", r"3:2:6")
    wrong("ratio", "(12, 18)", r"4 : 6")                              # unsimplified
    wrong("ratio", "(12, 18)", r"3 : 2")                              # reversed
    wrong("ratio", "(12, 18)", r"1 : 1.5")


def test_kind_standard_form():
    passes("standard-form", "2400", r"2.4 \times 10^{3}")
    passes("standard-form", "2400", r"2.40 \times 10^{3}", sf=3)
    passes("standard-form", "Rational(1, 7) / 1000", r"\approx 1.43 \times 10^{-4}", sf=3)
    wrong("standard-form", "2400", r"24 \times 10^{2}")               # 1 <= a < 10 broken
    wrong("standard-form", "2400", r"2.4 \times 10^{3}", sf=3)        # 2 s.f. where 3 are required
    wrong("standard-form", "2400", r"2400")
    wrong("standard-form", "2400", r"2.4 \times 10^{4}")


def test_kind_money():
    passes("money", "12.5", r"\$12.50")
    passes("money", "1250 * 1.08", r"\text{Cost} = \$1{,}350.00")
    passes("money", "Rational(100, 3)", r"33.33 \text{ dollars}")
    wrong("money", "12.5", r"\$12.5")                                 # not 2 d.p.
    wrong("money", "12.5", r"\$12.05")
    wrong("money", "Rational(200, 3)", r"\$66.66")                    # truncated, not rounded


def test_kind_time():
    passes("time", "14*60 + 35", r"14:35", form="clock")
    passes("time", "9*60 + 5", r"\text{09 05}", form="clock")
    passes("time", "(23*60 + 50 + 30) ", r"00:20", form="clock")      # past midnight wraps
    passes("time", "155", r"2\text{ h }35\text{ min}", form="duration")
    wrong("time", "14*60 + 35", r"2:35\text{ pm}", form="clock")     # 12-hour clock
    wrong("time", "14*60 + 35", r"14:53", form="clock")
    wrong("time", "155", r"2.35\text{ hours}", form="duration")       # decimal hours misread as h.min
    wrong("time", "155", r"1\text{ h }95\text{ min}", form="duration")


def test_kind_bearing():
    passes("bearing", "45", r"045^{\circ}")
    passes("bearing", "360 - 45", r"\text{bearing} = 315°")
    passes("bearing", "atan2(3, 4) * 180 / pi", r"\approx 036.9^{\circ}", dp=1)
    wrong("bearing", "45", r"45^{\circ}")                             # not three figures
    wrong("bearing", "45", r"135^{\circ}")
    wrong("bearing", "45", r"225^{\circ}")


def test_kind_angle():
    passes("angle", "acos(Rational(4, 5)) * 180 / pi", r"\theta \approx 36.9^{\circ}")
    passes("angle", "180 - 2*50", r"x = 80^{\circ}")
    wrong("angle", "acos(Rational(4, 5)) * 180 / pi", r"\theta \approx 36.87^{\circ}")  # 2 d.p.
    wrong("angle", "acos(Rational(4, 5)) * 180 / pi", r"\theta = 36.9^{\circ}")         # rounded value with =
    wrong("angle", "180 - 2*50", r"x \approx 80.0^{\circ}")                             # exact angle given rounded
    wrong("angle", "180 - 2*50", r"x = 80")                                             # no degrees


def test_kind_fraction():
    passes("fraction", "Rational(3, 8) * Rational(2, 7)", r"\frac{3}{28}")
    passes("fraction", "Rational(7, 3)", r"2\tfrac{1}{3}", form="mixed")
    passes("fraction", "Rational(6, 8)", r"\frac{6}{8}", simplest=False)
    wrong("fraction", "Rational(3, 4)", r"\frac{6}{8}")               # not simplest
    wrong("fraction", "Rational(3, 4)", r"0.75")                      # a decimal
    wrong("fraction", "Rational(3, 4)", r"\frac{4}{3}")
    wrong("fraction", "Rational(7, 3)", r"\frac{7}{3}", form="mixed")


def test_kind_expression_equivalence_and_form():
    passes("expression", "x**2 + 5*x + 6", r"(x + 2)(x + 3)")
    passes("expression", "x**2 + 5*x + 6", r"(x + 3)(x + 2)", form="factorised")
    passes("expression", "2*x**2 - 8", r"2(x - 2)(x + 2)", form="factorised")
    passes("expression", "(x + 2)*(x + 3)", r"x^{2} + 5x + 6", form="expanded")
    passes("expression", "(x**2 - 1)/(x - 1)", r"x + 1", form="simplified")
    wrong("expression", "x**2 + 5*x + 6", r"(x + 1)(x + 6)")
    wrong("expression", "2*x**2 - 8", r"2(x^{2} - 4)", form="factorised")       # factorises further
    wrong("expression", "2*x**2 - 8", r"(2x - 4)(x + 2)", form="factorised")    # common factor left in
    wrong("expression", "x**2 + 5*x + 6", r"x^{2} + 5x + 6", form="factorised")
    wrong("expression", "(x + 2)*(x + 3)", r"x^{2} + 2x + 3x + 6", form="expanded")
    wrong("expression", "(x + 2)*(x + 3)", r"(x + 2)(x + 3)", form="expanded")
    wrong("expression", "(x**2 - 1)/(x - 1)", r"\frac{x^{2} - 1}{x - 1}", form="simplified")
    wrong("expression", "3*x/4", r"\frac{6}{8}x", form="simplified")


def test_kind_choice():
    passes("choice", "irrational", "irrational")
    wrong("choice", "irrational", "rational")
    wrong("choice", "irrational", "integer")


# The AA review counterexamples (PR #465 rounds) stay covered wherever a kind applies.
def test_review_counterexamples_under_the_kinds():
    # ln|2x| + C differs from ln|x| + C by a constant, so it IS an antiderivative of 1/x.
    passes("antiderivative", "1/x", r"\ln|2x| + C")
    passes("antiderivative", "1/x", r"\ln|x| + C")
    wrong("antiderivative", "1/x", r"x\ln x + C")
    # An integrating factor is any non-zero constant multiple of e^(x^2): zero and constants are degenerate.
    passes("expression", "exp(x**2)", r"3\mathrm{e}^{x^{2}}", scale=True)
    wrong("expression", "exp(x**2)", r"0", scale=True)
    wrong("expression", "exp(x**2)", r"5", scale=True)
    wrong("expression", "exp(x**2)", r"\mathrm{e}^{2x}", scale=True)
    # Agreeing at sample points is not equivalence (the sampled self-inverse hole): proved symbolically or rejected.
    samples = [0, 1, 2, 3]
    bump = "".join(f"(x - {s})" for s in samples)
    wrong("expression", "x", rf"x + {bump}")
    # Containment is not equivalence: a squared or multiplied equation, a smaller solution set.
    wrong("equation", "Eq(y, 2*x + 3)", r"(y - 2x - 3)^{2} = 0")
    wrong("inequality", "x > 3", r"x > 5")


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
