-- Chatrooms core schema and RLS
-- Types
create type public.chatroom_type as enum (
  'wsf_fans',
  'wsf_students',
  'wsf_club_owners',
  'psa',
  'nsa',
  'wsf_committee'
);

create table if not exists public.chatrooms (
  id uuid primary key default gen_random_uuid(),
  type chatroom_type not null,
  title text not null,
  country_code text,
  visibility text not null default 'private', -- public | private
  shareable boolean not null default false,
  allow_files boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, coalesce(country_code, 'GLOBAL'))
);

create table if not exists public.chatroom_members (
  chatroom_id uuid references public.chatrooms(id) on delete cascade,
  user_id uuid references public.users_profile(id) on delete cascade,
  status text not null default 'active', -- active, pending, denied
  role text not null default 'member',   -- member, moderator, owner
  created_at timestamptz not null default now(),
  primary key (chatroom_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chatroom_id uuid references public.chatrooms(id) on delete cascade,
  user_id uuid references public.users_profile(id) on delete set null,
  content text not null,
  updated_at timestamptz,
  language text default 'en',
  translated_content jsonb, -- keyed by language code if using translation API
  file_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_chatroom_id_created_at on public.messages (chatroom_id, created_at desc);

-- RLS
alter table public.chatrooms enable row level security;
alter table public.chatroom_members enable row level security;
alter table public.messages enable row level security;

-- Helper: check membership
create or replace function public.is_chat_member(p_chatroom_id uuid, p_user_id uuid)
returns boolean
language sql
as $$
  select exists (
    select 1 from public.chatroom_members m
    where m.chatroom_id = p_chatroom_id
      and m.user_id = p_user_id
      and m.status = 'active'
  );
$$;

-- Policies: chatrooms visible to everyone (listing)
create policy "Chatrooms are readable by everyone" on public.chatrooms
  for select using (true);

-- Policies: insert/update only by service role or admins
create policy "Chatrooms insert by service role" on public.chatrooms
  for insert to authenticated
  with check (auth.role() = 'service_role');

create policy "Chatrooms update by service role" on public.chatrooms
  for update using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Members: only the user or service role can see their membership
create policy "Members read own memberships" on public.chatroom_members
  for select using (auth.uid() = user_id or auth.role() = 'service_role');

-- Members: insert/update by service role (app logic enforces eligibility)
create policy "Members insert by service role" on public.chatroom_members
  for insert to authenticated
  with check (auth.role() = 'service_role');

create policy "Members update by service role" on public.chatroom_members
  for update using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Messages read:
-- - fans chatroom: everyone (shareable/public)
-- - others: active members only
create policy "Messages read fans public" on public.messages
  for select using (
    exists (
      select 1 from public.chatrooms c
      where c.id = messages.chatroom_id and c.type = 'wsf_fans'
    )
    or public.is_chat_member(messages.chatroom_id, auth.uid())
    or auth.role() = 'service_role'
  );

-- Messages insert: active members only (or service role)
create policy "Messages insert by members" on public.messages
  for insert with check (
    public.is_chat_member(chatroom_id, auth.uid())
    or auth.role() = 'service_role'
  );

-- Messages update: author or service_role
create policy "Messages update by author" on public.messages
  for update using (
    user_id = auth.uid()
    or auth.role() = 'service_role'
  )
  with check (
    user_id = auth.uid()
    or auth.role() = 'service_role'
  );

-- Messages delete: author or service_role (extend later for moderators)
create policy "Messages delete by author" on public.messages
  for delete using (
    user_id = auth.uid()
    or auth.role() = 'service_role'
  );

-- Recommended storage buckets and policies (outline, create via Supabase storage):
-- Buckets: chat-attachments (private), chat-public (public for shareable fans posts)
-- Enforce size limits at upload time in app layer.

