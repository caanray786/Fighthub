-- ============================================
-- FightHub — grant admin access
-- 1. Dashboard → Authentication → Users → "Add user" → "Create new user"
--    (enter your email + a strong password, tick "Auto Confirm User").
-- 2. Replace the email below with that address, then run this in the SQL Editor.
-- ============================================

insert into public.admins (user_id)
select id from auth.users where email = 'YOUR-EMAIL@example.com'
on conflict (user_id) do nothing;

-- Check: should list your email
select u.email from public.admins a join auth.users u on u.id = a.user_id;
