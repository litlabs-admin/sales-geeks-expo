import { headers } from "next/headers";
import ProfileClient from "./profile-client";

export default function ProfilePage() {
  const headerStore = headers();
  const eventId = headerStore.get("x-event-id") ?? "";
  const slug = headerStore.get("x-event-slug") ?? "sge-2026";

  return (
    <main className="mx-auto max-w-xl px-4 pb-6">
      <ProfileClient eventId={eventId} slug={slug} />
    </main>
  );
}
