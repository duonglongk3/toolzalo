const { Zalo } = require('./zca-js/dist/cjs/index.cjs');
const fs = require('fs');

async function findAllAdminGroups() {
  try {
    console.log('🔍 Finding ALL admin groups (expecting ~35)...');
    
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
    
    // Sử dụng batch size nhỏ hơn và delay lâu hơn
    const batchSize = 5; // Giảm từ 10 xuống 5
    const delayMs = 3000; // Tăng từ 2s lên 3s
    
    const batches = [];
    for (let i = 0; i < groupIds.length; i += batchSize) {
      batches.push(groupIds.slice(i, i + batchSize));
    }
    
    console.log(`🔥 Processing ${batches.length} batches of ${batchSize} groups each...`);
    console.log(`⏱️ Estimated time: ${Math.ceil(batches.length * delayMs / 1000 / 60)} minutes`);
    
    let totalChecked = 0;
    let adminGroups = [];
    let errorCount = 0;
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const progress = `${batchIndex + 1}/${batches.length}`;
      
      console.log(`\n📦 Batch ${progress} (${batch.length} groups) - Admin found so far: ${adminGroups.length}`);
      
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
                adminIds: adminIds,
                batchIndex: batchIndex + 1
              };
              adminGroups.push(adminGroup);
              
              console.log(`🎯 ADMIN GROUP #${adminGroups.length}: ${adminGroup.name}`);
              console.log(`   - ID: ${adminGroup.id}`);
              console.log(`   - Members: ${adminGroup.memberCount}`);
              console.log(`   - Total admins: ${adminIds.length}`);
            } else {
              // Chỉ log một vài non-admin groups để không spam
              if (totalChecked <= 10 || totalChecked % 20 === 0) {
                console.log(`   ❌ ${info.name || 'Unknown'} - Not admin`);
              }
            }
          }
        } else {
          console.log(`   ⚠️ No group info returned for batch ${progress}`);
        }
        
        // Progress report
        if ((batchIndex + 1) % 5 === 0 || batchIndex === batches.length - 1) {
          console.log(`   📊 Progress: ${totalChecked}/${groupIds.length} groups checked, ${adminGroups.length} admin groups found`);
        }
        
        // Delay giữa các batch (trừ batch cuối)
        if (batchIndex < batches.length - 1) {
          console.log(`   ⏳ Waiting ${delayMs/1000}s before next batch...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error in batch ${progress}:`, error.message);
        
        // Nếu quá nhiều lỗi, tăng delay
        if (errorCount > 3) {
          console.log('⚠️ Too many errors, increasing delay to 5s...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        continue;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🎯 FINAL RESULTS:');
    console.log(`   - Total groups checked: ${totalChecked}/${groupIds.length}`);
    console.log(`   - Admin groups found: ${adminGroups.length}`);
    console.log(`   - Errors encountered: ${errorCount}`);
    console.log(`   - Expected admin groups: ~35`);
    
    if (adminGroups.length > 0) {
      console.log('\n🏆 ALL ADMIN GROUPS:');
      adminGroups.forEach((group, index) => {
        console.log(`${index + 1}. ${group.name}`);
        console.log(`   - ID: ${group.id}`);
        console.log(`   - Members: ${group.memberCount}`);
        console.log(`   - Found in batch: ${group.batchIndex}`);
      });
      
      // Lưu kết quả chi tiết
      const results = {
        currentUserId,
        totalGroupsInAccount: groupIds.length,
        totalGroupsChecked: totalChecked,
        adminGroupsCount: adminGroups.length,
        adminGroups: adminGroups,
        errorCount,
        checkedAt: new Date().toISOString(),
        processingStats: {
          batchSize,
          delayMs,
          totalBatches: batches.length
        }
      };
      
      fs.writeFileSync('./all-admin-groups-result.json', JSON.stringify(results, null, 2));
      console.log('\n💾 Detailed results saved to all-admin-groups-result.json');
      
      // So sánh với kỳ vọng
      if (adminGroups.length < 35) {
        console.log('\n⚠️ WARNING: Found fewer admin groups than expected!');
        console.log(`   Expected: ~35, Found: ${adminGroups.length}`);
        console.log('   Possible reasons:');
        console.log('   - Some batches failed due to rate limiting');
        console.log('   - API timeout or connection issues');
        console.log('   - Groups data might have changed');
        console.log(`   - Only checked ${totalChecked}/${groupIds.length} groups`);
      } else {
        console.log('\n✅ SUCCESS: Found expected number of admin groups!');
      }
      
    } else {
      console.log('\n❌ No admin groups found - this is unexpected!');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error('Stack:', error.stack);
  }
}

findAllAdminGroups();
