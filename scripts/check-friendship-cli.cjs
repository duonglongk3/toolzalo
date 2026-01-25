#!/usr/bin/env node
/**
 * CLI tool để kiểm tra chi tiết friendship status
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
    if (!args.userId) {
      console.error('❌ Missing --userId parameter')
      console.log('\nUsage:')
      console.log('  node scripts/check-friendship-cli.cjs --userId=<userId>')
      process.exit(1)
    }

    const userId = args.userId.trim()
    console.log('🎯 Target user:', userId)
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

    // Get all friends
    console.log('📝 Getting all friends...')
    const allFriends = await api.getAllFriends()
    console.log(`✅ Got ${allFriends?.length || 0} friends`)
    console.log('')

    // Search for the user in friends list
    const friend = allFriends?.find(f => 
      String(f.userId) === String(userId) || 
      String(f.uid) === String(userId) ||
      String(f.id) === String(userId)
    )

    if (friend) {
      console.log('✅ USER IS A FRIEND!')
      console.log('Friend data:', JSON.stringify(friend, null, 2))
    } else {
      console.log('❌ USER IS NOT A FRIEND')
      console.log('')
      console.log('Checking first 5 friends structure:')
      if (allFriends && allFriends.length > 0) {
        allFriends.slice(0, 5).forEach((f, i) => {
          console.log(`Friend ${i + 1}:`, {
            userId: f.userId,
            uid: f.uid,
            id: f.id,
            name: f.displayName || f.zalo_name || f.name
          })
        })
      }
    }

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

main()

