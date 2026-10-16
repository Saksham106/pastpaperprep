import type { NoteTopic } from "@/lib/revision-notes/types";

export const NOTES: NoteTopic = {
  slug: "chemical-energetics",
  topic: "Chemical energetics",
  number: 5,
  title: "IGCSE Chemistry 0620 Chemical Energetics Notes",
  description:
    "IGCSE Chemistry 0620 chemical energetics revision notes: exothermic and endothermic reactions, energy level diagrams, bond energies and exam tips.",
  summary:
    "Chemical energetics is about energy transfer in reactions. Exothermic reactions give out heat to the surroundings and the temperature rises. Endothermic reactions take in heat and the temperature falls. Extended candidates also link this to bond breaking, bond making and activation energy.",
  sections: [
    {
      heading: "Exothermic and endothermic reactions",
      paragraphs: [
        "Every chemical reaction involves a transfer of energy between the reacting chemicals and their surroundings. You can usually detect this with a thermometer.",
      ],
      points: [
        "Exothermic reaction: transfers thermal energy to the surroundings, so the temperature of the surroundings increases.",
        "Endothermic reaction: takes in thermal energy from the surroundings, so the temperature of the surroundings decreases.",
        "Exothermic examples: combustion of fuels, respiration, neutralisation, reactions of metals with acids, and the reaction of water with calcium oxide.",
        "Endothermic examples: thermal decomposition (such as heating calcium carbonate), photosynthesis, and the reaction of citric acid with sodium hydrogencarbonate.",
        "(Extended) The transfer of thermal energy in a reaction is called the enthalpy change, ΔH. It is negative for exothermic reactions and positive for endothermic reactions.",
      ],
    },
    {
      heading: "Reaction pathway diagrams",
      paragraphs: [
        "A reaction pathway (energy level) diagram shows the energy of the reactants on the left and the products on the right. The vertical axis is energy and the horizontal axis is the progress of the reaction.",
      ],
      points: [
        "Exothermic: the products are lower in energy than the reactants, because energy has been given out.",
        "Endothermic: the products are higher in energy than the reactants, because energy has been taken in.",
        "(Extended) Label the reactants, products, ΔH and the activation energy, Ea. ΔH is an arrow between the reactant and product levels: downwards and negative for exothermic, upwards and positive for endothermic.",
        "(Extended) The curve rises from the reactants to a peak and then falls to the products. The height of the peak above the reactants is the activation energy, Ea.",
        "(Extended) Activation energy is the minimum energy that colliding particles must have to react.",
      ],
    },
    {
      heading: "Energy changes in bond breaking and bond making",
      extended: true,
      paragraphs: [
        "In any reaction, bonds in the reactants must be broken and new bonds must form in the products.",
      ],
      points: [
        "Breaking bonds is endothermic: energy must be supplied to pull atoms apart.",
        "Making bonds is exothermic: energy is released when atoms join together.",
        "If more energy is released making bonds than is taken in breaking bonds, the reaction is exothermic overall.",
        "If more energy is taken in breaking bonds than is released making bonds, the reaction is endothermic overall.",
        "Energy change = energy to break bonds minus energy released making bonds. A negative answer means exothermic.",
      ],
    },
    {
      heading: "Calculating energy changes from bond energies",
      extended: true,
      paragraphs: [
        "Bond energies are given in kJ/mol. Add up the bonds broken, add up the bonds made, then subtract.",
        "Worked example: H₂ + Cl₂ → 2HCl. Bonds broken: one H–H (436 kJ/mol) and one Cl–Cl (243 kJ/mol), total 679 kJ/mol. Bonds made: two H–Cl (2 × 432 = 864 kJ/mol). Energy change = 679 − 864 = −185 kJ/mol, so the reaction is exothermic.",
      ],
      points: [
        "Draw out the structures so you can see every bond, including double bonds.",
        "Multiply each bond energy by the number of those bonds in the balanced equation.",
        "Show the working: marks are usually given for each total.",
        "State whether the reaction is exothermic or endothermic from the sign of your answer.",
      ],
    },
  ],
  examTips: [
    "Describe temperature changes in the surroundings: exothermic means the temperature rises, endothermic means it falls. Do not say the reaction itself gets hot or cold without saying which.",
    "On an energy level diagram, check that the products are on the correct side of the reactants before you draw the ΔH arrow.",
    "Include the sign and the unit in bond energy answers, for example −185 kJ/mol.",
    "Use the word 'minimum' when defining activation energy, and say it is the energy needed for a reaction to start.",
    "When interpreting a diagram, compare the heights of the reactants and products first, then decide whether the reaction is exothermic or endothermic.",
  ],
  commonMistakes: [
    "Saying exothermic reactions 'use' energy. They release energy to the surroundings.",
    "Confusing bond breaking and bond making: breaking is endothermic and making is exothermic.",
    "Writing a positive ΔH for an exothermic reaction, or forgetting the sign altogether.",
    "Drawing the activation energy arrow from the reactants to the products instead of from the reactants to the top of the peak.",
    "Forgetting to multiply bond energies by the number of bonds, for example using one H–Cl bond instead of two.",
  ],
};
