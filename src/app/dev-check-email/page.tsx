// TEMPORARY review page — not committed.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Screen } from "./screens";

export default function Page() {
  const email = readFileSync(join(process.cwd(), "supabase/templates/confirm-sign-up.html"), "utf8")
    .replaceAll("{{ .Token }}", "37196607").replaceAll("{{ .RedirectTo }}", "#").replaceAll("{{ .TokenHash }}", "x");
  const label = { margin: "8px 0 -12px", textAlign: "center" as const };
  return (
    <section className="shell" style={{ display: "grid", gap: 28, padding: "36px 0 80px" }}>
      <p className="eyebrow" style={label}>1 · Sign up with a school email</p>
      <Screen eyebrow="Start studying" title="Create your account." email="student@school.example" what="a link and code" school waited={false} />
      <p className="eyebrow" style={label}>2 · Email link with a personal email, after the 60 s timer</p>
      <Screen eyebrow="Your study space" title="Sign in to PastPaperPrep." email="student@gmail.com" what="a sign-in link and code" school={false} waited />
      <p className="eyebrow" style={label}>3 · The email (code shows in the inbox preview too)</p>
      <iframe title="Confirmation email" srcDoc={email} style={{ width: "min(660px, 100%)", height: 520, margin: "0 auto", border: "1px solid var(--line)", borderRadius: 12, background: "#f3f4f7" }} />
    </section>
  );
}
