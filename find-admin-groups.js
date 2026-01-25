const { Zalo } = require('./zca-js/dist/cjs/index.cjs');
const fs = require('fs');

async function findAdminGroups() {
  try {
    console.log('🔍 Finding admin groups...');
    
    // Đọc credentials từ zalo-accounts.json
    const accountsPath = './data/zalo-accounts.json';
    if (!fs.existsSync(accountsPath)) {
      console.error('❌ zalo-accounts.json not found');
      return;
    }
    
    const accountsData = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
    const activeAccount = accountsData.state.activeAccount;
    
    if (!activeAccount) {
      console.error('❌ No active account found');
      return;
    }
    
    console.log('✅ Active account loaded:', activeAccount.name, activeAccount.phone);
    
    // Chuẩn bị credentials
    const credentials = {
      cookie: JSON.parse(activeAccount.cookie),
      imei: activeAccount.imei,
      userAgent: activeAccount.userAgent
    };
    
    console.log('🔥 Logging in...');
    
    // Khởi tạo Zalo
    const zalo = new Zalo();
    const api = await zalo.login(credentials);
    console.log('✅ Login successful');
    
    // Lấy UID từ context của API
    const apiContext = api.getContext();
    const currentUserId = apiContext.uid;
    console.log('🔥 Current User ID:', currentUserId);
    
    // Lấy danh sách nhóm
    console.log('🔥 Getting all groups...');
    const allGroups = await api.getAllGroups();
    const groupIds = Object.keys(allGroups.gridVerMap || {});
    console.log('📊 Total groups found:', groupIds.length);
    
    if (groupIds.length === 0) {
      console.log('❌ No groups found');
      return;
    }
    
    // Chia nhóm thành các batch nhỏ để tránh rate limit
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < groupIds.length; i += batchSize) {
      batches.push(groupIds.slice(i, i + batchSize));
    }
    
    console.log(`🔥 Processing ${batches.length} batches of ${batchSize} groups each...`);
    
    let totalChecked = 0;
    let adminGroups = [];
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} groups)...`);
      
      try {
        const groupInfo = await api.getGroupInfo(batch);
        
        if (groupInfo && groupInfo.gridInfoMap) {
          for (const [groupId, info] of Object.entries(groupInfo.gridInfoMap)) {
            const adminIds = info.adminIds || [];
            const isAdmin = adminIds.includes(currentUserId);
            totalChecked++;
            
            if (isAdmin) {
              const adminGroup = {
                id: groupId,
                name: info.name || 'Unknown',
                memberCount: info.totalMember || 0,
                adminIds: adminIds
              };
              adminGroups.push(adminGroup);
              
              console.log(`🎯 ADMIN GROUP FOUND!`);
              console.log(`   - Name: ${adminGroup.name}`);
              console.log(`   - ID: ${adminGroup.id}`);
              console.log(`   - Members: ${adminGroup.memberCount}`);
              console.log(`   - Admin IDs: [${adminIds.join(', ')}]`);
              console.log('   ' + '='.repeat(60));
            } else {
              // Chỉ log non-admin groups nếu có ít hơn 5 admin groups tìm được
              if (adminGroups.length < 5) {
                console.log(`   ❌ ${info.name || 'Unknown'} (${groupId}) - Not admin`);
              }
            }
          }
        }
        
        // Delay giữa các batch để tránh rate limit
        if (batchIndex < batches.length - 1) {
          console.log('   ⏳ Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`❌ Error processing batch ${batchIndex + 1}:`, error.message);
        continue;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🎯 FINAL RESULTS:');
    console.log(`   - Total groups checked: ${totalChecked}`);
    console.log(`   - Admin groups found: ${adminGroups.length}`);
    
    if (adminGroups.length > 0) {
      console.log('\n🏆 ADMIN GROUPS:');
      adminGroups.forEach((group, index) => {
        console.log(`${index + 1}. ${group.name}`);
        console.log(`   - ID: ${group.id}`);
        console.log(`   - Members: ${group.memberCount}`);
        console.log(`   - Admin count: ${group.adminIds.length}`);
      });
      
      // Lưu kết quả vào file
      const results = {
        currentUserId,
        totalGroupsChecked: totalChecked,
        adminGroupsCount: adminGroups.length,
        adminGroups: adminGroups,
        checkedAt: new Date().toISOString()
      };
      
      fs.writeFileSync('./admin-groups-result.json', JSON.stringify(results, null, 2));
      console.log('\n💾 Results saved to admin-groups-result.json');
      
    } else {
      console.log('\n🤔 No admin groups found. This could mean:');
      console.log('   1. Account is not admin in any groups');
      console.log('   2. All admin groups are in private/small groups without admin info');
      console.log('   3. API response format might be different');
      console.log('   4. User ID format mismatch');
      
      console.log('\n🔍 DEBUGGING INFO:');
      console.log(`   - Current User ID: "${currentUserId}" (${typeof currentUserId}, length: ${String(currentUserId).length})`);
      
      // Lấy một số sample admin IDs để so sánh
      const sampleAdminIds = [];
      for (let i = 0; i < Math.min(3, batches.length); i++) {
        try {
          const groupInfo = await api.getGroupInfo(batches[i]);
          if (groupInfo && groupInfo.gridInfoMap) {
            for (const info of Object.values(groupInfo.gridInfoMap)) {
              if (info.adminIds && info.adminIds.length > 0) {
                sampleAdminIds.push(...info.adminIds.slice(0, 2));
                if (sampleAdminIds.length >= 5) break;
              }
            }
          }
          if (sampleAdminIds.length >= 5) break;
        } catch (e) {
          continue;
        }
      }
      
      if (sampleAdminIds.length > 0) {
        console.log('   - Sample admin IDs from other groups:');
        sampleAdminIds.slice(0, 5).forEach((id, index) => {
          console.log(`     ${index + 1}. "${id}" (${typeof id}, length: ${String(id).length})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

findAdminGroups();
