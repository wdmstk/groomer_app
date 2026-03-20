alter table if exists public.store_subscriptions
  add column if not exists ai_plan_code text not null default 'none';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_subscriptions_ai_plan_code_check'
  ) then
    alter table public.store_subscriptions
      add constraint store_subscriptions_ai_plan_code_check
      check (ai_plan_code in ('none', 'assist', 'pro', 'pro_plus'));
  end if;
end $$;
