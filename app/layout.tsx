import type { Metadata, Viewport } from "next";
import { DM_Sans, Noto_Nastaliq_Urdu } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const notoNastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "600"],
  variable: "--font-noto-nastaliq",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Masjid Prayer Times",
  description: "Current jamaat times for participating masjids.",
  applicationName: "Masjid Prayer Times",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Masjid Prayer Times",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#103e39",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${notoNastaliq.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
