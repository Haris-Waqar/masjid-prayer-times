export default function AdminLoading() {
  return (
    <main className="admin-shell loading-shell" aria-busy="true" aria-label="Loading editor">
      <div className="admin-topbar">
        <span className="skeleton skeleton-line skeleton-line-short" />
        <span className="skeleton skeleton-line skeleton-line-short" />
      </div>
      <span className="skeleton skeleton-admin-title" />
      <span className="skeleton skeleton-line skeleton-line-wide" />
      <section className="admin-card skeleton-admin-card">
        {Array.from({ length: 6 }, (_, index) => (
          <span className="skeleton skeleton-row" key={index} />
        ))}
      </section>
    </main>
  );
}
