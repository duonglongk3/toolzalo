#!/usr/bin/env node
/**
 * CLI tool để test thêm user vào nhóm
 * Usage:
 *   node scripts/add-user-to-group-cli.cjs --groupId=<groupId> --userId=<userId>
 *   node scripts/add-user-to-group-cli.cjs --groupId=<groupId> --userId=<userId1>,<userId2>
 */

const { Zalo } = require('../zca-js/dist/cjs/index.cjs')
const fs = require('fs')
const path = require('path')

// Parse command line arguments
const args = {}
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--([^=]+)=(.+)$/)
  if (match) {
    args[match[1]] = match[2]
  } else if (arg.startsWith('--')) {
    args[arg.slice(2)] = true
  }
})

async function main() {
  try {
    // Validate arguments
    if (!args.groupId) {
      console.error('❌ Missing --groupId parameter')
      console.log('\nUsage:')
      console.log('  node scripts/add-user-to-group-cli.cjs --groupId=<groupId> --userId=<userId>')
      console.log('  node scripts/add-user-to-group-cli.cjs --groupId=<groupId> --userId=<userId1>,<userId2>')
      console.log('  node scripts/add-user-to-group-cli.cjs --groupId=<groupId> --phone=<phone>')
      process.exit(1)
    }

    if (!args.userId && !args.phone) {
      console.error('❌ Missing --userId or --phone parameter')
      console.log('\nUsage:')
      console.log('  node scripts/add-user-to-group-cli.cjs --groupId=<groupId> --userId=<userId>')
      console.log('  node scripts/add-user-to-group-cli.cjs --groupId=<groupId> --userId=<userId1>,<userId2>')
      console.log('  node scripts/add-user-to-group-cli.cjs --groupId=<groupId> --phone=<phone>')
      process.exit(1)
    }

    const groupId = args.groupId.trim()
    console.log('🎯 Target group:', groupId)
    console.log('')

    // Read credentials from zalo-accounts.json (same as other scripts)
    const accountsPath = path.join(__dirname, '..', 'data', 'zalo-accounts.json')

    if (!fs.existsSync(accountsPath)) {
      console.error('❌ File not found:', accountsPath)
      console.log('Please login first using the main app')
      process.exit(1)
    }

    const accState = JSON.parse(fs.readFileSync(accountsPath, 'utf8'))
    const active = accState?.state?.activeAccount

    if (!active) {
      console.error('❌ No active account found in data/zalo-accounts.json')
      process.exit(1)
    }

    console.log('📁 Using account:', active.phone || active.name)

    // Parse cookie
    let cookieArr
    try {
      cookieArr = JSON.parse(active.cookie)
    } catch {
      console.error('❌ Invalid cookie format')
      process.exit(1)
    }

    if (!active.imei || !cookieArr) {
      console.error('❌ Invalid credentials')
      process.exit(1)
    }

    console.log('🔐 Logging in...')
    const zalo = new Zalo({})
    const api = await zalo.login({
      imei: active.imei,
      cookie: cookieArr,
      userAgent: active.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })

    // Test login
    try {
      const ownId = await api.getOwnId()
      console.log('✅ Logged in as:', ownId)
    } catch (loginError) {
      console.error('❌ Login failed:', loginError.message)
      process.exit(1)
    }

    // Resolve userIds from phone if provided
    let userIds = []

    if (args.phone) {
      console.log('📞 Resolving phone number to userId...')
      const phone = args.phone.trim()

      try {
        const result = await api.findUser(phone)
        console.log('Raw findUser result:', JSON.stringify(result, null, 2))

        // Try different paths to find userId
        let userId = null
        if (result?.data?.uid) {
          userId = result.data.uid
        } else if (result?.uid) {
          userId = result.uid
        } else if (result?.info?.data?.uid) {
          userId = result.info.data.uid
        }

        if (!userId) {
          console.error('❌ Could not find userId for phone:', phone)
          process.exit(1)
        }

        console.log('✅ Found userId:', userId)
        userIds = [userId]
      } catch (findError) {
        console.error('❌ findUser failed:', findError.message)
        process.exit(1)
      }
    } else {
      // Parse userIds from --userId parameter
      userIds = args.userId.split(',').map(id => id.trim()).filter(Boolean)
    }

    console.log('👥 User IDs to add:', userIds)
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // Step 1: Check if user is already a friend
    console.log('📝 Step 1: Checking friendship status...')
    let allFriends = []
    try {
      allFriends = await api.getAllFriends()
      console.log(`✅ Got ${allFriends?.length || 0} friends`)

      for (const userId of userIds) {
        const isFriend = allFriends?.some(f =>
          String(f.userId) === String(userId) ||
          String(f.uid) === String(userId) ||
          String(f.id) === String(userId)
        )
        console.log(`  ${isFriend ? '✅' : '❌'} User ${userId}: ${isFriend ? 'IS friend' : 'NOT friend'}`)
      }
    } catch (friendError) {
      console.log('⚠️ Could not check friendship:', friendError.message)
    }

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // Step 2: Check if users are already in the group
    console.log('📝 Step 2: Checking if users are already in group...')
    try {
      const groupInfo = await api.getGroupInfo(groupId)
      console.log('Group info:', {
        name: groupInfo?.groupName || groupInfo?.name,
        memberCount: groupInfo?.totalMember || groupInfo?.members?.length || 'unknown'
      })

      // Get group members
      const members = await api.getGroupMembersInfo(groupId)
      console.log(`✅ Got ${members?.length || 0} group members`)

      for (const userId of userIds) {
        const isMember = members?.some(m =>
          String(m.userId) === String(userId) ||
          String(m.uid) === String(userId) ||
          String(m.id) === String(userId)
        )
        console.log(`  ${isMember ? '⚠️' : '✅'} User ${userId}: ${isMember ? 'ALREADY in group' : 'NOT in group'}`)
      }
    } catch (groupError) {
      console.log('⚠️ Could not check group members:', groupError.message)
    }

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // Step 3: Try different API methods to add to group
    console.log('📝 Step 3: Testing different methods to add user to group...')
    console.log('  GroupId:', groupId, '(type:', typeof groupId, ')')
    console.log('  UserIds:', userIds, '(types:', userIds.map(id => typeof id).join(', '), ')')
    console.log('')

    // Ensure all IDs are strings
    const cleanUserIds = userIds.map(id => String(id).trim())
    const cleanGroupId = String(groupId).trim()

    console.log('  Cleaned GroupId:', cleanGroupId)
    console.log('  Cleaned UserIds:', cleanUserIds)
    console.log('')

    // Method 1: addUserToGroup with array
    console.log('🔧 Method 1: addUserToGroup(array, groupId)...')
    try {
      const result = await api.addUserToGroup(cleanUserIds, cleanGroupId)
      console.log('Result:', JSON.stringify(result, null, 2))

      if (!result.errorMembers || result.errorMembers.length === 0) {
        console.log('🎉 SUCCESS with Method 1!')
        process.exit(0)
      } else {
        console.log('❌ Method 1 failed with errorMembers:', result.errorMembers)
        console.log('Error data:', result.error_data)
      }
    } catch (err) {
      console.log('❌ Method 1 exception:', err.message)
    }

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // Method 2: addUserToGroup with single userId (not array)
    console.log('🔧 Method 2: addUserToGroup(singleUserId, groupId)...')
    for (const userId of cleanUserIds) {
      try {
        const result = await api.addUserToGroup(userId, cleanGroupId)
        console.log(`Result for ${userId}:`, JSON.stringify(result, null, 2))


        if (!result.errorMembers || result.errorMembers.length === 0) {
          console.log(`🎉 SUCCESS with Method 2 for user ${userId}!`)
          process.exit(0)
        } else {
          console.log(`❌ Method 2 failed for ${userId}:`, result.errorMembers)
        }
      } catch (err) {
        console.log(`❌ Method 2 exception for ${userId}:`, err.message)
      }
    }

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // Method 3: inviteUserToGroups (single user to single/multiple groups)
    console.log('🔧 Method 3: inviteUserToGroups(userId, groupId)...')
    for (const userId of cleanUserIds) {
      try {
        const result = await api.inviteUserToGroups(userId, cleanGroupId)
        console.log(`Result for ${userId}:`, JSON.stringify(result, null, 2))

        const gridMessageMap = result?.grid_message_map || {}
        const groupResult = gridMessageMap[cleanGroupId]

        if (groupResult?.error_code === 0 || groupResult?.data) {
          console.log(`🎉 SUCCESS with Method 3 for user ${userId}!`)
          process.exit(0)
        } else {
          console.log(`❌ Method 3 failed for ${userId}:`, groupResult?.error_message || 'Unknown error')
          console.log('Error code:', groupResult?.error_code)
        }
      } catch (err) {
        console.log(`❌ Method 3 exception for ${userId}:`, err.message)
      }
    }

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // Method 4: inviteUserToGroups with array of groups
    console.log('🔧 Method 4: inviteUserToGroups(userId, [groupId])...')
    for (const userId of cleanUserIds) {
      try {
        const result = await api.inviteUserToGroups(userId, [cleanGroupId])
        console.log(`Result for ${userId}:`, JSON.stringify(result, null, 2))

        const gridMessageMap = result?.grid_message_map || {}
        const groupResult = gridMessageMap[cleanGroupId]

        if (groupResult?.error_code === 0 || groupResult?.data) {
          console.log(`🎉 SUCCESS with Method 4 for user ${userId}!`)
          process.exit(0)
        } else {
          console.log(`❌ Method 4 failed for ${userId}:`, groupResult?.error_message || 'Unknown error')
          console.log('Error code:', groupResult?.error_code)
        }
      } catch (err) {
        console.log(`❌ Method 4 exception for ${userId}:`, err.message)
      }
    }

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log('❌ ALL METHODS FAILED')
    console.log('')
    console.log('📝 Summary:')
    console.log('  - Method 1: addUserToGroup(array, groupId) - FAILED')
    console.log('  - Method 2: addUserToGroup(singleUserId, groupId) - FAILED')
    console.log('  - Method 3: inviteUserToGroups(userId, groupId) - FAILED')
    console.log('  - Method 4: inviteUserToGroups(userId, [groupId]) - FAILED')
    console.log('')
    console.log('💡 Possible reasons:')
    console.log('  1. User must be friends to add to group')
    console.log('  2. Group settings prevent adding strangers')
    console.log('  3. User has blocked invitations')
    console.log('  4. API requires different parameters')

    process.exit(1)
  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

main()

