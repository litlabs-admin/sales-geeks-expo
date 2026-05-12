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
  const response = await fetch(`${backendBaseUrl()}/rewards?${url.searchParams.toString()}`, {
    headers: { authorization },
    cache: "no-store"
  });

  return NextResponse.json(await response.json(), { status: response.status });
}
