#!/usr/bin/env node
/**
 * CLI tool để verify friendship và test thêm vào nhóm
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
    if (!args.phone || !args.groupId) {
      console.error('❌ Missing required parameters')
      console.log('\nUsage:')
      console.log('  node scripts/verify-friendship-and-add-cli.cjs --phone=<phone> --groupId=<groupId>')
      process.exit(1)
    }

    const phone = args.phone.trim()
    const groupId = args.groupId.trim()
    
    console.log('🎯 Target phone:', phone)
    console.log('🎯 Target group:', groupId)
    console.log('')

    // Read credentials
    const accountsPath = path.join(__dirname, '..', 'data', 'zalo-accounts.json')
    
    if (!fs.existsSync(accountsPath)) {
      console.error('❌ File not found:', accountsPath)
      process.exit(1)
    }

    const accState = JSON.parse(fs.readFileSync(accountsPath, 'utf8'))
    const active = accState?.state?.activeAccount
    
    if (!active) {
      console.error('❌ No active account found')
      process.exit(1)
    }

    console.log('📁 Using account:', active.phone || active.name)

    let cookieArr
    try {
      cookieArr = JSON.parse(active.cookie)
    } catch {
      console.error('❌ Invalid cookie format')
      process.exit(1)
    }

    console.log('🔐 Logging in...')
    const zalo = new Zalo({})
    const api = await zalo.login({
      imei: active.imei,
      cookie: cookieArr,
      userAgent: active.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })

    const ownId = await api.getOwnId()
    console.log('✅ Logged in as:', ownId)
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // Step 1: Find user by phone
    console.log('📝 Step 1: Finding user by phone...')
    let userInfo
    try {
      userInfo = await api.findUser(phone)
      console.log('User info:', JSON.stringify(userInfo, null, 2))
      
      if (!userInfo || !userInfo.uid) {
        console.error('❌ User not found or invalid')
        process.exit(1)
      }
      
      console.log('✅ Found user:', userInfo.uid)
      console.log('   Name:', userInfo.display_name || userInfo.zalo_name)
    } catch (err) {
      console.error('❌ findUser failed:', err.message)
      process.exit(1)
    }

    const userId = userInfo.uid

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // Step 2: Check friendship - Method 1: getAllFriends
    console.log('📝 Step 2: Checking friendship (Method 1: getAllFriends)...')
    const allFriends = await api.getAllFriends()
    console.log(`Got ${allFriends?.length || 0} friends`)
    
    const isFriendMethod1 = allFriends?.some(f => 
      String(f.userId) === String(userId) || 
      String(f.uid) === String(userId) ||
      String(f.id) === String(userId)
    )
    
    console.log(`Method 1 result: ${isFriendMethod1 ? '✅ IS FRIEND' : '❌ NOT FRIEND'}`)

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // Step 3: Check friendship - Method 2: Try to get user profile
    console.log('📝 Step 3: Checking friendship (Method 2: getStrangerInfo)...')
    try {
      const strangerInfo = await api.getStrangerInfo(userId)
      console.log('Stranger info:', JSON.stringify(strangerInfo, null, 2))
      
      // If we can get stranger info, they might not be a friend
      // But this is not conclusive
      console.log('Method 2 result: Got stranger info (might not be friend)')
    } catch (err) {
      console.log('Method 2 failed:', err.message)
      console.log('(This might mean they ARE a friend)')
    }

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // Step 4: Check if already in group
    console.log('📝 Step 4: Checking if user is already in group...')
    try {
      const groupInfo = await api.getGroupInfo(groupId)
      const memVerList = groupInfo?.gridInfoMap?.[groupId]?.memVerList || []
      
      const isInGroup = memVerList.some(mem => {
        const memberId = String(mem).split('_')[0]
        return memberId === String(userId)
      })
      
      console.log(`User ${isInGroup ? '✅ IS' : '❌ IS NOT'} already in group`)
      
      if (isInGroup) {
        console.log('⚠️ User is already a member, adding will return success but not actually add')
      }
    } catch (err) {
      console.log('Could not check group membership:', err.message)
    }

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // Step 5: Try to add to group
    console.log('📝 Step 5: Trying to add user to group...')
    try {
      const result = await api.addUserToGroup([userId], groupId)
      console.log('Result:', JSON.stringify(result, null, 2))
      
      if (!result.errorMembers || result.errorMembers.length === 0) {
        console.log('🎉 SUCCESS! User added to group (or already in group)')
        console.log('')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('')
        console.log('📊 FINAL CONCLUSION:')
        console.log(`   Phone: ${phone}`)
        console.log(`   UserId: ${userId}`)
        console.log(`   Is Friend (getAllFriends): ${isFriendMethod1 ? 'YES' : 'NO'}`)
        console.log(`   Add to Group: SUCCESS`)
        console.log('')
        console.log('💡 This proves that:')
        if (!isFriendMethod1) {
          console.log('   ✅ NON-FRIENDS CAN BE ADDED TO GROUPS!')
          console.log('   ✅ The friendship requirement is NOT enforced!')
        } else {
          console.log('   ⚠️ User is a friend, so this test is inconclusive')
        }
        process.exit(0)
      } else {
        console.log('❌ FAILED to add user')
        console.log('Error members:', result.errorMembers)
        console.log('Error data:', result.error_data)
        
        // Check error codes
        const error188 = result.error_data?.['188'] || []
        const error269 = result.error_data?.['269'] || []
        
        if (error188.length > 0 || error269.length > 0) {
          console.log('')
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('')
          console.log('📊 FINAL CONCLUSION:')
          console.log(`   Phone: ${phone}`)
          console.log(`   UserId: ${userId}`)
          console.log(`   Is Friend (getAllFriends): ${isFriendMethod1 ? 'YES' : 'NO'}`)
          console.log(`   Add to Group: FAILED (Error 188/269 - Not friend)`)
          console.log('')
          console.log('💡 This proves that:')
          console.log('   ❌ FRIENDSHIP IS REQUIRED to add to groups')
          console.log('   ❌ Cannot add strangers to groups via API')
        }
        process.exit(1)
      }
    } catch (err) {
      console.log('❌ Exception:', err.message)
      process.exit(1)
    }

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

main()

