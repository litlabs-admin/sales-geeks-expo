import { NextRequest } from "next/server";
import { backendGet } from "@/lib/content";

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("event_id");

  if (!eventId) {
    return Response.json({ error: "event_id is required" }, { status: 400 });
  }

  const data = await backendGet(`/announcements?event_id=${eventId}`);
  return Response.json(data);
}
