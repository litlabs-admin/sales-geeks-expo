import { headers } from "next/headers";
import JoinForm from "./join-form";

export default function JoinPage({ params }: { params: { eventSlug: string } }) {
  const headerStore = headers();
  const eventId = headerStore.get("x-event-id");
  const eventName = headerStore.get("x-event-name") ?? "Event";

  if (!eventId) {
    return <main className="p-6">Event not found.</main>;
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-10">
      <p className="text-sm font-medium text-brand">{eventName}</p>
      <h1 className="mt-3 text-2xl font-semibold text-ink">Join the event app</h1>
      <JoinForm eventId={eventId} eventSlug={params.eventSlug} />
    </main>
  );
}
