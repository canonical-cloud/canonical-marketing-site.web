-- Public intake hardening: idempotency + server-side abuse quotas.
-- This migration is additive so an already-linked development project can upgrade safely.

alter table public.public_inquiries
  add column if not exists idempotency_key uuid;

update public.public_inquiries
set idempotency_key = gen_random_uuid()
where idempotency_key is null;

alter table public.public_inquiries
  alter column idempotency_key set not null;

create unique index if not exists public_inquiries_idempotency_key_uidx
  on public.public_inquiries (idempotency_key);

create table if not exists public.public_intake_rate_limits (
  bucket_key text not null,
  bucket_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (bucket_key, bucket_start)
);

alter table public.public_intake_rate_limits enable row level security;

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
