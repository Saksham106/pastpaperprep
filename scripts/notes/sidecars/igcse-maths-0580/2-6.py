"""SymPy assertions for 0580 lesson 2.6 (inequalities). Not shipped to the browser.

The `inequality` / `set` kinds read inequalities in ONE variable only. The region work uses x and y together, so three
helpers cover it:

- `same_inequalities` reads a published list of inequalities in x and y (`y \\geqslant 1, \\; x + y < 6`, chains such
  as `1 \\le y \\le 5` count as two) and checks it is exactly the true list: each published inequality must be a true one
  up to a POSITIVE constant factor, with the same strictness, and every true one must be published once. So a reversed
  sign, a solid line written as strict (or the reverse), a wrong line or a missing inequality all fail.
- `region_from_lines` builds that true list from the question's own data: each boundary line with its style (solid or
  broken), oriented so the centroid of the region's corners satisfies it. The corners are the lines' intersections.
- `in_region` reads a published point `(a, b)` and checks it satisfies every inequality of a region.

Everything else in the lesson uses its declarative `verify` block.
"""
import re
import sys
from itertools import combinations
from pathlib import Path

from sympy import Eq, Gt, Lt, Ge, Le, Rational, Symbol, simplify, solve

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from mathparse import _parse, _split, _strip_decorations, _top_level_cuts, parse_point  # noqa: E402

x, y = Symbol("x"), Symbol("y")
RELATION = re.compile(r"(\\le |\\ge |\\le(?![a-zA-Z])|\\ge(?![a-zA-Z])|<|>)")
SEPARATOR = r"\\text\{\s*(?:and|,)\s*\}|,"


def normal(relation):
    """(e, strict) meaning e > 0 (strict) or e >= 0, for a relation between expressions in x and y."""
    if isinstance(relation, (Gt, Ge)):
        return simplify(relation.lhs - relation.rhs), isinstance(relation, Gt)
    if isinstance(relation, (Lt, Le)):
        return simplify(relation.rhs - relation.lhs), isinstance(relation, Lt)
    raise ValueError(f"{relation} is not an inequality")


def published_inequalities(tex):
    cleaned = _strip_decorations(tex).strip()
    relations = []
    for piece in _split(cleaned, _top_level_cuts(cleaned, SEPARATOR)):
        if not piece.strip():
            continue
        tokens = RELATION.split(piece)
        if len(tokens) < 3:
            raise ValueError(f"cannot read {piece!r} in {tex!r} as an inequality")
        exprs = [_parse(token.strip(), tex) for token in tokens[0::2]]
        ops = {"<": Lt, ">": Gt, "\\le": Le, "\\ge": Ge}
        for left, op, right in zip(exprs, tokens[1::2], exprs[1:]):
            left, right = (e.subs({s: Symbol(s.name) for s in e.free_symbols}) for e in (left, right))
            relations.append(ops[op.strip()](left, right, evaluate=False))
    return [normal(relation) for relation in relations]


def matches(a, b):
    (ea, sa), (eb, sb) = a, b
    if sa != sb:
        return False
    ratio = simplify(ea / eb)
    return not ratio.free_symbols and ratio.is_positive


def same_inequalities(tex, truth):
    published = published_inequalities(tex)
    wanted = [normal(relation) for relation in truth]
    if len(published) != len(wanted):
        raise AssertionError(f"{tex!r} gives {len(published)} inequalities, {len(wanted)} expected")
    remaining = list(published)
    for want in wanted:
        hit = next((i for i, got in enumerate(remaining) if matches(got, want)), None)
        if hit is None:
            raise AssertionError(f"{want[0]} {'>' if want[1] else '>='} 0 is missing or wrong in {tex!r}")
        remaining.pop(hit)


def region_from_lines(lines):
    """lines: [(Eq, solid)]. The region is the triangle (or polygon) the lines enclose; orient each by its centroid."""
    corners = []
    for (a, _), (b, _) in combinations(lines, 2):
        point = solve([a, b], [x, y], dict=True)
        if point:
            corners.append((point[0][x], point[0][y]))
    cx = sum(c[0] for c in corners) / len(corners)
    cy = sum(c[1] for c in corners) / len(corners)
    region = []
    for line, solid in lines:
        e = line.lhs - line.rhs
        inside = e.subs({x: cx, y: cy})
        if inside == 0:
            raise ValueError(f"centroid lies on {line}")
        sign = 1 if inside > 0 else -1
        op = Ge if solid else Gt
        region.append(op(sign * e, 0))
    return region


def in_region(tex, region):
    a, b = parse_point(tex)
    for relation in region:
        if not bool(relation.subs({x: a, y: b})):
            raise AssertionError(f"{tex!r} does not satisfy {relation}")


# ex-list-region: lines y = 1 (solid), x + y = 6 (broken), y = 2x (solid) enclose R.
LIST_REGION = region_from_lines([(Eq(y, 1), True), (Eq(x + y, 6), False), (Eq(y, 2 * x), True)])
# check-boundary-type: the region above the broken line y = 3x - 2 (above = larger y than the line).
ABOVE_BROKEN = [Gt(y, 3 * x - 2)]
# check-point-in-region: x > 1, y >= 2, x + y <= 7.
POINT_REGION = [Gt(x, 1), Ge(y, 2), Le(x + y, 7)]

CHECKS = {
    "ex-list-region": lambda tex: same_inequalities(tex, LIST_REGION),
    "check-boundary-type": lambda tex: same_inequalities(tex, ABOVE_BROKEN),
    "check-point-in-region": lambda tex: in_region(tex, POINT_REGION),
}
NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
