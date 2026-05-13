import { backendBaseUrl } from "@/lib/config";

export async function GET(request: Request, { params }: { params: { type: string } }) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return Response.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const url = new URL(request.url);
  const response = await fetch(`${backendBaseUrl()}/admin/exports/${params.type}?${url.searchParams.toString()}`, {
    headers: { authorization },
    cache: "no-store"
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "text/csv",
      "x-export-as-of": response.headers.get("x-export-as-of") ?? ""
    }
  });
}
