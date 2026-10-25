export default function Loading() {
  return (
    <main className="page-loading" aria-busy="true" aria-live="polite">
      <span className="page-loading-spinner" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </main>
  );
}
