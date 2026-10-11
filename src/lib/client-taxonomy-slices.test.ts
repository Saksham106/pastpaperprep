import { describe, expect, it } from "vitest";
import full0610 from "@/data/classification/igcse-biology-0610-official-taxonomy-v2.json";
import slice0610 from "@/data/client/biology-0610-eras.json";
import { project0610Eras } from "../../scripts/generate-client-taxonomy-slices.mjs";

// The browser ships these compact slices; regenerate with
// `node scripts/generate-client-taxonomy-slices.mjs` whenever a full taxonomy changes.
describe("client taxonomy slices", () => {
  it("0610 slice equals the projection of the full taxonomy", () => {
    expect(slice0610).toEqual(project0610Eras(full0610));
  });
});
