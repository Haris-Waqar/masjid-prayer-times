import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MosqueChooser } from "@/app/mosque-chooser";
import {
  DEFAULT_MOSQUE_COOKIE,
  parseDefaultMosqueSlug,
} from "@/lib/default-mosque";
import { mosquePublicPath } from "@/lib/mosques";
import { getActiveMosqueBySlug, getActiveMosques } from "@/lib/schedule";

export default async function Home() {
  const cookieStore = await cookies();
  const savedCookie = cookieStore.get(DEFAULT_MOSQUE_COOKIE)?.value;
  const savedSlug = parseDefaultMosqueSlug(savedCookie);
  const [mosques, savedMosque] = await Promise.all([
    getActiveMosques(),
    savedSlug ? getActiveMosqueBySlug(savedSlug) : Promise.resolve(null),
  ]);

  if (savedMosque) redirect(mosquePublicPath(savedMosque.slug));

  return <MosqueChooser mosques={mosques} clearStaleDefault={Boolean(savedCookie)} />;
}
