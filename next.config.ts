import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Client-side Router Cache. By default dynamic pages use `dynamic: 0`,
    // which makes the client discard a page the moment you leave it — so
    // navigating back re-fetches the RSC payload from the server every time
    // and flashes a loading state. Holding the payload for a few minutes makes
    // back/forth navigation between recently-visited pages instant with no
    // server round-trip. Fresh data still loads on first visit and after the
    // window elapses; the service worker also refreshes "/" on time changes.
    staleTimes: {
      dynamic: 180,
      static: 300,
    },
  },
};

export default nextConfig;
