# Review errata: what owner reviews caught after our pipeline

Every verifier, topic pass and extracts audit reads this list and checks the course against each rule that applies.
Add a line whenever a review finds a new class of error. Each line is the general rule, then where it was caught.

## Rules a lesson's own wording broke

1. **A standalone line keeps the conditions the lesson states.** Cheat-sheet facts, glossary definitions, takeaways, exam tips and command-term examples are read on their own. Most review findings were one of these dropping a condition the body had:
   - "positive second derivative means minimum" needs "at a stationary point" (0580 2.12);
   - ΔS = Q/T needs a reversible transfer, not just constant T (Physics 2.10);
   - PV^γ = constant needs a reversible adiabatic process of an ideal gas, not just "no heat flow" (Physics 2.11);
   - ε = BvL needs rod, velocity and field mutually perpendicular (Physics 4.9);
   - "take moments about the support" must be the *other* unknown support (Physics 1.12).
2. **Percentage error uses the accepted value's magnitude.** Agreement means |x − x_ref| ≤ Δx. Never compare a % error with a % uncertainty that has a different denominator (Chemistry 7.2, Physics 6.3).
3. **A rule's direction claim needs its scope.** Euler's method over/under-estimates by concavity only for one step from a point on the curve, or for small steps (AA 5.18). An indicator suits a titration when its range lies in the steep part of the curve, not only when it contains the equivalence pH (Chemistry 6.6).
4. **One arbitrary constant fixes one condition only on a connected domain** (AA 5.5).
5. **Cancel common factors fully before calling a root a hole or an asymptote** (AA 2.13).
6. **One parameter per free unknown** in an infinite solution set (AA 1.16).
7. **Statistics examples obey their own conventions.** Rounding a stratified sample can't give a negative stratum (use floor + largest remainders); a box-plot whisker stops at the last value inside the fences (AA 4.1, 4.2).
8. **Choose a model from the stated relationship, not from the data's direction.** "y falls as x grows" doesn't make it inverse proportion (0580 2.8).
9. **An explanation's arithmetic matches its own numbers.** Average speed, stage times and the like are recomputed, not described (0580 1.12).
10. **Graph-reading answers accept a range** (`verify.reading`), never one exact integer (0580 9.6).
11. **Graphs: name the axes.** Impulse is the area under force–time, not momentum–time (Physics 6.4).
12. **Logarithmic readings are not subtracted directly.** Convert dB to intensity first (Physics 6.1).
13. **Average versus individual values.** An average oxidation state isn't any one atom's (Chemistry 3.3).
14. **Signs follow the definition the lesson gives.** If Δλ is observed minus emitted, a receding source has positive Δλ and negative Δf (Physics 3.9).
15. **Speed versus acceleration in analogies.** Steepest slope gives the greatest acceleration, not the greatest speed (Physics 4.2).
16. **Command-term examples are correct physics or maths too.** "No resultant force, so constant momentum, so no change in velocity" (Physics command terms).

19. **Rounding a number of periods depends on the question.** Up to reach a target, down to count full payments or withdrawals the money covers (AI 1.7).
20. **A graph's excluded end is an open circle only when the function has a finite value there.** Otherwise it is an asymptote (AI 2.3).
21. **Systematic sampling with k = ⌊N/n⌋ never picks the end of the list** when n doesn't divide N (AI 4.1).
22. **Candidates for turning points and inflexions include where f′ or f″ is undefined but f exists** (x^(2/3), x^(5/3)), once fractional powers are taught (AI 5.2, 5.10).
23. **s_{n−1}² is unbiased for σ²; s_{n−1} is not exactly unbiased for σ** (AI 4.16).

## Rules for the answer gate

17. **Every new answer kind gets mutation tests before it ships.** Each review of a new gate found 3–4 holes: containment instead of equivalence, sample points instead of proof, a zero factor accepted, denominator exclusions dropped, `+ C` erased, an isomer accepted by composition (AA, 0580, Chemistry).
18. **Numeric checks must not accept 0 for a tiny answer, and must parse standard form.** The browser check scales its tolerance and reads 1.5e24 or 1.5×10^24 (Physics, fixed in the component).
24. **A sidecar reads the whole answer, not just the parts it extracts.** Matrix sidecars ignored a scalar written before the matrix (½ × the right inverse passed; 0 × an eigenvector passed) and erased a `+ C`. Use `mathparse.parse_matrices`, and `keep_constant()` anywhere that isn't an antiderivative (AI 1.14, 1.15, 3.9, 3.15, 4.19).
