"use client";

import Link from "next/link";

export default function AppError() {
  return (
    <section className="auth-page shell" role="alert">
      <div className="auth-card">
        <p className="eyebrow">Temporary problem</p>
        <h1>We couldn&apos;t load this page.</h1>
        <p>If reloading doesn&apos;t work, come back in a moment.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
          <button className="button primary" type="button" onClick={() => window.location.reload()}>Reload page</button>
          <Link className="button secondary" href="/">Go home</Link>
        </div>
      </div>
    </section>
  );
}
