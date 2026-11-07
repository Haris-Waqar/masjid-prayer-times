import { NextResponse } from "next/server";
import {
  DEFAULT_MOSQUE_COOKIE,
  DEFAULT_MOSQUE_MAX_AGE_SECONDS,
} from "@/lib/default-mosque";
import { isValidMosqueSlug } from "@/lib/mosques";
import { getActiveMosqueBySlug } from "@/lib/schedule";

const MAX_BODY_BYTES = 512;

function noStoreJson(body: object, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function isSlugInput(value: unknown): value is { slug: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    "slug" in value &&
    isValidMosqueSlug(value.slug)
  );
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return noStoreJson({ error: "Request is too large." }, 413);
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return noStoreJson({ error: "The request could not be read." }, 400);
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return noStoreJson({ error: "Request is too large." }, 413);
  }

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return noStoreJson({ error: "Invalid JSON." }, 400);
  }
  if (!isSlugInput(input)) {
    return noStoreJson({ error: "Choose a valid masjid." }, 400);
  }

  try {
    const mosque = await getActiveMosqueBySlug(input.slug);
    if (!mosque) {
      return noStoreJson({ error: "That masjid is not available." }, 404);
    }

    const response = noStoreJson({ ok: true });
    response.cookies.set(DEFAULT_MOSQUE_COOKIE, mosque.slug, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DEFAULT_MOSQUE_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    return noStoreJson({ error: "Your default masjid could not be saved." }, 500);
  }
}

export async function DELETE() {
  const response = noStoreJson({ ok: true });
  response.cookies.set(DEFAULT_MOSQUE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
