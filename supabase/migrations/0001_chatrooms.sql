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

-- create priority enum for broadcasts
create type public.broadcast_priority as enum (
  "normal" | "urgent" | "announcement"
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

-- add priority, is_broadcast, and scheduled_at columns to messages for broadcast functionality
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS priority public.broadcast_priority DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS is_broadcast boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- Add broadcast tracking columns to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS broadcast_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS broadcast_stats jsonb;

-- Create index for faster broadcast queries
CREATE INDEX IF NOT EXISTS idx_messages_broadcast_sent 
ON public.messages(broadcast_sent_at) 
WHERE is_broadcast = true;

-- Add all new columns to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS poll_data jsonb,
ADD COLUMN IF NOT EXISTS audio_data jsonb,
ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS event_reminder_data jsonb;

-- Create event reminders table
CREATE TABLE IF NOT EXISTS public.event_reminders (
  id uuid primary key default gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users_profile(id),
  remind_at timestamptz NOT NULL,
  status text default 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  created_at timestamptz default now(),
  UNIQUE(message_id, user_id)
);

-- RLS for event reminders
ALTER TABLE public.event_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their event reminders" 
ON public.event_reminders FOR ALL
USING (auth.uid() = user_id);

-- Simple message views table for analytics
CREATE TABLE IF NOT EXISTS public.message_views (
  id uuid primary key default gen_random_uuid(),
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users_profile(id),
  session_id text, -- For anonymous tracking
  viewed_at timestamptz default now(),
  duration_seconds integer, -- How long they viewed
  content_length integer -- Length of message when viewed
);

-- Add view_count column to messages for quick access
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;

-- Create indexes
CREATE INDEX idx_message_views_message_id ON public.message_views(message_id);
CREATE INDEX idx_message_views_user_id ON public.message_views(user_id);
CREATE INDEX idx_message_views_viewed_at ON public.message_views(viewed_at);

-- Function to increment message view (bypasses RLS for inserts)
CREATE OR REPLACE FUNCTION increment_message_view(
  p_message_id uuid,
  p_duration integer
)
RETURNS void
SECURITY DEFINER -- Runs with owner privileges
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
  v_session_id text;
BEGIN
  -- Get current user ID (will be NULL if not authenticated)
  v_user_id := auth.uid();
  
  -- Generate session ID for anonymous/unauthenticated
  v_session_id := COALESCE(
    current_setting('request.headers', true)::json->>'x-session-id',
    gen_random_uuid()::text
  );
  
  -- Only increment if user is authenticated (belongs to chatroom check will happen in application)
  IF v_user_id IS NOT NULL THEN
    -- Update message view count
    UPDATE public.messages 
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = p_message_id;
    
    -- Insert view record for analytics
    INSERT INTO public.message_views (
      message_id, 
      user_id, 
      session_id,
      duration_seconds,
      content_length,
      viewed_at
    )
    SELECT 
      p_message_id, 
      v_user_id,
      v_session_id,
      p_duration,
      LENGTH(content)
    FROM public.messages 
    WHERE id = p_message_id;
  ELSE
    -- For anonymous users, just track without user_id
    INSERT INTO public.message_views (
      message_id, 
      user_id, 
      session_id,
      duration_seconds,
      content_length,
      viewed_at
    )
    SELECT 
      p_message_id, 
      NULL,
      v_session_id,
      p_duration,
      LENGTH(content)
    FROM public.messages 
    WHERE id = p_message_id;
    
    -- Still increment the view count for anonymous
    UPDATE public.messages 
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = p_message_id;
  END IF;
END;
$$;

-- Grant execute to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION increment_message_view(uuid, integer) TO authenticated, anon;

-- RLS for message views
CREATE POLICY "Anyone can insert message views" 
ON public.message_views FOR INSERT 
TO public
WITH CHECK (true);

ALTER TABLE public.message_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their message views" 
ON public.message_views FOR SELECT
USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_poll_data ON public.messages USING gin (poll_data);
CREATE INDEX IF NOT EXISTS idx_messages_audio_data ON public.messages USING gin (audio_data);
CREATE INDEX IF NOT EXISTS idx_messages_event_id ON public.messages(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_reminders_remind_at ON public.event_reminders(remind_at) WHERE status = 'pending';

-- Helper function to update poll votes (optional, for atomic updates)
CREATE OR REPLACE FUNCTION update_poll_vote(message_id uuid, option_id text, user_id uuid)
RETURNS void AS $$
DECLARE
  current_poll jsonb;
  updated_poll jsonb;
  options jsonb;
BEGIN
  -- Get current poll data
  SELECT poll_data INTO current_poll FROM public.messages WHERE id = message_id;
  
  -- Update the poll data
  UPDATE public.messages 
  SET poll_data = jsonb_set(
    jsonb_set(
      jsonb_set(
        current_poll,
        '{total_votes}',
        ((current_poll->>'total_votes')::int + 1)::text::jsonb
      ),
      '{options}',
        (SELECT jsonb_agg(
          CASE 
            WHEN opt->>'id' = option_id THEN
              jsonb_set(opt, '{vote_count}', ((opt->>'vote_count')::int + 1)::text::jsonb)
            ELSE opt
          END
        ) FROM jsonb_array_elements(current_poll->'options') AS opt)
    ),
    '{user_votes}',
    (COALESCE(current_poll->'user_votes', '[]'::jsonb) || to_jsonb(option_id))
  )
  WHERE id = message_id;
END;
$$ LANGUAGE plpgsql;

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
-- users_profile.is_wsf is also any chatroom member
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

-- Helper: check membership based on users_profile.is_wsf
-- Either they're a regular member OR they're a WSF user
create or replace function public.is_chat_member(p_chatroom_id uuid, p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.chatroom_members m
    join public.users_profile p on p.id = m.user_id
    where m.chatroom_id = p_chatroom_id
      and m.user_id = p_user_id
      and (
        m.status = 'active' OR p.is_wsf = true
      )
  );
$$;

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
