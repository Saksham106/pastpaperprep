import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const base="5e6abbe33cb1a0d23f5148f39824390ed58312dd";
const pairs=[
 ["src/data/aa-official-subtopics/overlay.json",new Set(["2023-november-p1-tz2-q2","2023-november-p2-tz1-q7","2023-november-p2-tz2-q7"])],
 ["src/data/ib-biology-official-subtopics/overlay.json",new Set(["2019-may-tz1-sl-p1-q30","2019-may-tz1-sl-p3-q16","2019-may-tz2-sl-p1-q30","2019-november-tz0-sl-p3-q2"])],
];
const get=(path)=>JSON.parse(readFileSync(join(root,path),"utf8"));
const pinned=(path)=>JSON.parse(execFileSync("git",["show",`${base}:${path}`],{cwd:root,maxBuffer:100_000_000}).toString());

describe("source-confirmed IB subtopic repair",()=>{
 it.each(pairs)("changes precisely the approved rows in %s",(path,ids)=>{
  const before=pinned(path),after=get(path),key=path.includes("aa-official")?"records":"rows";
  expect(after[key].length).toBe(before[key].length);
  const old=new Map(before[key].map(row=>[row.id,row]));
  const changed=new Set(after[key].filter(row=>JSON.stringify(row)!==JSON.stringify(old.get(row.id))).map(row=>row.id));
  expect(changed).toEqual(ids);
  for(const row of after[key]){
   expect(old.has(row.id)).toBe(true);
   if(ids.has(row.id)){
    expect(row.provenance).toEqual(old.get(row.id).provenance);
    expect(row.sourceReassessment).toBeTruthy();
    expect(row.blocked ?? row.status==="blocked").toBe(false);
   } else expect(row).toEqual(old.get(row.id));
  }
 });
 it("keeps all 23 previously blocked Biology source-to-live rows fail-closed",()=>{
  const path=pairs[1][0],before=pinned(path),after=get(path);
  const target=new Set(after.rows.filter(row=>row.blocked).map(row=>row.id));
  const previouslyBlocked=new Set(before.rows.filter(row=>row.blocked).map(row=>row.id));
  const repaired=pairs[1][1];
  expect(previouslyBlocked.size).toBe(30);
  expect(target.size).toBe(26);
  expect(target).toEqual(new Set([...previouslyBlocked].filter(id=>!repaired.has(id))));
 });
});
