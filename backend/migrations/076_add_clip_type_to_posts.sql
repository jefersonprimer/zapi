-- Drop the old constraint
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_type_check;

-- Add the new constraint including 'clip'
ALTER TABLE posts ADD CONSTRAINT posts_type_check 
  CHECK (type IN ('text', 'image', 'video', 'poll', 'gif', 'link', 'clip'));
