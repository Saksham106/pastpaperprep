import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

export default function NotFound() {
  return (
    <section className="not-found-page shell">
      <p className="eyebrow">404</p>
      <h1>This page is missing.</h1>
      <p>The link may be old, but the question banks are still here.</p>
      <div className="not-found-actions" aria-label="Useful pages">
        <Link className="button primary" href="/#question-banks">Browse question banks <ArrowRight aria-hidden="true" weight="bold" /></Link>
        <Link className="button secondary" href="/articles">Read revision guides</Link>
        <Link className="button secondary" href="/pricing">Compare plans</Link>
      </div>
    </section>
  );
}