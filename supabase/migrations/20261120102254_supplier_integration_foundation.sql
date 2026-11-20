-- JAKO STORE supplier integration foundation
-- Reconstructed from the live Supabase schema after migration
-- 20261120102254_supplier_integration_foundation was applied.
-- This file is for repository/source-control history. Do NOT execute it again
-- against the production project; that migration version is already recorded.

begin;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9_-]{1,47}$'),
  integration_type text not null default 'api'
    check (integration_type in ('api', 'manual')),
  status text not null default 'inactive'
    check (status in ('inactive', 'active', 'suspended')),
  api_base_url text,
  api_version text,
  supports_catalog_sync boolean not null default false,
  supports_stock_sync boolean not null default false,
  supports_order_submission boolean not null default false,
  supports_order_status boolean not null default false,
  last_connection_test_at timestamptz,
  last_connection_status text
    check (last_connection_status is null or last_connection_status in ('success', 'failed', 'not_tested')),
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_variant_mappings (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null
    references public.suppliers(id) on delete restrict,
  variant_id uuid not null
    references public.product_variants(id) on delete restrict,
  remote_product_id text,
  remote_variant_id text,
  supplier_sku text,
  supplier_cost numeric
    check (supplier_cost is null or supplier_cost >= 0),
  cost_currency text not null default 'USD'
    check (cost_currency ~ '^[A-Z]{3}$'),
  is_enabled boolean not null default false,
  remote_stock_quantity integer
    check (remote_stock_quantity is null or remote_stock_quantity >= 0),
  remote_is_available boolean,
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_variant_mappings_supplier_variant_unique
    unique (supplier_id, variant_id),
  constraint supplier_variant_mappings_enabled_requires_remote_id
    check (not is_enabled or remote_product_id is not null)
);

create table if not exists public.supplier_fulfillments (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null
    references public.suppliers(id) on delete restrict,
  order_id uuid not null
    references public.orders(id) on delete restrict,
  order_item_id uuid not null
    references public.order_items(id) on delete restrict,
  idempotency_key text not null unique,
  external_order_id text,
  status text not null default 'queued'
    check (status in ('queued', 'submitting', 'accepted', 'processing', 'completed', 'failed', 'cancelled', 'needs_review')),
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  request_summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(request_summary) = 'object'),
  response_summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(response_summary) = 'object'),
  last_error text,
  next_retry_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_fulfillments_order_item_id_key unique (order_item_id)
);

create index if not exists supplier_variant_mappings_supplier_enabled_idx
  on public.supplier_variant_mappings (supplier_id, is_enabled);

create index if not exists supplier_variant_mappings_variant_idx
  on public.supplier_variant_mappings (variant_id);

create index if not exists supplier_fulfillments_order_idx
  on public.supplier_fulfillments (order_id);

create index if not exists supplier_fulfillments_status_created_idx
  on public.supplier_fulfillments (status, created_at desc);

create unique index if not exists supplier_fulfillments_external_order_unique
  on public.supplier_fulfillments (supplier_id, external_order_id)
  where external_order_id is not null;

alter table public.suppliers enable row level security;
alter table public.supplier_variant_mappings enable row level security;
alter table public.supplier_fulfillments enable row level security;

drop policy if exists service_role_manages_suppliers on public.suppliers;
create policy service_role_manages_suppliers
  on public.suppliers for all to service_role
  using (true) with check (true);

drop policy if exists service_role_manages_supplier_variant_mappings on public.supplier_variant_mappings;
create policy service_role_manages_supplier_variant_mappings
  on public.supplier_variant_mappings for all to service_role
  using (true) with check (true);

drop policy if exists service_role_manages_supplier_fulfillments on public.supplier_fulfillments;
create policy service_role_manages_supplier_fulfillments
  on public.supplier_fulfillments for all to service_role
  using (true) with check (true);

revoke all privileges on table
  public.suppliers,
  public.supplier_variant_mappings,
  public.supplier_fulfillments
from anon, authenticated;

grant all privileges on table
  public.suppliers,
  public.supplier_variant_mappings,
  public.supplier_fulfillments
to service_role;

comment on table public.suppliers is
  'Server-managed supplier directory. Never store API credentials in this table.';
comment on table public.supplier_variant_mappings is
  'Maps a JAKO STORE product variant to the corresponding supplier product/variant.';
comment on table public.supplier_fulfillments is
  'Tracks supplier-side fulfillment for each store order item; idempotency_key prevents duplicate submissions.';

commit;
