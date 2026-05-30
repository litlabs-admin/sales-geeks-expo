-- 0015_drop_rewards_subsystem.sql
--
-- The reward-redemption and William premium-reward features were cut from the
-- product (rewards shipped as a static, non-redeemable prize gallery). This
-- migration removes the now-dead schema. Safe: no reward was ever redeemed, so
-- these tables hold no meaningful data.
--
-- Order matters — drop the dependent view and child tables before the parent.

-- 1. Ops view that selected from public.rewards (low-stock alerting).
drop view if exists public.vw_ops_low_stock;

-- 2. Reward tables (children first; cascade clears FKs and any stray refs).
drop table if exists public.redemption_holds cascade;
drop table if exists public.redemption_records cascade;
drop table if exists public.rewards cascade;

-- 3. Enum types that only the reward tables used.
drop type if exists public.redemption_state;
drop type if exists public.reward_type;

-- 4. The William flag on geeks — the premium reward is gone; the Book-a-chat
--    link lives in geeks.calendly_url, which stays.
alter table public.geeks drop column if exists is_william;
