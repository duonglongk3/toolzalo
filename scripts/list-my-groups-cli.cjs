#!/usr/bin/env node
/**
 * CLI tool để list tất cả groups của user
 */

const { Zalo } = require('../zca-js/dist/cjs/index.cjs')
const fs = require('fs')
const path = require('path')

async function main() {
  try {
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

    // Get all groups
    console.log('📝 Getting all groups...')
    const groupsResult = await api.getAllGroups()

    // Extract group IDs
    const groupIds = groupsResult?.gridVerMap ? Object.keys(groupsResult.gridVerMap) : []

    if (groupIds.length === 0) {
      console.log('❌ No groups found')
      process.exit(0)
    }

    console.log(`✅ Found ${groupIds.length} groups`)
    console.log('🔍 Fetching group details...')
    console.log('')

    // Get details for each group (limit to first 20 to avoid too many requests)
    const groupsToFetch = groupIds.slice(0, 20)
    const groupDetails = []

    for (const groupId of groupsToFetch) {
      try {
        const info = await api.getGroupInfo(groupId)
        const groupData = info?.gridInfoMap?.[groupId]

        if (groupData) {
          groupDetails.push({
            id: groupId,
            name: groupData.name,
            totalMembers: groupData.totalMember,
            creatorId: groupData.creatorId,
            adminIds: groupData.adminIds || []
          })
        }
      } catch (err) {
        // Skip failed groups
      }
    }

    // Find "test 3" group
    const test3Group = groupDetails.find(g =>
      g.name?.toLowerCase().includes('test 3') ||
      g.name?.toLowerCase().includes('test3')
    )

    if (test3Group) {
      console.log('🎯 Found "test 3" group:')
      console.log('   Group ID:', test3Group.id)
      console.log('   Name:', test3Group.name)
      console.log('   Members:', test3Group.totalMembers)
      console.log('')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('')
    }

    // List fetched groups
    console.log(`📋 First ${groupDetails.length} groups:`)
    groupDetails.forEach((g, i) => {
      console.log(`${i + 1}. [${g.id}] ${g.name} (${g.totalMembers} members)`)
    })

    console.log('')
    console.log(`💡 Total groups: ${groupIds.length} (showing first ${groupDetails.length})`)

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

main()

