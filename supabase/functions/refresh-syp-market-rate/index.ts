import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const RATE_URL = "https://lirascope.syria-cloud.sy/api/v1/rates/latest?currencies=USD&lang=ar";
const COOLDOWN_MS = 50 * 60 * 1000;
// Only accept a market quote updated within the last two hours.
const MAX_SOURCE_AGE_MS = 2 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 10 * 60 * 1000;
const MAX_ALLOWED_CHANGE = 0.35;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function getServiceKey(): string | null {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!secretKeysRaw) return null;
  try {
    const secretKeys = JSON.parse(secretKeysRaw);
    return secretKeys.default ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = getServiceKey();
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing Supabase URL or server secret key");
    return json({ error: "Server configuration is incomplete" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: lastSetting, error: lastError } = await admin
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", "usd_syp_market_updated_at")
      .maybeSingle();

    if (lastError) throw lastError;

    const lastUpdatedValue = lastSetting?.setting_value;
    const lastUpdatedText = typeof lastUpdatedValue === "string"
      ? lastUpdatedValue
      : null;
    const lastUpdatedMs = lastUpdatedText ? Date.parse(lastUpdatedText) : NaN;

    if (Number.isFinite(lastUpdatedMs) && Date.now() - lastUpdatedMs < COOLDOWN_MS) {
      return json({ ok: true, skipped: true, reason: "Rate was refreshed recently" });
    }

    const response = await fetch(RATE_URL, {
      headers: { "Accept": "application/json", "User-Agent": "JAKO-STORE-Exchange-Rate/1.0" },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`LiraScope returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    const usdRate = Array.isArray(payload?.marketRates)
      ? payload.marketRates.find((item: Record<string, unknown>) => item.currency === "USD")
      : null;

    const sellRate = Number(usdRate?.sell);
    const sourceUpdatedText = String(usdRate?.timestampUtc ?? payload?.timestampUtc ?? "");
    const sourceUpdatedMs = Date.parse(sourceUpdatedText);

    if (!usdRate || !Number.isFinite(sellRate) || sellRate <= 0 || sellRate > 1000000) {
      throw new Error("The USD parallel-market sell rate is missing or invalid");
    }
    if (!Number.isFinite(sourceUpdatedMs)) {
      throw new Error("The rate source did not return a valid update timestamp");
    }

    const sourceAge = Date.now() - sourceUpdatedMs;
    if (sourceAge > MAX_SOURCE_AGE_MS) {
      const ageMinutes = Math.floor(sourceAge / 60000);
      const sourceUpdatedAt = new Date(sourceUpdatedMs).toISOString();
      console.error("Rejected stale exchange-rate source data", {
        sourceUpdatedAt,
        ageMinutes,
        maxAgeMinutes: Math.floor(MAX_SOURCE_AGE_MS / 60000),
      });
      throw new Error(
        `Rate source data is stale (${ageMinutes} minutes old; maximum allowed is 120 minutes). Last source update: ${sourceUpdatedAt}`,
      );
    }
    if (sourceAge < -MAX_FUTURE_SKEW_MS) {
      throw new Error("The rate source timestamp is more than 10 minutes in the future");
    }
    if (usdRate.isCalculated === true) {
      throw new Error("The USD rate is calculated, not a direct market quote");
    }

    const { data: previousRateSetting, error: previousRateError } = await admin
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", "usd_syp_market_rate")
      .maybeSingle();

    if (previousRateError) throw previousRateError;

    const previousRate = Number(previousRateSetting?.setting_value);
    if (Number.isFinite(previousRate) && previousRate > 0) {
      const changeRatio = Math.abs(sellRate - previousRate) / previousRate;
      if (changeRatio > MAX_ALLOWED_CHANGE) {
        throw new Error("The rate changed by more than 35%; update paused for review");
      }
    }

    const { data, error } = await admin.rpc("apply_market_exchange_rate", {
      p_rate: sellRate,
      p_source_updated_at: new Date(sourceUpdatedMs).toISOString(),
    });

    if (error) throw error;

    return json({
      ok: true,
      source: "LiraScope parallel market sell rate",
      source_updated_at: new Date(sourceUpdatedMs).toISOString(),
      source_age_minutes: Math.floor(sourceAge / 60000),
      updated: data,
    });
  } catch (error) {
    console.error("Exchange rate refresh failed:", error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown refresh error",
    }, 502);
  }
});
