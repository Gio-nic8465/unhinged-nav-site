import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const ALLOWED_HOSTS = new Set([
  "unhingednav.com",
  "www.unhingednav.com",
  "unhinged-nav.gnicola8465.chatgpt.site",
  "gio-nic8465.github.io",
]);

const MAX_BODY_BYTES = 12_000;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const allowedOrigin = (origin: string | null) => {
  if (!origin) return true;
  try {
    const u = new URL(origin);
    return u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
};

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin":
    origin && allowedOrigin(origin) ? origin : "https://unhingednav.com",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const json = (
  body: unknown,
  status: number,
  origin: string | null,
  extra: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
      ...extra,
    },
  });

const hashIp = async (ip: string) => {
  const bytes = new TextEncoder().encode(`unhinged-beta:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    if (!allowedOrigin(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, origin);
  }
  if (!allowedOrigin(origin)) {
    return json({ ok: false, error: "origin_not_allowed" }, 403, origin);
  }

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, 413, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400, origin);
  }

  // Honeypot: real users never fill this field.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return json({ ok: true }, 200, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase server environment");
    return json({ ok: false, error: "server_config" }, 500, origin);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Lightweight abuse throttling. Only a one-way hash is stored, never the raw IP.
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip =
    req.headers.get("cf-connecting-ip")?.trim() ||
    forwarded ||
    req.headers.get("x-real-ip")?.trim() ||
    "";

  if (ip) {
    const ipHash = await hashIp(ip);
    const now = new Date();
    const { data: rateRow, error: rateReadError } = await supabase
      .from("beta_signup_rate_limits")
      .select("window_start,request_count")
      .eq("ip_hash", ipHash)
      .maybeSingle();

    if (rateReadError) {
      console.error("rate limit read failed", rateReadError.code, rateReadError.message);
    } else if (rateRow) {
      const windowStart = Date.parse(rateRow.window_start);
      if (Number.isFinite(windowStart) && now.getTime() - windowStart < RATE_WINDOW_MS) {
        if (rateRow.request_count >= RATE_LIMIT) {
          const retrySeconds = Math.max(
            1,
            Math.ceil((RATE_WINDOW_MS - (now.getTime() - windowStart)) / 1000),
          );
          return json(
            { ok: false, error: "too_many_requests" },
            429,
            origin,
            { "Retry-After": String(retrySeconds) },
          );
        }

        await supabase
          .from("beta_signup_rate_limits")
          .update({
            request_count: rateRow.request_count + 1,
            updated_at: now.toISOString(),
          })
          .eq("ip_hash", ipHash);
      } else {
        await supabase
          .from("beta_signup_rate_limits")
          .update({
            window_start: now.toISOString(),
            request_count: 1,
            updated_at: now.toISOString(),
          })
          .eq("ip_hash", ipHash);
      }
    } else {
      await supabase.from("beta_signup_rate_limits").insert({
        ip_hash: ipHash,
        window_start: now.toISOString(),
        request_count: 1,
        updated_at: now.toISOString(),
      });
    }
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const rawPhoneValue =
    typeof body.phone_type === "string"
      ? body.phone_type
      : typeof body.phoneType === "string"
        ? body.phoneType
        : "";
  const rawPhone = rawPhoneValue.trim().toLowerCase();
  const phone_type = rawPhone === "ios" ? "iphone" : rawPhone;
  const country =
    typeof body.country === "string" ? body.country.trim() : "";

  const email_consent =
    body.email_consent === true ||
    body.emailConsent === true ||
    body.emailConsent === "yes";

  const campaign =
    typeof body.campaign === "string"
      ? body.campaign.trim().slice(0, 120)
      : null;
  const utm_source =
    typeof body.utm_source === "string"
      ? body.utm_source.trim().slice(0, 120)
      : null;
  const utm_medium =
    typeof body.utm_medium === "string"
      ? body.utm_medium.trim().slice(0, 120)
      : null;
  const utm_campaign =
    typeof body.utm_campaign === "string"
      ? body.utm_campaign.trim().slice(0, 120)
      : null;
  const landing_url =
    typeof body.landing_url === "string"
      ? body.landing_url.trim().slice(0, 500)
      : null;
  const referrer_url =
    typeof body.referrer_url === "string"
      ? body.referrer_url.trim().slice(0, 500)
      : null;

  if (!name || name.length > 100) {
    return json({ ok: false, error: "invalid_name" }, 400, origin);
  }
  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return json({ ok: false, error: "invalid_email" }, 400, origin);
  }
  if (!["android", "iphone"].includes(phone_type)) {
    return json({ ok: false, error: "invalid_phone_type" }, 400, origin);
  }
  if (country.length < 2 || country.length > 100) {
    return json({ ok: false, error: "invalid_country" }, 400, origin);
  }
  if (!email_consent) {
    return json({ ok: false, error: "consent_required" }, 400, origin);
  }

  const claimedCode = typeof body.creator_referral_code === "string" ? body.creator_referral_code.trim().toUpperCase() : "";
  const creator_referral_code = /^[A-Z0-9_-]{8,64}$/.test(claimedCode) ? claimedCode : null;

  const { data: insertedSignup, error } = await supabase.from("beta_signups").insert({
    name,
    email,
    phone_type,
    country,
    status: "new",
    source: "website",
    campaign,
    utm_source,
    utm_medium,
    utm_campaign,
    email_consent: true,
    consented_at: new Date().toISOString(),
    landing_url,
    referrer_url,
    creator_referral_code,
  }).select("id").single();

  if (error) {
    if (error.code === "23505") {
      return json({ ok: true, duplicate: true }, 200, origin);
    }
    console.error("beta signup insert failed", error.code, error.message);
    return json({ ok: false, error: "signup_failed" }, 500, origin);
  }

  let notificationSent = false;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    console.error("Missing RESEND_API_KEY; signup saved without email notification");
  } else {
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char] ?? char);

    try {
      const createdAt = new Date().toISOString();
      const notificationResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Unhinged Nav <notifications@unhingednav.com>",
          to: ["beta@unhingednav.com"],
          reply_to: email,
          subject: `New Unhinged Nav beta signup: ${phone_type === "android" ? "Android" : "iPhone"}`,
          text: [
            "A new tester joined the Unhinged Nav beta list.",
            "",
            `Name: ${name}`,
            `Email: ${email}`,
            `Phone type: ${phone_type}`,
            `Country: ${country}`,
            `Campaign: ${campaign || "—"}`,
            `Submitted: ${createdAt}`,
          ].join("\n"),
          html: `<h2>New Unhinged Nav beta signup</h2>
            <p><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Phone type:</strong> ${escapeHtml(phone_type)}</p>
            <p><strong>Country:</strong> ${escapeHtml(country)}</p>
            <p><strong>Campaign:</strong> ${escapeHtml(campaign || "—")}</p>
            <p><strong>Submitted:</strong> ${createdAt}</p>`,
        }),
      });

      if (!notificationResponse.ok) {
        console.error(
          "Resend notification failed",
          notificationResponse.status,
          await notificationResponse.text(),
        );
      } else {
        notificationSent = true;
        if (insertedSignup?.id) {
          const { error: backupUpdateError } = await supabase
            .from("beta_signups")
            .update({ backup_emailed_at: new Date().toISOString() })
            .eq("id", insertedSignup.id);
          if (backupUpdateError) {
            console.error(
              "backup email tracking update failed",
              backupUpdateError.code,
              backupUpdateError.message,
            );
          }
        }
      }
    } catch (notificationError) {
      console.error("Resend notification exception", notificationError);
    }
  }

  return json(
    { ok: true, duplicate: false, notification_sent: notificationSent },
    201,
    origin,
  );
});
