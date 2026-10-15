#!/usr/bin/env python3
"""Fail when a source PDF carries a third-party site's watermark, stamp or tracking line.

    python3 -I scripts/scan-source-watermarks.py <pdf-or-directory>...

Checks metadata, page text, link targets, decompressed streams and vector-drawn margin stamps
(text drawn as outlines, e.g. a footer URL). Needs PyMuPDF.
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
# Exam boards credit image and text sources (Shutterstock, journals) after a heading on the closing
# page; domains below that heading there are citations, not stamps. Brand matches always count.
CREDITS = re.compile(r'^\s*(?:References|Acknowledg(?:e)?ments?|Sources)\s*:?\s*$', re.I | re.M)
# IB papers can end with blank sheets after the credits page; they don't count as the closing page.
BLANK_PAGE = re.compile(r'Please do not write on this page\.?\s*Answers written on this page\s*will not be marked\.?|\b\d+EP\d+\b', re.I)
# A rehost footer drawn as glyph outlines: a dense vector cluster in the bottom-left margin.
MARGIN_PT, MIN_PATH_ITEMS = 22, 50


def foreign_domains(text: str, closing_page: bool) -> set[str]:
    heading = CREDITS.search(text) if closing_page else None
    checked = text[:heading.start()] if heading else text
    return {d.lower() for d in DOMAIN.findall(checked) if not d.lower().endswith(ALLOWED)}


def margin_stamp(page: pymupdf.Page) -> bool:
    height = page.rect.height
    corner = pymupdf.Rect(0, height - MARGIN_PT, page.rect.width / 3, height)
    if not any(corner.contains(d['rect']) and len(d['items']) > MIN_PATH_ITEMS for d in page.get_drawings()):
        return False
    # Some originals carry clipped or off-page paths there; only count marks that actually render.
    return min(page.get_pixmap(clip=corner, dpi=72, colorspace=pymupdf.csGRAY).samples) < 235


def closing_page(doc: pymupdf.Document) -> int:
    """Last page with content: IB papers end with blank 'Please do not write on this page' sheets."""
    for number in range(doc.page_count, 0, -1):
        text = BLANK_PAGE.sub('', doc[number - 1].get_text())
        if text.strip():
            return number
    return doc.page_count


def findings(path: Path) -> list[str]:
    found, pages, domains, stamped = [], [], set(), []
    with pymupdf.open(path) as doc:
        if BRANDS.search(str(doc.metadata).encode()):
            found.append('metadata')
        closing = closing_page(doc)
        for number, page in enumerate(doc, 1):
            text = page.get_text()
            foreign = foreign_domains(text, number == closing)
            linked = any(BRANDS.search((link.get('uri') or '').encode()) for link in page.get_links())
            if BRANDS.search(text.encode()) or foreign or linked:
                pages.append(number)
                domains |= foreign
            if margin_stamp(page):
                stamped.append(number)
        if stamped:
            found.append(f'vector margin stamp on {len(stamped)}/{doc.page_count} pages (first p{stamped[0]})')
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
