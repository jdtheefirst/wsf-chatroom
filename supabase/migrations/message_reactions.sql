-- Add reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(message_id, user_id, emoji),
    CONSTRAINT emoji_length_check CHECK (char_length(emoji) <= 8);
);

-- Add reply_to field to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Add reactions_count field to messages table (cached count)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions_count JSONB DEFAULT '{}'::jsonb;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to);

-- create message_reaction policies
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions"
ON message_reactions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can add reactions as themselves"
ON message_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "Users can remove their own reactions"
ON message_reactions
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
);

-- First, check if users_profile table exists and has the right structure
-- Assuming users_profile has id as UUID primary key that references auth.users

-- Add foreign key constraint from message_reactions.user_id to users_profile.id
ALTER TABLE message_reactions 
ADD CONSTRAINT fk_message_reactions_user_id 
FOREIGN KEY (user_id) 
REFERENCES users_profile(id) 
ON DELETE CASCADE;

-- Also add an index for better performance
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);

-- 7. Create a function to update reactions_count (optional but recommended)
CREATE OR REPLACE FUNCTION update_message_reactions_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE messages 
        SET reactions_count = COALESCE(reactions_count, '{}'::jsonb) || 
            jsonb_build_object(NEW.emoji, 
                COALESCE((reactions_count->>NEW.emoji)::int, 0) + 1)
        WHERE id = NEW.message_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE messages 
        SET reactions_count = reactions_count || 
            jsonb_build_object(OLD.emoji, 
                GREATEST(COALESCE((reactions_count->>OLD.emoji)::int, 0) - 1, 0))
        WHERE id = OLD.message_id;
        
        -- Remove key if count is 0
        UPDATE messages 
        SET reactions_count = reactions_count - OLD.emoji
        WHERE id = OLD.message_id 
        AND COALESCE((reactions_count->>OLD.emoji)::int, 0) <= 0;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger to automatically update reactions_count
DROP TRIGGER IF EXISTS update_reactions_count_trigger ON message_reactions;
CREATE TRIGGER update_reactions_count_trigger
AFTER INSERT OR DELETE ON message_reactions
FOR EACH ROW
EXECUTE FUNCTION update_message_reactions_count();

-- Create this function in your database
CREATE OR REPLACE FUNCTION get_messages_with_reactions(chatroom_id_param uuid, limit_count integer)
RETURNS TABLE(
  id uuid,
  content text,
  language varchar(10),
  file_url text,
  reply_to uuid,
  created_at timestamptz,
  user_id uuid,
  user_profile jsonb,
  reactions_count jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.language,
    m.file_url,
    m.reply_to,
    m.created_at,
    m.user_id,
    jsonb_build_object(
      'id', up.id,
      'full_name', up.full_name,
      'admission_no', up.admission_no,
      'avatar_url', up.avatar_url,
      'belt_level', up.belt_level,
      'country_code', up.country_code,
      'elite_plus', up.elite_plus,
      'overall_performance', up.overall_performance,
      'completed_all_programs', up.completed_all_programs,
      'elite_plus_level', up.elite_plus_level
    ) as user,
    COALESCE(
      (
        SELECT jsonb_object_agg(emoji, count)
        FROM (
          SELECT emoji, COUNT(*) as count
          FROM message_reactions
          WHERE message_id = m.id
          GROUP BY emoji
        ) reaction_counts
      ),
      '{}'::jsonb
    ) as reactions_count
  FROM messages m
  LEFT JOIN users_profile up ON m.user_id = up.id
  WHERE m.chatroom_id = chatroom_id_param
  ORDER BY m.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;