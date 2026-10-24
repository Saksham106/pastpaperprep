"""Mark-scheme row repairs for 0455-2022-s-21 (Economics, Paper 21, May/June 2022). docs/economics-ms-row-repairs.md

Cambridge's published scheme numbers Question 4 wrongly: the 4(a) row ("Define privatisation.", page 18) has an
empty Question cell, and 4(b) and 4(c) (page 19) are both printed "4(d)". It has no row for 4(d) at all. The
segmenter owns rows by printed label, so the unlabelled 4(a) row went to Q3 (the 3(d) continuation above it) and
Q4 started on page 19. Q2's page-15 crop also ends inside the next table, showing a repeated header and the top
of the "3(a)" line.

Rows are the bands between the table's full-width rules. A row's owner is its printed question number, a
continuation row's owner is the row above, and the one unlabelled row is matched to the question paper by its
stem. Every word of every row must lie inside its owner's served crops and inside no other question's. The build
checks that today's crops fail this in exactly the diagnosed places and that the repaired crops pass.

Crops are rendered with the renderer each answer already uses: Q2 and Q3 with the segmenter's full-width method
(scripts/segmentation_pilot.py _render_asset in the source repo), Q4 with the written-answer grid method (1.5x
clip, lossless WebP). Both reproduce today's crops: the segmenter's pixel for pixel, the grid's byte for byte.
Writes repairs.json and images/<sha256>.webp. Needs pymupdf and pillow.

usage: python -I scripts/build-economics-ms-row-repairs.py <igcse-economics-0455-topic-practice> <written grid report> <out dir>
"""
import hashlib, io, json, sys
from pathlib import Path
import pymupdf
from PIL import Image

PAPER = '0455-2022-s-21'
MS_SHA = '1e24d415c6276140787970b5fc52f71fae7c6ae5b0a0ae4437d12092241c58bc'
QP_SHA = 'cd642b4c5030cb3708f8180a58203c8e99c18cbef6cb0c2f670ab8914e622c58'
GRID_SHA = '16ff7ea69e83d075bc5cecdd2db4f7a035537a809af07d2c5ffeb1037c07f97c'
SCALE = 1.5
RULE = 0.48  # every table rule on these pages is a 0.48pt filled rectangle
FURNITURE = {'Question', 'Answer', 'Marks', 'Guidance'}
QP_Q4 = [('a', 'Define privatisation.', 2),
         ('b', 'Explain the difference between absolute poverty and relative poverty.', 4),
         ('c', 'Analyse how specialisation can benefit firms.', 6),
         ('d', 'Discuss whether or not the use of supply-side policy measures will reduce unemployment.', 8)]
MS_Q4 = [('Define privatisation.', ''), ('Explain the difference between absolute and relative poverty.', '4(d)'),
         ('Analyse how specialisation can benefit firms.', '4(d)')]

def sha(b): return hashlib.sha256(b).hexdigest()
def fail(why): raise SystemExit(f'economics MS row repairs: {why}')

def rules(page):
    """Full-width horizontal rules (a table's top, row separators, bottom), in display space."""
    m, segs = page.rotation_matrix, {}
    for d in page.get_drawings():
        for it in d['items']:
            r = it[1] * m if it[0] == 're' else None
            if r is not None and r.height < 2 and r.width > 50: segs.setdefault(round(r.y0, 2), []).append((r.x0, r.x1))
    return sorted(y for y, s in segs.items() if min(a for a, _ in s) < 62 and max(b for _, b in s) > 780 and sum(b - a for a, b in s) > 600)

def words(page):
    m = page.rotation_matrix
    return [(pymupdf.Rect(w[:4]) * m, w[4]) for w in page.get_text('words')]

def first_line(inside):
    line = sorted(((r, t) for r, t in inside if 125 < r.x0 < 456), key=lambda w: (round(w[0].y0), w[0].x0))
    return ' '.join(t for r, t in line if round(r.y0) == round(line[0][0].y0)) if line else ''

def rows(doc):
    """[(page, top, bottom, words, printed label or '')] for every answer row of the mark-scheme tables."""
    out = []
    for pno in range(7, len(doc) + 1):
        page = doc[pno - 1]; ws = words(page); ys = rules(page)
        for top, bottom in zip(ys, ys[1:]):
            inside = [(r, t) for r, t in ws if top < (r.y0 + r.y1) / 2 < bottom]
            if not inside or any(t in FURNITURE for r, t in inside if r.x0 < 130): continue
            label = next((t for r, t in sorted(inside, key=lambda w: w[0].y0) if r.x0 < 120 and t[:1].isdigit()), '')
            out.append((pno, top, bottom, inside, label))
    return out

def audit(doc, served, unlabelled):
    """Row-ownership problems of {question number: [(page, rect)]}; unlabelled maps (page, row top) to its question."""
    problems, prev = [], None
    for pno, top, bottom, inside, label in rows(doc):
        owner = int(label.split('(')[0]) if label else unlabelled.get((pno, top), prev if top < 80 else None)
        prev, where = owner, f'p{pno} {top}-{bottom}'
        if owner is None: problems.append(f'{where}: unlabelled row "{first_line(inside)}"'); continue
        mine = [pymupdf.Rect(r) for p, r in served.get(owner, []) if p == pno]
        if any(not any(c.contains(r + (-0.5, -0.5, 0.5, 0.5)) for c in mine) for r, t in inside):
            problems.append(f'{where}: q{owner} row outside q{owner} crops')
        for q, crops in served.items():
            if q != owner and any(p == pno and any((pymupdf.Rect(c) & r).height > 0.5 and (pymupdf.Rect(c) & r).width > 0.5
                                                    for r, t in inside) for p, c in crops):
                problems.append(f'{where}: q{owner} row inside a q{q} crop')
    return problems

def render_grid(doc, pno, rect):
    pix = doc[pno - 1].get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), clip=pymupdf.Rect(rect), alpha=False)
    im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    buf = io.BytesIO(); im.save(buf, 'WEBP', lossless=True, method=4)
    return buf.getvalue(), im.size

def render_segment(doc, pno, rect):
    pix = doc[pno - 1].get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), alpha=False)
    with Image.open(io.BytesIO(pix.tobytes('png'))) as page:
        page.load(); im = page.crop(tuple(round(v * SCALE) for v in rect))
    buf = io.BytesIO(); im.save(buf, format='WEBP', lossless=True, method=6)
    return buf.getvalue(), im.size

def pixels(data):
    with Image.open(io.BytesIO(data)) as im: return im.convert('RGB').tobytes()

def main():
    source, grid_path, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    ms_bytes = (source / 'data/raw' / f'{PAPER}-markscheme.pdf').read_bytes()
    qp_bytes = (source / 'data/raw' / f'{PAPER}-question.pdf').read_bytes()
    grid_bytes = grid_path.read_bytes()
    seg_root = source / 'data/segmentation/full-repaired'
    seg_bytes = (seg_root / 'full-manifest.json').read_bytes()
    if sha(ms_bytes) != MS_SHA or sha(qp_bytes) != QP_SHA or sha(grid_bytes) != GRID_SHA: fail('pinned source bytes differ')
    doc = pymupdf.open(stream=ms_bytes, filetype='pdf'); qp = pymupdf.open(stream=qp_bytes, filetype='pdf')
    if not all(s in doc[0].get_text() for s in ('0455/21', 'May/June 2022', 'MARK SCHEME')) or len(doc) != 23: fail('not the 0455/21 May/June 2022 scheme')

    # The question paper's Question 4 against the scheme's rows for it.
    qp_text = ' '.join(qp[3].get_text().split())
    for part, stem, marks in QP_Q4:
        if f'({part}) {stem} [{marks}]' not in qp_text: fail(f'question paper 4({part}) differs')
    q4_rows = [(pno, top, bottom, first_line(inside), label) for pno, top, bottom, inside, label in rows(doc)
               if any(first_line(inside) == stem for stem, _ in MS_Q4)]
    if [(s, label) for *_, s, label in q4_rows] != MS_Q4: fail(f'Q4 rows differ: {q4_rows}')
    if any('supply-side' in p.get_text().lower() for p in doc): fail('the scheme has a 4(d) row after all')
    p4a, top4a, bottom4a = q4_rows[0][:3]
    if (p4a, top4a, bottom4a) != (18, 449.76, 524.82): fail('4(a) row moved')
    unlabelled = {(p4a, top4a): 4}

    # Served today: the written-answer grid crops (q1, q4, q5) and the segmenter's crops (q2, q3: held by that repair).
    grid = {r['qid']: r for r in json.loads(grid_bytes)['records'] if r['qid'].startswith(PAPER + '-q')}
    seg = {q['number']: q['mark_scheme_images'] for q in json.loads(seg_bytes)['papers'][PAPER]['questions']}
    served, served_sha = {}, {}
    for n in range(1, 6):
        g = grid[f'{PAPER}-q{n}']
        if g['state'] == 'source_grid_repair_candidate':
            served[n] = [(p, r) for p, r in g['newSegments']]; served_sha[n] = [c['sha256'] for c in g['candidates']]
        else:
            served[n] = [(i['source_page'], i['bounds']) for i in seg[n]]; served_sha[n] = [i['sha256'] for i in seg[n]]
    before = audit(doc, served, unlabelled)
    if before != ['p15 264.36-352.08: q3 row inside a q2 crop', 'p18 449.76-524.82: q4 row outside q4 crops',
                  'p18 449.76-524.82: q4 row inside a q3 crop']: fail(f'served crops do not fail as diagnosed: {before}')

    # Bounds come from the pages' own rules.
    r15, r18 = rules(doc[14]), rules(doc[17])
    end2 = max(y for y in r15 if y < 239.94)  # the rule closing 2(d), above the repeated header before 3(a)
    if end2 != 222.96 or top4a not in r18 or bottom4a not in r18: fail('rules moved')
    x0, x1 = 59.271 + RULE / 2, 782.151 + RULE / 2  # centres of the table's outer vertical rules
    images = {}

    def crop(pno, rect, method):
        data, size = (render_grid if method == 'grid' else render_segment)(doc, pno, rect)
        images[sha(data)] = data
        return {'method': method, 'page': pno, 'sourceRect': [round(v, 4) for v in rect], 'sha256': sha(data), 'bytes': len(data), 'dimensions': list(size)}

    def kept(n, i):
        p, r = served[n][i]
        return {'method': 'kept', 'page': p, 'sourceRect': [round(v, 4) for v in r], 'sha256': served_sha[n][i]}

    # The segmenter's renderer reproduces today's Q2/Q3 crops pixel for pixel (lossless encoder drift aside).
    for n, i in ((2, 3), (3, 3)):
        old = (seg_root / seg[n][i]['path']).read_bytes()
        if sha(old) != served_sha[n][i] or pixels(render_segment(doc, *served[n][i])[0]) != pixels(old): fail(f'q{n} renderer drift')
    # The grid renderer reproduces today's Q4 crop byte for byte; it stays Q4's page-19 crop.
    q4_today = crop(*served[4][0], 'grid')
    if q4_today['sha256'] != served_sha[4][0]: fail('q4 grid renderer drift')

    new = {
        2: [kept(2, 0), kept(2, 1), kept(2, 2), crop(15, [0.0, 72.543, 842.0, end2 + RULE], 'segment')],
        3: [kept(3, 0), kept(3, 1), kept(3, 2), crop(18, [0.0, 72.543, 842.0, top4a + RULE], 'segment')],
        4: [crop(18, [x0, top4a + RULE / 2, x1, bottom4a + RULE / 2], 'grid'), q4_today],
    }
    after = {**served, **{n: [(c['page'], c['sourceRect']) for c in crops] for n, crops in new.items()}}
    if audit(doc, after, unlabelled): fail(f'repaired crops still fail: {audit(doc, after, unlabelled)}')
    reasons = {
        2: 'Page-15 crop ended inside the next table (a repeated header and the top of the 3(a) line); it now ends at the rule closing 2(d).',
        3: 'Page-18 crop included the unlabelled 4(a) row ("Define privatisation."); it now ends at the rule closing 3(d).',
        4: 'Adds the 4(a) row from page 18 before the page-19 rows (printed "4(d)" twice by Cambridge: they are 4(b) and 4(c)).',
    }
    entries = {f'{PAPER}-q{n}': {'servedSha256': served_sha[n], 'crops': crops, 'reason': reasons[n]} for n, crops in new.items()}

    (out / 'images').mkdir(parents=True, exist_ok=True)
    for h, data in sorted(images.items()): (out / 'images' / f'{h}.webp').write_bytes(data)
    package = {
        'schema': 'economics-ms-row-repairs-v1', 'bank': 'igcse-economics-0455', 'scale': SCALE,
        'builderSha256': sha(Path(__file__).read_bytes()),
        'sources': {'markScheme': MS_SHA, 'questionPaper': QP_SHA, 'writtenGridReport': GRID_SHA, 'segmentationManifest': sha(seg_bytes)},
        'entries': entries,
        # Cambridge's published scheme (all mirrors checked) has no 4(d) row; the printed paper total stays 20.
        'officialSchemeGaps': {f'{PAPER}-q4': {
            'rows': [{'part': '4(a)', 'printedLabel': '', 'marks': 2}, {'part': '4(b)', 'printedLabel': '4(d)', 'marks': 4},
                     {'part': '4(c)', 'printedLabel': '4(d)', 'marks': 6}],
            'missingRows': ['4(d)'], 'schemeMarks': 12, 'printedMarks': 20}},
        'audit': {'before': before, 'after': []},
    }
    (out / 'repairs.json').write_text(json.dumps(package, indent=1) + '\n')
    print(json.dumps({'entries': len(entries), 'newImages': len(images)}))

if __name__ == '__main__': main()
