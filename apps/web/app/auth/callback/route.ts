import { NextResponse, type NextRequest } from "next/server";
import { backendBaseUrl } from "@/lib/config";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type CallbackMode = "attendee" | "staff" | "admin" | "business";

type ActorResponse = {
  actor?: {
    role?: "attendee" | "staff" | "admin";
  };
};

function safeNextPath(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function modeFrom(value: string | null): CallbackMode {
  if (value === "admin" || value === "staff" || value === "business") return value;
  return "attendee";
}

function eventSlugFrom(next: string) {
  const firstSegment = next.split("/")[1];
  return firstSegment && !["admin", "staff", "business", "auth", "api", "dev", "login"].includes(firstSegment)
    ? firstSegment
    : null;
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = modeFrom(searchParams.get("mode"));
  const fallback =
    mode === "admin" ? "/admin/events" :
    mode === "staff" ? "/staff/qr" :
    mode === "business" ? "/business/dashboard" :
    "/";
  const next = safeNextPath(searchParams.get("next"), fallback);
  const eventSlug = searchParams.get("eventSlug") ?? eventSlugFrom(next);
  const loginPath =
    mode === "admin" ? "/admin/login" :
    mode === "staff" ? "/staff/login" :
    mode === "business" ? "/business/login" :
    eventSlug ? `/${eventSlug}/join` : "/";
  const errorDescription = searchParams.get("error_description");
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const tokenType = searchParams.get("type") === "magiclink" ? "magiclink" : null;

  if (errorDescription || (!code && !tokenHash)) {
    return redirectTo(request, `${loginPath}?error=invalid_link&next=${encodeURIComponent(next)}`);
  }

  const supabase = createServerSupabaseClient();

  // Already signed in (e.g. re-opened an old/used email link while the
  // session is still alive) — go straight to the destination via a clean
  // server redirect. Never flash the "link expired" page to a logged-in
  // user, and never touch the one-time token.
  const { data: existingSession } = await supabase.auth.getSession();
  if (existingSession.session?.access_token) {
    return redirectTo(request, next);
  }

  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: tokenType ?? "magiclink"
      });

  if (error || !data.session?.access_token) {
    return redirectTo(request, `${loginPath}?error=expired_link&next=${encodeURIComponent(next)}`);
  }

  const token = data.session.access_token;
  const actorResponse = await fetch(`${backendBaseUrl()}/me`, {
    headers: {
      authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });
  const actorPayload = (await actorResponse.json().catch(() => ({}))) as ActorResponse;
  const role = actorPayload.actor?.role;

  if (mode === "admin" && role !== "admin") {
    return redirectTo(request, "/access-denied?required=admin");
  }

  if (mode === "staff" && role !== "staff" && role !== "admin") {
    return redirectTo(request, "/access-denied?required=staff");
  }

  // Business users: no extra setup needed — they land on their dashboard
  if (mode === "business") {
    return redirectTo(request, next);
  }

  if (mode === "attendee") {
    if (eventSlug) {
      const { data: events } = await supabase
        .from("events_public")
        .select("id")
        .eq("slug", eventSlug)
        .limit(1);
      const eventId = (events as Array<{ id: string }> | null)?.[0]?.id;

      if (eventId) {
        await fetch(`${backendBaseUrl()}/attendees/upsert`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({ event_id: eventId })
        });
      }
    }
  }

  return redirectTo(request, next);
}
