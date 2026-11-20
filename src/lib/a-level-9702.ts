/**
 * Cambridge International AS & A Level Physics 9702, 2020 series onward: Papers 1 (multiple choice), 2 (AS
 * structured) and 4 (A Level structured). Papers 3 and 5 (practical, planning) are out of scope. Each paper is its
 * own tab, as for 9709: students sit specific papers. Pure and client-safe.
 */
export const A_LEVEL_PHYSICS_9702 = "a-level-physics-9702" as const;

export type Physics9702Paper = { paper: 1 | 2 | 4; route: string; label: string; name: string; marks: 40 | 60 | 100 };

/** Durations and totals: the 2025-2027 syllabus assessment overview (source workspace data/paper-facts.json). */
export const PHYSICS_9702_PAPERS: readonly Physics9702Paper[] = [
  { paper: 1, route: "multiple-choice", label: "Multiple choice", name: "Multiple Choice", marks: 40 },
  { paper: 2, route: "as-structured", label: "AS structured", name: "AS Level Structured Questions", marks: 60 },
  { paper: 4, route: "a-level-structured", label: "A Level structured", name: "A Level Structured Questions", marks: 100 },
];

/** Topics 1-25 of the 2022 revision (identical in the 2025-2027 syllabus): AS 1-11, A Level 12-25. */
export const PHYSICS_9702_TOPICS: readonly string[] = [
  "Physical quantities and units",
  "Kinematics",
  "Dynamics",
  "Forces, density and pressure",
  "Work, energy and power",
  "Deformation of solids",
  "Waves",
  "Superposition",
  "Electricity",
  "D.C. circuits",
  "Particle physics",
  "Motion in a circle",
  "Gravitational fields",
  "Temperature",
  "Ideal gases",
  "Thermodynamics",
  "Oscillations",
  "Electric fields",
  "Capacitance",
  "Magnetic fields",
  "Alternating currents",
  "Quantum physics",
  "Nuclear physics",
  "Medical physics",
  "Astronomy and cosmology",
];

/**
 * Content the 2022 revision removed, used only on 2020-2021 papers: one named topic each, never a generic
 * bucket, after topics 1-25 in the old syllabus's order.
 */
export const PHYSICS_9702_EARLIER_TOPICS: readonly string[] = [
  "Measurement techniques (earlier syllabus)",
  "Kinetic model of matter (earlier syllabus)",
  "Communication (earlier syllabus)",
  "Strain gauges (earlier syllabus)",
  "Electronics (earlier syllabus)",
  "Current balance and e/m for electrons (earlier syllabus)",
  "Nuclear magnetic resonance imaging (earlier syllabus)",
  "Transformers and power transmission (earlier syllabus)",
  "Band theory (earlier syllabus)",
];

export const PHYSICS_9702_TOPIC_ORDER: readonly string[] = [...PHYSICS_9702_TOPICS, ...PHYSICS_9702_EARLIER_TOPICS];


/**
 * Each current topic's subtopic sections, in syllabus order (source taxonomy). The subtopic picker shows these under the
 * selected topic. Earlier-syllabus topics have no sections. The test keeps this equal to src/data/a-level-physics-9702-taxonomy.json.
 */
export const PHYSICS_9702_SUBTOPICS: Readonly<Record<string, readonly string[]>> = {
  "Physical quantities and units": ["Physical quantities", "SI units", "Errors and uncertainties", "Scalars and vectors"],
  "Kinematics": ["Equations of motion"],
  "Dynamics": ["Momentum and Newton’s laws of motion", "Non-uniform motion", "Linear momentum and its conservation"],
  "Forces, density and pressure": ["Turning effects of forces", "Equilibrium of forces", "Density and pressure"],
  "Work, energy and power": ["Energy conservation", "Gravitational potential energy and kinetic energy"],
  "Deformation of solids": ["Stress and strain", "Elastic and plastic behaviour"],
  "Waves": ["Progressive waves", "Transverse and longitudinal waves", "Doppler effect for sound waves", "Electromagnetic spectrum", "Polarisation"],
  "Superposition": ["Stationary waves", "Diffraction", "Interference", "The diffraction grating"],
  "Electricity": ["Electric current", "Potential difference and power", "Resistance and resistivity"],
  "D.C. circuits": ["Practical circuits", "Kirchhoff’s laws", "Potential dividers"],
  "Particle physics": ["Atoms, nuclei and radiation", "Fundamental particles"],
  "Motion in a circle": ["Kinematics of uniform circular motion", "Centripetal acceleration"],
  "Gravitational fields": ["Gravitational field", "Gravitational force between point masses", "Gravitational field of a point mass", "Gravitational potential"],
  "Temperature": ["Thermal equilibrium", "Temperature scales", "Specific heat capacity and specific latent heat"],
  "Ideal gases": ["The mole", "Equation of state", "Kinetic theory of gases"],
  "Thermodynamics": ["Internal energy", "The first law of thermodynamics"],
  "Oscillations": ["Simple harmonic oscillations", "Energy in simple harmonic motion", "Damped and forced oscillations, resonance"],
  "Electric fields": ["Electric fields and field lines", "Uniform electric fields", "Electric force between point charges", "Electric field of a point charge", "Electric potential"],
  "Capacitance": ["Capacitors and capacitance", "Energy stored in a capacitor", "Discharging a capacitor"],
  "Magnetic fields": ["Concept of a magnetic field", "Force on a current-carrying conductor", "Force on a moving charge", "Magnetic fields due to currents", "Electromagnetic induction"],
  "Alternating currents": ["Characteristics of alternating currents", "Rectification and smoothing"],
  "Quantum physics": ["Energy and momentum of a photon", "Photoelectric effect", "Wave-particle duality", "Energy levels in atoms and line spectra"],
  "Nuclear physics": ["Mass defect and nuclear binding energy", "Radioactive decay"],
  "Medical physics": ["Production and use of ultrasound", "Production and use of X-rays", "PET scanning"],
  "Astronomy and cosmology": ["Standard candles", "Stellar radii", "Hubble’s law and the Big Bang theory"],
};
