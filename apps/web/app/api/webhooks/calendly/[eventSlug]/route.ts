import { NextResponse } from "next/server";

function backendBaseUrl() {
  return (
    process.env.BACKEND_URL?.replace(/\/health$/, "") ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "http://localhost:8081"
  );
}

export async function POST(request: Request, { params }: { params: { eventSlug: string } }) {
  const payload = await request.text();
  const response = await fetch(`${backendBaseUrl()}/webhooks/calendly/${params.eventSlug}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sgexpo-signature": request.headers.get("x-sgexpo-signature") ?? ""
    },
    body: payload
  });

  return NextResponse.json(await response.json(), { status: response.status });
}
