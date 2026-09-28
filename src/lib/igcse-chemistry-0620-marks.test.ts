import { describe, expect, it } from "vitest";
import { assert0620MarksRepair, assert0620OtherRetrievalRepair, getIGCSECandidateRuntime, getIGCSERuntimeArtifact } from "@/lib/igcse-runtime";
const clone=<T>(value:T):T=>structuredClone(value);
describe("Chemistry 0620 marks descendant production gate",()=>{
  const runtime=getIGCSECandidateRuntime("igcse-chemistry-0620");
  it("accepts current 5,129-row repaired bank and intact earlier Other repair",()=>{
    expect(()=>assert0620OtherRetrievalRepair(runtime)).not.toThrow();
    expect(()=>assert0620MarksRepair(runtime)).not.toThrow();
    expect(()=>getIGCSERuntimeArtifact("igcse-chemistry-0620",{PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS:"true",PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED:"true"})).not.toThrow();
  });
  it("rejects changed mark or forged repair metadata, even when other labels remain",()=>{
    const changed=clone(runtime);(changed.questions[0] as Record<string,unknown>).marks=99;
    expect(()=>assert0620MarksRepair(changed)).toThrow(/marks repair/);
    const forged=clone(runtime);if(!forged.runtimeArtifact?.chemistryMarksRepair)throw new Error("repair missing");
    forged.runtimeArtifact.chemistryMarksRepair.targetIdsSha256="0".repeat(64);
    expect(()=>assert0620MarksRepair(forged)).toThrow(/marks repair/);
    const old=clone(runtime);if(!old.runtimeArtifact?.chemistryOtherRetrievalRepair)throw new Error("old repair missing");
    old.runtimeArtifact.chemistryOtherRetrievalRepair.changedCount=29;
    expect(()=>assert0620OtherRetrievalRepair(old)).toThrow(/Other retrieval/);
  });
});
