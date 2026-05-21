# Event-Ready Content — SQL Runbook

Replaces all placeholder/test data in the DB with real Scottish Growth Expo 2026 content.  
Run **once** in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).

> **Scope:** agenda sessions · geek bios · FAQs · welcome announcement  
> **Not touched:** sponsors (update those separately once you have the real names), rewards, QR codes, attendees.

---

## SQL

```sql
DO $$
DECLARE
  eid uuid;
BEGIN
  SELECT id INTO eid FROM public.events WHERE slug = 'sge-2026' LIMIT 1;
  IF eid IS NULL THEN
    RAISE EXCEPTION 'Event sge-2026 not found — check the slug.';
  END IF;

  -- ────────────────────────────────────────────
  -- 1. Agenda sessions
  -- ────────────────────────────────────────────
  DELETE FROM public.agenda_sessions WHERE event_id = eid;

  INSERT INTO public.agenda_sessions
    (event_id, title, description, stage, category, type, starts_at, ends_at, speaker_id, sponsor_id)
  VALUES
    (eid, 'Registration',
     'Collect your badge, grab a coffee, and explore the expo floor before the day kicks off.',
     'Entrance Hall', 'Operations', 'registration',
     '2026-05-26 08:30:00+01', '2026-05-26 09:00:00+01', null, null),

    (eid, 'Exhibition Floor Opens',
     'Meet our sponsors and exhibitors. 40 stands packed with the people shaping Scottish business growth.',
     'Expo Floor', 'Networking', 'expo',
     '2026-05-26 09:00:00+01', '2026-05-26 10:00:00+01', null, null),

    (eid, 'Opening Keynote',
     'The SalesGeek team sets the agenda for the day — what growth means in 2026 and what you''re taking home.',
     'Main Stage', 'Keynote', 'keynote',
     '2026-05-26 10:00:00+01', '2026-05-26 10:30:00+01', null, null),

    (eid, 'Katy Morrison',
     'A keynote on building real sales momentum — practical, high-energy, and immediately applicable.',
     'Main Stage', 'Keynote', 'keynote',
     '2026-05-26 11:20:00+01', '2026-05-26 12:00:00+01', null, null),

    (eid, 'Lunch & Networking',
     'Refuel and reconnect. The expo floor stays open — use this time to meet the sponsors and peers you haven''t reached yet.',
     'Expo Floor', 'Networking', 'networking',
     '2026-05-26 12:00:00+01', '2026-05-26 13:00:00+01', null, null),

    (eid, 'Brian Williamson',
     'The main afternoon keynote. Sales leadership, growth strategy, and what top performers do differently.',
     'Main Stage', 'Keynote', 'keynote',
     '2026-05-26 13:00:00+01', '2026-05-26 14:00:00+01', null, null),

    (eid, 'VIP Q&A',
     'An invite-only session for registered VIP attendees. Location confirmed on the day.',
     'VIP Suite', 'VIP', 'qa',
     '2026-05-26 14:15:00+01', '2026-05-26 15:00:00+01', null, null),

    (eid, 'Russell Dalgliesh',
     'The closing keynote — Russell brings the day together with actionable takeaways and a challenge to every leader in the room.',
     'Main Stage', 'Keynote', 'keynote',
     '2026-05-26 14:45:00+01', '2026-05-26 15:45:00+01', null, null),

    (eid, 'Closing & Networking',
     'Official close, prize announcements, and open networking. The perfect opportunity to follow up on the conversations you''ve started.',
     'Main Stage', 'Operations', 'networking',
     '2026-05-26 15:45:00+01', '2026-05-26 17:00:00+01', null, null);

  -- ────────────────────────────────────────────
  -- 2. Geek bios
  -- ────────────────────────────────────────────
  UPDATE public.geeks
  SET bio = 'Scotland''s SalesGeek. Host of Scottish Growth Expo 2026 and founder of the SalesGeek movement. William has spent two decades in the trenches of sales leadership — and now shares everything he''s learned. Win a private post-event strategy session with William in the Rewards tab.',
      sort_order = 1
  WHERE event_id = eid AND is_william = true;

  UPDATE public.geeks
  SET bio = 'Katy Morrison is a sales and marketing strategist known for her high-energy approach to building pipelines that actually close. She''s spoken to audiences across the UK and brings practical frameworks you can use from Monday morning.',
      sort_order = 2
  WHERE event_id = eid AND lower(name) LIKE '%katy%';

  UPDATE public.geeks
  SET bio = 'Brian Williamson has led sales teams through rapid growth — and just as importantly, through the hard moments. His keynotes are grounded in what works at the coalface, not theory.',
      sort_order = 3
  WHERE event_id = eid AND lower(name) LIKE '%brian%';

  UPDATE public.geeks
  SET bio = 'Russell Dalgliesh helps leaders turn good conversations into decisive next steps. His closing keynote is a challenge and a roadmap — expect to leave with a clear plan.',
      sort_order = 4
  WHERE event_id = eid AND lower(name) LIKE '%russell%';

  -- ────────────────────────────────────────────
  -- 3. FAQs  (replace all fake placeholder rows)
  -- ────────────────────────────────────────────
  DELETE FROM public.faqs WHERE event_id = eid;

  INSERT INTO public.faqs (event_id, question, answer, sort_order)
  VALUES
    (eid, 'What time does the event start?',
     'Registration opens at 08:30. The exhibition floor opens at 09:00 and the opening keynote begins at 10:00.',
     1),
    (eid, 'Where is the venue?',
     'Scottish Growth Expo 2026 is held at Hampden National Stadium, Glasgow. Follow signs for the corporate entrance on arrival.',
     2),
    (eid, 'Is parking available at Hampden?',
     'Yes — on-site parking is available. Allow extra time during peak arrival (08:30–09:30).',
     3),
    (eid, 'How do I earn points?',
     'Scan QR codes around the venue — on sponsor stands, during sessions, and at hidden locations. Each scan awards points instantly. Scanning the same code twice doesn''t give double points.',
     4),
    (eid, 'What is the leaderboard?',
     'The leaderboard ranks attendees by competition score. Your alias is shown — not your name or email. Top-ranked attendees at close of event win prizes.',
     5),
    (eid, 'What are the Rewards?',
     'Exchange your points for rewards in the Rewards tab. The premium reward — a private post-event strategy session with William — is limited. Redeem early to secure your slot.',
     6),
    (eid, 'What is the VIP Q&A?',
     'The VIP Q&A (14:15–15:00) is an invite-only session. If you have a VIP pass, the location will be confirmed on the day.',
     7),
    (eid, 'Who do I contact if I have a problem?',
     'Find a member of the SalesGeek team (yellow lanyards) or visit the registration desk. You can also contact us via the details on your event invitation.',
     8);

  -- ────────────────────────────────────────────
  -- 4. Welcome announcement (reset to single clean entry)
  -- ────────────────────────────────────────────
  DELETE FROM public.announcements WHERE event_id = eid;

  INSERT INTO public.announcements (event_id, title, body)
  VALUES (eid,
    'Welcome to Scottish Growth Expo 2026',
    'Good morning! Doors are open and the expo floor is live. Use this app for the live agenda, to meet the Geeks, scan QR codes for points, and redeem rewards. Have a brilliant day.');

  -- ────────────────────────────────────────────
  -- 5. Rewards — fix the 10-pt test reward → 100 pts, move to last
  -- ────────────────────────────────────────────
  UPDATE public.rewards
  SET cost = 100,
      sort_order = (SELECT coalesce(max(sort_order), 0) + 1 FROM public.rewards WHERE event_id = eid AND type != 'william_premium')
  WHERE event_id = eid
    AND cost = 10
    AND type = 'standard';

  -- ────────────────────────────────────────────
  -- 6. Remove SGE 2027 (keep only 2026)
  -- ────────────────────────────────────────────
  -- Cascade-deletes all child rows (attendees, agenda, geeks, etc.) for that event.
  DELETE FROM public.events
  WHERE (slug LIKE '%2027%' OR name LIKE '%2027%')
    AND slug != 'sge-2026';

  RAISE NOTICE 'Event-ready content applied to event %', eid;
END $$;
```

---

## After running

- **Agenda** — visit the Agenda tab in the app to confirm 9 sessions appear in the correct order.
- **Geeks** — visit the Geeks tab to verify bios look right. Update speaker talk titles once confirmed by the speakers.
- **FAQs** — visit the FAQs tab to check the 8 questions render correctly.
- **Sponsors** — still showing placeholder names (`Strategic Headline Partner`, etc.). Update those separately in Supabase → Table Editor → `sponsors` once you have the real company names.
- **Announcement** — the welcome message will appear on the Home tab. Add further announcements on the day via Admin → Notifications.
- **SGE 2027** — deleted. Admin → Events should now show only Scottish Growth Expo 2026.
- **Rewards** — the reward that was priced at 10 pts is now 100 pts and sorts last.
