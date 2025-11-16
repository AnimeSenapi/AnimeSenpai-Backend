-- Drop the deprecated "name" column from the auth.users table.
-- The IF EXISTS guard prevents errors if the column is already gone.
ALTER TABLE auth.users
  DROP COLUMN IF EXISTS "name";

