-- ============================================================
-- FleetSync SaaS — Supabase Schema
-- Run this in your Supabase project: SQL Editor > New Query
-- ============================================================

-- Companies (one per tenant)
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- User profiles (linked to Supabase auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role text default 'super_admin',
  company_id uuid references companies(id) on delete set null,
  created_at timestamptz default now()
);

-- Vehicles
create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  plate_number text not null,
  model text,
  year int,
  fuel_type text default 'petrol',
  status text default 'active',
  insurance_expiry date,
  created_at timestamptz default now()
);

-- Drivers
create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  full_name text not null,
  phone text,
  license_number text,
  license_expiry date,
  status text default 'active',
  photo_url text,
  id_photo_url text,
  created_at timestamptz default now()
);

-- Trips
create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete set null,
  driver_id uuid references drivers(id) on delete set null,
  start_location text,
  destination text,
  start_time timestamptz,
  end_time timestamptz,
  distance numeric default 0,
  fuel_used numeric default 0,
  status text default 'pending',
  start_lat numeric,
  start_lng numeric,
  end_lat numeric,
  end_lng numeric,
  created_at timestamptz default now()
);

-- Fuel logs
create table if not exists fuel_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete set null,
  driver_id uuid references drivers(id) on delete set null,
  liters numeric default 0,
  cost numeric default 0,
  mileage numeric default 0,
  fuel_station text,
  date date default current_date,
  created_at timestamptz default now()
);

-- Maintenance records
create table if not exists maintenance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete set null,
  service_type text,
  cost numeric default 0,
  notes text,
  service_date date,
  next_service_date date,
  created_at timestamptz default now()
);

-- Tires
create table if not exists tires (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete set null,
  brand text,
  size text,
  position text,
  status text default 'active',
  purchase_date date,
  purchase_cost numeric default 0,
  mileage_at_install numeric default 0,
  current_mileage numeric default 0,
  expected_lifespan numeric default 50000,
  notes text,
  created_at timestamptz default now()
);

-- Alerts
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  type text,
  message text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS)
-- Each company only sees its own data
-- ============================================================

alter table companies enable row level security;
alter table profiles enable row level security;
alter table vehicles enable row level security;
alter table drivers enable row level security;
alter table trips enable row level security;
alter table fuel_logs enable row level security;
alter table maintenance_records enable row level security;
alter table tires enable row level security;
alter table alerts enable row level security;

-- Helper: get the company_id for the currently logged-in user
create or replace function get_my_company_id()
returns uuid language sql stable
as $$
  select company_id from profiles where id = auth.uid()
$$;

-- Profiles: user can read/update only their own row
create policy "profiles_select" on profiles for select using (id = auth.uid());
create policy "profiles_insert" on profiles for insert with check (id = auth.uid());
create policy "profiles_update" on profiles for update using (id = auth.uid());

-- Companies: user can read their own company
create policy "companies_select" on companies for select using (id = get_my_company_id());
create policy "companies_insert" on companies for insert with check (true);
create policy "companies_update" on companies for update using (id = get_my_company_id());

-- All other tables: scoped to company_id
create policy "vehicles_all" on vehicles for all using (company_id = get_my_company_id());
create policy "drivers_all" on drivers for all using (company_id = get_my_company_id());
create policy "trips_all" on trips for all using (company_id = get_my_company_id());
create policy "fuel_logs_all" on fuel_logs for all using (company_id = get_my_company_id());
create policy "maintenance_all" on maintenance_records for all using (company_id = get_my_company_id());
create policy "tires_all" on tires for all using (company_id = get_my_company_id());
create policy "alerts_all" on alerts for all using (company_id = get_my_company_id());

-- ============================================================
-- Storage bucket for driver photos
-- ============================================================
-- Run this in Supabase Dashboard > Storage > New Bucket:
-- Name: driver-photos
-- Public: true
-- ============================================================
