#!/usr/bin/env python3
"""Audit assembly asset seals against both original and repaired segmentation lanes."""
import hashlib, json
from collections import Counter
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
SRC = Path('/Users/sakshamgoel/Documents/ProjectsInternships/igcse-physics-0625-topic-practice')
ASSEMBLY_PATH = SRC/'data/classification/full-bank-assembly-combined/working-assembly.json'

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None

def main():
    assembly=json.loads(ASSEMBLY_PATH.read_text())['rows']
    report={'artifact':'physics0625_asset_binding_integrity_audit_v1','assembly':str(ASSEMBLY_PATH),'lanes':{},'representativeMismatches':[]}
    for lane_name, lane_root, original_root in [
        ('base', SRC/'data/segmentation-repaired/assets', SRC/'data/segmentation/assets'),
        ('extension', SRC/'data/segmentation/full-extension-repaired/assets', SRC/'data/segmentation/full-extension/assets'),
    ]:
        refs=Counter(); mismatches=Counter(); original_matches=Counter(); missing=Counter(); papers=Counter(); samples=[]
        for row in assembly:
            if (row['label_source']!='extension-lane') != (lane_name=='base'): continue
            paper=row['paper_id'];
            for field, asset_type in [('images','question'),('mark_scheme_images','markscheme')]:
                for item in row['source'][field]:
                    rel=item['path'].removeprefix('assets/'); repaired=lane_root/rel; original=original_root/rel
                    refs[(paper,asset_type)]+=1
                    if not repaired.is_file(): missing[(paper,asset_type)]+=1; continue
                    actual=sha(repaired)
                    if actual==item['sha256']: continue
                    mismatches[(paper,asset_type)]+=1
                    if sha(original)==item['sha256']: original_matches[(paper,asset_type)]+=1
                    if len(samples)<12:
                        samples.append({'questionId':row['question_id'],'paperId':paper,'assetType':asset_type,'relativePath':rel,'assemblySha256':item['sha256'],'repairedSha256':actual,'originalSha256':sha(original),'assemblyBounds':item.get('bounds'),'repairedManifest':None,'originalManifest':None,'sourcePdf':row['source']['qp_pdf']['sha256'] if asset_type=='question' else row['source']['ms_pdf']['sha256']})
        for s in samples:
            for mf,key in [(SRC/('data/segmentation-repaired/segmentation-manifest.json'),'repairedManifest'),(SRC/'data/segmentation/segmentation-manifest.json','originalManifest')]:
                if mf.is_file():
                    d=json.loads(mf.read_text())
                    def walk(x):
                        if isinstance(x,dict):
                            if x.get('path')=='assets/'+s['relativePath']: return x
                            for v in x.values():
                                z=walk(v)
                                if z:return z
                        elif isinstance(x,list):
                            for v in x:
                                z=walk(v)
                                if z:return z
                    hit=walk(d); s[key]=hit
        report['lanes'][lane_name]={'referencedAssets':sum(refs.values()),'mismatchedAssets':sum(mismatches.values()),'missingAssets':sum(missing.values()),'mismatchedQuestions':len({(k[0]) for k in mismatches}),'assemblyHashMatchesOriginalCount':sum(original_matches.values()),'byPaperAndAssetType':{f'{p}|{t}':{'referenced':refs[(p,t)],'mismatched':mismatches[(p,t)],'missing':missing[(p,t)],'assemblyMatchedOriginal':original_matches[(p,t)]} for p,t in sorted(refs)},'samples':samples}
        report['representativeMismatches'].extend(samples[:3])
    report['totals']={k:sum(v[k] for v in report['lanes'].values()) for k in ['referencedAssets','mismatchedAssets','missingAssets','mismatchedQuestions','assemblyHashMatchesOriginalCount']}
    report['totals']['assemblyHashMatchesNowhereCount']=report['totals']['mismatchedAssets']-report['totals']['assemblyHashMatchesOriginalCount']
    report['provenanceConfirmed']=(report['lanes']['base']['assemblyHashMatchesOriginalCount']==report['lanes']['base']['mismatchedAssets'] and report['lanes']['extension']['mismatchedAssets']==0 and report['totals']['missingAssets']==0)
    out=APP/'docs/physics-0625-asset-binding-integrity-audit.json'; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report['totals'],indent=2)); print(out)
    if not report['provenanceConfirmed']: raise SystemExit('asset provenance gate failed: assembly hashes are not fully attributable to the original lane')
if __name__=='__main__': main()
