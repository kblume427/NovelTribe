-- Release alerts: run once in the Supabase SQL editor.

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check check (type in ('follow', 'release'));
alter table notifications add column if not exists metadata jsonb;

alter table profiles add column if not exists last_active_at timestamp with time zone;
alter table profiles add column if not exists release_checked_at timestamp with time zone;

create table if not exists release_alerts (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_key text not null,
  title text not null,
  author text not null,
  source text not null check (source in ('series', 'author')),
  detail text not null,
  published_date text,
  isbn text,
  cover_url text,
  emailed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  primary key (user_id, book_key)
);

create index if not exists release_alerts_digest_idx on release_alerts(user_id, created_at desc) where emailed_at is null;

alter table release_alerts enable row level security;

-- Rows are written only by the service-role cron job; users may read their own.
drop policy if exists "Users can view their own release alerts" on release_alerts;
create policy "Users can view their own release alerts"
on release_alerts for select
using (auth.uid() = user_id);
