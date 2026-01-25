#!/usr/bin/env node
/**
 * CLI tool để kiểm tra group settings
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
      console.log('  node scripts/check-group-settings-cli.cjs --groupId=<groupId>')
      process.exit(1)
    }

    const groupId = args.groupId.trim()
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

    // Get group info
    console.log('📝 Getting group info...')
    try {
      const groupInfo = await api.getGroupInfo(groupId)
      console.log('Group Info:', JSON.stringify(groupInfo, null, 2))
    } catch (err) {
      console.log('❌ getGroupInfo failed:', err.message)
    }

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // Get group settings
    console.log('📝 Getting group settings...')
    try {
      const settings = await api.getSettings()
      console.log('Settings:', JSON.stringify(settings, null, 2))
    } catch (err) {
      console.log('❌ getSettings failed:', err.message)
    }

    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')

    // Try to get group settings specifically
    console.log('📝 Checking if there is updateGroupSettings API...')
    console.log('Available API methods:', Object.keys(api).filter(k => k.toLowerCase().includes('group')).sort())

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

main()

