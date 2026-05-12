import { NextResponse, type NextRequest } from "next/server";

const ignoredFirstSegments = new Set(["", "_next", "api", "admin", "health", "favicon.ico"]);

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

function isIgnoredPath(pathname: string) {
  const firstSegment = pathname.split("/")[1] ?? "";
  return ignoredFirstSegments.has(firstSegment);
}

function cleanCssToken(value: string | undefined, fallback: string) {
  return (value ?? fallback).replace(/^"|"$/g, "");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isIgnoredPath(pathname)) {
    return NextResponse.next();
  }

  const eventSlug = pathname.split("/")[1];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return new NextResponse("Event lookup is not configured", { status: 500 });
  }

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

  const headers = new Headers(request.headers);
  headers.set("x-event-id", event.id);
  headers.set("x-event-slug", event.slug);
  headers.set("x-event-name", event.name);
  headers.set("x-event-lifecycle-state", event.lifecycle_state);
  headers.set("x-brand-primary", cleanCssToken(event.brand_tokens?.primary, "18 110 130"));
  headers.set("x-brand-ink", cleanCssToken(event.brand_tokens?.ink, "18 23 28"));

  return NextResponse.next({
    request: {
      headers
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
