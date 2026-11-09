"""Graph assertions for IB Maths AI lesson 3.16 (spanning trees, postman and salesman problems).
Not shipped to the browser.

Why a sidecar: no declarative verify kind reads a route (a string of vertex letters) or checks it against a graph,
and the lesson's totals are the outputs of graph algorithms. Typing the writer's own edge sum into `exact` would only
restate the working. So every graph from the lesson's questions is stored here as data, and each truth is the
algorithm run on that data: Kruskal's and Prim's for minimum spanning trees, shortest routes (Floyd) and the
least-weight pairing of odd vertices for the Chinese postman problem, nearest neighbour, deleted vertex and a brute-force
search for the travelling salesman problem. Routes are checked edge by edge (every step is an edge of the graph; an
Eulerian trail uses each edge exactly once; a Hamiltonian path or cycle visits each vertex exactly once).
Number answers are then read by verify_kinds' `exact` checker, so their parsing is the same as everywhere else.
Every other block in the lesson uses its own `verify`.
"""
import itertools
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import verify_kinds  # noqa: E402
from sympy import Integer  # noqa: E402

# ------------------------------------------------------------------------------------------------ the lesson's graphs

#: Garden footpaths (figure 3-16-garden), unweighted.
GARDEN = {"AB": 1, "BC": 1, "CD": 1, "AD": 1, "BD": 1, "DE": 1, "CE": 1}
#: Museum galleries (figure 3-16-gallery), unweighted.
GALLERY = {"AB": 1, "AC": 1, "BC": 1, "BD": 1, "CE": 1, "DE": 1, "DF": 1, "BE": 1}
#: Irrigation pipe costs between fields, thousands of dollars (figure 3-16-fields).
FIELDS = {"AB": 8, "AC": 11, "AF": 15, "BC": 6, "BD": 13, "CD": 9, "CE": 7, "DE": 10, "DF": 17, "EF": 12}
#: Pneumatic tube lengths between hospital departments, metres (table in ex-hospital-prim-table): complete graph.
HOSPITAL = {"VW": 52, "VX": 41, "VY": 62, "VZ": 45, "WX": 33, "WY": 57, "WZ": 68, "XY": 44, "XZ": 54, "YZ": 36}
#: Cable lengths between four kiosks, metres (table in check-kiosk-mst): complete graph.
KIOSKS = {"AB": 43, "AC": 36, "AD": 57, "BC": 39, "BD": 32, "CD": 49}
#: Street lengths in a housing estate, metres (figure 3-16-estate).
ESTATE = {"AB": 380, "AC": 650, "BC": 270, "BD": 720, "CD": 410, "CE": 820, "DE": 230}
#: Warehouse corridor lengths, metres (figure 3-16-warehouse).
WAREHOUSE = {"AB": 61, "AC": 31, "AD": 55, "BC": 26, "BE": 47, "CD": 38, "CF": 64, "DF": 29, "EF": 33}
#: Driving times between a piano tuner's home H and four clients, minutes (figure 3-16-tuner): not complete.
TUNER = {"HP": 84, "HQ": 30, "HS": 33, "PQ": 48, "PR": 51, "QR": 63, "QS": 45, "RS": 24}


def adjacency(edges):
    out = {}
    for pair, weight in edges.items():
        u, v = pair
        out.setdefault(u, {})[v] = weight
        out.setdefault(v, {})[u] = weight
    return out


def least_distances(edges):
    """Shortest-route weight between every pair of vertices (Floyd's algorithm)."""
    adj = adjacency(edges)
    vertices = sorted(adj)
    inf = float("inf")
    d = {u: {v: 0 if u == v else adj[u].get(v, inf) for v in vertices} for u in vertices}
    for k in vertices:
        for i in vertices:
            for j in vertices:
                if d[i][k] + d[k][j] < d[i][j]:
                    d[i][j] = d[i][k] + d[k][j]
    return d


def kruskal(edges):
    """Accepted edges in the order Kruskal's algorithm adds them (weights here have no ties that change the tree)."""
    parent = {}

    def root(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            x = parent[x]
        return x

    accepted = []
    for pair, weight in sorted(edges.items(), key=lambda item: item[1]):
        a, b = root(pair[0]), root(pair[1])
        if a != b:
            parent[a] = b
            accepted.append(pair)
    return accepted


def prim(d, start):
    """[(weight, tree vertex, new vertex)] in the order Prim's algorithm adds them, from a distance table."""
    tree, order = [start], []
    while len(tree) < len(d):
        best = min((d[u][v], u, v) for u in tree for v in d if v not in tree)
        order.append(best)
        tree.append(best[2])
    return order


def mst_weight(edges):
    return sum(edges[pair] for pair in kruskal(edges))


def odd_vertices(edges):
    degree = {}
    for u, v in edges:
        degree[u] = degree.get(u, 0) + 1
        degree[v] = degree.get(v, 0) + 1
    return sorted(v for v in degree if degree[v] % 2)


def pairings(vertices):
    if not vertices:
        yield []
        return
    first = vertices[0]
    for i in range(1, len(vertices)):
        for rest in pairings(vertices[1:i] + vertices[i + 1:]):
            yield [(first, vertices[i])] + rest


def postman_closed(edges):
    """Least weight of a closed route along every edge at least once."""
    d = least_distances(edges)
    return sum(edges.values()) + min(sum(d[a][b] for a, b in p) for p in pairings(odd_vertices(edges)))


def postman_open(edges):
    """Least weight of a route along every edge at least once, free to start and finish at any two vertices."""
    d = least_distances(edges)
    odd = odd_vertices(edges)
    best = 0
    if len(odd) > 2:
        best = min(sum(d[a][b] for a, b in p) for k in itertools.combinations(odd, len(odd) - 2) for p in pairings(list(k)))
    return sum(edges.values()) + best


def shortest_route_edges(edges, start, end):
    """The set of edges on the unique shortest route from start to end."""
    adj, d = adjacency(edges), least_distances(edges)
    routes = []

    def walk(path):
        here = path[-1]
        if here == end:
            routes.append(path)
            return
        for nxt, w in adj[here].items():
            if nxt not in path and d[start][here] + w + d[nxt][end] == d[start][end]:
                walk(path + [nxt])

    walk([start])
    if len(routes) != 1:
        raise ValueError(f"{len(routes)} shortest routes from {start} to {end}")
    route = routes[0]
    return {"".join(sorted(route[i:i + 2])) for i in range(len(route) - 1)}


def nearest_neighbour(d, start):
    tour, total = [start], 0
    while len(tour) < len(d):
        here = tour[-1]
        choices = sorted((d[here][v], v) for v in d if v not in tour)
        if len(choices) > 1 and choices[0][0] == choices[1][0]:
            raise ValueError(f"tie at {here}: nearest neighbour is not unique")
        total += choices[0][0]
        tour.append(choices[0][1])
    return "".join(tour) + start, total + d[tour[-1]][start]


def deleted_vertex(d, x):
    rest = {u: {v: d[u][v] for v in d if v != x} for u in d if u != x}
    tree = sum(w for w, _, _ in prim(rest, sorted(rest)[0]))
    return tree + sum(sorted(d[x][v] for v in d if v != x)[:2])


def tsp_optimum(d):
    vertices = sorted(d)
    start = vertices[0]
    return min(sum(d[a][b] for a, b in zip((start,) + p, p + (start,))) for p in itertools.permutations(vertices[1:]))


def table(edges):
    """A complete graph's edge list as a distance table."""
    adj = adjacency(edges)
    return {u: {v: adj[u][v] for v in adj if v != u} for u in adj}


def cycles_through(edges, pair):
    """The number of different cycles that use the edge `pair`."""
    adj = adjacency(edges)
    u, v = pair
    found = set()

    def extend(path):
        here = path[-1]
        for nxt in adj[here]:
            if nxt == u and len(path) >= 3:
                found.add(frozenset("".join(sorted(path[i:i + 2])) for i in range(len(path) - 1)) | {"".join(sorted(here + u))})
            elif nxt not in path:
                extend(path + [nxt])

    extend([u, v])
    return len(found)


# --------------------------------------------------------------------------------------------- reading the answers

_MATHRM = re.compile(r"\\mathrm\{([A-Z]+)\}")


def routes_in(text):
    """Vertex strings in published text: \\mathrm{ABC} spans, or plain capital runs of 3+ letters (check options)."""
    found = _MATHRM.findall(text)
    return found if found else re.findall(r"\b[A-Z]{3,}\b", text)


def pairs_in(text):
    """Two-letter edge names, in order: \\mathrm{AB} spans, or plain capital pairs (check options)."""
    found = [token for token in _MATHRM.findall(text) if len(token) == 2]
    return found if found else re.findall(r"\b[A-Z]{2}\b", text)


def value_after_equals(text):
    """The published number after the last = sign, read by the `exact` kind (units allowed)."""
    return "$" + text.rsplit("=", 1)[1].strip().strip("$").strip() + "$"


def exact(text, truth):
    """The `exact` kind's reading of the published value (units allowed), against the computed truth."""
    with verify_kinds.mp.keep_constant():
        verify_kinds.k_exact(text, Integer(truth), {})


def same_edge(a, b):
    return sorted(a) == sorted(b)


# ---------------------------------------------------------------------------------------------------- the assertions

def number(truth):
    def check(value, tolerance=None):
        if tolerance is None:
            exact(value, truth)
        elif abs(float(value) - truth) > tolerance:
            raise AssertionError(f"{value} is not {truth}")
    return check


def eulerian_trail(edges):
    def check(text):
        routes = routes_in(text)
        if len(routes) != 1:
            raise AssertionError(f"expected one route in {text!r}")
        route = routes[0]
        used = ["".join(sorted(route[i:i + 2])) for i in range(len(route) - 1)]
        if sorted(used) != sorted(edges):
            raise AssertionError(f"{route} does not use every edge exactly once")
    return check


def hamiltonian(edges, closed, start=None):
    adj = adjacency(edges)

    def check(text):
        routes = routes_in(text)
        if len(routes) != 1:
            raise AssertionError(f"expected one route in {text!r}")
        route = routes[0]
        if any(b not in adj.get(a, {}) for a, b in zip(route, route[1:])):
            raise AssertionError(f"{route} uses a pair of vertices with no edge between them")
        visits = route[:-1] if closed else route
        if closed and route[0] != route[-1]:
            raise AssertionError(f"{route} does not return to its start")
        if sorted(visits) != sorted(adj):
            raise AssertionError(f"{route} does not visit every vertex exactly once")
        if start and route[0] != start:
            raise AssertionError(f"{route} does not start at {start}")
    return check


def kruskal_answer(edges):
    order = kruskal(edges)

    def check(text):
        published = pairs_in(text.rsplit(";", 1)[0])
        if len(published) != len(order) or not all(same_edge(a, b) for a, b in zip(published, order)):
            raise AssertionError(f"edges {published} are not Kruskal's order {order}")
        exact(value_after_equals(text), mst_weight(edges))
    return check


def prim_edge(edges, start, position):
    edge = prim(_sparse(edges), start)[position - 1]

    def check(text):
        published = pairs_in(text)
        if len(published) != 1 or not same_edge(published[0], edge[1] + edge[2]):
            raise AssertionError(f"{text!r} is not edge {edge[1]}{edge[2]}")
    return check


def _sparse(edges):
    adj = adjacency(edges)
    return {u: {v: adj[u].get(v, float("inf")) for v in adj if v != u} for u in adj}


def prim_answer(edges, start):
    order = prim(table(edges), start)
    vertices = [start] + [new for _, _, new in order]

    def check(text):
        published = [token for token in _MATHRM.findall(text.rsplit(";", 1)[0]) if len(token) == 1]
        if published != vertices:
            raise AssertionError(f"vertex order {published} is not {vertices}")
        exact(value_after_equals(text), sum(w for w, _, _ in order))
    return check


def repeated_edges(edges, start, end):
    truth = shortest_route_edges(edges, start, end)

    def check(text):
        published = {"".join(sorted(pair)) for pair in pairs_in(text)}
        if published != truth:
            raise AssertionError(f"{sorted(published)} are not the repeated edges {sorted(truth)}")
    return check


def least_distance_entries(edges):
    """Every table entry that is not simply the direct edge (no edge, or a quicker detour), with its least distance."""
    d = least_distances(edges)

    def check(text):
        found = re.findall(r"\\mathrm\{([A-Z])([A-Z])\}\s*=\s*(\d+)", text)
        if not found:
            raise AssertionError(f"no entries XY = n in {text!r}")
        direct = {"".join(sorted(pair)): weight for pair, weight in edges.items()}
        changed = {u + v for u in d for v in d if u < v and direct.get(u + v) != d[u][v]}
        if {"".join(sorted(u + v)) for u, v, _ in found} != changed:
            raise AssertionError(f"published entries {found} are not the pairs with no direct edge or a quicker detour {sorted(changed)}")
        for u, v, value in found:
            if int(value) != d[u][v]:
                raise AssertionError(f"{u}{v} = {value}, but the least distance is {d[u][v]}")
    return check


def nn_answer(edges, start):
    tour, total = nearest_neighbour(least_distances(edges), start)

    def check(text):
        routes = routes_in(text.rsplit("=", 1)[0])
        if routes != [tour]:
            raise AssertionError(f"route {routes} is not the nearest neighbour tour {tour}")
        exact(value_after_equals(text), total)
    return check


def optimum_from_bound(edges, deleted):
    """The answer is the least tour weight, and the set-up holds: deleting `deleted` gives a lower bound equal to it."""
    d = least_distances(edges)
    best = tsp_optimum(d)
    if deleted_vertex(d, deleted) != best:
        raise ValueError("set-up: this lower bound does not meet the optimum")
    return number(best)


TUNER_D = least_distances(TUNER)

CHECKS = {
    "ex-garden-cycles-de": number(cycles_through(GARDEN, "DE")),
    "ex-garden-euler": eulerian_trail(GARDEN),
    "check-garden-hamilton-cycle": hamiltonian(GARDEN, closed=True),
    "ex-gallery-hamilton": hamiltonian(GALLERY, closed=False, start="A"),
    "ex-fields-kruskal": kruskal_answer(FIELDS),
    "check-fields-prim": prim_edge(FIELDS, "F", 3),
    "ex-hospital-prim-table": prim_answer(HOSPITAL, "V"),
    "check-kiosk-mst": number(mst_weight(KIOSKS)),
    "ex-estate-postman": number(postman_closed(ESTATE)),
    "check-estate-repeats": repeated_edges(ESTATE, "B", "D"),
    "ex-warehouse-postman": number(postman_closed(WAREHOUSE)),
    "check-warehouse-open": number(postman_open(WAREHOUSE)),
    "ex-tuner-least-distances": least_distance_entries(TUNER),
    "ex-tuner-nearest-neighbour": nn_answer(TUNER, "H"),
    "check-nn-from-p": number(nearest_neighbour(TUNER_D, "P")[1]),
    "ex-tuner-delete-h": number(deleted_vertex(TUNER_D, "H")),
    "ex-tuner-optimal": optimum_from_bound(TUNER, "P"),
}
NUMERIC = {"check-kiosk-mst": {"dp": 0}, "check-warehouse-open": {"dp": 0}, "check-nn-from-p": {"dp": 0}}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
