import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_USER_HEADER,
  serializeForwardedUser,
  type ForwardedAdminUser,
} from "@/lib/admin-session-header";

function isPublicAdminPath(pathname: string) {
  return (
    pathname === "/admin/login" ||
    pathname.startsWith("/admin/login/") ||
    pathname === "/admin/forgot-password" ||
    pathname.startsWith("/admin/forgot-password/")
  );
}

function isProtectedAdminPage(pathname: string) {
  return pathname.startsWith("/admin") && !isPublicAdminPath(pathname);
}

function withRefreshedCookies(
  response: NextResponse,
  cookies: {
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }[],
) {
  cookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );
  // A refreshed session is written with Set-Cookie. Keep that response out of
  // any shared cache so one visitor cannot receive another's session.
  if (cookies.length > 0) {
    response.headers.set(
      "Cache-Control",
      "private, no-cache, no-store, must-revalidate",
    );
    response.headers.set("Expires", "0");
    response.headers.set("Pragma", "no-cache");
  }
  return response;
}

function sessionFromClaims(claims: {
  sub?: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
} | null): ForwardedAdminUser | null {
  if (!claims?.sub || !claims.email) return null;
  return {
    id: claims.sub,
    email: claims.email,
    mustChangePassword: claims.app_metadata?.must_change_password === true,
  };
}

export async function proxy(request: NextRequest) {
  // Build the request headers we forward downstream. Always strip any inbound
  // value of our trusted header so a client can never forge an admin identity —
  // only this middleware, after validating the session, may set it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(ADMIN_USER_HEADER);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  let refreshedCookies: {
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }[] = [];

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        refreshedCookies = cookiesToSet;
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
      },
    },
  });

  // getClaims() verifies the JWT locally (this project signs with ES256).
  // getUser() would call Auth on every page and API request. Sign-in loads
  // /admin together with its API routes, and those parallel Auth calls were
  // slow enough to leave the page on its skeleton — and a thrown Auth error
  // took down the whole request.
  let session: ForwardedAdminUser | null = null;
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (!error) {
      const claims = data?.claims;
      session = sessionFromClaims(
        claims
          ? {
              sub: claims.sub,
              email: claims.email,
              app_metadata: claims.app_metadata,
            }
          : null,
      );
    }
  } catch {
    session = null;
  }

  // Optimistic gate only: send signed-out visitors straight to login so they
  // never paint the /admin client shell's loading state first. API routes still
  // enforce auth themselves and must keep returning 401 JSON.
  if (isProtectedAdminPage(request.nextUrl.pathname) && !session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    return withRefreshedCookies(
      NextResponse.redirect(loginUrl),
      refreshedCookies,
    );
  }

  if (session) {
    requestHeaders.set(ADMIN_USER_HEADER, serializeForwardedUser(session));
  }

  return withRefreshedCookies(
    NextResponse.next({ request: { headers: requestHeaders } }),
    refreshedCookies,
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg|manifest.webmanifest|sw.js).*)"],
};
