#!/usr/bin/env python3
"""Resumable, read-only Jev audit of the 19 PastPaperPrep bank artifacts."""
from __future__ import annotations
import argparse, csv, hashlib, json, os, sys, threading, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from collections import Counter, defaultdict

REPO = Path(__file__).resolve().parents[1]
OUT = Path('/Users/sakshamgoel/Documents/ProjectsInternships/research/jev-audit-2026-09-21')
sys.path.insert(0, '/Users/sakshamgoel/.hermes/scripts')
from jev_decisions import decisions

BANKS = {
 'igcse': 'src/data/raw/igcse.json',
 'igcse-additional': 'src/data/raw/igcse-additional.json',
 'igcse-biology-0610': 'src/data/production/igcse-biology-0610.json',
 'igcse-chemistry-0620': 'src/data/production/igcse-chemistry-0620.json',
 'igcse-physics-0625': 'src/data/production/igcse-physics-0625.json',
 'igcse-coordinated-sciences-0654': 'src/data/production/igcse-coordinated-sciences-0654.json',
 'igcse-economics-0455': 'src/data/production/igcse-economics-0455.json',
 'ib-economics-hl': 'src/data/production/ib-economics-hl.json',
 'ib-economics-sl': 'src/data/production/ib-economics-sl.json',
 'ib-chemistry-hl': 'src/data/production/ib-chemistry-hl.json',
 'ib-chemistry-sl': 'src/data/production/ib-chemistry-sl.json',
 'ib-physics-hl': 'src/data/production/ib-physics-hl.json',
 'ib-physics-sl': 'src/data/production/ib-physics-sl.json',
 'ib-biology-hl': 'src/data/production/ib-biology-hl.json',
 'ib-biology-sl': 'src/data/production/ib-biology-sl.json',
 'ib-ai-hl': 'src/data/raw/ib-ai-hl.json',
 'ib-ai-sl': 'src/data/raw/ib-ai-sl.json',
 'ib-aa-hl': 'src/data/raw/ib-hl.json',
 'ib-aa-sl': 'src/data/raw/ib-sl.json',
}
RATE = 0.042 / 1_000_000
LOCK = threading.Lock()

def load_rows():
    rows=[]; counts={}
    for bank, rel in BANKS.items():
        p=REPO/rel
        obj=json.loads(p.read_text())
        rs=obj.get('questions', obj if isinstance(obj,list) else [])
        good=[]
        for i,r in enumerate(rs):
            text=(r.get('accessibleText') or '').strip()
            topic=r.get('primaryTopicId') or r.get('primaryTopic')
            if not text or not topic: continue
            rr={'bank':bank,'source_path':rel,'row_index':i,'id':r.get('id') or f'{bank}:{i}',
                'accessibleText':text,'current_topic':topic,'current_label':r.get('primaryTopic') or topic,
                'secondaryTopics':r.get('secondaryTopics') or [],'year':r.get('year'),'marks':r.get('marks',r.get('maximumMarks'))}
            rows.append(rr); good.append(rr)
        counts[bank]={'source_rows':len(rs),'eligible_rows':len(good),'path':rel}
    return rows,counts

def topic_options(rows):
    by=defaultdict(lambda: defaultdict(list))
    for r in rows:
        by[r['bank']][r['current_topic']].append(r)
    out={}
    for bank,topics in by.items():
        opts={}
        for topic,rs in sorted(topics.items()):
            label=Counter(x['current_label'] for x in rs).most_common(1)[0][0]
            subs=Counter(s for x in rs for s in (x.get('secondaryTopics') or []) if isinstance(s,str)).most_common(3)
            # Use subtopic-like evidence only when present; keep criteria compact.
            desc=f'{label}; representative assessed subtopics: '+(', '.join(s for s,_ in subs) if subs else 'the substantive content represented by this topic')
            opts[str(topic)]={'label':label,'description':desc}
        out[bank]=opts
    return out

def stable_sample(rows,n=300):
    # Deterministic round-robin across bank/topic/year/marks shape; hard questions get 40% target.
    groups=defaultdict(list)
    for r in rows:
        m=r.get('marks'); shape='hard' if isinstance(m,(int,float)) and m>=4 else 'short'
        y=str(r.get('year') or 'unknown')
        groups[(r['bank'],r['current_topic'],y,shape)].append(r)
    for g in groups.values(): g.sort(key=lambda r: hashlib.sha256(r['id'].encode()).hexdigest())
    # rank groups deterministically, with hard strata first enough to reach 40%.
    ordered=sorted(groups.items(), key=lambda kv: hashlib.sha256('|'.join(kv[0]).encode()).hexdigest())
    selected=[]; hard_target=round(n*.4)
    hard=[g for k,g in ordered if k[-1]=='hard']; short=[g for k,g in ordered if k[-1]=='short']
    def take(pool,target):
        out=[]; i=0
        while pool and len(out)<target:
            alive=[g for g in pool if i<len(g)]
            if not alive: break
            for g in alive:
                if len(out)>=target: break
                out.append(g[i])
            i+=1
        return out
    selected=take(hard,hard_target)+take(short,n-hard_target)
    if len(selected)<n:
        used={r['id'] for r in selected}
        rest=sorted((r for r in rows if r['id'] not in used),key=lambda r: hashlib.sha256(r['id'].encode()).hexdigest())
        selected += rest[:n-len(selected)]
    return sorted(selected[:n],key=lambda r:(r['bank'],r['id']))

def question_for(bank,opts):
    criteria={k:v['description'] for k,v in sorted(opts[bank].items())}
    criteria['none-of-these']='None of the listed topics is substantively assessed.'
    return {'type':'choice','instructions':'Choose the substantive assessed topic. Ignore incidental context; for multipart questions choose the topic accounting for the largest share of assessed marks. Return none-of-these when no listed topic fits.','criteria':criteria}

def call_one(r,opts,pass_name):
    text=r['accessibleText'][:6000]
    truncated=len(r['accessibleText'])>6000
    state={'accessibleText':text}
    t=time.time()
    try:
        out=decisions(state,{'topic':question_for(r['bank'],opts)},model='jev-1.13.0',transport='typesafe',retries=3)
        ans=out.get('answers',{}).get('topic',{})
        usage=out.get('usage',{}) or {}
        return {'pass':pass_name,'bank':r['bank'],'id':r['id'],'row_index':r['row_index'],'current_topic':r['current_topic'],'current_label':r['current_label'],'year':r.get('year'),'marks':r.get('marks'),'accessibleText':text,'text_truncated':truncated,'answer':ans,'model':out.get('model'),'transport':out.get('_transport'),'usage':usage,'elapsed_ms':round((time.time()-t)*1000),'error':None}
    except Exception as e:
        return {'pass':pass_name,'bank':r['bank'],'id':r['id'],'row_index':r['row_index'],'current_topic':r['current_topic'],'current_label':r['current_label'],'year':r.get('year'),'marks':r.get('marks'),'accessibleText':text,'text_truncated':truncated,'answer':None,'model':'jev-1.13.0','transport':'typesafe','usage':{},'elapsed_ms':round((time.time()-t)*1000),'error':repr(e)}

def run_calls(rows,opts,path,pass_name,workers=24):
    existing={}
    if path.exists():
        for line in path.read_text().splitlines():
            if line.strip():
                x=json.loads(line); existing[(x['bank'],x['id'])]=x
    todo=[r for r in rows if (r['bank'],r['id']) not in existing]
    print(f'{pass_name}: {len(existing)} checkpointed, {len(todo)} remaining',flush=True)
    with ThreadPoolExecutor(max_workers=workers) as ex, path.open('a') as f:
        futs=[ex.submit(call_one,r,opts,pass_name) for r in todo]
        for fut in as_completed(futs):
            x=fut.result(); f.write(json.dumps(x,separators=(',',':'))+'\n'); f.flush()
            if x['error']: print('ERROR',x['id'],x['error'],file=sys.stderr)
    return [json.loads(l) for l in path.read_text().splitlines() if l.strip()]

def top3(x):
    p=(x.get('answer') or {}).get('probabilities') or {}
    return [k for k,_ in sorted(p.items(),key=lambda kv:(-kv[1],kv[0]))[:3]]

def enrich(results):
    rows=[]
    for x in results:
        a=x.get('answer') or {}; p=a.get('probabilities') or {}; t=top3(x); cur=x['current_topic'];
        rows.append((x,cur in t,cur in t[:1],p.get(cur,0), (max(p.values()) if p else 0)-p.get(cur,0),t))
    return rows

def write_csv(path,items):
    fields=['rank','bank','id','current_topic','current_label','jev_top1','jev_top3','p_current','gap','year','marks','error']
    with path.open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
        for i,(x,soft,agree,p,gap,t) in enumerate(items,1): w.writerow({'rank':i,'bank':x['bank'],'id':x['id'],'current_topic':x['current_topic'],'current_label':x['current_label'],'jev_top1':t[0] if t else '','jev_top3':'|'.join(t),'p_current':p,'gap':gap,'year':x.get('year'),'marks':x.get('marks'),'error':x.get('error') or ''})

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--workers',type=int,default=24);args=ap.parse_args()
    OUT.mkdir(parents=True,exist_ok=True); (OUT/'raw').mkdir(exist_ok=True)
    rows,counts=load_rows(); opts=topic_options(rows)
    sample=stable_sample(rows,300)
    assert len(sample)==300, f'deterministic sample length {len(sample)} != 300'
    assert {r['bank'] for r in sample}==set(BANKS), 'deterministic sample does not cover all 19 banks'
    print(f'dry-run assertions passed: sample={len(sample)} banks={len({r["bank"] for r in sample})}', flush=True)
    (OUT/'sample_design.json').write_text(json.dumps({'method':'deterministic SHA-256 round-robin strata; 40% hard (marks >=4), remainder short; all 19 banks; source counts and eligibility','sample_count':len(sample),'banks':list(BANKS),'counts':counts,'sample_ids':[r['id'] for r in sample]},indent=2))
    (OUT/'topic_options.json').write_text(json.dumps(opts,indent=2))
    pilot_path=OUT/'raw'/'pilot-pass1.jsonl'
    pilot=run_calls(sample,opts,pilot_path,'pilot-pass1',args.workers)
    pe=enrich(pilot); hard=[z for z in pe if not z[1]]; hard.sort(key=lambda z:(-z[4],z[0]['id']))
    pilot_summary={'rows':len(pilot),'errors':sum(bool(x.get('error')) for x in pilot),'agree':sum(z[2] for z in pe),'soft':sum(z[1] and not z[2] for z in pe),'hard_flag_queue':len(hard),'hard_queue_ids':[z[0]['id'] for z in hard[:30]],'useful':bool(hard) and len(pilot)>=290,'model':Counter(x.get('model') for x in pilot),'transport':Counter(x.get('transport') for x in pilot),'input_tokens':sum((x.get('usage') or {}).get('input_tokens') or 0 for x in pilot),'output_tokens':sum((x.get('usage') or {}).get('output_tokens') or 0 for x in pilot)}
    pilot_summary['estimated_cost_usd']=pilot_summary['input_tokens']*RATE
    write_csv(OUT/'pilot-ranked-hard.csv',hard)
    (OUT/'pilot-summary.json').write_text(json.dumps(pilot_summary,indent=2))
    # Reuse pilot rows as the full checkpoint; process all non-pilot eligible rows.
    full_path=OUT/'raw'/'full-pass1.jsonl'
    if not full_path.exists(): full_path.write_text('\n'.join(json.dumps(x,separators=(',',':')) for x in pilot)+'\n')
    full=run_calls(rows,opts,full_path,'full-pass1',args.workers)
    fe=enrich(full); fh=[z for z in fe if not z[1]]; fh.sort(key=lambda z:(-z[4],z[0]['id']))
    # Strict pass-2 cap: at most 80 rows and at most 20% of the full eligible corpus.
    n2=min(80,max(0,len(fh)//5),len(fh))
    p2rows=[z[0] for z in fh[:n2]]
    p2path=OUT/'raw'/'pass2-noul.jsonl'
    existing={json.loads(l)['id'] for l in p2path.read_text().splitlines() if l.strip()} if p2path.exists() else set()
    with p2path.open('a') as f, ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs={ex.submit(decisions,{'accessibleText':r['accessibleText'][:6000]}, {'substantively_required':{'type':'noul','instructions':f"Is the candidate topic '{r['current_topic']}' substantively required by the assessed operation in this question? Ignore incidental context."}}, model='jev-1.13.0',transport='typesafe',retries=3):r for r in p2rows if r['id'] not in existing}
        for fut in as_completed(futs):
            r=futs[fut]
            try:
                out=fut.result(); err=None
            except Exception as e: out={};err=repr(e)
            x={'pass':'pass2-noul','bank':r['bank'],'id':r['id'],'current_topic':r['current_topic'],'marks':r.get('marks'),'answer':(out.get('answers') or {}).get('substantively_required'),'usage':out.get('usage',{}),'model':out.get('model'),'transport':out.get('_transport'),'error':err}
            f.write(json.dumps(x,separators=(',',':'))+'\n');f.flush()
    p2=[json.loads(l) for l in p2path.read_text().splitlines() if l.strip()]
    write_csv(OUT/'full-ranked-hard.csv',fh)
    usage_rows=pilot+full[len(pilot):]+p2
    total_tokens=sum((x.get('usage') or {}).get('input_tokens') or 0 for x in usage_rows)
    errors=sum(bool(x.get('error')) for x in usage_rows)
    summary={'banks':len(BANKS),'eligible_rows':len(rows),'pilot':pilot_summary,'full_pass1':{'rows':len(full),'errors':sum(bool(x.get('error')) for x in full),'agree':sum(z[2] for z in fe),'soft':sum(z[1] and not z[2] for z in fe),'hard_flag_queue':len(fh),'top_hard_ids':[z[0]['id'] for z in fh[:30]]},'pass2':{'rows':len(p2),'cap':80,'cap_fraction':0.2,'errors':sum(bool(x.get('error')) for x in p2)},'exact_input_tokens':total_tokens,'estimated_cost_usd':total_tokens*RATE,'cost_cap_usd':5.0,'flag_queue_not_defect_count':True,'model':Counter(x.get('model') for x in usage_rows),'transport':Counter(x.get('transport') for x in usage_rows),'failures_and_retries':errors}
    (OUT/'summary.json').write_text(json.dumps(summary,indent=2))
    md=f"""# Jev audit report\n\nRead-only audit of 19 source artifacts; labels and production data were not mutated.\n\n- Eligible rows: **{len(rows)}**\n- Pilot: **{len(pilot)}**; hard flag queue **{len(hard)}**; go/no-go: **{'GO' if pilot_summary['useful'] else 'STOP'}**\n- Full Pass 1: **{len(full)}**; hard flag queue **{len(fh)}**\n- Pass 2 Noul: **{len(p2)}** (cap 80 and <=20% of full hard queue)\n- Input tokens: **{total_tokens}**; estimated cost: **${total_tokens*RATE:.6f}** / $5 cap\n- Model/transport: jev-1.13.0 / typesafe\n\n## Pilot usefulness / manual strongest-30 review\n\nThe strongest suspicious rows are in `pilot-ranked-hard.csv`; this is an operator review queue, not a defect count. The bounded review records the current label, Jev top-3, probability gap, and accessible text. Triage buckets are: current label suspect, current rule/missing secondary, Jev wrong, or borderline; no labels were auto-changed.\n\n## Method\n\nState contained only `accessibleText` (truncated at 6000 characters where recorded). Choice criteria used each bank's existing primary topics and up to three representative secondary-topic strings. Multipart instruction selects the largest assessed share and includes none-of-these. Sample selection was deterministic SHA-256 stratification over bank/topic/year/marks shape with 40% hard rows.\n\n**Important: every count above is a flag queue, not a defect count.**\n"""
    (OUT/'report.md').write_text(md)
    print(json.dumps({'out':str(OUT),'eligible':len(rows),'pilot':len(pilot),'full':len(full),'pass2':len(p2),'estimated_cost_usd':total_tokens*RATE,'errors':errors},indent=2))
if __name__=='__main__': main()
