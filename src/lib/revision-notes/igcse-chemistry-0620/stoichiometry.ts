import type { NoteTopic } from "@/lib/revision-notes/types";

export const NOTES: NoteTopic = {
  slug: "stoichiometry",
  topic: "Stoichiometry",
  number: 3,
  title: "IGCSE Chemistry 0620 Stoichiometry Revision Notes",
  description:
    "IGCSE Chemistry 0620 stoichiometry revision notes: formulae, balancing equations, Ar and Mr, the mole, gas volumes, concentration and yield.",
  summary:
    "Stoichiometry is the quantitative side of chemistry: writing correct formulae, balancing equations and using moles to link masses, gas volumes and concentrations. Nearly every calculation follows the same route: convert to moles, use the equation ratio, then convert to the quantity asked for.",
  sections: [
    {
      heading: "Formulae and equations",
      points: [
        "The molecular formula of a compound shows the number and type of each atom in one molecule, for example C₂H₆ or H₂O.",
        "You can deduce a formula by counting the atoms of each element in a model or diagram.",
        "Word equations use names, for example magnesium + oxygen → magnesium oxide. Symbol equations use formulae and must be balanced.",
        "Balance equations by changing the numbers in front of formulae, never the small numbers inside them. Check that each element has the same number of atoms on both sides.",
        "State symbols: (s) solid, (l) liquid, (g) gas, (aq) aqueous solution.",
        "(Extended) The empirical formula is the simplest whole-number ratio of the different atoms or ions in a compound. The empirical formula of C₂H₆ is CH₃.",
        "(Extended) Deduce the formula of an ionic compound by balancing the charges: Mg²⁺ and Cl⁻ give MgCl₂, Al³⁺ and O²⁻ give Al₂O₃. Know the common ions: NO₃⁻, OH⁻, SO₄²⁻, CO₃²⁻, NH₄⁺, H⁺, Cu²⁺, Fe²⁺, Fe³⁺, Zn²⁺.",
        "(Extended) Ionic equations show only the ions that change. Remove spectator ions. Example: Ag⁺(aq) + Cl⁻(aq) → AgCl(s).",
      ],
    },
    {
      heading: "Relative masses of atoms and molecules",
      points: [
        "Relative atomic mass, Ar, is the average mass of the isotopes of an element compared with 1/12th of the mass of an atom of carbon-12.",
        "Relative molecular mass, Mr, is the sum of the Ar values of all the atoms in the formula. For ionic compounds it is called relative formula mass.",
        "Example: Mr of CaCO₃ = 40 + 12 + (3 × 16) = 100. Ar and Mr have no units.",
        "Reacting masses in simple proportions: from 2Mg + O₂ → 2MgO, 48 g of magnesium gives 80 g of magnesium oxide, so 12 g gives 20 g. No moles are needed at this level.",
      ],
    },
    {
      heading: "The mole and the Avogadro constant",
      points: [
        "Concentration can be measured in g/dm³ or mol/dm³.",
      ],
    },
    {
      heading: "Mole calculations",
      extended: true,
      points: [
        "One mole is the amount of substance that contains 6.02 × 10²³ particles (atoms, molecules or ions). This number is the Avogadro constant.",
        "Molar mass is the mass of one mole in g/mol and is numerically equal to Ar or Mr.",
        "Core equation: moles = mass (g) ÷ molar mass (g/mol). Rearrange it to find mass, molar mass, or Ar or Mr.",
        "Number of particles = moles × 6.02 × 10²³.",
        "Reacting masses: write the balanced equation, find moles of the known substance, use the equation ratio to find moles of the other, then convert to mass.",
        "Gas volumes: one mole of any gas occupies 24 dm³ at room temperature and pressure (r.t.p.). Moles of gas = volume (dm³) ÷ 24. For cm³, divide by 24 000.",
        "Concentration: moles = concentration (mol/dm³) × volume (dm³). To convert cm³ to dm³, divide by 1000.",
        "Concentration in g/dm³ = mass of solute (g) ÷ volume (dm³). Convert between g/dm³ and mol/dm³ using the molar mass.",
        "Limiting reactant: find the moles of each reactant and divide by its coefficient in the equation. The smaller result is the limiting reactant. It is used up first and decides how much product forms.",
        "Titration calculations: use the volume and concentration of one solution to find moles, use the equation ratio, then find the unknown concentration or volume.",
        "Empirical formula: divide each mass (or percentage) by its Ar, then divide all by the smallest answer. If a ratio such as 1.5 appears, multiply all by 2.",
        "Molecular formula = empirical formula × n, where n = Mr of the compound ÷ Mr of the empirical formula.",
        "Percentage yield = (actual yield ÷ theoretical yield) × 100.",
        "Percentage purity = (mass of pure substance ÷ mass of impure sample) × 100.",
        "Percentage composition by mass of an element = (Ar × number of atoms ÷ Mr) × 100.",
      ],
    },
  ],
  examTips: [
    "Show every step. Method marks are available even if the final answer is wrong, and Cambridge expects units with the answer.",
    "Always start from a balanced equation and underline the two substances in the question. The ratio from the equation links them.",
    "Check the units before calculating: mass in g, volume in dm³ for concentration, and 24 dm³ (or 24 000 cm³) for gases at r.t.p.",
    "Give final answers to a sensible number of significant figures, usually the same as the data in the question or 3 s.f.",
    "Use the Periodic Table for Ar values and do not round them early. Mr of Cl₂ uses 35.5, not 35.",
  ],
  commonMistakes: [
    "Changing the small subscripts in a formula to balance an equation. Only the large numbers in front can be changed.",
    "Forgetting to convert cm³ to dm³ when using concentration, or using 24 dm³ with a gas volume given in cm³.",
    "Using the mass ratio instead of the mole ratio from the equation.",
    "Calculating Mr of a compound with brackets wrongly, for example Ca(OH)₂ is 40 + 2 × (16 + 1) = 74.",
    "Writing the limiting reactant as the one with the smaller mass, instead of comparing moles and coefficients.",
  ],
};
