import type { NoteTopic } from "@/lib/revision-notes/types";

export const NOTES: NoteTopic = {
  slug: "atoms-elements-and-compounds",
  topic: "Atoms, elements and compounds",
  number: 2,
  title: "IGCSE Chemistry 0620 Atoms, Elements and Compounds Notes",
  description:
    "IGCSE Chemistry 0620 notes on atomic structure, isotopes, ionic, covalent and metallic bonding and giant structures, with dot-and-cross rules and exam tips.",
  summary:
    "Atoms are made of protons, neutrons and electrons, and the number of protons decides the element. Atoms join by transferring electrons (ionic bonding), sharing electrons (covalent bonding) or pooling electrons (metallic bonding), and the type of bonding explains the properties of a substance.",
  sections: [
    {
      heading: "Elements, compounds and mixtures",
      points: [
        "An element is a substance made of one type of atom only. It cannot be broken down into simpler substances by chemical means.",
        "A compound is a substance made of two or more elements chemically bonded in a fixed ratio. It can only be split up by chemical reactions.",
        "A mixture contains two or more substances that are not chemically joined. Each keeps its own properties and the proportions can vary. Mixtures can be separated by physical methods.",
      ],
    },
    {
      heading: "Atomic structure and the Periodic Table",
      points: [
        "An atom has a central nucleus containing protons and neutrons, surrounded by electrons in shells.",
        "Proton: relative mass 1, charge +1. Neutron: relative mass 1, charge 0. Electron: relative mass negligible (about 1/1840), charge −1.",
        "Proton number (atomic number) is the number of protons in the nucleus. Nucleon number (mass number) is the number of protons plus neutrons. Neutrons = nucleon number minus proton number.",
        "A neutral atom has equal numbers of protons and electrons.",
        "Electrons fill shells from the inside out, with 2 in the first shell and up to 8 in the second and third shells (for the first 20 elements). Sodium is 2,8,1.",
        "For ions, add or remove electrons from the outer shell. Na⁺ is 2,8 and Cl⁻ is 2,8,8.",
        "The group number (Groups I to VII) equals the number of outer-shell electrons. The period number equals the number of occupied shells. Group VIII (the noble gases) have full outer shells.",
        "Noble gases are unreactive because their outer shells are full.",
      ],
    },
    {
      heading: "Isotopes",
      points: [
        "Isotopes are different atoms of the same element with the same number of protons but different numbers of neutrons.",
        "Atoms and ions are written with nucleon number at the top left and proton number at the bottom left, for example ¹²₆C and ³⁵₁₇Cl⁻. The ion Cl⁻ has 17 protons, 18 neutrons and 18 electrons.",
        "Example: chlorine-35 and chlorine-37 both have 17 protons, but 18 and 20 neutrons.",
        "(Extended) Isotopes of an element have the same chemical properties, because they have the same number of electrons and so the same electronic configuration.",
        "(Extended) Relative atomic mass is the weighted average of the isotope masses. For chlorine with 75% Cl-35 and 25% Cl-37: (35 × 75 + 37 × 25) ÷ 100 = 35.5.",
      ],
    },
    {
      heading: "Ions and ionic bonds",
      points: [
        "An ion is a charged particle formed when an atom loses or gains electrons. Metals lose electrons to form positive ions (cations). Non-metals gain electrons to form negative ions (anions).",
        "An ionic bond is the strong electrostatic attraction between oppositely charged ions.",
        "Dot-and-cross diagrams show the transfer of electrons. Draw the ions in square brackets with the charge at the top right, showing only the outer shell. For NaCl, sodium gives one electron to chlorine, and the chloride ion has 8 outer electrons.",
        "Ionic compounds have high melting and boiling points.",
        "They conduct electricity when molten or dissolved in water, but not when solid.",
        "(Extended) Dot-and-cross diagrams can also be drawn for other metal and non-metal pairs, such as MgO, CaCl₂ and Na₂O.",
        "(Extended) The melting points are high because a lot of energy is needed to overcome the strong attractions between many ions.",
        "(Extended) They conduct when molten or aqueous because the ions are free to move. When solid, the ions are held in fixed positions.",
      ],
    },
    {
      heading: "Ionic lattice structure",
      extended: true,
      points: [
        "Ionic compounds form a giant lattice, a regular repeating arrangement of alternating positive and negative ions held by electrostatic forces in all directions.",
        "Draw the lattice as a regular grid of alternating positive and negative ions.",
      ],
    },
    {
      heading: "Simple molecules and covalent bonds",
      points: [
        "A covalent bond is a shared pair of electrons between two atoms, giving each atom a noble gas electronic configuration (a full outer shell).",
        "Learn dot-and-cross diagrams for H₂, Cl₂, H₂O, NH₃, CH₄ and HCl.",
        "Simple molecular substances have low melting and boiling points and do not conduct electricity.",
        "(Extended) Also learn O₂ (double bond), N₂ (triple bond), CO₂, C₂H₄ (with a C=C double bond) and CH₃OH.",
        "(Extended) The low melting and boiling points are because the weak forces between molecules (intermolecular forces) are overcome, not the covalent bonds.",
        "(Extended) They do not conduct electricity because they have no free ions or electrons.",
      ],
    },
    {
      heading: "Giant covalent structures",
      points: [
        "Diamond: each carbon atom bonds to four others in a rigid 3D network. It is very hard, has a very high melting point and does not conduct. It is used in cutting tools.",
        "Graphite: each carbon bonds to three others in flat layers. The layers are held by weak forces, so they slide over each other. It is soft and slippery (used as a lubricant), and conducts electricity because each carbon has one delocalised electron, so it is used as an electrode.",
        "In giant covalent structures, many strong covalent bonds must be broken to melt the substance, so melting points are very high.",
        "(Extended) Silicon(IV) oxide (silicon dioxide, SiO₂) has a structure like diamond, with each silicon bonded to four oxygen atoms.",
        "(Extended) Like diamond, silicon(IV) oxide is very hard, has a very high melting point and does not conduct, because of its network of strong covalent bonds.",
      ],
    },
    {
      heading: "Metallic bonding",
      extended: true,
      points: [
        "Metals have a lattice of positive ions in a 'sea' of delocalised electrons. The bond is the electrostatic attraction between the positive ions and the delocalised electrons.",
        "Metals conduct electricity because the delocalised electrons can move through the structure.",
        "Metals are malleable and ductile because the layers of ions can slide over each other without breaking the bonding.",
      ],
    },
  ],
  examTips: [
    "When explaining melting point, name what is overcome: 'strong electrostatic forces between ions', 'weak intermolecular forces' or 'strong covalent bonds'.",
    "For ionic dot-and-cross diagrams, include brackets and charges. For covalent diagrams, show only outer shells and make sure each atom has a full shell.",
    "To explain conductivity, always mention charged particles that are free to move, and say which ones (ions or delocalised electrons).",
    "Define isotopes in full: same number of protons, different number of neutrons. Mention the element is the same.",
    "Link properties of a substance to its structure and bonding. The question is usually asking for this link.",
  ],
  commonMistakes: [
    "Saying that covalent bonds break when a simple molecular substance melts or boils. Only the intermolecular forces are overcome.",
    "Saying that ionic compounds conduct when solid. The ions cannot move until the compound is molten or dissolved.",
    "Writing that graphite conducts because it has 'free electrons' without saying that they are delocalised and come from the carbon atoms' fourth outer electron.",
    "Describing an ionic bond as 'sharing' or covalent bond as 'transfer'. Check which one involves metals and which involves only non-metals.",
    "Confusing the number of neutrons with nucleon number. Remember neutrons = nucleon number minus proton number.",
  ],
};
