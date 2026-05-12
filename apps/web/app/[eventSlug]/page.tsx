import { redirect } from "next/navigation";

export default function EventPage({ params }: { params: { eventSlug: string } }) {
  redirect(`/${params.eventSlug}/home`);
}
