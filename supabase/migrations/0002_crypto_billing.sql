-- Prepaid API credits bought with USDC. Same security model as 0001: private schema, RLS on with no policies,
-- access only through functions that check the shared secret in monitoring.config ('api_secret').
-- API keys are stored only as SHA-256 hashes; the plaintext key is shown to the customer once.

create schema if not exists billing;
revoke all on schema billing from public, anon, authenticated;

create table if not exists billing.accounts (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  credits bigint not null default 0 check (credits >= 0),
  credits_purchased bigint not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- One row per claimed on-chain payment; the primary key makes every transaction claimable exactly once.
create table if not exists billing.payments (
  id text primary key, -- '<chain>:<lowercase tx hash>'
  account_id uuid not null references billing.accounts (id) on delete restrict,
  chain text not null,
  tx_hash text not null,
  from_address text not null,
  amount_usdc_micros bigint not null check (amount_usdc_micros > 0),
  credits bigint not null check (credits > 0),
  created_at timestamptz not null default now()
);
create index if not exists payments_account_idx on billing.payments (account_id, created_at);

alter table billing.accounts enable row level security;
alter table billing.payments enable row level security;

-- Records a verified payment and adds credits. Creates the account (with p_new_key_hash) when p_account is null.
create or replace function public.bill_claim(
  p_secret text, p_payment_id text, p_chain text, p_tx text, p_from text, p_amount bigint, p_credits bigint,
  p_account uuid, p_new_key_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_account uuid; v_credits bigint;
begin
  perform monitoring.check_secret(p_secret);
  if exists (select 1 from billing.payments where id = p_payment_id) then
    raise exception 'already_claimed' using errcode = 'P0001';
  end if;
  if p_account is null then
    insert into billing.accounts (key_hash) values (p_new_key_hash) returning id into v_account;
  else
    select id into v_account from billing.accounts where id = p_account for update;
    if v_account is null then raise exception 'invalid_key' using errcode = 'P0001'; end if;
  end if;
  insert into billing.payments (id, account_id, chain, tx_hash, from_address, amount_usdc_micros, credits)
  values (p_payment_id, v_account, p_chain, p_tx, p_from, p_amount, p_credits);
  update billing.accounts set credits = credits + p_credits, credits_purchased = credits_purchased + p_credits
  where id = v_account returning credits into v_credits;
  return jsonb_build_object('account_id', v_account, 'credits', v_credits, 'created', p_account is null);
end $$;

-- Authenticates an API key and atomically deducts p_cost credits (0 allowed for free endpoints).
create or replace function public.bill_auth(p_secret text, p_key_hash text, p_cost int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_credits bigint;
begin
  perform monitoring.check_secret(p_secret);
  update billing.accounts set credits = credits - p_cost, last_used_at = now()
  where key_hash = p_key_hash and credits >= p_cost returning id, credits into v_id, v_credits;
  if v_id is null then
    if exists (select 1 from billing.accounts where key_hash = p_key_hash) then
      raise exception 'insufficient_credits' using errcode = 'P0001';
    end if;
    raise exception 'invalid_key' using errcode = 'P0001';
  end if;
  return jsonb_build_object('account_id', v_id, 'credits', v_credits);
end $$;

-- Extra charge for multi-item requests (batches). Negative p_cost refunds (used when a request fails).
create or replace function public.bill_adjust(p_secret text, p_account uuid, p_cost int) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_credits bigint;
begin
  perform monitoring.check_secret(p_secret);
  update billing.accounts set credits = credits - p_cost
  where id = p_account and credits - p_cost >= 0 returning credits into v_credits;
  if v_credits is null then raise exception 'insufficient_credits' using errcode = 'P0001'; end if;
  return v_credits;
end $$;

create or replace function public.bill_balance(p_secret text, p_key_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  perform monitoring.check_secret(p_secret);
  select jsonb_build_object('account_id', a.id, 'credits', a.credits, 'credits_purchased', a.credits_purchased,
    'created_at', a.created_at, 'last_used_at', a.last_used_at,
    'payments', coalesce((select jsonb_agg(jsonb_build_object('chain', p.chain, 'tx_hash', p.tx_hash, 'from_address', p.from_address,
      'amount_usdc', p.amount_usdc_micros / 1000000.0, 'credits', p.credits, 'created_at', p.created_at) order by p.created_at desc)
      from billing.payments p where p.account_id = a.id), '[]'::jsonb))
  into v from billing.accounts a where a.key_hash = p_key_hash;
  if v is null then raise exception 'invalid_key' using errcode = 'P0001'; end if;
  return v;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'bill_claim(text,text,text,text,text,bigint,bigint,uuid,text)', 'bill_auth(text,text,int)',
    'bill_adjust(text,uuid,int)', 'bill_balance(text,text)'] loop
    execute format('revoke all on function public.%s from public, authenticated', f);
    execute format('grant execute on function public.%s to anon', f);
  end loop;
end $$;
