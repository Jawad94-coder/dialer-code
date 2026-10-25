create extension if not exists pgcrypto;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  signalwire_number text not null,
  status text not null default 'Open' check (status in ('New', 'Open', 'Closed')),
  unread boolean not null default false,
  starred boolean not null default false,
  last_message_preview text not null default '',
  last_message_at timestamptz not null default now(),
  last_message_direction text check (last_message_direction in ('in', 'out')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, signalwire_number)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  signalwire_sid text unique,
  direction text not null check (direction in ('in', 'out')),
  body text not null default '',
  status text not null default 'received',
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_last_message_at_idx
  on public.conversations (last_message_at desc);
create index if not exists messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at asc);
create index if not exists messages_signalwire_sid_idx
  on public.messages (signalwire_sid)
  where signalwire_sid is not null;

alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

revoke all on public.contacts, public.conversations, public.messages from anon, authenticated;
grant all on public.contacts, public.conversations, public.messages to service_role;
grant usage on schema public to authenticated;

create or replace function public.upsert_sms_conversation(
  p_contact_id uuid,
  p_signalwire_number text,
  p_body text,
  p_direction text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_id uuid;
begin
  insert into public.conversations (
    contact_id,
    signalwire_number,
    status,
    last_message_preview,
    last_message_at,
    last_message_direction,
    unread,
    updated_at
  )
  values (
    p_contact_id,
    p_signalwire_number,
    case when p_direction = 'in' then 'New' else 'Open' end,
    p_body,
    now(),
    p_direction,
    p_direction = 'in',
    now()
  )
  on conflict (contact_id, signalwire_number) do update
    set last_message_preview = excluded.last_message_preview,
        last_message_at = excluded.last_message_at,
        last_message_direction = excluded.last_message_direction,
    unread = excluded.unread,
    updated_at = excluded.updated_at
  returning id into conversation_id;

  return conversation_id;
end;
$$;

revoke all on function public.upsert_sms_conversation(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.upsert_sms_conversation(uuid, text, text, text) to service_role;

comment on table public.contacts is 'SignalWire SMS contacts; access is through authenticated Edge Functions.';
comment on table public.conversations is 'SMS threads indexed by contact and SignalWire number.';
comment on table public.messages is 'Inbound and outbound SMS events received through verified SignalWire callbacks.';
