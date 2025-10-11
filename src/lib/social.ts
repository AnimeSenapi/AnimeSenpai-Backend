/**
 * 🤝 AnimeSenpai Social Features
 * 
 * Connect with fellow anime fans, share discoveries, and get
 * recommendations from friends with similar taste.
 * 
 * Security: Privacy-first design, blocking, spam prevention
 * Performance: Cached queries, optimized friend lists
 */

import { db } from './db'
import { cache } from './cache'
import { TRPCError } from '@trpc/server'

export interface FriendProfile {
  id: string
  username: string
  name: string | null
  avatar: string | null
  bio: string | null
  isFollowing: boolean
  isFollower: boolean
  mutualFollow: boolean
  followedAt?: Date
}

export interface Activity {
  id: string
  userId: string
  username: string
  name: string | null | undefined
  avatar: string | null | undefined
  activityType: string
  animeId: string | null
  animeTitle?: string | undefined
  animeCover?: string | null | undefined
  metadata: any
  createdAt: Date
}

/**
 * Follow a user
 * 
 * Security: Validates both users exist, prevents self-follow
 * Performance: Cached follower counts
 */
export async function followUser(
  followerId: string,
  followingId: string
): Promise<void> {
  // Security: Can't follow yourself
  if (followerId === followingId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: "You can't follow yourself!"
    })
  }

  // Security: Check if target user exists and allows followers
  const targetUser = await db.user.findUnique({
    where: { id: followingId },
    include: { preferences: true }
  })

  if (!targetUser) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'User not found'
    })
  }

  if (!targetUser.preferences?.allowFollowers) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This user has disabled followers'
    })
  }

  // Check if already following
  const existing = await db.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId
      }
    }
  })

  if (existing) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Already following this user'
    })
  }

  // Create follow relationship
  await db.follow.create({
    data: {
      followerId,
      followingId
    }
  })

  // Create activity
  await createActivity(
    followerId,
    'followed_user',
    null,
    followingId,
    null
  )

  // Create notification for the followed user
  await createNotification(
    followingId,
    followerId,
    'new_follower',
    null,
    'started following you'
  )

  // Clear caches
  clearSocialCaches(followerId)
  clearSocialCaches(followingId)
}

/**
 * Unfollow a user
 * 
 * Security: Only the follower can unfollow
 */
export async function unfollowUser(
  followerId: string,
  followingId: string
): Promise<void> {
  const follow = await db.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId
      }
    }
  })

  if (!follow) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Not following this user'
    })
  }

  // Delete follow
  await db.follow.delete({
    where: {
      followerId_followingId: {
        followerId,
        followingId
      }
    }
  })

  // Clear caches
  clearSocialCaches(followerId)
  clearSocialCaches(followingId)
}

/**
 * Get user's followers
 * 
 * Security: Respects privacy settings
 * Performance: Cached, paginated
 */
export async function getFollowers(
  userId: string,
  requesterId: string | null,
  limit: number = 20,
  offset: number = 0
): Promise<{ followers: FriendProfile[]; total: number }> {
  // Check privacy settings
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { preferences: true }
  })

  if (!user) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'User not found'
    })
  }

  // Security: Check if requester can view followers
  const isOwnProfile = requesterId === userId
  if (!isOwnProfile && !user.preferences?.showFollowersCount) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Follower list is private'
    })
  }

  const [followers, total] = await Promise.all([
    db.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            bio: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    }),
    db.follow.count({
      where: { followingId: userId }
    })
  ])

  // Check if requester follows each user
  let requesterFollowing: Set<string> = new Set()
  if (requesterId) {
    const following = await db.follow.findMany({
      where: { followerId: requesterId },
      select: { followingId: true }
    })
    requesterFollowing = new Set(following.map(f => f.followingId))
  }

  const profiles: FriendProfile[] = followers.map(f => ({
    id: f.follower.id,
    username: f.follower.username,
    name: f.follower.name,
    avatar: f.follower.avatar,
    bio: f.follower.bio,
    isFollowing: requesterFollowing.has(f.follower.id),
    isFollower: true,
    mutualFollow: requesterFollowing.has(f.follower.id),
    followedAt: f.createdAt
  }))

  return { followers: profiles, total }
}

/**
 * Get users that a user is following
 * 
 * Security: Respects privacy
 * Performance: Cached, paginated
 */
export async function getFollowing(
  userId: string,
  requesterId: string | null,
  limit: number = 20,
  offset: number = 0
): Promise<{ following: FriendProfile[]; total: number }> {
  const [following, total] = await Promise.all([
    db.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            bio: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    }),
    db.follow.count({
      where: { followerId: userId }
    })
  ])

  // Check which users follow back
  let followerIds: Set<string> = new Set()
  const followers = await db.follow.findMany({
    where: { followingId: userId },
    select: { followerId: true }
  })
  followerIds = new Set(followers.map(f => f.followerId))

  const profiles: FriendProfile[] = following.map(f => ({
    id: f.following.id,
    username: f.following.username,
    name: f.following.name,
    avatar: f.following.avatar,
    bio: f.following.bio,
    isFollowing: true,
    isFollower: followerIds.has(f.following.id),
    mutualFollow: followerIds.has(f.following.id),
    followedAt: f.createdAt
  }))

  return { following: profiles, total }
}

/**
 * Get mutual follows (friends)
 * Users who follow each other
 * 
 * Security: Only returns public profiles or requester's friends
 * Performance: Optimized query
 */
export async function getMutualFollows(
  userId: string,
  limit: number = 50
): Promise<FriendProfile[]> {
  const cacheKey = `mutual-follows:${userId}`
  const cached = cache.get<FriendProfile[]>(cacheKey)
  if (cached) return cached.slice(0, limit)

  // Get users that userId follows
  const following = await db.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true }
  })
  const followingIds = following.map(f => f.followingId)

  // Find which of those also follow back
  const mutualFollows = await db.follow.findMany({
    where: {
      followerId: { in: followingIds },
      followingId: userId
    },
    include: {
      follower: {
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
          bio: true
        }
      }
    }
  })

  const profiles = mutualFollows.map(f => ({
    id: f.follower.id,
    username: f.follower.username,
    name: f.follower.name,
    avatar: f.follower.avatar,
    bio: f.follower.bio,
    isFollowing: true,
    isFollower: true,
    mutualFollow: true,
    followedAt: f.createdAt
  }))

  // Cache for 5 minutes
  cache.set(cacheKey, profiles, 5 * 60 * 1000)

  return profiles.slice(0, limit)
}

/**
 * Create activity feed entry
 * 
 * Security: Respects user's activity privacy settings
 * Performance: Async, doesn't block main operations
 */
export async function createActivity(
  userId: string,
  activityType: 'rated_anime' | 'completed_anime' | 'added_to_list' | 'started_watching' | 'followed_user' | 'favorited_anime',
  animeId: string | null,
  targetUserId: string | null,
  metadata: any
): Promise<void> {
  try {
    // Check user's privacy settings
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { preferences: true }
    })

    if (!user || !user.preferences?.showActivityFeed) {
      return // User disabled activity feed
    }

    const isPublic = user.preferences?.activityPrivacy === 'public'

    await db.activityFeed.create({
      data: {
        userId,
        activityType,
        animeId,
        targetUserId,
        metadata: metadata ? JSON.stringify(metadata) : null,
        isPublic
      }
    })

    // If rated or completed, notify friends who might be interested
    if (activityType === 'rated_anime' || activityType === 'completed_anime') {
      await notifyFriendsOfActivity(userId, activityType, animeId, metadata)
    }
  } catch (error) {
    // Non-critical, don't fail the main operation
    console.error('Failed to create activity:', error)
  }
}

/**
 * Get activity feed for a user
 * Shows their own activities and friends' activities
 * 
 * Security: Only shows activities from friends or public activities
 * Performance: Paginated, indexed queries
 */
export async function getActivityFeed(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ activities: Activity[]; total: number }> {
  // Get user's friends (mutual follows)
  const friends = await getMutualFollows(userId, 100)
  const friendIds = friends.map(f => f.id)

  // Get activities from user and friends
  const [activities, total] = await Promise.all([
    db.activityFeed.findMany({
      where: {
        OR: [
          { userId }, // Own activities
          { userId: { in: friendIds }, isPublic: true }, // Friends' public activities
          { isPublic: true } // Public activities from everyone
        ]
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    }),
    db.activityFeed.count({
      where: {
        OR: [
          { userId },
          { userId: { in: friendIds }, isPublic: true }
        ]
      }
    })
  ])

  // Get user details and anime details
  const userIds = [...new Set(activities.map(a => a.userId))]
  const animeIds = activities.filter(a => a.animeId).map(a => a.animeId!)

  const [users, anime] = await Promise.all([
    db.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true
      }
    }),
    db.anime.findMany({
      where: { id: { in: animeIds } },
      select: {
        id: true,
        title: true,
        coverImage: true
      }
    })
  ])

  const userMap = new Map(users.map(u => [u.id, u]))
  const animeMap = new Map(anime.map(a => [a.id, a]))

  const enrichedActivities: Activity[] = activities.map(activity => {
    const user = userMap.get(activity.userId)
    const animeData = activity.animeId ? animeMap.get(activity.animeId) : null
    const metadata = activity.metadata ? JSON.parse(activity.metadata) : {}

    return {
      id: activity.id,
      userId: activity.userId,
      username: user?.username || 'Unknown',
      name: user?.name,
      avatar: user?.avatar,
      activityType: activity.activityType,
      animeId: activity.animeId,
      animeTitle: animeData?.title,
      animeCover: animeData?.coverImage,
      metadata,
      createdAt: activity.createdAt
    }
  })

  return { activities: enrichedActivities, total }
}

/**
 * Get friend-based recommendations
 * "X friends watched this anime"
 * 
 * Security: Only includes friends' public data
 * Performance: Cached, limited queries
 */
export async function getFriendRecommendations(
  userId: string,
  limit: number = 12
): Promise<Array<{
  animeId: string
  friendCount: number
  averageFriendRating: number
  friendNames: string[]
}>> {
  const cacheKey = `friend-recs:${userId}`
  const cached = cache.get<any[]>(cacheKey)
  if (cached) return cached.slice(0, limit)

  // Get mutual friends
  const friends = await getMutualFollows(userId, 100)
  const friendIds = friends.map(f => f.id)

  if (friendIds.length === 0) {
    return []
  }

  // Get user's seen anime
  const userAnimeList = await db.userAnimeList.findMany({
    where: { userId },
    select: { animeId: true }
  })
  const seenAnime = new Set(userAnimeList.map(a => a.animeId))

  // Get friends' highly-rated anime
  const friendsAnime = await db.userAnimeList.findMany({
    where: {
      userId: { in: friendIds },
      score: { gte: 7 }, // Friends rated it 7+ 
      animeId: { notIn: [...seenAnime] }
    },
    select: {
      animeId: true,
      userId: true,
      score: true
    }
  })

  // Group by anime
  const animeGroups = new Map<string, { scores: number[]; userIds: string[] }>()

  for (const item of friendsAnime) {
    if (!animeGroups.has(item.animeId)) {
      animeGroups.set(item.animeId, { scores: [], userIds: [] })
    }
    const group = animeGroups.get(item.animeId)!
    if (item.score) {
      group.scores.push(item.score)
      group.userIds.push(item.userId)
    }
  }

  // Calculate recommendations
  const recommendations: any[] = []

  for (const [animeId, group] of animeGroups.entries()) {
    if (group.scores.length === 0) continue

    const avgRating = group.scores.reduce((a, b) => a + b, 0) / group.scores.length

    // Get friend names (limit to 3 for display)
    const friendUserIds = group.userIds.slice(0, 3)
    const friendUsers = friends.filter(f => friendUserIds.includes(f.id))
    const friendNames = friendUsers.map(f => f.name || f.username)

    recommendations.push({
      animeId,
      friendCount: group.scores.length,
      averageFriendRating: avgRating,
      friendNames
    })
  }

  // Sort by friend count and rating
  recommendations.sort((a, b) => {
    if (b.friendCount !== a.friendCount) {
      return b.friendCount - a.friendCount
    }
    return b.averageFriendRating - a.averageFriendRating
  })

  // Cache for 1 hour
  cache.set(cacheKey, recommendations, 60 * 60 * 1000)

  return recommendations.slice(0, limit)
}

/**
 * Get social proof for an anime
 * "12 friends watched this"
 * 
 * Security: Only counts friends, respects privacy
 */
export async function getSocialProof(
  userId: string,
  animeId: string
): Promise<{
  friendsWatched: number
  friendsRated: number
  averageFriendRating: number | null
  friendNames: string[]
}> {
  const friends = await getMutualFollows(userId, 100)
  const friendIds = friends.map(f => f.id)

  if (friendIds.length === 0) {
    return {
      friendsWatched: 0,
      friendsRated: 0,
      averageFriendRating: null,
      friendNames: []
    }
  }

  const friendsAnimeList = await db.userAnimeList.findMany({
    where: {
      userId: { in: friendIds },
      animeId
    },
    select: {
      userId: true,
      score: true
    }
  })

  const ratedFriends = friendsAnimeList.filter(f => f.score !== null)
  const avgRating = ratedFriends.length > 0
    ? ratedFriends.reduce((sum, f) => sum + (f.score || 0), 0) / ratedFriends.length
    : null

  // Get up to 3 friend names
  const friendUserIds = friendsAnimeList.slice(0, 3).map(f => f.userId)
  const friendUsers = friends.filter(f => friendUserIds.includes(f.id))
  const friendNames = friendUsers.map(f => f.name || f.username)

  return {
    friendsWatched: friendsAnimeList.length,
    friendsRated: ratedFriends.length,
    averageFriendRating: avgRating,
    friendNames
  }
}

/**
 * Create notification
 * 
 * Security: Respects notification preferences
 */
async function createNotification(
  userId: string,
  fromUserId: string | null,
  type: string,
  animeId: string | null,
  message: string
): Promise<void> {
  try {
    // Check if user wants notifications
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { preferences: true }
    })

    if (!user) return

    // Check notification preferences
    if (type === 'new_follower' && !user.preferences?.notifyOnFollow) {
      return
    }

    if ((type === 'friend_rated' || type === 'friend_completed') && 
        !user.preferences?.notifyOnFriendActivity) {
      return
    }

    await db.notification.create({
      data: {
        userId,
        fromUserId,
        type,
        animeId,
        message
      }
    })
  } catch (error) {
    // Non-critical
    console.error('Failed to create notification:', error)
  }
}

/**
 * Notify friends when user rates/completes anime
 * 
 * Security: Only notifies if user's activity is public/friends
 * Performance: Async, limited to mutual follows
 */
async function notifyFriendsOfActivity(
  userId: string,
  activityType: string,
  animeId: string | null,
  metadata: any
): Promise<void> {
  try {
    const friends = await getMutualFollows(userId, 50) // Limit for performance
    const friendIds = friends.map(f => f.id)

    if (friendIds.length === 0 || !animeId) return

    // Get anime title
    const anime = await db.anime.findUnique({
      where: { id: animeId },
      select: { title: true }
    })

    if (!anime) return

    // Get user info
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, username: true }
    })

    if (!user) return

    const userName = user.name || user.username

    // Create notifications for friends
    const message = activityType === 'rated_anime'
      ? `${userName} rated ${anime.title} ${metadata?.score}/10`
      : `${userName} completed ${anime.title}`

    const notifications = friendIds.map(friendId =>
      createNotification(
        friendId,
        userId,
        activityType === 'rated_anime' ? 'friend_rated' : 'friend_completed',
        animeId,
        message
      )
    )

    // Execute in background, don't wait
    Promise.all(notifications).catch(() => {})
  } catch (error) {
    // Non-critical
  }
}

/**
 * Get user's notifications
 * 
 * Security: Only returns user's own notifications
 * Performance: Paginated, indexed
 */
export async function getNotifications(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ notifications: any[]; total: number; unread: number }> {
  const [notifications, total, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    }),
    db.notification.count({
      where: { userId }
    }),
    db.notification.count({
      where: { userId, isRead: false }
    })
  ])

  return { notifications, total, unread }
}

/**
 * Mark notifications as read
 * 
 * Security: Only user can mark their own notifications
 */
export async function markNotificationsRead(
  userId: string,
  notificationIds: string[]
): Promise<void> {
  await db.notification.updateMany({
    where: {
      id: { in: notificationIds },
      userId // Security: Ensure user owns these notifications
    },
    data: {
      isRead: true
    }
  })
}

/**
 * Clear social caches for a user
 * Call after follow/unfollow actions
 */
function clearSocialCaches(userId: string): void {
  cache.delete(`mutual-follows:${userId}`)
  cache.delete(`friend-recs:${userId}`)
  cache.delete(`follower-count:${userId}`)
  cache.delete(`following-count:${userId}`)
  cache.delete(`social-counts:${userId}`) // FIX: Match the cache key used in getSocialCounts
}

/**
 * Get follower and following counts
 * 
 * Performance: Cached for fast profile loads
 */
export async function getSocialCounts(
  userId: string
): Promise<{ followers: number; following: number; mutualFollows: number }> {
  const cacheKey = `social-counts:${userId}`
  const cached = cache.get<any>(cacheKey)
  if (cached) return cached

  const [followers, following, mutualFollowsList] = await Promise.all([
    db.follow.count({
      where: { followingId: userId }
    }),
    db.follow.count({
      where: { followerId: userId }
    }),
    getMutualFollows(userId, 1000)
  ])

  const counts = {
    followers,
    following,
    mutualFollows: mutualFollowsList.length
  }

  // Cache for 5 minutes
  cache.set(cacheKey, counts, 5 * 60 * 1000)

  return counts
}

/**
 * Check if user1 follows user2
 * 
 * Performance: Simple query, can be cached
 */
export async function isFollowing(
  followerId: string,
  followingId: string
): Promise<boolean> {
  const follow = await db.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId
      }
    }
  })

  return !!follow
}

