import { sql } from "../db";

export async function reconcileWilliam() {
  const rows = await sql<{ id: string }[]>`
    select rr.id
    from public.redemption_records rr
    join public.rewards r on r.id = rr.reward_id
    where rr.state = 'pending_booking'
      and r.type = 'william_premium'
    order by rr.created_at asc
    limit 20
  `;

  return { pending: rows.length };
}
