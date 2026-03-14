begin;

create table if not exists public.job_locks (
  job_name text primary key,
  job_run_id uuid not null references public.job_runs(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.acquire_job_lock(
  lock_job_name text,
  lock_job_run_id uuid,
  lock_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
as $$
declare
  existing_lock public.job_locks%rowtype;
begin
  select *
    into existing_lock
  from public.job_locks
  where job_name = lock_job_name
  for update;

  if not found then
    insert into public.job_locks(job_name, job_run_id, expires_at)
    values (lock_job_name, lock_job_run_id, lock_expires_at);
    return true;
  end if;

  if existing_lock.expires_at <= now() then
    update public.job_locks
      set job_run_id = lock_job_run_id,
          expires_at = lock_expires_at,
          updated_at = now()
    where job_name = lock_job_name;
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.release_job_lock(lock_job_run_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  delete from public.job_locks
  where job_run_id = lock_job_run_id;
  return true;
end;
$$;

commit;
