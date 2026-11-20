const allowedOrigins = new Set([
  "https://jako-store21.jako-st.workers.dev",
]);

function jsonResponse(body: unknown, status = 200, origin = "") {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
    "Vary": "Origin",
  });
  if (allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function utcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";

  if (req.method === "OPTIONS") {
    const headers = new Headers({
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Vary": "Origin",
    });
    if (allowedOrigins.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
    return new Response("ok", { headers });
  }

  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405, origin);
  if (!allowedOrigins.has(origin)) return jsonResponse({ error: "Origin not allowed" }, 403, origin);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Authentication required" }, 401, origin);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    let supabaseApiKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseApiKey) {
      const publishableKeysRaw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
      if (publishableKeysRaw) {
        try { supabaseApiKey = JSON.parse(publishableKeysRaw).default ?? ""; } catch { /* ignore */ }
      }
    }
    if (!supabaseUrl || !supabaseApiKey) {
      return jsonResponse({ error: "Supabase function configuration is incomplete" }, 500, origin);
    }

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseApiKey, Authorization: authHeader },
    });
    if (!authResponse.ok) return jsonResponse({ error: "Invalid session" }, 401, origin);
    const user = await authResponse.json();

    const roleUrl = new URL(`${supabaseUrl}/rest/v1/user_roles`);
    roleUrl.searchParams.set("select", "role");
    roleUrl.searchParams.set("user_id", `eq.${user.id}`);
    roleUrl.searchParams.set("limit", "1");
    const roleResponse = await fetch(roleUrl, {
      headers: { apikey: supabaseApiKey, Authorization: authHeader },
    });
    if (!roleResponse.ok) return jsonResponse({ error: "Could not verify administrator role" }, 403, origin);
    const roles = await roleResponse.json();
    if (!Array.isArray(roles) || roles[0]?.role !== "admin") {
      return jsonResponse({ error: "Administrator access required" }, 403, origin);
    }

    const cfToken = Deno.env.get("CF_ANALYTICS_API_TOKEN");
    const accountTag = Deno.env.get("CF_ACCOUNT_ID");
    const siteTag = Deno.env.get("CF_WEB_ANALYTICS_SITE_TAG");
    if (!cfToken || !accountTag || !siteTag) {
      return jsonResponse({ error: "Cloudflare Analytics secrets are not configured yet" }, 503, origin);
    }

    const today = new Date();
    const endDate = utcDate(today);
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - 29);
    const startDate = utcDate(start);

    const query = `query StoreWebAnalytics($accountTag: string!, $siteTag: string!, $startDate: Date!, $endDate: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          rumPageloadEventsAdaptiveGroups(
            limit: 40
            filter: { siteTag: $siteTag, date_geq: $startDate, date_leq: $endDate }
            orderBy: [date_ASC]
          ) {
            count
            dimensions { date }
          }
        }
      }
    }`;

    const cfResponse = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { accountTag, siteTag, startDate, endDate },
      }),
    });

    const cfData = await cfResponse.json();
    if (!cfResponse.ok || cfData.errors?.length) {
      console.error("Cloudflare analytics query failed", cfData.errors ?? cfResponse.status);
      return jsonResponse({ error: "Cloudflare Analytics query failed. Check token permissions and site configuration." }, 502, origin);
    }

    const accounts = cfData.data?.viewer?.accounts ?? [];
    const groups = accounts[0]?.rumPageloadEventsAdaptiveGroups ?? [];
    const byDate = new Map<string, number>();
    for (const item of groups) {
      const date = item.dimensions?.date;
      if (date) byDate.set(date, Number(item.count ?? 0));
    }

    const series = [];
    for (let offset = 0; offset < 30; offset++) {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + offset);
      const key = utcDate(date);
      series.push({ date: key, pageViews: byDate.get(key) ?? 0 });
    }

    return jsonResponse({
      todayPageViews: byDate.get(endDate) ?? 0,
      last30PageViews: series.reduce((sum, item) => sum + item.pageViews, 0),
      series,
      timezone: "UTC",
    }, 200, origin);
  } catch (error) {
    console.error("Store analytics function error", error);
    return jsonResponse({ error: "Unable to load store analytics" }, 500, origin);
  }
});