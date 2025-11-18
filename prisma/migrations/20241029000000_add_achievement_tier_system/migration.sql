-- Create new achievement_tiers table
CREATE TABLE "user_data"."achievement_tiers" (
    "id" TEXT NOT NULL,
    "achievement_id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "requirement" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "achievement_tiers_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX "achievement_tiers_achievement_id_tier_key" ON "user_data"."achievement_tiers"("achievement_id", "tier");
CREATE INDEX "achievement_tiers_achievement_id_idx" ON "user_data"."achievement_tiers"("achievement_id");
CREATE INDEX "achievement_tiers_tier_idx" ON "user_data"."achievement_tiers"("tier");

-- Add foreign key constraint
ALTER TABLE "user_data"."achievement_tiers" ADD CONSTRAINT "achievement_tiers_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "user_data"."achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update achievements table to remove tier-specific fields
ALTER TABLE "user_data"."achievements" DROP COLUMN "tier";
ALTER TABLE "user_data"."achievements" DROP COLUMN "requirement";
ALTER TABLE "user_data"."achievements" DROP COLUMN "points";

-- Add new fields for base achievement info
ALTER TABLE "user_data"."achievements" ADD COLUMN "base_name" TEXT;
ALTER TABLE "user_data"."achievements" ADD COLUMN "base_description" TEXT;
ALTER TABLE "user_data"."achievements" ADD COLUMN "max_tier" INTEGER DEFAULT 1;

-- Update existing achievements to use base names
UPDATE "user_data"."achievements" SET "base_name" = "name", "base_description" = "description";

-- Make base_name and base_description NOT NULL after updating
ALTER TABLE "user_data"."achievements" ALTER COLUMN "base_name" SET NOT NULL;
ALTER TABLE "user_data"."achievements" ALTER COLUMN "base_description" SET NOT NULL;
