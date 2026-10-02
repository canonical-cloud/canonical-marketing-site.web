-- Tighten public intake data invariants and make pending-delivery retries lease-aware.

alter table public.public_inquiries
  add column if not exists updated_at timestamptz not null default now();

alter table public.public_inquiries
  drop constraint if exists public_inquiries_company_length_chk,
  add constraint public_inquiries_company_length_chk
    check (company is null or char_length(company) between 2 and 160) not valid;

alter table public.public_inquiries
  drop constraint if exists public_inquiries_name_length_chk,
  add constraint public_inquiries_name_length_chk
    check (name is null or char_length(name) between 2 and 120) not valid;

alter table public.public_inquiries
  drop constraint if exists public_inquiries_message_length_chk,
  add constraint public_inquiries_message_length_chk
    check (message is null or char_length(message) between 20 and 4000) not valid;

alter table public.public_inquiries
  drop constraint if exists public_inquiries_provider_message_id_length_chk,
  add constraint public_inquiries_provider_message_id_length_chk
    check (provider_message_id is null or char_length(provider_message_id) <= 256) not valid;

alter table public.public_inquiries
  drop constraint if exists public_inquiries_source_kind_chk,
  add constraint public_inquiries_source_kind_chk
    check (
      (kind = 'quote' and source = 'canonical.plus/quote' and quote_payload is not null and message is null)
      or
      (kind = 'contact' and source = 'canonical.plus/contact' and quote_payload is null and message is not null)
    ) not valid;

-- Constraints are intentionally added NOT VALID so an existing linked development
-- project cannot be bricked by legacy rows. PostgreSQL still enforces them for all
-- new and updated rows. After legacy-data review/backfill, validate them explicitly.

create index if not exists public_inquiries_updated_at_idx
  on public.public_inquiries (updated_at desc);

-- Bound growth of per-key quota buckets without a global table scan.
create or replace function public.consume_public_intake_quota(
  p_key text,
  p_window_seconds integer,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket timestamptz;
  v_count integer;
begin
  if p_key is null or char_length(p_key) < 16 or char_length(p_key) > 256 then
    raise exception 'invalid quota key';
  end if;
  if p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'invalid quota window';
  end if;
  if p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid quota limit';
  end if;

  delete from public.public_intake_rate_limits
  where bucket_key = p_key
    and bucket_start < clock_timestamp() - interval '2 days';

  v_bucket := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.public_intake_rate_limits (bucket_key, bucket_start, request_count)
  values (p_key, v_bucket, 1)
  on conflict (bucket_key, bucket_start)
  do update
    set request_count = public.public_intake_rate_limits.request_count + 1
    where public.public_intake_rate_limits.request_count < p_limit
  returning request_count into v_count;

  return v_count is not null;
end;
$$;

revoke all on function public.consume_public_intake_quota(text, integer, integer)
  from public, anon, authenticated;

grant execute on function public.consume_public_intake_quota(text, integer, integer)
  to service_role;
