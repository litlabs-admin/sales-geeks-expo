import { NextResponse } from "next/server";

function backendUrl() {
  return (
    process.env.BACKEND_URL?.replace(/\/health$/, "") ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "http://localhost:8081"
  );
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const response = await fetch(`${backendUrl()}/attendees/connect`, {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  return NextResponse.json(await response.json(), { status: response.status });
}
