-- CreateTable UserPrivacySettings (if not exists)
CREATE TABLE IF NOT EXISTS "user_data"."user_privacy_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileVisibility" TEXT NOT NULL DEFAULT 'public',
    "listVisibility" TEXT NOT NULL DEFAULT 'public',
    "activityVisibility" TEXT NOT NULL DEFAULT 'public',
    "friendsVisibility" TEXT NOT NULL DEFAULT 'public',
    "reviewsVisibility" TEXT NOT NULL DEFAULT 'public',
    "hiddenAnimeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_privacy_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for UserPrivacySettings
CREATE UNIQUE INDEX IF NOT EXISTS "user_privacy_settings_userId_key" ON "user_data"."user_privacy_settings"("userId");

-- CreateTable SharedList (if not exists)
CREATE TABLE IF NOT EXISTS "user_data"."shared_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "memberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "animeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_lists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for SharedList
CREATE INDEX IF NOT EXISTS "shared_lists_ownerId_idx" ON "user_data"."shared_lists"("ownerId");
CREATE INDEX IF NOT EXISTS "shared_lists_isPublic_createdAt_idx" ON "user_data"."shared_lists"("isPublic", "createdAt" DESC);

-- CreateTable ActivityFeed (if not exists)
CREATE TABLE IF NOT EXISTS "user_data"."activity_feed" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "animeId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_feed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for ActivityFeed
CREATE INDEX IF NOT EXISTS "activity_feed_userId_createdAt_idx" ON "user_data"."activity_feed"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "activity_feed_animeId_idx" ON "user_data"."activity_feed"("animeId");

-- CreateTable Notification (if not exists)
CREATE TABLE IF NOT EXISTS "user_data"."notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for Notification
CREATE INDEX IF NOT EXISTS "notifications_userId_isRead_createdAt_idx" ON "user_data"."notifications"("userId", "isRead", "createdAt" DESC);

-- CreateTable FriendRequest (if not exists)
CREATE TABLE IF NOT EXISTS "auth"."friend_requests" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for FriendRequest
CREATE UNIQUE INDEX IF NOT EXISTS "friend_requests_senderId_receiverId_key" ON "auth"."friend_requests"("senderId", "receiverId");
CREATE INDEX IF NOT EXISTS "friend_requests_receiverId_status_idx" ON "auth"."friend_requests"("receiverId", "status");
CREATE INDEX IF NOT EXISTS "friend_requests_senderId_status_idx" ON "auth"."friend_requests"("senderId", "status");

-- CreateTable Friendship (if not exists)
CREATE TABLE IF NOT EXISTS "auth"."friendships" (
    "id" TEXT NOT NULL,
    "user1Id" TEXT NOT NULL,
    "user2Id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'accepted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for Friendship
CREATE UNIQUE INDEX IF NOT EXISTS "friendships_user1Id_user2Id_key" ON "auth"."friendships"("user1Id", "user2Id");
CREATE INDEX IF NOT EXISTS "friendships_user1Id_idx" ON "auth"."friendships"("user1Id");
CREATE INDEX IF NOT EXISTS "friendships_user2Id_idx" ON "auth"."friendships"("user2Id");

-- AlterTable Friendship: Add status field (if already exists)
ALTER TABLE "auth"."friendships" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'accepted';

-- AlterTable UserPrivacySettings: Add Phase 2/3 boolean fields
ALTER TABLE "user_data"."user_privacy_settings" ADD COLUMN IF NOT EXISTS "showAnimeList" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_data"."user_privacy_settings" ADD COLUMN IF NOT EXISTS "showReviews" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_data"."user_privacy_settings" ADD COLUMN IF NOT EXISTS "showActivity" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_data"."user_privacy_settings" ADD COLUMN IF NOT EXISTS "showFriends" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_data"."user_privacy_settings" ADD COLUMN IF NOT EXISTS "allowMessages" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_data"."user_privacy_settings" ADD COLUMN IF NOT EXISTS "allowFriendRequests" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable SharedList: Add collaborators field
ALTER TABLE "user_data"."shared_lists" ADD COLUMN IF NOT EXISTS "collaborators" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable Message
CREATE TABLE IF NOT EXISTS "user_data"."messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "animeId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable Achievement
CREATE TABLE IF NOT EXISTS "user_data"."achievements" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "requirement" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserAchievement
CREATE TABLE IF NOT EXISTS "user_data"."user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable BlockedUser
CREATE TABLE IF NOT EXISTS "auth"."blocked_users" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserReport
CREATE TABLE IF NOT EXISTS "auth"."user_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "achievements_key_key" ON "user_data"."achievements"("key");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_achievements_userId_achievementId_key" ON "user_data"."user_achievements"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "blocked_users_userId_blockedId_key" ON "auth"."blocked_users"("userId", "blockedId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_senderId_idx" ON "user_data"."messages"("senderId");
CREATE INDEX IF NOT EXISTS "messages_receiverId_idx" ON "user_data"."messages"("receiverId");
CREATE INDEX IF NOT EXISTS "messages_createdAt_idx" ON "user_data"."messages"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_achievements_userId_idx" ON "user_data"."user_achievements"("userId");
CREATE INDEX IF NOT EXISTS "user_achievements_achievementId_idx" ON "user_data"."user_achievements"("achievementId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "blocked_users_userId_idx" ON "auth"."blocked_users"("userId");
CREATE INDEX IF NOT EXISTS "blocked_users_blockedId_idx" ON "auth"."blocked_users"("blockedId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_reports_reporterId_idx" ON "auth"."user_reports"("reporterId");
CREATE INDEX IF NOT EXISTS "user_reports_reportedId_idx" ON "auth"."user_reports"("reportedId");
CREATE INDEX IF NOT EXISTS "user_reports_status_idx" ON "auth"."user_reports"("status");

-- AddForeignKey (using DO blocks for idempotency)
DO $$
BEGIN
    -- UserPrivacySettings foreign keys
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_privacy_settings_userId_fkey') THEN
        ALTER TABLE "user_data"."user_privacy_settings" ADD CONSTRAINT "user_privacy_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    -- SharedList foreign keys
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shared_lists_ownerId_fkey') THEN
        ALTER TABLE "user_data"."shared_lists" ADD CONSTRAINT "shared_lists_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    -- ActivityFeed foreign keys
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_feed_userId_fkey') THEN
        ALTER TABLE "user_data"."activity_feed" ADD CONSTRAINT "activity_feed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_feed_animeId_fkey') THEN
        ALTER TABLE "user_data"."activity_feed" ADD CONSTRAINT "activity_feed_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "content"."anime"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    -- Notification foreign keys
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_userId_fkey') THEN
        ALTER TABLE "user_data"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    -- FriendRequest foreign keys
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_senderId_fkey') THEN
        ALTER TABLE "auth"."friend_requests" ADD CONSTRAINT "friend_requests_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_receiverId_fkey') THEN
        ALTER TABLE "auth"."friend_requests" ADD CONSTRAINT "friend_requests_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    -- Friendship foreign keys
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friendships_user1Id_fkey') THEN
        ALTER TABLE "auth"."friendships" ADD CONSTRAINT "friendships_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friendships_user2Id_fkey') THEN
        ALTER TABLE "auth"."friendships" ADD CONSTRAINT "friendships_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    -- Message foreign keys
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_senderId_fkey') THEN
        ALTER TABLE "user_data"."messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_receiverId_fkey') THEN
        ALTER TABLE "user_data"."messages" ADD CONSTRAINT "messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_animeId_fkey') THEN
        ALTER TABLE "user_data"."messages" ADD CONSTRAINT "messages_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "content"."anime"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_achievements_userId_fkey') THEN
        ALTER TABLE "user_data"."user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_achievements_achievementId_fkey') THEN
        ALTER TABLE "user_data"."user_achievements" ADD CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "user_data"."achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blocked_users_userId_fkey') THEN
        ALTER TABLE "auth"."blocked_users" ADD CONSTRAINT "blocked_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blocked_users_blockedId_fkey') THEN
        ALTER TABLE "auth"."blocked_users" ADD CONSTRAINT "blocked_users_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_reports_reporterId_fkey') THEN
        ALTER TABLE "auth"."user_reports" ADD CONSTRAINT "user_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_reports_reportedId_fkey') THEN
        ALTER TABLE "auth"."user_reports" ADD CONSTRAINT "user_reports_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_reports_reviewedBy_fkey') THEN
        ALTER TABLE "auth"."user_reports" ADD CONSTRAINT "user_reports_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

