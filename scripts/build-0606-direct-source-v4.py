"""Deterministic additive retrieval from pinned original-image reviews.
Model review is not independent gold. Raw classifications/assets are untouched.
"""
import argparse, copy, hashlib, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = '55dc0d47a8e440c4856dd6bc22e90fb230a7b745'
BASELINE_SEAL = 'fd96ba531c39cc4fb80107cdfdf895f30a0cdab0d5ea68543443729b0d565b86'
SOURCE_BINDINGS_SEAL = 'fe45cf99c317dbf7fce21b2f82269559fbed6fbb9b91b31650185aef5a9a0856'
def digest(data):
    return hashlib.sha256(data).hexdigest()
def encoded(obj):
    return (json.dumps(obj, ensure_ascii=False, indent=2) + '\n').encode()
def fingerprint(raw):
    values=[raw['id'],raw['year'],raw['component'],raw['primaryTopic'],raw.get('secondaryTopics',[]),raw.get('subtopics',[]),raw.get('skills',[]),raw.get('accessibleText',''),raw.get('questionImages',[])]
    text=json.dumps(values,ensure_ascii=False,separators=(',',':')).encode()
    h=2166136261
    for b in text: h=((h^b)*16777619)&0xffffffff
    return format(h,'x')
def build(bundle,raw_bytes,registry):
    assert bundle['baselineCommit']==BASE, 'baseline commit drift'
    assert bundle['rawSha256']==digest(raw_bytes), 'raw drift'
    baseline=bundle['baselineOverlay']
    assert digest(encoded(baseline))==bundle['baselineOverlaySeal']==BASELINE_SEAL, 'baseline seal drift'
    assert bundle['rawSha256']==baseline['sourceRawSha256'], 'baseline raw seal drift'
    assert digest(encoded(bundle['sourceBindings']))==SOURCE_BINDINGS_SEAL, 'source binding seal drift'
    assert baseline['syllabusPdfSha256']==registry['sourcePdfSha256'], 'syllabus drift'
    raw=json.loads(raw_bytes)['questions'];byraw={r['id']:r for r in raw}
    assert len(raw)==len(byraw)==1633, 'inventory drift'
    expected=bundle['expectedIds'];reviews=bundle['reviews'];byreview={r['id']:r for r in reviews}
    assert len(expected)==len(set(expected))==len(reviews)==len(byreview)==623, 'duplicate/count drift'
    assert set(expected)==set(byreview)<=set(byraw), 'review IDs drift'
    codes={r['code']for r in registry['sections']}
    output=copy.deepcopy(baseline);byid={r['id']:r for r in output['rows']}
    totals={'official-mapping':0,'historical-only':0};added=[]
    for review in reviews:
        id=review['id'];assert review['sourceHashes']==bundle['sourceBindings'][id], 'source hash drift'
        assert all(len(h)==64 and all(c in '0123456789abcdef' for c in h)for h in review['sourceHashes'].values()), 'malformed source hash'
        assert review['disposition'] in totals, 'unresolved review'
        assert review['parts'] and review['reason'], 'empty review'
        supported={}
        for part in review['parts']:
            assert part['part'] and part['printed_operation'] and part['qp_evidence'] and part['ms_evidence'], 'missing part evidence'
            assert set(part['codes'])<=codes, 'invalid section code'
            for code in part['codes']:supported.setdefault(code,[]).append(part)
        assert bool(supported)==(review['disposition']=='official-mapping'), 'disposition mismatch'
        totals[review['disposition']]+=1
        if not supported:continue
        row=byid.get(id)
        if row is None:
            row={'id':id,'inputFingerprint':fingerprint(byraw[id]),'sectionCodes':[],'evidenceByCode':{}}
            byid[id]=row
        assert row['inputFingerprint']==fingerprint(byraw[id]), 'fingerprint drift'
        for code in sorted(supported):
            if code not in row['sectionCodes']:
                row['sectionCodes'].append(code);row['evidenceByCode'][code]='direct-image-model-review'
                row.setdefault('directSourceEvidenceByCode',{})[code]={'sourceHashes':review['sourceHashes'],'parts':supported[code],'reviewLane':review['evidenceClass'],'inputReviewSha256':digest(encoded(review))}
                added.append({'id':id,'code':code})
        row['sectionCodes']=sorted(row['sectionCodes'])
    output['scope']='Additive original-image model reviews with bounded independent reconciliation; not exhaustive independent gold; legacy memberships/assets untouched.'
    output['rows']=sorted(byid.values(),key=lambda r:r['id'])
    for old in baseline['rows']:
        row=byid[old['id']]
        assert set(old['sectionCodes'])<=set(row['sectionCodes']), 'removed baseline link'
        assert all(row['evidenceByCode'][c]==v for c,v in old['evidenceByCode'].items()), 'baseline evidence changed'
    report={'baselineCommit':BASE,'inventory':1633,'frozenReviewed':623,'dispositions':totals,'currentSectionLinked':len(output['rows']),'addedLinks':added,'legacyAndAssets':'raw bytes unchanged','independentReviewCount':bundle['independentReviewCount'],'scope':output['scope']}
    return output,report
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    bundle=json.loads((ROOT/'docs/0606-direct-source-input-v4.json').read_text())
    raw=(ROOT/'src/data/raw/igcse-additional.json').read_bytes()
    registry=json.loads((ROOT/'src/data/igcse-0606-numbered-subtopics.json').read_text())
    overlay,report=build(bundle,raw,registry)
    for path,data in [(ROOT/'src/data/igcse-0606-section-retrieval-v3.json',overlay),(ROOT/'docs/0606-direct-source-reconciliation-v4.json',report)]:
        if args.check:assert path.read_bytes()==encoded(data),str(path)+' rebuild drift'
        else:path.write_bytes(encoded(data))
    print(json.dumps({k:v for k,v in report.items()if k!='addedLinks'}));print('addedLinks',len(report['addedLinks']))
if __name__=='__main__':main()
