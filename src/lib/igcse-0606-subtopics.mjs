import taxonomy from "../data/igcse-0606-numbered-subtopics.json" with { type: "json" };
import granular from "../data/math-granular-label-overlay.json" with { type: "json" };

export const SECTIONS_0606 = Object.freeze(taxonomy.sections);
const byCode = new Map(SECTIONS_0606.map(s => [s.code, s]));
if (byCode.size !== 67) throw new Error("0606 numbered statement inventory drift");
const finerNames = {
  "math.0606.calculus.differentiation": "Differentiation",
  "math.0606.calculus.integration": "Integration",
  "math.0606.algebra.binomial-expansion": "Binomial expansion",
  "math.0606.combinatorics-series.arithmetic-geometric-progressions": "Arithmetic and geometric progressions",
};
const fineById = new Map();
for (const row of granular.labels) {
  if (row.bank !== "0606" || !finerNames[row.label]) continue;
  fineById.set(row.id, [...(fineById.get(row.id) ?? []), finerNames[row.label]]);
}
export function controlled0606Subtopics(topic) {
  const names = SECTIONS_0606.filter(s => s.topic === topic).map(s => s.displayTitle);
  if (topic === "Calculus") names.push("Differentiation", "Integration");
  if (topic === "Series") names.push("Binomial expansion", "Arithmetic and geometric progressions");
  return names;
}
// These rules identify explicitly requested operations, not incidental concepts or
// missing mathematical notation. The existing reviewed broad labels bound owners.
// Unmatched rows keep all their old filters; no broad label is broadcast to children.
const cues = [
  ["1.2", /\b(?:domain|range)\b/i],
  ["1.5", /(?:has no|not have|does not have) (?:an? )?inverse|inverse (?:function )?does not exist/i],
  ["1.6", /(?:find|determine|obtain).{0,80}inverse|inverse.{0,80}(?:find|determine|obtain)/i],
  ["1.7", /composite function|composition of functions/i],
  ["1.8", /(?:sketch|draw).{0,100}(?:graph).{0,100}inverse|(?:sketch|draw).{0,100}inverse.{0,100}graph/i],
  ["2.1", /complet(?:e|ing) the square|(?:maximum|minimum) value/i],
  ["2.2", /\brange\b|sketch.*(?:quadratic|graph)/i],
  ["2.3", /discriminant|(?:equal|real|distinct) roots/i],
  ["2.4", /solve.*(?:quadratic|equation)/i],
  ["2.5", /\binequalit/i],
  ["3.1", /factor theorem|remainder|\bdivis(?:ion|ible)\b/i],
  ["3.2", /factori[sz]e|express.*(?:factors|linear factor)/i],
  ["3.3", /solve.*(?:cubic|equation)/i],
  ["4.1", /solve.*equation.*[|]|modulus equation/i],
  ["4.2", /modulus inequalit|solve.*inequalit.*[|]/i],
  ["4.3", /(?:use|using|by).*substitution/i],
  ["4.4", /sketch.*cubic/i],
  ["4.5", /cubic inequalit/i],
  ["6.1", /(?:sketch|graph|asymptote)/i],
  ["6.2", /single (?:natural )?logarithm|laws of logarithms|change of base/i],
  ["7.1", /(?:equation|gradient|intercept).*(?:straight line|line)|(?:straight line).*(?:equation|gradient|intercept)/i],
  ["7.2", /parallel|perpendicular/i],
  ["7.3", /midpoint|perpendicular bisector|length of (?:the )?line/i],
  ["7.4", /straight.line (?:form|graph)|linear form/i],
  ["8.1", /(?:find|determine|write down|state|calculate).{0,100}(?:centre|center|radius|equation of.{0,30}circle)/i],
  ["8.2", /intersect.{0,100}(?:line|circle)|(?:line|circle).{0,100}intersect|chord/i],
  ["8.3", /\btangent/i],
  ["8.4", /two circles|circles.*(?:intersect|touch)|common chord/i],
  ["10.2", /amplitude|period/i],
  ["10.3", /sketch|draw.*graph/i],
  ["10.5", /\bsolve\b/i],
  ["10.6", /\bprove\b|show that.*(?:identit|sin|cos|tan|sec|cosec|cot)/i],
  ["11.1", /difference between permutations and combinations|whether.*(?:permutation|combination)/i],
  ["11.3", /number of ways|arrang|select|committee|team/i],
  ["12.1", /\bexpansion\b|\bexpand\b/i],
  ["12.2", /term independent|coefficient|general term/i],
  ["12.4", /(?:arithmetic|geometric) (?:progression|series)|nth term/i],
  ["12.5", /sum to infinity|sum of.*infinite|converg/i],
  ["13.2", /unit vector|position vector/i],
  ["13.3", /magnitude|add.*vector|subtract.*vector|equat.*vector/i],
  ["13.4", /velocit|collid|resultant/i],
  ["14.4", /product rule|quotient rule/i],
  ["14.5", /\btangent|\bnormal|\bgradient/i],
  ["14.6", /stationary point/i],
  ["14.7", /rate of change|small (?:increment|change)|approximate change/i],
  ["14.8", /(?:find|calculate|determine|show|prove).{0,100}(?:maximum|minimum).{0,60}(?:volume|area|cost|length|distance)|(?:find|calculate|determine|show|prove).{0,100}(?:volume|area|cost|length).{0,60}(?:maximum|minimum)/i],
  ["14.9", /nature of.*stationary|derivative test|determine.*(?:maximum or minimum|maxima|minima)/i],
  ["14.13", /area.*(?:curve|region|bounded)|(?:definite integral)/i],
  ["14.14", /particle|displacement|velocity|acceleration|at rest/i],
  ["14.15", /(?:sketch|draw).*?(?:velocity|speed|displacement|acceleration).*graph/i],
];
/** @param {{id?:string,subtopics?:string[],accessibleText?:string}} raw */
export function project0606Sections(raw) {
  const labels = raw.subtopics ?? [];
  const t = (raw.accessibleText ?? "").replace(/\s+/g, " ");
  const chunks = t.split(/\[\s*\d+\s*\]|\([a-z]\)|[.!?](?:\s|$)/i);
  const owners = new Set(labels);
  const codes = new Set();
  // These two source labels have exactly one current numbered item.
  if (owners.has("Simultaneous equations")) codes.add("5.1");
  if (owners.has("Circular measure")) codes.add("9.1");
  for (const [code, regex] of cues) {
    const section = byCode.get(code);
    if (owners.has(section.topic) && chunks.some(chunk => regex.test(chunk))) codes.add(code);
  }
  // A general progression or binomial label is not proof of every numbered item.
  const finer = (fineById.get(raw.id) ?? []).filter(label =>
    owners.has(label === "Differentiation" || label === "Integration" ? "Calculus" : "Series"));
  const ordered = SECTIONS_0606.filter(s => codes.has(s.code));
  return {
    codes: ordered.map(s => s.code),
    subtopics: [...new Set([...labels, ...finer, ...ordered.map(s => s.displayTitle)])],
    codeRefs: ordered.map(s => `current_2025:${s.code}`),
    method: "existing-reviewed-label-single-section-crosswalk-and-explicit-assessed-operation-v1",
  };
}
