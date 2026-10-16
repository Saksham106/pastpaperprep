#!/usr/bin/env python3
"""Build the reference Periodic Table from Cambridge's own printed tables.

    python3 -I scripts/build-cambridge-periodic-table.py --projects <dir holding the *-topic-practice repos> [--check]

Reads every Periodic Table page listed in docs/audits/2026-10-16-periodic-table-pages/receipt.json
(Chemistry 0620 and Co-ordinated Sciences 0654 question papers), parses each element's atomic number,
symbol, name and relative atomic mass, and writes the full (118-element) table most pages print to
src/data/cambridge-periodic-table.json. Every other page must agree with it, apart from elements its
older edition leaves unnamed and the known misprints listed below; otherwise the build fails.
`--check` fails if the committed file differs. Needs PyMuPDF.
"""
import argparse, collections, glob, hashlib, json, os, re, sys

import pymupdf

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RECEIPT = os.path.join(REPO, "docs/audits/2026-10-16-periodic-table-pages/receipt.json")
OUTPUT = os.path.join(REPO, "src/data/cambridge-periodic-table.json")
RTP = "The volume of one mole of any gas is 24 dm3 at room temperature and pressure (r.t.p.)."
# Cambridge's own errors, confirmed against the rendered page: tin's mass and copernicium's symbol.
MISPRINTS = {"0620-2026-m-12": {50, 112}, "0620-2026-m-22": {50, 112}}
NAMES = """H hydrogen He helium Li lithium Be beryllium B boron C carbon N nitrogen O oxygen F fluorine Ne neon
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
ELEMENTS = [(index // 2 + 1, NAMES[index], NAMES[index + 1]) for index in range(0, len(NAMES), 2)]


def parse(text):
    """Atomic number, symbol, name, then the next number or dash, read in text order."""
    tokens = []
    for line in text.replace("–", " – ").splitlines():
        line = line.strip()
        if line:
            tokens += line.split() if re.fullmatch(r"[\d–\s.]+", line) else [line]
    found = {}
    for number, symbol, name in ELEMENTS:
        for index in range(len(tokens) - 2):
            if tokens[index] != str(number) or tokens[index + 1] != symbol:
                continue
            name_at = next((k for k in range(index + 2, min(index + 40, len(tokens))) if tokens[k] == name), None)
            if name_at is None:
                continue
            mass = next((tokens[k] for k in range(name_at + 1, min(name_at + 6, len(tokens)))
                         if re.fullmatch(r"\d+(?:\.\d+)?|–", tokens[k])), None)
            if mass is not None:
                found[number] = (symbol, name, None if mass == "–" else mass)
            break
    return found


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--projects", required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    pages = {}
    for entry in json.load(open(RECEIPT, encoding="utf-8"))["entries"]:
        paper = entry["path"].split("/")[1]
        key = (paper, entry["sourcePdfSha256"], entry["sourcePage"])
        if key in pages:
            continue
        root = os.path.join(args.projects, f"{entry['bank']}-topic-practice")
        copies = glob.glob(f"{root}/data/raw*/{paper}-question.pdf") + glob.glob(f"{root}/.worktrees/*/data/raw*/{paper}-question.pdf")
        pdf = next((copy for copy in sorted(copies) if hashlib.sha256(open(copy, "rb").read()).hexdigest() == entry["sourcePdfSha256"]), None)
        if not pdf:
            sys.exit(f"{paper}: pinned source PDF not found")
        with pymupdf.open(pdf) as document:
            pages[key] = parse(document[entry["sourcePage"] - 1].get_text())

    # The current edition names all 118 elements; take the one most pages print.
    editions = collections.Counter(json.dumps(sorted(table.items())) for table in pages.values() if sorted(table) == list(range(1, 119)))
    if not editions:
        sys.exit("no page names all 118 elements")
    table = dict((int(number), tuple(value)) for number, value in json.loads(editions.most_common(1)[0][0]))
    for (paper, _, page), other in pages.items():
        allowed = MISPRINTS.get(paper, set())
        for number, value in other.items():
            if number not in allowed and table[number] != value:
                sys.exit(f"{paper} p{page}: element {number} {value} disagrees with {table[number]}")
    agreeing = sum(1 for other in pages.values() if other == table)
    document = {
        "schema": "cambridge-periodic-table-v1",
        "source": {
            "description": "Cambridge IGCSE Chemistry 0620 / Co-ordinated Sciences 0654 question papers, 'The Periodic Table of Elements'",
            "pagesRead": len(pages),
            "pagesIdentical": agreeing,
            "note": "Older papers leave elements 113, 115, 117 and 118 unnamed; 0620 Feb/March 2026 Papers 12 and 22 misprint tin (117) and copernicium (Cr).",
        },
        "rtp": RTP,
        "elements": [{"number": number, "symbol": symbol, "name": name, "mass": mass} for number, (symbol, name, mass) in sorted(table.items())],
    }
    text = json.dumps(document, indent=1, ensure_ascii=False) + "\n"
    if args.check:
        if not os.path.exists(OUTPUT) or open(OUTPUT, encoding="utf-8").read() != text:
            sys.exit("src/data/cambridge-periodic-table.json is out of date")
        print("ok")
        return
    open(OUTPUT, "w", encoding="utf-8").write(text)
    print(json.dumps({"pagesRead": len(pages), "pagesIdentical": agreeing}))


if __name__ == "__main__":
    main()
