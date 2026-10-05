"""Rebuild additive 0580 source-image retrieval from portable sealed evidence."""
import argparse, copy, hashlib, json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE='55dc0d47a8e440c4856dd6bc22e90fb230a7b745'
BASELINE_SEAL='53cd6d9f2d1dae4a92218d2125a8c90cb039c0d6ff730bfeb70850c85bac173b'
SOURCE_SEAL='0ed8a135db73385899565a06923445bb6e4af9c1a8fd11458b8a8aaf9f629797'
SCOPES_SEAL='ea071f8305c7cf250b34730a9ee3cb62eef253736d806846594b7003924d91a2'
ALLOWED_REMOVALS={('0580-2022-november-22-q10','E1.8')}
def encoded(x):return (json.dumps(x,ensure_ascii=False,indent=2)+'\n').encode()
def digest(x):return hashlib.sha256(x).hexdigest()
def fingerprint(r):
 values=[r['id'],r.get('year'),r.get('component'),r.get('primaryTopic'),r.get('secondaryTopics',[]),r.get('subtopics',[]),r.get('skills',[]),r.get('accessibleText',''),r.get('questionImages',[])]
 h=2166136261
 for b in json.dumps(values,ensure_ascii=False,separators=(',',':')).encode():h=((h^b)*16777619)&0xffffffff
 return format(h,'x')
def build(bundle,raw_bytes,registry):
 assert bundle['baselineCommit']==BASE,'baseline commit drift'
 baseline=bundle['baselineOverlay']
 assert digest(encoded(baseline))==BASELINE_SEAL,'baseline seal drift'
 assert digest(encoded(bundle['sourceBindings']))==SOURCE_SEAL,'source binding seal drift'
 assert digest(encoded(bundle['scopes']))==SCOPES_SEAL,'scoped IDs drift'
 assert digest(raw_bytes)==baseline['sourceRawSha256'],'raw drift'
 assert baseline['officialSyllabusSha256']==registry['sourcePdfSha256'],'syllabus drift'
 raw=json.loads(raw_bytes)['questions'];byraw={r['id']:r for r in raw}
 assert len(raw)==len(byraw)==3967,'inventory drift'
 expected=bundle['scopes']['remaining']+bundle['scopes']['secondary'];reviews=bundle['reviews'];byreview={r['id']:r for r in reviews}
 assert len(expected)==len(set(expected))==len(reviews)==len(byreview)==1277,'duplicate/count drift'
 assert set(expected)==set(byreview)==set(bundle['sourceBindings']),'review IDs drift'
 sections=[s for t in registry['topics']for s in t['sections']];codes={c for s in sections for c in [s.get('coreCode'),s.get('extendedCode')]if c}
 assert len(sections)==72 and len(codes)==125,'registry drift'
 output=copy.deepcopy(baseline);byid={r['id']:r for r in output['rows']}
 assert len(byid)==2794 and not(set(bundle['scopes']['remaining'])&set(byid)) and set(bundle['scopes']['secondary'])<=set(byid),'baseline scoped membership drift'
 totals={'official-mapping':0,'historical-only':0};added=[];removed=[];sourceEvidenceByLink={}
 for review in reviews:
  id=review['id'];assert id in byraw and review['sourceHashes']==bundle['sourceBindings'][id],'source hash drift'
  assert set(review['sourceHashes'])=={'QP','MS'} and all(len(h)==64 and all(c in '0123456789abcdef'for c in h)for h in review['sourceHashes'].values()),'malformed source hash'
  assert review['disposition']in totals and review['parts']and review['reason'],'unresolved/empty review'
  tier='C'if str(byraw[id]['component'])[0]in'13'else'E';supported={}
  for part in review['parts']:
   assert part['part']and part['printed_operation']and part['qp_evidence']and part['ms_evidence'],'missing part evidence'
   assert set(part['codes'])<=codes and all(c.startswith(tier)for c in part['codes']),'invalid code/tier'
   for code in part['codes']:supported.setdefault(code,[]).append(part)
  assert bool(supported)==(review['disposition']=='official-mapping'),'disposition mismatch'
  totals[review['disposition']]+=1
  row=byid.get(id)
  for code in review.get('removeBaselineCodes',[]):
   assert (id,code)in ALLOWED_REMOVALS and row and code in row['sectionCodes'],'unapproved removal'
   row['sectionCodes'].remove(code);row['evidenceByCode'].pop(code);removed.append({'id':id,'code':code,'reason':review['reason'],'sourceHashes':review['sourceHashes']})
  if not supported:continue
  if row is None:row={'id':id,'inputFingerprint':fingerprint(byraw[id]),'sectionCodes':[],'evidenceType':'per-link','evidenceByCode':{}};byid[id]=row
  assert row['inputFingerprint']==fingerprint(byraw[id]),'fingerprint drift'
  for code in sorted(supported):
   if code not in row['sectionCodes']:
    row['sectionCodes'].append(code);row['evidenceByCode'][code]='direct-image-model-review'
    reviewHash=digest(encoded(review))
    row.setdefault('directSourceReviewSha256ByCode',{})[code]=reviewHash
    sourceEvidenceByLink[id+':'+code]={'sourceHashes':review['sourceHashes'],'parts':supported[code],'reviewLane':review['evidenceClass'],'inputReviewSha256':reviewHash};added.append({'id':id,'code':code})
  row['sectionCodes']=sorted(row['sectionCodes'])
 assert {(r['id'],r['code'])for r in removed}==ALLOWED_REMOVALS,'required source correction missing'
 for old in baseline['rows']:
  row=byid[old['id']]
  for code in old['sectionCodes']:
   if (old['id'],code)not in ALLOWED_REMOVALS:assert code in row['sectionCodes']and row['evidenceByCode'][code]==old['evidenceByCode'][code],'baseline link/evidence removed'
 output['rows']=sorted(byid.values(),key=lambda r:r['id']);output['scope']='All1173 remaining original-image model reviews plus104 legacy indices/surds secondary reviews; bounded6 independent source checks; one explicit false standard-form correction. Not exhaustive independent gold. Raw questions/assets/finer legacy memberships unchanged.'
 report={'baselineCommit':BASE,'inventory':3967,'reviewedRemaining':1173,'reviewedSecondary':104,'reviewedUnique':1277,'dispositions':totals,'currentSectionLinked':len(output['rows']),'legacyOnly':3967-len(output['rows']),'addedLinks':added,'sourceAdjudicatedRemovals':removed,'sourceEvidenceByLink':sourceEvidenceByLink,'independentReviewCount':6,'scope':output['scope']}
 return output,report
def main():
 p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');args=p.parse_args()
 bundle=json.loads((ROOT/'docs/0580-direct-source-input-v4.json').read_text());raw=(ROOT/'src/data/raw/igcse.json').read_bytes();registry=json.loads((ROOT/'src/data/igcse-0580-official-2025.json').read_text());output,report=build(bundle,raw,registry)
 for path,obj in [(ROOT/'src/data/igcse-0580-section-retrieval-v3.json',output),(ROOT/'docs/0580-direct-source-reconciliation-v4.json',report)]:
  if args.check:assert path.read_bytes()==encoded(obj),str(path)+' rebuild drift'
  else:path.write_bytes(encoded(obj))
 print(json.dumps({k:v for k,v in report.items()if k not in ['addedLinks','sourceAdjudicatedRemovals','sourceEvidenceByLink']}));print('addedLinks',len(report['addedLinks']),'removedLinks',len(report['sourceAdjudicatedRemovals']))
if __name__=='__main__':main()
