import type { NoteTopic } from "@/lib/revision-notes/types";

export const NOTES: NoteTopic = {
  slug: "experimental-techniques-and-chemical-analysis",
  topic: "Experimental techniques and chemical analysis",
  number: 12,
  title: "IGCSE Chemistry 0620 Practical and Analysis Notes",
  description:
    "IGCSE Chemistry 0620 experimental techniques and analysis notes: apparatus, titration, chromatography, separation methods and tests for ions and gases.",
  summary:
    "Practical chemistry means choosing apparatus, measuring accurately and separating or identifying substances. Learn the separation methods, how to read a chromatogram, and the standard tests for cations, anions and gases.",
  sections: [
    {
      heading: "Experimental design",
      points: [
        "Apparatus: stop-watch (time), thermometer (temperature), balance (mass), and burette, volumetric pipette, measuring cylinder and gas syringe (volume). A burette, pipette or gas syringe is more accurate than a measuring cylinder.",
        "Compare methods by their advantages and disadvantages, such as accuracy, speed, cost and how much gas or heat is lost.",
        "A solvent dissolves a solute. A solution is a mixture of one or more solutes dissolved in a solvent. A saturated solution contains the maximum concentration of solute at a specified temperature.",
        "A residue is what remains after evaporation, distillation, filtration or a similar process. A filtrate is the liquid or solution that has passed through a filter.",
      ],
    },
    {
      heading: "Acid–base titrations",
      points: [
        "A titration finds the volume of one solution needed to react exactly with a fixed volume of another.",
        "Method: use a volumetric pipette to put the alkali in a flask, add a few drops of a suitable indicator, then add acid from the burette, swirling, until the indicator changes colour. This is the end-point.",
        "Methyl orange is red in acid and yellow in alkali. Thymolphthalein is colourless in acid and blue in alkali.",
        "Repeat until results agree closely, then use the mean titre.",
      ],
    },
    {
      heading: "Chromatography",
      points: [
        "Paper chromatography separates mixtures of soluble coloured substances using a suitable solvent.",
        "Draw the start line in pencil, because ink would dissolve and run. Keep the start line above the solvent level.",
        "Substances more soluble in the solvent travel further up the paper.",
        "A pure substance gives one spot and a mixture gives more than one. An unknown is identified by matching its spot with known substances run alongside it.",
        "(Extended) Colourless substances are made visible using a locating agent, then separated in the same way.",
        "(Extended) Rf = distance travelled by the substance ÷ distance travelled by the solvent. Rf has no units and is between 0 and 1.",
      ],
    },
    {
      heading: "Separation and purification",
      points: [
        "Using a suitable solvent dissolves one component of a mixture so that it can be separated from the others.",
        "Filtration separates an insoluble solid from a liquid.",
        "Crystallisation obtains a soluble solid from its solution: heat to evaporate some solvent, cool so crystals form, then filter and dry.",
        "Simple distillation separates a solvent from a solution, such as pure water from salt water.",
        "Fractional distillation separates liquids with different boiling points, such as ethanol from water, using a fractionating column.",
        "Choose the technique from the properties of the substances: solubility, state and boiling point.",
        "A pure substance has a sharp, fixed melting point and boiling point. Impurities lower the melting point and raise the boiling point.",
      ],
    },
    {
      heading: "Tests for anions",
      points: [
        "Carbonate: add dilute acid, then test the gas. Carbon dioxide turns limewater milky.",
        "Chloride, bromide, iodide: acidify with dilute nitric acid, then add aqueous silver nitrate. Chloride gives a white precipitate, bromide a cream precipitate and iodide a yellow precipitate.",
        "Nitrate: add aqueous sodium hydroxide, then aluminium foil, and warm carefully. Ammonia gas is produced.",
        "Sulfate: acidify with dilute nitric acid, then add aqueous barium nitrate. A white precipitate forms.",
        "Sulfite: add acidified aqueous potassium manganate(VII). It changes from purple to colourless.",
      ],
    },
    {
      heading: "Tests for cations",
      points: [
        "With aqueous sodium hydroxide: Al³⁺ white precipitate, soluble in excess to a colourless solution. Ca²⁺ white precipitate, insoluble in excess. Cr³⁺ green precipitate, soluble in excess. Cu²⁺ light blue precipitate, insoluble in excess.",
        "Also with sodium hydroxide: Fe²⁺ green precipitate, insoluble in excess, turning brown near the surface on standing. Fe³⁺ red-brown precipitate, insoluble in excess. Zn²⁺ white precipitate, soluble in excess to a colourless solution.",
        "With aqueous ammonia: Al³⁺ white precipitate, insoluble in excess. Ca²⁺ no precipitate or a very slight white one. Cr³⁺ green precipitate, insoluble in excess. Cu²⁺ light blue precipitate, soluble in excess to a dark blue solution.",
        "Also with ammonia: Fe²⁺ green precipitate, turning brown near the surface. Fe³⁺ red-brown precipitate, insoluble in excess. Zn²⁺ white precipitate, soluble in excess to a colourless solution.",
        "Ammonium, NH₄⁺: warm with aqueous sodium hydroxide and ammonia gas is produced.",
        "Flame tests: lithium red, sodium yellow, potassium lilac, calcium orange-red, barium light green, copper(II) blue-green.",
      ],
    },
    {
      heading: "Tests for gases",
      points: [
        "Ammonia turns damp red litmus paper blue. Carbon dioxide turns limewater milky.",
        "Chlorine bleaches damp litmus paper. Hydrogen gives a 'pop' with a lighted splint.",
        "Oxygen relights a glowing splint. Sulfur dioxide turns acidified aqueous potassium manganate(VII) from purple to colourless.",
      ],
    },
  ],
  examTips: [
    "Describe a test fully: reagent, observation, and conclusion. Say 'white precipitate', not just 'white'.",
    "For precipitate tests, say whether it dissolves in excess reagent. That is often the difference between two ions.",
    "In chromatography questions, measure from the start line to the middle of each spot and from the start line to the solvent front (Extended Rf).",
    "State the order of reagents. Nitric acid is added before silver nitrate to remove carbonates that would give a false result.",
    "Justify a separation method by naming the property used, such as solubility or boiling point.",
  ],
  commonMistakes: [
    "Using ink for the chromatography start line. Use pencil.",
    "Calling a solution 'clear' when you mean 'colourless'. Clear means see-through and can be coloured.",
    "Mixing up the ion tests, such as using silver nitrate for sulfate or barium nitrate for halides.",
    "Writing that filtration separates a dissolved solid. Salt in water passes through the filter paper.",
    "Using the word 'precipitate' for a gas. A precipitate is a solid formed in a solution.",
  ],
};
