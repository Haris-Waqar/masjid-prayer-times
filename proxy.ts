import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_USER_HEADER,
  serializeForwardedUser,
} from "@/lib/admin-session-header";

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

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  refreshedCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg|manifest.webmanifest|sw.js).*)"],
};
