import { headers } from "next/headers";
import { fetchContent } from "@/lib/content";
import GeeksClient from "./geeks-client";

type Geek = {
  id: string;
  name: string;
  bio: string;
  calendly_url: string | null;
};

export default async function GeeksPage() {
  const eventId = headers().get("x-event-id") ?? "";
  const geeks = await fetchContent<Geek>("geeks", eventId, "id,name,bio,calendly_url", {
    order: "sort_order.asc"
  }).catch(() => [] as Geek[]);

  return <GeeksClient geeks={geeks} />;
}
