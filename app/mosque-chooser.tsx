import Link from "next/link";
import Image from "next/image";
import { Settings } from "lucide-react";
import {
  DefaultMosqueButton,
  StaleDefaultCleanup,
} from "@/app/components/default-mosque-controls";
import { mosquePublicPath, type Mosque } from "@/lib/mosques";

type Props = {
  mosques: Mosque[];
  clearStaleDefault: boolean;
};

export function MosqueChooser({ mosques, clearStaleDefault }: Props) {
  return (
    <main className="mosque-chooser-shell">
      <header className="chooser-header">
        <Image
          className="brand-mark"
          src="/favicon.svg"
          alt=""
          width={54}
          height={54}
          aria-hidden="true"
        />
        <p>Masjid Prayer Times</p>
      </header>

      <section className="chooser-card" aria-labelledby="chooser-heading">
        <p className="section-kicker">Jamaat times at a glance</p>
        <h1 id="chooser-heading">Choose your masjid</h1>
        <p className="chooser-lede">
          Open any timetable without an account. Set a default only when you want
          this browser to open it automatically next time.
        </p>

        {mosques.length > 0 ? (
          <ul className="mosque-choice-list">
            {mosques.map((mosque) => {
              const path = mosquePublicPath(mosque.slug);
              return (
                <li key={mosque.id}>
                  <div>
                    <h2>
                      <Link href={path}>{mosque.name}</Link>
                    </h2>
                    <p>{mosque.location}</p>
                  </div>
                  <div className="mosque-choice-actions">
                    <Link className="mosque-open-link" href={path}>
                      View timetable
                    </Link>
                    <DefaultMosqueButton
                      slug={mosque.slug}
                      mosqueName={mosque.name}
                      redirectTo={path}
                      className="primary-button"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="chooser-empty" role="status">
            <h2>No masjids are available yet</h2>
            <p>Please try again later or ask a masjid administrator for its direct link.</p>
          </div>
        )}

        <StaleDefaultCleanup active={clearStaleDefault} />
      </section>

      <footer>
        <p>Public timetables never require an account.</p>
        <Link className="admin-entry-link" href="/admin">
          <Settings size={14} aria-hidden="true" />
          Admin
        </Link>
      </footer>
    </main>
  );
}
