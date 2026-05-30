import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@sgexpo/contracts/db-types";

// Authenticated areas + attendee event pages need their Supabase session
// cookie refreshed by middleware. Genuinely public paths (TV portals, API
// routes that do their own bearer auth, health) do NOT — skipping the
// getUser() round-trip there removes a network hop from every TV refresh
// (every 15s × N screens) and every API call.
const publicNoAuthSegments = new Set([
  "tv",
  "api",
  "health",
  "access-denied",
  "favicon.ico"
]);

// Paths that need auth refresh but are NOT event-scoped (so skip the event
// lookup): admin/staff/business consoles, the auth + login flows, root.
const nonEventSegments = new Set([
  "",
  "_next",
  "admin",
  "staff",
  "business",
  "auth",
  "login"
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

// In-memory TTL cache for event metadata. Events barely change during their
// run, so a short TTL turns "one Supabase REST call per attendee navigation"
// into "one call per slug per TTL per warm isolate". Big slow-network win.
const EVENT_TTL_MS = 60_000;
const eventCache = new Map<string, { event: PublicEvent; expiresAt: number }>();

function cleanCssToken(value: string | undefined, fallback: string) {
  return (value ?? fallback).replace(/^"|"$/g, "");
}

async function lookupEvent(supabaseUrl: string, anonKey: string, slug: string): Promise<PublicEvent | null> {
  const cached = eventCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) return cached.event;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/events_public?slug=eq.${encodeURIComponent(slug)}&select=id,slug,name,lifecycle_state,brand_tokens&limit=1`,
    { headers: { apikey: anonKey, authorization: `Bearer ${anonKey}` } }
  );
  if (!response.ok) throw new Error("event lookup failed");

  const events = (await response.json()) as PublicEvent[];
  const event = events[0] ?? null;
  if (event) eventCache.set(slug, { event, expiresAt: Date.now() + EVENT_TTL_MS });
  return event;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split("/")[1] ?? "";

  // Public paths: no auth refresh, no event lookup — return immediately.
  if (publicNoAuthSegments.has(firstSegment)) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return new NextResponse("Event lookup is not configured", { status: 500 });
  }

  const requestHeaders = new Headers(request.headers);
  const authCookies: CookieToSet[] = [];

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

  // Refresh the session cookie for authenticated areas + attendee pages.
  await supabase.auth.getUser();

  function nextWithAuthCookies(headers = requestHeaders) {
    const response = NextResponse.next({ request: { headers } });
    authCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  }

  // Non-event-scoped authenticated areas: refresh done, no event header needed.
  if (nonEventSegments.has(firstSegment)) {
    return nextWithAuthCookies();
  }

  // Attendee event page → resolve (cached) event metadata into request headers.
  let event: PublicEvent | null;
  try {
    event = await lookupEvent(supabaseUrl, anonKey, firstSegment);
  } catch {
    return new NextResponse("Event lookup failed", { status: 502 });
  }
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
