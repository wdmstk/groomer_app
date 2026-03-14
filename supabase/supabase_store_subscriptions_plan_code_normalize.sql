-- store_subscriptions.plan_code を light / standard / pro の3値へ正規化する
-- 実行前にバックアップを推奨

update public.store_subscriptions
set plan_code = case
  when lower(coalesce(plan_code, '')) in ('pro', 'professional', 'premium') then 'pro'
  when lower(coalesce(plan_code, '')) in ('standard', 'std', 'basic') then 'standard'
  else 'light'
end
where true;

-- 確認用
select plan_code, count(*) as count
from public.store_subscriptions
group by plan_code
order by plan_code;
