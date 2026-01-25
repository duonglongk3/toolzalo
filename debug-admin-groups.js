const { Zalo } = require('./zca-js/dist/cjs/index.cjs');
const fs = require('fs');

async function debugAdminGroups() {
  try {
    console.log('🔍 Deep debugging admin groups issue...');
    
    // Đọc credentials từ zalo-accounts.json
    const accountsPath = './data/zalo-accounts.json';
    const accountsData = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
    const activeAccount = accountsData.state.activeAccount;
    
    console.log('✅ Active account:', activeAccount.name, activeAccount.phone);
    
    // Chuẩn bị credentials
    const credentials = {
      cookie: JSON.parse(activeAccount.cookie),
      imei: activeAccount.imei,
      userAgent: activeAccount.userAgent
    };
    
    console.log('🔥 Logging in...');
    const zalo = new Zalo();
    const api = await zalo.login(credentials);
    console.log('✅ Login successful');
    
    // Lấy UID từ context
    const apiContext = api.getContext();
    const currentUserId = apiContext.uid;
    console.log('🔥 Current User ID:', currentUserId);
    
    // Lấy danh sách nhóm
    const allGroups = await api.getAllGroups();
    const groupIds = Object.keys(allGroups.gridVerMap || {});
    console.log('📊 Total groups found:', groupIds.length);
    
    // Lấy một số groups từ UI để so sánh
    const expectedAdminGroups = [
      'undefined [TEST]',
      'zca-api', 
      'mua_mail_1k2',
      'Mạnh Cường Nguyễn, Dak Nong Farm',
      'Gmail-regphone-3k-7days',
      'Dak Nong Farm, Nguyễn Anh Tuấn, Huy Thịnh',
      'Huy Thịnh, Lê Hồ Bạch Tuyết',
      'check api',
      'Dak Nong Farm, Khả Ái, Huy Thịnh',
      'Dak Nong Farm, Huy Thịnh, Lê Duy Đông',
      'OpenAI ChatGPT Việt Nam (Nhóm 2)',
      'Nhóm Kín - Hội Thương lái Cà Chua Lâm Đồng'
    ];
    
    console.log('\n🔍 Searching for expected admin groups by name...');
    
    // Tìm groups theo tên
    const foundGroups = [];
    for (const expectedName of expectedAdminGroups) {
      console.log(`\n🔎 Looking for: "${expectedName}"`);
      
      // Tìm group ID theo tên
      let foundGroupId = null;
      for (const groupId of groupIds) {
        // Lấy thông tin group
        try {
          const groupInfo = await api.getGroupInfo([groupId]);
          if (groupInfo && groupInfo.gridInfoMap && groupInfo.gridInfoMap[groupId]) {
            const info = groupInfo.gridInfoMap[groupId];
            const groupName = info.name || '';
            
            if (groupName.toLowerCase().includes(expectedName.toLowerCase()) || 
                expectedName.toLowerCase().includes(groupName.toLowerCase())) {
              foundGroupId = groupId;
              foundGroups.push({
                expectedName,
                actualName: groupName,
                id: groupId,
                adminIds: info.adminIds || [],
                memberCount: info.totalMember || 0
              });
              
              const isAdmin = (info.adminIds || []).includes(currentUserId);
              console.log(`   ✅ FOUND: "${groupName}" (${groupId})`);
              console.log(`   - Admin IDs: [${(info.adminIds || []).join(', ')}]`);
              console.log(`   - Is Admin: ${isAdmin ? '✅ YES' : '❌ NO'}`);
              console.log(`   - Members: ${info.totalMember || 0}`);
              break;
            }
          }
        } catch (e) {
          // Skip errors for individual groups
          continue;
        }
        
        // Delay nhỏ để tránh rate limit
        await new Promise(r => setTimeout(r, 100));
      }
      
      if (!foundGroupId) {
        console.log(`   ❌ NOT FOUND: "${expectedName}"`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 SEARCH RESULTS:');
    console.log(`   - Expected admin groups searched: ${expectedAdminGroups.length}`);
    console.log(`   - Found by name: ${foundGroups.length}`);
    
    const actualAdminGroups = foundGroups.filter(g => g.adminIds.includes(currentUserId));
    console.log(`   - Actually admin: ${actualAdminGroups.length}`);
    
    if (actualAdminGroups.length > 0) {
      console.log('\n🏆 CONFIRMED ADMIN GROUPS:');
      actualAdminGroups.forEach((group, index) => {
        console.log(`${index + 1}. ${group.actualName}`);
        console.log(`   - Expected: ${group.expectedName}`);
        console.log(`   - ID: ${group.id}`);
        console.log(`   - Members: ${group.memberCount}`);
        console.log(`   - Total admins: ${group.adminIds.length}`);
      });
    }
    
    // Kiểm tra một vài groups ngẫu nhiên để xem cấu trúc dữ liệu
    console.log('\n🔍 RANDOM SAMPLE ANALYSIS:');
    const sampleGroups = groupIds.slice(0, 5);
    
    for (const groupId of sampleGroups) {
      try {
        const groupInfo = await api.getGroupInfo([groupId]);
        if (groupInfo && groupInfo.gridInfoMap && groupInfo.gridInfoMap[groupId]) {
          const info = groupInfo.gridInfoMap[groupId];
          console.log(`\n📝 Sample: ${info.name || 'Unknown'}`);
          console.log(`   - ID: ${groupId}`);
          console.log(`   - Admin IDs: [${(info.adminIds || []).join(', ')}]`);
          console.log(`   - Admin IDs type: ${typeof (info.adminIds || [])[0]}`);
          console.log(`   - Current User ID: ${currentUserId} (${typeof currentUserId})`);
          console.log(`   - Has adminIds field: ${info.hasOwnProperty('adminIds')}`);
          console.log(`   - Raw adminIds: ${JSON.stringify(info.adminIds)}`);
        }
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        console.log(`   ❌ Error getting info for ${groupId}: ${e.message}`);
      }
    }
    
    // Lưu debug info
    const debugInfo = {
      currentUserId,
      totalGroups: groupIds.length,
      expectedAdminGroups,
      foundGroups,
      actualAdminGroups,
      debuggedAt: new Date().toISOString()
    };
    
    fs.writeFileSync('./debug-admin-groups.json', JSON.stringify(debugInfo, null, 2));
    console.log('\n💾 Debug info saved to debug-admin-groups.json');
    
    // Kết luận
    console.log('\n🤔 ANALYSIS:');
    if (actualAdminGroups.length < expectedAdminGroups.length / 2) {
      console.log('   - Possible issues:');
      console.log('   1. Group names in UI might be different from API');
      console.log('   2. Some groups might not have adminIds field');
      console.log('   3. User ID format might be inconsistent');
      console.log('   4. API might not return complete admin information');
      console.log('   5. Groups might be private/restricted');
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugAdminGroups();
