import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_USER_HEADER,
  serializeForwardedUser,
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
  return response;
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Optimistic gate only: send signed-out visitors straight to login so they
  // never paint the /admin client shell's loading state first. API routes still
  // enforce auth themselves and must keep returning 401 JSON.
  if (
    isProtectedAdminPage(request.nextUrl.pathname) &&
    !(user?.id && user.email)
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    return withRefreshedCookies(
      NextResponse.redirect(loginUrl),
      refreshedCookies,
    );
  }

  if (user?.id && user.email) {
    requestHeaders.set(
      ADMIN_USER_HEADER,
      serializeForwardedUser({
        id: user.id,
        email: user.email,
        mustChangePassword: user.app_metadata?.must_change_password === true,
      }),
    );
  }

  return withRefreshedCookies(
    NextResponse.next({ request: { headers: requestHeaders } }),
    refreshedCookies,
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg|manifest.webmanifest|sw.js).*)"],
};
