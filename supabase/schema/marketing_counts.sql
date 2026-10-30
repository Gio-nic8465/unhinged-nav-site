-- Aggregate counts; no visitor identifier, IP, full URL, email or name column.
create table public.marketing_daily_counts (
  day date not null,
  event text not null check (event in ('page_view','signup_open','signup_submit','signup_success','signup_duplicate','signup_error')),
  path text not null check (path in ('/','/features/','/voice-navigation/','/android-beta/','/iphone/','/safety/','/privacy/','/terms/','/account-deletion/','/philosophy/','/other/')),
  source text not null check (source in ('facebook','instagram','tiktok','youtube','chatgpt','organic_social','direct','other','test')),
  medium text not null check (medium in ('short_video','organic_social','bio','referral','direct','test')),
  campaign text not null check (campaign in ('first-wave','retention_brenda_20261102','retention_graham_20261102','retention_marty_20261102','personality_battle','qa_signup_20261030','other')),
  events bigint not null default 1 check (events > 0),
  primary key (day,event,path,source,medium,campaign)
);
alter table public.marketing_daily_counts enable row level security;
revoke all on public.marketing_daily_counts from public,anon,authenticated;
grant select,insert,update on public.marketing_daily_counts to service_role;

create function public.record_marketing_event(p_event text,p_path text,p_source text,p_medium text,p_campaign text)
returns void language sql security invoker set search_path = '' as $$
  insert into public.marketing_daily_counts as counts(day,event,path,source,medium,campaign)
  values ((now() at time zone 'America/Panama')::date,p_event,p_path,p_source,p_medium,p_campaign)
  on conflict (day,event,path,source,medium,campaign)
  do update set events=counts.events+1;
$$;
revoke all on function public.record_marketing_event(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_marketing_event(text,text,text,text,text) to service_role;
comment on table public.marketing_daily_counts is 'Page-load and form-event aggregates, not unique visitors or authoritative signup totals. QA source=test is excluded from marketing reports.';
