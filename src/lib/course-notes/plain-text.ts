// Plain text from notes inline markup, for places that cannot render it: meta descriptions, JSON-LD, tooltips.
// Client-safe (no katex). Maths becomes readable Unicode: "$3.06 \times 10^{-5}$" → "3.06 × 10⁻⁵".
import { parseInline } from "./inline";

const SYMBOLS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", iota: "ι", kappa: "κ",
  lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  times: "×", div: "÷", pm: "±", mp: "∓", cdot: "·", le: "≤", leq: "≤", leqslant: "≤", ge: "≥", geq: "≥", geqslant: "≥", ne: "≠", neq: "≠",
  approx: "≈", equiv: "≡", sim: "~", infty: "∞", circ: "∘", ominus: "°", dots: "…", ldots: "…", cdots: "⋯", int: "∫", sum: "Σ", prod: "Π",
  to: "→", rightarrow: "→", leftarrow: "←", rightleftharpoons: "⇌", in: "∈", mid: "|", lvert: "|", rvert: "|", vert: "|", partial: "∂", nabla: "∇", angle: "∠",
  degree: "°", prime: "′", "%": "%", "$": "$", "&": "&", "#": "#", "{": "{", "}": "}", "_": "_",
};
/** Marks a character that drops the spaces before it, such as a closing |. */
const HUG_LEFT = "\u0000";
const OPERATORS = new Set(["circ", "times", "div", "pm", "mp", "cdot", "le", "leq", "leqslant", "ge", "geq", "geqslant", "ne", "neq", "approx", "equiv", "sim", "to", "rightarrow", "leftarrow", "rightleftharpoons", "in", "mid"]);
const FUNCTIONS = new Set(["sin", "cos", "tan", "sec", "csc", "cot", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "ln", "log", "exp", "det", "lim", "max", "min"]);
const WRAPPERS = new Set(["text", "mathrm", "mathbf", "boldsymbol", "mathit", "textbf", "textit", "operatorname", "mathbb", "mathcal", "vec", "overrightarrow", "hat", "widehat", "pu"]);
const DROPPED = new Set(["left", "right", "displaystyle", "big", "Big", "bigl", "bigr", "quad", "qquad", "limits"]);
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", x: "ˣ", "°": "°", "∘": "°" };
const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", o: "ₒ", x: "ₓ", h: "ₕ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", p: "ₚ", s: "ₛ", t: "ₜ", i: "ᵢ", j: "ⱼ", r: "ᵣ", u: "ᵤ", v: "ᵥ" };

const script = (text: string, map: Record<string, string>, mark: string) => {
  const plain = text.trim();
  const mapped = [...plain].map((ch) => map[ch]);
  if (plain && mapped.every(Boolean)) return mapped.join("");
  return plain.length === 1 ? `${mark}${plain}` : `${mark}(${plain})`;
};
/** True when the whole text is one bracketed group, such as "(x + 1)" but not "(x − 5)(x + 1)". */
const bracketed = (text: string) => {
  if (!text.startsWith("(")) return false;
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    depth += text[i] === "(" ? 1 : text[i] === ")" ? -1 : 0;
    if (depth === 0) return i === text.length - 1;
  }
  return false;
};
const group = (text: string) => (/^(?:[\p{L}\p{N}.′]+(?:\([^()]*\))?|.)$/u.test(text) || bracketed(text) ? text : `(${text})`);

/** mhchem's \ce{...}: digits after an element or bracket are subscripts, a trailing charge is a superscript. */
function chem(text: string): string {
  return text
    .replace(/\^\{?([0-9]*[+-])\}?/g, (_, charge: string) => script(charge, SUP, "^"))
    .replace(/([A-Za-z)\]])(\d+)/g, (_, before: string, digits: string) => before + script(digits, SUB, "_"))
    .replace(/#/g, "≡")
    .replace(/<=>/g, "⇌")
    .replace(/->/g, "→");
}

class TexReader {
  i = 0;
  constructor(private readonly tex: string) {}

  /** Reads until the end or an unmatched closing brace. */
  read(): string {
    let out = "";
    while (this.i < this.tex.length) {
      const ch = this.tex[this.i];
      if (ch === "}") break;
      if (ch === "{") out += this.group();
      else if (ch === "\\") out += this.command();
      else if (ch === "^" || ch === "_") {
        this.i += 1;
        out += script(this.argument(), ch === "^" ? SUP : SUB, ch);
      } else if (ch === "&") this.i += 1;
      else {
        out += ch === "-" ? "−" : ch;
        this.i += 1;
      }
    }
    return out;
  }

  private group(): string {
    this.i += 1;
    const inner = this.read();
    this.i += 1;
    return inner;
  }

  /** One argument: a braced group, a command, or a single character. */
  private argument(): string {
    while (this.tex[this.i] === " ") this.i += 1;
    const ch = this.tex[this.i];
    if (ch === "{") return this.group();
    if (ch === "\\") return this.command();
    this.i += 1;
    return ch === "-" ? "−" : (ch ?? "");
  }

  private raw(): string {
    if (this.tex[this.i] !== "{") return this.argument();
    let depth = 0;
    const start = this.i + 1;
    for (; this.i < this.tex.length; this.i += 1) {
      if (this.tex[this.i] === "{") depth += 1;
      else if (this.tex[this.i] === "}" && --depth === 0) break;
    }
    this.i += 1;
    return this.tex.slice(start, this.i - 1);
  }

  private command(): string {
    this.i += 1;
    const word = /^[A-Za-z]+/.exec(this.tex.slice(this.i))?.[0];
    const name = word ?? this.tex[this.i] ?? "";
    this.i += name.length;
    // A space that only ends a control word ("\\Delta G") is not output; one before an operator ("\\tau = F") is.
    if (word && /^ +[A-Za-z0-9\\]/.test(this.tex.slice(this.i))) while (this.tex[this.i] === " ") this.i += 1;
    if (name === "\\") return ", ";
    if (name === "," || name === " " || name === ";" || name === ":") return " ";
    if (name === "!") return "";
    if (name === "lvert") {
      while (this.tex[this.i] === " ") this.i += 1;
      return "|";
    }
    if (name === "rvert") return HUG_LEFT + "|";
    if (name in SYMBOLS) return OPERATORS.has(name) ? ` ${SYMBOLS[name]} ` : SYMBOLS[name];
    if (FUNCTIONS.has(name)) return /^[A-Za-z0-9\\]/.test(this.tex[this.i] ?? "") ? `${name} ` : name;
    if (DROPPED.has(name)) return name.endsWith("quad") ? " " : "";
    if (name === "frac" || name === "tfrac" || name === "dfrac") {
      const top = this.argument();
      const bottom = this.argument();
      return `${group(top)}/${group(bottom)}`;
    }
    if (name === "sqrt") return `√${group(this.argument())}`;
    if (name === "bar" || name === "overline") return `${this.argument()}̄`;
    if (name === "ce") return chem(this.raw());
    if (name === "begin") {
      this.raw();
      return "(";
    }
    if (name === "end") {
      this.raw();
      return ")";
    }
    if (WRAPPERS.has(name)) return this.argument();
    return name;
  }
}

export function texToText(tex: string): string {
  return new TexReader(tex).read().replace(new RegExp(`\\s*${HUG_LEFT}`, "g"), "").replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();
}

/** Inline notes markup as plain text: glossary terms keep their label, maths becomes Unicode text. */
export function inlineToPlainText(text: string, lessonName: (item: string) => string = (item) => `lesson ${item}`): string {
  return parseInline(text)
    .map((node) => (node.kind === "text" ? node.value : node.kind === "term" ? node.label : node.kind === "math" ? texToText(node.tex) : lessonName(node.item)))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fits a meta description: whole sentences when they fit in `max`, else cut at a word with an ellipsis. */
export function fitMetaDescription(text: string, max = 160): string {
  if (text.length <= max) return text;
  // Longest run of whole sentences that fits. A sentence ends at . ! or ? before a space, so "6.02" doesn't split.
  let fitted = "";
  for (const end of text.matchAll(/[.!?](?=\s)/g)) {
    if (end.index + 1 > max) break;
    fitted = text.slice(0, end.index + 1);
  }
  if (fitted.length >= 110) return fitted;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:]+$/, "")}…`;
}
