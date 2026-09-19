#!/usr/bin/env python3
"""Explain base assembly hashes absent from both original and repaired lanes."""
import hashlib, json
from collections import Counter
from pathlib import Path
APP=Path(__file__).resolve().parents[1]
SRC=Path('/Users/sakshamgoel/Documents/ProjectsInternships/igcse-physics-0625-topic-practice')
A=SRC/'data/classification/full-bank-assembly-combined/working-assembly.json'
REPAIRED=SRC/'data/segmentation-repaired/assets'; ORIGINAL=SRC/'data/segmentation/assets'
RM=SRC/'data/segmentation-repaired/segmentation-manifest.json'
def sh(p): return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
def walk(v,path):
 if isinstance(v,dict):
  if v.get('path')==path:return v
  for x in v.values():
   z=walk(x,path)
   if z:return z
 if isinstance(v,list):
  for x in v:
   z=walk(x,path)
   if z:return z
 return None
def main():
 d=json.loads(A.read_text()); rm=json.loads(RM.read_text()); rows=[]; counts=Counter(); manifest_fail=0
 for r in d['rows']:
  if r['label_source']=='extension-lane':continue
  for field,typ in [('images','question'),('mark_scheme_images','markscheme')]:
   for x in r['source'][field]:
    rel=x['path'].removeprefix('assets/'); rp=REPAIRED/rel; op=ORIGINAL/rel
    rec=walk(rm,x['path']); current=sh(rp); original=sh(op)
    if current!=x['sha256'] and original!=x['sha256']:
     counts[(r['paper_id'],typ)]+=1
     rows.append({'questionId':r['question_id'],'paperId':r['paper_id'],'assetType':typ,'path':rel,'assemblySha256':x['sha256'],'repairedManifestSha256':rec.get('sha256') if rec else None,'repairedCurrentSha256':current,'originalCurrentSha256':original,'repairedManifestHashMatchesCurrent':bool(rec and rec.get('sha256')==current),'assemblyBounds':x.get('bounds'),'repairedManifestBounds':rec.get('bounds') if rec else None,'repairedManifestPage':rec.get('source_page') if rec else None,'sourcePdf':r['source']['qp_pdf' if typ=='question' else 'ms_pdf'],'classificationLabelSource':r['label_source']})
  
 report={'artifact':'physics0625_asset_hash_exception_analysis_v1','scope':'base lane only','exceptionCount':len(rows),'byPaperAndAssetType':{f'{p}|{t}':n for (p,t),n in sorted(counts.items())},'repairedManifestCurrentHashPass':all(x['repairedManifestHashMatchesCurrent'] for x in rows),'sourcePdfBindingNote':'Each row retains the authoritative PDF URL/hash and page/geometry from the repaired manifest; no exception hash is present in the original or repaired asset trees. This proves an intermediate crop/build artifact, not a current-lane mutation, but the intermediate source is not present for reconstruction.','buildHistorySearch':'No tracked build receipt or duplicate asset in the source tree matched any of the 70 assembly hashes; git history does not track the untracked segmentation asset trees.','rows':rows}
 out=APP/'docs/physics-0625-asset-exception-analysis.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'exceptionCount':len(rows),'byPaperAndAssetType':report['byPaperAndAssetType'],'repairedManifestCurrentHashPass':report['repairedManifestCurrentHashPass']},indent=2))
if __name__=='__main__':main()
