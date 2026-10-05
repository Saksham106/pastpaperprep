import copy,importlib.util,json,pathlib,unittest
HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('builder',HERE/'build-0580-direct-source-v4.py');assert spec is not None and spec.loader is not None;m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class SourceBuildTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.b=json.loads((m.ROOT/'docs/0580-direct-source-input-v4.json').read_text());cls.raw=(m.ROOT/'src/data/raw/igcse.json').read_bytes();cls.reg=json.loads((m.ROOT/'src/data/igcse-0580-official-2025.json').read_text())
 def test_complete_scope_and_preservation(self):
  output,report=m.build(self.b,self.raw,self.reg);self.assertEqual(report['reviewedUnique'],1277);self.assertEqual(report['inventory'],3967);by={r['id']:r for r in output['rows']}
  for old in self.b['baselineOverlay']['rows']:
   for code in old['sectionCodes']:
    if(old['id'],code)not in m.ALLOWED_REMOVALS:self.assertIn(code,by[old['id']]['sectionCodes'])
 def test_source_corrections_and_secondary(self):
  output,report=m.build(self.b,self.raw,self.reg);by={r['id']:r for r in output['rows']}
  self.assertNotIn('E1.8',by['0580-2022-november-22-q10']['sectionCodes']);self.assertNotIn('E1.18',by['0580-2022-november-22-q10']['sectionCodes']);self.assertIn('E1.18',by['0580-2025-march-22-q18']['sectionCodes']);self.assertEqual(len(report['sourceAdjudicatedRemovals']),1)
 def test_duplicate_rejected(self):
  b=copy.deepcopy(self.b);b['reviews'][1]=b['reviews'][0]
  with self.assertRaisesRegex(AssertionError,'duplicate'):m.build(b,self.raw,self.reg)
 def test_source_drift_rejected(self):
  b=copy.deepcopy(self.b);b['reviews'][0]['sourceHashes']['QP']='0'*64
  with self.assertRaisesRegex(AssertionError,'source hash drift'):m.build(b,self.raw,self.reg)
 def test_self_consistent_source_tamper_rejected(self):
  b=copy.deepcopy(self.b);r=b['reviews'][0];r['sourceHashes']['QP']='0'*64;b['sourceBindings'][r['id']]['QP']='0'*64
  with self.assertRaisesRegex(AssertionError,'source binding seal'):m.build(b,self.raw,self.reg)
 def test_self_consistent_baseline_tamper_rejected(self):
  b=copy.deepcopy(self.b);b['baselineOverlay']['scope']='forged';b['baselineOverlaySeal']=m.digest(m.encoded(b['baselineOverlay']))
  with self.assertRaisesRegex(AssertionError,'baseline seal'):m.build(b,self.raw,self.reg)
 def test_raw_drift_rejected(self):
  with self.assertRaisesRegex(AssertionError,'raw drift'):m.build(self.b,self.raw+b' ',self.reg)
 def test_wrong_tier_rejected(self):
  b=copy.deepcopy(self.b);b['reviews'][0]['parts'][0]['codes']=['C1.1']
  with self.assertRaisesRegex(AssertionError,'invalid code/tier'):m.build(b,self.raw,self.reg)
 def test_missing_evidence_rejected(self):
  b=copy.deepcopy(self.b);b['reviews'][0]['parts'][0]['ms_evidence']=''
  with self.assertRaisesRegex(AssertionError,'part evidence'):m.build(b,self.raw,self.reg)
 def test_unapproved_removal_rejected(self):
  b=copy.deepcopy(self.b);b['reviews'][0]['removeBaselineCodes']=['E1.7']
  with self.assertRaisesRegex(AssertionError,'unapproved removal'):m.build(b,self.raw,self.reg)
 def test_runtime_never_contains_source_answer_text(self):
  output,report=m.build(self.b,self.raw,self.reg)
  self.assertNotIn(b'ms_evidence',m.encoded(output));self.assertNotIn(b'qp_evidence',m.encoded(output))
  self.assertEqual(len(report['sourceEvidenceByLink']),len(report['addedLinks']))
  self.assertTrue(all(e['parts'] for e in report['sourceEvidenceByLink'].values()))
 def test_byte_identical(self):self.assertEqual(m.encoded(m.build(self.b,self.raw,self.reg)),m.encoded(m.build(self.b,self.raw,self.reg)))
if __name__=='__main__':unittest.main()
