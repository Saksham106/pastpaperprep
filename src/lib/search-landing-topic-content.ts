import type { BankSlug } from "@/lib/catalog";

/** Explicit public-topic inventory: labels must match the runtime taxonomy exactly. */
export const CURATED_TOPIC_LANDINGS: Partial<Record<BankSlug, readonly string[]>> = {
  "igcse-biology-0610": ["Inheritance"],
  "igcse-economics-0455": ["Microeconomic decision makers"],
  "igcse-chemistry-0620": ["Atoms, elements and compounds", "Stoichiometry"],
  "igcse-physics-0625": ["Motion, forces and energy"],
  "igcse-coordinated-sciences-0654": ["Motion, forces and energy"],
  "ib-chemistry-hl": ["Matter, amounts and stoichiometry"],
  "ib-chemistry-sl": ["Matter, amounts and stoichiometry"],
  "ib-physics-hl": ["Mechanics and motion"],
  "ib-physics-sl": ["Mechanics and motion"],
  "ib-biology-hl": ["Information, inheritance and evolution"],
  "ib-biology-sl": ["Information, inheritance and evolution"],
  "ib-economics-hl": ["Microeconomics"],
  "ib-economics-sl": ["Microeconomics"],
};

/** Concise guidance tied to the actual topic; no lesson or exam outcome claims. */
export const TOPIC_LANDING_COPY: Record<string, string> = {
  "number": "Practise the core skills every paper leans on: fractions, percentages, ratio, standard form, bounds and time. Show each step, since method marks often survive a slip in arithmetic.",
  "algebra-and-graphs": "Work through expanding, factorising, equations, inequalities and sequences, then link them to graphs and functions. Check each answer by substituting it back into the original expression.",
  "coordinate-geometry": "Practise gradients, midpoints, lengths and equations of straight lines, including parallel and perpendicular lines. Sketch the points first so you can sanity-check the sign and size of your answer.",
  "geometry": "Work through angle properties, polygons, circle theorems, similarity and constructions. Name the property you used for each angle, because the reason is often worth a mark of its own.",
  "mensuration": "Practise perimeter, area, surface area and volume, including arcs, sectors and compound shapes. Keep units visible and convert them before you substitute into a formula.",
  "trigonometry": "Use right-angled trigonometry, Pythagoras, bearings and the sine and cosine rules. Label the sides relative to the angle before choosing a ratio or rule.",
  "transformations-and-vectors": "Practise describing and performing transformations precisely, then work with vector notation, magnitude and geometric proofs. A full description names every detail: centre, angle, direction, scale factor or vector.",
  "probability": "Work through single events, combined events, tree diagrams and conditional probability. Check that the probabilities on each set of branches add up to 1.",
  "statistics": "Practise averages, charts, cumulative frequency, histograms and scatter diagrams. Read the axes and scales carefully before you calculate or interpret anything.",
  "inheritance": "Practise how genetic information is passed on, then connect inheritance questions to variation and selection. Check whether you can interpret a cross or explain a pattern from the evidence given.",
  "organisms-and-their-environment": "Work through feeding relationships, populations and ecosystems, and practise reading ecological data before writing explanations that link cause to effect.",
  "microeconomic-decision-makers": "Focus on how households, workers and firms make choices. Use questions to practise applying incentives, costs and market outcomes to the context rather than reciting definitions alone.",
  "government-and-the-macroeconomy": "Practise linking policy aims and instruments to likely effects on output, prices, employment and the public finances; distinguish the intended outcome from possible trade-offs.",
  "atoms-elements-and-compounds": "Build fluency with particle models, formulae and chemical equations. Check that you can move between a description of particles and the symbols used to represent them.",
  "chemical-reactions": "Practise explaining reaction patterns and representing changes with equations. Compare conditions and observations carefully instead of relying on a memorised reaction label.",
  "motion-forces-and-energy": "Use motion and force questions to connect diagrams, graphs, equations and units. Practise explaining what a calculated quantity means in the physical situation.",
  "electricity-and-magnetism": "Work between circuit diagrams, measurements and electrical relationships, then practise explaining magnetic effects with the direction and conditions made explicit.",
  "stoichiometry": "Start with relative formula masses and balanced equations, then use the mole ratios in those equations to connect reactant and product amounts. Practise showing each step, keeping units consistent, and checking that your final quantity answers the question asked.",
  "matter-amounts-and-stoichiometry": "Practise translating between masses, moles, formulae and balanced equations. Keep units visible and check that each ratio comes from the equation in the question.",
  "bonding-structure-and-materials": "Compare structures and bonding to explain observable properties. Strong answers connect the particle-level model to the material behaviour asked about.",
  "mechanics-and-motion": "Connect kinematics and force models to graphs and free-body reasoning. Check sign conventions, units and whether the result matches the stated motion.",
  "electricity-circuits-and-electromagnetism": "Practise circuit reasoning alongside fields and electromagnetic effects. Draw on the given circuit or field direction rather than applying a relationship without checking its setup.",
  "information-inheritance-and-evolution": "Follow how genetic information relates to inheritance and change in populations; practise interpreting evidence before explaining evolutionary patterns.",
  "populations-ecosystems-and-environmental-change": "Use population and ecosystem data to support explanations of interactions and environmental change, separating a trend in the evidence from a proposed cause.",
  "microeconomics": "Practise applying market models to choices, firms and outcomes. Use the question's context to explain how a change affects participants, not just to name a diagram.",
  "macroeconomics": "Work through aggregate outcomes and policy questions by tracing effects across the economy. Support evaluation with the relevant context, assumptions and trade-offs.",
};

export function topicLandingCopy(slug: string, label: string): string {
  return TOPIC_LANDING_COPY[slug] ?? `Use focused ${label} questions to practise the ideas in context, then return to a mixed set to check whether you can recognise the relevant approach without a topic prompt.`;
}
