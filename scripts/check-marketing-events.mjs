import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHandler } from '../supabase/functions/marketing-events/handler.mjs';

const script = fs.readFileSync(new URL('../marketing-events.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const token = script.match(/const PUBLIC_ANON_KEY = "([^"]+)"/)[1];
assert.equal(JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).role, 'anon');
function client({ search = '', referrer = '', navigator = {}, stored = null, failFetch = false } = {}) {
  const calls = []; const storage = new Map(stored ? [['unhinged_nav_campaign_v1', stored]] : []);
  const window = { location: { search, pathname: '/', hash: '' } };
  const context = { window, navigator, document: { referrer }, URL, URLSearchParams, Promise,
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    fetch: (url, options) => { if (failFetch) throw Error('offline'); calls.push({ url, ...options }); return Promise.resolve({ ok: true }); } };
  vm.runInNewContext(script, context);
  return { calls, metrics: window.UnhingedNavMetrics, storage };
}
let c = client({ search: '?utm_source=instagram&utm_medium=bio&utm_campaign=retention_brenda_20261102&email=must-not-leak@example.com' });
assert.equal(c.calls.length, 1);
let payload = JSON.parse(c.calls[0].body);
assert.equal(payload.source, 'instagram'); assert.equal(payload.event, 'page_view');
assert.equal(c.calls[0].credentials, 'omit'); assert.equal(c.calls[0].referrerPolicy, 'no-referrer');
assert(!c.calls[0].body.includes('email') && !c.calls[0].body.includes('http'));
c.metrics.track('signup_open'); c.metrics.track('signup_open');
c.metrics.track('signup_success'); c.metrics.track('signup_success');
assert.equal(c.calls.length, 3, 'opens/successes deduplicated per page');
const remembered = c.storage.get('unhinged_nav_campaign_v1');
c = client({ referrer: 'https://unhingednav.com/android-beta/', stored: remembered });
assert.equal(JSON.parse(c.calls[0].body).source, 'instagram', 'attribution survives same-tab navigation');
c = client({ referrer: 'https://l.facebook.com/path?private=value' });
assert.equal(JSON.parse(c.calls[0].body).source, 'facebook');
c = client({ search: '?utm_source=private@example.com&utm_campaign=private@example.com' });
assert.equal(JSON.parse(c.calls[0].body).campaign, 'other');
for (const navigator of [{ doNotTrack: '1' }, { globalPrivacyControl: true }]) {
  c = client({ navigator }); c.metrics.track('signup_open'); assert.equal(c.calls.length, 0);
}
assert.doesNotThrow(() => client({ failFetch: true }).metrics.track('signup_open'));

let requests = [];
const handler = createHandler({ env: key => ({ SUPABASE_SERVICE_ROLE_KEY: 'SERVER_ONLY', SUPABASE_URL: 'https://project.example' })[key],
  fetchImpl: async (url, options) => { requests.push({ url, ...options }); return new Response(null, { status: 204 }); } });
const good = { event: 'page_view', path: '/', source: 'test', medium: 'test', campaign: 'qa_signup_20261030' };
const request = (body = good, origin = 'https://unhingednav.com', extra = {}) => new Request('https://edge.example', {
  method: 'POST', headers: { Origin: origin, Authorization: 'Bearer PUBLIC', ...extra }, body: typeof body === 'string' ? body : JSON.stringify(body) });
let response = await handler(request());
assert.equal(response.status, 204); assert.equal(await response.text(), '');
assert.equal(requests.length, 1); assert(requests[0].url.endsWith('/rpc/record_marketing_event'));
assert.equal(JSON.parse(requests[0].body).p_source, 'test');
assert.equal(await (await handler(request(good, 'https://evil.example'))).text(), '');
assert.equal((await handler(request(good, 'https://evil.example'))).status, 403);
assert.equal((await handler(request({ ...good, email: 'unexpected@example.com' }))).status, 400);
assert.equal((await handler(request({ ...good, path: '/users/private@example.com' }))).status, 400);
assert.equal((await handler(request('invalid json'))).status, 400);
assert.equal((await handler(request('x'.repeat(1025)))).status, 413);
assert.equal((await handler(new Request('https://edge.example', { method: 'OPTIONS', headers: { Origin: 'https://www.unhingednav.com' } }))).status, 204);
const broken = createHandler({ env: () => 'configured', fetchImpl: async () => { throw Error('private internal error'); } });
assert.equal((await broken(request())).status, 503);
assert.equal(requests.length, 1, 'invalid events never write counts');

// Exercise real signup-handler success and failure without transmitting form values.
async function signup(ok, withMetrics = true, duplicate = false) {
  const listeners = {}; const events = []; const sent = [];
  const classes = () => ({ add() {}, remove() {} });
  const submit = { disabled: false, textContent: '' };
  const form = { querySelector: () => submit, elements: { phoneType: { value: 'Android' } }, reset() { this.resetCalled = true; }, addEventListener: (name, fn) => { listeners[name] = fn; } };
  const dialog = { open: false, showModal() { this.open = true; } };
  const elements = { 'beta-download': dialog, 'beta-form': form, 'signup-content': { classList: classes() }, 'signup-success': { classList: classes() }, 'form-message': { classList: classes() }, 'signup-confirmation': {} };
  const window = { location: { hash: '#beta', search: '' }, addEventListener: (name, fn) => { listeners[name] = fn; } };
  if (withMetrics) window.UnhingedNavMetrics = { track: event => events.push(event), attribution: () => ({ source: 'instagram', medium: 'bio', campaign: 'retention_brenda_20261102' }) };
  const body = html.slice(html.indexOf('      const betaDialog ='), html.lastIndexOf('    </script>'));
  vm.runInNewContext(body, { window, document: { getElementById: id => elements[id], querySelectorAll: () => [], referrer: '' }, URLSearchParams,
    FormData: class { *[Symbol.iterator]() { yield ['name', 'Synthetic QA']; yield ['email', 'qa@example.com']; } },
    fetch: async (url, options) => { sent.push(JSON.parse(options.body)); return { ok, json: async () => ({ ok, duplicate }) }; } });
  listeners.DOMContentLoaded(); assert.equal(dialog.open, true, '#beta opens the form');
  await listeners.submit({ preventDefault() {}, currentTarget: form });
  assert.equal(submit.disabled, false); assert.equal(submit.textContent, 'Join the waitlist');
  if (withMetrics) {
    assert.equal(events.includes('signup_success'), ok && !duplicate);
    assert.equal(events.includes('signup_duplicate'), ok && duplicate);
    assert.equal(events.includes('signup_error'), !ok);
    assert.equal(sent[0].utm_source, 'instagram');
  }
  assert.equal(!!form.resetCalled, ok);
}
await signup(true); await signup(false); await signup(true, false); await signup(true, true, true);
for (const s of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) if (!s[0].includes('application/ld+json')) new vm.Script(s[1]);
assert(html.includes('data-open-beta>JOIN THE BETA WAITLIST'), 'bottom signup CTA exists');
console.log('PASS: anonymous aggregates, attribution, privacy signals, failure isolation, gateway/CORS boundaries, body limits, success/error reporting, #beta signup and blocked-metrics fallback.');
