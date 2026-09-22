"""Project reviewed IB Economics unit/code and facet evidence into runtime metadata."""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

from json_record_patch import patch_records_text

RECONCILIATION = Path("/Users/sakshamgoel/Documents/ProjectsInternships/research/official-subtopics-ib-economics/live-row-reconciliation.json")
RUNTIME_PATHS = (
    Path("src/data/production/ib-economics-hl.json"),
    Path("src/data/production/ib-economics-sl.json"),
    Path("src/data/local-preview/ib-economics-hl.json"),
    Path("src/data/local-preview/ib-economics-sl.json"),
    Path("src/data/private-index/ib-economics-hl.json"),
    Path("src/data/private-index/ib-economics-sl.json"),
)


def apply_projection(runtime: dict[str, Any], reconciliation: dict[str, Any]) -> dict[str, Any]:
    questions = runtime.get("questions")
    rows = reconciliation.get("rows")
    if not isinstance(questions, list) or not isinstance(rows, list):
        raise ValueError("Economics projection inputs must contain question/row lists")
    by_id: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, dict) or not row.get("id"):
            raise ValueError("Economics reconciliation contains a missing id")
        current = by_id.get(row["id"])
        if current and (current.get("official_code_refs"), current.get("curated_facet_ids")) != (row.get("official_code_refs"), row.get("curated_facet_ids")):
            raise ValueError(f"Economics reconciliation disagrees across levels: {row['id']}")
        by_id[row["id"]] = row
    question_ids = {question.get("id") for question in questions if isinstance(question, dict)}
    missing = question_ids - by_id.keys()
    if missing:
        raise ValueError(f"Economics projection missing reconciliation rows: {sorted(missing)[:3]}")
    result = deepcopy(runtime)
    for question in result["questions"]:
        row = by_id[question["id"]]
        codes = row.get("official_code_refs")
        facets = row.get("curated_facet_ids")
        if not isinstance(codes, list) or not isinstance(facets, list) or any(not isinstance(value, str) for value in codes + facets):
            raise ValueError(f"Invalid Economics projection row: {question['id']}")
        question["officialCodeRefs"] = list(codes)
        question["retrievalFacets"] = list(facets)
    return result


def main() -> None:
    reconciliation = json.loads(RECONCILIATION.read_text())
    for path in RUNTIME_PATHS:
        runtime = json.loads(path.read_text())
        apply_projection(runtime, reconciliation)
        by_id = {row["id"]: (row["official_code_refs"], row["curated_facet_ids"]) for row in reconciliation["rows"]}

        def update(question: dict[str, Any]) -> dict[str, Any]:
            codes, facets = by_id[question["id"]]
            question["officialCodeRefs"] = list(codes)
            question["retrievalFacets"] = list(facets)
            return question

        patch_records_text(str(path), {question["id"]: update for question in runtime["questions"]})
    print(json.dumps({"rows": len(reconciliation["rows"]), "files": len(RUNTIME_PATHS)}))


if __name__ == "__main__":
    main()
