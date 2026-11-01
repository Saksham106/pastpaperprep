// Topic page mockups: shared top area and Calculus lesson one-liners.
(function () {
  const M = window.MOCK;
  const BLURB = {
    "5.1": "The gradient of a curve as a limit, and f′(x) as a rate of change.",
    "5.2": "Use the sign of f′(x) to find where a function increases or decreases.",
    "5.3": "Differentiate axⁿ term by term, for integer powers.",
    "5.4": "Equations of tangents and normals at a given point.",
    "5.5": "Antiderivatives, definite integrals with a calculator, and area under a curve.",
    "5.6": "Derivatives of xⁿ, sin, cos, eˣ and ln x; chain, product and quotient rules.",
    "5.7": "The second derivative and what it tells you about concavity.",
    "5.8": "Local maxima and minima, points of inflection, and optimisation.",
    "5.9": "Displacement, velocity and acceleration; total distance travelled.",
    "5.10": "Indefinite integrals of standard functions, by inspection or substitution.",
    "5.11": "Definite integrals by hand, and areas between curves.",
    "5.12": "Continuity, differentiability, first principles and higher derivatives.",
    "5.13": "Limits of 0/0 and ∞/∞ forms with L’Hôpital’s rule or Maclaurin series.",
    "5.14": "Implicit differentiation, related rates and harder optimisation.",
    "5.15": "Derivatives of tan, sec, cosec, cot, aˣ, logₐx and inverse trig; partial fractions.",
    "5.16": "Integration by substitution and by parts, including repeated parts.",
    "5.17": "Areas against the y-axis and volumes of revolution about either axis.",
    "5.18": "Euler’s method, separable and homogeneous equations, integrating factors.",
    "5.19": "Maclaurin series from derivatives, known series and differential equations.",
  };
  const topic = AA.topics.find((t) => t.n === 5);
  const groups = AA.groups.filter((g) => g.topic === "Calculus").map((g) => ({ ...g, lessons: g.items.map((n) => M.items.find((i) => i.num === n)) }));

  function top(el, onLevel) {
    el.innerHTML = `
      <div class="crumbs"><a href="roadmap-a.html">IB Maths AA notes</a> › Topic 5</div>
      <div class="t-row">
        <div>
          <div class="t-num" style="color:${M.topicInk(5)}">TOPIC 5</div>
          <h1>Calculus</h1>
          <p class="t-meta"></p>
        </div>
        <div class="t-actions"><div class="lvl"></div>
          <a class="btn btn-quiet" href="cheatsheet.html">Calculus cheat sheet</a>
          <a class="btn btn-primary" href="lesson-a.html">Continue: 5.5 →</a></div>
      </div>`;
    const meta = el.querySelector(".t-meta");
    const paint = () => {
      const lvl = M.level(), shown = topic.items.filter((i) => lvl === "HL" || i.level === "SL");
      const qs = groups.filter((g) => lvl === "HL" || !g.hlOnly).reduce((s, g) => s + (lvl === "HL" ? g.count.HL : g.count.SL), 0);
      meta.textContent = `${shown.length} lessons${lvl === "HL" ? " · 8 HL only" : ""} · ${qs} past-paper questions in the ${lvl} bank`;
    };
    M.levelSwitch(el.querySelector(".lvl"), () => { paint(); onLevel(); });
    paint();
  }
  window.TOPIC = { BLURB, topic, groups, top };
})();
