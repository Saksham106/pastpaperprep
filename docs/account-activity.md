# Account activity

`public.account_activity_daily` holds best-effort observations of signed-in use: one row per account per **UTC** day.
- `page_views`: pages opened that day, capped at 2,000.
- `areas`: which parts of the site were used (`home`, `bank`, `past_papers`, `notes`, `helper`, `worksheets`, `dashboard`, `pricing`, `account`, `articles`, `other`).
- `first_seen_at` / `last_seen_at`.

How it's written:
- The browser calls `record_account_activity(area)` once per page, at idle time, straight to Supabase (`src/lib/account-activity.ts`, no Vercel function).
- The account comes from the session. A queued page is dropped if a different account is signed in by the time it would be sent.
- These are pathname observations, so blocked scripts, closed tabs and offline visits are missed.

**Purpose and limits.** These limits match `/privacy`. Change the policy first if any of them change.
- **Used in aggregate to improve the product:** retention, how often accounts study, which areas get used. Not for decisions about, or outreach to, individual accounts. The queries below return counts, not lists of people.
- **Every signed-in account is covered**, whatever its analytics-cookie choice. Nothing here is sent to an analytics provider. PostHog's account view (`account:<id>`) still needs current consent; see `docs/analytics-events.md`.
- **Retention:** 13 months. Each write deletes a batch of older rows, and rows go with the account (`on delete cascade`).
- **Objection:** someone who asks us to stop (hello@pastpaperprep.com) is added to `public.account_activity_opt_outs`. The function then never records them. Also delete their rows:
  `insert into public.account_activity_opt_outs (user_id) values ('<uuid>') on conflict do nothing; delete from public.account_activity_daily where user_id = '<uuid>';`
- **Reads:** service role only (`grant select, delete`). Students can't read or write either table.

Related tables we already had:
- `attempts`: questions marked;
- `saved_questions` and `saved_worksheets`;
- `download_usage_daily`: paid images viewed, PDF exports, explanations;
- `helper_usage_daily` / `helper_credit_charges`: Pepper.

## Questions it answers, and what to do with them

Run these with `supabase db query --linked -f <file>` from the main checkout, or in the Supabase SQL editor using a **new** tab, never the open saved query. All dates are UTC. Data starts on the day the recording code shipped. `supabase/tests/account-activity.pglite.test.mjs` runs every query below against the schema.

### Do new accounts come back within a week?
Only cohorts with a complete 7-day window, and only since recording started. If few come back, improve the first session (sign-up → first question → first answer) before adding features.

```sql
with bounds as (
  select (now() at time zone 'utc')::date as today,
         (select min(activity_date) from public.account_activity_daily) as tracking_start
), cohort as (
  select u.id as user_id, (u.created_at at time zone 'utc')::date as signup_day
  from auth.users u, bounds b
  where (u.created_at at time zone 'utc')::date >= b.tracking_start
    and (u.created_at at time zone 'utc')::date <= b.today - 8
)
select date_trunc('week', signup_day)::date as signup_week,
       count(*) as new_accounts,
       count(*) filter (where exists (
         select 1 from public.account_activity_daily a
         where a.user_id = cohort.user_id and a.activity_date between cohort.signup_day + 1 and cohort.signup_day + 7
       )) as came_back_within_7_days
from cohort
group by 1
order by 1;
```

### How many days a month do accounts study?
Separates one-off visitors from regular revisers.

```sql
select days_active, count(*) as accounts
from (
  select user_id, count(*) as days_active
  from public.account_activity_daily
  where activity_date > (now() at time zone 'utc')::date - 30
  group by user_id
) per_account
group by days_active
order by days_active;
```

### Are paying subscribers using what they pay for?
Counts of renewing Stripe subscriptions, not people. Manual and complimentary grants are excluded, and so are subscriptions under 14 days old. A rising "quiet" share means the product isn't sticking for payers: look at what active payers use, then improve that path. This query doesn't produce a contact list.

```sql
with subs as (
  select e.user_id, e.product_id
  from public.entitlements e
  where e.source = 'stripe'
    and e.status = 'active'
    and e.expires_at is not null and e.expires_at > now()
    and e.starts_at <= now() - interval '14 days'
), last_seen as (
  select user_id, max(activity_date) as last_active from public.account_activity_daily group by user_id
)
select s.product_id,
       count(distinct s.user_id) as subscribers,
       count(distinct s.user_id) filter (where l.last_active is null or l.last_active <= (now() at time zone 'utc')::date - 14) as quiet_14_days_or_more
from subs s left join last_seen l on l.user_id = s.user_id
group by s.product_id
order by subscribers desc;
```

### Which parts of the site do accounts use?
The unit is account-days: a day counts once for each area used that day. Use it to decide where to invest. For example, if few accounts open notes, notes need to be easier to find before more notes get written.

```sql
select area,
       count(distinct user_id) as accounts,
       count(*) as account_days
from public.account_activity_daily, unnest(areas) as area
where activity_date > (now() at time zone 'utc')::date - 30
group by area
order by accounts desc;
```

### Daily active accounts
```sql
select activity_date, count(*) as active_accounts, sum(page_views) as page_views
from public.account_activity_daily
where activity_date > (now() at time zone 'utc')::date - 30
group by activity_date
order by activity_date;
```
