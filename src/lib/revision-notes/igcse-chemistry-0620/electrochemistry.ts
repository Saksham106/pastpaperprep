import type { NoteTopic } from "@/lib/revision-notes/types";

export const NOTES: NoteTopic = {
  slug: "electrochemistry",
  topic: "Electrochemistry",
  number: 4,
  title: "IGCSE Chemistry 0620 Electrochemistry Revision Notes",
  description:
    "IGCSE Chemistry 0620 electrochemistry revision notes: electrolysis of molten and aqueous compounds, electroplating and hydrogen fuel cells.",
  summary:
    "Electrolysis uses electricity to break down an ionic compound that is molten or in solution. Positive ions move to the cathode and negative ions to the anode, and which product forms depends on the compound and the electrodes. Hydrogen-oxygen fuel cells work the other way, producing electricity from a chemical reaction.",
  sections: [
    {
      heading: "Electrolysis",
      points: [
        "Electrolysis is the decomposition of an ionic compound, when molten or in aqueous solution, by the passage of an electric current.",
        "The electrolyte is the molten or dissolved ionic compound. It conducts because its ions are free to move.",
        "The anode is the positive electrode and the cathode is the negative electrode. Anions (negative) go to the anode, cations (positive) go to the cathode.",
        "Inert electrodes (graphite or platinum) do not react. Active electrodes, such as copper, can take part in the reaction.",
        "Metals or hydrogen form at the cathode. Non-metals (other than hydrogen) form at the anode.",
        "Molten binary compounds: the metal forms at the cathode and the non-metal at the anode. Molten lead(II) bromide gives grey molten lead at the cathode and red-brown bromine vapour at the anode.",
        "Concentrated aqueous sodium chloride (brine): hydrogen at the cathode and chlorine at the anode. Sodium hydroxide solution is left behind.",
        "Dilute sulfuric acid: hydrogen at the cathode and oxygen at the anode, in a volume ratio of 2 : 1.",
        "Tests: hydrogen burns with a squeaky pop, oxygen relights a glowing splint, chlorine bleaches damp litmus paper.",
        "Electroplating improves the appearance of a metal object and its resistance to corrosion.",
        "To electroplate: make the object the cathode, use the plating metal as the anode, and use an electrolyte containing ions of the plating metal.",
      ],
    },
    {
      heading: "Charge transfer, copper(II) sulfate and half-equations",
      extended: true,
      points: [
        "In the external circuit, electrons move through the wires. At the cathode, ions gain electrons. At the anode, ions lose electrons. In the electrolyte, ions carry the current.",
        "In aqueous solutions, ions from water (H⁺ and OH⁻) are also present. At the cathode, the metal forms if it is less reactive than hydrogen, otherwise hydrogen is given off.",
        "At the anode of a halide solution, the halogen forms if the solution is concentrated, but oxygen is given off if it is dilute. Sulfate and nitrate solutions give oxygen.",
        "Aqueous copper(II) sulfate with inert carbon electrodes: copper at the cathode (pink-brown solid) and oxygen at the anode. The blue colour fades as copper ions are removed.",
        "Aqueous copper(II) sulfate with copper electrodes: the anode loses mass as copper dissolves and the cathode gains copper. The blue colour stays the same.",
        "Reduction (gain of electrons) occurs at the cathode. Oxidation (loss of electrons) occurs at the anode.",
        "Cathode: Cu²⁺ + 2e⁻ → Cu, 2H⁺ + 2e⁻ → H₂, Pb²⁺ + 2e⁻ → Pb.",
        "Anode: 2Cl⁻ → Cl₂ + 2e⁻, 2Br⁻ → Br₂ + 2e⁻, 4OH⁻ → 2H₂O + O₂ + 4e⁻.",
        "Check that the charges balance in each half-equation.",
      ],
    },
    {
      heading: "Hydrogen–oxygen fuel cells",
      points: [
        "A hydrogen–oxygen fuel cell uses hydrogen and oxygen to produce electricity, with water as the only chemical product. Overall: 2H₂ + O₂ → 2H₂O.",
        "(Extended) Advantages over a petrol engine: the only product is water (no carbon dioxide or other pollutants at the point of use), and fuel cells are quiet and efficient.",
        "(Extended) Disadvantages: hydrogen is flammable, hard to store and transport, and is often made from fossil fuels. There are also few refuelling stations.",
      ],
    },
  ],
  examTips: [
    "For aqueous electrolysis, always list the ions present (including H⁺ and OH⁻) and decide which is discharged at each electrode.",
    "State the observations as well as the products: bubbles, pink-brown coating, loss of blue colour, mass changes.",
    "Remember the memory phrase: anions to the anode, cations to the cathode. Check that you label the electrodes the right way round.",
    "In half-equations, write electrons as e⁻ and make sure the charge on both sides is equal.",
    "When asked about benefits of fuel cells, give the product (water only) and one more reason, such as efficiency.",
  ],
  commonMistakes: [
    "Mixing up anode and cathode, or saying that the anode is negative. In electrolysis the anode is positive.",
    "Saying that electrons flow through the electrolyte. Electrons flow in the wires only, and ions carry the current in the electrolyte.",
    "Forgetting that water also provides ions, and saying that sodium forms at the cathode from sodium chloride solution.",
    "Saying that solid ionic compounds conduct electricity. They only conduct when molten or dissolved.",
    "Forgetting that with copper electrodes the blue colour of copper(II) sulfate does not fade, since copper dissolves at the anode.",
  ],
};
