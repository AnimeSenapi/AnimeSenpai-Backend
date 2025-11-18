-- Phase 2 Social Features Migration
-- Adds: ReviewLike, ReviewComment, ReviewTag, PushSubscription models
-- Updates: ActivityFeed relations

-- Review Likes Table
CREATE TABLE IF NOT EXISTS "user_data"."review_likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_likes_pkey" PRIMARY KEY ("id")
);

-- Review Comments Table
CREATE TABLE IF NOT EXISTS "user_data"."review_comments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id")
);

-- Review Tags Table
CREATE TABLE IF NOT EXISTS "user_data"."review_tags" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taggedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_tags_pkey" PRIMARY KEY ("id")
);

-- Push Subscriptions Table
CREATE TABLE IF NOT EXISTS "user_data"."push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- Create Unique Constraints
CREATE UNIQUE INDEX IF NOT EXISTS "review_likes_userId_reviewId_key" ON "user_data"."review_likes"("userId", "reviewId");
CREATE UNIQUE INDEX IF NOT EXISTS "review_tags_reviewId_userId_key" ON "user_data"."review_tags"("reviewId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key" ON "user_data"."push_subscriptions"("endpoint");

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS "review_likes_reviewId_createdAt_idx" ON "user_data"."review_likes"("reviewId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "review_likes_userId_createdAt_idx" ON "user_data"."review_likes"("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "review_comments_reviewId_createdAt_idx" ON "user_data"."review_comments"("reviewId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "review_comments_userId_createdAt_idx" ON "user_data"."review_comments"("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "review_tags_userId_createdAt_idx" ON "user_data"."review_tags"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "review_tags_reviewId_idx" ON "user_data"."review_tags"("reviewId");

CREATE INDEX IF NOT EXISTS "push_subscriptions_userId_idx" ON "user_data"."push_subscriptions"("userId");

-- Add Foreign Key Constraints
ALTER TABLE "user_data"."review_likes" 
    ADD CONSTRAINT "review_likes_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_data"."review_likes" 
    ADD CONSTRAINT "review_likes_reviewId_fkey" 
    FOREIGN KEY ("reviewId") REFERENCES "user_data"."user_anime_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_data"."review_comments" 
    ADD CONSTRAINT "review_comments_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_data"."review_comments" 
    ADD CONSTRAINT "review_comments_reviewId_fkey" 
    FOREIGN KEY ("reviewId") REFERENCES "user_data"."user_anime_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_data"."review_tags" 
    ADD CONSTRAINT "review_tags_reviewId_fkey" 
    FOREIGN KEY ("reviewId") REFERENCES "user_data"."user_anime_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_data"."review_tags" 
    ADD CONSTRAINT "review_tags_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_data"."review_tags" 
    ADD CONSTRAINT "review_tags_taggedBy_fkey" 
    FOREIGN KEY ("taggedBy") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_data"."push_subscriptions" 
    ADD CONSTRAINT "push_subscriptions_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Clean up orphaned data in activity_feed before adding foreign keys
DELETE FROM "user_data"."activity_feed" 
WHERE "userId" NOT IN (SELECT "id" FROM "auth"."users");

DELETE FROM "user_data"."activity_feed" 
WHERE "animeId" IS NOT NULL 
AND "animeId" NOT IN (SELECT "id" FROM "content"."anime");

DELETE FROM "user_data"."activity_feed" 
WHERE "targetUserId" IS NOT NULL 
AND "targetUserId" NOT IN (SELECT "id" FROM "auth"."users");

-- Update activity_feed to add foreign key constraints (if not already present)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'activity_feed_userId_fkey' 
        AND table_name = 'activity_feed'
        AND table_schema = 'user_data'
    ) THEN
        ALTER TABLE "user_data"."activity_feed" 
            ADD CONSTRAINT "activity_feed_userId_fkey" 
            FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'activity_feed_animeId_fkey' 
        AND table_name = 'activity_feed'
        AND table_schema = 'user_data'
    ) THEN
        ALTER TABLE "user_data"."activity_feed" 
            ADD CONSTRAINT "activity_feed_animeId_fkey" 
            FOREIGN KEY ("animeId") REFERENCES "content"."anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'activity_feed_targetUserId_fkey' 
        AND table_name = 'activity_feed'
        AND table_schema = 'user_data'
    ) THEN
        ALTER TABLE "user_data"."activity_feed" 
            ADD CONSTRAINT "activity_feed_targetUserId_fkey" 
            FOREIGN KEY ("targetUserId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

