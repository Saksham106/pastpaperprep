import type { NoteTopic } from "@/lib/revision-notes/types";

export const NOTES: NoteTopic = {
  slug: "acids-bases-and-salts",
  topic: "Acids, bases and salts",
  number: 7,
  title: "IGCSE Chemistry 0620 Acids, Bases and Salts Notes",
  description:
    "IGCSE Chemistry 0620 acids, bases and salts revision notes: indicators, pH, neutralisation, oxides, and how to prepare soluble and insoluble salts.",
  summary:
    "Acids release H⁺ ions in water and bases neutralise acids to form salts and water. Acid reactions follow predictable patterns, oxides are acidic, basic or amphoteric, and the method for making a salt depends on whether it is soluble. Know the reagents, observations and equations for each.",
  sections: [
    {
      heading: "The characteristic properties of acids and bases",
      points: [
        "A base is an oxide or hydroxide of a metal. An alkali is a soluble base. Aqueous acids contain H⁺ ions and aqueous alkalis contain OH⁻ ions.",
        "Litmus: red in acid, blue in alkali. Methyl orange: red in acid, yellow in alkali. Thymolphthalein: colourless in acid, blue in alkali.",
        "Universal indicator paper compares acidity by colour and pH: red (strongly acidic, pH 0 to 2), orange or yellow (weakly acidic), green (neutral, pH 7), blue (weakly alkaline) and purple (strongly alkaline, pH 12 to 14). A lower pH means a higher H⁺ concentration.",
        "Acid + metal → salt + hydrogen. Example: Mg + 2HCl → MgCl₂ + H₂.",
        "Acid + base → salt + water. Example: CuO + H₂SO₄ → CuSO₄ + H₂O.",
        "Acid + metal carbonate → salt + water + carbon dioxide. Example: CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂.",
        "Neutralisation: acid + alkali → salt + water. Ionic equation: H⁺(aq) + OH⁻(aq) → H₂O(l).",
        "Bases also react with ammonium salts. Warming an ammonium salt with sodium hydroxide gives ammonia, which turns damp red litmus paper blue.",
      ],
    },
    {
      heading: "Acid strength and the proton theory",
      extended: true,
      points: [
        "(Extended) An acid is a proton (H⁺) donor and a base is a proton acceptor.",
        "(Extended) A strong acid is completely dissociated in aqueous solution. Hydrochloric acid is strong: HCl(aq) → H⁺(aq) + Cl⁻(aq).",
        "(Extended) A weak acid is only partially dissociated. Ethanoic acid is weak: CH₃COOH(aq) ⇌ H⁺(aq) + CH₃COO⁻(aq). The ⇌ sign shows the reaction is reversible.",
        "(Extended) At the same concentration, a weak acid has a higher pH than a strong acid because fewer H⁺ ions are present.",
      ],
    },
    {
      heading: "Oxides",
      points: [
        "Metal oxides are basic, for example CuO and CaO. They react with acids to form a salt and water.",
        "Non-metal oxides are acidic, for example CO₂ and SO₂. They react with alkalis.",
        "(Extended) Amphoteric oxides react with both acids and bases to form a salt and water. Aluminium oxide (Al₂O₃) and zinc oxide (ZnO) are amphoteric.",
      ],
    },
    {
      heading: "Preparation of soluble salts",
      paragraphs: [
        "Choose the method by checking the solubility rules. A salt is named from its metal (or ammonium) and the acid used: hydrochloric acid gives chlorides, sulfuric acid gives sulfates and nitric acid gives nitrates.",
      ],
      points: [
        "Sodium, potassium and ammonium salts are soluble. All nitrates are soluble.",
        "Chlorides are soluble except those of lead and silver. Sulfates are soluble except those of barium, calcium and lead.",
        "Carbonates are insoluble except those of sodium, potassium and ammonium. Hydroxides are insoluble except those of sodium, potassium and ammonium, while calcium hydroxide is partially soluble.",
        "From excess metal, excess insoluble base or excess insoluble carbonate: add the solid to warm acid until no more reacts, so all the acid is used up.",
        "Filter off the excess solid. Heat the filtrate to evaporate some water until crystals start to form, then leave it to cool and crystallise. Filter, wash with a little cold distilled water and dry between filter paper.",
        "From an alkali: use titration. Add acid to a measured volume of alkali with indicator, note the volume needed to neutralise it, repeat without indicator, then crystallise.",
        "A hydrated substance is chemically combined with water. An anhydrous substance contains no water.",
      ],
    },
    {
      heading: "Insoluble salts and water of crystallisation",
      extended: true,
      points: [
        "(Extended) Prepare an insoluble salt by precipitation: mix two soluble salt solutions whose ions combine to form the insoluble product. Example: AgNO₃(aq) + NaCl(aq) → AgCl(s) + NaNO₃(aq).",
        "(Extended) Filter off the precipitate, wash it with distilled water and dry it.",
        "(Extended) Water of crystallisation is the water in hydrated crystals, for example CuSO₄•5H₂O (blue) and CoCl₂•6H₂O (pink). Heating removes it to leave the anhydrous salt.",
      ],
    },
  ],
  examTips: [
    "Use the phrase 'an excess of the solid' when describing salt preparation and explain that it makes sure all the acid reacts.",
    "Learn the observations for each acid reaction: fizzing for metals and carbonates, and a solid dissolving for bases.",
    "Write ionic equations for neutralisation and precipitation with state symbols, and cancel the spectator ions.",
    "Check the solubility of the product first. If it is insoluble, you need precipitation, not crystallisation.",
    "Give colours of indicators exactly, for example methyl orange is red in acid and yellow in alkali.",
  ],
  commonMistakes: [
    "Using a strong acid with a metal that is below hydrogen in the reactivity series, such as copper, which will not react.",
    "Confusing a base and an alkali. All alkalis are bases but only soluble bases are alkalis.",
    "Heating the solution until it is completely dry, which gives a powder rather than good crystals.",
    "Forgetting to filter off the excess solid before crystallising the salt.",
    "Writing CO₂ as a product of acids reacting with metal oxides. Carbon dioxide forms only with carbonates.",
  ],
};
