-- =========================================================
-- Groomer App: service_menus category standardization
-- =========================================================
-- Target categories:
--   - トリミング
--   - お手入れ
--   - セット
--   - オプション
--
-- Legacy mapping:
--   - シャンプー -> お手入れ
--   - カット -> トリミング
--   - その他 -> オプション
--   - 通常 -> トリミング
--
-- How to rollback:
--   1) Run the UPDATE in the "Rollback SQL" section using the backup table.
--   2) Drop backup table if no longer needed.
-- =========================================================

begin;

create table if not exists public.service_menus_category_backup (
  menu_id uuid primary key,
  old_category text,
  backed_up_at timestamptz not null default now()
);

insert into public.service_menus_category_backup (menu_id, old_category)
select sm.id, sm.category
from public.service_menus sm
where sm.category is not null
  and not exists (
    select 1
    from public.service_menus_category_backup b
    where b.menu_id = sm.id
  );

update public.service_menus
set category = case btrim(coalesce(category, ''))
  when 'シャンプー' then 'お手入れ'
  when 'カット' then 'トリミング'
  when 'その他' then 'オプション'
  when '通常' then 'トリミング'
  else category
end,
updated_at = now()
where category is not null
  and btrim(category) in ('シャンプー', 'カット', 'その他', '通常');

commit;

-- Rollback SQL (execute manually if needed):
-- begin;
-- update public.service_menus sm
-- set category = b.old_category,
--     updated_at = now()
-- from public.service_menus_category_backup b
-- where b.menu_id = sm.id;
-- commit;
