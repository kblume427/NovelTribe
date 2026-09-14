create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  avatar_url text,
  preferred_categories text[] default '{}',
  is_public boolean default false,
  public_library boolean default false,
  public_ratings boolean default false,
  public_reviews boolean default false,
  public_activity boolean default false,
  created_at timestamp with time zone default now()
);

alter table profiles add column if not exists preferred_categories text[] default '{}';
alter table profiles add column if not exists is_public boolean default false;
alter table profiles add column if not exists public_library boolean default false;
alter table profiles add column if not exists public_ratings boolean default false;
alter table profiles add column if not exists public_reviews boolean default false;
alter table profiles add column if not exists public_activity boolean default false;

create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text not null,
  genre text not null,
  status text not null check (status in ('Read', 'Currently Reading', 'Want to Read')),
  rating integer not null default 0 check (rating >= 0 and rating <= 5),
  finished_at timestamp with time zone,
  isbn text,
  categories text[] default '{}',
  review text check (review is null or char_length(review) <= 1000),
  cover_url text,
  created_at timestamp with time zone default now()
);

create table if not exists cover_approvals (

  create table if not exists recommendation_dismissals (
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    created_at timestamp with time zone default now(),
    primary key (user_id, title)
  );
  isbn text primary key,
  cover_url text not null,
  approved_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now()
);

alter table books add column if not exists finished_at timestamp with time zone;
alter table books add column if not exists isbn text;
alter table books add column if not exists categories text[] default '{}';
alter table books add column if not exists review text;
alter table books add column if not exists cover_url text;

create table if not exists reading_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  title text not null,
  author text not null,
  cover_url text,
  event_type text not null check (event_type in ('started', 'finished', 'rated')),
  rating integer check (rating is null or (rating >= 1 and rating <= 5)),
  created_at timestamp with time zone default now()
);

create table if not exists follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_username text,
  type text not null check (type in ('follow')),
  message text not null,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create index if not exists follows_following_id_idx on follows(following_id);

create index if not exists reading_activity_user_id_idx on reading_activity(user_id, created_at desc);
alter table reading_activity add column if not exists cover_url text;

create index if not exists books_user_id_idx on books(user_id);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

alter table profiles enable row level security;
alter table books enable row level security;
alter table reading_activity enable row level security;
alter table cover_approvals enable row level security;
alter table recommendation_dismissals enable row level security;
alter table follows enable row level security;
alter table notifications enable row level security;

create policy "Users can view their own profile"
on profiles for select
using (auth.uid() = id);

create policy "Anyone can view public profiles"
on profiles for select
using (is_public = true);

create policy "Users can update their own profile"
on profiles for update
using (auth.uid() = id);

create policy "Users can insert their own profile"
on profiles for insert
with check (auth.uid() = id);

create policy "Users can view their own books"
on books for select
using (auth.uid() = user_id);

create policy "Users can insert their own books"
on books for insert
with check (auth.uid() = user_id);

create policy "Users can update their own books"
on books for update
using (auth.uid() = user_id);

create policy "Users can delete their own books"
on books for delete
using (auth.uid() = user_id);

drop policy if exists "Anyone can view public library books" on books;
create policy "Anyone can view public library books"
on books for select
using (exists (select 1 from profiles where profiles.id = books.user_id and profiles.is_public = true and profiles.public_library = true));

drop policy if exists "Users can view their own reading activity" on reading_activity;
drop policy if exists "Users can insert their own reading activity" on reading_activity;

create policy "Users can view their own reading activity"
on reading_activity for select
using (auth.uid() = user_id);

create policy "Users can insert their own reading activity"
on reading_activity for insert
with check (auth.uid() = user_id);

drop policy if exists "Followers can view shared reading activity" on reading_activity;
create policy "Followers can view shared reading activity"
on reading_activity for select
using (
  exists (
    select 1 from follows
    join profiles on profiles.id = reading_activity.user_id
    where follows.follower_id = auth.uid()
      and follows.following_id = reading_activity.user_id
      and profiles.is_public = true
      and profiles.public_activity = true
  )
);

drop policy if exists "Users can view their own follows" on follows;
drop policy if exists "Users can create their own follows" on follows;
drop policy if exists "Users can delete their own follows" on follows;

create policy "Users can view their own follows"
on follows for select
using (auth.uid() = follower_id or auth.uid() = following_id);

create policy "Users can create their own follows"
on follows for insert
with check (auth.uid() = follower_id);

create policy "Users can delete their own follows"
on follows for delete
using (auth.uid() = follower_id);

drop policy if exists "Authenticated users can view cover approvals" on cover_approvals;
drop policy if exists "Authenticated users can create cover approvals" on cover_approvals;

create policy "Authenticated users can view cover approvals"
on cover_approvals for select
to authenticated
using (true);

create policy "Authenticated users can create cover approvals"
on cover_approvals for insert
to authenticated
with check (auth.uid() = approved_by);

drop policy if exists "Users can view their own recommendation dismissals" on recommendation_dismissals;
drop policy if exists "Users can create their own recommendation dismissals" on recommendation_dismissals;

create policy "Users can view their own recommendation dismissals"
on recommendation_dismissals for select
using (auth.uid() = user_id);

create policy "Users can create their own recommendation dismissals"
on recommendation_dismissals for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can view their own notifications" on notifications;
drop policy if exists "Actors can create notifications" on notifications;
drop policy if exists "Users can update their own notifications" on notifications;

create policy "Users can view their own notifications"
on notifications for select
using (auth.uid() = recipient_id);

create policy "Actors can create notifications"
on notifications for insert
with check (auth.uid() = actor_id);

create policy "Users can update their own notifications"
on notifications for update
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);

drop policy if exists "Users can view their own avatars" on storage.objects;
drop policy if exists "Users can upload their own avatars" on storage.objects;
drop policy if exists "Users can update their own avatars" on storage.objects;
drop policy if exists "Users can delete their own avatars" on storage.objects;

create policy "Users can view their own avatars"
on storage.objects for select
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "Users can upload their own avatars"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "Users can update their own avatars"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "Users can delete their own avatars"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
