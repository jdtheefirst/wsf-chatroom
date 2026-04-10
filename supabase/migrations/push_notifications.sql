-- Create push_subscriptions table
CREATE TABLE
    push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW (),
        updated_at TIMESTAMPTZ DEFAULT NOW ()
    );

-- Create index for faster lookups
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions (user_id);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own subscriptions" ON push_subscriptions FOR
SELECT
    USING (auth.uid () = user_id);

CREATE POLICY "Users can insert their own subscriptions" ON push_subscriptions FOR INSERT
WITH
    CHECK (auth.uid () = user_id);

CREATE POLICY "Users can update their own subscriptions" ON push_subscriptions FOR
UPDATE USING (auth.uid () = user_id);

CREATE POLICY "Users can delete their own subscriptions" ON push_subscriptions FOR DELETE USING (auth.uid () = user_id);

-- Create table to track last read per user per chatroom
CREATE TABLE
    user_chatroom_last_read (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
        chatroom_id UUID REFERENCES chatrooms (id) ON DELETE CASCADE,
        last_read_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW (),
        updated_at TIMESTAMPTZ DEFAULT NOW (),
        UNIQUE (user_id, chatroom_id)
    );

-- Create indexes for performance
CREATE INDEX idx_user_chatroom_last_read_user ON user_chatroom_last_read (user_id);

CREATE INDEX idx_user_chatroom_last_read_chatroom ON user_chatroom_last_read (chatroom_id);

-- Enable RLS
ALTER TABLE user_chatroom_last_read ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own last read timestamps" ON user_chatroom_last_read FOR
SELECT
    USING (auth.uid () = user_id);

CREATE POLICY "Users can insert their own last read timestamps" ON user_chatroom_last_read FOR INSERT
WITH
    CHECK (auth.uid () = user_id);

CREATE POLICY "Users can update their own last read timestamps" ON user_chatroom_last_read FOR
UPDATE USING (auth.uid () = user_id);