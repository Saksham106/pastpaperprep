"""Mark-scheme row repairs for two IB maths papers whose segmenter took a subscript for a question heading.
docs/ib-maths-ms-row-repairs.md

- ib-hl 2021-may-tz1-p1 (AA HL, May 2021, Paper 1, TZ1). An earlier anchor pass read the subscript "1" of u1 (page 8,
  y 737.589) as Question 1's heading, so Q1 was served only the last rows of Q2 (u1 = -6, d = 2) and Q2 the whole page.
  The workspace manifest already has the right bounds; the shipped WebPs were never re-rendered (the segmenter only
  renders a missing file).
- ib-ai-hl 2024-may-tz1-p3 (AI HL, May 2024, Paper 3, TZ1). The subscript "2" of mu2 (page 10, x 130) was read as
  Question 2's heading, so Q1 stopped at page 10 y 147.3 and Q2 started with Q1's remaining (h) and (i) rows.

Labels are the printed question numbers in the left margin (x < 50, body size); every other text line belongs to the
label before it. Every line must sit inside its owner's crops and inside no other question's crops. The build checks
that today's crops fail this exactly as diagnosed and that the repaired crops pass.

Crops use the segmenter's own rules (normalize_and_build_crops.py in the IB maths workspaces): full page width, the
start page from 8pt above the label, continuation pages from 45pt, the page bottom at height - 28 (no footer furniture
on these pages), at 1.75x. That renderer reproduces every served crop byte for byte (q90 WebP), which the build checks;
a crop whose bounds are already right is kept. New crops are lossless WebP, as for the earlier IB repairs.
Writes repairs.json and images/<sha256>.webp. Needs pymupdf and pillow.

usage: python -I scripts/build-ib-maths-ms-row-repairs.py <source pdf dir> <served dir> <out dir>
  <source pdf dir>  research/all-bank-crop-repair-20261002/ib-maths/source-cache
  <served dir>      today's R2 objects, as <bank>/<file name> (wrangler r2 object get)
"""
import hashlib, io, json, re, sys
from pathlib import Path
import pymupdf
from PIL import Image

SCALE = 1.75
TOP_LEAD, CONT_TOP, BOTTOM_MARGIN = 8.0, 45.0, 28.0
PAPERS = {
    'ib-hl': {
        'paper': '2021-may-tz1-p1',
        'pdf': '8912193df3bbfb5d4cabc6b6b64fb0dbb429841360ab6428b39a3b69eef33534.pdf',
        'sha256': '774a9e2157865907117e1c238c151bb9c7328be8edfc24ec1d79e818e126fdea',
        'cover': ['M21/5/MATHX/HP1/ENG/TZ1/XX/M', 'May 2021', 'analysis and approaches', 'Higher level', 'Paper 1'],
        'pageCount': 26,
        # (number, page, y0) of the printed labels the repaired questions need: their own and the next question's.
        'labels': [(1, 8, 110.269), (2, 8, 537.159), (3, 9, 85.429)],
        'questions': [1, 2],
        # Today's served crops: (page, top, bottom). Q1's top is the u1 subscript less 8pt (pixel-located, reproduced below).
        'served': {1: [(8, 729.589, 814.04)], 2: [(8, 45.0, 814.04)]},
    },
    'ib-ai-hl': {
        'paper': '2024-may-tz1-p3',
        'pdf': 'd93fe5ae18cc209e3f35c7686c8aa13441d2212431e7c4de42ecb5bc61c3dae7.pdf',
        'sha256': '701028832e8daa1a09a31dc6c50e1f38a1b4773a3a24e19732b41127050c7e73',
        'cover': ['2224 – 7203M', 'May 2024', 'Applications and interpretation', 'Higher level', 'Paper 3'],
        'pageCount': 14,
        'labels': [(1, 7, 97.173), (2, 12, 84.661)],
        'questions': [1, 2],
        'served': {1: [(7, 89.173, 814.04), (8, 45.0, 814.04), (9, 45.0, 814.04), (10, 45.0, 147.298)],
                   2: [(10, 147.298, 814.04), (11, 45.0, 814.04), (12, 45.0, 814.04), (13, 45.0, 814.04), (14, 45.0, 814.04)]},
    },
}
LABEL = re.compile(r'^(\d{1,2})\.?$')
FURNITURE = re.compile(r'^(?:–\s*\d+\s*–|M21/5/MATHX/HP1/ENG/TZ1/XX/M|2224\s*–\s*7203M|Question \d+ continued\.?|Section [AB])$')
PART_MARKS = re.compile(r'^(?!Total)(?:.*\s)?\[(\d+) marks?\]$')

def sha(b): return hashlib.sha256(b).hexdigest()
def fail(why): raise SystemExit(f'IB maths MS row repairs: {why}')

def lines(page):
    """(rect, text, size) of every text line."""
    out = []
    for b in page.get_text('dict')['blocks']:
        for ln in b.get('lines', []):
            text = ''.join(s['text'] for s in ln['spans']).strip()
            if text: out.append((pymupdf.Rect(ln['bbox']), text, max(s['size'] for s in ln['spans'])))
    return out

def printed_labels(doc):
    """Question-number labels in the left margin at body size; subscripts (size < 9) never qualify."""
    return [(int(LABEL.match(t).group(1)), pno, round(r.y0, 3)) for pno in range(1, len(doc) + 1)
            for r, t, size in lines(doc[pno - 1]) if r.x0 < 50 and size > 10 and LABEL.match(t)]

def owned_lines(doc, labels, questions):
    """{question: [(page, rect, text)]}: every non-furniture line after a label belongs to it, up to the next label.
    A line's middle decides, so tall glyphs on the label's own row (e.g. "(34, 4.1)") stay with it."""
    order = sorted(labels, key=lambda l: (l[1], l[2]))
    owned = {q: [] for q in questions}
    for pno in range(order[0][1], len(doc) + 1):
        for r, t, _ in lines(doc[pno - 1]):
            if FURNITURE.match(t): continue
            before = [l for l in order if (l[1], l[2]) <= (pno, (r.y0 + r.y1) / 2)]
            if before and before[-1][0] in owned: owned[before[-1][0]].append((pno, r, t))
    return owned

def audit(owned, crops):
    """Row-ownership problems of {question: [(page, top, bottom)]}, counted per page, owner and kind."""
    problems = {}
    def add(key): problems[key] = problems.get(key, 0) + 1
    for q, items in owned.items():
        for pno, r, t in items:
            mid = (r.y0 + r.y1) / 2
            if not any(p == pno and top <= mid <= bottom for p, top, bottom in crops[q]): add(f'p{pno}: q{q} lines outside q{q} crops')
            for other, cs in crops.items():
                if other != q and any(p == pno and top < mid < bottom for p, top, bottom in cs): add(f'p{pno}: q{q} lines inside a q{other} crop')
    return [f'{k} ({n})' for k, n in sorted(problems.items())]

def regions(doc, labels, q):
    """The segmenter's regions() with the true labels."""
    start = next(l for l in labels if l[0] == q)
    nxt = next((l for l in labels if l[0] == q + 1), None)
    last = nxt[1] if nxt else len(doc)
    out = []
    for pno in range(start[1], last + 1):
        height = doc[pno - 1].rect.height
        top = max(0.0, start[2] - TOP_LEAD) if pno == start[1] else CONT_TOP
        bottom = height - BOTTOM_MARGIN
        if nxt and pno == nxt[1]: bottom = min(bottom, nxt[2] - TOP_LEAD)
        if bottom > top + 35: out.append((pno, round(top, 3), round(bottom, 3)))
    return out

def render(doc, pno, top, bottom, **encoding):
    page = doc[pno - 1]
    pix = page.get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), clip=pymupdf.Rect(0, top, page.rect.width, bottom), alpha=False)
    im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    buf = io.BytesIO(); im.save(buf, 'WEBP', **encoding)
    return buf.getvalue(), im.size

def page_bottoms_have_no_footer(doc, pages):
    """The segmenter's _page_bottom falls back to height - 28 when nothing in the bottom quarter is footer furniture."""
    for pno in pages:
        page = doc[pno - 1]
        for r, t, _ in lines(page):
            if r.y0 > page.rect.height * 0.75 and (FURNITURE.match(t) or re.search(r'\b(?:IBO|International Baccalaureate|\d{4}\s*[–-]\s*\d+M?)\b', t)):
                fail(f'p{pno} has footer furniture "{t}"')

def main():
    src, served_dir, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    images, entries, sources, audits, label_report = {}, {}, {}, {'before': {}, 'after': {}}, {}
    for bank, cfg in PAPERS.items():
        data = (src / cfg['pdf']).read_bytes()
        if sha(data) != cfg['sha256']: fail(f'{bank}: pinned PDF bytes differ')
        doc = pymupdf.open(stream=data, filetype='pdf')
        cover = ' '.join(doc[0].get_text().split())
        if len(doc) != cfg['pageCount'] or not all(s in cover for s in cfg['cover']): fail(f'{bank}: not the {cfg["paper"]} scheme')
        # From Question 1's page on: the instruction pages before it have numbered lists of their own.
        labels = [l for l in printed_labels(doc) if l[1] >= cfg['labels'][0][1] and l[0] in {n for n, *_ in cfg['labels']}]
        if [(n, p, round(y, 1)) for n, p, y in labels] != [(n, p, round(y, 1)) for n, p, y in cfg['labels']]: fail(f'{bank}: labels moved: {labels}')
        labels = cfg['labels']
        questions = cfg['questions']
        owned = owned_lines(doc, labels, questions)
        page_bottoms_have_no_footer(doc, sorted({p for cs in cfg['served'].values() for p, *_ in cs}))

        # Today's crops come from the same renderer: each served object is reproduced byte for byte from its bounds.
        served_sha = {}
        for q, crops in cfg['served'].items():
            served_sha[q] = []
            for pno, top, bottom in crops:
                old = (served_dir / bank / f'{cfg["paper"]}-q{q}-page-{pno}.webp').read_bytes()
                if render(doc, pno, top, bottom, quality=90, method=0)[0] != old: fail(f'{bank} q{q} p{pno}: served crop not reproduced')
                served_sha[q].append(sha(old))
        before = audit(owned, cfg['served'])

        new = {q: regions(doc, labels, q) for q in questions}
        after = audit(owned, new)
        if after: fail(f'{bank}: repaired crops still fail: {after}')
        # Printed part marks ("[3 marks]", not "Total [5 marks]") of each question; the projection checks their sum.
        part_marks = {q: [int(PART_MARKS.match(t).group(1)) for _, _, t in owned[q] if PART_MARKS.match(t)] for q in questions}
        bank_entries = {}
        for q in questions:
            crops = []
            for pno, top, bottom in new[q]:
                rect = [0.0, top, round(doc[pno - 1].rect.width, 3), bottom]
                if (pno, top, bottom) in cfg['served'][q]:
                    crops.append({'method': 'kept', 'page': pno, 'sourceRect': rect, 'sha256': served_sha[q][cfg['served'][q].index((pno, top, bottom))]})
                    continue
                png, size = render(doc, pno, top, bottom, lossless=True, method=6)
                images[sha(png)] = png
                crops.append({'method': 'render', 'page': pno, 'sourceRect': rect, 'sha256': sha(png), 'bytes': len(png), 'dimensions': list(size)})
            bank_entries[f'{cfg["paper"]}-q{q}'] = {
                'servedPaths': [f'markschemes/{cfg["paper"]}-q{q}-page-{p}.webp' for p, *_ in cfg['served'][q]],
                'servedSha256': served_sha[q], 'crops': crops, 'partMarks': part_marks[q]}
        entries[bank] = bank_entries
        sources[bank] = {'markScheme': cfg['sha256'], 'pages': len(doc)}
        audits['before'][bank], audits['after'][bank] = before, after
        label_report[bank] = [{'question': n, 'page': p, 'y0': y} for n, p, y in labels]

    if audits['before'] != {
        'ib-hl': ['p8: q1 lines inside a q2 crop (32)', 'p8: q1 lines outside q1 crops (32)', 'p8: q2 lines inside a q1 crop (9)'],
        'ib-ai-hl': ['p10: q1 lines inside a q2 crop (67)', 'p10: q1 lines outside q1 crops (67)',
                     'p11: q1 lines inside a q2 crop (15)', 'p11: q1 lines outside q1 crops (15)'],
    }: fail(f'served crops do not fail as diagnosed: {audits["before"]}')
    (out / 'images').mkdir(parents=True, exist_ok=True)
    for h, data in sorted(images.items()): (out / 'images' / f'{h}.webp').write_bytes(data)
    package = {
        'schema': 'ib-maths-ms-row-repairs-v1', 'scale': SCALE, 'builderSha256': sha(Path(__file__).read_bytes()),
        'sources': sources, 'labels': label_report, 'entries': entries, 'audit': audits,
    }
    (out / 'repairs.json').write_text(json.dumps(package, indent=1) + '\n')
    print(json.dumps({'entries': sum(len(e) for e in entries.values()), 'newImages': len(images)}))

if __name__ == '__main__': main()
