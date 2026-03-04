-- Resolve existing duplicate visits before applying the unique guard.
-- Keep one visit per appointment, preferring:
-- 1) rows already linked from payments
-- 2) newer visit_date
-- 3) newer created_at
select
  appointment_id,
  count(*) as visit_count,
  array_agg(
    id
    order by
      case when linked_payment_id is null then 1 else 0 end,
      visit_date desc nulls last,
      created_at desc,
      id desc
  ) as visit_ids
from (
  select
    v.id,
    v.appointment_id,
    v.visit_date,
    v.created_at,
    (
      select p.id
      from public.payments p
      where p.visit_id = v.id
      order by p.created_at desc
      limit 1
    ) as linked_payment_id
  from public.visits v
  where v.appointment_id is not null
) ranked_source
group by appointment_id
having count(*) > 1
order by visit_count desc, appointment_id;

begin;

create temporary table visit_dedupe_candidates on commit drop as
with ranked as (
  select
    v.id as visit_id,
    v.appointment_id,
    row_number() over (
      partition by v.appointment_id
      order by
        case when p.id is null then 1 else 0 end,
        v.visit_date desc nulls last,
        v.created_at desc,
        v.id desc
    ) as row_no,
    first_value(v.id) over (
      partition by v.appointment_id
      order by
        case when p.id is null then 1 else 0 end,
        v.visit_date desc nulls last,
        v.created_at desc,
        v.id desc
    ) as keeper_visit_id
  from public.visits v
  left join public.payments p on p.visit_id = v.id
  where v.appointment_id is not null
)
select visit_id, appointment_id, keeper_visit_id
from ranked
where row_no > 1;

update public.payments p
set visit_id = c.keeper_visit_id
from visit_dedupe_candidates c
where p.visit_id = c.visit_id
  and p.visit_id is distinct from c.keeper_visit_id;

delete from public.visit_menus vm
using visit_dedupe_candidates c
where vm.visit_id = c.visit_id
  and exists (
    select 1
    from public.visit_menus keeper
    where keeper.visit_id = c.keeper_visit_id
      and keeper.menu_id = vm.menu_id
      and keeper.menu_name = vm.menu_name
      and keeper.price = vm.price
      and keeper.duration = vm.duration
      and coalesce(keeper.tax_rate, 0.1) = coalesce(vm.tax_rate, 0.1)
      and coalesce(keeper.tax_included, true) = coalesce(vm.tax_included, true)
  );

update public.visit_menus vm
set visit_id = c.keeper_visit_id
from visit_dedupe_candidates c
where vm.visit_id = c.visit_id
  and vm.visit_id is distinct from c.keeper_visit_id;

delete from public.visits v
using visit_dedupe_candidates c
where v.id = c.visit_id;

commit;

-- Final check: this should return zero rows.
select
  appointment_id,
  count(*) as visit_count
from public.visits
where appointment_id is not null
group by appointment_id
having count(*) > 1
order by visit_count desc, appointment_id;
