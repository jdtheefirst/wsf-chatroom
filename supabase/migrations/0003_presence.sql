-- Create a table to track user presence more permanently
CREATE TABLE IF NOT EXISTS public.user_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  chatroom_id uuid NOT NULL REFERENCES public.chatrooms(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline')),
  last_seen timestamptz NOT NULL DEFAULT now(),
  client_info jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, chatroom_id)
);

-- Create index for faster queries
CREATE INDEX idx_user_presence_chatroom_status 
ON public.user_presence(chatroom_id, status, last_seen);

-- Function to update presence
-- Enhanced presence update function
CREATE OR REPLACE FUNCTION update_user_presence(
  p_user_id uuid,
  p_chatroom_id uuid,
  p_status text
) RETURNS void AS $$
BEGIN
  -- Update or insert presence
  INSERT INTO user_presence (user_id, chatroom_id, status, last_seen)
  VALUES (p_user_id, p_chatroom_id, p_status, now())
  ON CONFLICT (user_id, chatroom_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    last_seen = EXCLUDED.last_seen,
    updated_at = now();
  
  -- Clean up old presence entries (older than 1 day)
  DELETE FROM user_presence 
  WHERE last_seen < now() - interval '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS for user_presence
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Allow users to see presence for chatrooms they have access to
CREATE POLICY "Users can view presence in accessible chatrooms" 
ON user_presence
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chatrooms c
    LEFT JOIN chatroom_members cm ON cm.chatroom_id = c.id AND cm.user_id = auth.uid()
    WHERE c.id = user_presence.chatroom_id
    AND (c.type = 'wsf_fans' OR cm.user_id = auth.uid())
  )
);

-- Allow users to update their own presence
CREATE POLICY "Users can update own presence" 
ON user_presence
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());