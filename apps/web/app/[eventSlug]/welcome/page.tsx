import { headers } from "next/headers";
import WelcomeClient from "./welcome-client";

export default function WelcomePage({ params }: { params: { eventSlug: string } }) {
  const h = headers();
  const slug = h.get("x-event-slug") ?? params.eventSlug;
  const eventId = h.get("x-event-id") ?? "";
  return <WelcomeClient eventId={eventId} slug={slug} />;
}
