# Founding Creator Program — implementation handoff

## Built on September 23, 2026

Based on website main commit `e732de41116d12f88a6f2782b94fdf335d987537` and live beta-signup Edge Function version 7. The live database had no creator tables. Only schema metadata and function source were inspected; no customer records were exported.

- Responsive creator application page at `/creators/` with the approved 90-day maximum pilot and payment wording.
- Application handler: strict validation, bounded streamed request body, supported social channel URLs, explicit contact consent, honeypot, atomic rate limiting, duplicate-safe persistence, private server credentials.
- Referral query codes carried through same-origin links only, no cookies or persistent browser storage. Existing beta signup adds one optional field. Invalid code syntax is discarded without breaking signup.
- Additive migration: applications, creators, referral claims, pending/held/adjustment ledger, unset commercial terms and rate limiting. All new tables have RLS and no anon/authenticated access. Service role is the sole application writer; claim and ledger records cannot be edited/deleted by it.
- Claim capture is in the same database transaction as signup. A duplicate signup cannot reassign the earlier record. Valid active creator claims remain `pending_review`, preserving the unresolved attribution/entitlement policy. No signup creates a commission entry.
- Pure, tested commission evaluator enforces verified purchase, attribution, approved terms, platform-period completion, received and cleared revenue, transaction-level settlement reconciliation and the five excluded categories. No fixed 30-day release. Integer-string money and single-currency allocation prevent floating-point loss.
- Private operator CLI lists applications, creates pending creator records idempotently and issues links only for accepted, currently active pilots. It cannot approve terms, activate creators or send payments.

## Approved payment rule — controlling

A referral signup creates attribution only and earns no commission by itself. Commission becomes payable only after the referred customer purchases Unhinged Nav, the applicable Apple/Google payment period has passed, and Unhinged Nav has actually received and cleared the revenue. Creators follow the same platform payment delay that Unhinged Nav experiences. Refunds, reversals, chargebacks, taxes, and platform fees are excluded from commissionable net revenue. Do not promise creators a fixed 30-day payout when the applicable platform takes longer.

Preserve active-creator free access and all existing rules. The 20% rate, 12-month earning window and $50 threshold remain proposals, not configured defaults. Test values are fixtures only. The 90-day pilot cannot silently extend to one year.

## Release sequence (not executed)

1. Review and approve deployment of the branch. Re-fetch the live beta-signup source and schema first; if changed from v7, reconcile before deployment.
2. Apply the additive migration in staging, run the tests with actual Supabase roles, then inspect advisors. Keep rollback to old Edge Function and website available; do not drop collected claims during rollback.
3. Deploy creator-application and updated beta-signup with existing JWT settings. Keep secrets server-side. Validate the gateway supplies a trustworthy client-address header; the application fails closed when absent. Confirm forged client headers cannot evade throttling; configure a challenge if required before public opening.
4. Publish the website change only after backend readiness. Run a controlled live smoke test under explicit test authority; the preserved beta endpoint sends existing notification email, so no live test has been submitted by this build.
5. Open recruitment only after approving commercial and participation terms, retention policy, channel disclosures, attribution precedence/window, self-referral/existing-customer rules, post-pilot entitlement and refund recovery terms. The application page stays unlinked/noindex until ready.
6. Integrate verified Apple/Google purchase events and actual settlement/bank evidence. The evaluator is not a purchase verifier. Do not trust browser requests, bare email matches or a purchase receipt as settlement proof.
7. Add transactional, idempotent payable/payout allocation only after approved terms and real settlement adapters exist. The current database ledger deliberately allows only pending, hold and adjustment events; the current build cannot disburse money.

## Verification and limits

`npm ci && npm test` runs PostgreSQL migration/access tests in PGlite, the original beta handler regression harness, application-handler tests, referral propagation checks and financial eligibility scenarios. PGlite is an isolated PostgreSQL test engine, not the hosted Supabase gateway. Browser checks use mocked APIs; they do not prove live deployment. Production integration, provider settlement formats, auth gateway behavior, email delivery and actual payout execution remain untested and inactive.

The existing live beta handler retains its existing notification and rate-limit behavior. This branch does not claim to remediate every pre-existing abuse-control limitation.

## Operator use

Keep `SUPABASE_SERVICE_ROLE_KEY` in a private environment, never frontend code, committed files, screenshots or notes. `node scripts/creator-admin.mjs list-applications` shows pending submissions without exposing email in ordinary output. `create-pending <application UUID>` creates a non-active record only. After separate owner-approved enrollment, `link <creator UUID>` produces the assigned referral URL. Do not export applicant information to this public repository.

## Sources consulted for implementation

- https://supabase.com/changelog.md — reviewed relevant breaking-change headings; no applicable new API used.
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/docs/guides/database/postgres/row-level-security

Existing `@supabase/supabase-js@2.95.0` dependency pin retained from the live function.
