"""SymPy assertions for lesson 5.16 (integration by substitution and parts). Not shipped to the browser."""
from sympy import Rational, cos, diff, exp, integrate, log, simplify, sin, sqrt, symbols

x = symbols("x", positive=True)


def antiderivative_is(answer, integrand):
    """Differentiating the stated answer must give the integrand back."""
    return simplify(diff(answer, x) - integrand) == 0


CHECKS = {
    # Before you start
    "before-product-rule": lambda: simplify(diff(x * exp(x), x) - (exp(x) + x * exp(x))) == 0,
    "before-integrate-cos": lambda: antiderivative_is(sin(x), cos(x)),
    # Example 1: x e^{2x}
    "ex-parts-xe2x": lambda: antiderivative_is(Rational(1, 2) * x * exp(2 * x) - Rational(1, 4) * exp(2 * x), x * exp(2 * x))
    # the intermediate integral in step 3
    and antiderivative_is(Rational(1, 4) * exp(2 * x), Rational(1, 2) * exp(2 * x)),
    # Check yourself: integral of ln x
    "check-integrate-ln": lambda: antiderivative_is(x * log(x) - x, log(x)),
    # Example 2: e^x sin x, and the intermediate e^x cos x from the second round
    "ex-parts-twice-exsinx": lambda: antiderivative_is(Rational(1, 2) * exp(x) * (sin(x) - cos(x)), exp(x) * sin(x))
    and antiderivative_is(Rational(1, 2) * exp(x) * (sin(x) + cos(x)), exp(x) * cos(x)),
    # Example 3: exact value, via the stated u-form and directly in x
    "ex-subst-definite": lambda: (
        integrate(x * sqrt(x + 1), (x, 0, 3)) == Rational(116, 15)
        and (Rational(2, 5) * 4 ** Rational(5, 2) - Rational(2, 3) * 4 ** Rational(3, 2)) - (Rational(2, 5) - Rational(2, 3)) == Rational(116, 15)
        and Rational(62, 5) - Rational(14, 3) == Rational(116, 15)
    ),
}
