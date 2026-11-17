-- XRP / RLUSD payments on the XRP Ledger. Each account gets a unique destination tag; a payment to the
-- receiving address with that tag can only ever credit that account, so claims need no signature.

alter table billing.accounts add column if not exists xrpl_tag bigint unique check (xrpl_tag between 100000 and 4294967295);
alter table billing.payments add column if not exists currency text not null default 'USDC';
alter table billing.payments add column if not exists amount_raw text;

-- Returns the account's destination tag, assigning one if needed. With p_key_hash of a new key, creates the account.
create or replace function public.bill_xrpl_tag(p_secret text, p_key_hash text, p_create boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_tag bigint; v_credits bigint; v_try int := 0;
begin
  perform monitoring.check_secret(p_secret);
  if p_create then
    insert into billing.accounts (key_hash) values (p_key_hash) returning id, xrpl_tag, credits into v_id, v_tag, v_credits;
  else
    select id, xrpl_tag, credits into v_id, v_tag, v_credits from billing.accounts where key_hash = p_key_hash for update;
    if v_id is null then raise exception 'invalid_key' using errcode = 'P0001'; end if;
  end if;
  while v_tag is null loop
    v_try := v_try + 1;
    if v_try > 20 then raise exception 'tag_allocation_failed' using errcode = 'P0001'; end if;
    begin
      update billing.accounts set xrpl_tag = 100000 + floor(random() * 4294867295)::bigint where id = v_id returning xrpl_tag into v_tag;
    exception when unique_violation then v_tag := null;
    end;
  end loop;
  return jsonb_build_object('account_id', v_id, 'tag', v_tag, 'credits', v_credits);
end $$;

-- Credits a verified XRPL payment to the account owning the destination tag. Each transaction once.
create or replace function public.bill_claim_xrpl(
  p_secret text, p_payment_id text, p_tag bigint, p_tx text, p_from text, p_usd_micros bigint, p_credits bigint,
  p_currency text, p_amount_raw text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_credits bigint;
begin
  perform monitoring.check_secret(p_secret);
  if exists (select 1 from billing.payments where id = p_payment_id) then
    raise exception 'already_claimed' using errcode = 'P0001';
  end if;
  select id into v_id from billing.accounts where xrpl_tag = p_tag for update;
  if v_id is null then raise exception 'unknown_tag' using errcode = 'P0001'; end if;
  insert into billing.payments (id, account_id, chain, tx_hash, from_address, amount_usdc_micros, credits, currency, amount_raw)
  values (p_payment_id, v_id, 'xrpl', p_tx, p_from, p_usd_micros, p_credits, p_currency, p_amount_raw);
  update billing.accounts set credits = credits + p_credits, credits_purchased = credits_purchased + p_credits
  where id = v_id returning credits into v_credits;
  return jsonb_build_object('account_id', v_id, 'credits', v_credits);
end $$;

do $$
declare f text;
begin
  foreach f in array array['bill_xrpl_tag(text,text,boolean)', 'bill_claim_xrpl(text,text,bigint,text,text,bigint,bigint,text,text)'] loop
    execute format('revoke all on function public.%s from public, authenticated', f);
    execute format('grant execute on function public.%s to anon', f);
  end loop;
end $$;
