/** A deliberate full page navigation re-runs the RLS reads; no automatic refresh. */
export function AccessReadRecovery({ retryPath }: { retryPath: "/account" | "/dashboard" }) {
  return (
    <section className="auth-page shell">
      <article className="auth-card">
        <h1>We couldn&apos;t check your access</h1>
        <p>Your access could not be verified right now. Please wait a moment and try again.</p>
        <a className="button primary" href={retryPath}>Try again</a>
      </article>
    </section>
  );
}
