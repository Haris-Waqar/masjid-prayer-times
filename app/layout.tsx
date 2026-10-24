import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jamia Masjid Fazaia Town Prayer Times",
  description: "Current jamaat times for Jamia Masjid Fazaia Town, Lahore.",
  applicationName: "Fazaia Masjid Times",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fazaia Masjid Times",
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
