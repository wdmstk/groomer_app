begin;

alter table public.audit_logs
  add column if not exists actor_scope text not null default 'store';

alter table public.audit_logs
  drop constraint if exists audit_logs_actor_scope_check;

alter table public.audit_logs
  add constraint audit_logs_actor_scope_check
  check (actor_scope in ('store', 'hq'));

commit;
