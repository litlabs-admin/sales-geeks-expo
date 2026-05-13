import { backendBaseUrl } from "./config";

type FetchOptions = {
  order?: string;
  limit?: number;
};

export async function fetchContent<T>(
  table: string,
  eventId: string,
  select = "*",
  options: FetchOptions = {}
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing Supabase public env vars");
  }

  const params = new URLSearchParams({
    event_id: `eq.${eventId}`,
    select
  });

  if (options.order) params.set("order", options.order);
  if (options.limit) params.set("limit", String(options.limit));

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${params.toString()}`, {
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${table}: ${response.status}`);
  }

  return (await response.json()) as T[];
}

export async function backendGet<T>(path: string) {
  const baseUrl = backendBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}
