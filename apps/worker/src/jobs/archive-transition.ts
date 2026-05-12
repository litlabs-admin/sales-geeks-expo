import { sql } from "../db";

export async function archiveTransition() {
  const rows = await sql<{ id: string; slug: string }[]>`
    update public.events
    set lifecycle_state = 'post_event_archive',
        updated_at = now()
    where lifecycle_state <> 'post_event_archive'
      and ends_at < now()
    returning id, slug
  `;

  return { archived: rows.length, events: rows };
}
