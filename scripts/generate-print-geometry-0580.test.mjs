// @vitest-environment node
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "vitest";
import { buildGeometry, segmentRows } from "./generate-print-geometry-0580.mjs";

const image = {
  id: "0580-2024-june-43-q11", path: "site/questions/0580-2024-june-43-q11.webp", width: 1070, height: 4479,
  source_pages: [22, 23, 24], bounds_pt: [[65.12, 800.55], [45, 800.55], [45, 702.49]], sha256: "d".repeat(64),
};

test("splits a stitched crop at its recorded source-page bounds and covers every row", () => {
  expect(segmentRows(4479, image.bounds_pt)).toEqual([[0, 1533, 735.43], [1533, 1575, 755.55], [3108, 1371, 657.49]]);
});

test("marks only OCR-evidenced BLANK PAGE segments and binds them to the crop hash", () => {
  const blank = [{ path: "questions/0580-2024-june-43-q11.webp", imageSha256: "d".repeat(64), segmentIndex: 2, sourcePage: 24 }];
  const geometry = buildGeometry([["question", [image]]], blank);
  expect(geometry.entries["0580-2024-june-43-q11"][0][6].map((segment) => segment[4])).toEqual([1, 1, 0]);
  expect(() => buildGeometry([["question", [image]]], [{ ...blank[0], imageSha256: "e".repeat(64) }])).toThrow(/does not match/);
  expect(() => buildGeometry([["question", [image]]], [{ ...blank[0], segmentIndex: 5 }])).toThrow(/matches no source crop/);
});

const sourceRepo = join(process.cwd(), "..", "igcse-0580-topic-practice");
test.skipIf(!existsSync(join(sourceRepo, "data/question-images.json")))("checked-in geometry matches the 0580 source receipts", () => {
  execFileSync(process.execPath, ["scripts/generate-print-geometry-0580.mjs", "--check"], {
    env: { ...process.env, PASTPAPERPREP_IGCSE_0580_REPO: sourceRepo }, encoding: "utf8",
  });
});
