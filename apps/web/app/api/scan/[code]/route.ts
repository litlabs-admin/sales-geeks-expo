import { NextResponse } from "next/server";

function backendBaseUrl() {
  return (
    process.env.BACKEND_URL?.replace(/\/health$/, "") ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "http://localhost:8080"
  );
}

export async function POST(request: Request, { params }: { params: { code: string } }) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const response = await fetch(`${backendBaseUrl()}/scan/${params.code}`, {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json"
    },
    body: await request.text()
  });

  return NextResponse.json(await response.json(), { status: response.status });
}
