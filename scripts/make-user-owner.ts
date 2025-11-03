#!/usr/bin/env bun
/**
 * Make User Owner Script
 * 
 * Updates a user's role to OWNER in the database
 */

import { db } from '../src/lib/db'

async function makeUserOwner(userId: string) {
  try {
    console.log(`🔍 Looking for user with ID: ${userId}`)
    
    // First, let's check if the user exists
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        email: true, 
        username: true, 
        primaryRoleId: true,
        primaryRole: {
          select: {
            name: true,
            displayName: true
          }
        },
        createdAt: true,
        lastLoginAt: true
      }
    })

    if (!user) {
      console.log('❌ User not found with ID:', userId)
      return
    }

    console.log('👤 Current user info:')
    console.log(`   ID: ${user.id}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Username: ${user.username}`)
    console.log(`   Current Role: ${user.primaryRole.displayName} (${user.primaryRole.name})`)
    console.log(`   Created: ${user.createdAt}`)
    console.log(`   Last Login: ${user.lastLoginAt || 'Never'}`)

    // Find the OWNER role
    console.log('\n🔍 Looking for OWNER role...')
    const ownerRole = await db.role.findFirst({
      where: { 
        name: 'OWNER'
      },
      select: {
        id: true,
        name: true,
        displayName: true
      }
    })

    if (!ownerRole) {
      console.log('❌ OWNER role not found in database')
      console.log('📋 Available roles:')
      const allRoles = await db.role.findMany({
        select: { name: true, displayName: true }
      })
      allRoles.forEach(role => {
        console.log(`   - ${role.displayName} (${role.name})`)
      })
      return
    }

    console.log(`✅ Found OWNER role: ${ownerRole.displayName} (${ownerRole.name})`)

    // Update the user to be an owner
    console.log('\n🔄 Updating user role to OWNER...')
    
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: { 
        primaryRoleId: ownerRole.id,
        updatedAt: new Date()
      },
      select: { 
        id: true, 
        email: true, 
        username: true, 
        primaryRoleId: true,
        primaryRole: {
          select: {
            name: true,
            displayName: true
          }
        },
        updatedAt: true 
      }
    })

    console.log('✅ User successfully updated to OWNER!')
    console.log('📋 Updated user info:')
    console.log(`   ID: ${updatedUser.id}`)
    console.log(`   Email: ${updatedUser.email}`)
    console.log(`   Username: ${updatedUser.username}`)
    console.log(`   New Role: ${updatedUser.primaryRole.displayName} (${updatedUser.primaryRole.name})`)
    console.log(`   Updated: ${updatedUser.updatedAt}`)
    
    // Verify the change
    const verification = await db.user.findUnique({
      where: { id: userId },
      select: { 
        primaryRole: {
          select: {
            name: true,
            displayName: true
          }
        }
      }
    })
    
    if (verification?.primaryRole.name === 'OWNER') {
      console.log('\n🎉 Verification successful! User is now an OWNER.')
    } else {
      console.log('\n❌ Verification failed! Role was not updated correctly.')
    }

  } catch (error) {
    console.error('❌ Error updating user:', error)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

// Get user ID from command line arguments
const userId = process.argv[2]

if (!userId) {
  console.log('❌ Please provide a user ID')
  console.log('Usage: bun run scripts/make-user-owner.ts <user-id>')
  process.exit(1)
}

// Validate user ID format (basic check)
if (userId.length < 10) {
  console.log('❌ Invalid user ID format')
  process.exit(1)
}

console.log('🚀 AnimeSenpai - Make User Owner Script')
console.log('=====================================\n')

makeUserOwner(userId)
