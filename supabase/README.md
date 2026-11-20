# Supabase project files

This folder stores source-controlled Supabase function code and migration files for JAKO STORE.

## Production migration history checked on 2026-11-20

The live project `zfqhfrxvpbnzzrixjaxf` reports these 12 migration version/name entries:

| Version | Migration | SQL source in this repository at review |
|---|---|---|
| `20261117233423` | `initial_store_schema` | Missing; recover from trusted backup/source |
| `20261117233622` | `harden_store_security` | Missing; recover from trusted backup/source |
| `20261117234438` | `store_storage_and_admin_profiles` | Missing; recover from trusted backup/source |
| `20261117234632` | `variant_stock_tracking` | Missing; recover from trusted backup/source |
| `20261117235849` | `require_active_payment_method` | Missing; recover from trusted backup/source |
| `20261118001246` | `tighten_public_api_privileges` | Missing; recover from trusted backup/source |
| `20261118003718` | `seed_initial_games_and_apps_catalog` | Missing; recover from trusted backup/source |
| `20261118013452` | `add_reference_prices_admin_and_payment_placeholders` | Missing; recover from trusted backup/source |
| `20261118145514` | `add_product_payment_method_ids` | Missing; recover from trusted backup/source |
| `20261118154455` | `create_pubg_accounts_catalog` | Missing; recover from trusted backup/source |
| `20261118154654` | `refine_pubg_account_read_policy` | Missing; recover from trusted backup/source |
| `20261120102254` | `supplier_integration_foundation` | Present: `migrations/20261120102254_supplier_integration_foundation.sql` |

The Supabase migration-history table records versions and names; it does not provide the original SQL bodies for the other historical migrations. Do not invent historical migration files from names alone.

Do not run `supabase db reset`, replay the supplier migration, or attempt to rebuild a fresh production database from this incomplete archive. Before bootstrapping another project, recover the missing SQL from a trusted source, or create a reviewed baseline from the live database after backup and verification of tables, policies, functions, triggers, extensions, and seed/reference data.

## Supplier foundation migration

`migrations/20261120102254_supplier_integration_foundation.sql` documents the supplier tables already applied to production:

- `public.suppliers`
- `public.supplier_variant_mappings`
- `public.supplier_fulfillments`

The tables use RLS and deny direct privileges to `anon` and `authenticated`; `service_role` is the only role granted table privileges. Never store provider credentials in these tables or in request/response summaries.
