-- 1. Materialized View for Leaderboards
CREATE MATERIALIZED VIEW chatroom_leaderboard AS
SELECT 
  m.chatroom_id,
  m.user_id,
  u.full_name,
  u.avatar_url,
  u.belt_level,
  u.country_code,
  COUNT(*) as message_count,
  DATE_TRUNC('day', m.created_at) as day,
  DATE_TRUNC('week', m.created_at) as week,
  'all_time' as period_type
FROM messages m
JOIN users_profile u ON m.user_id = u.id
WHERE m.created_at >= NOW() - INTERVAL '90 days' -- Limit to 90 days for performance
GROUP BY m.chatroom_id, m.user_id, u.full_name, u.avatar_url, u.belt_level, u.country_code, 
         DATE_TRUNC('day', m.created_at), DATE_TRUNC('week', m.created_at);

-- 2. Indexes for fast queries
CREATE UNIQUE INDEX idx_leaderboard_unique ON chatroom_leaderboard (chatroom_id, user_id, day, week, period_type);
CREATE INDEX idx_leaderboard_chatroom_day ON chatroom_leaderboard(chatroom_id, day DESC);
CREATE INDEX idx_leaderboard_chatroom_week ON chatroom_leaderboard(chatroom_id, week DESC);

-- 3. Function to refresh materialized view (run every 15 minutes via cron)
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY chatroom_leaderboard;
END;
$$ LANGUAGE plpgsql;

-- 4. Summary table for current week (optional, for faster queries)
CREATE TABLE leaderboard_current_week (
  id SERIAL PRIMARY KEY,
  chatroom_id UUID REFERENCES chatrooms(id),
  user_id UUID REFERENCES users_profile(id),
  week_start DATE NOT NULL,
  message_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(chatroom_id, user_id, week_start)
);

-- 5. Function to update current week counts
CREATE OR REPLACE FUNCTION update_leaderboard_current_week()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO leaderboard_current_week (chatroom_id, user_id, week_start, message_count)
  VALUES (
    NEW.chatroom_id, 
    NEW.user_id, 
    DATE_TRUNC('week', NEW.created_at)::DATE,
    1
  )
  ON CONFLICT (chatroom_id, user_id, week_start)
  DO UPDATE SET 
    message_count = leaderboard_current_week.message_count + 1,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger for real-time updates
CREATE TRIGGER update_current_week_after_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_leaderboard_current_week();