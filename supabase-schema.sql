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
  created_at timestamp with time zone default now()
);

create index if not exists books_user_id_idx on books(user_id);

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
