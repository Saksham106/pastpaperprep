import official from "../data/igcse-0580-official-2025.json" with { type: "json" };
import reviewed from "../data/igcse-0580-reviewed-section-overlay.json" with { type: "json" };
import modelOverlay from "../data/igcse-0580-calibrated-model-overlay.json" with { type: "json" };

export const MATH_0580_MODEL_SOURCE_SHA256 = modelOverlay.sourceRawSha256;
export const MATH_0580_LEGACY_SUBTOPICS = Object.freeze(modelOverlay.legacySubtopics);
const modelById = new Map(modelOverlay.rows.map(row => [row.id, row]));
if (modelById.size !== modelOverlay.rows.length || modelOverlay.model !== "typesafe/jev-1.13-20260917") throw new Error("0580 model overlay identity drift");
function textFingerprint(text) {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(text)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash.toString(16);
}

export const MATH_0580_TOPICS = Object.freeze(official.topics.map((topic) => topic.title));
export const MATH_0580_SECTIONS = Object.freeze(official.topics.flatMap((topic) => topic.sections.map((section) => ({
  ...section, topic: topic.title, displayTitle: `${section.code} ${section.title}`,
}))));
export const MATH_0580_REVIEW_TOPIC = "Questions needing section review";
export const MATH_0580_REVIEW = "Section not yet verified";
const byTierCode = new Map(MATH_0580_SECTIONS.flatMap((section) => [section.coreCode, section.extendedCode]
  .filter(Boolean).map((code) => [code, section])));
const byDisplay = new Map(MATH_0580_SECTIONS.map((section) => [section.displayTitle, section]));
const reviewedById = new Map(reviewed.rows.map((row) => [row.id, row]));
// Exact existing fine-label equivalents only. Labels spanning multiple official
// sections, or depending on an assessed operation not named by the label, stay unresolved.
const sectionCrosswalk = Object.freeze({
  "Similarity and congruence": "4.4",
  "Set language and notation": "1.2",
  "Exponential growth and decay": "1.17",
  "Distance and midpoint": "3.4",
  "Volume and surface area": "5.4",
  "Sequences": "2.7",
  "Scatter graphs": "9.5",
  "Averages and spread": "9.3",
  "Number properties": "1.1",
  "Prime factors, HCF and LCM": "1.1",
  "Standard form": "1.8",
  "Recurring decimals": "1.4",
  "Time calculations": "1.15",
  "Order of operations": "1.6",
  "Density, mass and volume": "1.12",
  "Compound shapes": "5.5",
  "Circular measure: arcs, sectors and segments": "5.3",
  "Exact trigonometric values": "6.3",
  "3D trigonometry": "6.6",
  "Symmetry": "4.5",
});
/** @type {Array<[string, RegExp, string[]]>} */
const operationCues = [
  ["9.7", /histogram|frequency density/i, ["Histograms and cumulative frequency"]],
  ["9.6", /cumulative frequency/i, ["Histograms and cumulative frequency"]],
  ["7.3", /magnitude/i, ["Vectors"]],
  ["7.4", /collinear|vector geometry/i, ["Vectors"]],
  ["3.2", /(?:draw|plot|complete).{0,70}(?:line|graph)/i, ["Straight-line graphs", "Coordinates and geometry"]],
  ["3.3", /(?:find|calculate|work out|determine).{0,70}gradient/i, ["Straight-line graphs", "Coordinates and geometry"]],
  ["3.5", /(?:find|write down|determine|calculate|give).{0,90}equation.{0,60}(?:line|linear graph)/i, ["Straight-line graphs", "Coordinates and geometry"]],
  ["3.6", /parallel/i, ["Straight-line graphs", "Coordinates and geometry"]],
  ["3.7", /perpendicular/i, ["Straight-line graphs", "Coordinates and geometry"]],
  ["2.5", /solve.{0,60}equation/i, ["Equations and inequalities", "Quadratic equations and functions"]],
  ["2.6", /(?:solve|show|write|represent).{0,60}inequalit/i, ["Equations and inequalities"]],
  ["2.2", /factoris|factoriz|expand|collect.{0,40}terms/i, ["Algebraic manipulation"]],
  ["2.12", /differentiat|stationary point|gradient.{0,50}curve/i, ["Calculus"]],
  ["4.5", /lines? of symmetry|rotational symmetry|line symmetry/i, ["Transformations", "Symmetry", "Angles and polygons"]],
  ["7.1", /reflection|translation|enlargement|rotat(?:e|ion)\b/i, ["Transformations"]],
  ["4.6", /(?:find|calculate|work out|determine).{0,60}angle|interior angle|exterior angle/i, ["Angles and polygons"]],
  ["4.2", /(?:construct|bisect|perpendicular bisector)/i, ["Constructions and loci"]],
  ["1.10", /upper bound|lower bound|bounds|limits of accuracy/i, ["Bounds and estimation"]],
  ["1.9", /estimat|round|significant figures|decimal places/i, ["Bounds and estimation"]],
  ["1.18", /surd|rationalis|rationaliz/i, ["Indices and surds"]],
  ["1.11", /\bratio\b|share|divide.{0,40}proportion/i, ["Ratio, proportion and rates"]],
  ["2.8", /directly proportional|inversely proportional/i, ["Direct and inverse proportion", "Ratio, proportion and rates"]],
  ["1.4", /(?:write|express|convert).{0,60}(?:fraction|decimal|percentage)/i, ["Fractions, decimals and percentages"]],
  ["5.2", /(?:area|perimeter)/i, ["Area and perimeter"]],
];
if (MATH_0580_TOPICS.length !== 9 || MATH_0580_SECTIONS.length !== 72 || byDisplay.size !== 72
  || reviewedById.size !== 25 || reviewed.officialSyllabusSha256 !== official.sourcePdfSha256) {
  throw new Error("0580 official inventory or exact reviewed overlay changed");
}

/** @param {string[]} refs */
export function display0580Sections(refs) {
  const current = [...new Set((refs ?? []).filter((ref) => ref.startsWith("current_2025:")).map((ref) => {
    const section = byTierCode.get(ref.slice("current_2025:".length));
    if (!section) throw new Error(`0580 unknown official section ref ${ref}`);
    return section.displayTitle;
  }))];
  const needsReview = (refs ?? []).includes("review:section");
  if (needsReview && current.length) throw new Error("0580 reviewed and unresolved refs overlap");
  return [...current, ...(needsReview ? [MATH_0580_REVIEW] : [])];
}

/**
 * Topic ownership uses the existing controlled nine-topic source label.
 * Reviewed overrides take precedence, then explicit crosswalk/operation rules,
 * then the hash-pinned calibrated model subset. Retain original filters for all
 * remaining rows; section coverage is not exhaustive accuracy certification.
 * @param {{id?:string,year?:number,component?:string,primaryTopic?:string,secondaryTopics?:string[],subtopics?:string[],skills?:string[],accessibleText?:string}} raw
 * @returns {{primaryTopic:string,secondaryTopics:string[],subtopics:string[],visibleTitles:string[],aliases:string[],codeRefs:string[],needsReview:boolean}}
 */
export function project0580Sections(raw) {
  if (!MATH_0580_TOPICS.includes(raw.primaryTopic)) throw new Error(`0580 unsupported source topic ${raw.id ?? "unknown"}: ${raw.primaryTopic}`);
  const row = reviewedById.get(raw.id);
  if (row && (raw.year !== row.sourceYear || raw.component !== row.sourceComponent
    || raw.primaryTopic !== row.sourcePrimaryTopic
    || JSON.stringify(raw.secondaryTopics ?? []) !== JSON.stringify(row.sourceSecondaryTopics)
    || JSON.stringify(raw.subtopics ?? []) !== JSON.stringify(row.sourceSubtopics))) {
    throw new Error(`0580 reviewed overlay input drift ${raw.id}`);
  }
  if (row) {
    const tier = /^[13]/.test(raw.component ?? "") ? "C" : /^[24]/.test(raw.component ?? "") ? "E" : null;
    if (!tier) throw new Error(`0580 unrecognized paper tier ${raw.id}`);
    const sections = [row.primaryCode, ...row.secondaryCodes].map((code) => {
      const section = byTierCode.get(code);
      if (code[0] !== tier || !section) throw new Error(`0580 invalid reviewed tier/section ${raw.id}: ${code}`);
      return section;
    });
    if (sections[0].topic !== MATH_0580_TOPICS[Number.parseInt(row.primaryCode.slice(1).split(".")[0], 10) - 1]) {
      throw new Error(`0580 reviewed section owner changed ${raw.id}`);
    }
    const visibleTitles = [...new Set(sections.map((section) => section.displayTitle))];
    const primaryTopic = sections[0].topic;
    const secondaryTopics = [...new Set([
      ...sections.slice(1).map((section) => section.topic),
      raw.primaryTopic ?? "", ...(raw.secondaryTopics ?? []),
    ])].filter((topic) => topic !== primaryTopic);
    return {
      primaryTopic, secondaryTopics,
      subtopics: [...new Set([...visibleTitles, ...(raw.subtopics ?? [])])],
      visibleTitles,
      aliases: [...new Set([...(raw.subtopics ?? []), ...(raw.skills ?? []), raw.primaryTopic ?? "", ...(raw.secondaryTopics ?? [])].filter(Boolean))],
      codeRefs: [...[row.primaryCode, ...row.secondaryCodes].map((code) => `review_verified_2025:${code}`),
        ...[row.primaryCode, ...row.secondaryCodes].map((code) => `current_2025:${code}`)],
      needsReview: false,
    };
  }
  const tier = /^[13]/.test(raw.component ?? "") ? "C" : /^[24]/.test(raw.component ?? "") ? "E" : null;
  const labels = raw.subtopics ?? [];
  const text = (raw.accessibleText ?? "").replace(/\s+/g, " ");
  const chunks = text.split(/\[\s*\d+\s*\]|\([a-z]\)|[.!?](?:\s|$)/i);
  const sectionCodes = new Set(labels.map(label => sectionCrosswalk[label]).filter(Boolean));
  if (labels.includes("Averages and spread") && /cumulative frequency|histogram/i.test(text)) sectionCodes.delete("9.3");
  if (tier === "C" && labels.includes("Circle theorems")) sectionCodes.add("4.7");
  for (const [code, cue, owners] of operationCues) {
    if (!owners.some(owner => labels.includes(owner)) || !chunks.some(chunk => cue.test(chunk))) continue;
    if (code === "5.2" && /circle|sector|arc|compound|composite/i.test(text)) continue;
    sectionCodes.add(code);
  }
  const sections = [...sectionCodes].map(code => byTierCode.get(`${tier ?? ""}${code}`)).filter(Boolean);
  const modelRow = modelById.get(raw.id);
  if (modelRow && (raw.year !== modelRow.sourceYear || raw.component !== modelRow.sourceComponent
    || raw.primaryTopic !== modelRow.sourcePrimaryTopic
    || JSON.stringify(labels) !== JSON.stringify(modelRow.sourceSubtopics)
    || textFingerprint(raw.accessibleText ?? "") !== modelRow.sourceTextFingerprint)) {
    throw new Error(`0580 model input drift ${raw.id}`);
  }
  let usedModel = false;
  if (!sections.length && modelRow) {
    const selected = byTierCode.get(modelRow.primaryCode);
    if (!selected || modelRow.primaryCode[0] !== tier || modelRow.confidence < modelOverlay.confidenceThreshold) throw new Error(`0580 invalid calibrated model row ${raw.id}`);
    sections.push(selected);
    usedModel = true;
  }
  if (sections.length) {
    const codeRefs = sections.map(section => `current_2025:${tier}${section.code}`);
    if (usedModel) codeRefs.push(`model_calibrated_2025:${modelRow.primaryCode}`);
    const visibleTitles = [...new Set(sections.map(section => section.displayTitle))];
      return {
        primaryTopic: raw.primaryTopic ?? "", secondaryTopics: [...new Set([...(raw.secondaryTopics ?? []), ...sections.map(section => section.topic)])].filter(topic => topic !== raw.primaryTopic),
        subtopics: [...new Set([...visibleTitles, ...labels])],
        visibleTitles,
        aliases: [...new Set([...(raw.subtopics ?? []), ...(raw.skills ?? []), raw.primaryTopic ?? "", ...(raw.secondaryTopics ?? [])].filter(Boolean))],
        codeRefs, needsReview: false,
      };
  }
  return {
    primaryTopic: raw.primaryTopic ?? "",
    secondaryTopics: [...new Set(raw.secondaryTopics ?? [])].filter((topic) => topic !== raw.primaryTopic),
    subtopics: [...new Set([MATH_0580_REVIEW, ...(raw.subtopics ?? [])])],
    visibleTitles: [MATH_0580_REVIEW],
    aliases: [...new Set([...(raw.subtopics ?? []), ...(raw.skills ?? []), raw.primaryTopic ?? "", ...(raw.secondaryTopics ?? [])].filter(Boolean))],
    codeRefs: ["review:section"],
    needsReview: true,
  };
}
