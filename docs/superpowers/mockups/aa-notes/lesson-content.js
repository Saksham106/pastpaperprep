// Sample lesson content for the mockups: 5.16 Integration by substitution and parts.
// Drafted for the design review; real lessons go through the full writer → checks → verifier pipeline.
window.LESSON = {
  toc: [
    ["minute", "In a minute"], ["before", "Before you start"], ["parts", "Integration by parts"], ["repeated", "Using parts twice"],
    ["subst", "Substitution"], ["mistakes", "Common mistakes"], ["tips", "Exam tips"], ["takeaways", "Key takeaways"], ["practise", "Practise"],
  ],
  html: String.raw`
<header class="l-head">
  <div class="crumbs"><a href="roadmap-a.html">IB Maths AA notes</a> › <a href="topic-a.html">5 Calculus</a></div>
  <div class="l-badges"><span class="badge badge-ahl">5.16 · AHL · HL only</span><span class="paper">Paper 1</span><span class="paper">Paper 2</span><span class="paper">Paper 3</span></div>
  <h1>Integration by substitution and parts</h1>
  <div class="l-meta">
    <span>Builds on <a href="#">5.10 Indefinite integration</a> and <a href="#">5.15 Extended differentiation</a></span>
    <span>14 min read</span>
  </div>
</header>

<section id="minute" class="minute">
  <h2 class="sr">In a minute</h2>
  <p>Some integrals can't be done by recognising a standard form. Two tools cover most of them. <b>Substitution</b> changes the variable so a messy <button class="term" data-term="integrand">integrand</button> becomes a standard one. <b>Integration by parts</b> undoes the product rule, so you can integrate a product such as $x\mathrm{e}^{x}$ by trading it for an easier integral.</p>
  <aside class="side side-term" data-for="integrand"><b>Integrand</b> The function being integrated: in $\int f(x)\,\mathrm{d}x$ it is $f(x)$. <a href="#">Learn it in 5.5 →</a></aside>
</section>

<section class="goals">
  <h2>You'll be able to</h2>
  <ul>
    <li>Integrate a product with integration by parts, and choose $u$ well.</li>
    <li>Use parts twice, including integrals that come back to where they started.</li>
    <li>Choose and carry out a substitution, rewriting every $x$ and $\mathrm{d}x$ in terms of $u$.</li>
    <li>Change the limits of a <button class="term" data-term="definite">definite integral</button> when you substitute.</li>
  </ul>
  <aside class="side side-term" data-for="definite"><b>Definite integral</b> An integral with limits, $\int_a^b f(x)\,\mathrm{d}x$. Its value is a number, not a function. <a href="#">Learn it in 5.11 →</a></aside>
</section>

<section id="before" class="before">
  <details>
    <summary><span>Before you start</span><small>2 quick questions on what this builds on</small></summary>
    <div class="quiz" data-answer="b">
      <p>1. Differentiate $x\mathrm{e}^{x}$.</p>
      <div class="opts"><button data-k="a">$\mathrm{e}^{x}$</button><button data-k="b">$\mathrm{e}^{x}+x\mathrm{e}^{x}$</button><button data-k="c">$x\mathrm{e}^{x-1}$</button></div>
      <p class="fb" data-ok="Right: the product rule gives $1\cdot\mathrm{e}^x + x\cdot\mathrm{e}^x$." data-no="Not quite. This needs the product rule. Revise it in 5.6 →"></p>
    </div>
    <div class="quiz" data-answer="a">
      <p>2. Find $\int \cos x\,\mathrm{d}x$.</p>
      <div class="opts"><button data-k="a">$\sin x + C$</button><button data-k="b">$-\sin x + C$</button><button data-k="c">$-\cos x + C$</button></div>
      <p class="fb" data-ok="Right." data-no="Not quite. $\frac{\mathrm{d}}{\mathrm{d}x}\sin x = \cos x$, so the answer is $\sin x + C$. Revise it in 5.10 →"></p>
    </div>
  </details>
</section>

<section id="parts">
  <h2>Integration by parts</h2>
  <p>The product rule says $\dfrac{\mathrm{d}}{\mathrm{d}x}(uv) = u\dfrac{\mathrm{d}v}{\mathrm{d}x} + v\dfrac{\mathrm{d}u}{\mathrm{d}x}$. Integrate both sides and rearrange, and you get a rule for integrating a product:</p>
  <div class="formula">
    <div class="f-tag booklet">In the formula booklet</div>
    $$\int u\,\frac{\mathrm{d}v}{\mathrm{d}x}\,\mathrm{d}x = uv - \int v\,\frac{\mathrm{d}u}{\mathrm{d}x}\,\mathrm{d}x$$
  </div>
  <aside class="side side-note"><b>Why it helps</b> You swap one integral for another. It only works if the new one, $\int v\,\frac{\mathrm{d}u}{\mathrm{d}x}\,\mathrm{d}x$, is easier.</aside>
  <p>You choose which factor is $u$ (you will differentiate it) and which is $\dfrac{\mathrm{d}v}{\mathrm{d}x}$ (you will integrate it). Pick $u$ so that differentiating makes it simpler. A polynomial like $x$ or $x^2$ is usually a good $u$, because it shrinks each time you differentiate. The exception is $\ln x$: you can't easily integrate it, so when it appears, it is almost always $u$.</p>

  <div class="interactive" id="parts-area">
    <div class="i-head"><b>See why it works</b><span>Drag the slider</span></div>
    <div class="i-body"><svg viewBox="0 0 360 260" aria-label="Area picture of integration by parts"></svg>
      <div class="i-read">
        <p>For the curve $v = u^2$ from $u=0$ to $u=b$:</p>
        <p><span class="sw a"></span>$\int v\,\mathrm{d}u$ = <output id="ia">2.67</output></p>
        <p><span class="sw b"></span>$\int u\,\mathrm{d}v$ = <output id="ib">5.33</output></p>
        <p>Together they fill the rectangle $b \times b^2$ = <output id="ic">8.00</output>.</p>
        <label class="slider">$b$ <input type="range" min="0.5" max="2.4" step="0.01" value="2"><output id="iv">2.00</output></label>
        <p class="small">That is $uv = \int v\,\mathrm{d}u + \int u\,\mathrm{d}v$, the same rule rearranged.</p>
      </div>
    </div>
  </div>

  <div class="example">
    <div class="ex-head"><b>Worked example 1</b><span>Find $\displaystyle\int x\,\mathrm{e}^{2x}\,\mathrm{d}x$.</span></div>
    <p class="try">Try it first, then reveal one step at a time.</p>
    <ol class="steps">
      <li>Let $u = x$, so $\dfrac{\mathrm{d}u}{\mathrm{d}x} = 1$. Let $\dfrac{\mathrm{d}v}{\mathrm{d}x} = \mathrm{e}^{2x}$, so $v = \tfrac12\mathrm{e}^{2x}$.</li>
      <li>Apply the formula: $\displaystyle\int x\,\mathrm{e}^{2x}\,\mathrm{d}x = \tfrac12 x\,\mathrm{e}^{2x} - \int \tfrac12\mathrm{e}^{2x}\,\mathrm{d}x$.</li>
      <li>The new integral is standard: $\displaystyle\int \tfrac12\mathrm{e}^{2x}\,\mathrm{d}x = \tfrac14\mathrm{e}^{2x}$.</li>
      <li class="ans">$\displaystyle\int x\,\mathrm{e}^{2x}\,\mathrm{d}x = \tfrac12 x\,\mathrm{e}^{2x} - \tfrac14\mathrm{e}^{2x} + C$</li>
    </ol>
    <div class="ex-ctrl"><button class="btn btn-quiet next">Show next step</button><button class="link all">Show all</button></div>
    <p class="check-tip">Check: differentiate your answer. $\tfrac12\mathrm{e}^{2x} + x\mathrm{e}^{2x} - \tfrac12\mathrm{e}^{2x} = x\mathrm{e}^{2x}$ ✓</p>
  </div>

  <div class="selfcheck quiz" data-answer="c">
    <div class="sc-head">Check yourself</div>
    <p>Find $\displaystyle\int \ln x\,\mathrm{d}x$. <button class="link hint">Hint</button></p>
    <p class="hint-text" hidden>Write it as $\int \ln x \cdot 1\,\mathrm{d}x$ and take $u = \ln x$.</p>
    <div class="opts"><button data-k="a">$\dfrac{1}{x} + C$</button><button data-k="b">$x\ln x + C$</button><button data-k="c">$x\ln x - x + C$</button><button data-k="d">$\tfrac12(\ln x)^2 + C$</button></div>
    <p class="fb" data-ok="Correct. $u=\ln x$, $v=x$ gives $x\ln x - \int x\cdot\frac1x\,\mathrm{d}x = x\ln x - x + C$." data-no="Not quite. Use $u = \ln x$ and $\frac{\mathrm{d}v}{\mathrm{d}x} = 1$, so $v = x$."></p>
  </div>
</section>

<section id="repeated">
  <h2>Using parts twice</h2>
  <p>Sometimes the new integral still needs parts. With $x^2\mathrm{e}^{x}$ you apply it twice, and $x^2$ drops to $x$, then to $1$. With $\mathrm{e}^{x}\sin x$ nothing ever simplifies. After two rounds the original integral <em>comes back</em>, and you solve for it like an unknown.</p>
  <div class="example">
    <div class="ex-head"><b>Worked example 2</b><span>Find $\displaystyle I = \int \mathrm{e}^{x}\sin x\,\mathrm{d}x$.</span></div>
    <p class="try">Try it first, then reveal one step at a time.</p>
    <ol class="steps">
      <li>Parts with $u=\sin x$, $\dfrac{\mathrm{d}v}{\mathrm{d}x}=\mathrm{e}^{x}$: $\;I = \mathrm{e}^{x}\sin x - \displaystyle\int \mathrm{e}^{x}\cos x\,\mathrm{d}x$.</li>
      <li>Parts again with $u=\cos x$, $\dfrac{\mathrm{d}v}{\mathrm{d}x}=\mathrm{e}^{x}$: $\;\displaystyle\int \mathrm{e}^{x}\cos x\,\mathrm{d}x = \mathrm{e}^{x}\cos x + \int \mathrm{e}^{x}\sin x\,\mathrm{d}x = \mathrm{e}^{x}\cos x + I$.</li>
      <li>Substitute back: $I = \mathrm{e}^{x}\sin x - \mathrm{e}^{x}\cos x - I$, so $2I = \mathrm{e}^{x}(\sin x - \cos x)$.</li>
      <li class="ans">$\displaystyle\int \mathrm{e}^{x}\sin x\,\mathrm{d}x = \tfrac12\mathrm{e}^{x}(\sin x - \cos x) + C$</li>
    </ol>
    <div class="ex-ctrl"><button class="btn btn-quiet next">Show next step</button><button class="link all">Show all</button></div>
  </div>
  <aside class="side side-note"><b>Keep the same choice</b> In the second round, make the trig function $u$ again. If you switch and make $\mathrm{e}^x$ the $u$, you undo the first step and get $I = I$.</aside>
</section>

<section id="subst">
  <h2>Substitution</h2>
  <p>In 5.10 you met integrals where the derivative of the inside is already there, like $\int 2x\cos(x^2)\,\mathrm{d}x$. At HL you also substitute when it isn't. The method:</p>
  <ol class="method">
    <li>Choose $u$, often the inside of a bracket, root or power.</li>
    <li>Find $\dfrac{\mathrm{d}u}{\mathrm{d}x}$ and rewrite $\mathrm{d}x$ in terms of $\mathrm{d}u$.</li>
    <li>Rewrite <em>every</em> $x$ in terms of $u$, then integrate.</li>
    <li>For a definite integral, change the limits to $u$-values. For an indefinite one, substitute back.</li>
  </ol>
  <div class="example">
    <div class="ex-head"><b>Worked example 3</b><span>Find the exact value of $\displaystyle\int_0^3 x\sqrt{x+1}\,\mathrm{d}x$.</span></div>
    <p class="try">Try it first, then reveal one step at a time.</p>
    <ol class="steps">
      <li>Let $u = x+1$. Then $\mathrm{d}u = \mathrm{d}x$ and $x = u-1$.</li>
      <li>Change the limits: $x=0 \Rightarrow u=1$, and $x=3 \Rightarrow u=4$.</li>
      <li>$\displaystyle\int_1^4 (u-1)\,u^{1/2}\,\mathrm{d}u = \int_1^4 \left(u^{3/2} - u^{1/2}\right)\mathrm{d}u = \Big[\tfrac25u^{5/2} - \tfrac23u^{3/2}\Big]_1^4$</li>
      <li>$= \left(\tfrac{64}{5} - \tfrac{16}{3}\right) - \left(\tfrac25 - \tfrac23\right) = \tfrac{62}{5} - \tfrac{14}{3}$</li>
      <li class="ans">$\displaystyle\int_0^3 x\sqrt{x+1}\,\mathrm{d}x = \tfrac{116}{15}$</li>
    </ol>
    <div class="ex-ctrl"><button class="btn btn-quiet next">Show next step</button><button class="link all">Show all</button></div>
  </div>
  <aside class="side side-calc"><b>Check on your calculator</b> On Paper 2, check a definite integral numerically ($\tfrac{116}{15} \approx 7.733$).
    <span class="calc-tabs"><button aria-pressed="true">TI-84</button><button>TI-Nspire</button><button>Casio</button></span>
    <span class="calc-steps">MATH → fnInt( → enter X√(X+1), X, 0, 3</span></aside>
</section>

<section id="mistakes">
  <h2>Common mistakes</h2>
  <ul class="mistakes">
    <li><b>Losing the minus sign.</b> It is $uv \,-\, \int v\,\frac{\mathrm{d}u}{\mathrm{d}x}\,\mathrm{d}x$. In the second round of repeated parts the signs flip again, so bracket the whole integral.</li>
    <li><b>Leaving an $x$ behind.</b> After substituting, no $x$ and no $\mathrm{d}x$ may remain.</li>
    <li><b>Keeping the old limits.</b> Either change the limits to $u$-values, or substitute back before using the $x$ limits. Mixing the two loses the accuracy marks.</li>
    <li><b>Dropping $+\,C$</b> on an indefinite integral. Mark schemes often take a mark for it.</li>
  </ul>
</section>

<section id="tips">
  <h2>Exam tips</h2>
  <ul class="tips">
    <li><b>“Use integration by parts”</b> means a method mark for a correct $u$, $v$ and formula, even if the algebra slips later. Write those three things down clearly.</li>
    <li><b>“Show that”</b> with an exact answer means no calculator: every line must be there. You can still check the number on your calculator.</li>
    <li><b>“Hence”</b> means use the result you just found, usually as the $u$ or the substitution.</li>
  </ul>
</section>

<section id="takeaways" class="takeaways">
  <h2>Key takeaways</h2>
  <div class="tk-grid">
    <div><span class="f-tag booklet">In booklet</span>$\int u\frac{\mathrm{d}v}{\mathrm{d}x}\mathrm{d}x = uv - \int v\frac{\mathrm{d}u}{\mathrm{d}x}\mathrm{d}x$</div>
    <div><span class="f-tag learn">Learn this</span>Choose $u$ that gets simpler when differentiated; $\ln x$ is always $u$.</div>
    <div><span class="f-tag learn">Learn this</span>If the integral comes back after two rounds, solve for it.</div>
    <div><span class="f-tag learn">Learn this</span>Substitute everything: $x$, $\mathrm{d}x$ and the limits.</div>
  </div>
</section>

<section id="practise" class="practise">
  <div>
    <h2>Practise this</h2>
    <p><b>6 past-paper questions</b> on 5.16 in the AA HL bank, each with a mark scheme and a worked explanation.</p>
  </div>
  <a class="btn btn-primary" href="#">Practise 5.16 →</a>
</section>

<footer class="l-foot">
  <button class="btn got">I've got this ✓</button>
  <div class="pn"><a href="#">← 5.15 Extended differentiation</a><a href="#">5.17 Areas and volumes of revolution →</a></div>
  <p class="report">Something wrong or unclear? <button class="link">Report a problem</button> or email <span>hello@pastpaperprep.com</span></p>
</footer>
`,
};

// Shared lesson behaviour.
window.initLesson = function (opts) {
  const root = document.getElementById("lesson");
  root.innerHTML = window.LESSON.html;
  renderMathInElement(root, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });

  // Worked examples: reveal step by step.
  root.querySelectorAll(".example").forEach((ex) => {
    const steps = [...ex.querySelectorAll(".steps li")];
    let shown = opts.stepsShown ?? 1;
    const tip = ex.querySelector(".check-tip");
    const paint = () => { steps.forEach((s, i) => (s.hidden = i >= shown)); ex.querySelector(".ex-ctrl").hidden = shown >= steps.length; if (tip) tip.hidden = shown < steps.length; };
    ex.querySelector(".next").addEventListener("click", () => { shown++; paint(); });
    ex.querySelector(".all").addEventListener("click", () => { shown = steps.length; paint(); });
    paint();
  });
  // Quizzes.
  root.querySelectorAll(".quiz").forEach((q) => {
    const fb = q.querySelector(".fb");
    q.querySelectorAll(".opts button").forEach((b) => b.addEventListener("click", () => {
      const ok = b.dataset.k === q.dataset.answer;
      q.querySelectorAll(".opts button").forEach((x) => x.classList.remove("right", "wrong"));
      b.classList.add(ok ? "right" : "wrong");
      fb.innerHTML = ok ? fb.dataset.ok : fb.dataset.no; fb.className = "fb " + (ok ? "ok" : "no");
      renderMathInElement(fb, { delimiters: [{ left: "$", right: "$", display: false }] });
    }));
    const h = q.querySelector(".hint"); if (h) h.addEventListener("click", () => (q.querySelector(".hint-text").hidden = false));
  });
  // Calculator tabs.
  const CALC = { "TI-84": "MATH → fnInt( → enter X√(X+1), X, 0, 3", "TI-Nspire": "Menu → Calculus → Numerical Integral → lower 0, upper 3, then x√(x+1)", "Casio": "RUN-MAT → OPTN → CALC → ∫dx → enter X√(X+1), 0, 3" };
  root.querySelectorAll(".calc-tabs button").forEach((b, _, all) => b.addEventListener("click", () => {
    all.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    b.closest(".side-calc").querySelector(".calc-steps").textContent = CALC[b.textContent];
  }));
  // Glossary terms: popover (option A) or margin highlight (option B).
  root.querySelectorAll(".term").forEach((t) => t.addEventListener("click", () => opts.onTerm(t)));
  // Interactive: area picture of integration by parts, v = u^2.
  const ia = root.querySelector("#parts-area");
  if (ia) {
    const svg = ia.querySelector("svg"), input = ia.querySelector("input");
    const X0 = 40, Y0 = 230, SX = 120, SY = 34;
    const draw = () => {
      const b = +input.value, pts = [];
      for (let k = 0; k <= 60; k++) { const u = (b * k) / 60; pts.push([X0 + u * SX, Y0 - u * u * SY]); }
      const curve = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
      const bx = X0 + b * SX, by = Y0 - b * b * SY;
      svg.innerHTML = `
        <path d="${curve} L${bx} ${Y0} L${X0} ${Y0} Z" fill="var(--t1)" />
        <path d="${curve} L${X0} ${by} Z" fill="var(--t5)" />
        <rect x="${X0}" y="${by}" width="${bx - X0}" height="${Y0 - by}" fill="none" stroke="var(--ink-soft)" stroke-dasharray="4 4"/>
        <path d="${curve}" fill="none" stroke="var(--ink)" stroke-width="2.5"/>
        <line x1="${X0}" y1="${Y0}" x2="350" y2="${Y0}" stroke="var(--muted)"/><line x1="${X0}" y1="${Y0}" x2="${X0}" y2="10" stroke="var(--muted)"/>
        <text x="345" y="${Y0 + 18}" font-size="13" fill="var(--muted)" text-anchor="end" font-style="italic">u</text>
        <text x="${X0 - 12}" y="18" font-size="13" fill="var(--muted)" font-style="italic">v</text>
        <text x="${bx}" y="${Y0 + 18}" font-size="12" fill="var(--ink)" text-anchor="middle">b</text>
        <text x="${X0 - 8}" y="${by + 4}" font-size="12" fill="var(--ink)" text-anchor="end">b²</text>`;
      ia.querySelector("#iv").textContent = b.toFixed(2);
      ia.querySelector("#ia").textContent = ((b ** 3) / 3).toFixed(2);
      ia.querySelector("#ib").textContent = ((2 * b ** 3) / 3).toFixed(2);
      ia.querySelector("#ic").textContent = (b ** 3).toFixed(2);
    };
    input.addEventListener("input", draw); draw();
  }
  // Got it.
  const got = root.querySelector(".got");
  got.addEventListener("click", () => { got.textContent = "Understood ✓ Saved on this device"; got.classList.add("done"); });
};
