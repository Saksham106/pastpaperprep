import { describe, expect, it } from "vitest";
import { applyTransportMammalsReparenting, TRANSPORT_MAMMALS_REPARENTING_IDS } from "./generate-coordinated-sciences-0654-runtime.mjs";

const ids = [
  "0654-2021-march-42-q10", "0654-2021-summer-23-q7", "0654-2021-summer-31-q7", "0654-2021-summer-32-q4", "0654-2021-summer-33-q4",
  "0654-2021-winter-11-q7", "0654-2021-winter-12-q7", "0654-2021-winter-21-q7", "0654-2021-winter-22-q7", "0654-2021-winter-33-q1", "0654-2021-winter-43-q10",
  "0654-2022-march-62-q2", "0654-2022-summer-22-q7", "0654-2022-summer-23-q7", "0654-2022-summer-31-q1", "0654-2022-summer-42-q1", "0654-2022-winter-23-q7", "0654-2022-winter-32-q4",
  "0654-2023-march-12-q7", "0654-2023-march-22-q7", "0654-2023-march-32-q1", "0654-2023-summer-11-q7", "0654-2023-summer-21-q7", "0654-2023-summer-22-q7", "0654-2023-summer-32-q4", "0654-2023-summer-33-q4", "0654-2023-winter-23-q2", "0654-2023-winter-31-q4", "0654-2023-winter-43-q1",
  "0654-2024-march-12-q7", "0654-2024-summer-11-q7", "0654-2024-summer-12-q7", "0654-2024-summer-13-q7", "0654-2024-summer-23-q7", "0654-2024-winter-11-q7", "0654-2024-winter-22-q7", "0654-2024-winter-31-q4", "0654-2024-winter-41-q4", "0654-2024-winter-42-q1",
];
const row = (question_id, topic = "transport-in-plants") => ({ question_id, primary: { topic_id: topic, topic_label: "Transport in plants", subtopic_label: "Transport in mammals" } });
const unchanged = (id) => ({ question_id: id, primary: { topic_id: "unchanged-topic", topic_label: "Unchanged", subtopic_label: "Unchanged section" }, metadata: { preserved: true } });

describe("0654 source-backed transport reparenting", () => {
  it("changes exactly the frozen 39 IDs to the owning animal topic and preserves all 4,682 other rows", () => {
    expect(TRANSPORT_MAMMALS_REPARENTING_IDS).toEqual(ids);
    const input = [...ids.map((id) => row(id)), ...Array.from({ length: 4682 }, (_, i) => unchanged(`unrelated-${i}`))];
    const output = applyTransportMammalsReparenting(input);
    const changed = output.filter((item, i) => JSON.stringify(item) !== JSON.stringify(input[i]));
    expect(changed).toHaveLength(39);
    expect(output.slice(39)).toEqual(input.slice(39));
    for (const item of output.slice(0, 39)) {
      expect(item.primary).toMatchObject({ topic_id: "transport-in-animals", topic_label: "Transport in animals", subtopic_label: "Transport in mammals" });
    }
  });

  it("rejects an unknown source baseline", () => {
    expect(() => applyTransportMammalsReparenting([row(ids[0])], { baselineSha256: "unknown" })).toThrow("baseline");
  });

  it("rejects extra or missing target IDs", () => {
    expect(() => applyTransportMammalsReparenting([row("extra-id")])).toThrow("target ID set");
    expect(() => applyTransportMammalsReparenting(ids.slice(1).map((id) => row(id)))).toThrow("target ID set");
  });

  it("rejects source rows that no longer match the source rule", () => {
    const input = ids.map((id, i) => row(id, i === 0 ? "wrong-topic" : "transport-in-plants"));
    expect(() => applyTransportMammalsReparenting(input)).toThrow("source rule");
  });

  it("is idempotent", () => {
    const input = ids.map((id) => row(id));
    const once = applyTransportMammalsReparenting(input);
    expect(applyTransportMammalsReparenting(once)).toEqual(once);
  });
});
