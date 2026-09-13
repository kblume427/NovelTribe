create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  avatar_url text,
  created_at timestamp with time zone default now()
);

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
  created_at timestamp with time zone default now()
);

alter table books add column if not exists finished_at timestamp with time zone;
alter table books add column if not exists isbn text;
alter table books add column if not exists categories text[] default '{}';

create index if not exists books_user_id_idx on books(user_id);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

alter table profiles enable row level security;
alter table books enable row level security;

create policy "Users can view their own profile"
on profiles for select
using (auth.uid() = id);

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
