/* Aggregate marketing events only: no cookies, visitor IDs or form values. */
(function () {
  "use strict";
  const ENDPOINT = "https://lmzzcnbtzjqwnufmtdjh.supabase.co/functions/v1/marketing-events";
  const PUBLIC_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtenpjbmJ0empxd251Zm10ZGpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NjEzMDIsImV4cCI6MjEwMzQzNzMwMn0.TZXY5SpbwKUwe3YeDYIcqESU1STNEvhMwCK9D2Qb94E";
  const STORAGE_KEY = "unhinged_nav_campaign_v1";
  const sources = new Set(["facebook", "instagram", "tiktok", "youtube", "chatgpt", "organic_social", "direct", "other", "test"]);
  const media = new Set(["short_video", "organic_social", "bio", "referral", "direct", "test"]);
  const campaigns = new Set(["first-wave", "retention_brenda_20261102", "retention_graham_20261102", "retention_marty_20261102", "personality_battle", "retention_hal_20261101", "retention_roxie_20261103", "qa_signup_20261030", "other"]);
  const events = new Set(["page_view", "signup_open", "signup_submit", "signup_success", "signup_duplicate", "signup_error"]);
  const paths = new Set(["/", "/features/", "/voice-navigation/", "/android-beta/", "/iphone/", "/safety/", "/privacy/", "/terms/", "/account-deletion/", "/philosophy/"]);
  const optedOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" || window.doNotTrack === "1";
  if (optedOut) {
    console.info("Unhinged Nav: optional aggregate measurement disabled by browser privacy preference.");
    window.UnhingedNavMetrics = { track: function () {}, attribution: function () { return null; } };
    return;
  }
  const params = new URLSearchParams(window.location.search);
  function sourceFromReferrer() {
    try {
      const host = new URL(document.referrer).hostname.toLowerCase();
      if (/(^|\.)facebook\.com$|(^|\.)fb\.com$/.test(host)) return "facebook";
      if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
      if (/(^|\.)tiktok\.com$/.test(host)) return "tiktok";
      if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) return "youtube";
      if (/(^|\.)chatgpt\.com$/.test(host)) return "chatgpt";
      if (host === "unhingednav.com" || host === "www.unhingednav.com") return "direct";
      return "other";
    } catch (_) { return "direct"; }
  }
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY)); } catch (_) {}
  const explicit = params.has("utm_source") || params.has("utm_campaign");
  const inferredSource = sourceFromReferrer();
  const source = explicit ? (sources.has(params.get("utm_source")) ? params.get("utm_source") : "other") : (sources.has(saved?.source) ? saved.source : inferredSource);
  const medium = explicit ? (media.has(params.get("utm_medium")) ? params.get("utm_medium") : "referral") : (media.has(saved?.medium) ? saved.medium : (source === "direct" ? "direct" : "referral"));
  const campaign = explicit ? (campaigns.has(params.get("utm_campaign")) ? params.get("utm_campaign") : "other") : (campaigns.has(saved?.campaign) ? saved.campaign : "first-wave");
  const attribution = { source: source, medium: medium, campaign: campaign };
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution)); } catch (_) {}
  let opened = false;
  let succeeded = false;
  function track(event) {
    if (!events.has(event)) return;
    if (event === "signup_open") { if (opened) return; opened = true; }
    if (event === "signup_success") { if (succeeded) return; succeeded = true; }
    const payload = { event: event, path: paths.has(window.location.pathname) ? window.location.pathname : "/other/", ...attribution };
    try {
      Promise.resolve(fetch(ENDPOINT, {
        method: "POST", credentials: "omit", referrerPolicy: "no-referrer", keepalive: true,
        headers: { "Content-Type": "application/json", "apikey": PUBLIC_ANON_KEY, "Authorization": "Bearer " + PUBLIC_ANON_KEY },
        body: JSON.stringify(payload),
      })).catch(function () {});
    } catch (_) { /* Measurement must never interrupt signup. */ }
  }
  window.UnhingedNavMetrics = { track: track, attribution: function () { return { ...attribution }; } };
  track("page_view");
})();
