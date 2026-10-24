export default function TimetableLoading() {
  return (
    <main className="app-shell loading-shell" aria-busy="true" aria-label="Loading timetable">
      <header className="site-header">
        <span className="skeleton skeleton-mark" />
        <div className="skeleton-copy">
          <span className="skeleton skeleton-line skeleton-line-wide" />
          <span className="skeleton skeleton-line skeleton-line-short" />
        </div>
        <span className="skeleton skeleton-icon" />
      </header>
      <div className="page-grid">
        <section className="skeleton skeleton-hero" />
        <section className="schedule-panel skeleton-card">
          <span className="skeleton skeleton-line skeleton-line-medium" />
          {Array.from({ length: 5 }, (_, index) => (
            <span className="skeleton skeleton-row" key={index} />
          ))}
        </section>
        <section className="utility-panel skeleton-card-small">
          <span className="skeleton skeleton-line skeleton-line-wide" />
          <span className="skeleton skeleton-line skeleton-line-medium" />
        </section>
      </div>
    </main>
  );
}
