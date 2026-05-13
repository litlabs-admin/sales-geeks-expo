import { NextResponse } from "next/server";
import { backendBaseUrl } from "@/lib/config";

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
