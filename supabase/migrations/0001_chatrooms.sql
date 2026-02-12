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
);

ALTER TABLE chatrooms
ADD CONSTRAINT chatrooms_type_country_unique
UNIQUE (type, country_code);

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
  user_id uuid references public.users_profile(id) not null on delete set null,
  content text not null,
  updated_at timestamptz,
  language text default 'en',
  translated_content jsonb, -- keyed by language code if using translation API
  file_url text,
  created_at timestamptz not null default now()
);

-- Note: Changed p_country_code parameter from char(2) to text to handle NULL
CREATE OR REPLACE FUNCTION get_or_create_chatroom(
  p_type chatroom_type,
  p_title text,
  p_country_code text DEFAULT NULL,  -- Changed from char(2) to text
  p_visibility text DEFAULT 'private',
  p_shareable boolean DEFAULT false,
  p_allow_files boolean DEFAULT false,
  p_created_by uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_chatroom_id uuid;
BEGIN
  -- Try to find existing chatroom
  SELECT id INTO v_chatroom_id
  FROM chatrooms
  WHERE type = p_type 
    AND country_code IS NOT DISTINCT FROM p_country_code;
  
  -- If not found, insert
  IF v_chatroom_id IS NULL THEN
    INSERT INTO chatrooms (
      type,
      title,
      country_code,
      visibility,
      shareable,
      allow_files,
      created_by
    ) VALUES (
      p_type,
      p_title,
      p_country_code,  -- Can be NULL or a 2-char code
      p_visibility,
      p_shareable,
      p_allow_files,
      p_created_by
    )
    ON CONFLICT (type, country_code) 
    DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_chatroom_id;
  END IF;
  
  RETURN v_chatroom_id;
EXCEPTION
  WHEN unique_violation THEN
    -- Race condition - try to fetch again
    SELECT id INTO v_chatroom_id
    FROM chatrooms
    WHERE type = p_type 
      AND country_code IS NOT DISTINCT FROM p_country_code;
    RETURN v_chatroom_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Messages Indexes
CREATE INDEX IF NOT EXISTS idx_messages_chatroom_created ON messages(chatroom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chatroom_user ON messages(chatroom_id, user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Add reply_is_private column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS reply_is_private boolean DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to) WHERE reply_to IS NOT NULL;

-- Add index for private replies
CREATE INDEX IF NOT EXISTS idx_messages_private_replies ON messages(reply_to, reply_is_private) 
WHERE reply_to IS NOT NULL AND reply_is_private = true;

-- Add recipient_id column for private replies
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS reply_recipient_id uuid REFERENCES public.users_profile(id) ON DELETE SET NULL;

-- Create index on recipient_id for private replies
CREATE INDEX IF NOT EXISTS idx_messages_private_recipient ON messages(reply_recipient_id) 
WHERE reply_is_private = true AND reply_recipient_id IS NOT NULL;

-- Combined index for all private reply checks
CREATE INDEX IF NOT EXISTS idx_messages_private_composite ON messages(id, user_id, reply_recipient_id) 
WHERE reply_is_private = true;

-- Function to set recipient_id automatically
CREATE OR REPLACE FUNCTION set_reply_recipient()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.reply_to IS NOT NULL AND NEW.reply_is_private = true THEN
    -- Get the user_id of the message being replied to
    SELECT user_id INTO NEW.reply_recipient_id
    FROM messages
    WHERE id = NEW.reply_to;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to automatically set recipient_id
DROP TRIGGER IF EXISTS set_reply_recipient_trigger ON messages;
CREATE TRIGGER set_reply_recipient_trigger
  BEFORE INSERT OR UPDATE OF reply_to, reply_is_private ON messages
  FOR EACH ROW
  EXECUTE FUNCTION set_reply_recipient();

-- Update existing messages
UPDATE messages m1
SET reply_recipient_id = m2.user_id
FROM messages m2
WHERE m1.reply_to = m2.id
  AND m1.reply_is_private = true
  AND m1.reply_recipient_id IS NULL;

-- Replace the policy
DROP POLICY IF EXISTS "Messages read with private reply control" ON public.messages;

-- Ultra-fast policy with denormalized data
CREATE POLICY "Messages read with private reply control" ON public.messages
FOR SELECT USING (
  CASE 
    WHEN reply_is_private = true AND reply_to IS NOT NULL THEN
      -- Single, indexed check: author OR recipient
      user_id = auth.uid() OR reply_recipient_id = auth.uid()
    ELSE
      -- Regular message: apply existing visibility rules
      (
        EXISTS (
          SELECT 1 FROM public.chatrooms c
          WHERE c.id = messages.chatroom_id AND c.type = 'wsf_fans'
        )
        OR public.is_chat_member(messages.chatroom_id, auth.uid())
      )
  END
);

-- Create a function for efficient leaderboard calculation
CREATE OR REPLACE FUNCTION get_chatroom_leaderboard(
  p_chatroom_id uuid,
  p_start_date timestamptz,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  admission_no text,
  avatar_url text,
  belt_level integer,
  country_code text,
  message_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id,
    up.full_name,
    up.admission_no,
    up.avatar_url,
    up.belt_level,
    up.country_code,
    COUNT(m.id)::bigint as message_count
  FROM messages m
  JOIN users_profile up ON m.user_id = up.id
  WHERE m.chatroom_id = p_chatroom_id
    AND m.created_at >= p_start_date
    AND (m.reply_is_private = false OR m.user_id = auth.uid() OR m.reply_recipient_id = auth.uid())
  GROUP BY up.id
  ORDER BY message_count DESC
  LIMIT p_limit;
END;
$$;
