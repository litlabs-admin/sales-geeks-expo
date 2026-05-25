import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@sgexpo/contracts/db-types";

const ignoredFirstSegments = new Set([
  "",
  "_next",
  "api",
  "admin",
  "staff",
  "business",
  "auth",
  "access-denied",
  "dev",
  "tv",
  "health",
  "login",
  "favicon.ico"
]);


type PublicEvent = {
  id: string;
  slug: string;
  name: string;
  lifecycle_state: string;
  brand_tokens: {
    primary?: string;
    ink?: string;
    logo_url?: string | null;
  } | null;
};

type CookieToSet = { name: string; value: string; options: CookieOptions };

function isIgnoredPath(pathname: string) {
  const firstSegment = pathname.split("/")[1] ?? "";
  return ignoredFirstSegments.has(firstSegment);
}

function cleanCssToken(value: string | undefined, fallback: string) {
  return (value ?? fallback).replace(/^"|"$/g, "");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const requestHeaders = new Headers(request.headers);
  const authCookies: CookieToSet[] = [];

  if (!supabaseUrl || !anonKey) {
    return new NextResponse("Event lookup is not configured", { status: 500 });
  }

  const supabase = createServerClient<Database>(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        authCookies.push(...cookiesToSet);
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      }
    }
  });

  await supabase.auth.getUser();

  function nextWithAuthCookies(headers = requestHeaders) {
    const response = NextResponse.next({
      request: {
        headers
      }
    });

    authCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  }

  if (isIgnoredPath(pathname)) {
    return nextWithAuthCookies();
  }

  const eventSlug = pathname.split("/")[1];

  const response = await fetch(
    `${supabaseUrl}/rest/v1/events_public?slug=eq.${encodeURIComponent(
      eventSlug
    )}&select=id,slug,name,lifecycle_state,brand_tokens&limit=1`,
    {
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`
      }
    }
  );

  if (!response.ok) {
    return new NextResponse("Event lookup failed", { status: 502 });
  }

  const events = (await response.json()) as PublicEvent[];
  const event = events[0];

  if (!event) {
    return new NextResponse("Event not found", { status: 404 });
  }

  const headers = new Headers(requestHeaders);
  headers.set("x-event-id", event.id);
  headers.set("x-event-slug", event.slug);
  headers.set("x-event-name", event.name);
  headers.set("x-event-lifecycle-state", event.lifecycle_state);
  headers.set("x-brand-primary", cleanCssToken(event.brand_tokens?.primary, "18 110 130"));
  headers.set("x-brand-ink", cleanCssToken(event.brand_tokens?.ink, "18 23 28"));
  headers.set("x-request-path", `${request.nextUrl.pathname}${request.nextUrl.search}`);

  return nextWithAuthCookies(headers);
}

export const config = {
  // Skip middleware for static assets in /public (images, fonts, etc.) so
  // they don't get treated as event slugs and 404 with "Event not found".
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|otf|css|map)).*)"
  ]
};
