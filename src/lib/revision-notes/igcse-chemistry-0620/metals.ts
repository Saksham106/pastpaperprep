import type { NoteTopic } from "@/lib/revision-notes/types";

export const NOTES: NoteTopic = {
  slug: "metals",
  topic: "Metals",
  number: 9,
  title: "IGCSE Chemistry 0620 Metals Revision Notes",
  description:
    "Revision notes for IGCSE Chemistry 0620 metals: properties, alloys, the reactivity series, corrosion and rusting, and extraction of iron and aluminium.",
  summary:
    "Metals conduct heat and electricity, are malleable and form positive ions. Their reactivity series predicts displacement reactions and how each metal is extracted: carbon reduces the less reactive ones and electrolysis is needed for the most reactive.",
  sections: [
    {
      heading: "Properties of metals",
      points: [
        "Metals conduct heat and electricity well, are malleable (hammered into shape) and ductile (drawn into wires), and usually have high melting and boiling points.",
        "Non-metals are usually poor conductors of heat and electricity, brittle when solid, and have low melting and boiling points. Graphite conducting electricity is an exception.",
        "Metals conduct because delocalised electrons in the metallic lattice are free to move.",
        "Chemical properties: metals react with dilute acids to give a salt and hydrogen, with oxygen to give basic metal oxides, and (the more reactive ones) with cold water or steam.",
      ],
    },
    {
      heading: "Uses of metals",
      points: [
        "Aluminium is used for aircraft because of its low density, for overhead electrical cables because of its low density and good electrical conductivity, and for food containers because it resists corrosion.",
        "Copper is used for electrical wiring because it is an excellent electrical conductor and is ductile.",
      ],
    },
    {
      heading: "Alloys and their properties",
      paragraphs: [
        "An alloy is a mixture of a metal with other elements. Alloys can be harder and stronger than the pure metals, which makes them more useful.",
      ],
      points: [
        "Brass is a mixture of copper and zinc.",
        "Stainless steel is a mixture of iron with other elements such as chromium, nickel and carbon. Its hardness and resistance to rusting make it ideal for cutlery.",
        "In a diagram, a pure metal shows identical atoms in regular layers, while an alloy shows atoms of different sizes mixed in.",
        "(Extended) In a pure metal the layers slide over each other easily, so it is soft. In an alloy the different sized atoms mean the layers can no longer slide, so the alloy is harder and stronger.",
      ],
    },
    {
      heading: "Reactivity series",
      paragraphs: [
        "The order of reactivity, most to least: potassium, sodium, calcium, magnesium, aluminium, (carbon), zinc, iron, (hydrogen), copper, silver, gold.",
      ],
      points: [
        "With cold water: potassium, sodium and calcium react to give a metal hydroxide and hydrogen. Example: 2Na(s) + 2H₂O(l) → 2NaOH(aq) + H₂(g). Potassium reacts most vigorously.",
        "Magnesium reacts with steam to give magnesium oxide and hydrogen: Mg(s) + H₂O(g) → MgO(s) + H₂(g).",
        "With dilute hydrochloric acid: magnesium reacts rapidly, zinc moderately and iron slowly, all giving a salt and hydrogen. Copper, silver and gold do not react because they are below hydrogen.",
        "To deduce an order of reactivity from results, rank the metals by how vigorously they react (rate of bubbling, temperature rise) or by which displaces which.",
        "(Extended) The more reactive a metal, the greater its tendency to form positive ions. A more reactive metal displaces a less reactive one from a solution of its ions. Example: Zn(s) + CuSO₄(aq) → ZnSO₄(aq) + Cu(s).",
        "(Extended) Aluminium seems unreactive because it is covered by a thin, unreactive layer of aluminium oxide that stops the metal reacting.",
      ],
    },
    {
      heading: "Corrosion of metals",
      points: [
        "Iron and steel rust when they are in contact with both oxygen (air) and water. Rust is hydrated iron(III) oxide.",
        "Barrier methods include painting, greasing and coating with plastic. They stop rusting by excluding oxygen or water.",
        "(Extended) Galvanising coats iron with zinc. It is a barrier method and also gives sacrificial protection: zinc is more reactive than iron, so it loses electrons and corrodes in preference to the iron even if the coating is scratched.",
      ],
    },
    {
      heading: "Extraction of metals",
      paragraphs: [
        "Most metals occur as compounds in ores. The less reactive the metal, the easier it is to obtain from its ore.",
      ],
      points: [
        "Metals below carbon, such as iron and zinc, can be extracted by heating the oxide with carbon or carbon monoxide. Very unreactive metals such as gold occur uncombined.",
        "Iron is extracted from haematite (iron(III) oxide) in the blast furnace. Coke burns to give heat and carbon dioxide. The carbon dioxide is reduced by more carbon to carbon monoxide. Carbon monoxide reduces iron(III) oxide to iron.",
        "Limestone (calcium carbonate) decomposes thermally to calcium oxide, which reacts with silica impurities to form slag.",
        "(Extended) Blast furnace equations: C + O₂ → CO₂; C + CO₂ → 2CO; Fe₂O₃ + 3CO → 2Fe + 3CO₂; CaCO₃ → CaO + CO₂; CaO + SiO₂ → CaSiO₃.",
        "The main ore of aluminium is bauxite. Aluminium is more reactive than carbon, so it is extracted by electrolysis.",
        "(Extended) Purified aluminium oxide is dissolved in molten cryolite, which lowers the operating temperature and saves energy. The electrodes are carbon.",
        "(Extended) Cathode: Al³⁺ + 3e⁻ → Al. Anode: 2O²⁻ → O₂ + 4e⁻. The oxygen reacts with the hot carbon anodes to form carbon dioxide, so the anodes burn away and must be replaced regularly.",
      ],
    },
  ],
  examTips: [
    "When asked why one metal is more reactive, link it to its tendency to lose electrons and form positive ions.",
    "For displacement questions, name what you see: the colour change of the solution and any solid deposited, such as brown copper.",
    "Rusting answers need both oxygen and water. Naming only one will lose the mark.",
    "Write blast furnace equations in the right order: coke to CO, then CO reduces the iron oxide.",
    "For extraction, state the method and justify it using the position of the metal relative to carbon.",
  ],
  commonMistakes: [
    "Saying alloys are stronger because they are 'mixed'. Explain that different sized atoms stop layers sliding.",
    "Writing that limestone reduces iron oxide. It removes acidic impurities as slag.",
    "Stating that galvanising only works as a barrier. At Extended level it also protects by sacrificial action when scratched.",
    "Placing carbon or hydrogen wrongly in the reactivity series, then predicting the wrong extraction method.",
    "Forgetting that the electrodes in aluminium extraction are carbon and that the anodes burn away.",
  ],
};
