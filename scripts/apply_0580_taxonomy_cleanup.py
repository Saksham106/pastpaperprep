"""Apply the reviewed, exact 22-row 0580 taxonomy cleanup."""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

from json_record_patch import patch_records_text

RESEARCH_OVERLAY = Path("/Users/sakshamgoel/Documents/ProjectsInternships/research/official-subtopics-0580/candidate-overlay.json")
RUNTIME = Path("src/data/raw/igcse.json")


def apply_overlay(runtime: dict[str, Any], overlay: dict[str, Any]) -> dict[str, Any]:
    if overlay.get("researchOnly") is not True or not isinstance(overlay.get("rows"), list):
        raise ValueError("0580 overlay must be a research-only row list")
    questions = runtime.get("questions")
    if not isinstance(questions, list):
        raise ValueError("0580 runtime has no questions list")
    by_id = {row.get("id"): row for row in questions if isinstance(row, dict) and row.get("id")}
    if len(by_id) != len(questions):
        raise ValueError("0580 runtime contains missing or duplicate question ids")
    result = deepcopy(runtime)
    for entry in overlay["rows"]:
        question_id = entry.get("id") if isinstance(entry, dict) else None
        after = entry.get("after") if isinstance(entry, dict) else None
        if not question_id or question_id not in by_id:
            raise ValueError(f"0580 cleanup row missing from runtime: {question_id!r}")
        if not isinstance(after, dict) or not all(key in after for key in ("primaryTopic", "secondaryTopics", "subtopics", "detailedSubtopics", "contextTags")):
            raise ValueError(f"0580 cleanup row is incomplete: {question_id!r}")
        target = next(row for row in result["questions"] if row["id"] == question_id)
        for key in ("primaryTopic", "secondaryTopics", "subtopics", "detailedSubtopics", "contextTags"):
            target[key] = deepcopy(after[key])
    return result


def main() -> None:
    overlay = json.loads(RESEARCH_OVERLAY.read_text())
    runtime = json.loads(RUNTIME.read_text())
    apply_overlay(runtime, overlay)
    by_id = {entry["id"]: entry["after"] for entry in overlay["rows"]}

    def update(question: dict[str, Any]) -> dict[str, Any]:
        after = by_id[question["id"]]
        for key in ("primaryTopic", "secondaryTopics", "subtopics", "detailedSubtopics", "contextTags"):
            question[key] = deepcopy(after[key])
        return question

    patch_records_text(str(RUNTIME), {question_id: update for question_id in by_id})
    print(json.dumps({"bank": "igcse-0580", "rows": len(by_id), "questions": len(runtime["questions"])}))


if __name__ == "__main__":
    main()
