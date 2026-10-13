#!/usr/bin/env python3
"""Fail when a source PDF carries a third-party site's watermark, stamp or tracking line.

    python3 -I scripts/scan-source-watermarks.py <pdf-or-directory>...

Checks metadata, page text, link targets and decompressed streams. Needs PyMuPDF.
Exit 1 lists every flagged file; exit 0 means none were found.
"""
import re
import sys
from pathlib import Path

import pymupdf

# Rehosting sites seen stamping exam PDFs. Cambridge and IB domains are expected in originals.
BRANDS = re.compile(rb'papa\s*cambridge|bestexamhelp|studyhatch|xtremepape|dynamicpapers|papersdaddy|exam-easy|savemyexams|physicsandmathstutor|trace id: pc-', re.I)
DOMAIN = re.compile(r'\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|rs|io|info|co\.uk)\b', re.I)
ALLOWED = ('cambridgeinternational.org', 'cambridge.org', 'ibo.org', 'ucles.org')


def findings(path: Path) -> list[str]:
    found, pages, domains = [], [], set()
    with pymupdf.open(path) as doc:
        if BRANDS.search(str(doc.metadata).encode()):
            found.append('metadata')
        for number, page in enumerate(doc, 1):
            text = page.get_text()
            foreign = {d.lower() for d in DOMAIN.findall(text) if not d.lower().endswith(ALLOWED)}
            linked = any(BRANDS.search((link.get('uri') or '').encode()) for link in page.get_links())
            if BRANDS.search(text.encode()) or foreign or linked:
                pages.append(number)
                domains |= foreign
        if pages:
            found.append(f'{len(pages)}/{doc.page_count} pages (first p{pages[0]})' + (f': {", ".join(sorted(domains))}' if domains else ''))
        for xref in range(1, doc.xref_length()):
            try:
                data = doc.xref_stream(xref) if doc.xref_is_stream(xref) else doc.xref_object(xref).encode()
            except Exception:
                continue
            if data and BRANDS.search(data):
                found.append('stream')
                break
    return found


def main(args: list[str]) -> int:
    paths = [p for arg in args for p in (sorted(Path(arg).rglob('*.pdf')) if Path(arg).is_dir() else [Path(arg)])]
    if not paths:
        print(__doc__.strip())
        return 2
    flagged = 0
    for path in paths:
        hits = findings(path)
        if hits:
            flagged += 1
            print(f'{path}: {"; ".join(hits)}')
    print(f'{flagged} of {len(paths)} PDFs flagged')
    return 1 if flagged else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
