import pathlib,json,hashlib,collections,math
W=pathlib.Path(__file__).resolve().parents[1]
ROOT=W/'docs'
rawbytes=(W/'src/data/raw/igcse-additional.json').read_bytes();raw=json.loads(rawbytes)['questions'];T=json.loads((W/'src/data/igcse-0606-numbered-subtopics.json').read_text());valid={s['code']for s in T['sections']};assert len(raw)==1633 and len({r['id']for r in raw})==1633
accepted={r['id']:{}for r in raw}
model=json.loads((W/'src/data/igcse-0606-multilabel-section-overlay.json').read_text());assert model['sourceRawSha256']==hashlib.sha256(rawbytes).hexdigest() and model['officialSyllabusSha256']==T['sourcePdfSha256']
assert len({r['id']for r in model['rows']})==len(model['rows'])
for r in model['rows']:
 assert r['id']in accepted and set(r['scores'])<=set(r['codes']) and set(r['codes'])<=valid
 assert all(type(v)in(int,float)and math.isfinite(v)and 0<=v<=1 for v in r['scores'].values())
 for code,score in r['scores'].items():
  if score >= (.9 if code in {"14.4","14.11"} else .95):accepted[r['id']][code]='sample-calibrated-model'
for r in raw:
 for label,code in [('Simultaneous equations','5.1'),('Circular measure','9.1')]:
  if label in r['subtopics']:accepted[r['id']][code]='deterministic-correspondence'
for r in json.loads((ROOT/'0606-source-adjudication-v3.json').read_text())['records']:
 for part in r['parts']:
  for code in part['official_codes']:accepted[r['id']][code]='source-reviewed'
def fingerprint(r):
 v=json.dumps([r['id'],r.get('year'),r.get('component'),r.get('primaryTopic'),r.get('secondaryTopics',[]),r.get('subtopics',[]),r.get('skills',[]),r.get('accessibleText',''),r.get('questionImages',[])],ensure_ascii=False,separators=(',',':')).encode();h=2166136261
 for b in v:h=((h^b)*16777619)&0xffffffff
 return format(h,'x')
rows=[]
for r in sorted(raw,key=lambda r:r['id']):
 links=accepted[r['id']];assert set(links)<=valid
 if links:rows.append({'id':r['id'],'inputFingerprint':fingerprint(r),'sectionCodes':sorted(links),'evidenceByCode':links})
out={'schemaVersion':1,'sourceRawSha256':hashlib.sha256(rawbytes).hexdigest(),'syllabusPdfSha256':T['sourcePdfSha256'],'expectedInventoryCount':1633,'scope':'Conservative additive links, not exhaustive semanticclassificationclosure. Historicalfinefilters retained. Per-linksource/modelprovenance.','rows':rows}
(W/'src/data/igcse-0606-section-retrieval-v3.json').write_text(json.dumps(out,indent=2)+'\n');counts=collections.Counter(t for r in rows for t in r['evidenceByCode'].values());coverage=[{'code':s['code'],'title':s['displayTitle'],'count':sum(s['code']in r['sectionCodes']for r in rows)}for s in T['sections']];report={'rows':len(rows),'legacyOnly':1633-len(rows),'evidence':dict(counts),'sections':coverage,'zeroSections':[s for s in coverage if s['count']==0]};(ROOT/'0606-accepted-summary-v3.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
