create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text unique,
  address text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  batch_name text,
  cart_url text not null,
  original_sar numeric(12, 2) not null check (original_sar > 0),
  shipping_sar numeric(12, 2) not null default 0,
  commission_sar numeric(12, 2) not null default 0,
  final_syp numeric(18, 2) not null default 0,
  paid_syp numeric(18, 2) not null default 0,
  status text not null default 'بانتظار العربون',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  amount_syp numeric(18, 2) not null check (amount_syp > 0),
  receipt_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists "Customers can read their profile" on public.profiles;
drop policy if exists "Customers can update their profile" on public.profiles;
drop policy if exists "Customers can read their orders" on public.orders;
drop policy if exists "Customers can create their orders" on public.orders;
drop policy if exists "Customers can read their payments" on public.payments;
drop policy if exists "Customers can create their payments" on public.payments;
drop policy if exists "Anyone can read storefront settings" on public.store_settings;
drop policy if exists "Admin can read all profiles" on public.profiles;
drop policy if exists "Admin can read all orders" on public.orders;
drop policy if exists "Admin can update all orders" on public.orders;
drop policy if exists "Admin can delete all orders" on public.orders;

create policy "Customers can read their profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Customers can update their profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admin can read all profiles"
  on public.profiles for select
  using (lower(coalesce(auth.jwt()->>'email', '')) = 'ameertrad82@gmail.com');

create policy "Customers can read their orders"
  on public.orders for select
  using (auth.uid() = customer_id);

create policy "Customers can create their orders"
  on public.orders for insert
  with check (auth.uid() = customer_id);

create policy "Admin can read all orders"
  on public.orders for select
  using (lower(coalesce(auth.jwt()->>'email', '')) = 'ameertrad82@gmail.com');

create policy "Admin can update all orders"
  on public.orders for update
  using (lower(coalesce(auth.jwt()->>'email', '')) = 'ameertrad82@gmail.com')
  with check (lower(coalesce(auth.jwt()->>'email', '')) = 'ameertrad82@gmail.com');

create policy "Admin can delete all orders"
  on public.orders for delete
  using (lower(coalesce(auth.jwt()->>'email', '')) = 'ameertrad82@gmail.com');

create policy "Customers can read their payments"
  on public.payments for select
  using (auth.uid() = customer_id);

create policy "Customers can create their payments"
  on public.payments for insert
  with check (auth.uid() = customer_id);

create policy "Anyone can read storefront settings"
  on public.store_settings for select
  using (true);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, address)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'address'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
