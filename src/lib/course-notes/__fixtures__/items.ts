import type { ItemsFile } from "../types";

export const itemsFixture: ItemsFile = {
  schemaVersion: 1,
  edition: "aa-2021",
  items: [
    {
      item: "2.5", topic: 2, level: "SL", name: "Quadratics",
      bullets: [{ id: "2.5.a", text: "Solve quadratics" }, { id: "2.5.b", text: "Discriminant" }],
      booklet: [{ id: "2.5.quadratic-formula", label: "Quadratic formula" }],
    },
    {
      item: "2.13", topic: 2, level: "AHL", name: "Polynomials",
      bullets: [{ id: "2.13.a", text: "Factor theorem" }],
      booklet: [],
    },
  ],
};
