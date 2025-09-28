#!/usr/bin/env node

// CLI Test Script for Zalo Manager
const fs = require('fs')
const path = require('path')

// Test credentials
const TEST_CREDENTIALS = {
  cookies: [
    {"domain":".zalo.me","expirationDate":1792799768.602958,"hostOnly":false,"httpOnly":false,"name":"__zi","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"3000.SSZzejyD7zS_Wk-fXGO5s3FDehJB21sRRz-e-eSB6z0XsgpqXGLLsIRMv_6305hT9zFkyG.1"},
    {"domain":".zalo.me","expirationDate":1792799768.603332,"hostOnly":false,"httpOnly":false,"name":"__zi-legacy","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"3000.SSZzejyD7zS_Wk-fXGO5s3FDehJB21sRRz-e-eSB6z0XsgpqXGLLsIRMv_6305hT9zFkyG.1"},
    {"domain":".zalo.me","expirationDate":1787587716.480857,"hostOnly":false,"httpOnly":false,"name":"_ga_907M127EPP","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"GS2.1.s1753027509$o1$g1$t1753027716$j60$l0$h0"},
    {"domain":".zalo.me","expirationDate":1758275294,"hostOnly":false,"httpOnly":false,"name":"_gid","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"GA1.2.417808674.1758068672"},
    {"domain":".zalo.me","expirationDate":1758326166.758339,"hostOnly":false,"httpOnly":false,"name":"_zlang","path":"/","sameSite":"unspecified","secure":true,"session":false,"storeId":"0","value":"vn"},
    {"domain":".zalo.me","expirationDate":1789611858.390676,"hostOnly":false,"httpOnly":true,"name":"zpsid","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"qxu-.366262808.125.0Db5E-23lSduEMdSx8EzoPNmp_hMjO__qhkDyKjfjhYHUxHZuLAc0uY3lSa"},
    {"domain":".chat.zalo.me","expirationDate":1759405579.492609,"hostOnly":false,"httpOnly":true,"name":"zpw_sek","path":"/","sameSite":"lax","secure":true,"session":false,"storeId":"0","value":"wFs7.366262808.a0.q1U0BuT9sX-VymuAfadQ7_nhltIbS_XFpoEU9h4YgKMn7e1lumYESyKdhtt6TESz-k8m5FOu8XOjI0i4JI7Q7m"},
    {"domain":".zalo.me","expirationDate":1758412567.629572,"hostOnly":false,"httpOnly":true,"name":"app.event.zalo.me","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"2649719442011180108"},
    {"domain":".zalo.me","expirationDate":1792748894.964225,"hostOnly":false,"httpOnly":false,"name":"_ga","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"GA1.2.1739335627.1749465500"},
    {"domain":".zalo.me","expirationDate":1792748895.878953,"hostOnly":false,"httpOnly":false,"name":"_ga_RYD7END4JE","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"GS2.2.s1758188895$o8$g1$t1758188895$j60$l0$h0"},
    {"domain":".zalo.me","expirationDate":1792748895.887064,"hostOnly":false,"httpOnly":false,"name":"_ga_YS1V643LGV","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"GS2.1.s1758188894$o4$g0$t1758188895$j59$l0$h0"}
  ],
  imei: "7d0954c9-677a-4a16-a6a3-2e13e7d0f4e8-0fe6feb54289f4c67027ec06cc2131f8",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
}

const TEST_PHONE = "0984718562"
const TEST_GROUP_LINK = "https://zalo.me/g/rmdlrb837"
const TEST_FRIENDS = ["Văn Sơn", "Đặng Dương Long"]

let zaloApi = null

async function initializeZalo() {
  try {
    console.log('🔄 Initializing Zalo API...')

    // Try to load zca-js
    const zcaPath = path.join(__dirname, 'zca-js')
    if (!fs.existsSync(zcaPath)) {
      throw new Error('zca-js directory not found')
    }

    // Check if zca-js is built
    const distPath = path.join(zcaPath, 'dist', 'index.js')
    if (!fs.existsSync(distPath)) {
      console.log('📦 Building zca-js...')
      const { execSync } = require('child_process')
      execSync('npm run build', { cwd: zcaPath, stdio: 'inherit' })
    }

    // Import zca-js
    const { Zalo } = require('./zca-js/dist/index.js')

    console.log('✅ zca-js loaded successfully')
    return Zalo
  } catch (error) {
    console.error('❌ Failed to initialize zca-js:', error.message)
    return null
  }
}

async function testLogin() {
  console.log('\n🔐 Testing Login...')

  try {
    const Zalo = await initializeZalo()
    if (!Zalo) {
      console.log('❌ zca-js not available, cannot test real API')
      return false
    }

    const zaloInstance = new Zalo()

    console.log('🔄 Attempting login...')
    const credentials = {
      cookie: TEST_CREDENTIALS.cookies,
      imei: TEST_CREDENTIALS.imei,
      userAgent: TEST_CREDENTIALS.userAgent
    }

    console.log('📋 Using credentials:', {
      imei: credentials.imei,
      userAgent: credentials.userAgent,
      cookieCount: credentials.cookie.length
    })

    const loginResult = await zaloInstance.login(credentials)

    // Check if login was successful by looking for API context
    if (loginResult && loginResult.listener && loginResult.listener.ctx) {
      console.log('✅ Login successful!')
      console.log('📱 User ID:', loginResult.listener.ctx.uid)
      console.log('📱 Language:', loginResult.listener.ctx.language)

      // Store the API object for other tests
      zaloApi = loginResult
      return true
    } else {
      console.log('❌ Login failed - no valid API context')
      console.log('📋 Login result keys:', Object.keys(loginResult || {}))
      return false
    }
  } catch (error) {
    console.error('❌ Login error:', error.message)
    console.error('📋 Error stack:', error.stack)
    return false
  }
}

async function testGetFriends() {
  console.log('\n👥 Testing Get Friends...')

  if (!zaloApi) {
    console.log('⚠️  API not initialized, skipping test')
    return []
  }

  try {
    console.log('🔄 Fetching friends list...')
    const friends = await zaloApi.getAllFriends()

    console.log(`✅ Found ${friends.length} friends`)

    if (friends.length > 0) {
      console.log('📋 Sample friends:')
      friends.slice(0, 5).forEach(friend => {
        console.log(`  - ${friend.displayName || friend.name} (ID: ${friend.userId})`)
      })

      if (friends.length > 5) {
        console.log(`  ... and ${friends.length - 5} more`)
      }
    }

    // Look for test friends
    const testFriends = friends.filter(friend =>
      TEST_FRIENDS.some(name =>
        friend.displayName?.toLowerCase().includes(name.toLowerCase()) ||
        friend.name?.toLowerCase().includes(name.toLowerCase())
      )
    )

    if (testFriends.length > 0) {
      console.log('🎯 Found test friends:')
      testFriends.forEach(friend => {
        console.log(`  - ${friend.displayName || friend.name} (ID: ${friend.userId})`)
      })
    } else {
      console.log('⚠️  Test friends not found in friends list')
    }

    return friends
  } catch (error) {
    console.error('❌ Get friends error:', error.message)
    return []
  }
}

async function testGetGroups() {
  console.log('\n👥 Testing Get Groups...')

  if (!zaloApi) {
    console.log('⚠️  API not initialized, skipping test')
    return
  }

  try {
    console.log('🔄 Fetching groups list...')
    const groups = await zaloApi.getAllGroups()

    console.log(`✅ Found ${Object.keys(groups.gridVerMap || {}).length} groups`)

    // Try to find the test group
    const groupIds = Object.keys(groups.gridVerMap || {})
    if (groupIds.length > 0) {
      console.log('📋 Group IDs:')
      groupIds.slice(0, 5).forEach(id => {
        console.log(`  - ${id}`)
      })

      if (groupIds.length > 5) {
        console.log(`  ... and ${groupIds.length - 5} more`)
      }
    }

    return groups
  } catch (error) {
    console.error('❌ Get groups error:', error.message)
    return { gridVerMap: {} }
  }
}

// Test fetching full group infos for all groups (batch + retry) + anomaly report
async function testGetAllGroupInfos(options = {}) {
  const { batchSize = 20, maxGroups = 0, delayMs = 200, sample = 10, outFile = '' } = options
  console.log('\n📘 Testing Get FULL Group Infos...')

  if (!zaloApi) {
    console.log('⚠️  API not initialized, skipping test')
    return { total: 0, ok: 0, missing: [], anomalies: {} }
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  const hasData = (gi) => !!(gi && (gi.name || gi.avatar || gi.totalMember || gi.membersCount))
  const getCount = (gi) => gi?.totalMember ?? gi?.membersCount ?? 0
  const findKeyFor = (map, wanted) => {
    if (!wanted || !map) return null
    const keys = Object.keys(map)
    const w = String(wanted)
    const wBase = w.split('_')[0]
    if (map[w]) return w
    if (map[wBase]) return wBase
    const k1 = keys.find(k => k === w || k === wBase || k.split('_')[0] === w || k.split('_')[0] === wBase)
    if (k1) return k1
    return keys.find(k => k.includes(w) || k.includes(wBase)) || null
  }

  try {
    console.log('🔄 Fetching groups list...')
    const groups = await zaloApi.getAllGroups()
    let ids = Object.keys(groups.gridVerMap || {})
    if (maxGroups && ids.length > maxGroups) ids = ids.slice(0, maxGroups)

    console.log(`✅ Found ${ids.length} groups to enrich`)

    let ok = 0
    const missing = []
    const details = []
    let noName = 0, noAvatar = 0, zeroMember = 0

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      try {
        const res = await zaloApi.getGroupInfo(batch)
        const infoMap = (res && (res.data?.gridInfoMap || res.gridInfoMap || res.info?.gridInfoMap)) || {}
        for (const id of batch) {
          const key = findKeyFor(infoMap, id)
          const gi = key ? infoMap[key] : undefined
          if (hasData(gi)) {
            ok++
            const name = gi?.name || ''
            const avatar = gi?.avatar || ''
            const m = getCount(gi)
            if (!name) noName++
            if (!avatar) noAvatar++
            if (!m) zeroMember++
            details.push({ id, name, memberCount: m, avatar, hasAvatar: !!avatar })
          } else {
            missing.push(id)
          }
        }
      } catch (e) {
        console.warn('⚠️  Batch error, marking as missing:', e?.message || e)
        missing.push(...batch)
      }
      await sleep(delayMs)
    }

    // Sample output
    console.log(`\n📋 Sample ${Math.min(sample, details.length)} groups:`)
    details.slice(0, sample).forEach(g => {
      console.log(`  - ${g.id} | name: ${g.name?.slice(0, 40)} | members: ${g.memberCount} | avatar: ${g.hasAvatar ? 'yes' : 'no'}`)
    })

    const anomalies = { noName, noAvatar, zeroMember }
    console.log(`\n📊 Groups info summary: OK ${ok}/${ids.length}, Missing ${missing.length}`)
    console.log('   Anomalies -> noName:', noName, ', noAvatar:', noAvatar, ', zeroMember:', zeroMember)
    if (missing.length) console.log('   Missing sample:', missing.slice(0, 10).join(', '), missing.length > 10 ? '...' : '')

    if (outFile) {
      try {
        require('fs').writeFileSync(outFile, JSON.stringify({ ids, details, missing, anomalies }, null, 2))
        console.log('📝 Written details to', outFile)
      } catch {}
    }

    return { total: ids.length, ok, missing, anomalies, details }
  } catch (error) {
    console.error('❌ Get full group infos error:', error.message)
    return { total: 0, ok: 0, missing: [], anomalies: {}, details: [] }
  }
}

// Minimal runner when only need to test groups info
async function runGroupsInfoOnly(cliArgs = []) {
  console.log('🚀 CLI – Groups Info Only')
  console.log('='.repeat(50))

  // Parse CLI args
  const getNum = (flag, def) => {
    const raw = (cliArgs.find(a => a.startsWith(flag + '=')) || '').split('=')[1]
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : def
  }
  const getStr = (flag, def) => {
    const raw = (cliArgs.find(a => a.startsWith(flag + '=')) || '').split('=')[1]
    return raw ? String(raw) : def
  }

  const sample = getNum('--sample', 10)
  const outFile = getStr('--out', '')
  const maxGroups = getNum('--max', 0)
  const batchSize = getNum('--batch', 20)
  const delayMs = getNum('--delay', 250)
  const writeStore = cliArgs.includes('--write-store')

  const logged = await testLogin()
  if (!logged) {
    console.log('❌ Cannot login – abort')
    process.exitCode = 1
    return
  }
  const res = await testGetAllGroupInfos({ batchSize, delayMs, sample, maxGroups, outFile })

  if (writeStore) {
    try {
      const dataDir = path.join(process.cwd(), 'data')
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
      const storePath = path.join(dataDir, 'zalo-groups.json')
      const groups = (res.details || []).map(g => ({
        id: String(g.id),
        name: g.name || `Nhóm ${g.id}`,
        description: '',
        memberCount: Number(g.memberCount) || 0,
        isAdmin: false,
        avatar: g.avatar || '',
        joinedAt: new Date().toISOString(),
        type: 'private',
      }))
      const payload = { state: { groups }, version: 0 }
      fs.writeFileSync(storePath, JSON.stringify(payload))
      console.log('📝 Written store to', storePath, `(${groups.length} groups)`)
    } catch (e) {
      console.warn('⚠️ Failed to write store file:', e?.message || e)
    }
  }

  console.log('\n✅ Done. OK:', res.ok, '/', res.total, '- Missing:', res.missing.length)
}


async function testJoinGroup() {
  console.log('\n🔗 Testing Join Group...')

  if (!zaloApi) {
    console.log('⚠️  API not initialized, skipping test')
    return
  }

  try {
    console.log(`🔄 Attempting to join group: ${TEST_GROUP_LINK}`)
    const result = await zaloApi.joinGroupLink(TEST_GROUP_LINK)

    if (result && result.error === 0) {
      console.log('✅ Successfully joined group!')
      console.log('📋 Group info:', result.data)
    } else {
      console.log('⚠️  Join group result:', result?.message || 'Already in group or failed')
    }

    return result
  } catch (error) {
    console.error('❌ Join group error:', error.message)
    return null
  }
}

async function testSendMessage() {
  console.log('\n💬 Testing Send Message...')

  if (!zaloApi) {
    console.log('⚠️  API not initialized, skipping test')
    return
  }

  try {
    // Try to find user by phone number first
    console.log(`🔍 Finding user by phone: ${TEST_PHONE}`)
    let userId = null

    try {
      const userInfo = await zaloApi.findUser(TEST_PHONE)
      if (userInfo && userInfo.data && userInfo.data.length > 0) {
        userId = userInfo.data[0].userId
        console.log(`✅ Found user ID by phone: ${userId}`)
      }
    } catch (phoneError) {
      console.log('⚠️  Phone search failed:', phoneError.message)
    }

    // If phone search failed, try to find in friends list
    if (!userId) {
      console.log('🔍 Searching in friends list...')
      const friends = await zaloApi.getAllFriends()
      const testFriend = friends.find(friend =>
        TEST_FRIENDS.some(name =>
          friend.displayName?.toLowerCase().includes(name.toLowerCase()) ||
          friend.name?.toLowerCase().includes(name.toLowerCase())
        )
      )

      if (testFriend) {
        userId = testFriend.userId
        console.log(`✅ Found test friend: ${testFriend.displayName} (ID: ${userId})`)
      } else {
        console.log('❌ No suitable test user found')
        return null
      }
    }

    const testMessage = `🤖 Test message from Zalo Manager CLI - ${new Date().toLocaleString('vi-VN')}`

    console.log(`� Sending test message to user ID: ${userId}`)
    console.log(`📝 Message: ${testMessage}`)

    const { ThreadType } = require('./zca-js/dist/index.js')
    const result = await zaloApi.sendMessage(testMessage, userId, ThreadType.User)

    if (result && result.message) {
      console.log('✅ Message sent successfully!')
      console.log('📨 Message ID:', result.message.msgId)
    } else {
      console.log('❌ Failed to send message:', result)
    }

    return result
  } catch (error) {
    console.error('❌ Send message error:', error.message)
    return null
  }
}

async function testGroupMessage() {
  console.log('\n💬 Testing Group Message...')

  if (!zaloApi) {
    console.log('⚠️  API not initialized, skipping test')
    return
  }

  try {
    // First get groups to find a group ID
    const groups = await zaloApi.getAllGroups()
    const groupIds = Object.keys(groups.gridVerMap || {})

    if (groupIds.length === 0) {
      console.log('⚠️  No groups found to test with')
      return
    }

    const testGroupId = groupIds[0]
    const testMessage = `🤖 Test group message from Zalo Manager CLI - ${new Date().toLocaleString('vi-VN')}`

    console.log(`🔄 Sending test message to group: ${testGroupId}`)
    console.log(`📝 Message: ${testMessage}`)

    const { ThreadType } = require('./zca-js/dist/index.js')
    const result = await zaloApi.sendMessage(testMessage, testGroupId, ThreadType.Group)

    if (result && result.message) {
      console.log('✅ Group message sent successfully!')
      console.log('📨 Message ID:', result.message.msgId)
    } else {
      console.log('❌ Failed to send group message:', result)
    }

    return result
  } catch (error) {
    console.error('❌ Send group message error:', error.message)
    return null
  }
}

async function testGetGroupMembers() {
  console.log('\n👥 Testing Get Group Members...')

  if (!zaloApi) {
    console.log('⚠️  API not initialized, skipping test')
    return
  }

  try {
    // First get groups to find a group ID
    const groups = await zaloApi.getAllGroups()
    const groupIds = Object.keys(groups.gridVerMap || {})

    if (groupIds.length === 0) {
      console.log('⚠️  No groups found to test with')
      return
    }

    const testGroupId = groupIds[0]
    console.log(`🔄 Getting members for group: ${testGroupId}`)

    // Get group info first to get member IDs
    const groupInfo = await zaloApi.getGroupInfo(testGroupId)
    console.log(`📋 Group name: ${groupInfo.data?.name || 'Unknown'}`)
    console.log(`👥 Member count: ${groupInfo.data?.totalMember || 'Unknown'}`)

    // Get member IDs from group info
    const memberIds = groupInfo.data?.members || []
    console.log(`✅ Found ${memberIds.length} member IDs`)

    if (memberIds.length > 0) {
      // Get detailed member info for first few members
      const sampleMemberIds = memberIds.slice(0, 5)
      const memberDetails = await zaloApi.getGroupMembersInfo(sampleMemberIds)

      console.log('👥 Sample members:')
      Object.values(memberDetails.data?.profiles || {}).forEach(member => {
        console.log(`  - ${member.displayName} (ID: ${member.id})`)
      })
    }

    return memberIds
  } catch (error) {
    console.error('❌ Get group members error:', error.message)
    return []
  }
}

async function runAllTests() {
  console.log('🚀 Starting Zalo Manager CLI Tests')
  console.log('=' .repeat(50))

  const results = {
    login: false,
    friends: [],
    groups: { gridVerMap: {} },
    joinGroup: null,
    sendMessage: null,
    groupMessage: null,
    groupMembers: []
  }

  try {
    // Test login
    results.login = await testLogin()

    if (results.login) {
      // Test friends
      results.friends = await testGetFriends()

      // Test groups
      results.groups = await testGetGroups()

      // Test join group
      results.joinGroup = await testJoinGroup()

      // Test send message
      results.sendMessage = await testSendMessage()

      // Test group message
      results.groupMessage = await testGroupMessage()

      // Test get group members
      results.groupMembers = await testGetGroupMembers()
    }

  } catch (error) {
    console.error('❌ Test suite error:', error.message)
  }

  // Summary
  console.log('\n📊 Test Results Summary')
  console.log('=' .repeat(50))
  console.log(`🔐 Login: ${results.login ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`👥 Friends: ${results.friends && results.friends.length > 0 ? '✅ PASS' : '⚠️  SKIP'} (${results.friends ? results.friends.length : 0} found)`)
  console.log(`👥 Groups: ${results.groups && Object.keys(results.groups.gridVerMap || {}).length > 0 ? '✅ PASS' : '⚠️  SKIP'} (${results.groups ? Object.keys(results.groups.gridVerMap || {}).length : 0} found)`)
  console.log(`🔗 Join Group: ${results.joinGroup ? '✅ PASS' : '⚠️  SKIP'}`)
  console.log(`💬 Send Message: ${results.sendMessage ? '✅ PASS' : '⚠️  SKIP'}`)
  console.log(`💬 Group Message: ${results.groupMessage ? '✅ PASS' : '⚠️  SKIP'}`)

  console.log(`👥 Group Members: ${results.groupMembers && results.groupMembers.length > 0 ? '✅ PASS' : '⚠️  SKIP'} (${results.groupMembers ? results.groupMembers.length : 0} found)`)

  console.log('\n🎉 Test suite completed!')
}

async function runSendGroupRepeat(cliArgs = []) {
  console.log('\n⏱️  Send Group with Repeat (CLI)')
  console.log('='.repeat(50))

  const getNum = (flag, def) => {
    const raw = (cliArgs.find(a => a.startsWith(flag + '=')) || '').split('=')[1]
    const n = Number(raw)
    return Number.isFinite(n) ? n : def
  }
  const getStr = (flag, def) => {
    const raw = (cliArgs.find(a => a.startsWith(flag + '=')) || '').split('=')[1]
    return raw ? String(raw) : def
  }
  const has = (flag) => cliArgs.includes(flag)

  const groupIdArg = getStr('--group-id', '')
  const groupNameArg = getStr('--group-name', '')
  const message = getStr('--message', '[TEST]')
  const repeat = Math.max(1, Math.floor(getNum('--repeat', 1)))
  const intervalHours = Math.max(0.001, getNum('--interval-hours', 1)) // cho phép số thập phân (giờ)
  const dryRun = has('--dry-run')

  const logged = await testLogin()
  if (!logged) { console.log('❌ Cannot login – abort'); process.exitCode = 1; return }

  // Tìm group ID
  let targetGroupId = ''
  let targetGroupName = ''
  try {
    if (groupIdArg) {
      targetGroupId = groupIdArg
    } else {
      console.log('🔎 Resolving group by name...')
      // Lấy full info để khớp theo tên
      const info = await testGetAllGroupInfos({ batchSize: 20, delayMs: 150, sample: 0, maxGroups: 0 })
      const q = groupNameArg.trim().toLowerCase()
      const matched = (info.details || []).find(g => (g.name || '').toLowerCase().includes(q))
      if (matched) {
        targetGroupId = String(matched.id)
        targetGroupName = matched.name || ''
      }
    }
  } catch (e) {
    console.warn('⚠️  Resolve group error:', e?.message || e)
  }

  if (!targetGroupId) {
    console.log('❌ Không xác định được group. Hãy truyền --group-id=... hoặc --group-name=...')
    return
  }

  console.log('🎯 Target group:', targetGroupId, targetGroupName ? `| name: ${targetGroupName}` : '')
  console.log('📝 Message:', message)
  console.log('🔁 Repeat:', repeat, '| ⏲️ Interval (hours):', intervalHours)
  if (dryRun) {
    console.log('🧪 Dry-run: Sẽ không gửi thật. Kết thúc.')
    return
  }

  const { ThreadType } = require('./zca-js/dist/index.js')
  for (let i = 1; i <= repeat; i++) {
    const label = `[${i}/${repeat}]`
    try {
      console.log(`🚀 ${label} Sending to group ${targetGroupId}...`)
      const res = await zaloApi.sendMessage(`${message} ${label} – ${new Date().toLocaleString('vi-VN')}`, targetGroupId, ThreadType.Group)
      if (res && res.message) {
        console.log(`✅ ${label} Sent. MsgID:`, res.message.msgId)
      } else {
        console.log(`❌ ${label} Failed:`, res)
      }
    } catch (e) {
      console.error(`❌ ${label} Error:`, e?.message || e)
    }

    if (i < repeat) {
      const ms = intervalHours * 3600000
      console.log(`⏳ Wait ${intervalHours}h (${Math.round(ms/1000)}s) before next send...`)
      await new Promise(r => setTimeout(r, ms))
    }
  }

  console.log('🎉 Done repeating sends.')
}


// Run tests if called directly
if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.includes('--groups-info')) {
    runGroupsInfoOnly(args).catch(console.error)
  } else if (args.includes('--send-group-repeat')) {
    runSendGroupRepeat(args).catch(console.error)
  } else {
    runAllTests().catch(console.error)
  }
}

module.exports = {
  runAllTests,
  testLogin,
  testGetFriends,
  testGetGroups,
  testJoinGroup,
  testSendMessage,
  testGroupMessage,
  testGetGroupMembers,
  testGetAllGroupInfos,
  runGroupsInfoOnly,
  runSendGroupRepeat
}
