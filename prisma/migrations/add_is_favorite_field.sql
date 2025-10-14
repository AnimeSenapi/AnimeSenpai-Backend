-- Migration: Add isFavorite field to UserAnimeList
-- This allows users to mark anime as favorites independently of their watch status
-- Date: October 10, 2025

-- Add isFavorite column with default false
ALTER TABLE "user_data"."user_anime_lists" 
ADD COLUMN IF NOT EXISTS "isFavorite" BOOLEAN NOT NULL DEFAULT false;

-- Create index for efficient favorite queries
CREATE INDEX IF NOT EXISTS "user_anime_lists_userId_isFavorite_idx" 
ON "user_data"."user_anime_lists"("userId", "isFavorite");

-- Optional: Migrate existing 'favorite' status to isFavorite flag
-- Uncomment if you have existing data with status='favorite'
-- UPDATE "user_data"."user_anime_lists" 
-- SET "isFavorite" = true, "status" = 'plan-to-watch'
-- WHERE "status" = 'favorite';

-- Note: After running this migration, you should:
-- 1. Run: npx prisma generate
-- 2. Restart your backend server
-- 3. Test the toggleFavorite endpoint

