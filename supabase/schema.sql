-- Royal Optical Dashboard — database schema
--
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste this whole file → Run).
--
-- This creates the 7 tables the dashboard app queries (lib/supabase/mappers.ts
-- and context/AppContext.tsx are the source of truth for the exact shape).
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / OR REPLACE).

-- ── patients ──────────────────────────────────────────────────────────────
create sequence if not exists patients_display_id_seq start with 1001;

create table if not exists public.patients (
  id                  uuid primary key default gen_random_uuid(),
  display_id          text unique,
  name                text not null,
  age                 integer not null,
  gender              text not null,
  phone               text not null,
  email               text,
  address             text not null,
  created_date        timestamptz not null default now(),
  last_visit_date     timestamptz,
  outstanding_amount  numeric not null default 0,
  notes               text
);

-- Added for GST/Tax — place-of-supply comparison (business state vs
-- customer state) needs a real customer state; nothing in the schema had
-- one before. Nullable — blank until GST is enabled and staff start
-- entering it.
alter table public.patients add column if not exists state text;

create or replace function public.set_patient_display_id()
returns trigger language plpgsql as $$
begin
  if new.display_id is null then
    new.display_id := 'PAT-' || nextval('patients_display_id_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_patients_display_id on public.patients;
create trigger trg_patients_display_id
  before insert on public.patients
  for each row execute function public.set_patient_display_id();

-- ── visits ────────────────────────────────────────────────────────────────
create sequence if not exists visits_display_id_seq start with 5001;

create table if not exists public.visits (
  id               uuid primary key default gen_random_uuid(),
  display_id       text unique,
  patient_id       uuid not null references public.patients(id) on delete cascade,
  date             timestamptz not null default now(),
  chief_complaint  text,
  symptoms         text,
  diagnosis        text,
  vision_test      jsonb not null default '{}'::jsonb,
  medicines        jsonb not null default '[]'::jsonb,
  contact_lens     jsonb,
  frame            jsonb,
  reading_glass    jsonb,
  lens             jsonb,
  solution         jsonb,
  doctor_notes     text,
  payment          jsonb not null default '{}'::jsonb,
  status           text not null default 'In Progress'
);

-- Added for existing installs — CREATE TABLE IF NOT EXISTS above won't add
-- columns to a visits table that already exists without them.
alter table public.visits add column if not exists reading_glass jsonb;
alter table public.visits add column if not exists solution jsonb;

create or replace function public.set_visit_display_id()
returns trigger language plpgsql as $$
begin
  if new.display_id is null then
    new.display_id := 'VIS-' || nextval('visits_display_id_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_visits_display_id on public.visits;
create trigger trg_visits_display_id
  before insert on public.visits
  for each row execute function public.set_visit_display_id();

create index if not exists idx_visits_patient_id on public.visits(patient_id);

-- ── prescriptions ─────────────────────────────────────────────────────────
create sequence if not exists prescriptions_display_id_seq start with 8001;

create table if not exists public.prescriptions (
  id             uuid primary key default gen_random_uuid(),
  display_id     text unique,
  visit_id       uuid references public.visits(id) on delete cascade,
  patient_id     uuid not null references public.patients(id) on delete cascade,
  date           timestamptz not null default now(),
  vision_test    jsonb not null default '{}'::jsonb,
  diagnosis      text,
  medicines      jsonb not null default '[]'::jsonb,
  contact_lens   jsonb,
  frame          jsonb,
  reading_glass  jsonb,
  lens           jsonb,
  solution       jsonb,
  doctor_notes   text,
  payment        jsonb not null default '{}'::jsonb,
  printed_count  integer not null default 0,
  last_printed_at timestamptz
);

-- Added for existing installs — CREATE TABLE IF NOT EXISTS above won't add
-- columns to a prescriptions table that already exists without them.
alter table public.prescriptions add column if not exists reading_glass jsonb;
alter table public.prescriptions add column if not exists solution jsonb;

create or replace function public.set_prescription_display_id()
returns trigger language plpgsql as $$
begin
  if new.display_id is null then
    new.display_id := 'RX-' || nextval('prescriptions_display_id_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prescriptions_display_id on public.prescriptions;
create trigger trg_prescriptions_display_id
  before insert on public.prescriptions
  for each row execute function public.set_prescription_display_id();

-- ── invoice numbers ──────────────────────────────────────────────────────
-- Sequential, per-year invoice numbers (INV-2026-000123), generated
-- atomically by the database. Replaces client-side Math.random() numbers
-- that were generated independently by the Visit-creation flow and the
-- standalone Prescription flow — both now call this same function, so
-- numbers can never collide between the two. Existing invoiceNumber values
-- already stored in visits/prescriptions payment jsonb are untouched; this
-- only affects numbers generated after this migration runs.
create table if not exists public.invoice_number_counters (
  year         integer primary key,
  last_number  integer not null default 0
);

-- security definer: callers only get EXECUTE on the function below, never
-- direct table access — keeps the counter safe from being read/written
-- around the atomic increment.
revoke all on public.invoice_number_counters from public, anon, authenticated;

create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  yr integer := extract(year from now())::int;
  n  integer;
  prefix text;
begin
  -- Configurable via Settings > Invoice & Print (falls back to 'INV' if
  -- blank/unset) — only affects numbers generated from now on; every
  -- already-issued invoice number stored in past records is untouched.
  select coalesce(nullif(invoice_prefix, ''), 'INV') into prefix
  from public.clinic_settings where id = 1;
  prefix := coalesce(prefix, 'INV');

  insert into public.invoice_number_counters (year, last_number)
  values (yr, 1)
  on conflict (year) do update set last_number = invoice_number_counters.last_number + 1
  returning last_number into n;

  return prefix || '-' || yr || '-' || lpad(n::text, 6, '0');
end;
$$;

grant execute on function public.next_invoice_number() to anon, authenticated;

create index if not exists idx_prescriptions_patient_id on public.prescriptions(patient_id);
create index if not exists idx_prescriptions_visit_id on public.prescriptions(visit_id);

-- ── medicines ─────────────────────────────────────────────────────────────
create table if not exists public.medicines (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  brand             text,
  category          text,
  batch_number      text,
  expiry_date       text,
  purchase_price    numeric not null default 0,
  selling_price     numeric not null default 0,
  supplier          text,
  available_stock   integer not null default 0,
  minimum_stock     integer not null default 0,
  barcode           text,
  rack_number       text
);

-- Added for GST/Tax — medicines is the one real catalog table in this app
-- (Frames/Lenses/etc. are typed free-form per visit, no catalog to attach a
-- rate to), so it gets genuine per-item HSN/rate. tax_rate null means "use
-- the Medicines category default from tax_rate_config" — not "zero tax".
alter table public.medicines add column if not exists hsn_sac text;
alter table public.medicines add column if not exists tax_rate numeric;

-- Added for Expense↔Inventory connection — Frame/Lens/Contact Lens now use
-- this same table (category values 'Frame'/'Lens'/'Contact Lens' alongside
-- the existing ones) instead of a separate table, reusing the stock/
-- low-stock/movement logic already built and tested here. One generic
-- nullable descriptor reused per category (Frame Type / Lens Spec / Power)
-- rather than adding a narrow column per category.
alter table public.medicines add column if not exists specification text;

-- ── expenses ──────────────────────────────────────────────────────────────
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  category     text not null,
  description  text,
  amount       numeric not null default 0,
  date         timestamptz not null default now()
);

-- Added for ESR (Expense Report) — the table already existed (used by
-- Reports > Overview for gross-expense totals) but had no display ID,
-- vendor/payment/reference/notes fields, or timestamps.
create sequence if not exists expenses_display_id_seq start with 1001;

alter table public.expenses add column if not exists display_id text unique;
alter table public.expenses add column if not exists vendor text;
alter table public.expenses add column if not exists payment_method text;
alter table public.expenses add column if not exists reference_number text;
alter table public.expenses add column if not exists notes text;
alter table public.expenses add column if not exists created_at timestamptz not null default now();
alter table public.expenses add column if not exists updated_at timestamptz not null default now();

-- Added for supplier payment tracking — how much was actually paid at the
-- time this expense/purchase was recorded. Left null for every expense
-- created before this column existed (and for the plain "+ Add Expense"
-- flow, which never sets it) — the app treats a null paid_amount as "fully
-- paid" (paid_amount == amount), so nothing already-recorded silently
-- becomes "outstanding". Only Add Stock purchases can set this below the
-- full amount to record a partial or on-credit purchase.
alter table public.expenses add column if not exists paid_amount numeric;

-- Structured snapshot of what was actually entered in Add Stock (brand,
-- product name, code, category-specific spec, quantity) — captured once at
-- purchase time so the Expense Management table can show real Brand/Code/
-- Specification columns instead of parsing the free-text description back
-- apart. Null for the plain "+ Add Expense" flow and for every row recorded
-- before this column existed; those keep showing the generic table.
alter table public.expenses add column if not exists product_details jsonb;

create or replace function public.set_expense_display_id()
returns trigger language plpgsql as $$
begin
  if new.display_id is null then
    new.display_id := 'EXP-' || nextval('expenses_display_id_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_expenses_display_id on public.expenses;
create trigger trg_expenses_display_id
  before insert on public.expenses
  for each row execute function public.set_expense_display_id();

create index if not exists idx_expenses_date on public.expenses(date);

-- ── activity_log ──────────────────────────────────────────────────────────
-- patient_id isn't in the app's ActivityLog type/mapper, but AppContext's
-- deletePatient() does `delete from activity_log where patient_id = ...` to
-- clean up a deleted patient's history — this column makes that call work.
create table if not exists public.activity_log (
  id            uuid primary key default gen_random_uuid(),
  timestamp     timestamptz not null default now(),
  type          text not null,
  title         text not null,
  description   text,
  patient_name  text,
  amount        numeric,
  patient_id    uuid references public.patients(id) on delete cascade
);

create index if not exists idx_activity_log_patient_id on public.activity_log(patient_id);

-- ── clinic_settings ───────────────────────────────────────────────────────
-- Single-row table — the app always reads/writes id = 1.
create table if not exists public.clinic_settings (
  id                        integer primary key,
  clinic_name               text not null default 'Royal Opticals',
  business_types            jsonb not null default '["Optical Shop","Eye Clinic","Computerized Eye Testing","Contact Lens Center","Spectacle Sales"]'::jsonb,
  address                   text not null default '',
  phone                     text not null default '',
  email                     text not null default '',
  doctor_name               text not null default '',
  doctor_title              text not null default '',
  credentials               text,
  registration_number       text not null default '',
  default_consultation_fee  numeric not null default 200,
  default_printer           text not null default '',
  currency_symbol           text not null default '₹',
  currency                  text default 'INR (₹)',
  language                  text default 'English',
  logo_url                  text,
  enable_auto_save          boolean not null default true,
  theme                     text not null default 'light',
  updated_at                timestamptz default now()
);

-- Added for existing installs — display-only business detail shown on the
-- TSR (Sales Register) printed letterhead when set; omitted entirely when
-- blank. Not used for any tax calculation.
alter table public.clinic_settings add column if not exists gstin text;

-- ── GST / Tax settings ───────────────────────────────────────────────────
-- gst_enabled defaults false — no rates have ever been configured for this
-- shop, so GST stays fully off (billing/invoice/TSR unchanged) until an
-- admin explicitly turns it on and fills in real values below.
alter table public.clinic_settings add column if not exists gst_enabled boolean not null default false;
alter table public.clinic_settings add column if not exists business_state text;
alter table public.clinic_settings add column if not exists state_code text;
alter table public.clinic_settings add column if not exists registration_type text;
alter table public.clinic_settings add column if not exists tax_mode text not null default 'exclusive';
alter table public.clinic_settings add column if not exists default_gst_rate numeric not null default 0;
alter table public.clinic_settings add column if not exists tax_rounding text not null default 'nearest_rupee';

-- ── Settings section ─────────────────────────────────────────────────────
-- All default to the exact behavior every document already has today (logo
-- shown, GST details shown, doctor/patient/notes shown on prescriptions,
-- low-stock badge on) — nothing changes for anyone until a setting is
-- deliberately changed. show_terms_on_invoice defaults false since there is
-- no existing terms text to show yet.
alter table public.clinic_settings add column if not exists invoice_prefix text not null default 'INV';
alter table public.clinic_settings add column if not exists show_logo_on_documents boolean not null default true;
alter table public.clinic_settings add column if not exists show_gst_details_on_invoice boolean not null default true;
alter table public.clinic_settings add column if not exists show_terms_on_invoice boolean not null default false;
alter table public.clinic_settings add column if not exists invoice_terms_text text;
alter table public.clinic_settings add column if not exists show_doctor_details_on_prescription boolean not null default true;
alter table public.clinic_settings add column if not exists show_patient_contact_on_prescription boolean not null default true;
alter table public.clinic_settings add column if not exists show_notes_on_prescription boolean not null default true;
alter table public.clinic_settings add column if not exists low_stock_alerts_enabled boolean not null default true;
alter table public.clinic_settings add column if not exists default_minimum_stock integer not null default 5;

insert into public.clinic_settings (id)
values (1)
on conflict (id) do nothing;

-- ── tax_rate_config ──────────────────────────────────────────────────────
-- Category-level default GST rates for the product types that have no real
-- catalog table (Frames/Lenses/Reading Glass/Solution/Contact Lens are
-- typed free-form per visit — see hooks/useSalesRegister.ts's
-- deriveSaleDescription for the same category vocabulary). Medicines has
-- its own real per-item hsn_sac/tax_rate columns instead (see above).
create table if not exists public.tax_rate_config (
  category    text primary key,
  hsn_sac     text,
  tax_rate    numeric not null default 0,
  is_taxable  boolean not null default true
);

insert into public.tax_rate_config (category)
values ('Frame'), ('Lens'), ('Reading Glass'), ('Solution'), ('Contact Lens'), ('Consultation')
on conflict (category) do nothing;

-- ── stock_movements ──────────────────────────────────────────────────────
-- Added for Inventory Reports — available_stock on `medicines` was always
-- just a live number, silently overwritten by every sale/manual issue/edit
-- with no history of when or how much changed. This table starts capturing
-- that going forward (wired into the 4 places stock changes: addMedicine,
-- issueMedicineStock, updateMedicine, and the sale-deduction loop in
-- useCreateVisitAndPrescription.ts). Pre-existing history before this table
-- existed still can't be reconstructed — Inventory Reports correctly shows
-- zero movement for periods before today, never a fabricated backfill.
create table if not exists public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid references public.medicines(id) on delete set null,
  item_name     text not null,
  category      text not null,
  movement_type text not null check (movement_type in ('Stock In', 'Stock Out')),
  quantity      integer not null,
  reason        text,
  reference     text,
  date          timestamptz not null default now()
);

create index if not exists idx_stock_movements_date on public.stock_movements(date);
create index if not exists idx_stock_movements_item_id on public.stock_movements(item_id);

-- Added for the "+ Add Stock" purchase flow — freeform notes on a stock-in
-- event, kept separate from `reason` (a short categorical label like
-- 'Purchase'/'Sale'/'Initial Stock', unconstrained so no migration was
-- needed to add the 'Purchase' value).
alter table public.stock_movements add column if not exists notes text;

-- Reusable supplier directory for the "+ Add Stock" flow. Deliberately not
-- a foreign key from expenses/medicines — those keep storing the supplier's
-- name as free text (expenses.vendor / a purchaseStock() param), matching
-- every purchase already recorded before this table existed. Supplier-wise
-- summaries join on that name, not an id.
create table if not exists public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phone        text,
  address      text,
  gstin        text,
  state        text,
  state_code   text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_suppliers_created_at on public.suppliers(created_at desc);

-- Soft-delete flag. Deleting a supplier does NOT remove their row or touch
-- any expense/medicine that references their name — it only sets this to
-- false, so the supplier list, the Add Stock picker, and the Suppliers
-- section stop showing them, while every past transaction (and their
-- Supplier Details page, if it's still linked from somewhere) stays intact.
alter table public.suppliers add column if not exists is_active boolean not null default true;

-- ── Row Level Security ────────────────────────────────────────────────────
-- The app currently authenticates only via the anon key with no per-row
-- ownership model (no user_id columns — it's a single shared clinic
-- dataset), and middleware.ts has auth checks bypassed. So RLS is enabled
-- (required for the anon key to be able to touch these tables at all under
-- Supabase's default-deny posture) but the policies are fully permissive.
-- Tighten these once real login/authorization is enforced in the app.

alter table public.patients        enable row level security;
alter table public.visits          enable row level security;
alter table public.prescriptions   enable row level security;
alter table public.medicines       enable row level security;
alter table public.expenses        enable row level security;
alter table public.activity_log    enable row level security;
alter table public.clinic_settings enable row level security;
alter table public.tax_rate_config enable row level security;
alter table public.stock_movements enable row level security;
alter table public.suppliers       enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['patients','visits','prescriptions','medicines','expenses','activity_log','clinic_settings','tax_rate_config','stock_movements','suppliers']
  loop
    execute format('drop policy if exists allow_all_anon on public.%I', t);
    execute format(
      'create policy allow_all_anon on public.%I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
