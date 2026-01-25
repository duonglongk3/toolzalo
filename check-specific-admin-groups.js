const { Zalo } = require('./zca-js/dist/cjs/index.cjs');
const fs = require('fs');

async function checkSpecificAdminGroups() {
  try {
    console.log('🔍 Checking specific groups for admin status...');
    
    // Danh sách các nhóm cần check
    const targetGroups = [
      'OpenAI ChatGPT Việt Nam (Nhóm 2)',
      'Nhóm Kín - Hội Thương lái Cà Chua Lâm Đồng',
      'Gmail-regphone-3k-7days',
      'Huy Thịnh, Lê Hồ Bạch Tuyết',
      'Đẩy-kênh-tiktok',
      'Dak Nong Farm, Khả Ái, Huy Thịnh',
      'tool reg tiktok seller',
      'máy-8',
      'Máy-3',
      'máy-7'
    ];
    
    console.log(`🎯 Target groups: ${targetGroups.length}`);
    targetGroups.forEach((name, index) => {
      console.log(`${index + 1}. ${name}`);
    });
    
    // Đọc credentials từ zalo-accounts.json
    const accountsPath = './data/zalo-accounts.json';
    const accountsData = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
    const activeAccount = accountsData.state.activeAccount;
    
    console.log('\n✅ Active account:', activeAccount.name, activeAccount.phone);
    
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
    
    // Lấy danh sách tất cả nhóm
    console.log('\n🔥 Getting all groups...');
    const allGroups = await api.getAllGroups();
    const groupIds = Object.keys(allGroups.gridVerMap || {});
    console.log('📊 Total groups found:', groupIds.length);
    
    // Tìm các nhóm theo tên
    console.log('\n🔍 Searching for target groups...');
    const foundGroups = [];
    const adminGroups = [];
    
    // Chia thành batch nhỏ để tránh rate limit
    const batchSize = 5;
    const batches = [];
    for (let i = 0; i < groupIds.length; i += batchSize) {
      batches.push(groupIds.slice(i, i + batchSize));
    }
    
    let checkedCount = 0;
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      try {
        const groupInfo = await api.getGroupInfo(batch);
        
        if (groupInfo && groupInfo.gridInfoMap) {
          for (const [groupId, info] of Object.entries(groupInfo.gridInfoMap)) {
            checkedCount++;
            const groupName = info.name || '';
            
            // Kiểm tra xem có match với target groups không
            const matchedTarget = targetGroups.find(target => {
              const targetLower = target.toLowerCase();
              const nameLower = groupName.toLowerCase();
              
              // Exact match hoặc contains
              return nameLower === targetLower || 
                     nameLower.includes(targetLower) || 
                     targetLower.includes(nameLower) ||
                     // Fuzzy match cho các tên tương tự
                     (targetLower.includes('openai') && nameLower.includes('openai')) ||
                     (targetLower.includes('gmail-reg') && nameLower.includes('gmail-reg')) ||
                     (targetLower.includes('huy thịnh') && nameLower.includes('huy thịnh')) ||
                     (targetLower.includes('dak nong') && nameLower.includes('dak nong')) ||
                     (targetLower.includes('máy-') && nameLower.includes('máy-')) ||
                     (targetLower.includes('tiktok') && nameLower.includes('tiktok'));
            });
            
            if (matchedTarget) {
              const adminIds = info.adminIds || [];
              const isAdmin = adminIds.includes(currentUserId);
              
              const groupData = {
                targetName: matchedTarget,
                actualName: groupName,
                id: groupId,
                adminIds: adminIds,
                memberCount: info.totalMember || 0,
                isAdmin: isAdmin
              };
              
              foundGroups.push(groupData);
              
              if (isAdmin) {
                adminGroups.push(groupData);
              }
              
              console.log(`\n🎯 FOUND: "${groupName}"`);
              console.log(`   - Target: "${matchedTarget}"`);
              console.log(`   - ID: ${groupId}`);
              console.log(`   - Members: ${groupData.memberCount}`);
              console.log(`   - Admin IDs: [${adminIds.join(', ')}]`);
              console.log(`   - Is Admin: ${isAdmin ? '✅ YES' : '❌ NO'}`);
              
              if (isAdmin) {
                console.log(`   🏆 YOU ARE ADMIN OF THIS GROUP!`);
              }
            }
          }
        }
        
        // Progress update
        if (batchIndex % 10 === 0 || batchIndex === batches.length - 1) {
          console.log(`\n📊 Progress: ${checkedCount}/${groupIds.length} groups checked, ${foundGroups.length} target groups found, ${adminGroups.length} admin groups`);
        }
        
        // Delay để tránh rate limit
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`❌ Error in batch ${batchIndex + 1}:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🎯 FINAL RESULTS:');
    console.log(`   - Target groups searched: ${targetGroups.length}`);
    console.log(`   - Groups found: ${foundGroups.length}`);
    console.log(`   - Admin groups: ${adminGroups.length}`);
    console.log(`   - Total groups checked: ${checkedCount}/${groupIds.length}`);
    
    if (foundGroups.length > 0) {
      console.log('\n📋 ALL FOUND GROUPS:');
      foundGroups.forEach((group, index) => {
        console.log(`${index + 1}. ${group.actualName}`);
        console.log(`   - Target: ${group.targetName}`);
        console.log(`   - ID: ${group.id}`);
        console.log(`   - Members: ${group.memberCount}`);
        console.log(`   - Admin Status: ${group.isAdmin ? '✅ ADMIN' : '❌ NOT ADMIN'}`);
        console.log(`   - Total Admins: ${group.adminIds.length}`);
      });
    }
    
    if (adminGroups.length > 0) {
      console.log('\n🏆 ADMIN GROUPS:');
      adminGroups.forEach((group, index) => {
        console.log(`${index + 1}. ${group.actualName}`);
        console.log(`   - ID: ${group.id}`);
        console.log(`   - Members: ${group.memberCount}`);
        console.log(`   - Co-admins: ${group.adminIds.length - 1}`);
      });
    } else {
      console.log('\n❌ You are not admin of any of the target groups');
    }
    
    // Tìm các target groups chưa được tìm thấy
    const foundTargetNames = foundGroups.map(g => g.targetName);
    const notFoundTargets = targetGroups.filter(target => !foundTargetNames.includes(target));
    
    if (notFoundTargets.length > 0) {
      console.log('\n🔍 NOT FOUND TARGET GROUPS:');
      notFoundTargets.forEach((target, index) => {
        console.log(`${index + 1}. ${target}`);
      });
      console.log('\nPossible reasons:');
      console.log('- Group name might be different in API vs UI');
      console.log('- Group might be private/restricted');
      console.log('- Group might have been deleted or left');
      console.log('- Fuzzy matching might need improvement');
    }
    
    // Lưu kết quả
    const results = {
      currentUserId,
      targetGroups,
      foundGroups,
      adminGroups,
      notFoundTargets,
      totalGroupsChecked: checkedCount,
      totalGroupsInAccount: groupIds.length,
      checkedAt: new Date().toISOString()
    };
    
    fs.writeFileSync('./specific-admin-groups-result.json', JSON.stringify(results, null, 2));
    console.log('\n💾 Results saved to specific-admin-groups-result.json');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

checkSpecificAdminGroups();
