import Link from "next/link";
import Image from "next/image";
import { StaleDefaultCleanup } from "@/app/components/default-mosque-controls";
import { MasjidFinder, type MasjidOption } from "@/app/_components/masjid-finder";

type Props = {
  masjids: MasjidOption[];
  clearStaleDefault: boolean;
};

/** First-visit landing page: guides a visitor to choose their masjid. */
export function MosqueChooser({ masjids, clearStaleDefault }: Props) {
  return (
    <main className="landing-shell">
      <header className="landing-header">
        <span className="landing-brand">
          <Image
            className="brand-mark"
            src="/favicon.svg"
            alt=""
            width={48}
            height={48}
            aria-hidden="true"
          />
          <span>Masjid Prayer Times</span>
        </span>
        <Link className="admin-entry-link" href="/admin">
          Admin sign in
        </Link>
      </header>

      <MasjidFinder masjids={masjids} />
      <StaleDefaultCleanup active={clearStaleDefault} />

      <footer className="landing-footer">
        <p>Always check the date when a jamaat time changes.</p>
      </footer>
    </main>
  );
}
