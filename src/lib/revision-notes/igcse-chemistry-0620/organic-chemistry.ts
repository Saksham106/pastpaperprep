import type { NoteTopic } from "@/lib/revision-notes/types";

export const NOTES: NoteTopic = {
  slug: "organic-chemistry",
  topic: "Organic chemistry",
  number: 11,
  title: "IGCSE Chemistry 0620 Organic Chemistry Revision Notes",
  description:
    "IGCSE Chemistry 0620 organic chemistry revision notes: naming, fuels, alkanes, alkenes, alcohols, carboxylic acids and polymers, with key reactions and tests.",
  summary:
    "Organic chemistry is the study of carbon compounds. Learn each homologous series by its functional group, naming rule and typical reactions: alkanes are mostly unreactive, alkenes are unsaturated, alcohols burn and ethanoic acid reacts like a typical acid.",
  sections: [
    {
      heading: "Formulae, functional groups and terminology",
      points: [
        "A displayed formula shows all the atoms and all the bonds in a molecule.",
        "A homologous series is a family of similar compounds with similar chemical properties because they have the same functional group. A functional group is the atom or group of atoms that determines the chemical properties of the series.",
        "General formulae: alkanes CₙH₂ₙ₊₂, alkenes CₙH₂ₙ, alcohols CₙH₂ₙ₊₁OH, carboxylic acids CₙH₂ₙ₊₁COOH.",
        "A saturated compound has only single carbon–carbon bonds. An unsaturated compound has one or more carbon–carbon bonds that are not single.",
        "(Extended) A homologous series has the same functional group and general formula, differs by a –CH₂– unit from one member to the next, shows a trend in physical properties and shares similar chemical properties.",
        "(Extended) A structural formula unambiguously shows how the atoms are arranged, e.g. CH₂=CH₂, CH₃CH₂OH and CH₃COOCH₃.",
        "(Extended) Structural isomers have the same molecular formula but different structural formulae, e.g. C₄H₁₀ as CH₃CH₂CH₂CH₃ and CH₃CH(CH₃)CH₃, or C₄H₈ as CH₃CH₂CH=CH₂ and CH₃CH=CHCH₃.",
      ],
    },
    {
      heading: "Naming organic compounds",
      points: [
        "Know the names and displayed formulae of methane, ethane, ethene, ethanol and ethanoic acid, and of the products of the reactions in this topic.",
        "The name ending shows the compound type: -ane alkane, -ene alkene, -ol alcohol, -oic acid carboxylic acid.",
        "(Extended) Name and draw unbranched alkanes, alkenes (including but-1-ene and but-2-ene), alcohols (including propan-1-ol, propan-2-ol, butan-1-ol and butan-2-ol) and carboxylic acids with up to four carbons.",
        "(Extended) Esters are named from the alcohol then the acid, e.g. ethanol and ethanoic acid give ethyl ethanoate.",
      ],
    },
    {
      heading: "Fuels",
      points: [
        "The fossil fuels are coal, natural gas and petroleum. Methane is the main constituent of natural gas.",
        "Hydrocarbons contain hydrogen and carbon only. Petroleum is a mixture of hydrocarbons, separated into fractions by fractional distillation.",
        "Uses, top to bottom: refinery gas (heating and cooking), petrol (cars), naphtha (chemical feedstock), kerosene (jet fuel), diesel oil (diesel engines), fuel oil (ships and home heating), lubricating oil (lubricants, waxes, polishes), bitumen (roads).",
        "From the bottom to the top of the column: chain length decreases, volatility increases, boiling point decreases and viscosity decreases.",
      ],
    },
    {
      heading: "Alkanes",
      points: [
        "Alkanes are saturated hydrocarbons with single covalent bonds. They are generally unreactive except for combustion and substitution by chlorine.",
        "Complete combustion: CH₄ + 2O₂ → CO₂ + 2H₂O.",
        "(Extended) In a substitution reaction one atom or group is replaced by another. Alkanes react with chlorine in a photochemical reaction, with ultraviolet light providing the activation energy: CH₄ + Cl₂ → CH₃Cl + HCl (monosubstitution).",
      ],
    },
    {
      heading: "Alkenes",
      points: [
        "Alkenes have a C=C double bond and are unsaturated hydrocarbons.",
        "Cracking breaks larger alkanes into smaller alkanes, alkenes and hydrogen using a high temperature and a catalyst. Example: C₁₀H₂₂ → C₈H₁₈ + C₂H₄.",
        "Cracking is done because there is more demand for short-chain fuels such as petrol than for long chains, and it makes useful alkenes.",
        "Test for unsaturation: aqueous bromine turns from orange-brown to colourless with an alkene, and stays orange-brown with an alkane.",
        "(Extended) In an addition reaction only one product forms. Alkenes add bromine (C₂H₄ + Br₂ → C₂H₄Br₂), hydrogen with a nickel catalyst (C₂H₄ + H₂ → C₂H₆) and steam with an acid catalyst (C₂H₄ + H₂O → C₂H₅OH).",
      ],
    },
    {
      heading: "Alcohols",
      points: [
        "Fermentation: aqueous glucose is converted to ethanol and carbon dioxide by yeast, at 25–35 °C and without oxygen. C₆H₁₂O₆ → 2C₂H₅OH + 2CO₂.",
        "Addition of steam to ethene: ethene and steam react at 300 °C and 6000 kPa (60 atm) with an acid catalyst. C₂H₄ + H₂O → C₂H₅OH.",
        "Ethanol burns to give carbon dioxide and water: C₂H₅OH + 3O₂ → 2CO₂ + 3H₂O. It is used as a fuel and as a solvent.",
        "(Extended) Fermentation is slow and gives dilute ethanol that needs distillation, but uses renewable sugar and low temperatures. Steam addition is fast and gives pure ethanol, but uses ethene from non-renewable petroleum and needs high energy input.",
      ],
    },
    {
      heading: "Carboxylic acids",
      points: [
        "Ethanoic acid (CH₃COOH) reacts with metals to give a salt and hydrogen, with bases to give a salt and water, and with carbonates to give a salt, water and carbon dioxide. The salts are ethanoates.",
        "Examples: 2CH₃COOH + Mg → (CH₃COO)₂Mg + H₂ (magnesium ethanoate), and 2CH₃COOH + CaCO₃ → (CH₃COO)₂Ca + H₂O + CO₂ (calcium ethanoate).",
        "(Extended) Ethanoic acid is a weak acid: CH₃COOH ⇌ H⁺ + CH₃COO⁻ (partial dissociation).",
        "(Extended) Ethanol is oxidised to ethanoic acid by acidified aqueous potassium manganate(VII), or by bacterial oxidation in vinegar production.",
        "(Extended) A carboxylic acid reacts with an alcohol using an acid catalyst to form an ester and water.",
      ],
    },
    {
      heading: "Polymers",
      points: [
        "Polymers are large molecules built from many smaller molecules called monomers. Plastics are made from polymers.",
        "Addition polymerisation: many ethene monomers join to form poly(ethene), and the only product is the polymer.",
        "Most plastics are not easily broken down. This causes challenges: they fill landfill sites, accumulate in the oceans, and burning them forms toxic gases.",
        "(Extended) To find the repeat unit of an addition polymer, open the C=C double bond and show continuing bonds at each end. You can also work back from a repeat unit to the alkene.",
        "(Extended) Condensation polymerisation joins two different monomers and releases a small molecule such as water, so there are two products. Addition polymerisation gives one product only.",
        "(Extended) Nylon is a polyamide made from a dicarboxylic acid and a diamine. PET is a polyester made from a dicarboxylic acid and a diol. PET can be converted back into monomers and re-polymerised.",
        "(Extended) Proteins are natural polyamides formed from amino acid monomers, which have an amine group, a carboxylic acid group and a side-chain R.",
      ],
    },
  ],
  examTips: [
    "Always name the reagent and the colour change in the bromine water test: orange-brown to colourless.",
    "For cracking and addition questions, check your equation balances and the products are alkanes or alkenes as required.",
    "When comparing ethanol production routes, give one point about the raw material and one about speed or purity.",
    "State the conditions for each reaction: UV light for substitution, nickel for hydrogenation, yeast at 25–35 °C without oxygen for fermentation.",
    "Draw displayed formulae showing every bond, including the O–H bond in alcohols and acids.",
  ],
  commonMistakes: [
    "Saying bromine water turns 'clear'. It becomes colourless, because the bromine is decolourised.",
    "Mixing up substitution and addition. Alkanes undergo substitution, alkenes undergo addition (Extended).",
    "Writing the formula of ethanol as C₂H₆O without showing the –OH, or drawing the acid group wrongly.",
    "Treating the double bond as two separate single bonds in a polymer repeat unit.",
    "Saying ethanoic acid is a strong acid because it is acidic. It is weak (Extended).",
  ],
};
