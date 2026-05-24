import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@sgexpo/contracts/db-types";
import { backendBaseUrl } from "@/lib/config";

type LoginMode = "attendee" | "staff" | "admin" | "business";

type MagicLinkInput = {
  email?: unknown;
  mode?: unknown;
  next?: unknown;
  eventSlug?: unknown;
  meta?: unknown;
};

type AppUser = {
  role: string;
};

const seededFallbackEmails = {
  admin: "admin+sgexpo@litlabs.io",
  staff: "staff+sgexpo@litlabs.io",
  attendee: "attendee+sgexpo@litlabs.io",
  business: "business+sgexpo@litlabs.io"
} as const;

function normalizedEmail(value: unknown) {
  return typeof value === "string" && value.trim().includes("@") ? value.trim().toLowerCase() : null;
}

function modeFrom(value: unknown): LoginMode {
  if (value === "admin" || value === "staff" || value === "business") return value;
  return "attendee";
}

function optionalPath(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function optionalSlug(value: unknown) {
  return typeof value === "string" && /^[a-z0-9-]+$/i.test(value) ? value : null;
}

function configuredSeededEmails() {
  return new Set(
    [
      process.env.DEV_ADMIN_EMAIL ?? seededFallbackEmails.admin,
      process.env.DEV_STAFF_EMAIL ?? seededFallbackEmails.staff,
      process.env.DEV_ATTENDEE_EMAIL ?? seededFallbackEmails.attendee,
      process.env.DEV_BUSINESS_EMAIL ?? seededFallbackEmails.business
    ].map((email) => email.trim().toLowerCase())
  );
}

function shouldAutoOpenSeededLogin(email: string) {
  return process.env.NODE_ENV !== "production" && configuredSeededEmails().has(email);
}

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase service-role configuration");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function verifyUrl(request: NextRequest, input: { tokenHash: string; mode: LoginMode; next: string; eventSlug: string | null }) {
  // Verify in the browser (JS) instead of the server GET route: email
  // security scanners and link-tracking bots don't execute JavaScript, so
  // the single-use token survives their pre-fetch and is only consumed by
  // the real user's click. Prevents "sign-in link expired/already used".
  const url = new URL("/auth/verify", request.url);
  url.searchParams.set("token_hash", input.tokenHash);
  url.searchParams.set("type", "magiclink");
  url.searchParams.set("mode", input.mode);
  url.searchParams.set("next", input.next);

  if (input.eventSlug) {
    url.searchParams.set("eventSlug", input.eventSlug);
  }

  return url.toString();
}

function emailHtml(link: string, mode: LoginMode) {
  const label = mode === "admin" ? "Admin sign in" : mode === "staff" ? "Staff sign in" : "Join the event app";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#12171c">
      <p style="font-size:14px;color:#228b56;margin:0 0 12px">SalesGeek Scotland</p>
      <h1 style="font-size:22px;margin:0 0 12px">${label}</h1>
      <p>Open this secure link to continue:</p>
      <p><a href="${link}" style="display:inline-block;background:#228b56;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">Continue</a></p>
      <p style="font-size:12px;color:#52616f">If the button does not work, paste this URL into your browser:</p>
      <p style="font-size:12px;word-break:break-all;color:#52616f">${link}</p>
    </div>
  `;
}

async function sendWithResend(input: { to: string; link: string; mode: LoginMode }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("Missing Resend email configuration");
  }

  const subject =
    input.mode === "admin"
      ? "Your SalesGeek admin sign-in link"
      : input.mode === "staff"
        ? "Your SalesGeek staff sign-in link"
        : "Your Scottish Growth Expo app sign-in link";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject,
      html: emailHtml(input.link, input.mode),
      text: `Open this secure sign-in link: ${input.link}`
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || "Resend email request failed");
  }
}

function genericOk() {
  return NextResponse.json({
    ok: true,
    message: "If this email can access the app, a sign-in link has been sent."
  });
}

function seededLoginOk(link: string) {
  return NextResponse.json({
    ok: true,
    message: "Opening seeded test account...",
    dev_verify_url: link
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as MagicLinkInput;
  const email = normalizedEmail(body.email);

  if (!email) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const mode = modeFrom(body.mode);
  const defaultNext = mode === "admin" ? "/admin/events" : mode === "staff" ? "/staff/qr" : mode === "business" ? "/business/dashboard" : "/";
  const next = optionalPath(body.next, defaultNext);
  const eventSlug = optionalSlug(body.eventSlug);
  const supabase = serviceSupabase();

  // For admin/staff, verify the role; business users go through without role check (like attendees)
  if (mode === "admin" || mode === "staff") {
    const { data: users, error } = await supabase.from("users").select("role").eq("email", email).limit(1);

    if (error) {
      return NextResponse.json({ error: "Could not check account access" }, { status: 500 });
    }

    const user = (users?.[0] ?? null) as AppUser | null;
    const hasAccess = mode === "admin" ? user?.role === "admin" : user?.role === "staff" || user?.role === "admin";

    if (!hasAccess) {
      return genericOk();
    }
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      data: { source: "resend_custom_auth" }
    }
  });

  if (error || !data.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message ?? "Could not create sign-in link" }, { status: 500 });
  }

  const link = verifyUrl(request, {
    tokenHash: data.properties.hashed_token,
    mode,
    next,
    eventSlug
  });

  // Attendee row creation is intentionally NOT done here — the attendee
  // layout calls /attendees/upsert on every page load and is the canonical
  // path for creating the row. Doing it inline here added two DB round-trips
  // to the login critical path and pushed P95 latency to 35s+ under a
  // 400-VU burst. Layout upsert runs ~50ms after the verify completes, so
  // the user experience is unchanged.

  if (mode === "business") {
    const meta = typeof body.meta === "object" && body.meta !== null ? body.meta as Record<string, unknown> : null;
    const businessName = typeof meta?.business_name === "string" ? meta.business_name.trim() || null : null;
    const websiteUrl = typeof meta?.website_url === "string" ? meta.website_url.trim() || null : null;
    const metaSlug = typeof meta?.event_slug === "string" ? meta.event_slug : null;
    const resolvedSlug = metaSlug ?? eventSlug ?? "sge-2026";

    if (businessName) {
      await fetch(`${backendBaseUrl()}/business/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: businessName, contact_email: email, website_url: websiteUrl, event_slug: resolvedSlug })
      }).catch(() => {});
    }
  }

  // Email-only check-in: attendee + business modes skip email delivery and
  // auto-redirect to the verify URL. Anyone with a valid email can sign in;
  // identity will be cross-verified at the door via QR (added later).
  if (mode === "attendee" || mode === "business" || shouldAutoOpenSeededLogin(email)) {
    return seededLoginOk(link);
  }

  try {
    await sendWithResend({ to: email, link, mode });
  } catch (err) {
    console.error("[magic-link] Resend delivery failed:", err instanceof Error ? err.message : err);
  }

  return genericOk();
}
