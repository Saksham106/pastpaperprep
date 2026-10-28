"""Deterministic builder for the 2026-10-27 crop repairs (docs/ib-crop-repairs-v2.md).

Four repair families, each with its own content-addressed namespace:

  chemMs     IB Chemistry 2017-2019 mark schemes whose PDFs store landscape pages with /Rotate 90. The source lane
             normalised them with show_pdf_page, which shrank each page to 70.69 % and clipped its left third, so every
             answer crop lost the Question column and the start of the Answers column. Here the original PDF is
             de-rotated with Page.remove_rotation() (as the Biology segmenter does), the source engine's own anchor and
             region rules are re-run in display coordinates, and each crop is re-rendered at 1.75 px/pt, full width.
  stimulus   IB Chemistry shared stimuli ("Questions 13 and 14 are about ...", Paper 3 data blocks) that sit in no
             served crop, or only in the previous question's crop. Same rules as research/ib-shared-stimulus-audit-20261018.
  boundary   IB Physics Paper 1 questions whose next-question anchor was taken from an option label line, so option D (or
             B-D) was served at the top of the next question. Both crops on that page are re-cut at the real anchor - 8 pt.
  additional 0606 mark schemes missing a continuation row: 2019 Nov 23 Q6 (final A1 on page 6) and 2017 June 21 Q9 (9(i)
             rows on page 5, dropped by the source-grid repair).

Inputs are read-only: the app's raw runtime JSON and storage manifests (this worktree), and the sibling source
workspaces' PDFs and crop registries. Output: <out>/repairs.json and <out>/objects/<bank>/<namespace>/<sha256>.webp.
Rendering: pymupdf, alpha off; IB at Matrix(1.75) full page width, 0606 at 150/72 with the bank's x windows.
Images are lossless WebP, so a rebuild with the same libraries is byte-identical.

usage: python -I build_crops.py <worktree-root> <projects-root> <out-dir>
"""
import hashlib
import io
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import pymupdf
from PIL import Image

WORKTREE, PROJECTS, OUT = (Path(p).resolve() for p in sys.argv[1:4])
CHEM = PROJECTS / 'ib-chemistry-topic-practice'
PHYS = PROJECTS / 'ib-physics-topic-practice'
ADD = PROJECTS / 'igcse-additional-mathematics-0606-topic-practice'
CHEM_URL = 'https://saksham106.github.io/ib-chemistry-topic-practice/'
PHYS_URL = 'https://saksham106.github.io/ib-physics-topic-practice/'
IB_SCALE = 1.75
ADD_SCALE = 150 / 72
SHRINK = 595.22 / 842  # the faulty normalisation's scale, used only to compare against the old bounds


def ensure(cond, msg):
    if not cond:
        raise SystemExit('ASSERTION FAILED: ' + msg)


def sha_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha_file(path):
    return sha_bytes(Path(path).read_bytes())


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def encode(pix):
    image = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    buf = io.BytesIO()
    image.save(buf, 'WEBP', lossless=True, method=4, exact=True)
    return buf.getvalue(), image


def render(page, rect, scale):
    return encode(page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), clip=rect, alpha=False))


# --- Vendored from ib-chemistry-topic-practice/scripts/segment_papers.py (commit 2eb267c), unchanged in logic ---
MS_NUMBER_RE = re.compile(r'^(\d+)\.?$')
OPTION_RE = re.compile(r'^Option ([A-D])\s*[—–-]\s*(.+)$', re.IGNORECASE)
DOCUMENT_CODE_RE = re.compile(r'(?:[MN]\d{2}/4/CHEMI|\d{4}\s*[–-]\s*\d{4,}M?)', re.IGNORECASE)


@dataclass(frozen=True)
class TextLine:
    rect: pymupdf.Rect
    text: str


@dataclass(frozen=True)
class Anchor:
    number: int
    page: int
    y: float


def text_lines(page):
    groups = {}
    for word in page.get_text('words', sort=True):
        groups.setdefault((int(word[5]), int(word[6])), []).append(word)
    result = []
    for words in groups.values():
        ordered = sorted(words, key=lambda w: w[0])
        rect = pymupdf.Rect(min(w[0] for w in ordered), min(w[1] for w in ordered),
                            max(w[2] for w in ordered), max(w[3] for w in ordered))
        result.append(TextLine(rect, ' '.join(str(w[4]) for w in ordered).strip()))
    return sorted(result, key=lambda line: (line.rect.y0, line.rect.x0))


def structured_markscheme_anchors(document, expected_count):
    start_page = None
    for page_index, page in enumerate(document):
        lines = text_lines(page)
        normalized = {' '.join(line.text.split()).lower() for line in lines}
        has_columns = 'question' in normalized and 'answers' in normalized
        has_q1 = any(MS_NUMBER_RE.fullmatch(line.text.strip()) and int(MS_NUMBER_RE.fullmatch(line.text.strip()).group(1)) == 1
                     and line.rect.x0 < 100 for line in lines)
        if has_columns and has_q1:
            start_page = page_index
            break
    ensure(start_page is not None, 'could not find first answer table')
    expected, anchors = 1, []
    for page_index in range(start_page, len(document)):
        for line in text_lines(document[page_index]):
            match = MS_NUMBER_RE.fullmatch(line.text.strip())
            if match and line.rect.x0 < 100 and line.rect.y0 < document[page_index].rect.height - 55 and int(match.group(1)) == expected:
                anchors.append(Anchor(expected, page_index, line.rect.y0))
                expected += 1
                if expected > expected_count:
                    return anchors
    raise SystemExit('markscheme sequence ended at %d; expected %d' % (len(anchors), expected_count))


def clean_text(text):
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    lines = []
    for raw in text.replace(' ', ' ').replace('\x08', '').splitlines():
        line = ' '.join(raw.split())
        if line:
            lines.append(line)
    return '\n'.join(lines)


def page_bottom(page, after_y=0):
    boundaries = []
    for line in text_lines(page):
        text = ' '.join(line.text.split())
        is_footer = line.rect.y0 > page.rect.height * 0.88 and (DOCUMENT_CODE_RE.search(text) or re.fullmatch(r'[–-]\s*\d+\s*[–-]', text))
        is_next_section = text == 'Section B' or OPTION_RE.fullmatch(text)
        if line.rect.y0 > after_y + 18 and (is_footer or is_next_section):
            boundaries.append(line.rect.y0 - 6)
    return min(boundaries, default=page.rect.height - 34)


def anchor_regions(document, anchors, index):
    start = anchors[index]
    following = anchors[index + 1] if index + 1 < len(anchors) else None
    last_page = following.page if following else len(document) - 1
    regions = []
    for page_index in range(start.page, last_page + 1):
        page = document[page_index]
        top = max(0, start.y - 8) if page_index == start.page else 43
        bottom = page_bottom(page, top)
        if following and page_index == following.page:
            bottom = min(bottom, following.y - 8)
        if bottom > top + 18:
            regions.append((page_index, pymupdf.Rect(0, top, page.rect.width, bottom)))
    furniture = {'question', 'answers', 'answer', 'notes', 'total', 'continued'}
    regions = [(p, r) for p, r in regions if p == start.page or (
        clean_text(document[p].get_text('text', clip=r)) and
        set(re.findall(r'[a-z]+', clean_text(document[p].get_text('text', clip=r)).lower())) - furniture)]
    ensure(regions, 'empty regions for question %d' % start.number)
    return regions
# --- end vendored ---


COLUMN_HEADS = {'Question', 'Answers', 'Notes', 'Total'}


def settle(page, rect):
    """The engine's anchor - 8 pt edge can cut through the column-heading row just above a question's first row.
    A heading row cut by the top edge is taken in whole (students see the column names); one cut by the bottom
    edge is left out. Any other cut line is an error, raised by the straddling check."""
    top, bottom = rect.y0, rect.y1
    for line in text_lines(page):
        if line.text.strip() not in COLUMN_HEADS:
            continue
        if line.rect.y0 < top - 0.6 and line.rect.y1 > top + 0.6:
            top = line.rect.y0 - 3
        if line.rect.y0 < bottom - 0.6 and line.rect.y1 > bottom + 0.6:
            bottom = line.rect.y0 - 1
    return pymupdf.Rect(rect.x0, top, rect.x1, bottom)


def furniture_only(page, rect):
    for line in text_lines(page):
        if not rect.intersects(line.rect):
            continue
        t = line.text.strip()
        if t in COLUMN_HEADS or re.fullmatch(r'[–-]\s*\d+\s*[–-]', t) or DOCUMENT_CODE_RE.search(t) or re.fullmatch(r'\(?continued…?\)?', t, re.I):
            continue
        return False
    return True


def display_document(path):
    doc = pymupdf.open(path)
    for page in doc:
        if page.rotation:
            page.remove_rotation()
    return doc


def straddling(page, y, ignore_x_max=None):
    """Text lines cut by a horizontal boundary at y (0.6 pt tolerance)."""
    return [line.text for line in text_lines(page) if line.rect.y0 < y - 0.6 and line.rect.y1 > y + 0.6]


def words_in(page, rect):
    return [w[4] for w in page.get_text('words', clip=rect) if pymupdf.Rect(w[:4]).intersects(rect)]


HEADER_RE = re.compile(r'^(?:[–-]\s*\d+\s*[–-].*|.*[MN]\d{2}/4/CHEMI.*|continued.*|\(?continued…?\)?|Question|Answers|Notes|Total)$', re.IGNORECASE)


def pending_hashes(bank):
    manifest = load(WORKTREE / 'docs/ib-science-storage' / ('%s.pending-upload-manifest.json' % bank))
    return {asset['objectKey']: asset['sha256'] for asset in manifest['assets']}


def receipt_check():
    receipt = load(WORKTREE / 'docs/ib-science-storage/ib-science-r2-upload-receipt.json')
    ensure(receipt['status'] == 'verified-readback' and receipt['failures'] == 0, 'IB science upload receipt not verified')


def runtime(bank):
    return {q['id']: q for q in load(WORKTREE / 'src/data/raw' / ('%s.json' % bank))['questions']}


def rel_of(url, base):
    ensure(url.startswith(base), 'unexpected path %s' % url)
    return url[len(base):]


# ---------------------------------------------------------------- chemistry rotated mark schemes
def chem_ms():
    registry = load(CHEM / 'data/segmentation-extension/official-markscheme-images.json')
    qregistry = load(CHEM / 'data/segmentation-extension/question-images.json')
    out, objects, report = {}, {}, []
    papers = []
    for pdf in sorted((CHEM / 'data/raw-extension').glob('*-markscheme.pdf')):
        with pymupdf.open(pdf) as d:
            if any(p.rotation for p in d):
                papers.append(pdf.name[:-len('-markscheme.pdf')])
    ensure(len(papers) == 27, 'expected 27 rotated chemistry mark schemes, found %d' % len(papers))
    for bank in ('ib-chemistry-hl', 'ib-chemistry-sl'):
        rows = runtime(bank)
        hashes = pending_hashes(bank)
        level = '-hl-' if bank.endswith('hl') else '-sl-'
        for paper in [p for p in papers if level in p]:
            src = CHEM / 'data/raw-extension' / (paper + '-markscheme.pdf')
            paper_json = load(CHEM / 'data/papers-extension' / (paper + '.json'))
            ensure(paper_json['paper']['markscheme_pdf_source_sha256'] == sha_file(src), 'source PDF drift ' + paper)
            ids = sorted([k for k in qregistry if k.rsplit('-q', 1)[0] == paper], key=lambda k: int(k.rsplit('-q', 1)[1]))
            ensure([int(k.rsplit('-q', 1)[1]) for k in ids] == list(range(1, len(ids) + 1)), 'question registry gap ' + paper)
            doc = display_document(src)
            anchors = structured_markscheme_anchors(doc, len(ids))
            engine_by_q = {ids[i]: anchor_regions(doc, anchors, i) for i in range(len(ids))}
            regions_by_q = {q: [(p, settle(doc[p], r)) for p, r in regs] for q, regs in engine_by_q.items()}
            # A continuation strip that holds only the running header and column headings is not answer content (the
            # shrunk-frame run dropped these as too short); drop it here too.
            for q, regs in regions_by_q.items():
                kept = [(p, r) for i, (p, r) in enumerate(regs) if i == 0 or not furniture_only(doc[p], r)]
                if len(kept) != len(regs):
                    engine_by_q[q] = [er for (er, (p, r)) in zip(engine_by_q[q], regs) if (p, r) in kept]
                    regions_by_q[q] = kept
            # Paper coverage: every answer-table text line after Q1's anchor sits inside exactly one question's regions.
            first = anchors[0]
            for page_index in range(first.page, len(doc)):
                page = doc[page_index]
                for line in text_lines(page):
                    if page_index == first.page and line.rect.y1 <= first.y - 8:
                        continue
                    if HEADER_RE.match(line.text.strip()) and (line.rect.y0 < 60 or line.rect.y0 > page.rect.height - 60 or line.text.strip() in ('Question', 'Answers', 'Notes', 'Total')):
                        continue
                    if line.text.strip() == 'Section B' or OPTION_RE.fullmatch(' '.join(line.text.split())):
                        continue  # section and option headings sit between questions (page_bottom ends crops above them)
                    owners = [q for q, regs in regions_by_q.items() for p, r in regs if p == page_index and r.y0 - 0.6 <= line.rect.y0 and line.rect.y1 <= r.y1 + 0.6]
                    ensure(len(owners) == 1, '%s p%d line %r owned by %s' % (paper, page_index + 1, line.text[:60], owners))
            for qid in ids:
                row = rows.get(qid)
                if row is None:
                    report.append({'paper': paper, 'question': qid, 'note': 'not in runtime'})
                    continue
                raw_paths = row['officialMarkscheme']['images']
                if any(not p.startswith(CHEM_URL) for p in raw_paths) or any(re.search(r'-[0-9a-f]{12}\.webp$', p) for p in raw_paths):
                    report.append({'paper': paper, 'question': qid, 'note': 'already re-cut (docs/ib-chemistry-hl-2019-p2.md)'})
                    continue
                ensure(raw_paths == [CHEM_URL + i for i in registry[qid]['images']], 'runtime/registry drift ' + qid)
                regions = regions_by_q[qid]
                old_pages = registry[qid]['pages']
                new_pages = [p + 1 for p, _ in regions]
                new_paths, new_hashes, bounds = [], [], []
                for (page_index, rect) in regions:
                    page = doc[page_index]
                    ensure(page.rect.width > 800 and page.rect.height < 600, 'not landscape after de-rotation ' + paper)
                    ensure(not straddling(page, rect.y0) and not straddling(page, rect.y1), 'text cut at %s p%d %s' % (qid, page_index + 1, rect))
                    data, image = render(page, rect, IB_SCALE)
                    ensure(image.width == round(page.rect.width * IB_SCALE), 'width ' + qid)
                    # Question column and right border present: dark ink left of x=110 px and right of x=1350 px.
                    gray = image.convert('L')
                    left = sum(1 for y in range(image.height) if min(gray.getpixel((x, y)) for x in range(70, 110)) < 128)
                    right = sum(1 for y in range(image.height) if min(gray.getpixel((x, y)) for x in range(1350, 1420)) < 128)
                    ensure(left >= min(20, image.height // 3) and right >= min(20, image.height // 3), 'table edges missing %s p%d (left %d right %d h %d)' % (qid, page_index + 1, left, right, image.height))
                    sha = sha_bytes(data)
                    objects[(bank, sha)] = data
                    new_hashes.append(sha)
                    new_paths.append(sha)
                    bounds.append([page_index + 1, round(rect.y0, 3), round(rect.y1, 3)])
                # The first crop shows this question's own number in the Question column.
                p0, r0 = regions[0]
                own = [l for l in text_lines(doc[p0]) if MS_NUMBER_RE.fullmatch(l.text.strip()) and int(MS_NUMBER_RE.fullmatch(l.text.strip()).group(1)) == int(qid.rsplit('-q', 1)[1]) and l.rect.x0 < 100 and r0.y0 <= l.rect.y0 <= r0.y1]
                ensure(own, 'own anchor missing in first crop ' + qid)
                old_keys = [rel_of(p, CHEM_URL) for p in raw_paths]
                old_sha = [hashes[k] for k in old_keys]
                # Old bounds were in the shrunk frame: the de-rotated anchor bounds must map onto them.
                old_bounds = registry[qid]['bounds_pt']
                drift = None
                if old_pages == new_pages:
                    for (a, b), (_, er) in zip(old_bounds, engine_by_q[qid]):
                        na, nb = er.y0, er.y1
                        for old, new in ((a, na), (b, nb)):
                            if old in (43.0, 561.22) or new in (43.0, 561.22):
                                continue
                            d = abs((old + 8) / SHRINK - 8 - new)
                            drift = max(drift or 0, d)
                    ensure(drift is None or drift < 1.0, 'bounds disagree with the old registry for %s (%.2f pt)' % (qid, drift))
                out.setdefault(bank, {})[qid] = {
                    'oldPaths': raw_paths, 'oldSha256': old_sha, 'sha256': new_hashes, 'pages': new_pages,
                    'boundsPt': bounds, 'sourcePdf': str(src.relative_to(PROJECTS)), 'sourcePdfSha256': sha_file(src),
                }
                if old_pages != new_pages:
                    report.append({'paper': paper, 'question': qid, 'note': 'pages %s -> %s' % (old_pages, new_pages)})
            doc.close()
    return out, objects, report


# ---------------------------------------------------------------- shared stimuli (chemistry)
V1_STIMULUS_NAMESPACE = 'repairs/ib-shared-stimulus-v1-d53ab265e7e81518'


def stimulus():
    v1 = load(WORKTREE / 'src/data/reviewed-ib-shared-stimulus-repairs.json')
    ensure(v1['namespace'] == V1_STIMULUS_NAMESPACE, 'v1 shared stimulus namespace changed')
    out, objects, notes = {}, {}, []
    qregistry = load(CHEM / 'data/segmentation-extension/question-images.json')

    def raw_q(bank, qid):
        return runtime(bank)[qid]['questionImages']

    def hashes_for(bank, paths):
        h = pending_hashes(bank)
        return [h[rel_of(p, CHEM_URL)] for p in paths]

    def entry(bank, qid, new_paths, new_sha):
        old = raw_q(bank, qid)
        ensure(qid not in v1['banks'].get(bank, {}), 'already in v1 overlay ' + qid)
        out.setdefault(bank, {})[qid] = {'oldPaths': old, 'oldSha256': hashes_for(bank, old), 'newPaths': new_paths, 'sha256': new_sha}

    # 1. 2017 May TZ1 P3 (HL+SL): the Section A data block serves Q1-Q5; v1 attached it to Q1 only. Reuse v1's object.
    for bank, level in (('ib-chemistry-hl', 'hl'), ('ib-chemistry-sl', 'sl')):
        q1 = v1['banks'][bank]['2017-may-tz1-%s-p3-q1' % level]
        stim_path, stim_sha = q1['newPaths'][0], q1['sha256'][0]
        ensure(stim_path.startswith(V1_STIMULUS_NAMESPACE + '/'), 'v1 stimulus path')
        for n in (2, 3, 4, 5):
            qid = '2017-may-tz1-%s-p3-q%d' % (level, n)
            old = raw_q(bank, qid)
            entry(bank, qid, [stim_path] + old, [stim_sha] + hashes_for(bank, old))
        notes.append('%s 2017-may-tz1 P3 Q2-Q5 reuse %s' % (bank, stim_path))

    # 2. Captioned P1 stimuli. (bank, paper, page, caption, served questions, previous question, previous mode)
    specs = [
        ('ib-chemistry-sl', '2019-november-tz0-sl-p1', 7, 'Questions 13 and 14 are about', [13, 14], 12, 'drop'),
        ('ib-chemistry-hl', '2019-november-tz0-hl-p1', 7, 'Questions 14 and 15 are about', [14, 15], 13, 'recut'),
        ('ib-chemistry-hl', '2017-may-tz2-hl-p1', 9, 'Questions 18 and 19 refer to', [18, 19], 17, 'drop'),
        ('ib-chemistry-sl', '2017-may-tz2-sl-p1', 7, 'Questions 16 and 17 refer to', [16, 17], 15, 'recut'),
    ]
    for bank, paper, page_no, caption, served, prev, mode in specs:
        src = CHEM / 'data/raw-extension' / (paper + '-question.pdf')
        doc = pymupdf.open(src)
        ensure(not any(p.rotation for p in doc), 'rotated QP ' + paper)
        page = doc[page_no - 1]
        cap = [l for l in text_lines(page) if l.text.startswith(caption)]
        ensure(len(cap) == 1, 'caption not unique ' + paper)
        top = cap[0].rect.y0 - 6
        first = '%s-q%d' % (paper, served[0])
        reg = qregistry[first]
        if reg['pages'][0] == page_no:
            bottom = reg['bounds_pt'][0][0]
        else:
            # The served questions start on the next page: the stimulus runs to the previous question's page bottom.
            preg0 = qregistry['%s-q%d' % (paper, prev)]
            ensure(reg['pages'][0] == page_no + 1 and page_no in preg0['pages'], 'stimulus page layout ' + paper)
            bottom = preg0['bounds_pt'][preg0['pages'].index(page_no)][1]
        rect = pymupdf.Rect(0, top, page.rect.width, bottom)
        inside = [l.text for l in text_lines(page) if rect.contains(l.rect)]
        ensure(not any(re.fullmatch(r'\d+\.', t.split()[0]) for t in inside if t.split()), 'question number inside stimulus ' + paper)
        ensure(not straddling(page, top) and not straddling(page, bottom), 'stimulus cuts text ' + paper)
        data, _ = render(page, rect, IB_SCALE)
        sha = sha_bytes(data)
        objects[(bank, sha)] = data
        prev_id = '%s-q%d' % (paper, prev)
        prev_old = raw_q(bank, prev_id)
        prev_reg = qregistry[prev_id]
        ensure(prev_old == [CHEM_URL + i for i in prev_reg['images']], 'runtime/registry drift ' + prev_id)
        new_paths, new_sha = [], []
        prev_hashes = hashes_for(bank, prev_old)
        for path, h, p, (a, b) in zip(prev_old, prev_hashes, prev_reg['pages'], prev_reg['bounds_pt']):
            if p != page_no:
                new_paths.append(path); new_sha.append(h); continue
            if mode == 'drop':
                # The dropped crop holds only the page header and the stimulus.
                clip = pymupdf.Rect(0, a, page.rect.width, b)
                body = [l.text for l in text_lines(page) if clip.contains(l.rect) and l.rect.y0 >= top - 0.6]
                head = [l.text for l in text_lines(page) if clip.contains(l.rect) and l.rect.y1 <= top + 0.6]
                ensure(all(HEADER_RE.match(t) or re.fullmatch(r'[–-]\s*\d+\s*[–-]', t) or 'CHEMI' in t for t in head), 'dropped crop holds more than header ' + prev_id)
                ensure(abs(b - bottom) < 0.01, 'dropped crop does not end at stimulus bottom ' + prev_id)
                notes.append('%s drops %s (header + stimulus only)' % (prev_id, path.rsplit('/', 1)[1]))
                continue
            ensure(a < top < b, 'stimulus not inside previous crop ' + prev_id)
            cut = pymupdf.Rect(0, a, page.rect.width, top)
            ensure(not straddling(page, top), 're-cut cuts text ' + prev_id)
            rest = [l.text for l in text_lines(page) if l.rect.y0 >= top - 0.6 and l.rect.y1 <= b + 0.6]
            ensure(not any(re.fullmatch(r'[A-D]\.', t.split()[0]) for t in rest if t.split()), 'option left below re-cut ' + prev_id)
            pdata, _ = render(page, cut, IB_SCALE)
            psha = sha_bytes(pdata)
            objects[(bank, psha)] = pdata
            new_paths.append(psha); new_sha.append(psha)
        ensure(new_paths, 'previous question would be empty ' + prev_id)
        entry(bank, prev_id, new_paths, new_sha)
        for n in served:
            qid = '%s-q%d' % (paper, n)
            old = raw_q(bank, qid)
            entry(bank, qid, [sha] + old, [sha] + hashes_for(bank, old))
        out[bank]['_stimulus:' + paper] = {'page': page_no, 'boundsPt': [round(top, 3), round(bottom, 3)], 'sha256': sha,
                                            'sourcePdf': str(src.relative_to(PROJECTS)), 'sourcePdfSha256': sha_file(src)}
        doc.close()
    return out, objects, notes


# ---------------------------------------------------------------- physics question boundaries
PHYSICS_PAIRS = [
    ('ib-physics-sl', '2018-may-tz1-sl-p1', 2, 3),
    ('ib-physics-hl', '2017-may-tz1-hl-p1', 15, 16),
    ('ib-physics-hl', '2018-may-tz1-hl-p1', 1, 2),
    ('ib-physics-hl', '2018-may-tz1-hl-p1', 5, 6),
    ('ib-physics-sl', '2017-may-tz1-sl-p1', 18, 19),
    ('ib-physics-sl', '2017-may-tz2-sl-p1', 5, 6),
    ('ib-physics-sl', '2018-may-tz2-sl-p1', 12, 13),
]


def physics():
    registry = load(PHYS / 'data-extension/data/question-images.json')
    out, objects, notes = {}, {}, []
    for bank, paper, prev, nxt in PHYSICS_PAIRS:
        rows = runtime(bank)
        hashes = pending_hashes(bank)
        src = PHYS / 'data-extension/data/raw' / (paper + '-question.pdf')
        doc = pymupdf.open(src)
        prev_id, next_id = '%s-q%d' % (paper, prev), '%s-q%d' % (paper, nxt)
        preg, nreg = registry[prev_id], registry[next_id]
        page_no = nreg['pages'][0]
        ensure(preg['pages'][-1] == page_no, 'pair not on one page ' + paper)
        page = doc[page_no - 1]
        wrong = nreg['bounds_pt'][0][0]
        ensure(abs(preg['bounds_pt'][-1][1] - wrong) < 0.01, 'crops not adjacent ' + paper)
        real = [l for l in text_lines(page) if l.text.split() and l.text.split()[0] == '%d.' % nxt and l.rect.x0 < 90]
        ensure(len(real) == 1, 'real anchor not unique %s q%d' % (paper, nxt))
        cut = real[0].rect.y0 - 8
        ensure(cut > wrong + 10, 'anchor not below served top ' + next_id)
        gap = [l.text for l in text_lines(page) if l.rect.y1 > wrong + 0.6 and l.rect.y0 < cut - 0.6]
        ensure(any(re.match(r'^[B-D]\.', t) for t in gap), 'no option label in the moved band ' + next_id)
        ensure(not any(re.match(r'^\d+\.', t) for t in gap), 'question number in moved band ' + next_id)
        ensure(not straddling(page, cut), 'boundary cuts text ' + paper)
        for qid, reg, new_rect_for in ((prev_id, preg, lambda a, b: (a, cut)), (next_id, nreg, lambda a, b: (cut, b))):
            raw = rows[qid]['questionImages']
            ensure(raw == [PHYS_URL + i for i in reg['images']], 'runtime/registry drift ' + qid)
            new_paths, new_sha = [], []
            for path, p, (a, b) in zip(raw, reg['pages'], reg['bounds_pt']):
                h = hashes[rel_of(path, PHYS_URL)]
                if p != page_no:
                    new_paths.append(path); new_sha.append(h); continue
                y0, y1 = new_rect_for(a, b)
                data, image = render(page, pymupdf.Rect(0, y0, page.rect.width, y1), IB_SCALE)
                ensure(image.width == 1042, 'physics width')
                sha = sha_bytes(data)
                objects[(bank, sha)] = data
                new_paths.append(sha); new_sha.append(sha)
            marks = rows[qid]['marks']
            out.setdefault(bank, {})[qid] = {
                'oldPaths': raw, 'oldSha256': [hashes[rel_of(p, PHYS_URL)] for p in raw], 'newPaths': new_paths, 'sha256': new_sha,
                'marks': {'old': marks, 'new': marks}, 'boundaryPt': {'page': page_no, 'servedTop': wrong, 'repairedTop': round(cut, 3)},
                'sourcePdf': str(src.relative_to(PROJECTS)), 'sourcePdfSha256': sha_file(src),
            }
        notes.append('%s: q%d/q%d boundary %.1f -> %.1f pt (moved: %s)' % (paper, prev, nxt, wrong, cut, ' | '.join(gap)[:80]))
        doc.close()
    return out, objects, notes


# ---------------------------------------------------------------- 0606 continuation rows
def h_rules(page, min_width=40):
    ys = set()
    for drawing in page.get_drawings():
        for item in drawing['items']:
            if item[0] == 'l':
                a, b = item[1], item[2]
                if abs(a.y - b.y) < 0.5 and abs(a.x - b.x) >= min_width:
                    ys.add(round(a.y, 2))
            elif item[0] == 're':
                r = item[1]
                if r.height <= 1.0 and r.width >= min_width:
                    ys.add(round((r.y0 + r.y1) / 2, 2))
    return sorted(ys)


def additional():
    registry = {x['id']: x for x in load(ADD / 'data/markscheme-images.json')['images']}
    maths = load(WORKTREE / 'src/data/reviewed-maths-source-answer-repairs.json')['igcse-additional']
    rows = runtime('igcse-additional')
    out, objects, notes = {}, {}, []

    # 2019 Nov 23 Q6: final row of 6(ii) at the top of MS page 6, above 7(i).
    qid = '0606-2019-november-23-q6'
    reg = registry[qid]
    src = ADD / reg['source_pdf']
    ensure(sha_file(src) == reg['source_sha256'], 'source drift ' + qid)
    ensure(qid not in maths, 'unexpected maths repair ' + qid)
    doc = pymupdf.open(src)
    page = doc[5]
    lines = text_lines(page)
    seven = [l for l in lines if l.text.startswith('7(i)')]
    ensure(len(seven) == 1, '7(i) label')
    header = [l for l in lines if l.text.startswith('Question')]
    ensure(len(header) == 1, 'table header')
    rules = h_rules(page)
    top = min(y for y in rules if y > header[0].rect.y1)
    bottom = max(y for y in rules if y < seven[0].rect.y0)
    rect = pymupdf.Rect(42, top - 1, 555, bottom + 1)
    body = ' '.join(l.text for l in lines if l.rect.y0 > top and l.rect.y1 < bottom)
    ensure('A1' in body and 'AC' in body and '7(' not in body, '6(ii) final row text: %r' % body)
    data, image = render(page, rect, ADD_SCALE)
    sha = sha_bytes(data)
    objects[('igcse-additional', sha)] = data
    raw = rows[qid]['markschemeImages']
    ensure(raw == ['markschemes/%s.webp' % qid], 'raw path ' + qid)
    out[qid] = {'oldPaths': raw, 'oldSha256': [reg['sha256']], 'newPaths': raw + [sha], 'sha256': [reg['sha256'], sha],
                'segments': [None, {'page': 6, 'rectPt': [round(v, 3) for v in rect], 'size': list(image.size)}],
                'sourcePdf': str(src.relative_to(PROJECTS)), 'sourcePdfSha256': reg['source_sha256']}
    notes.append('%s: adds page 6 row %.1f-%.1f pt (%s)' % (qid, top, bottom, body[:60]))
    doc.close()

    # 2017 June 21 Q9: 9(i) rows on MS page 5; the source-grid repair kept only 9(ii) on page 6.
    qid = '0606-2017-june-21-q9'
    reg = registry[qid]
    src = ADD / reg['source_pdf']
    ensure(sha_file(src) == reg['source_sha256'], 'source drift ' + qid)
    grid = maths[qid]
    ensure(len(grid['newPaths']) == 1, 'grid repair shape ' + qid)
    doc = pymupdf.open(src)
    page = doc[4]
    lines = text_lines(page)
    nine = [l for l in lines if l.text.startswith('9(i)')]
    ensure(len(nine) == 1, '9(i) label')
    rules = h_rules(page)
    top = max(y for y in rules if y < nine[0].rect.y0)
    content = [l for l in lines if l.rect.y0 > nine[0].rect.y0 - 2 and l.rect.y0 < page.rect.height - 80]
    bottom = min(y for y in rules if y > max(l.rect.y1 for l in content))
    rect = pymupdf.Rect(34.38, top - 1, 561.0, bottom + 1)
    body = ' '.join(l.text for l in lines if l.rect.y0 > top and l.rect.y1 < bottom)
    ensure('ubstitution' in body and '9(i)' in body and '1092' not in body and 'UCLES' not in body, '9(i) text: %r' % body)
    data, image = render(page, rect, ADD_SCALE)
    sha = sha_bytes(data)
    objects[('igcse-additional', sha)] = data
    served = grid['newPaths']
    out[qid] = {'oldPaths': served, 'oldSha256': grid['sha256'], 'newPaths': [sha] + served, 'sha256': [sha] + grid['sha256'],
                'segments': [{'page': 5, 'rectPt': [round(v, 3) for v in rect], 'size': list(image.size)}, None],
                'sourcePdf': str(src.relative_to(PROJECTS)), 'sourcePdfSha256': reg['source_sha256']}
    notes.append('%s: adds page 5 rows %.1f-%.1f pt before the grid crop' % (qid, top, bottom))
    doc.close()
    return out, objects, notes


def namespace(prefix, entries_json):
    return 'repairs/%s-%s' % (prefix, sha_bytes(json.dumps(entries_json, sort_keys=True).encode())[:16])


def finish(family_out, objects, prefix, banked=True):
    ns = namespace(prefix, family_out)
    produced = set(sha for _, sha in objects)

    def fix(paths):
        return ['%s/%s.webp' % (ns, p) if p in produced else p for p in paths]

    if banked:
        for bank, entries in family_out.items():
            for qid, e in entries.items():
                if qid.startswith('_'):
                    continue
                e['newPaths'] = fix(e.get('newPaths', e['sha256']))
    else:
        for e in family_out.values():
            e['newPaths'] = fix(e['newPaths'])
    return ns


def main():
    receipt_check()
    OUT.mkdir(parents=True, exist_ok=True)
    result = {'schema': 'ib-crop-repairs-v2-package', 'builderSha256': sha_file(Path(__file__)), 'families': {}}
    all_objects = []
    for name, fn, prefix, banked in (('chemMs', chem_ms, 'ib-chem-rotated-ms-v1', True), ('stimulus', stimulus, 'ib-shared-stimulus-v2', True),
                                      ('boundary', physics, 'ib-question-boundary-v2', True), ('additional', additional, '0606-ms-continuation-v1', False)):
        fam, objects, notes = fn()
        ns = finish(fam, objects, prefix, banked)
        files = []
        for (bank, sha), data in sorted(objects.items()):
            rel = '%s/%s.webp' % (ns, sha)
            target = OUT / 'objects' / bank / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            with Image.open(io.BytesIO(data)) as im:
                size = list(im.size)
            files.append({'bank': bank, 'path': rel, 'objectKey': '%s/%s' % (bank, rel), 'sha256': sha, 'bytes': len(data), 'width': size[0], 'height': size[1]})
        result['families'][name] = {'namespace': ns, 'entries': fam, 'objects': files, 'notes': notes}
        all_objects += files
        print('%s: %s, %d objects, %d bytes' % (name, ns, len(files), sum(f['bytes'] for f in files)), flush=True)
    (OUT / 'repairs.json').write_text(json.dumps(result, indent=1, sort_keys=True) + '\n')
    print('total objects', len(all_objects))


if __name__ == '__main__':
    main()
