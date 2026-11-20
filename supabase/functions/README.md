# Supabase Edge Functions — JAKO STORE

The two source files in this directory were retrieved from the active Supabase project `zfqhfrxvpbnzzrixjaxf` on 2026-11-20. They are source-control copies of the currently deployed functions; adding or changing these files in Git does not deploy a function.

## Functions checked

| Function | Supabase version at review | JWT verification | Purpose |
|---|---:|---|---|
| `store-web-analytics` | 7 | Enabled | Returns Cloudflare Web Analytics page-view data to an authenticated administrator. |
| `refresh-syp-market-rate` | 6 | Enabled | Fetches the USD parallel-market sell quote, validates its age and movement, and applies it through the database RPC. |

## Secrets and configuration

Never commit `.env`, `.env.*`, `.dev.vars`, API tokens, service-role keys, or Supabase secret keys.

`store-web-analytics` reads these server-side secrets:

- `CF_ANALYTICS_API_TOKEN`
- `CF_ACCOUNT_ID`
- `CF_WEB_ANALYTICS_SITE_TAG`

It also uses the Supabase URL and a publishable/legacy anon API key to validate the caller and verify the `admin` role. It currently allows the production web origin `https://jako-store21.jako-st.workers.dev`; update the allowlist only when the site origin actually changes.

`refresh-syp-market-rate` reads `SUPABASE_URL` and a server-side service key from `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEYS`. Those values must remain in Supabase Function Secrets, never in browser code or this repository.

## Deployment safety

Both functions had `verify_jwt = true` at the time of review. Preserve JWT verification. Do not redeploy simply because these files were added to Git. Before deployment, compare the intended source with the live function, confirm the required secrets are present, deploy only the function being changed, and test its expected authenticated flow.

For the supplier integration, do not add provider credentials to database rows, function source, Git history, request summaries, or response summaries. Keep the supplier API adapter server-side and use an idempotency key before any real order submission.
