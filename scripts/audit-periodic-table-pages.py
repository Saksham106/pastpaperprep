#!/usr/bin/env python3
"""Find released question images that are only the exam's Periodic Table page.

    python3 -I scripts/audit-periodic-table-pages.py --projects <dir holding the *-topic-practice repos> [--write | --check]

Cambridge Chemistry and Co-ordinated Sciences papers print the Periodic Table on their last page, and
segmentation attached it to each paper's final question. It is reference material for the whole
paper, so the app shows it separately and these crops are retired as page furniture.

Read-only by default. `--write` adds every found image to src/data/retired-question-crops.json and
writes the evidence receipt to docs/audits/2026-10-16-periodic-table-pages/receipt.json. `--check`
fails while any such image is still active and re-verifies every receipt entry. Needs PyMuPDF.

An image is a Periodic Table page only when all of these hold:
  * its source page text has "The Periodic Table of Elements" heading;
  * once the table's own vocabulary is removed (element numbers, symbols and names, masses, Group,
    the key, lanthanoids/actinoids, the r.t.p. note) and page furniture, no text is left. A question
    page that merely mentions the Periodic Table keeps its question text and is never matched;
  * the released image bytes match the storage manifest's SHA-256;
  * the question keeps at least one other image.
"""
import argparse, glob, hashlib, importlib.util, json, os, re, sys, unicodedata

import pymupdf

# Reuse the blank-page audit's copyright-acknowledgement sentences and page furniture.
_spec = importlib.util.spec_from_file_location("blank_audit", os.path.join(os.path.dirname(os.path.abspath(__file__)), "audit-blank-question-pages.py"))
blank_audit = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(blank_audit)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANKS = ["igcse-chemistry-0620", "igcse-coordinated-sciences-0654"]
LIST = os.path.join(REPO, "src/data/retired-question-crops.json")
BLANK = os.path.join(REPO, "src/data/reviewed-blank-qp.json")
RECEIPT = os.path.join(REPO, "docs/audits/2026-10-16-periodic-table-pages/receipt.json")
PATH = re.compile(r"questions/([^/]+)/q\w+-(\d+)-\d+\.webp$")
HEADING = re.compile(r"The Periodic Table of (?:the )?Elements", re.I)

ELEMENTS = """H hydrogen He helium Li lithium Be beryllium B boron C carbon N nitrogen O oxygen F fluorine Ne neon
Na sodium Mg magnesium Al aluminium Si silicon P phosphorus S sulfur Cl chlorine Ar argon K potassium Ca calcium
Sc scandium Ti titanium V vanadium Cr chromium Mn manganese Fe iron Co cobalt Ni nickel Cu copper Zn zinc
Ga gallium Ge germanium As arsenic Se selenium Br bromine Kr krypton Rb rubidium Sr strontium Y yttrium
Zr zirconium Nb niobium Mo molybdenum Tc technetium Ru ruthenium Rh rhodium Pd palladium Ag silver Cd cadmium
In indium Sn tin Sb antimony Te tellurium I iodine Xe xenon Cs caesium Ba barium La lanthanum Ce cerium
Pr praseodymium Nd neodymium Pm promethium Sm samarium Eu europium Gd gadolinium Tb terbium Dy dysprosium
Ho holmium Er erbium Tm thulium Yb ytterbium Lu lutetium Hf hafnium Ta tantalum W tungsten Re rhenium Os osmium
Ir iridium Pt platinum Au gold Hg mercury Tl thallium Pb lead Bi bismuth Po polonium At astatine Rn radon
Fr francium Ra radium Ac actinium Th thorium Pa protactinium U uranium Np neptunium Pu plutonium Am americium
Cm curium Bk berkelium Cf californium Es einsteinium Fm fermium Md mendelevium No nobelium Lr lawrencium
Rf rutherfordium Db dubnium Sg seaborgium Bh bohrium Hs hassium Mt meitnerium Ds darmstadtium Rg roentgenium
Cn copernicium Nh nihonium Fl flerovium Mc moscovium Lv livermorium Ts tennessine Og oganesson""".split()
TABLE_PHRASES = [re.compile(p, re.I) for p in (
    r"The Periodic Table of (?:the )?Elements", r"relative atomic mass", r"atomic number", r"atomic symbol",
    r"The volume of one mole of any gas is 24\s*dm\s*3 at room temperature and pressure \(r\.t\.p\.\)\.?",
    r"\blanthanoids\b", r"\bactinoids\b", r"\bGroup\b", r"\bKey\b", r"\bname\b",
)] + blank_audit.ACKNOWLEDGEMENTS + blank_audit.FURNITURE
WORDS = re.compile(r"\b(?:" + "|".join(re.escape(word) for word in sorted(ELEMENTS, key=len, reverse=True)) + r"|I|II|III|IV|V|VI|VII|VIII)\b")
NUMBERS = re.compile(r"\d+(?:\.\d+)?(?:\s*[–-]\s*\d+)?|[–-]")
# Barcode-font runs and text in fonts without a Unicode map (control characters) are not content.
GLYPHS = re.compile(r"\S*[\x00-\x08\x0b-\x1f\x7f-\x9f\u0100-\u017f]\S*")


def sha256(path, cache={}):
    if path not in cache:
        with open(path, "rb") as handle:
            cache[path] = hashlib.sha256(handle.read()).hexdigest()
    return cache[path]


def is_periodic_table_page(text):
    text = unicodedata.normalize("NFKC", GLYPHS.sub(" ", text))
    if not HEADING.search(text):
        return False
    text = " ".join(re.sub(r"[\u2010-\u2013]", "-", text).split())
    for pattern in TABLE_PHRASES:
        text = pattern.sub(" ", text)
    text = NUMBERS.sub(" ", WORDS.sub(" ", text))
    return not any(re.search(r"[A-Za-z0-9]", token) for token in text.split())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--projects", required=True)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args()

    retired = json.load(open(LIST, encoding="utf-8"))
    blank = json.load(open(BLANK, encoding="utf-8"))["entries"]
    documents, found, failures = {}, [], []

    def source(bank, paper, wanted=None):
        root = os.path.join(args.projects, f"{bank}-topic-practice")
        copies = sorted(glob.glob(f"{root}/data/raw*/{paper}-question.pdf") + glob.glob(f"{root}/.worktrees/*/data/raw*/{paper}-question.pdf"))
        by_hash = {}
        for copy in copies:
            by_hash.setdefault(sha256(copy), copy)
        if wanted:
            return by_hash.get(wanted)
        return next(iter(by_hash.values())) if len(by_hash) == 1 else None

    def page_text(pdf, page):
        if pdf not in documents:
            documents[pdf] = pymupdf.open(pdf)
        return documents[pdf][page - 1].get_text() if page <= documents[pdf].page_count else ""

    rows_by_bank = {}
    for bank in BANKS:
        rows = json.load(open(os.path.join(REPO, f"src/data/production/{bank}.json")))
        rows = rows if isinstance(rows, list) else rows.get("questions") or rows.get("rows")
        rows_by_bank[bank] = {row["id"]: row.get("questionImages") or [] for row in rows}
        manifest = {asset["objectKey"].split("/releases/", 1)[1].split("/", 1)[1]: asset
                    for asset in json.load(open(os.path.join(REPO, f"data/storage/{bank}.manifest.json")))["assets"]}
        for qid, images in rows_by_bank[bank].items():
            hidden = {entry["path"] for entry in blank.get(bank, {}).get(qid, [])} | set(retired.get(bank, {}).get(qid, []))
            for path in images:
                if path in hidden:
                    continue
                match = PATH.match(path)
                if not match:
                    continue
                paper, page = match.group(1), int(match.group(2))
                pdf = source(bank, paper)
                if not pdf:
                    failures.append(f"{bank}:{path}: no single authoritative source PDF")
                    continue
                if not is_periodic_table_page(page_text(pdf, page)):
                    continue
                asset = manifest.get(path)
                if not asset or sha256(asset["sourcePath"]) != asset["sha256"]:
                    failures.append(f"{bank}:{path}: released bytes unavailable or changed")
                    continue
                if len(hidden) + 1 >= len(images):
                    failures.append(f"{bank}:{path}: would leave {qid} without a question image")
                    continue
                found.append({"bank": bank, "id": qid, "path": path, "sha256": asset["sha256"], "sourcePage": page,
                              "sourcePdfSha256": sha256(pdf)})
    if failures:
        sys.exit("refusing to continue:\n" + "\n".join(failures))
    print(json.dumps({"new": {bank: sum(1 for item in found if item["bank"] == bank) for bank in BANKS}}))

    if args.check:
        if found:
            sys.exit("active Periodic Table pages remain; run with --write")
        stale = [entry["path"] for entry in json.load(open(RECEIPT, encoding="utf-8"))["entries"]
                 if not is_periodic_table_page(page_text(source(entry["bank"], entry["path"].split("/")[1], entry["sourcePdfSha256"]) or "", entry["sourcePage"]))]
        if stale:
            sys.exit("receipt entries fail the Periodic Table rule:\n" + "\n".join(stale))
        return
    if not (args.write and found):
        return
    earlier = json.load(open(RECEIPT, encoding="utf-8"))["entries"] if os.path.exists(RECEIPT) else []
    entries = {entry["path"]: entry for entry in earlier + found}
    position = lambda entry: (entry["bank"], entry["id"], rows_by_bank[entry["bank"]][entry["id"]].index(entry["path"]))
    receipt = {
        "schema": "periodic-table-pages-audit-v1",
        "date": "2026-10-16",
        "method": "automated: source page has the Periodic Table heading and nothing but table vocabulary and page "
                  "furniture; released bytes match the storage manifest; the question keeps another image.",
        "counts": {bank: sum(1 for entry in entries.values() if entry["bank"] == bank) for bank in BANKS},
        "entries": sorted(entries.values(), key=position),
    }
    for item in found:
        paths = retired.setdefault(item["bank"], {}).setdefault(item["id"], [])
        paths.append(item["path"])
        order = rows_by_bank[item["bank"]][item["id"]]
        paths.sort(key=order.index)
    retired = {bank: dict(sorted(questions.items())) for bank, questions in sorted(retired.items())}
    os.makedirs(os.path.dirname(RECEIPT), exist_ok=True)
    open(RECEIPT, "w", encoding="utf-8").write(json.dumps(receipt, indent=1, ensure_ascii=False) + "\n")
    open(LIST, "w", encoding="utf-8").write(json.dumps(retired, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
