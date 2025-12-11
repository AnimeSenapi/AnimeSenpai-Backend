import { PrismaClient } from '../generated/prisma/client/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required')
}

const pool = new pg.Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const db = new PrismaClient({ adapter })

const permissions = [
  // ===== ADMIN CATEGORY =====
  {
    key: 'admin.access',
    name: 'Access Admin Panel',
    description: 'Can access the admin panel',
    category: 'admin',
  },
  {
    key: 'admin.view_stats',
    name: 'View Statistics',
    description: 'Can view system statistics and analytics',
    category: 'admin',
  },
  {
    key: 'admin.manage_settings',
    name: 'Manage Settings',
    description: 'Can modify system settings',
    category: 'admin',
  },
  {
    key: 'admin.manage_feature_flags',
    name: 'Manage Feature Flags',
    description: 'Can create, edit, and delete feature flags',
    category: 'admin',
  },

  // ===== USER MANAGEMENT CATEGORY =====
  {
    key: 'users.view',
    name: 'View Users',
    description: 'Can view user list and details',
    category: 'user_management',
  },
  {
    key: 'users.create',
    name: 'Create Users',
    description: 'Can create new user accounts',
    category: 'user_management',
  },
  {
    key: 'users.edit',
    name: 'Edit Users',
    description: 'Can edit user profiles and settings',
    category: 'user_management',
  },
  {
    key: 'users.delete',
    name: 'Delete Users',
    description: 'Can delete user accounts',
    category: 'user_management',
  },
  {
    key: 'users.ban',
    name: 'Ban Users',
    description: 'Can ban and unban users',
    category: 'user_management',
  },
  {
    key: 'users.verify_email',
    name: 'Verify Email',
    description: 'Can manually verify user email addresses',
    category: 'user_management',
  },
  {
    key: 'users.reset_password',
    name: 'Reset Password',
    description: 'Can send password reset emails',
    category: 'user_management',
  },
  {
    key: 'users.send_email',
    name: 'Send Custom Email',
    description: 'Can send custom emails to users',
    category: 'user_management',
  },

  // ===== ROLE & PERMISSION MANAGEMENT CATEGORY =====
  {
    key: 'roles.view',
    name: 'View Roles',
    description: 'Can view roles and their permissions',
    category: 'role_management',
  },
  {
    key: 'roles.create',
    name: 'Create Roles',
    description: 'Can create new roles',
    category: 'role_management',
  },
  {
    key: 'roles.edit',
    name: 'Edit Roles',
    description: 'Can edit existing roles',
    category: 'role_management',
  },
  {
    key: 'roles.delete',
    name: 'Delete Roles',
    description: 'Can delete non-system roles',
    category: 'role_management',
  },
  {
    key: 'roles.assign',
    name: 'Assign Roles',
    description: 'Can assign roles to users',
    category: 'role_management',
  },
  {
    key: 'permissions.view',
    name: 'View Permissions',
    description: 'Can view all permissions',
    category: 'role_management',
  },
  {
    key: 'permissions.create',
    name: 'Create Permissions',
    description: 'Can create new permissions',
    category: 'role_management',
  },
  {
    key: 'permissions.edit',
    name: 'Edit Permissions',
    description: 'Can edit existing permissions',
    category: 'role_management',
  },
  {
    key: 'permissions.delete',
    name: 'Delete Permissions',
    description: 'Can delete permissions',
    category: 'role_management',
  },
  {
    key: 'permissions.assign',
    name: 'Assign Permissions',
    description: 'Can assign permissions to roles',
    category: 'role_management',
  },

  // ===== CONTENT MANAGEMENT CATEGORY =====
  {
    key: 'anime.view',
    name: 'View Anime',
    description: 'Can view anime data',
    category: 'content',
  },
  {
    key: 'anime.create',
    name: 'Create Anime',
    description: 'Can add new anime to the database',
    category: 'content',
  },
  {
    key: 'anime.edit',
    name: 'Edit Anime',
    description: 'Can edit anime information',
    category: 'content',
  },
  {
    key: 'anime.delete',
    name: 'Delete Anime',
    description: 'Can delete anime entries',
    category: 'content',
  },
  {
    key: 'genres.manage',
    name: 'Manage Genres',
    description: 'Can create, edit, and delete genres',
    category: 'content',
  },
  {
    key: 'tags.manage',
    name: 'Manage Tags',
    description: 'Can create, edit, and delete tags',
    category: 'content',
  },

  // ===== MODERATION CATEGORY =====
  {
    key: 'reviews.moderate',
    name: 'Moderate Reviews',
    description: 'Can moderate user reviews',
    category: 'moderation',
  },
  {
    key: 'reviews.delete',
    name: 'Delete Reviews',
    description: 'Can delete user reviews',
    category: 'moderation',
  },
  {
    key: 'comments.moderate',
    name: 'Moderate Comments',
    description: 'Can moderate user comments',
    category: 'moderation',
  },
  {
    key: 'comments.delete',
    name: 'Delete Comments',
    description: 'Can delete user comments',
    category: 'moderation',
  },
  {
    key: 'reports.view',
    name: 'View Reports',
    description: 'Can view user reports',
    category: 'moderation',
  },
  {
    key: 'reports.handle',
    name: 'Handle Reports',
    description: 'Can review and take action on reports',
    category: 'moderation',
  },

  // ===== SOCIAL FEATURES CATEGORY =====
  {
    key: 'messages.moderate',
    name: 'Moderate Messages',
    description: 'Can moderate user messages',
    category: 'social',
  },
  {
    key: 'friends.moderate',
    name: 'Moderate Friend Requests',
    description: 'Can moderate friend requests',
    category: 'social',
  },
  {
    key: 'activities.moderate',
    name: 'Moderate Activities',
    description: 'Can moderate user activities',
    category: 'social',
  },

  // ===== ANALYTICS CATEGORY =====
  {
    key: 'analytics.view',
    name: 'View Analytics',
    description: 'Can view system analytics',
    category: 'analytics',
  },
  {
    key: 'analytics.export',
    name: 'Export Analytics',
    description: 'Can export analytics data',
    category: 'analytics',
  },
  {
    key: 'logs.view',
    name: 'View Logs',
    description: 'Can view system logs',
    category: 'analytics',
  },
  {
    key: 'logs.export',
    name: 'Export Logs',
    description: 'Can export log data',
    category: 'analytics',
  },

  // ===== SECURITY CATEGORY =====
  {
    key: 'security.view_events',
    name: 'View Security Events',
    description: 'Can view security event logs',
    category: 'security',
  },
  {
    key: 'security.manage',
    name: 'Manage Security',
    description: 'Can manage security settings',
    category: 'security',
  },
  {
    key: 'sessions.view',
    name: 'View Sessions',
    description: 'Can view user sessions',
    category: 'security',
  },
  {
    key: 'sessions.terminate',
    name: 'Terminate Sessions',
    description: 'Can terminate user sessions',
    category: 'security',
  },
]

async function main() {
  console.log('🔐 Seeding permissions...')

  // Upsert all permissions
  for (const permission of permissions) {
    await db.permission.upsert({
      where: { key: permission.key },
      update: {
        name: permission.name,
        description: permission.description,
        category: permission.category,
      },
      create: permission,
    })
    console.log(`✅ Created/Updated: ${permission.name} (${permission.key})`)
  }

  // Get all roles
  const adminRole = await db.role.findFirst({ where: { name: 'admin' } })
  const testerRole = await db.role.findFirst({ where: { name: 'tester' } })
  const userRole = await db.role.findFirst({ where: { name: 'user' } })

  if (!adminRole || !testerRole || !userRole) {
    console.log('⚠️  Warning: Some default roles not found. Run seed-roles.ts first.')
    return
  }

  // Assign ALL permissions to admin role
  console.log('\n🔐 Assigning permissions to admin role...')
  const allPermissions = await db.permission.findMany()
  for (const permission of allPermissions) {
    await db.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
        granted: true,
      },
      update: {
        granted: true,
      },
    })
  }
  console.log(`✅ Assigned ${allPermissions.length} permissions to admin role`)

  // Assign limited permissions to tester role
  console.log('\n🔐 Assigning permissions to tester role...')
  const testerPermissionKeys = [
    'admin.access',
    'admin.view_stats',
    'anime.view',
    'anime.create',
    'anime.edit',
    'genres.manage',
    'tags.manage',
    'analytics.view',
    'users.view',
  ]
  
  for (const key of testerPermissionKeys) {
    const permission = await db.permission.findFirst({ where: { key } })
    if (permission) {
      await db.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: testerRole.id,
            permissionId: permission.id,
          },
        },
        create: {
          roleId: testerRole.id,
          permissionId: permission.id,
          granted: true,
        },
        update: {
          granted: true,
        },
      })
    }
  }
  console.log(`✅ Assigned ${testerPermissionKeys.length} permissions to tester role`)

  // Assign basic permissions to user role
  console.log('\n🔐 Assigning permissions to user role...')
  const userPermissionKeys = [
    'anime.view',
  ]
  
  for (const key of userPermissionKeys) {
    const permission = await db.permission.findFirst({ where: { key } })
    if (permission) {
      await db.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: userRole.id,
            permissionId: permission.id,
          },
        },
        create: {
          roleId: userRole.id,
          permissionId: permission.id,
          granted: true,
        },
        update: {
          granted: true,
        },
      })
    }
  }
  console.log(`✅ Assigned ${userPermissionKeys.length} permissions to user role`)

  console.log('\n✅ Permission seeding complete!')
  
  // Print summary
  const stats = await db.permission.groupBy({
    by: ['category'],
    _count: true,
  })
  
  console.log('\n📊 Permission Summary:')
  for (const stat of stats) {
    console.log(`  ${stat.category}: ${stat._count} permissions`)
  }
}

main()
  .catch((e) => {
    console.error('❌ Error seeding permissions:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })

