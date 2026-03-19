begin;

alter table if exists public.stores
  add column if not exists member_card_rank_visible boolean not null default true;

comment on column public.stores.member_card_rank_visible is
  '会員証にLTVランクを表示するかどうかの店舗設定。';

commit;
