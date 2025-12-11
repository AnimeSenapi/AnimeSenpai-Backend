import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required')
}

const pool = new pg.Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding roles and permissions...')

  // Create permissions
  const permissions = [
    // Admin permissions
    { key: 'admin.dashboard.view', name: 'View Admin Dashboard', description: 'Access to admin dashboard', category: 'admin' },
    { key: 'admin.users.manage', name: 'Manage Users', description: 'Create, edit, and delete users', category: 'admin' },
    { key: 'admin.roles.manage', name: 'Manage Roles', description: 'Create, edit, and delete roles', category: 'admin' },
    { key: 'admin.permissions.manage', name: 'Manage Permissions', description: 'Create, edit, and delete permissions', category: 'admin' },
    { key: 'admin.settings.manage', name: 'Manage Settings', description: 'Modify system settings', category: 'admin' },
    
    // Content permissions
    { key: 'content.anime.create', name: 'Create Anime', description: 'Add new anime to database', category: 'content' },
    { key: 'content.anime.edit', name: 'Edit Anime', description: 'Modify anime information', category: 'content' },
    { key: 'content.anime.delete', name: 'Delete Anime', description: 'Remove anime from database', category: 'content' },
    { key: 'content.reviews.moderate', name: 'Moderate Reviews', description: 'Approve, reject, or delete reviews', category: 'content' },
    { key: 'content.comments.moderate', name: 'Moderate Comments', description: 'Approve, reject, or delete comments', category: 'content' },
    
    // User permissions
    { key: 'user.profile.view', name: 'View Profile', description: 'View user profiles', category: 'user' },
    { key: 'user.profile.edit', name: 'Edit Profile', description: 'Edit own profile', category: 'user' },
    { key: 'user.list.manage', name: 'Manage List', description: 'Add/remove anime from list', category: 'user' },
    { key: 'user.reviews.create', name: 'Create Reviews', description: 'Write and publish reviews', category: 'user' },
    { key: 'user.comments.create', name: 'Create Comments', description: 'Post comments', category: 'user' },
    
    // Moderation permissions
    { key: 'moderation.reports.view', name: 'View Reports', description: 'View user reports', category: 'moderation' },
    { key: 'moderation.reports.resolve', name: 'Resolve Reports', description: 'Resolve user reports', category: 'moderation' },
    { key: 'moderation.users.ban', name: 'Ban Users', description: 'Ban or suspend users', category: 'moderation' },
    { key: 'moderation.users.warn', name: 'Warn Users', description: 'Send warnings to users', category: 'moderation' },
    { key: 'moderation.content.delete', name: 'Delete Content', description: 'Delete inappropriate content', category: 'moderation' },
    
    // Feature permissions
    { key: 'feature.beta.access', name: 'Beta Access', description: 'Access to beta features', category: 'feature' },
    { key: 'feature.advanced.search', name: 'Advanced Search', description: 'Access to advanced search features', category: 'feature' },
    { key: 'feature.export.data', name: 'Export Data', description: 'Export user data', category: 'feature' },
    { key: 'feature.custom.themes', name: 'Custom Themes', description: 'Create and use custom themes', category: 'feature' },
  ]

  console.log('Creating permissions...')
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: perm,
      create: perm,
    })
  }
  console.log(`✅ Created ${permissions.length} permissions`)

  // Create system roles
  const systemRoles = [
    {
      name: 'user',
      displayName: 'User',
      description: 'Regular user with basic permissions',
      isSystem: true,
      isDefault: true,
      priority: 1,
      permissions: [
        'user.profile.view',
        'user.profile.edit',
        'user.list.manage',
        'user.reviews.create',
        'user.comments.create',
      ]
    },
    {
      name: 'tester',
      displayName: 'Beta Tester',
      description: 'Beta tester with access to new features',
      isSystem: true,
      isDefault: false,
      priority: 2,
      permissions: [
        'user.profile.view',
        'user.profile.edit',
        'user.list.manage',
        'user.reviews.create',
        'user.comments.create',
        'feature.beta.access',
        'feature.advanced.search',
        'feature.export.data',
      ]
    },
    {
      name: 'moderator',
      displayName: 'Moderator',
      description: 'Content moderator with moderation permissions',
      isSystem: false,
      isDefault: false,
      priority: 3,
      permissions: [
        'user.profile.view',
        'user.profile.edit',
        'user.list.manage',
        'user.reviews.create',
        'user.comments.create',
        'moderation.reports.view',
        'moderation.reports.resolve',
        'moderation.users.warn',
        'moderation.content.delete',
        'content.reviews.moderate',
        'content.comments.moderate',
      ]
    },
    {
      name: 'admin',
      displayName: 'Administrator',
      description: 'Full system administrator with all permissions',
      isSystem: true,
      isDefault: false,
      priority: 10,
      permissions: permissions.map(p => p.key) // All permissions
    }
  ]

  console.log('Creating system roles...')
  for (const roleData of systemRoles) {
    const { permissions: rolePerms, ...roleInfo } = roleData
    
    const role = await prisma.role.upsert({
      where: { name: roleInfo.name },
      update: roleInfo,
      create: roleInfo,
    })

    // Assign permissions to role
    for (const permKey of rolePerms) {
      const permission = await prisma.permission.findUnique({
        where: { key: permKey }
      })

      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id
            }
          },
          update: { granted: true },
          create: {
            roleId: role.id,
            permissionId: permission.id,
            granted: true
          }
        })
      }
    }
  }
  console.log(`✅ Created ${systemRoles.length} system roles`)

  console.log('✨ Role and permission seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding roles and permissions:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

