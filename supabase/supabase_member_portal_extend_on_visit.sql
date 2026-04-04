create or replace function public.extend_member_portal_link_on_visit()
returns trigger
language plpgsql
as $$
declare
  ttl_days integer := 90;
  visit_anchor timestamptz;
begin
  select coalesce(s.member_portal_ttl_days, 90)
    into ttl_days
  from public.stores s
  where s.id = new.store_id;

  if ttl_days not in (30, 90, 180) then
    ttl_days := 90;
  end if;

  visit_anchor := coalesce(new.visit_date, new.created_at, now());

  update public.member_portal_links links
  set
    expires_at = greatest(links.expires_at, visit_anchor + make_interval(days => ttl_days)),
    updated_at = now()
  where links.store_id = new.store_id
    and links.customer_id = new.customer_id
    and links.purpose = 'member_portal'
    and links.revoked_at is null;

  return new;
end;
$$;

drop trigger if exists trg_extend_member_portal_link_on_visit
  on public.visits;

create trigger trg_extend_member_portal_link_on_visit
after insert or update of visit_date, customer_id, store_id
on public.visits
for each row
execute function public.extend_member_portal_link_on_visit();
