import copy, importlib.util, json, pathlib, unittest
HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('builder',HERE/'build-0606-direct-source-v4.py');assert spec is not None and spec.loader is not None;m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class SourceBuildTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.bundle=json.loads((m.ROOT/'docs/0606-direct-source-input-v4.json').read_text());cls.raw=(m.ROOT/'src/data/raw/igcse-additional.json').read_bytes();cls.registry=json.loads((m.ROOT/'src/data/igcse-0606-numbered-subtopics.json').read_text())
 def test_exact_review_inventory_and_old_links(self):
  output,report=m.build(self.bundle,self.raw,self.registry);self.assertEqual(report['frozenReviewed'],623);self.assertEqual(report['inventory'],1633)
  by={r['id']:r for r in output['rows']}
  for old in self.bundle['baselineOverlay']['rows']:self.assertTrue(set(old['sectionCodes'])<=set(by[old['id']]['sectionCodes']))
 def test_corrections_have_per_link_source(self):
  output,_=m.build(self.bundle,self.raw,self.registry);by={r['id']:r for r in output['rows']}
  for id,code in [('0606-2016-june-13-q4','5.1'),('0606-2025-march-12-q12','14.12')]:
   self.assertIn(code,by[id]['sectionCodes']);self.assertEqual(by[id]['evidenceByCode'][code],'direct-image-model-review');self.assertTrue(by[id]['directSourceEvidenceByCode'][code]['parts'])
 def test_duplicate_is_rejected(self):
  b=copy.deepcopy(self.bundle);b['reviews'][1]=b['reviews'][0]
  with self.assertRaisesRegex(AssertionError,'duplicate'):m.build(b,self.raw,self.registry)
 def test_source_drift_is_rejected(self):
  b=copy.deepcopy(self.bundle);b['reviews'][0]['sourceHashes']['QP']='0'*64
  with self.assertRaisesRegex(AssertionError,'source hash drift'):m.build(b,self.raw,self.registry)
 def test_raw_drift_is_rejected(self):
  with self.assertRaisesRegex(AssertionError,'raw drift'):m.build(self.bundle,self.raw+b' ',self.registry)
 def test_invalid_code_is_rejected(self):
  b=copy.deepcopy(self.bundle);b['reviews'][0]['parts'][0]['codes']=['99.99']
  with self.assertRaisesRegex(AssertionError,'invalid section'):m.build(b,self.raw,self.registry)
 def test_invented_historical_exclusion_is_rejected(self):
  b=copy.deepcopy(self.bundle);r=next(r for r in b['reviews']if any(p['codes']for p in r['parts']));r['disposition']='historical-only'
  with self.assertRaisesRegex(AssertionError,'disposition mismatch'):m.build(b,self.raw,self.registry)
 def test_missing_evidence_is_rejected(self):
  b=copy.deepcopy(self.bundle);b['reviews'][0]['parts'][0]['ms_evidence']=''
  with self.assertRaisesRegex(AssertionError,'part evidence'):m.build(b,self.raw,self.registry)
 def test_self_consistent_baseline_tamper_is_rejected(self):
  b=copy.deepcopy(self.bundle);b['baselineOverlay']['scope']='tampered';b['baselineOverlaySeal']=m.digest(m.encoded(b['baselineOverlay']))
  with self.assertRaisesRegex(AssertionError,'baseline seal drift'):m.build(b,self.raw,self.registry)
 def test_self_consistent_source_tamper_is_rejected(self):
  b=copy.deepcopy(self.bundle);r=b['reviews'][0];r['sourceHashes']['QP']='0'*64;b['sourceBindings'][r['id']]['QP']='0'*64
  with self.assertRaisesRegex(AssertionError,'source binding seal drift'):m.build(b,self.raw,self.registry)
 def test_byte_identical(self):
  one=m.build(self.bundle,self.raw,self.registry);two=m.build(self.bundle,self.raw,self.registry);self.assertEqual(m.encoded(one),m.encoded(two))
if __name__=='__main__':unittest.main()
