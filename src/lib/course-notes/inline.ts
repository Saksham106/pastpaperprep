// Client-safe inline markup parser. Deliberately free of katex; only validate.ts and server code render maths.
export type InlineNode =
  | { kind: "text"; value: string }
  | { kind: "math"; tex: string }
  | { kind: "term"; id: string; label: string }
  | { kind: "lesson"; item: string };

const TERM = /^\[\[([a-z0-9-]+)\|([^\]|]+)\]\]/;
const LESSON = /^\{\{lesson:(\d+\.\d+)\}\}/;

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) nodes.push({ kind: "text", value: buffer });
    buffer = "";
  };
  for (let i = 0; i < text.length; ) {
    const rest = text.slice(i);
    if (rest.startsWith("\\$")) {
      buffer += "$";
      i += 2;
    } else if (rest[0] === "$") {
      let end = i + 1;
      while (end < text.length && text[end] !== "$") end += text[end] === "\\" ? 2 : 1;
      if (end >= text.length) throw new Error(`Unclosed $ at ${i}`);
      const tex = text.slice(i + 1, end);
      if (!tex.trim()) throw new Error(`Empty math at ${i}`);
      flush();
      nodes.push({ kind: "math", tex });
      i = end + 1;
    } else {
      const match = TERM.exec(rest) ?? LESSON.exec(rest);
      if (!match) {
        buffer += rest[0];
        i += 1;
        continue;
      }
      flush();
      nodes.push(match.length === 3 ? { kind: "term", id: match[1], label: match[2] } : { kind: "lesson", item: match[1] });
      i += match[0].length;
    }
  }
  flush();
  for (const node of nodes) if (node.kind === "text" && /\[\[|\{\{/.test(node.value)) throw new Error(`Malformed markup near "${node.value.match(/(\[\[|\{\{).{0,20}/)?.[0]}"`);
  return nodes;
}
