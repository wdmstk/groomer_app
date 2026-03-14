-- Resolve existing duplicate payments before applying the unique guard.
-- Keep one payment per appointment, preferring:
-- 1) rows with visit_id
-- 2) newer paid_at
-- 3) newer created_at
--
-- Preview duplicates first:
select
  appointment_id,
  count(*) as payment_count,
  array_agg(
    id
    order by
      case when visit_id is null then 1 else 0 end,
      paid_at desc nulls last,
      created_at desc,
      id desc
  ) as payment_ids
from public.payments
group by appointment_id
having count(*) > 1
order by payment_count desc, appointment_id;

begin;

create temporary table payment_dedupe_candidates on commit drop as
with ranked as (
  select
    p.id as payment_id,
    p.appointment_id,
    p.visit_id,
    row_number() over (
      partition by p.appointment_id
      order by
        case when p.visit_id is null then 1 else 0 end,
        case when p.paid_at is null then 1 else 0 end,
        p.paid_at desc nulls last,
        p.created_at desc,
        p.id desc
    ) as row_no,
    first_value(p.id) over (
      partition by p.appointment_id
      order by
        case when p.visit_id is null then 1 else 0 end,
        case when p.paid_at is null then 1 else 0 end,
        p.paid_at desc nulls last,
        p.created_at desc,
        p.id desc
    ) as keeper_payment_id,
    first_value(p.visit_id) over (
      partition by p.appointment_id
      order by
        case when p.visit_id is null then 1 else 0 end,
        case when p.paid_at is null then 1 else 0 end,
        p.paid_at desc nulls last,
        p.created_at desc,
        p.id desc
    ) as keeper_visit_id
  from public.payments p
)
select payment_id, appointment_id, visit_id, keeper_payment_id, keeper_visit_id
from ranked
where row_no > 1;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'medical_records'
      and column_name = 'payment_id'
  ) then
    update public.medical_records mr
    set payment_id = c.keeper_payment_id
    from payment_dedupe_candidates c
    where mr.payment_id = c.payment_id
      and mr.payment_id is distinct from c.keeper_payment_id;
  end if;
end
$$;

delete from public.payments p
using payment_dedupe_candidates c
where p.id = c.payment_id;

delete from public.visit_menus vm
using payment_dedupe_candidates c
where vm.visit_id = c.visit_id
  and c.visit_id is not null
  and (c.keeper_visit_id is null or vm.visit_id <> c.keeper_visit_id);

delete from public.visits v
using payment_dedupe_candidates c
where v.id = c.visit_id
  and c.visit_id is not null
  and (c.keeper_visit_id is null or v.id <> c.keeper_visit_id);

commit;

-- Final check: this should return zero rows.
select
  appointment_id,
  count(*) as payment_count
from public.payments
group by appointment_id
having count(*) > 1
order by payment_count desc, appointment_id;
