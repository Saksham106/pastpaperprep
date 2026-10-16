import type { NoteTopic } from "@/lib/revision-notes/types";

export const NOTES: NoteTopic = {
  slug: "chemical-reactions",
  topic: "Chemical reactions",
  number: 6,
  title: "IGCSE Chemistry 0620 Chemical Reactions Notes",
  description:
    "IGCSE Chemistry 0620 chemical reactions notes: rate of reaction, reversible reactions, equilibrium, Haber and Contact processes and redox.",
  summary:
    "Chemical reactions form new substances, unlike physical changes. Reaction rate depends on concentration, pressure, temperature, surface area and catalysts, and Extended candidates explain this with collision theory. Some reactions are reversible and reach equilibrium, and redox reactions involve gain or loss of oxygen or electrons.",
  sections: [
    {
      heading: "Physical and chemical changes",
      points: [
        "Physical change: no new substance forms, and the change is usually easy to reverse. Examples are melting, boiling, dissolving and mixing.",
        "Chemical change: one or more new substances form, and it is usually hard to reverse.",
        "Signs of a chemical change include a colour change, gas given off, a precipitate forming, and a temperature change.",
      ],
    },
    {
      heading: "Rate of reaction",
      paragraphs: [
        "Rate is how fast reactants are used up or products are made.",
      ],
      points: [
        "Increasing the concentration of a solution, the pressure of a gas, the surface area of a solid (smaller pieces or powder) or the temperature increases the rate.",
        "A catalyst, including an enzyme, increases the rate of a reaction and is unchanged at the end. Enzymes are biological catalysts.",
        "Practical methods: measure the volume of gas given off over time, or the loss in mass of a flask as a gas escapes.",
        "On a graph of product against time, a steeper line means a faster rate. The line levels off when a reactant is used up.",
        "Rate experiments need a fair test: change one variable and keep the others the same.",
        "(Extended) Collision theory: a reaction happens when particles collide with at least the activation energy, Ea. A faster rate means more successful collisions per second.",
        "(Extended) Higher concentration or pressure: more particles per unit volume, so more frequent collisions.",
        "(Extended) Larger surface area: more particles exposed, so more frequent collisions.",
        "(Extended) Higher temperature: particles have more kinetic energy and move faster, so collisions are more frequent and a greater proportion have energy equal to or above Ea.",
        "(Extended) A catalyst provides an alternative pathway with a lower activation energy.",
        "(Extended) Evaluating methods: a gas syringe measures volume precisely, but collecting over water can lose soluble gas. Mass-loss readings are small for light gases such as hydrogen.",
      ],
    },
    {
      heading: "Reversible reactions and equilibrium",
      paragraphs: [
        "A reversible reaction can go both ways, shown by the symbol ⇌. Heating hydrated copper(II) sulfate drives off water and turns blue crystals white. Adding water to the white anhydrous solid turns it blue again: CuSO₄·5H₂O ⇌ CuSO₄ + 5H₂O.",
        "Heating pink hydrated cobalt(II) chloride gives blue anhydrous cobalt(II) chloride. Adding water turns it pink again.",
      ],
      points: [
        "(Extended) In a closed system, a reversible reaction is at equilibrium when the rate of the forward reaction equals the rate of the reverse reaction. The concentrations of reactants and products stay constant, but the reactions have not stopped.",
        "(Extended) Raising the temperature moves the position of equilibrium in the endothermic direction. Lowering it favours the exothermic direction.",
        "(Extended) Raising the pressure favours the side with fewer gas molecules. Lowering it favours the side with more.",
        "(Extended) Increasing the concentration of a reactant moves the position towards the products.",
        "(Extended) A catalyst does not change the position of equilibrium. It only helps equilibrium to be reached faster.",
      ],
    },
    {
      heading: "The Haber and Contact processes",
      extended: true,
      points: [
        "Haber process: N₂(g) + 3H₂(g) ⇌ 2NH₃(g). Hydrogen comes from methane and nitrogen comes from the air.",
        "Haber conditions: 450 °C, 20 000 kPa (200 atm) and an iron catalyst.",
        "Contact process (sulfur dioxide to sulfur trioxide): 2SO₂(g) + O₂(g) ⇌ 2SO₃(g). Sulfur dioxide comes from burning sulfur or roasting sulfide ores, and oxygen comes from the air.",
        "Contact conditions: 450 °C, 200 kPa (2 atm) and a vanadium(V) oxide catalyst.",
        "Both forward reactions are exothermic and produce fewer gas molecules. A low temperature would give a higher yield but too slow a rate, so 450 °C is a compromise, and the catalyst speeds up the reaction.",
        "High pressure raises the yield and rate, but costs more and is a safety risk. In the Haber process the gain is worth it. In the Contact process the yield is already high at about 2 atm, so more pressure is not needed.",
      ],
    },
    {
      heading: "Redox",
      paragraphs: [
        "Oxidation and reduction always happen together, so reactions involving both are called redox reactions.",
      ],
      points: [
        "Oxidation is gain of oxygen. Reduction is loss of oxygen.",
        "A Roman numeral shows the oxidation number of an element in a compound. In iron(III) oxide, iron has oxidation number +3.",
        "Example: in CuO + H₂ → Cu + H₂O, copper oxide is reduced and hydrogen is oxidised.",
        "(Extended) Oxidation is loss of electrons or an increase in oxidation number. Reduction is gain of electrons or a decrease in oxidation number (OIL RIG).",
        "(Extended) Oxidation number rules: uncombined elements are 0, a monatomic ion has the same number as its charge, and the numbers add up to 0 in a compound or to the charge in an ion.",
        "(Extended) An oxidising agent oxidises another substance and is itself reduced. A reducing agent reduces another substance and is itself oxidised.",
        "(Extended) Test for a reducing agent: acidified aqueous potassium manganate(VII) changes from purple to colourless.",
        "(Extended) Test for an oxidising agent: aqueous potassium iodide changes from colourless to brown as iodine forms.",
      ],
    },
  ],
  examTips: [
    "For rate questions, give the full collision theory chain: more frequent collisions (or more particles with enough energy) means a faster rate. 'More collisions' alone often loses marks.",
    "For temperature, mention both the greater frequency of collisions and the greater proportion of particles with energy above the activation energy.",
    "When asked about equilibrium, say the rates of the forward and reverse reactions are equal, not that the amounts of reactants and products are equal.",
    "In redox questions, name the substance that is oxidised or reduced, not just the process.",
    "Quote the colour change for the redox tests, for example purple to colourless.",
  ],
  commonMistakes: [
    "Saying a catalyst increases the energy of the particles. It lowers the activation energy by giving another route.",
    "Claiming that the reaction has stopped at equilibrium. Both reactions continue at equal rates.",
    "Describing the effect of concentration as 'the particles move faster'. It only increases how often they collide.",
    "Mixing up the oxidising and reducing agent: the oxidising agent is the one that gets reduced.",
    "Forgetting that a reaction rate graph levels off because a reactant has run out, not because the rate has been slowed by something else.",
  ],
};
