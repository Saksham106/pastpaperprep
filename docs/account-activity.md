# Account activity

`public.account_activity_daily` has one row per signed-in account per UTC day:
- `page_views`: pages opened that day, capped at 2,000;
- `areas`: which parts of the site the account used (`home`, `bank`, `past_papers`, `notes`, `helper`, `worksheets`, `dashboard`, `pricing`, `account`, `articles`, `other`);
- `first_seen_at` / `last_seen_at`.

How it's written:
- The browser calls `record_account_activity(area)` once per page (`src/lib/account-activity.ts`), straight to Supabase, so no Vercel function runs.
- The account always comes from the session, and anything outside the fixed area list is stored as `other`.
- It covers **every** signed-in account, whatever the analytics-cookie choice, because it stays in our database and is never sent to an analytics provider. It's disclosed on `/privacy`.
- Rows are deleted with the account. Only the service role can read them.

It sits next to the activity tables we already had:
- `attempts`: questions marked;
- `saved_questions` and `saved_worksheets`;
- `download_usage_daily`: paid images viewed, PDF exports, explanations;
- `helper_usage_daily` / `helper_credit_charges`: Pepper.

PostHog's account view (`account:<id>`) still covers only accounts with current analytics consent (see `docs/analytics-events.md`).

## Questions it answers, and what to do with them

Run these with `supabase db query --linked -f <file>` from the main checkout, or in the Supabase SQL editor using a **new** tab, never the open saved query. `supabase/tests/account-activity.pglite.test.mjs` runs every query below against the real schema, so they stay valid.

### Do new accounts come back? (week-1 retention)
Act on it: if few come back, the first visit isn't landing. Work on the first-session path (sign-up → first question → first answer) before adding features.

```sql
with cohort as (
  select id as user_id, date_trunc('week', created_at)::date as signup_week, created_at::date as signup_day
  from auth.users
  where created_at > now() - interval '12 weeks'
)
select c.signup_week,
       count(*) as new_accounts,
       count(*) filter (where exists (
         select 1 from public.account_activity_daily a
         where a.user_id = c.user_id and a.activity_date between c.signup_day + 1 and c.signup_day + 7
       )) as came_back_within_7_days
from cohort c
group by c.signup_week
order by c.signup_week;
```

### How often do accounts visit? (active days in the last 30)
Act on it: separates one-off visitors from regular revisers. Compare plans: if paid members are mostly 1–2 day users, they're at risk at renewal.

```sql
select days_active, count(*) as accounts
from (
  select user_id, count(*) as days_active
  from public.account_activity_daily
  where activity_date > current_date - 30
  group by user_id
) per_account
group by days_active
order by days_active;
```

### Which paid members have gone quiet? (churn risk)
Act on it: members with an active plan but no visit in 14+ days. Check what they last used, and consider a short "here's what's new for your subject" email before renewal. Look up emails in `auth.users` by id only when you act on the list.

```sql
select e.user_id,
       string_agg(distinct e.product_id, ', ') as products,
       max(a.activity_date) as last_active,
       current_date - max(a.activity_date) as days_since
from public.entitlements e
left join public.account_activity_daily a on a.user_id = e.user_id
where e.status = 'active' and (e.expires_at is null or e.expires_at > now())
group by e.user_id
having max(a.activity_date) is null or max(a.activity_date) < current_date - 14
order by last_active nulls first;
```

### Which parts of the site do accounts actually use? (last 30 days)
Act on it: where to invest next (e.g. if few accounts open notes, notes need discovery before more notes get written).

```sql
select area, count(distinct user_id) as accounts, sum(page_views) as page_views_on_days_used
from public.account_activity_daily, unnest(areas) as area
where activity_date > current_date - 30
group by area
order by accounts desc;
```

### Daily and weekly active accounts
```sql
select activity_date, count(*) as active_accounts, sum(page_views) as page_views
from public.account_activity_daily
where activity_date > current_date - 30
group by activity_date
order by activity_date;
```
