export default function Loading() {
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
