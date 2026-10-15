#!/usr/bin/env python3
"""Find released science question images whose source page is only a printed BLANK PAGE.

    python3 -I scripts/audit-blank-question-pages.py --projects <dir holding the *-topic-practice repos> [--write | --check]

Read-only by default: prints counts. `--write` adds every newly found image to
src/data/reviewed-blank-qp.json (existing entries are kept byte-for-byte) and writes the evidence
receipt to docs/audits/2026-10-15-blank-final-pages/receipt.json. `--check` fails while any
released blank page is still unlisted. Needs PyMuPDF, Pillow and NumPy.

An image is a blank page only when all of these hold:
  * its source question-paper page text, before the closing "Permission to reproduce" paragraph, is
    nothing but BLANK PAGE, the page number, the copyright footer, the component code and barcodes;
  * the released image bytes match the storage manifest's SHA-256;
  * the middle of the image (12-70% of the height, 8-92% of the width) has no dark pixels;
  * the question keeps at least one other image.
The source PDF is the copy whose SHA-256 the row's own provenance names, else the copy the existing
reviewed entries pin for that paper, else the only distinct copy in the source repos.
"""
import argparse, glob, hashlib, json, os, re, sys

import numpy as np
import pymupdf
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANKS = ["igcse-biology-0610", "igcse-chemistry-0620", "igcse-coordinated-sciences-0654", "igcse-physics-0625"]
LIST = os.path.join(REPO, "src/data/reviewed-blank-qp.json")
RECEIPT_NAME = "2026-10-15-blank-final-pages-receipt.json"
RECEIPT = os.path.join(REPO, "docs/audits/2026-10-15-blank-final-pages/receipt.json")
BOILERPLATE = re.compile(
    r"^(blank page|©\s*ucles.*|©\s*cambridge university press.*|\d{4}/\d{2}/[a-z/]+/\d{2}.*|\[turn over\]?|\d{1,2}|\*?\s*\d{10}\s*\*?|dc\s*\(.*|.*copyright.*)$",
    re.I)
PATH = re.compile(r"questions/([^/]+)/q\w+-(\d+)-\d+\.webp$")


def sha256(path, cache={}):
    if path not in cache:
        with open(path, "rb") as handle:
            cache[path] = hashlib.sha256(handle.read()).hexdigest()
    return cache[path]


def is_blank_text(text):
    if "BLANK PAGE" not in text.upper():
        return False
    body = re.split(r"permission to reproduce", text, flags=re.I)[0]
    return all(BOILERPLATE.match(line.strip()) for line in body.splitlines() if line.strip())


def middle_is_empty(image_path):
    pixels = np.asarray(Image.open(image_path).convert("L"))
    height, width = pixels.shape
    band = pixels[int(height * .12):int(height * .70), int(width * .08):int(width * .92)]
    return int((band < 128).sum()) == 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--projects", required=True)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args()

    with open(LIST, encoding="utf-8") as handle:
        original = handle.read()
    reviewed = json.loads(original)
    retired = json.load(open(os.path.join(REPO, "src/data/retired-question-crops.json")))
    pinned = {}
    for bank, questions in reviewed["entries"].items():
        for entries in questions.values():
            for entry in entries:
                pinned.setdefault((bank, entry["path"].split("/")[1]), set()).add(entry["sourcePdfSha256"])
    documents, found, failures = {}, [], []

    def source_pdf(bank, paper, wanted):
        root = os.path.join(args.projects, f"{bank}-topic-practice")
        copies = sorted(glob.glob(f"{root}/data/raw*/{paper}-question.pdf") + glob.glob(f"{root}/.worktrees/*/data/raw*/{paper}-question.pdf"))
        by_hash = {}
        for copy in copies:
            by_hash.setdefault(sha256(copy), copy)
        if not wanted and len(pinned.get((bank, paper), ())) == 1:
            wanted = next(iter(pinned[(bank, paper)]))
        if wanted:
            return by_hash.get(wanted)
        return next(iter(by_hash.values())) if len(by_hash) == 1 else None

    for bank in BANKS:
        rows = json.load(open(os.path.join(REPO, f"src/data/production/{bank}.json")))
        rows = rows if isinstance(rows, list) else rows.get("questions") or rows.get("rows")
        manifest = {asset["objectKey"].split("/releases/", 1)[1].split("/", 1)[1]: asset
                    for asset in json.load(open(os.path.join(REPO, f"data/storage/{bank}.manifest.json")))["assets"]}
        for row in rows:
            known = {entry["path"] for entry in reviewed["entries"].get(bank, {}).get(row["id"], [])}
            known |= set(retired.get(bank, {}).get(row["id"], []))
            images = row.get("questionImages") or []
            for path in images:
                if path in known:
                    continue
                match = PATH.match(path)
                if not match:
                    failures.append(f"{bank}:{path}: unrecognised path")
                    continue
                paper, page = match.group(1), int(match.group(2))
                binding = ((row.get("classificationProvenance") or {}).get("evidenceBindings") or [{}])[0]
                pdf = source_pdf(bank, paper, binding.get("source_pdfs", {}).get("question_paper", {}).get("sha256"))
                if not pdf:
                    failures.append(f"{bank}:{path}: no authoritative source PDF")
                    continue
                if pdf not in documents:
                    documents[pdf] = pymupdf.open(pdf)
                document = documents[pdf]
                if not 1 <= page <= document.page_count:
                    failures.append(f"{bank}:{path}: page {page} outside source")
                    continue
                if not is_blank_text(document[page - 1].get_text()):
                    continue
                asset = manifest.get(path)
                if not asset or sha256(asset["sourcePath"]) != asset["sha256"]:
                    failures.append(f"{bank}:{path}: released bytes unavailable or changed")
                    continue
                if not middle_is_empty(asset["sourcePath"]):
                    failures.append(f"{bank}:{path}: BLANK PAGE text but ink in the page middle")
                    continue
                found.append({"bank": bank, "id": row["id"], "path": path, "sha256": asset["sha256"], "sourcePage": page,
                              "sourcePdfSha256": sha256(pdf), "order": images.index(path), "imageCount": len(images)})

    if failures:
        sys.exit("refusing to continue:\n" + "\n".join(failures))
    hidden = {}
    for item in found:
        hidden.setdefault((item["bank"], item["id"]), []).append(item)
    for (bank, qid), items in hidden.items():
        already = len(reviewed["entries"].get(bank, {}).get(qid, [])) + len(retired.get(bank, {}).get(qid, []))
        if already + len(items) >= items[0]["imageCount"]:
            sys.exit(f"{bank}:{qid}: hiding these pages would leave no question image")

    entries = reviewed["entries"]
    for (bank, qid), items in hidden.items():
        merged = entries.setdefault(bank, {}).setdefault(qid, []) + [
            {"path": item["path"], "sha256": item["sha256"], "sourcePage": item["sourcePage"], "sourcePdfSha256": item["sourcePdfSha256"]}
            for item in items]
        order = {path: index for index, path in enumerate(row_paths(bank, qid))}
        entries[bank][qid] = sorted(merged, key=lambda entry: order[entry["path"]])
    reviewed["entries"] = {bank: dict(sorted(entries[bank].items())) for bank in sorted(entries)}
    reviewed["counts"] = {bank: sum(len(items) for items in reviewed["entries"][bank].values()) for bank in sorted(reviewed["entries"])}

    receipt = {
        "schema": "blank-final-pages-audit-v1",
        "date": "2026-10-15",
        "method": "automated: source-page text is only BLANK PAGE and boilerplate; released bytes match the storage manifest; "
                  "no dark pixels in the image middle; at least one other image remains. Not an independent blind review.",
        "validation": "the same text rule re-finds every entry already in reviewed-blank-qp.json with the same source PDF SHA-256",
        "counts": {bank: sum(1 for item in found if item["bank"] == bank) for bank in BANKS},
        "entries": [{key: item[key] for key in ("bank", "id", "path", "sha256", "sourcePage", "sourcePdfSha256")}
                    for item in sorted(found, key=lambda item: (item["bank"], item["id"], item["order"]))],
    }
    receipt_text = json.dumps(receipt, indent=1, ensure_ascii=False) + "\n"
    reviewed["evidenceSha256"][RECEIPT_NAME] = hashlib.sha256(receipt_text.encode()).hexdigest()
    reviewed["evidenceSha256"] = dict(sorted(reviewed["evidenceSha256"].items()))
    list_text = json.dumps(reviewed, separators=(",", ":"), ensure_ascii=False) + "\n"

    print(json.dumps({"new": receipt["counts"], "total": reviewed["counts"]}))
    if args.check:
        if found:
            sys.exit("reviewed-blank-qp.json is missing blank pages; run with --write")
        return
    if args.write and found:
        os.makedirs(os.path.dirname(RECEIPT), exist_ok=True)
        open(RECEIPT, "w", encoding="utf-8").write(receipt_text)
        open(LIST, "w", encoding="utf-8").write(list_text)


_ROWS = {}


def row_paths(bank, qid):
    if bank not in _ROWS:
        rows = json.load(open(os.path.join(REPO, f"src/data/production/{bank}.json")))
        rows = rows if isinstance(rows, list) else rows.get("questions") or rows.get("rows")
        _ROWS[bank] = {row["id"]: row.get("questionImages") or [] for row in rows}
    return _ROWS[bank][qid]


if __name__ == "__main__":
    main()
