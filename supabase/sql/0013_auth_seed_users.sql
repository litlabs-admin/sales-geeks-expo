-- ============================================================
-- 0013_auth_seed_users.sql
-- Seeds the admin auth account + dummy attendee/business identities
-- for end-to-end testing without email delivery.
--
-- After running this:
--   • Admin login   (/admin/login):
--       admin+sgexpo@litlabs.io  /  adminsgexpo@123
--   • Attendee (root landing page → JOIN APP):
--       demo@sgexpo.test         (instant access, no password)
--   • Business  (root landing page → Business section):
--       demo-business@sgexpo.test (instant access, no password)
--
-- Idempotent: safe to re-run. Also force-resets the older seeded
-- emails (attendee+sgexpo@..., business+sgexpo@...) back to the
-- 'attendee' role in case prior testing left them as staff/admin.
-- ============================================================

DO $$
DECLARE
  admin_email    text := 'admin+sgexpo@litlabs.io';
  admin_password text := 'adminsgexpo@123';
  admin_user_id  uuid;
BEGIN
  -- ────────────────────────────────────────────────────────
  -- 1. Admin auth user (Supabase email + password)
  -- ────────────────────────────────────────────────────────
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = admin_email
  LIMIT 1;

  IF admin_user_id IS NULL THEN
    admin_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      admin_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      admin_user_id,
      jsonb_build_object(
        'sub', admin_user_id::text,
        'email', admin_email,
        'email_verified', true
      ),
      'email',
      admin_user_id::text,
      now(),
      now(),
      now()
    );
  ELSE
    -- Reset password on every run so the documented credentials
    -- always work even if someone changed them in the dashboard.
    UPDATE auth.users
    SET encrypted_password = crypt(admin_password, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = admin_user_id;
  END IF;

  -- Promote to admin role in public.users
  UPDATE public.users
  SET role = 'admin',
      updated_at = now()
  WHERE id = admin_user_id;

  RAISE NOTICE 'Admin auth user ready: %', admin_email;

  -- ────────────────────────────────────────────────────────
  -- 2. Force-reset any previously-seeded dummy accounts back
  --    to role='attendee'. Earlier test runs may have promoted
  --    them, which now causes "Access denied / requires staff"
  --    on attendee pages.
  -- ────────────────────────────────────────────────────────
  UPDATE public.users
  SET role = 'attendee',
      updated_at = now()
  WHERE email IN (
    'attendee+sgexpo@litlabs.io',
    'business+sgexpo@litlabs.io',
    'demo@sgexpo.test',
    'demo-business@sgexpo.test'
  )
    AND role <> 'attendee';

  -- ────────────────────────────────────────────────────────
  -- 3. Dummy business row for demo-business@sgexpo.test
  --    (also keep the older business+sgexpo entry alive so it
  --    still resolves if anyone references it)
  -- ────────────────────────────────────────────────────────
  INSERT INTO public.businesses (event_id, name, contact_email, sponsor_tier)
  SELECT id, 'Demo Business', 'demo-business@sgexpo.test', 'standard'
  FROM public.events
  WHERE slug = 'sge-2026'
  ON CONFLICT (event_id, name) DO UPDATE
    SET contact_email = excluded.contact_email,
        archived_at = NULL,
        updated_at = now();

  RAISE NOTICE 'Dummy business row ready: demo-business@sgexpo.test';
  RAISE NOTICE 'Dummy attendee ready: demo@sgexpo.test (auto-creates on first sign-in)';
END $$;
