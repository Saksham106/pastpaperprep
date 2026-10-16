"""Read-only census of printed question totals in IGCSE science written papers (components 3x-6x).

For each question paper: find question-start anchors in the left margin, attribute every
"[Total: N]" and part mark "[n]" to the preceding anchor, and read the paper maximum from the
cover ("The total mark for this paper is N"). Read-only; writes one JSON result.
"""
import hashlib, json, re, sys
from pathlib import Path
import pymupdf

ROOT = Path("/Users/sakshamgoel/Documents/ProjectsInternships")
CLEAN = ROOT / "research/papacambridge-clean-20261013/sources"
TOTAL = re.compile(r"\[\s*Total\s*:\s*(\d{1,3})\s*\]")
PART = re.compile(r"\[\s*(\d{1,2})\s*\]")
MAXMARK = re.compile(r"total mark for this paper is\s*(\d{2,3})", re.I)

def census(pdf: Path, strict: bool):
    doc = pymupdf.open(pdf)
    paper_max = None
    events = []  # (page, y, kind, value)
    for pno, page in enumerate(doc):
        text = page.get_text("text")
        if paper_max is None:
            m = MAXMARK.search(text)
            if m: paper_max = int(m.group(1))
        for b in page.get_text("blocks"):
            x0, y0, x1, y1, t = b[0], b[1], b[2], b[3], b[4]
            first = t.strip().split("\n")[0].strip() if t.strip() else ""
            m = re.match(r"^(\d{1,2})(\s|$)", first)
            # A question number sits alone on its own first line; numbered list items carry text.
            # strict: number alone on its line (or two digits); loose: any leading number.
            rest = first[len(m.group(1)):].strip() if m else ""
            dotted = rest != "" and re.fullmatch(r"[.\s…]*", rest) is not None  # numbered answer line
            if m and 30 <= x0 <= 65 and not dotted and (not strict or first == m.group(1) or int(m.group(1)) >= 10):
                events.append((pno, y0, "anchor", int(m.group(1))))
            for tm in TOTAL.finditer(t): events.append((pno, y0, "total", int(tm.group(1))))
            for pm in PART.finditer(t): events.append((pno, y0, "part", int(pm.group(1))))
    events.sort(key=lambda e: (e[0], e[1]))
    questions, current = {}, None
    for pno, y, kind, value in events:
        if kind == "anchor":
            expected = (current or 0) + 1
            if value == expected:
                current = value
                questions[current] = {"total": None, "parts": 0, "pages": [pno + 1]}
            continue
        if current is None: continue
        q = questions[current]
        if pno + 1 not in q["pages"]: q["pages"].append(pno + 1)
        if kind == "total": q["total"] = value
        elif kind == "part": q["parts"] += value
    return paper_max, questions

def papers(bank: str):
    """Paper id -> question PDF; the clean May/June 2026 replacements win over watermarked copies."""
    code = bank[-4:]
    found = {}
    for folder in sorted((ROOT / f"{bank}-topic-practice/data").glob("raw*")):
        for pdf in sorted(folder.glob(f"{code}-*-question.pdf")):
            found.setdefault(pdf.name.replace("-question.pdf", ""), pdf)
    for pdf in sorted(CLEAN.glob(f"{code}_s26_qp_*.pdf")):
        found[f"{code}-2026-s-{pdf.stem.split('_')[-1]}"] = pdf
    return {k: v for k, v in found.items() if k.split("-")[-1][0] in "3456"}

def main():
    bank, target = sys.argv[1], sys.argv[2]
    out = {}
    for paper, pdf in sorted(papers(bank).items()):
        entry = {"pdf": str(pdf), "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest()}
        for name, strict in (("strict", True), ("loose", False)):
            paper_max, qs = census(pdf, strict)
            entry["paperMax"] = paper_max
            entry[name] = {str(k): v for k, v in qs.items()}
        out[paper] = entry
    Path(target).write_text(json.dumps(out, indent=1))
    print(bank, len(out), "papers")

main()
