import type { NoteTopic } from "@/lib/revision-notes/types";

export const NOTES: NoteTopic = {
  slug: "the-periodic-table",
  topic: "The Periodic Table",
  number: 8,
  title: "IGCSE Chemistry 0620 Periodic Table Revision Notes",
  description:
    "IGCSE Chemistry 0620 Periodic Table revision notes: groups and periods, Group I alkali metals, Group VII halogens, transition elements and noble gases.",
  summary:
    "The Periodic Table arranges elements by proton number, so elements in the same group have the same number of outer electrons and similar properties. Group I metals get more reactive down the group, Group VII halogens get less reactive, transition elements form coloured compounds, and noble gases are unreactive.",
  sections: [
    {
      heading: "Arrangement of elements",
      points: [
        "Elements are arranged in order of increasing proton (atomic) number, in periods (rows) and groups (columns).",
        "Elements in a group have the same number of outer-shell electrons, so they have similar chemical properties. The period number equals the number of electron shells.",
        "The group number of Groups I to VII equals the number of outer electrons. Group VIII (0) has a full outer shell.",
        "Group number links to ion charge: Group I forms 1+ ions, Group II forms 2+ ions, Group VI forms 2− ions and Group VII forms 1− ions.",
        "Across a period the character changes from metallic to non-metallic. Metals are on the left and in the centre, non-metals on the right.",
        "Use an element's position to predict its properties: for example an element in Group I is a soft, reactive metal forming 1+ ions.",
        "(Extended) Identify trends in a group from data. For example, if the melting points of three elements in a group are given, you can describe the pattern and predict the next element.",
      ],
    },
    {
      heading: "Group I properties",
      paragraphs: [
        "The alkali metals are lithium, sodium and potassium. They have one outer electron, which they lose to form 1+ ions.",
      ],
      points: [
        "They are relatively soft metals. Down the group the melting point decreases, the density increases and the reactivity increases.",
        "They react with water to give hydrogen and an alkaline metal hydroxide. Example: 2Na + 2H₂O → 2NaOH + H₂.",
        "Reactivity increases down the group because the outer electron is further from the nucleus and is lost more easily.",
        "Predict the properties of other Group I elements from the trends. Rubidium, for example, is softer, has a lower melting point and is more reactive than potassium.",
      ],
    },
    {
      heading: "Group VII properties",
      paragraphs: [
        "The halogens are chlorine, bromine and iodine. They are diatomic non-metals (Cl₂, Br₂, I₂) with 7 outer electrons and form 1− ions.",
      ],
      points: [
        "At r.t.p. chlorine is a pale yellow-green gas, bromine is a red-brown liquid and iodine is a grey-black solid.",
        "Down the group the density increases and the reactivity decreases, because the outer shell is further from the nucleus and attracts an extra electron less strongly.",
        "A more reactive halogen displaces a less reactive halogen from a solution of its halide. Example: Cl₂(aq) + 2KBr(aq) → 2KCl(aq) + Br₂(aq). The solution turns orange.",
        "Chlorine displaces bromine and iodine. Bromine displaces only iodine, giving a brown solution. Iodine displaces neither.",
        "Predict the properties of other halogens from the trends. Astatine, for example, is a dark solid and less reactive than iodine.",
      ],
    },
    {
      heading: "Transition elements",
      points: [
        "Transition elements are metals in the central block between Groups II and III, such as iron, copper and nickel.",
        "They have high densities and high melting points, and they form coloured compounds. Copper(II) compounds are blue, iron(II) compounds are green and iron(III) compounds are orange-brown.",
        "They often act as catalysts, both as elements and in compounds. Example: iron in the Haber process.",
        "(Extended) They have ions with variable oxidation numbers, including iron(II) (Fe²⁺) and iron(III) (Fe³⁺).",
      ],
    },
    {
      heading: "Noble gases",
      points: [
        "The Group VIII noble gases (helium, neon, argon, krypton, xenon) are unreactive, monatomic gases.",
        "They are unreactive because they have a full outer shell of electrons (two for helium, eight for the rest), so they do not need to gain, lose or share electrons.",
      ],
    },
  ],
  examTips: [
    "Link trends to electron structure: always mention the outer electron and its distance from the nucleus when explaining reactivity.",
    "Use the opposite explanation for Group I (loses an electron more easily) and Group VII (gains an electron less easily).",
    "Write displacement equations in full and state the colour of the new solution, such as orange for bromine and brown for iodine.",
    "For noble gases, say 'full outer shell' rather than 'stable' alone, and link each use to a property.",
    "State the position of an element from its electron configuration: shells give the period, outer electrons give the group.",
  ],
  commonMistakes: [
    "Saying the halogens become more reactive down the group. They become less reactive.",
    "Giving the reason for the Group I trend as 'more electrons', instead of the outer electron being further from the nucleus.",
    "Forgetting that the halogens are diatomic, for example writing Cl instead of Cl₂ in equations.",
    "Calling the transition elements Group III. They form their own block between Groups II and III.",
    "Mixing up group and period numbers when reading off electron shells and outer electrons.",
  ],
};
