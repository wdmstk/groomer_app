begin;

-- Re-issue policy: at most one non-revoked member portal link per customer.
with ranked as (
  select
    id,
    row_number() over (
      partition by store_id, customer_id, purpose
      order by created_at desc, id desc
    ) as rn
  from public.member_portal_links
  where revoked_at is null
    and purpose = 'member_portal'
)
update public.member_portal_links links
set
  revoked_at = now(),
  updated_at = now()
from ranked
where links.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists member_portal_links_one_active_per_customer
  on public.member_portal_links (store_id, customer_id, purpose)
  where revoked_at is null;

commit;
