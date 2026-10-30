const ORIGINS = new Set(["https://unhingednav.com", "https://www.unhingednav.com"]);
const EVENTS = new Set(["page_view", "signup_open", "signup_submit", "signup_success", "signup_duplicate", "signup_error"]);
const PATHS = new Set(["/", "/features/", "/voice-navigation/", "/android-beta/", "/iphone/", "/safety/", "/privacy/", "/terms/", "/account-deletion/", "/philosophy/", "/other/"]);
const SOURCES = new Set(["facebook", "instagram", "tiktok", "youtube", "chatgpt", "organic_social", "direct", "other", "test"]);
const MEDIA = new Set(["short_video", "organic_social", "bio", "referral", "direct", "test"]);
const CAMPAIGNS = new Set(["first-wave", "retention_brenda_20261102", "retention_graham_20261102", "retention_marty_20261102", "personality_battle", "qa_signup_20261030", "other"]);
export function validateEvent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.keys(value).some(key => !["event", "path", "source", "medium", "campaign"].includes(key))) return null;
  if (!EVENTS.has(value.event) || !PATHS.has(value.path) || !SOURCES.has(value.source) || !MEDIA.has(value.medium) || !CAMPAIGNS.has(value.campaign)) return null;
  return value;
}

export function createHandler({ env, fetchImpl = fetch }) {
  return async function handler(req) {
    const origin = req.headers.get("Origin");
    if (!ORIGINS.has(origin)) return new Response(null, { status: 403 });
    const headers = {
      "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      "Vary": "Origin", "Cache-Control": "no-store",
    };
    const reply = status => new Response(null, { status, headers });
    if (req.method === "OPTIONS") return reply(204);
    if (req.method !== "POST") return reply(405);
    // The deployed gateway verifies the JWT; keep verify_jwt=true.
    if (!req.headers.get("Authorization")?.startsWith("Bearer ")) return reply(401);
    if (Number(req.headers.get("Content-Length") || "0") > 1024) return reply(413);
    let body;
    try {
      const reader = req.body?.getReader();
      if (!reader) return reply(400);
      const chunks = []; let length = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 1024) { await reader.cancel(); return reply(413); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      body = validateEvent(JSON.parse(new TextDecoder().decode(bytes)));
    } catch (_) { return reply(400); }
    if (!body) return reply(400);
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const url = env("SUPABASE_URL");
    if (!serviceKey || !url) return reply(503);
    try {
      const result = await fetchImpl(url + "/rest/v1/rpc/record_marketing_event", {
        method: "POST",
        headers: { "apikey": serviceKey, "Authorization": "Bearer " + serviceKey, "Content-Type": "application/json" },
        body: JSON.stringify({ p_event: body.event, p_path: body.path, p_source: body.source, p_medium: body.medium, p_campaign: body.campaign }),
        signal: AbortSignal.timeout(4000),
      });
      return reply(result.ok ? 204 : 503);
    } catch (_) { return reply(503); }
  };
}
