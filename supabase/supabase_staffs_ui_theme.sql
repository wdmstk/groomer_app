alter table public.staffs
  add column if not exists ui_theme text not null default 'clean-medical';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'staffs_ui_theme_check'
  ) then
    alter table public.staffs
      add constraint staffs_ui_theme_check
      check (
        ui_theme in (
          'cute-pop',
          'kawaii-minimal',
          'black-luxe',
          'dark-neon',
          'natural-organic',
          'clean-medical',
          'luxury-salon',
          'playful-pet'
        )
      );
  end if;
end $$;
