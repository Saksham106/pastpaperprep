import type { NoteTopic } from "@/lib/revision-notes/types";

export const NOTES: NoteTopic = {
  slug: "chemistry-of-the-environment",
  topic: "Chemistry of the environment",
  number: 10,
  title: "IGCSE Chemistry 0620 Environment Revision Notes",
  description:
    "IGCSE Chemistry 0620 chemistry of the environment revision notes: water tests and treatment, fertilisers, air pollutants, climate change and photosynthesis.",
  summary:
    "This topic covers how water is tested and treated, why crops need nitrogen, phosphorus and potassium, and how pollutants and greenhouse gases affect air quality and climate. Learn the sources and effects of each pollutant.",
  sections: [
    {
      heading: "Water",
      points: [
        "Tests for water: anhydrous copper(II) sulfate turns from white to blue, and anhydrous cobalt(II) chloride turns from blue to pink.",
        "These tests show water is present but not that it is pure. To test purity, measure the melting point and boiling point. Pure water melts at 0 °C and boils at 100 °C, while impurities lower the melting point and raise the boiling point.",
        "Distilled water is used in practical chemistry instead of tap water because it contains fewer chemical impurities.",
        "Water from natural sources may contain dissolved oxygen, metal compounds, plastics, sewage, harmful microbes, and nitrates and phosphates from fertilisers (phosphates also from detergents).",
        "Some are beneficial: dissolved oxygen supports aquatic life and some metal compounds provide essential minerals. Others are harmful: some metal compounds are toxic, some plastics harm aquatic life, and sewage contains microbes that cause disease.",
        "Nitrates and phosphates deoxygenate the water and damage aquatic life.",
        "Treatment of the domestic water supply: sedimentation and filtration to remove solids, carbon to remove tastes and odours, then chlorination to kill microbes.",
      ],
    },
    {
      heading: "Fertilisers",
      points: [
        "Ammonium salts and nitrates are used as fertilisers.",
        "NPK fertilisers provide the elements nitrogen, phosphorus and potassium, which improve plant growth.",
      ],
    },
    {
      heading: "Air quality",
      paragraphs: [
        "Clean, dry air is approximately 78% nitrogen (N₂), 21% oxygen (O₂) and the remainder a mixture of noble gases and carbon dioxide (CO₂).",
      ],
      points: [
        "Carbon dioxide comes from the complete combustion of carbon-containing fuels. More CO₂ increases global warming, which leads to climate change.",
        "Carbon monoxide and particulates come from incomplete combustion of carbon-containing fuels. Carbon monoxide is a toxic gas. Particulates increase the risk of respiratory problems and cancer.",
        "Methane comes from the decomposition of vegetation and waste gases from digestion in animals. Like CO₂, it increases global warming.",
        "Oxides of nitrogen come from car engines. They cause acid rain, photochemical smog and respiratory problems.",
        "Sulfur dioxide comes from burning fossil fuels that contain sulfur compounds. It causes acid rain.",
        "(Extended) Oxides of nitrogen form in car engines because the high temperature makes nitrogen and oxygen from the air react. Catalytic converters remove them, for example 2CO + 2NO → 2CO₂ + N₂.",
      ],
    },
    {
      heading: "Climate change and acid rain strategies",
      points: [
        "Reduce climate change by planting trees, reducing livestock farming, decreasing the use of fossil fuels, and increasing the use of hydrogen and renewable energy such as wind and solar.",
        "Reduce acid rain by fitting catalytic converters to vehicles, using low-sulfur fuels, and removing sulfur dioxide from flue gases with calcium oxide (flue gas desulfurisation).",
        "(Extended) Carbon dioxide and methane cause global warming by absorbing, reflecting and emitting thermal energy, which reduces thermal energy loss to space.",
      ],
    },
    {
      heading: "Photosynthesis",
      points: [
        "Photosynthesis is the reaction between carbon dioxide and water to produce glucose and oxygen, in the presence of chlorophyll and using energy from light.",
        "Word equation: carbon dioxide + water → glucose + oxygen.",
        "(Extended) Symbol equation: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂.",
      ],
    },
  ],
  examTips: [
    "Link every pollutant to a source and a harmful effect. Mark schemes usually want both.",
    "For water pollution, say that nitrates and phosphates deoxygenate the water and so damage aquatic life.",
    "When explaining the greenhouse effect, say that gases absorb infrared (thermal) radiation and keep it in the atmosphere.",
    "Give the colour change for both water tests, including the starting colour.",
    "Equation questions on catalytic converters expect balanced symbols: check the atoms on both sides.",
  ],
  commonMistakes: [
    "Saying a blue colour with copper(II) sulfate proves the water is pure. It only proves water is present.",
    "Saying oxides of nitrogen cause global warming. They cause acid rain, smog and respiratory problems.",
    "Saying carbon monoxide causes global warming or acid rain. It is toxic and comes from incomplete combustion.",
    "Writing that fertilisers 'feed' plants. They supply the essential elements N, P and K.",
    "Blaming sulfur dioxide on car engines alone. Its main source is burning sulfur-containing fuels such as coal, while oxides of nitrogen come from hot engines.",
  ],
};
