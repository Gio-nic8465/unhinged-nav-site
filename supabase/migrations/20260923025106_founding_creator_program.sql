-- Additive migration. No existing signup rows or notification settings are changed.
begin;
create table public.creator_applications (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 1 and 100),
 email text not null unique check(email = lower(btrim(email)) and length(email) between 3 and 254),
 country text not null check(length(country) between 2 and 100),
 channel_url text not null check(length(channel_url) <= 500 and channel_url like 'https://%'),
 phone_type text not null check(phone_type in ('android','iphone')),
 audience text not null check(length(audience) between 1 and 1500),
 consented_at timestamptz not null,
 consent_version text not null default 'creator-application-2026-09-23',
 status text not null default 'pending' check(status in ('pending','reviewing','accepted','declined','withdrawn')),
 created_at timestamptz not null default now()
);
create table public.creators (
 id uuid primary key default gen_random_uuid(),
 application_id uuid unique references public.creator_applications(id),
 referral_code text not null unique default upper(replace(gen_random_uuid()::text,'-','')) check(referral_code ~ '^[A-Z0-9_-]{8,64}$'),
 status text not null default 'pending' check(status in ('pending','active','paused','ended')),
 pilot_starts_at timestamptz,
 pilot_ends_at timestamptz,
 agreement_version text,
 agreement_accepted_at timestamptz,
 created_at timestamptz not null default now(),
 check ((pilot_starts_at is null and pilot_ends_at is null) or (pilot_starts_at is not null and pilot_ends_at is not null and pilot_ends_at > pilot_starts_at and pilot_ends_at <= pilot_starts_at + interval '90 days')),
 check (status <> 'active' or (pilot_starts_at is not null and pilot_ends_at is not null and agreement_version is not null and agreement_accepted_at is not null))
);
-- Immutable initial evidence; actual commission entitlement is separately verified.
alter table public.beta_signups add column creator_referral_code text check(creator_referral_code is null or creator_referral_code ~ '^[A-Z0-9_-]{8,64}$');
create table public.creator_referral_claims (
 id uuid primary key default gen_random_uuid(),
 signup_id uuid not null unique references public.beta_signups(id),
 creator_id uuid references public.creators(id),
 claimed_code text not null,
 status text not null check(status in ('pending_review','invalid_or_inactive')),
 captured_at timestamptz not null default now()
);
create index on public.creator_referral_claims(creator_id);
create function public.capture_creator_referral() returns trigger language plpgsql security invoker set search_path='' as $$
declare found_creator uuid;
begin
 if new.creator_referral_code is null then return new; end if;
 select id into found_creator from public.creators where referral_code=new.creator_referral_code and status='active' and pilot_starts_at<=now() and pilot_ends_at>now();
 insert into public.creator_referral_claims(signup_id,creator_id,claimed_code,status)
 values(new.id,found_creator,new.creator_referral_code,case when found_creator is null then 'invalid_or_inactive' else 'pending_review' end);
 return new;
end $$;
revoke all on function public.capture_creator_referral() from public,anon,authenticated;
grant execute on function public.capture_creator_referral() to service_role;
create trigger capture_creator_referral after insert on public.beta_signups for each row execute function public.capture_creator_referral();

create table public.creator_application_limits (
 ip_hash text primary key, window_start timestamptz not null, request_count integer not null check(request_count>0)
);
create function public.creator_application_rate_limit(p_hash text) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if length(p_hash) <> 64 then return false; end if;
 insert into public.creator_application_limits as limits(ip_hash,window_start,request_count) values(p_hash,now(),1)
 on conflict(ip_hash) do update set
 request_count=case when limits.window_start<=now()-interval '1 hour' then 1 else limits.request_count+1 end,
 window_start=case when limits.window_start<=now()-interval '1 hour' then now() else limits.window_start end
 returning request_count into n;
 return n<=5;
end $$;
revoke all on function public.creator_application_rate_limit(text) from public,anon,authenticated;
grant execute on function public.creator_application_rate_limit(text) to service_role;

-- Commission settings have no approved defaults. These records cannot enable payouts.
create table public.creator_commercial_terms (
 version text primary key,
 rate_bps integer check(rate_bps between 0 and 10000),
 earning_window text, payout_cadence text, minimum_payout_minor bigint check(minimum_payout_minor>=0),
 currency text check(currency ~ '^[A-Z]{3}$'), rounding text check(rounding='floor'),
 approved_at timestamptz, approval_evidence text,
 check(approved_at is null or (rate_bps is not null and earning_window is not null and rounding is not null and approval_evidence is not null))
);
create table public.creator_commission_ledger (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references public.creators(id),
 event_key text not null unique,
 transaction_id text not null,
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 amount_minor bigint not null,
 event_type text not null check(event_type in ('pending','hold','adjustment')),
 reason text not null,
 evidence jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index on public.creator_commission_ledger(creator_id);
-- No public reads or writes, including authenticated users. Only trusted operations.
do $$ declare t text; begin
 foreach t in array array['creator_applications','creators','creator_referral_claims','creator_application_limits','creator_commercial_terms','creator_commission_ledger'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
end $$;
-- Ledger and claims are append-only to the application role. Corrections require new evidence.
revoke update,delete on public.creator_commission_ledger, public.creator_referral_claims from service_role;
commit;
