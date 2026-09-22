"""Patch selected JSON records without reserializing surrounding bytes."""
from __future__ import annotations

import json
from typing import Any, Callable


def _matching_object_span(text: str, token_start: int) -> tuple[int, int]:
    stack: list[int] = []
    in_string = False
    escaped = False
    for index, char in enumerate(text[:token_start]):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            stack.append(index)
        elif char == "}" and stack:
            stack.pop()
    if not stack:
        raise ValueError("record object start not found")
    start = stack[-1]
    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return start, index + 1
    raise ValueError("unterminated record object")


def patch_records_text(path: str, updates: dict[str, Callable[[dict[str, Any]], dict[str, Any]]]) -> None:
    text = open(path, encoding="utf-8").read()
    for question_id, update in updates.items():
        needle = json.dumps(question_id, ensure_ascii=False, separators=(",", ":"))
        marker = f'"id":{needle}'
        token_start = -1
        search_from = 0
        while True:
            candidate = text.find(marker, search_from)
            if candidate < 0:
                break
            if candidate == 0 or text[candidate - 1] in "{,":
                token_start = candidate
                break
            search_from = candidate + 1
        if token_start < 0:
            raise ValueError(f"record not found: {question_id}")
        start, end = _matching_object_span(text, token_start)
        record = json.loads(text[start:end])
        if record.get("id") != question_id:
            raise ValueError(f"record boundary mismatch: {question_id}")
        updated = update(record)
        replacement = json.dumps(updated, ensure_ascii=False, separators=(",", ":"))
        text = text[:start] + replacement + text[end:]
    open(path, "w", encoding="utf-8").write(text)
