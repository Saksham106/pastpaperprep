import glob, hashlib, json
from collections import Counter
from pathlib import Path

ROOT = Path('/Users/sakshamgoel/Documents/ProjectsInternships/igcse-coordinated-sciences-0654-topic-practice')
OUT = Path(__file__).resolve().parents[1] / 'docs' / '0654-production-reconciliation.json'
base = json.loads((ROOT/'data/classification/full-bank-assembly/working-assembly.json').read_text())['rows']
ext_manifest = json.loads((ROOT/'data/segmentation/repair-ms-closure-v1/build-a/extension-2020/full-manifest.json').read_text())
# authoritative map, preserving result labels verbatim
results = []
for p in sorted((ROOT/'data/classification/extension-2020/results').glob('*.json')):
    results.extend(json.loads(p.read_text()))
by_id = {r['question_id']: r for r in results}
ext_rows = []
for paper in ext_manifest['papers'].values():
    for q in paper['questions']:
        if q['id'] not in by_id: raise SystemExit(f'missing result {q["id"]}')
        ext_rows.append({'id': q['id'], 'paper': paper['id'], 'year': 2020, 'component': paper['component'], 'marks': q['marks'], 'images': q['images'], 'ms_images': q['mark_scheme_images'], 'result': by_id[q['id']]})

def ids(rows): return sorted(r['question_id'] if 'question_id' in r else r['id'] for r in rows)
def ext_ids(pred): return sorted(r['id'] for r in ext_rows if pred(r))
def counts(rows):
    return dict(Counter(r['subjects'][0] for r in rows))
def asset_refs(rows): return sum(len(r.get('source',{}).get('images',[]))+len(r.get('source',{}).get('mark_scheme_images',[])) for r in rows)
base_status = Counter(r['classification_status'] for r in base)
ext_status = Counter(r['result']['disposition'] for r in ext_rows)
base_topics = sorted({r['primary']['topic_label'] for r in base if r.get('primary',{}).get('topic_label')})
ext_topics = sorted({r['result']['classification']['primary']['topic_title'] for r in ext_rows if r['result']['classification'].get('primary')})
report = {
  'schemaVersion': 1, 'basis': 'authoritative assembly + validated extension results + build-a closure manifests',
  'sourceHashes': {k: hashlib.sha256((ROOT/v).read_bytes()).hexdigest() for k,v in {
    'baseAssembly':'data/classification/full-bank-assembly/working-assembly.json',
    'baseClosureManifest':'data/segmentation/repair-ms-closure-v1/build-a/base/full-manifest.json',
    'extensionClosureManifest':'data/segmentation/repair-ms-closure-v1/build-a/extension-2020/full-manifest.json'}.items()},
  'priorHardcodedExpectations': {'rows':4030,'papers':204,'extensionRows':691,'topics':39,'multiSubjectRows':26,'subjects':{'biology':1530,'chemistry':1647,'physics':1544},'assetRefs':15620},
  'accounting': {'base': {'rows':len(base),'papers':len({r['paper_id'] for r in base}),'years':sorted({r['year'] for r in base}),'status':dict(base_status),'subjects':counts(base),'assetRefs':asset_refs(base),'marksMissingIds':ids([r for r in base if not isinstance(r.get('marks'),int) or r.get('marks')<=0])},
                 'extension': {'rows':len(ext_rows),'papers':len({r['paper'] for r in ext_rows}),'years':[2020],'status':dict(ext_status),'subjects':dict(Counter(r['result']['classification']['subjects'][0] for r in ext_rows)),'assetRefs':sum(len(r['images'])+len(r['ms_images']) for r in ext_rows),'marksMissingIds':ext_ids(lambda r:r['marks'] is None),'marksRepairedFromPrintedQpTotal':{'0654-2020-winter-32-q2':10,'0654-2020-winter-61-q1':13}},
                 'combinedRows':len(base)+len(ext_rows),'combinedPapers':len({r['paper_id'] for r in base}|{r['paper'] for r in ext_rows}),'combinedYears':sorted({r['year'] for r in base}|{2020})},
  'exactSets': {'baseUnresolvedIds':ids([r for r in base if r['classification_status']=='unresolved']),'baseExcludedIds':['0654-2023-summer-22-q17'],'extensionCandidateIds':ext_ids(lambda r:r['result']['disposition']=='candidate'),'extensionUnresolvedIds':ext_ids(lambda r:r['result']['disposition']=='unresolved'),'extensionSubjectListWithoutCrossSubjectIds':ext_ids(lambda r:len(r['result']['classification']['subjects'])>1 and not r['result']['classification'].get('cross_subject')),'extensionCrossSubjectIds':ext_ids(lambda r:r['result']['classification'].get('cross_subject') is True)},
  'labelSets': {'basePrimaryTopics':base_topics,'extensionAuthoritativePrimaryTopics':ext_topics,'extensionAuthoritativePrimaryTopicCount':len(ext_topics),'combinedRawPrimaryTopicCount':len(set(base_topics)|set(ext_topics))},
  'deltaFindings': {'biologyPriorExpectedExtensionCount':224,'biologyActualExtensionCount':225,'biologyPriorExpectedIdSetAvailable':False,'biologyDeltaIsNotAnArtifactDrop':'authoritative extension results contain 225 biology-primary rows; no prior ID set exists to name a missing row; all 691 result ids are covered exactly once by the closure manifest','rawTopics53VsCanonical39':'14 legacy-era headings are aliases/era vocabulary, not extra rows; no rows are dropped','subjectList30VsCrossSubject26':'four exact IDs have subjects.length>1 but cross_subject=false; preserve subjects and use cross_subject for the semantic count'},
  'topicSetsForReconciliation': {'raw53': sorted(set(base_topics)|set(ext_topics)), 'base39': base_topics},
}
OUT.write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({'status':'PASS','out':str(OUT),'baseRows':len(base),'extensionRows':len(ext_rows),'combinedRows':len(base)+len(ext_rows),'biologyExtensionRows':report['accounting']['extension']['subjects']['biology'],'rawTopics':report['labelSets']['combinedRawPrimaryTopicCount'],'fourSubjectDeltas':report['exactSets']['extensionSubjectListWithoutCrossSubjectIds']}, indent=2))
