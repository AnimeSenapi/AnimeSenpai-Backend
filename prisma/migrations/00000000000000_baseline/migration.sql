-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auth";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "content";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "user_data";

-- CreateTable
CREATE TABLE "auth"."feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."follows" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."friend_requests" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."friendships" (
    "id" TEXT NOT NULL,
    "user1Id" TEXT NOT NULL,
    "user2Id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'accepted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."security_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventData" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."security_logs" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "userId" TEXT,
    "username" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."system_settings" (
    "id" TEXT NOT NULL,
    "siteName" TEXT NOT NULL DEFAULT 'AnimeSenpai',
    "siteDescription" TEXT NOT NULL DEFAULT 'Track, discover, and explore your favorite anime',
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT,
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT true,
    "maxUploadSize" INTEGER NOT NULL DEFAULT 5242880,
    "rateLimit" INTEGER NOT NULL DEFAULT 100,
    "sessionTimeout" INTEGER NOT NULL DEFAULT 86400,
    "maxUserListItems" INTEGER NOT NULL DEFAULT 5000,
    "enableRecommendations" BOOLEAN NOT NULL DEFAULT true,
    "enableSocialFeatures" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."two_factor_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "profileVisibility" TEXT NOT NULL DEFAULT 'public',
    "showWatchHistory" BOOLEAN NOT NULL DEFAULT true,
    "showFavorites" BOOLEAN NOT NULL DEFAULT true,
    "showRatings" BOOLEAN NOT NULL DEFAULT true,
    "autoplay" BOOLEAN NOT NULL DEFAULT true,
    "quality" TEXT NOT NULL DEFAULT 'auto',
    "subtitles" BOOLEAN NOT NULL DEFAULT true,
    "subtitleLanguage" TEXT NOT NULL DEFAULT 'en',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "favoriteGenres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "favoriteTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "discoveryMode" TEXT NOT NULL DEFAULT 'balanced',
    "useWatchHistory" BOOLEAN NOT NULL DEFAULT true,
    "useRatings" BOOLEAN NOT NULL DEFAULT true,
    "useSearchHistory" BOOLEAN NOT NULL DEFAULT true,
    "useBrowsingPatterns" BOOLEAN NOT NULL DEFAULT true,
    "shareDataForRecommendations" BOOLEAN NOT NULL DEFAULT true,
    "showActivityFeed" BOOLEAN NOT NULL DEFAULT true,
    "showFollowersCount" BOOLEAN NOT NULL DEFAULT true,
    "allowFollowers" BOOLEAN NOT NULL DEFAULT true,
    "activityPrivacy" TEXT NOT NULL DEFAULT 'friends',
    "notifyOnFollow" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnFriendActivity" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "deviceInfo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "bio" TEXT,
    "primaryRoleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "password" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "emailVerificationToken" TEXT,
    "emailVerificationExpires" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "gdprConsent" BOOLEAN NOT NULL DEFAULT false,
    "gdprConsentAt" TIMESTAMP(3),
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "marketingConsentAt" TIMESTAMP(3),
    "dataProcessingConsent" BOOLEAN NOT NULL DEFAULT false,
    "dataProcessingConsentAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."anime" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEnglish" TEXT,
    "titleJapanese" TEXT,
    "titleSynonyms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT,
    "status" TEXT NOT NULL,
    "airing" BOOLEAN NOT NULL DEFAULT false,
    "episodes" INTEGER,
    "duration" TEXT,
    "aired" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "season" TEXT,
    "year" INTEGER,
    "broadcast" TEXT,
    "rating" TEXT,
    "averageRating" DOUBLE PRECISION DEFAULT 0,
    "scoredBy" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "popularity" INTEGER,
    "members" INTEGER NOT NULL DEFAULT 0,
    "favorites" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "synopsis" TEXT,
    "background" TEXT,
    "producers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "licensors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "studios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "themes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "demographics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "studio" TEXT,
    "coverImage" TEXT,
    "bannerImage" TEXT,
    "trailer" TEXT,
    "trailerUrl" TEXT,
    "externalLinks" JSONB,
    "malId" INTEGER,
    "anilistId" INTEGER,
    "kitsuId" INTEGER,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."anime_characters" (
    "id" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "favorites" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anime_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."anime_embeddings" (
    "id" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "descriptionVector" TEXT,
    "genreVector" TEXT,
    "combinedVector" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anime_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."anime_genres" (
    "animeId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,

    CONSTRAINT "anime_genres_pkey" PRIMARY KEY ("animeId","genreId")
);

-- CreateTable
CREATE TABLE "content"."anime_streaming_platforms" (
    "animeId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anime_streaming_platforms_pkey" PRIMARY KEY ("animeId","platformId")
);

-- CreateTable
CREATE TABLE "content"."anime_themes" (
    "id" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" INTEGER,
    "name" TEXT NOT NULL,
    "artist" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anime_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."character_voice_actors" (
    "id" TEXT NOT NULL,
    "animeCharacterId" TEXT NOT NULL,
    "voiceActorId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'Japanese',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_voice_actors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."characters" (
    "id" TEXT NOT NULL,
    "malId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameKanji" TEXT,
    "imageUrl" TEXT,
    "description" TEXT,
    "favorites" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."genres" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."related_anime" (
    "id" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "relatedId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "related_anime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."streaming_platforms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "baseUrl" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streaming_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."voice_actors" (
    "id" TEXT NOT NULL,
    "malId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "language" TEXT NOT NULL DEFAULT 'Japanese',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_actors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."achievement_tiers" (
    "id" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "requirement" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."achievements" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "baseName" TEXT NOT NULL,
    "baseDescription" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "maxTier" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."activity_feed" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "animeId" TEXT,
    "targetUserId" TEXT,
    "metadata" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."analytics_events" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "properties" JSONB,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "url" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "viewport" JSONB,
    "referrer" TEXT,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."analytics_sessions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "lastActivity" TIMESTAMP(3) NOT NULL,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "events" INTEGER NOT NULL DEFAULT 0,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,

    CONSTRAINT "analytics_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."anime_analytics" (
    "id" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "favorites" INTEGER NOT NULL DEFAULT 0,
    "firstInteraction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInteraction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anime_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."blocked_users" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."feature_analytics" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "firstUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "animeId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "type" TEXT NOT NULL,
    "animeId" TEXT,
    "relatedId" TEXT,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."recommendation_feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "feedbackType" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."review_comments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."review_likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."review_tags" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taggedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."search_analytics" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "totalResults" INTEGER NOT NULL DEFAULT 0,
    "firstSearched" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSearched" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filters" JSONB,

    CONSTRAINT "search_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."shared_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "memberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "collaborators" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "animeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."user_action_analytics" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "firstAction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_action_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."user_anime_lists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_anime_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."user_anime_ratings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_anime_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."user_anime_reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "isSpoiler" BOOLEAN NOT NULL DEFAULT false,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "dislikes" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_anime_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."user_interactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "animeId" TEXT,
    "actionType" TEXT NOT NULL,
    "metadata" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."user_privacy_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileVisibility" TEXT NOT NULL DEFAULT 'public',
    "listVisibility" TEXT NOT NULL DEFAULT 'public',
    "activityVisibility" TEXT NOT NULL DEFAULT 'public',
    "friendsVisibility" TEXT NOT NULL DEFAULT 'public',
    "reviewsVisibility" TEXT NOT NULL DEFAULT 'public',
    "hiddenAnimeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "showAnimeList" BOOLEAN NOT NULL DEFAULT true,
    "showReviews" BOOLEAN NOT NULL DEFAULT true,
    "showActivity" BOOLEAN NOT NULL DEFAULT true,
    "showFriends" BOOLEAN NOT NULL DEFAULT true,
    "allowMessages" BOOLEAN NOT NULL DEFAULT true,
    "allowFriendRequests" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_privacy_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data"."user_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feature_flags_enabled_idx" ON "auth"."feature_flags"("enabled" ASC);

-- CreateIndex
CREATE INDEX "feature_flags_key_idx" ON "auth"."feature_flags"("key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "auth"."feature_flags"("key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "follows_followerId_followingId_key" ON "auth"."follows"("followerId" ASC, "followingId" ASC);

-- CreateIndex
CREATE INDEX "follows_followerId_idx" ON "auth"."follows"("followerId" ASC);

-- CreateIndex
CREATE INDEX "follows_followingId_idx" ON "auth"."follows"("followingId" ASC);

-- CreateIndex
CREATE INDEX "friend_requests_receiverId_status_idx" ON "auth"."friend_requests"("receiverId" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "friend_requests_senderId_receiverId_key" ON "auth"."friend_requests"("senderId" ASC, "receiverId" ASC);

-- CreateIndex
CREATE INDEX "friend_requests_senderId_status_idx" ON "auth"."friend_requests"("senderId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "friendships_user1Id_idx" ON "auth"."friendships"("user1Id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "friendships_user1Id_user2Id_key" ON "auth"."friendships"("user1Id" ASC, "user2Id" ASC);

-- CreateIndex
CREATE INDEX "friendships_user2Id_idx" ON "auth"."friendships"("user2Id" ASC);

-- CreateIndex
CREATE INDEX "permissions_category_idx" ON "auth"."permissions"("category" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "auth"."permissions"("key" ASC);

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "auth"."role_permissions"("permissionId" ASC);

-- CreateIndex
CREATE INDEX "role_permissions_roleId_idx" ON "auth"."role_permissions"("roleId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "auth"."role_permissions"("roleId" ASC, "permissionId" ASC);

-- CreateIndex
CREATE INDEX "roles_isSystem_idx" ON "auth"."roles"("isSystem" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "auth"."roles"("name" ASC);

-- CreateIndex
CREATE INDEX "roles_priority_idx" ON "auth"."roles"("priority" ASC);

-- CreateIndex
CREATE INDEX "security_events_eventType_createdAt_idx" ON "auth"."security_events"("eventType" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "security_events_ipAddress_createdAt_idx" ON "auth"."security_events"("ipAddress" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "security_events_userId_createdAt_idx" ON "auth"."security_events"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "security_logs_event_timestamp_idx" ON "auth"."security_logs"("event" ASC, "timestamp" DESC);

-- CreateIndex
CREATE INDEX "security_logs_severity_timestamp_idx" ON "auth"."security_logs"("severity" ASC, "timestamp" DESC);

-- CreateIndex
CREATE INDEX "security_logs_timestamp_idx" ON "auth"."security_logs"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "security_logs_userId_timestamp_idx" ON "auth"."security_logs"("userId" ASC, "timestamp" DESC);

-- CreateIndex
CREATE INDEX "two_factor_codes_code_used_expiresAt_idx" ON "auth"."two_factor_codes"("code" ASC, "used" ASC, "expiresAt" ASC);

-- CreateIndex
CREATE INDEX "two_factor_codes_userId_createdAt_idx" ON "auth"."two_factor_codes"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "auth"."user_preferences"("userId" ASC);

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "auth"."user_roles"("roleId" ASC);

-- CreateIndex
CREATE INDEX "user_roles_userId_idx" ON "auth"."user_roles"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "auth"."user_roles"("userId" ASC, "roleId" ASC);

-- CreateIndex
CREATE INDEX "user_sessions_expiresAt_idx" ON "auth"."user_sessions"("expiresAt" ASC);

-- CreateIndex
CREATE INDEX "user_sessions_refreshToken_idx" ON "auth"."user_sessions"("refreshToken" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refreshToken_key" ON "auth"."user_sessions"("refreshToken" ASC);

-- CreateIndex
CREATE INDEX "user_sessions_userId_isActive_idx" ON "auth"."user_sessions"("userId" ASC, "isActive" ASC);

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "auth"."users"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "users_emailVerificationToken_idx" ON "auth"."users"("emailVerificationToken" ASC);

-- CreateIndex
CREATE INDEX "users_email_idx" ON "auth"."users"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "auth"."users"("email" ASC);

-- CreateIndex
CREATE INDEX "users_lastLoginAt_idx" ON "auth"."users"("lastLoginAt" ASC);

-- CreateIndex
CREATE INDEX "users_passwordResetToken_idx" ON "auth"."users"("passwordResetToken" ASC);

-- CreateIndex
CREATE INDEX "users_primaryRoleId_idx" ON "auth"."users"("primaryRoleId" ASC);

-- CreateIndex
CREATE INDEX "users_username_idx" ON "auth"."users"("username" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "auth"."users"("username" ASC);

-- CreateIndex
CREATE INDEX "anime_airing_idx" ON "content"."anime"("airing" ASC);

-- CreateIndex
CREATE INDEX "anime_anilistId_idx" ON "content"."anime"("anilistId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "anime_anilistId_key" ON "content"."anime"("anilistId" ASC);

-- CreateIndex
CREATE INDEX "anime_averageRating_idx" ON "content"."anime"("averageRating" DESC);

-- CreateIndex
CREATE INDEX "anime_createdAt_idx" ON "content"."anime"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "anime_kitsuId_key" ON "content"."anime"("kitsuId" ASC);

-- CreateIndex
CREATE INDEX "anime_malId_idx" ON "content"."anime"("malId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "anime_malId_key" ON "content"."anime"("malId" ASC);

-- CreateIndex
CREATE INDEX "anime_popularity_idx" ON "content"."anime"("popularity" ASC);

-- CreateIndex
CREATE INDEX "anime_rank_idx" ON "content"."anime"("rank" ASC);

-- CreateIndex
CREATE INDEX "anime_slug_idx" ON "content"."anime"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "anime_slug_key" ON "content"."anime"("slug" ASC);

-- CreateIndex
CREATE INDEX "anime_status_averageRating_idx" ON "content"."anime"("status" ASC, "averageRating" DESC);

-- CreateIndex
CREATE INDEX "anime_status_type_idx" ON "content"."anime"("status" ASC, "type" ASC);

-- CreateIndex
CREATE INDEX "anime_status_year_idx" ON "content"."anime"("status" ASC, "year" DESC);

-- CreateIndex
CREATE INDEX "anime_titleEnglish_idx" ON "content"."anime"("titleEnglish" ASC);

-- CreateIndex
CREATE INDEX "anime_title_idx" ON "content"."anime"("title" ASC);

-- CreateIndex
CREATE INDEX "anime_type_averageRating_idx" ON "content"."anime"("type" ASC, "averageRating" DESC);

-- CreateIndex
CREATE INDEX "anime_viewCount_averageRating_idx" ON "content"."anime"("viewCount" DESC, "averageRating" DESC);

-- CreateIndex
CREATE INDEX "anime_viewCount_idx" ON "content"."anime"("viewCount" DESC);

-- CreateIndex
CREATE INDEX "anime_year_averageRating_idx" ON "content"."anime"("year" DESC, "averageRating" DESC);

-- CreateIndex
CREATE INDEX "anime_year_season_idx" ON "content"."anime"("year" ASC, "season" ASC);

-- CreateIndex
CREATE INDEX "anime_characters_animeId_idx" ON "content"."anime_characters"("animeId" ASC);

-- CreateIndex
CREATE INDEX "anime_characters_characterId_idx" ON "content"."anime_characters"("characterId" ASC);

-- CreateIndex
CREATE INDEX "anime_embeddings_animeId_idx" ON "content"."anime_embeddings"("animeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "anime_embeddings_animeId_key" ON "content"."anime_embeddings"("animeId" ASC);

-- CreateIndex
CREATE INDEX "anime_genres_genreId_animeId_idx" ON "content"."anime_genres"("genreId" ASC, "animeId" ASC);

-- CreateIndex
CREATE INDEX "anime_streaming_platforms_platformId_animeId_idx" ON "content"."anime_streaming_platforms"("platformId" ASC, "animeId" ASC);

-- CreateIndex
CREATE INDEX "anime_themes_animeId_idx" ON "content"."anime_themes"("animeId" ASC);

-- CreateIndex
CREATE INDEX "character_voice_actors_animeCharacterId_idx" ON "content"."character_voice_actors"("animeCharacterId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "character_voice_actors_animeCharacterId_voiceActorId_langua_key" ON "content"."character_voice_actors"("animeCharacterId" ASC, "voiceActorId" ASC, "language" ASC);

-- CreateIndex
CREATE INDEX "character_voice_actors_voiceActorId_idx" ON "content"."character_voice_actors"("voiceActorId" ASC);

-- CreateIndex
CREATE INDEX "characters_malId_idx" ON "content"."characters"("malId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "characters_malId_key" ON "content"."characters"("malId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "genres_name_key" ON "content"."genres"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "content"."genres"("slug" ASC);

-- CreateIndex
CREATE INDEX "related_anime_animeId_idx" ON "content"."related_anime"("animeId" ASC);

-- CreateIndex
CREATE INDEX "related_anime_relatedId_idx" ON "content"."related_anime"("relatedId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "streaming_platforms_name_key" ON "content"."streaming_platforms"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "streaming_platforms_slug_key" ON "content"."streaming_platforms"("slug" ASC);

-- CreateIndex
CREATE INDEX "voice_actors_malId_idx" ON "content"."voice_actors"("malId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "voice_actors_malId_key" ON "content"."voice_actors"("malId" ASC);

-- CreateIndex
CREATE INDEX "achievement_tiers_achievementId_idx" ON "user_data"."achievement_tiers"("achievementId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "achievement_tiers_achievementId_tier_key" ON "user_data"."achievement_tiers"("achievementId" ASC, "tier" ASC);

-- CreateIndex
CREATE INDEX "achievement_tiers_tier_idx" ON "user_data"."achievement_tiers"("tier" ASC);

-- CreateIndex
CREATE INDEX "achievements_category_idx" ON "user_data"."achievements"("category" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "achievements_key_key" ON "user_data"."achievements"("key" ASC);

-- CreateIndex
CREATE INDEX "activity_feed_activityType_createdAt_idx" ON "user_data"."activity_feed"("activityType" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_feed_isPublic_createdAt_idx" ON "user_data"."activity_feed"("isPublic" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_feed_userId_createdAt_idx" ON "user_data"."activity_feed"("userId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "analytics_events_event_idx" ON "user_data"."analytics_events"("event" ASC);

-- CreateIndex
CREATE INDEX "analytics_events_sessionId_idx" ON "user_data"."analytics_events"("sessionId" ASC);

-- CreateIndex
CREATE INDEX "analytics_events_timestamp_idx" ON "user_data"."analytics_events"("timestamp" ASC);

-- CreateIndex
CREATE INDEX "analytics_events_userId_idx" ON "user_data"."analytics_events"("userId" ASC);

-- CreateIndex
CREATE INDEX "analytics_sessions_lastActivity_idx" ON "user_data"."analytics_sessions"("lastActivity" ASC);

-- CreateIndex
CREATE INDEX "analytics_sessions_sessionId_idx" ON "user_data"."analytics_sessions"("sessionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_sessions_sessionId_key" ON "user_data"."analytics_sessions"("sessionId" ASC);

-- CreateIndex
CREATE INDEX "analytics_sessions_userId_idx" ON "user_data"."analytics_sessions"("userId" ASC);

-- CreateIndex
CREATE INDEX "anime_analytics_animeId_idx" ON "user_data"."anime_analytics"("animeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "anime_analytics_animeId_key" ON "user_data"."anime_analytics"("animeId" ASC);

-- CreateIndex
CREATE INDEX "anime_analytics_lastInteraction_idx" ON "user_data"."anime_analytics"("lastInteraction" ASC);

-- CreateIndex
CREATE INDEX "anime_analytics_likes_idx" ON "user_data"."anime_analytics"("likes" ASC);

-- CreateIndex
CREATE INDEX "anime_analytics_views_idx" ON "user_data"."anime_analytics"("views" ASC);

-- CreateIndex
CREATE INDEX "blocked_users_blockedId_idx" ON "user_data"."blocked_users"("blockedId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "blocked_users_userId_blockedId_key" ON "user_data"."blocked_users"("userId" ASC, "blockedId" ASC);

-- CreateIndex
CREATE INDEX "blocked_users_userId_idx" ON "user_data"."blocked_users"("userId" ASC);

-- CreateIndex
CREATE INDEX "feature_analytics_feature_idx" ON "user_data"."feature_analytics"("feature" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "feature_analytics_feature_key" ON "user_data"."feature_analytics"("feature" ASC);

-- CreateIndex
CREATE INDEX "feature_analytics_lastUsed_idx" ON "user_data"."feature_analytics"("lastUsed" ASC);

-- CreateIndex
CREATE INDEX "feature_analytics_usageCount_idx" ON "user_data"."feature_analytics"("usageCount" ASC);

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "user_data"."messages"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "messages_receiverId_isRead_idx" ON "user_data"."messages"("receiverId" ASC, "isRead" ASC);

-- CreateIndex
CREATE INDEX "messages_senderId_receiverId_createdAt_idx" ON "user_data"."messages"("senderId" ASC, "receiverId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_type_createdAt_idx" ON "user_data"."notifications"("type" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "user_data"."notifications"("userId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "user_data"."notifications"("userId" ASC, "isRead" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "user_data"."push_subscriptions"("endpoint" ASC);

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "user_data"."push_subscriptions"("userId" ASC);

-- CreateIndex
CREATE INDEX "recommendation_feedback_animeId_idx" ON "user_data"."recommendation_feedback"("animeId" ASC);

-- CreateIndex
CREATE INDEX "recommendation_feedback_feedbackType_idx" ON "user_data"."recommendation_feedback"("feedbackType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_feedback_userId_animeId_key" ON "user_data"."recommendation_feedback"("userId" ASC, "animeId" ASC);

-- CreateIndex
CREATE INDEX "recommendation_feedback_userId_idx" ON "user_data"."recommendation_feedback"("userId" ASC);

-- CreateIndex
CREATE INDEX "review_comments_reviewId_createdAt_idx" ON "user_data"."review_comments"("reviewId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "review_comments_userId_createdAt_idx" ON "user_data"."review_comments"("userId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "review_likes_reviewId_createdAt_idx" ON "user_data"."review_likes"("reviewId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "review_likes_userId_createdAt_idx" ON "user_data"."review_likes"("userId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "review_likes_userId_reviewId_key" ON "user_data"."review_likes"("userId" ASC, "reviewId" ASC);

-- CreateIndex
CREATE INDEX "review_tags_reviewId_idx" ON "user_data"."review_tags"("reviewId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "review_tags_reviewId_userId_key" ON "user_data"."review_tags"("reviewId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "review_tags_userId_createdAt_idx" ON "user_data"."review_tags"("userId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "search_analytics_count_idx" ON "user_data"."search_analytics"("count" ASC);

-- CreateIndex
CREATE INDEX "search_analytics_lastSearched_idx" ON "user_data"."search_analytics"("lastSearched" ASC);

-- CreateIndex
CREATE INDEX "search_analytics_query_idx" ON "user_data"."search_analytics"("query" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "search_analytics_query_key" ON "user_data"."search_analytics"("query" ASC);

-- CreateIndex
CREATE INDEX "shared_lists_isPublic_createdAt_idx" ON "user_data"."shared_lists"("isPublic" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "shared_lists_ownerId_idx" ON "user_data"."shared_lists"("ownerId" ASC);

-- CreateIndex
CREATE INDEX "user_achievements_achievementId_idx" ON "user_data"."user_achievements"("achievementId" ASC);

-- CreateIndex
CREATE INDEX "user_achievements_tierId_idx" ON "user_data"."user_achievements"("tierId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_userId_tierId_key" ON "user_data"."user_achievements"("userId" ASC, "tierId" ASC);

-- CreateIndex
CREATE INDEX "user_achievements_userId_unlockedAt_idx" ON "user_data"."user_achievements"("userId" ASC, "unlockedAt" DESC);

-- CreateIndex
CREATE INDEX "user_action_analytics_action_idx" ON "user_data"."user_action_analytics"("action" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_action_analytics_action_key" ON "user_data"."user_action_analytics"("action" ASC);

-- CreateIndex
CREATE INDEX "user_action_analytics_count_idx" ON "user_data"."user_action_analytics"("count" ASC);

-- CreateIndex
CREATE INDEX "user_action_analytics_lastAction_idx" ON "user_data"."user_action_analytics"("lastAction" ASC);

-- CreateIndex
CREATE INDEX "user_anime_lists_animeId_userId_idx" ON "user_data"."user_anime_lists"("animeId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "user_anime_lists_status_updatedAt_idx" ON "user_data"."user_anime_lists"("status" ASC, "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_anime_lists_userId_animeId_key" ON "user_data"."user_anime_lists"("userId" ASC, "animeId" ASC);

-- CreateIndex
CREATE INDEX "user_anime_lists_userId_isFavorite_idx" ON "user_data"."user_anime_lists"("userId" ASC, "isFavorite" ASC);

-- CreateIndex
CREATE INDEX "user_anime_lists_userId_status_idx" ON "user_data"."user_anime_lists"("userId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "user_anime_lists_userId_updatedAt_idx" ON "user_data"."user_anime_lists"("userId" ASC, "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "user_anime_ratings_animeId_score_idx" ON "user_data"."user_anime_ratings"("animeId" ASC, "score" DESC);

-- CreateIndex
CREATE INDEX "user_anime_ratings_score_createdAt_idx" ON "user_data"."user_anime_ratings"("score" DESC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_anime_ratings_userId_animeId_key" ON "user_data"."user_anime_ratings"("userId" ASC, "animeId" ASC);

-- CreateIndex
CREATE INDEX "user_anime_ratings_userId_createdAt_idx" ON "user_data"."user_anime_ratings"("userId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "user_anime_reviews_animeId_isPublic_likes_idx" ON "user_data"."user_anime_reviews"("animeId" ASC, "isPublic" ASC, "likes" DESC);

-- CreateIndex
CREATE INDEX "user_anime_reviews_isPublic_createdAt_idx" ON "user_data"."user_anime_reviews"("isPublic" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "user_anime_reviews_likes_idx" ON "user_data"."user_anime_reviews"("likes" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_anime_reviews_userId_animeId_key" ON "user_data"."user_anime_reviews"("userId" ASC, "animeId" ASC);

-- CreateIndex
CREATE INDEX "user_anime_reviews_userId_createdAt_idx" ON "user_data"."user_anime_reviews"("userId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "user_interactions_actionType_idx" ON "user_data"."user_interactions"("actionType" ASC);

-- CreateIndex
CREATE INDEX "user_interactions_animeId_idx" ON "user_data"."user_interactions"("animeId" ASC);

-- CreateIndex
CREATE INDEX "user_interactions_userId_createdAt_idx" ON "user_data"."user_interactions"("userId" ASC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_privacy_settings_userId_key" ON "user_data"."user_privacy_settings"("userId" ASC);

-- CreateIndex
CREATE INDEX "user_reports_reportedId_status_idx" ON "user_data"."user_reports"("reportedId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "user_reports_reporterId_idx" ON "user_data"."user_reports"("reporterId" ASC);

-- CreateIndex
CREATE INDEX "user_reports_status_createdAt_idx" ON "user_data"."user_reports"("status" ASC, "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "auth"."follows" ADD CONSTRAINT "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."follows" ADD CONSTRAINT "follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."friend_requests" ADD CONSTRAINT "friend_requests_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."friend_requests" ADD CONSTRAINT "friend_requests_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."friendships" ADD CONSTRAINT "friendships_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."friendships" ADD CONSTRAINT "friendships_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "auth"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "auth"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."security_events" ADD CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."two_factor_codes" ADD CONSTRAINT "two_factor_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "auth"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."users" ADD CONSTRAINT "users_primaryRoleId_fkey" FOREIGN KEY ("primaryRoleId") REFERENCES "auth"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."anime_characters" ADD CONSTRAINT "anime_characters_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "content"."anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."anime_characters" ADD CONSTRAINT "anime_characters_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "content"."characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."anime_genres" ADD CONSTRAINT "anime_genres_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "content"."anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."anime_genres" ADD CONSTRAINT "anime_genres_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "content"."genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."anime_streaming_platforms" ADD CONSTRAINT "anime_streaming_platforms_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "content"."anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."anime_streaming_platforms" ADD CONSTRAINT "anime_streaming_platforms_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "content"."streaming_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."anime_themes" ADD CONSTRAINT "anime_themes_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "content"."anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."character_voice_actors" ADD CONSTRAINT "character_voice_actors_animeCharacterId_fkey" FOREIGN KEY ("animeCharacterId") REFERENCES "content"."anime_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."character_voice_actors" ADD CONSTRAINT "character_voice_actors_voiceActorId_fkey" FOREIGN KEY ("voiceActorId") REFERENCES "content"."voice_actors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."related_anime" ADD CONSTRAINT "related_anime_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "content"."anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."related_anime" ADD CONSTRAINT "related_anime_relatedId_fkey" FOREIGN KEY ("relatedId") REFERENCES "content"."anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."achievement_tiers" ADD CONSTRAINT "achievement_tiers_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "user_data"."achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."activity_feed" ADD CONSTRAINT "activity_feed_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "content"."anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."activity_feed" ADD CONSTRAINT "activity_feed_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."activity_feed" ADD CONSTRAINT "activity_feed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."blocked_users" ADD CONSTRAINT "blocked_users_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."blocked_users" ADD CONSTRAINT "blocked_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."messages" ADD CONSTRAINT "messages_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "content"."anime"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."messages" ADD CONSTRAINT "messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."review_comments" ADD CONSTRAINT "review_comments_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "user_data"."user_anime_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."review_comments" ADD CONSTRAINT "review_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."review_likes" ADD CONSTRAINT "review_likes_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "user_data"."user_anime_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."review_likes" ADD CONSTRAINT "review_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."review_tags" ADD CONSTRAINT "review_tags_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "user_data"."user_anime_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."review_tags" ADD CONSTRAINT "review_tags_taggedBy_fkey" FOREIGN KEY ("taggedBy") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."review_tags" ADD CONSTRAINT "review_tags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."shared_lists" ADD CONSTRAINT "shared_lists_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."user_achievements" ADD CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "user_data"."achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."user_achievements" ADD CONSTRAINT "user_achievements_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "user_data"."achievement_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."user_anime_reviews" ADD CONSTRAINT "user_anime_reviews_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "content"."anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."user_anime_reviews" ADD CONSTRAINT "user_anime_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."user_privacy_settings" ADD CONSTRAINT "user_privacy_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."user_reports" ADD CONSTRAINT "user_reports_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."user_reports" ADD CONSTRAINT "user_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data"."user_reports" ADD CONSTRAINT "user_reports_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

