import Link from "next/link";

export default function MosqueNotFound() {
  return (
    <main className="mosque-chooser-shell">
      <section className="chooser-card unavailable-card">
        <p className="section-kicker">Masjid unavailable</p>
        <h1>This timetable could not be found</h1>
        <p className="chooser-lede">
          The link may be incorrect, or the masjid may no longer be publicly active.
        </p>
        <Link className="primary-link" href="/">
          Choose another masjid
        </Link>
      </section>
    </main>
  );
}
