# 🧪 Beta Testing & Role Management Guide

Complete guide to using the role-based access control and feature flag system for beta testing.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [User Roles](#-user-roles)
- [Feature Flags](#-feature-flags)
- [Admin API Endpoints](#-admin-api-endpoints)
- [User API Endpoints](#-user-api-endpoints)
- [Usage Examples](#-usage-examples)
- [Database Migration](#-database-migration)
- [Best Practices](#-best-practices)

---

## 🎯 Overview

The AnimeSenpai Backend now includes a comprehensive role-based access control (RBAC) system that allows you to:

- **Grant beta access** to testers before public release
- **Control feature availability** based on user roles
- **Manage permissions** at a granular level
- **Test features safely** with a limited audience

### Key Features

✅ **3 User Roles**: User, Tester, Admin  
✅ **Feature Flags**: Enable/disable features per role  
✅ **Admin Dashboard**: Manage users and features  
✅ **Security Logging**: Track all role changes  
✅ **In-Memory Cache**: Fast feature flag checks

---

## 👥 User Roles

### Role Hierarchy

```
┌──────────────────────────┐
│    Admin (Level 3)       │  ← Full access
├──────────────────────────┤
│    Tester (Level 2)      │  ← Beta features + all user features
├──────────────────────────┤
│    User (Level 1)        │  ← Public features only
└──────────────────────────┘
```

### Role Definitions

#### 1. **User** (Default)
- Regular users with access to public features
- Default role for all new signups
- Cannot access beta features

#### 2. **Tester**
- Beta testers with early access to unreleased features
- Manually promoted by admins
- Access to all public features + beta features
- Perfect for gathering feedback before public launch

#### 3. **Admin**
- Full system access
- Can manage users, roles, and feature flags
- Access to admin dashboard and analytics
- Highest level of permissions

---

## 🚩 Feature Flags

Feature flags allow you to control which features are available and to whom.

### Feature Flag Structure

```typescript
{
  id: string           // Unique identifier
  key: string          // Feature key (e.g., "new-player")
  name: string         // Display name
  description: string  // What this feature does
  enabled: boolean     // Global toggle
  roles: string[]      // Roles that have access
  createdAt: Date
  updatedAt: Date
}
```

### How Feature Flags Work

1. **Create a feature flag** with a unique key
2. **Set roles** that should have access (e.g., `["tester", "admin"]`)
3. **Enable the flag** when ready for testing
4. **Check access** in your frontend/backend
5. **Expand roles** as feature matures (add `"user"` for public release)

---

## 📡 Admin API Endpoints

All admin endpoints require **admin role**.

### 1. Get All Users

```typescript
const users = await trpc.admin.getAllUsers.query({
  page: 1,
  limit: 20,
  role: 'tester', // Optional filter
})

// Returns:
{
  users: [
    {
      id: string
      email: string
      name: string
      role: 'user' | 'tester' | 'admin'
      emailVerified: boolean
      createdAt: Date
      lastLoginAt: Date
    }
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 150,
    pages: 8
  }
}
```

### 2. Promote User to Tester

```typescript
await trpc.admin.promoteToTester.mutate({
  userId: 'user-id-123'
})

// Returns:
{
  success: true,
  user: {
    id: string
    email: string
    name: string
    role: 'tester'
  }
}
```

### 3. Demote Tester to User

```typescript
await trpc.admin.demoteToUser.mutate({
  userId: 'user-id-123'
})
```

### 4. Promote User to Admin

```typescript
await trpc.admin.promoteToAdmin.mutate({
  userId: 'user-id-123'
})
```

### 5. Get All Feature Flags

```typescript
const flags = await trpc.admin.getFeatureFlags.query()

// Returns: FeatureFlag[]
```

### 6. Create/Update Feature Flag

```typescript
await trpc.admin.setFeatureFlag.mutate({
  key: 'new-video-player',
  name: 'New Video Player',
  description: 'Improved video player with better controls',
  enabled: true,
  roles: ['tester', 'admin'] // Only testers and admins can access
})
```

### 7. Toggle Feature Flag

```typescript
await trpc.admin.toggleFeatureFlag.mutate({
  key: 'new-video-player',
  enabled: false // Disable the feature
})
```

### 8. Delete Feature Flag

```typescript
await trpc.admin.deleteFeatureFlag.mutate({
  key: 'old-feature'
})
```

### 9. Get System Statistics

```typescript
const stats = await trpc.admin.getStats.query()

// Returns:
{
  users: {
    total: 1000,
    regular: 950,
    testers: 45,
    admins: 5
  },
  content: {
    anime: 500
  },
  features: {
    flags: 12
  }
}
```

---

## 👤 User API Endpoints

These endpoints are available to **all authenticated users**.

### 1. Get User's Accessible Features

```typescript
const features = await trpc.user.getFeatures.query()

// Returns:
{
  role: 'tester',
  features: [
    'new-video-player',
    'advanced-search',
    'ai-recommendations'
  ]
}
```

### 2. Check Specific Feature Access

```typescript
const result = await trpc.user.checkFeature.query({
  feature: 'new-video-player'
})

// Returns:
{
  feature: 'new-video-player',
  hasAccess: true,
  role: 'tester'
}
```

### 3. Get Current User (includes role)

```typescript
const user = await trpc.auth.me.query()

// Returns:
{
  id: string
  email: string
  name: string
  role: 'user' | 'tester' | 'admin'
  emailVerified: boolean
  preferences: { ... }
}
```

---

## 💡 Usage Examples

### Example 1: Rolling Out a New Feature

```typescript
// Step 1: Create feature flag (admin only)
await trpc.admin.setFeatureFlag.mutate({
  key: 'dark-mode-v2',
  name: 'Dark Mode V2',
  description: 'New improved dark mode with better contrast',
  enabled: true,
  roles: ['tester', 'admin'] // Start with testers
})

// Step 2: Promote beta testers
await trpc.admin.promoteToTester.mutate({ userId: 'user-1' })
await trpc.admin.promoteToTester.mutate({ userId: 'user-2' })

// Step 3: Testers test the feature
// Their frontend checks:
const { hasAccess } = await trpc.user.checkFeature.query({
  feature: 'dark-mode-v2'
})

if (hasAccess) {
  // Show new dark mode
} else {
  // Show old dark mode
}

// Step 4: After testing, expand to all users
await trpc.admin.setFeatureFlag.mutate({
  key: 'dark-mode-v2',
  enabled: true,
  roles: [] // Empty = everyone has access
})
```

### Example 2: Frontend Feature Detection

```tsx
// React component
import { trpc } from '@/lib/trpc'

function VideoPlayer() {
  const { data } = trpc.user.checkFeature.useQuery({
    feature: 'new-video-player'
  })

  return (
    <>
      {data?.hasAccess ? (
        <NewVideoPlayer />
      ) : (
        <OldVideoPlayer />
      )}
    </>
  )
}
```

### Example 3: Admin Dashboard

```tsx
function AdminPanel() {
  const { data: users } = trpc.admin.getAllUsers.useQuery({ page: 1 })
  const promoteToTester = trpc.admin.promoteToTester.useMutation()

  const handlePromote = async (userId: string) => {
    await promoteToTester.mutateAsync({ userId })
    // Refresh user list
  }

  return (
    <div>
      {users?.users.map(user => (
        <div key={user.id}>
          <span>{user.email} ({user.role})</span>
          {user.role === 'user' && (
            <button onClick={() => handlePromote(user.id)}>
              Make Tester
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
```

### Example 4: Backend Feature Protection

```typescript
// In your router
import { requireFeature } from '../lib/roles'

// Protected endpoint - only accessible if user has feature
someProtectedEndpoint: protectedProcedure
  .mutation(async ({ ctx }) => {
    // Check feature access
    await requireFeature('advanced-analytics', ctx.user.role)
    
    // Feature is available, proceed
    return performAdvancedAnalytics()
  })
```

---

## 🗄️ Database Migration

### Apply the Schema Changes

```bash
# Generate Prisma Client with new fields
bunx prisma generate

# Push changes to database
bunx prisma db push

# OR create migration
bunx prisma migrate dev --name add-roles-and-feature-flags
```

### Verify the Changes

```bash
# Open Prisma Studio to see the new fields
bunx prisma studio
```

You should see:
- `role` field in `User` table (default: "user")
- New `FeatureFlag` table

---

## ✅ Best Practices

### 1. **Start Small**
- Begin with 5-10 trusted testers
- Gradually expand based on feedback
- Monitor for issues before public release

### 2. **Use Descriptive Keys**
- ✅ Good: `new-video-player`, `ai-recommendations`, `dark-mode-v2`
- ❌ Bad: `feature1`, `test`, `new`

### 3. **Document Features**
- Always add clear descriptions to feature flags
- Explain what's being tested
- Track feedback in your issue tracker

### 4. **Security**
- Only trusted admins should manage roles
- Log all role changes (automatically done)
- Review security events regularly

### 5. **Testing Workflow**

```
1. Create feature flag → Enable for testers
2. Promote 5-10 beta testers
3. Gather feedback (1-2 weeks)
4. Fix issues & iterate
5. Expand to more testers
6. Public release (set roles: [])
7. Remove feature flag (optional)
```

### 6. **Cleanup**
- Remove feature flags after full rollout
- Keep flags in database for analytics
- Archive old flags instead of deleting

### 7. **Communication**
- Email testers when giving access
- Provide feedback channels
- Thank testers for participation

---

## 🔍 Monitoring & Analytics

### Check Who Has Access

```typescript
// Get all testers
const testers = await trpc.admin.getAllUsers.query({
  role: 'tester'
})

// Get system stats
const stats = await trpc.admin.getStats.query()
console.log(`${stats.users.testers} active testers`)
```

### Security Events

All role changes are logged to `SecurityEvent` table:

```typescript
{
  eventType: 'user_role_changed',
  eventData: {
    targetUserId: 'user-123',
    newRole: 'tester',
    changedBy: 'admin@example.com'
  },
  ipAddress: '...',
  userAgent: '...',
  createdAt: Date
}
```

---

## 🚀 Quick Start

### For Admins

```bash
# 1. Push database changes
bunx prisma db push

# 2. Promote yourself to admin (via database)
bunx prisma studio
# Find your user → Set role to "admin"

# 3. Create your first feature flag
# Use admin.setFeatureFlag endpoint

# 4. Promote your first tester
# Use admin.promoteToTester endpoint
```

### For Frontend Developers

```typescript
// 1. Check user's role
const user = await trpc.auth.me.query()
console.log('Role:', user.role)

// 2. Get all accessible features
const { features } = await trpc.user.getFeatures.query()
console.log('Features:', features)

// 3. Check specific feature
const { hasAccess } = await trpc.user.checkFeature.query({
  feature: 'new-feature'
})

if (hasAccess) {
  // Show new feature
}
```

---

## 📊 Example Feature Rollout Plan

### Week 1: Internal Testing
- **Roles**: `['admin']` only
- **Testers**: 2-3 team members
- **Goal**: Find critical bugs

### Week 2: Beta Testing
- **Roles**: `['admin', 'tester']`
- **Testers**: 10-20 trusted users
- **Goal**: Gather feedback, test UX

### Week 3: Expanded Beta
- **Roles**: `['tester', 'admin']`
- **Testers**: 50-100 users
- **Goal**: Stress test, performance validation

### Week 4: Public Release
- **Roles**: `[]` (empty = everyone)
- **Testers**: All users
- **Goal**: Monitor, support, iterate

---

## 🆘 Troubleshooting

### User Not Seeing Feature

1. **Check role**: Verify user has correct role
   ```typescript
   const user = await trpc.auth.me.query()
   console.log(user.role) // Should be 'tester' or 'admin'
   ```

2. **Check feature flag**: Verify feature is enabled
   ```typescript
   const flags = await trpc.admin.getFeatureFlags.query()
   const flag = flags.find(f => f.key === 'your-feature')
   console.log(flag.enabled, flag.roles)
   ```

3. **Clear cache**: Feature flags are cached for 1 minute
   - Wait 60 seconds
   - Or restart backend to clear cache

### Role Change Not Working

- Verify you're an admin
- Check security events for errors
- Ensure user ID is correct

---

## 📖 API Reference

**Admin Endpoints**:
- `admin.getAllUsers` - List all users
- `admin.promoteToTester` - Make user a tester
- `admin.demoteToUser` - Remove tester role
- `admin.promoteToAdmin` - Make user an admin
- `admin.getFeatureFlags` - List all flags
- `admin.setFeatureFlag` - Create/update flag
- `admin.toggleFeatureFlag` - Enable/disable flag
- `admin.deleteFeatureFlag` - Delete flag
- `admin.getStats` - System statistics

**User Endpoints**:
- `user.getFeatures` - Get accessible features
- `user.checkFeature` - Check specific feature access

**Updated Endpoints**:
- `auth.me` - Now includes `role` field
- `auth.signup` - Returns `role` in user object
- `auth.signin` - Returns `role` in user object

---

**Status**: ✅ **Production Ready**  
**Last Updated**: October 7, 2025  
**Version**: 1.0.0

