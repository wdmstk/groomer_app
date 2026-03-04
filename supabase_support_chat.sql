create table if not exists public.support_chat_messages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  sender_user_id uuid not null,
  sender_role text not null check (sender_role in ('developer', 'owner', 'staff')),
  message text not null check (char_length(trim(message)) > 0 and char_length(message) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists idx_support_chat_messages_store_created_at
  on public.support_chat_messages (store_id, created_at);

alter table public.support_chat_messages enable row level security;

alter table public.support_chat_messages
  drop constraint if exists support_chat_messages_sender_role_check;

alter table public.support_chat_messages
  add constraint support_chat_messages_sender_role_check
  check (sender_role in ('developer', 'owner', 'staff'));

create table if not exists public.store_chat_participants (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null,
  can_participate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create index if not exists idx_store_chat_participants_store_user
  on public.store_chat_participants (store_id, user_id);

alter table public.store_chat_participants enable row level security;
