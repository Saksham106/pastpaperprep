export default function BankLoading() {
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
