/**
 * Bank-shaped placeholder, drawn by BankNavigationFeedback the moment a bank link is clicked.
 * It is not a route loading.tsx: that would put the skeleton in the bank page's HTML and stream
 * the real page into a hidden block after the footer, which HTML-only crawlers read poorly.
 */
export function BankLoadingSkeleton() {
  return (
    <section className="shell bank-loading-shell" aria-label="Loading question bank" aria-busy="true">
      <span className="sr-only">Loading questions</span>
      <div className="bank-loading-hero" aria-hidden="true">
        <i /><i /><i />
      </div>
      <div className="bank-loading-workspace" aria-hidden="true">
        <div className="bank-loading-filters"><i /><i /><i /><i /></div>
        <div className="bank-loading-questions">
          <i /><i /><i />
        </div>
      </div>
    </section>
  );
}
