import { NextResponse } from "next/server";

function backendBaseUrl() {
  return (
    process.env.BACKEND_URL?.replace(/\/health$/, "") ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "http://localhost:8080"
  );
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });

  const url = new URL(request.url);
  const response = await fetch(`${backendBaseUrl()}/notifications/feed?${url.searchParams.toString()}`, {
    headers: { authorization },
    cache: "no-store"
  });

  return NextResponse.json(await response.json(), { status: response.status });
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { notification_id?: string };
  if (!body.notification_id) return NextResponse.json({ error: "notification_id is required" }, { status: 400 });

  const response = await fetch(`${backendBaseUrl()}/notifications/${body.notification_id}/read`, {
    method: "POST",
    headers: { authorization }
  });

  return NextResponse.json(await response.json(), { status: response.status });
}
