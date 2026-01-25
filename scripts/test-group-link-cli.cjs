#!/usr/bin/env node
/**
 * CLI tool để test group link - có thể đây là cách thêm người lạ vào nhóm
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
    if (!args.groupId) {
      console.error('❌ Missing --groupId parameter')
      console.log('\nUsage:')
      console.log('  node scripts/test-group-link-cli.cjs --groupId=<groupId> [--userId=<userId>]')
      process.exit(1)
    }

    const groupId = args.groupId.trim()
    const userId = args.userId?.trim()
    
    console.log('🎯 Target group:', groupId)
    if (userId) {
      console.log('🎯 Target user:', userId)
    }
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

    // Step 1: Get group link detail
    console.log('📝 Step 1: Getting group link detail...')
    try {
      const linkDetail = await api.getGroupLinkDetail(groupId)
      console.log('Link Detail:', JSON.stringify(linkDetail, null, 2))
      
      if (linkDetail?.link) {
        console.log('')
        console.log('✅ Group has link:', linkDetail.link)
        console.log('   Status:', linkDetail.status === 1 ? 'ENABLED' : 'DISABLED')
      } else {
        console.log('⚠️ Group does not have a link')
        console.log('')
        console.log('🔧 Trying to enable group link...')
        
        try {
          const enableResult = await api.enableGroupLink(groupId)
          console.log('Enable result:', JSON.stringify(enableResult, null, 2))
          
          if (enableResult?.link) {
            console.log('✅ Group link enabled:', enableResult.link)
          }
        } catch (err) {
          console.log('❌ Failed to enable group link:', err.message)
        }
      }
    } catch (err) {
      console.log('❌ getGroupLinkDetail failed:', err.message)
    }

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // Step 2: If userId provided, try to make them join via link
    if (userId) {
      console.log('📝 Step 2: Trying to make user join via group link...')
      console.log('⚠️ NOTE: This requires the user to accept the invitation')
      console.log('')
      
      // Unfortunately, we can't make another user join the group
      // They have to click the link themselves
      console.log('💡 Solution: Send the group link to the user via message')
      console.log('   Then they can click and join the group')
    }

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

main()

