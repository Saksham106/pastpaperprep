import type { NoteTopic } from "@/lib/revision-notes/types";

export const NOTES: NoteTopic = {
  slug: "states-of-matter",
  topic: "States of matter",
  number: 1,
  title: "IGCSE Chemistry 0620 States of Matter Revision Notes",
  description:
    "IGCSE Chemistry 0620 states of matter revision notes: particle arrangement, changes of state, heating curves, gas volume and diffusion, with exam tips.",
  summary:
    "Matter exists as solids, liquids and gases, and the difference comes down to how close the particles are, how they are arranged and how fast they move. Changes of state happen when energy is added or removed, and diffusion shows that particles are always moving.",
  sections: [
    {
      heading: "Solids, liquids and gases",
      paragraphs: [
        "The kinetic particle model says that all matter is made of tiny particles that are in constant motion. The state depends on how close the particles are and how strongly they attract each other.",
      ],
      points: [
        "Solid: particles are close together in a regular pattern. They vibrate about fixed positions. A solid has a fixed shape and volume and cannot be compressed.",
        "Liquid: particles are close together but in a random arrangement. They move past each other. A liquid has a fixed volume but takes the shape of its container, and is almost impossible to compress.",
        "Gas: particles are far apart, in random positions, and move quickly in all directions. A gas fills its container, has no fixed shape or volume and is easily compressed.",
        "Melting: solid to liquid. Freezing: liquid to solid. Boiling and evaporation: liquid to gas. Condensation: gas to liquid.",
        "Melting and boiling need heat to be taken in. Freezing and condensing give heat out.",
        "Evaporation happens at the surface of a liquid at any temperature below the boiling point. Boiling happens throughout the liquid at the boiling point only.",
        "Gases: at constant pressure, heating a gas increases its volume and cooling it decreases its volume. At constant temperature, increasing the pressure decreases the volume.",
      ],
    },
    {
      heading: "Explaining changes of state and gas behaviour",
      extended: true,
      points: [
        "When a solid melts or a liquid boils, the particles gain energy and overcome the forces of attraction between them. When a substance freezes or condenses, the forces re-form as energy is lost.",
        "During a change of state the temperature stays constant. The energy goes into separating particles, not into speeding them up.",
        "Gas pressure is caused by particles colliding with the walls of the container.",
        "Heating a gas makes the particles move faster, so they hit the walls harder and more often. In a fixed volume the pressure rises. At constant pressure the gas expands.",
        "Squeezing a gas into a smaller volume at constant temperature makes the particles hit the walls more often, so pressure rises.",
      ],
    },
    {
      heading: "Heating and cooling curves",
      extended: true,
      points: [
        "On a heating curve, a sloping line means one state is being warmed. A flat line means a change of state is happening.",
        "The first flat line is the melting point and the second is the boiling point.",
        "On a cooling curve the same shapes appear in reverse. The flat part at the lower temperature is freezing, and the higher flat part is condensing.",
      ],
    },
    {
      heading: "Diffusion",
      paragraphs: [
        "Diffusion is the net movement of particles from a region of higher concentration to a region of lower concentration, caused by the random motion of the particles. It happens in gases and liquids, and is fastest in gases.",
      ],
      points: [
        "Example: the smell of perfume spreading across a room, or a drop of coloured ink spreading through water.",
        "A higher temperature makes diffusion faster because the particles have more kinetic energy.",
        "Demonstration: place cotton wool soaked in concentrated ammonia solution at one end of a long glass tube and cotton wool soaked in concentrated hydrochloric acid at the other. A white ring of ammonium chloride forms where the gases meet.",
        "(Extended) The ring forms closer to the hydrochloric acid end. Ammonia (Mr = 17) has a lower relative molecular mass than hydrogen chloride (Mr = 36.5), so its particles move faster and diffuse further in the same time.",
        "(Extended) In general, gases with a lower relative molecular mass diffuse faster than gases with a higher relative molecular mass at the same temperature.",
      ],
    },
  ],
  examTips: [
    "When asked to describe the arrangement and movement, give both: for example 'close together, regular pattern, vibrating about fixed positions' for a solid.",
    "Explain flat sections of a heating curve using energy: 'the energy is used to overcome the forces between particles, not to raise the temperature'.",
    "For gas pressure questions, always mention particles colliding with the container walls more frequently and with greater force.",
    "Use the word 'particles' in explanations. Avoid saying that particles 'expand' or 'melt'. The gaps and the motion change, not the particles themselves.",
    "In the ammonia and hydrogen chloride experiment, link the position of the ring to the Mr of each gas.",
  ],
  commonMistakes: [
    "Saying that particles get bigger when a substance is heated. The particles stay the same size, they move faster or further apart.",
    "Saying that particles in a solid do not move. They vibrate about fixed positions.",
    "Confusing boiling and evaporation. Boiling occurs throughout the liquid at one temperature, evaporation occurs only at the surface.",
    "Drawing a heating curve with a sloping line during melting or boiling. These should be flat.",
    "Describing diffusion as 'particles moving' without saying it is net movement from high to low concentration.",
  ],
};
