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
  created_at timestamp with time zone default now()
);

alter table profiles add column if not exists preferred_categories text[] default '{}';
alter table profiles add column if not exists is_public boolean default false;
alter table profiles add column if not exists public_library boolean default false;
alter table profiles add column if not exists public_ratings boolean default false;
alter table profiles add column if not exists public_reviews boolean default false;

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
  created_at timestamp with time zone default now()
);

alter table books add column if not exists finished_at timestamp with time zone;
alter table books add column if not exists isbn text;
alter table books add column if not exists categories text[] default '{}';
alter table books add column if not exists review text;

create table if not exists reading_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  title text not null,
  author text not null,
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

create index if not exists follows_following_id_idx on follows(following_id);

create index if not exists reading_activity_user_id_idx on reading_activity(user_id, created_at desc);

create index if not exists books_user_id_idx on books(user_id);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

alter table profiles enable row level security;
alter table books enable row level security;
alter table reading_activity enable row level security;
alter table follows enable row level security;

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

drop policy if exists "Users can view their own follows" on follows;
drop policy if exists "Users can create their own follows" on follows;
drop policy if exists "Users can delete their own follows" on follows;

create policy "Users can view their own follows"
on follows for select
using (auth.uid() = follower_id);

create policy "Users can create their own follows"
on follows for insert
with check (auth.uid() = follower_id);

create policy "Users can delete their own follows"
on follows for delete
using (auth.uid() = follower_id);

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
