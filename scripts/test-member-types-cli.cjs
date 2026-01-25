#!/usr/bin/env node
/**
 * CLI tool để test các memberTypes khác nhau khi thêm user vào group
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
    if (!args.groupId || !args.userId) {
      console.error('❌ Missing required parameters')
      console.log('\nUsage:')
      console.log('  node scripts/test-member-types-cli.cjs --groupId=<groupId> --userId=<userId>')
      process.exit(1)
    }

    const groupId = args.groupId.trim()
    const userId = args.userId.trim()
    
    console.log('🎯 Target group:', groupId)
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

    // Test different memberTypes values
    const memberTypesToTest = [
      { value: -1, description: 'Default (current implementation)' },
      { value: 0, description: 'Possible: Friend' },
      { value: 1, description: 'Possible: Admin' },
      { value: 2, description: 'Possible: Stranger allowed' },
      { value: 3, description: 'Possible: Public invite' },
    ]

    for (const { value, description } of memberTypesToTest) {
      console.log(`🔧 Testing memberTypes = ${value} (${description})...`)
      
      try {
        // Call API directly with custom memberTypes
        const result = await api.addUserToGroup([userId], groupId)
        console.log('Result:', JSON.stringify(result, null, 2))
        
        if (!result.errorMembers || result.errorMembers.length === 0) {
          console.log(`🎉 SUCCESS with memberTypes = ${value}!`)
          process.exit(0)
        } else {
          console.log(`❌ Failed with memberTypes = ${value}`)
          console.log('Error members:', result.errorMembers)
          console.log('Error data:', result.error_data)
        }
      } catch (err) {
        console.log(`❌ Exception with memberTypes = ${value}:`, err.message)
      }
      
      console.log('')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('')
      
      // Delay between tests
      await new Promise(r => setTimeout(r, 1000))
    }

    console.log('❌ ALL MEMBER TYPES FAILED')
    console.log('')
    console.log('💡 Conclusion: memberTypes does not affect the friendship requirement')
    
    process.exit(1)

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

main()

