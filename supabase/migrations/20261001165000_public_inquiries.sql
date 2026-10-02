create table if not exists public.public_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('quote', 'contact')),
  email text not null check (char_length(email) between 3 and 320),
  company text,
  name text,
  topic text,
  message text,
  quote_payload jsonb,
  source text not null,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed')),
  provider_message_id text
);

alter table public.public_inquiries enable row level security;

-- No public table policy is intentional. Browser clients call the Edge Function;
-- only the service-role path may insert or update these records.

create index if not exists public_inquiries_created_at_idx on public.public_inquiries (created_at desc);
create index if not exists public_inquiries_kind_created_at_idx on public.public_inquiries (kind, created_at desc);
