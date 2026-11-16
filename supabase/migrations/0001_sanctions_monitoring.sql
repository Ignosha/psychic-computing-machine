-- Sanctions monitoring storage. Tables live in a private schema with RLS on and no policies, so the public
-- (publishable) key cannot read them. The app reaches them only through the functions below, each of which
-- requires the shared secret stored in monitoring.config (set it once after applying; never commit it):
--   insert into monitoring.config (key, value) values ('api_secret', '<long random string>');

create schema if not exists monitoring;
revoke all on schema monitoring from public, anon, authenticated;

create table if not exists monitoring.config (key text primary key, value text not null);

create table if not exists monitoring.monitors (
  id uuid primary key default gen_random_uuid(),
  owner text not null,
  external_id text,
  name text not null,
  type text,
  dob text,
  country text,
  threshold real,
  created_at timestamptz not null default now(),
  last_screened_at timestamptz,
  last_hash text,
  last_decision text,
  last_match_ids text[] not null default '{}',
  unique (owner, external_id)
);
create index if not exists monitors_owner_idx on monitoring.monitors (owner, created_at);
create index if not exists monitors_due_idx on monitoring.monitors (last_hash, last_screened_at);

create table if not exists monitoring.alerts (
  id bigserial primary key,
  owner text not null,
  monitor_id uuid references monitoring.monitors (id) on delete cascade,
  external_id text,
  monitored_name text,
  kind text not null check (kind in ('new_match', 'match_removed')),
  match jsonb not null,
  lists_version text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  attempts int not null default 0,
  last_error text
);
create index if not exists alerts_owner_idx on monitoring.alerts (owner, id);
create index if not exists alerts_pending_idx on monitoring.alerts (id) where delivered_at is null;

create table if not exists monitoring.webhooks (
  owner text primary key,
  url text not null,
  secret text not null,
  updated_at timestamptz not null default now()
);

alter table monitoring.config enable row level security;
alter table monitoring.monitors enable row level security;
alter table monitoring.alerts enable row level security;
alter table monitoring.webhooks enable row level security;

create or replace function monitoring.check_secret(p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is null or not exists (select 1 from monitoring.config where key = 'api_secret' and value = p_secret) then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
end $$;

-- Add or update monitors (upsert on owner + external_id), enforcing the plan's monitor limit.
create or replace function public.mon_add(p_secret text, p_owner text, p_rows jsonb, p_limit int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_existing int; v_new int; v_out jsonb;
begin
  perform monitoring.check_secret(p_secret);
  select count(*) into v_existing from monitoring.monitors where owner = p_owner;
  select count(*) into v_new from jsonb_array_elements(p_rows) r
    where r->>'external_id' is null
       or not exists (select 1 from monitoring.monitors m where m.owner = p_owner and m.external_id = r->>'external_id');
  if v_existing + v_new > p_limit then
    raise exception 'monitor_limit: plan allows % monitored names, you have %', p_limit, v_existing using errcode = 'P0001';
  end if;
  with ins as (
  insert into monitoring.monitors as m (owner, external_id, name, type, dob, country, threshold, last_screened_at, last_hash, last_decision, last_match_ids)
  select p_owner, r->>'external_id', r->>'name', r->>'type', r->>'dob', r->>'country', (r->>'threshold')::real, now(),
         r->>'last_hash', r->>'last_decision', coalesce(array(select jsonb_array_elements_text(r->'last_match_ids')), '{}')
  from jsonb_array_elements(p_rows) r
  on conflict (owner, external_id) do update set
    name = excluded.name, type = excluded.type, dob = excluded.dob, country = excluded.country, threshold = excluded.threshold,
    last_screened_at = excluded.last_screened_at, last_hash = excluded.last_hash, last_decision = excluded.last_decision,
    last_match_ids = excluded.last_match_ids
  returning m.*)
  select coalesce(jsonb_agg(to_jsonb(ins)), '[]'::jsonb) into v_out from ins;
  return v_out;
end $$;

create or replace function public.mon_list(p_secret text, p_owner text, p_limit int, p_offset int)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform monitoring.check_secret(p_secret);
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at, x.id), '[]'::jsonb) from (
    select * from monitoring.monitors where owner = p_owner order by created_at, id limit least(p_limit, 500) offset p_offset) x);
end $$;

create or replace function public.mon_count(p_secret text, p_owner text) returns int
language plpgsql security definer set search_path = '' as $$
begin
  perform monitoring.check_secret(p_secret);
  return (select count(*) from monitoring.monitors where owner = p_owner);
end $$;

create or replace function public.mon_get(p_secret text, p_owner text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform monitoring.check_secret(p_secret);
  return (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from monitoring.monitors x where owner = p_owner and id = p_id);
end $$;

create or replace function public.mon_delete(p_secret text, p_owner text, p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform monitoring.check_secret(p_secret);
  delete from monitoring.monitors where owner = p_owner and id = p_id;
  return found;
end $$;

-- Monitors not yet screened against the current list snapshot, oldest first.
create or replace function public.mon_due(p_secret text, p_hash text, p_limit int)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform monitoring.check_secret(p_secret);
  return (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select * from monitoring.monitors where last_hash is distinct from p_hash
    order by last_screened_at nulls first limit least(p_limit, 2000)) x);
end $$;

-- Save re-screen results and any alerts in one transaction.
create or replace function public.mon_record(p_secret text, p_updates jsonb, p_alerts jsonb) returns int
language plpgsql security definer set search_path = '' as $$
begin
  perform monitoring.check_secret(p_secret);
  update monitoring.monitors m set
    last_screened_at = now(), last_hash = u->>'last_hash', last_decision = u->>'last_decision',
    last_match_ids = coalesce(array(select jsonb_array_elements_text(u->'last_match_ids')), '{}')
  from jsonb_array_elements(p_updates) u where m.id = (u->>'id')::uuid;
  insert into monitoring.alerts (owner, monitor_id, external_id, monitored_name, kind, match, lists_version)
  select a->>'owner', (a->>'monitor_id')::uuid, a->>'external_id', a->>'monitored_name', a->>'kind', a->'match', a->>'lists_version'
  from jsonb_array_elements(p_alerts) a;
  return jsonb_array_length(p_alerts);
end $$;

create or replace function public.alerts_list(p_secret text, p_owner text, p_after bigint, p_limit int)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform monitoring.check_secret(p_secret);
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from (
    select * from monitoring.alerts where owner = p_owner and id > coalesce(p_after, 0) order by id limit least(p_limit, 500)) x);
end $$;

create or replace function public.webhook_set(p_secret text, p_owner text, p_url text, p_signing_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform monitoring.check_secret(p_secret);
  insert into monitoring.webhooks (owner, url, secret) values (p_owner, p_url, p_signing_secret)
  on conflict (owner) do update set url = excluded.url, secret = excluded.secret, updated_at = now();
end $$;

create or replace function public.webhook_get(p_secret text, p_owner text) returns table (url text, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform monitoring.check_secret(p_secret);
  return query select w.url, w.updated_at from monitoring.webhooks w where w.owner = p_owner;
end $$;

create or replace function public.webhook_delete(p_secret text, p_owner text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform monitoring.check_secret(p_secret);
  delete from monitoring.webhooks where owner = p_owner;
  return found;
end $$;

-- Undelivered alerts for owners with a webhook, with delivery details. Gives up after 6 attempts.
create or replace function public.alerts_pending(p_secret text, p_limit int)
returns table (id bigint, owner text, url text, signing_secret text, payload jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  perform monitoring.check_secret(p_secret);
  return query
  select a.id, a.owner, w.url, w.secret,
    jsonb_build_object('id', a.id, 'kind', a.kind, 'monitorId', a.monitor_id, 'externalId', a.external_id,
      'monitoredName', a.monitored_name, 'match', a.match, 'listsVersion', a.lists_version, 'createdAt', a.created_at)
  from monitoring.alerts a join monitoring.webhooks w on w.owner = a.owner
  where a.delivered_at is null and a.attempts < 6 order by a.id limit least(p_limit, 1000);
end $$;

create or replace function public.alerts_mark(p_secret text, p_ids bigint[], p_ok boolean, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform monitoring.check_secret(p_secret);
  update monitoring.alerts set attempts = attempts + 1,
    delivered_at = case when p_ok then now() else null end, last_error = case when p_ok then null else left(p_error, 500) end
  where id = any(p_ids);
end $$;

-- Only these functions are callable with the publishable key, and each one checks the secret.
do $$
declare f text;
begin
  foreach f in array array[
    'mon_add(text,text,jsonb,int)', 'mon_list(text,text,int,int)', 'mon_count(text,text)', 'mon_get(text,text,uuid)',
    'mon_delete(text,text,uuid)', 'mon_due(text,text,int)', 'mon_record(text,jsonb,jsonb)', 'alerts_list(text,text,bigint,int)',
    'webhook_set(text,text,text,text)', 'webhook_get(text,text)', 'webhook_delete(text,text)', 'alerts_pending(text,int)',
    'alerts_mark(text,bigint[],boolean,text)'] loop
    execute format('revoke all on function public.%s from public, authenticated', f);
    execute format('grant execute on function public.%s to anon', f);
  end loop;
end $$;
revoke all on function monitoring.check_secret(text) from public, anon, authenticated;
