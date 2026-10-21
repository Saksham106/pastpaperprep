/** Route skeleton for signed-in areas. Public pages have none, so their content is in the first HTML, not a hidden stream. */
export function PageLoading() {
  return (
    <section className="page-skeleton shell" aria-label="Loading page" aria-busy="true">
      <span className="sr-only">Loading page</span>
      <div className="skeleton-line skeleton-kicker" aria-hidden="true" />
      <div className="skeleton-line skeleton-title" aria-hidden="true" />
      <div className="skeleton-line skeleton-copy" aria-hidden="true" />
      <div className="skeleton-grid" aria-hidden="true">
        <div className="skeleton-card" />
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </div>
    </section>
  );
}
