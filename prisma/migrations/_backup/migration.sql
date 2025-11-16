-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auth";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "content";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "user_data";

-- CreateTable
CREATE TABLE "auth"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "bio" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
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
CREATE TABLE "auth"."follows" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "user_data"."notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "type" TEXT NOT NULL,
    "animeId" TEXT,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "content"."genres" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content"."anime_genres" (
    "animeId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,

    CONSTRAINT "anime_genres_pkey" PRIMARY KEY ("animeId","genreId")
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
CREATE TABLE "content"."anime_streaming_platforms" (
    "animeId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anime_streaming_platforms_pkey" PRIMARY KEY ("animeId","platformId")
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
    "enableRecommendations" BOOLEAN NOT NULL DEFAULT true,
    "enableSocialFeatures" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "auth"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "auth"."users"("username");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "auth"."users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "auth"."users"("username");

-- CreateIndex
CREATE INDEX "users_emailVerificationToken_idx" ON "auth"."users"("emailVerificationToken");

-- CreateIndex
CREATE INDEX "users_passwordResetToken_idx" ON "auth"."users"("passwordResetToken");

-- CreateIndex
CREATE INDEX "users_lastLoginAt_idx" ON "auth"."users"("lastLoginAt");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "auth"."users"("createdAt");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "auth"."users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "auth"."user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refreshToken_key" ON "auth"."user_sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "user_sessions_userId_isActive_idx" ON "auth"."user_sessions"("userId", "isActive");

-- CreateIndex
CREATE INDEX "user_sessions_expiresAt_idx" ON "auth"."user_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "user_sessions_refreshToken_idx" ON "auth"."user_sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "security_events_userId_createdAt_idx" ON "auth"."security_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "security_events_eventType_createdAt_idx" ON "auth"."security_events"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "security_events_ipAddress_createdAt_idx" ON "auth"."security_events"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "follows_followerId_idx" ON "auth"."follows"("followerId");

-- CreateIndex
CREATE INDEX "follows_followingId_idx" ON "auth"."follows"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "follows_followerId_followingId_key" ON "auth"."follows"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "activity_feed_userId_createdAt_idx" ON "user_data"."activity_feed"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_feed_activityType_createdAt_idx" ON "user_data"."activity_feed"("activityType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_feed_isPublic_createdAt_idx" ON "user_data"."activity_feed"("isPublic", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "user_data"."notifications"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "user_data"."notifications"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "auth"."feature_flags"("key");

-- CreateIndex
CREATE INDEX "feature_flags_key_idx" ON "auth"."feature_flags"("key");

-- CreateIndex
CREATE INDEX "feature_flags_enabled_idx" ON "auth"."feature_flags"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "anime_slug_key" ON "content"."anime"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "anime_malId_key" ON "content"."anime"("malId");

-- CreateIndex
CREATE UNIQUE INDEX "anime_anilistId_key" ON "content"."anime"("anilistId");

-- CreateIndex
CREATE UNIQUE INDEX "anime_kitsuId_key" ON "content"."anime"("kitsuId");

-- CreateIndex
CREATE INDEX "anime_slug_idx" ON "content"."anime"("slug");

-- CreateIndex
CREATE INDEX "anime_status_type_idx" ON "content"."anime"("status", "type");

-- CreateIndex
CREATE INDEX "anime_year_season_idx" ON "content"."anime"("year", "season");

-- CreateIndex
CREATE INDEX "anime_viewCount_idx" ON "content"."anime"("viewCount" DESC);

-- CreateIndex
CREATE INDEX "anime_averageRating_idx" ON "content"."anime"("averageRating" DESC);

-- CreateIndex
CREATE INDEX "anime_createdAt_idx" ON "content"."anime"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "anime_title_idx" ON "content"."anime"("title");

-- CreateIndex
CREATE INDEX "anime_titleEnglish_idx" ON "content"."anime"("titleEnglish");

-- CreateIndex
CREATE INDEX "anime_malId_idx" ON "content"."anime"("malId");

-- CreateIndex
CREATE INDEX "anime_anilistId_idx" ON "content"."anime"("anilistId");

-- CreateIndex
CREATE INDEX "anime_rank_idx" ON "content"."anime"("rank");

-- CreateIndex
CREATE INDEX "anime_popularity_idx" ON "content"."anime"("popularity");

-- CreateIndex
CREATE INDEX "anime_airing_idx" ON "content"."anime"("airing");

-- CreateIndex
CREATE INDEX "anime_status_averageRating_idx" ON "content"."anime"("status", "averageRating" DESC);

-- CreateIndex
CREATE INDEX "anime_type_averageRating_idx" ON "content"."anime"("type", "averageRating" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "genres_name_key" ON "content"."genres"("name");

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "content"."genres"("slug");

-- CreateIndex
CREATE INDEX "anime_genres_genreId_animeId_idx" ON "content"."anime_genres"("genreId", "animeId");

-- CreateIndex
CREATE UNIQUE INDEX "streaming_platforms_name_key" ON "content"."streaming_platforms"("name");

-- CreateIndex
CREATE UNIQUE INDEX "streaming_platforms_slug_key" ON "content"."streaming_platforms"("slug");

-- CreateIndex
CREATE INDEX "anime_streaming_platforms_platformId_animeId_idx" ON "content"."anime_streaming_platforms"("platformId", "animeId");

-- CreateIndex
CREATE INDEX "user_anime_lists_userId_status_idx" ON "user_data"."user_anime_lists"("userId", "status");

-- CreateIndex
CREATE INDEX "user_anime_lists_userId_isFavorite_idx" ON "user_data"."user_anime_lists"("userId", "isFavorite");

-- CreateIndex
CREATE INDEX "user_anime_lists_animeId_userId_idx" ON "user_data"."user_anime_lists"("animeId", "userId");

-- CreateIndex
CREATE INDEX "user_anime_lists_userId_updatedAt_idx" ON "user_data"."user_anime_lists"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "user_anime_lists_status_updatedAt_idx" ON "user_data"."user_anime_lists"("status", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_anime_lists_userId_animeId_key" ON "user_data"."user_anime_lists"("userId", "animeId");

-- CreateIndex
CREATE INDEX "user_anime_ratings_userId_createdAt_idx" ON "user_data"."user_anime_ratings"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "user_anime_ratings_animeId_score_idx" ON "user_data"."user_anime_ratings"("animeId", "score" DESC);

-- CreateIndex
CREATE INDEX "user_anime_ratings_score_createdAt_idx" ON "user_data"."user_anime_ratings"("score" DESC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_anime_ratings_userId_animeId_key" ON "user_data"."user_anime_ratings"("userId", "animeId");

-- CreateIndex
CREATE INDEX "user_anime_reviews_userId_createdAt_idx" ON "user_data"."user_anime_reviews"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "user_anime_reviews_animeId_isPublic_likes_idx" ON "user_data"."user_anime_reviews"("animeId", "isPublic", "likes" DESC);

-- CreateIndex
CREATE INDEX "user_anime_reviews_isPublic_createdAt_idx" ON "user_data"."user_anime_reviews"("isPublic", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "user_anime_reviews_likes_idx" ON "user_data"."user_anime_reviews"("likes" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_anime_reviews_userId_animeId_key" ON "user_data"."user_anime_reviews"("userId", "animeId");

-- CreateIndex
CREATE INDEX "recommendation_feedback_userId_idx" ON "user_data"."recommendation_feedback"("userId");

-- CreateIndex
CREATE INDEX "recommendation_feedback_animeId_idx" ON "user_data"."recommendation_feedback"("animeId");

-- CreateIndex
CREATE INDEX "recommendation_feedback_feedbackType_idx" ON "user_data"."recommendation_feedback"("feedbackType");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_feedback_userId_animeId_key" ON "user_data"."recommendation_feedback"("userId", "animeId");

-- CreateIndex
CREATE INDEX "user_interactions_userId_createdAt_idx" ON "user_data"."user_interactions"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "user_interactions_animeId_idx" ON "user_data"."user_interactions"("animeId");

-- CreateIndex
CREATE INDEX "user_interactions_actionType_idx" ON "user_data"."user_interactions"("actionType");

-- CreateIndex
CREATE UNIQUE INDEX "anime_embeddings_animeId_key" ON "content"."anime_embeddings"("animeId");

-- CreateIndex
CREATE INDEX "anime_embeddings_animeId_idx" ON "content"."anime_embeddings"("animeId");

-- AddForeignKey
ALTER TABLE "auth"."user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."security_events" ADD CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."follows" ADD CONSTRAINT "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."follows" ADD CONSTRAINT "follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."anime_genres" ADD CONSTRAINT "anime_genres_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "content"."anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."anime_genres" ADD CONSTRAINT "anime_genres_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "content"."genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."anime_streaming_platforms" ADD CONSTRAINT "anime_streaming_platforms_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "content"."anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content"."anime_streaming_platforms" ADD CONSTRAINT "anime_streaming_platforms_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "content"."streaming_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

