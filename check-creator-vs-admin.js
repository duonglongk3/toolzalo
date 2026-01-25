const { Zalo } = require('./zca-js/dist/cjs/index.cjs');
const fs = require('fs');

async function checkCreatorVsAdmin() {
  try {
    console.log('🔍 Checking creatorId vs adminIds to find the real admin groups...');
    
    // Đọc credentials
    const accountsPath = './data/zalo-accounts.json';
    const accountsData = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
    const activeAccount = accountsData.state.activeAccount;
    
    console.log('✅ Active account:', activeAccount.name, activeAccount.phone);
    
    const credentials = {
      cookie: JSON.parse(activeAccount.cookie),
      imei: activeAccount.imei,
      userAgent: activeAccount.userAgent
    };
    
    console.log('🔥 Logging in...');
    const zalo = new Zalo();
    const api = await zalo.login(credentials);
    console.log('✅ Login successful');
    
    const apiContext = api.getContext();
    const currentUserId = apiContext.uid;
    console.log('🔥 Current User ID:', currentUserId);
    
    // Lấy danh sách nhóm
    const allGroups = await api.getAllGroups();
    const groupIds = Object.keys(allGroups.gridVerMap || {});
    console.log('📊 Total groups found:', groupIds.length);
    
    // Phân tích tất cả nhóm
    console.log('\n🔍 Analyzing all groups for creator vs admin status...');
    
    const createdGroups = [];
    const adminGroups = [];
    const bothGroups = [];
    
    // Chia thành batch để xử lý
    const batchSize = 10;
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
            
            const groupName = info.name || 'Unknown';
            const creatorId = info.creatorId;
            const adminIds = info.adminIds || [];
            
            const isCreator = creatorId === currentUserId;
            const isAdmin = adminIds.includes(currentUserId);
            
            const groupData = {
              id: groupId,
              name: groupName,
              creatorId: creatorId,
              adminIds: adminIds,
              memberCount: info.totalMember || 0,
              isCreator: isCreator,
              isAdmin: isAdmin,
              type: info.type || 'unknown'
            };
            
            if (isCreator && isAdmin) {
              bothGroups.push(groupData);
            } else if (isCreator) {
              createdGroups.push(groupData);
            } else if (isAdmin) {
              adminGroups.push(groupData);
            }
            
            // Log các nhóm quan trọng
            if (isCreator || isAdmin) {
              console.log(`\n🎯 ${isCreator ? '👑 CREATOR' : ''}${isAdmin ? ' 🏆 ADMIN' : ''}: ${groupName}`);
              console.log(`   - ID: ${groupId}`);
              console.log(`   - Members: ${groupData.memberCount}`);
              console.log(`   - Creator ID: ${creatorId}`);
              console.log(`   - Admin IDs: [${adminIds.join(', ')}]`);
              console.log(`   - Is Creator: ${isCreator ? '✅' : '❌'}`);
              console.log(`   - Is Admin: ${isAdmin ? '✅' : '❌'}`);
            }
          }
        }
        
        // Progress update
        if (batchIndex % 5 === 0 || batchIndex === batches.length - 1) {
          console.log(`\n📊 Progress: ${checkedCount}/${groupIds.length} groups checked`);
          console.log(`   - Created: ${createdGroups.length}, Admin: ${adminGroups.length}, Both: ${bothGroups.length}`);
        }
        
        // Delay để tránh rate limit
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
      } catch (error) {
        console.error(`❌ Error in batch ${batchIndex + 1}:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🎯 FINAL ANALYSIS:');
    console.log(`   - Total groups checked: ${checkedCount}/${groupIds.length}`);
    console.log(`   - Groups you CREATED: ${createdGroups.length}`);
    console.log(`   - Groups you are ADMIN: ${adminGroups.length}`);
    console.log(`   - Groups you CREATED & ADMIN: ${bothGroups.length}`);
    console.log(`   - TOTAL groups with special status: ${createdGroups.length + adminGroups.length + bothGroups.length}`);
    
    if (createdGroups.length > 0) {
      console.log('\n👑 GROUPS YOU CREATED (but not admin):');
      createdGroups.forEach((group, index) => {
        console.log(`${index + 1}. ${group.name} (${group.memberCount} members)`);
      });
    }
    
    if (adminGroups.length > 0) {
      console.log('\n🏆 GROUPS YOU ARE ADMIN (but not creator):');
      adminGroups.forEach((group, index) => {
        console.log(`${index + 1}. ${group.name} (${group.memberCount} members)`);
      });
    }
    
    if (bothGroups.length > 0) {
      console.log('\n👑🏆 GROUPS YOU CREATED & ARE ADMIN:');
      bothGroups.forEach((group, index) => {
        console.log(`${index + 1}. ${group.name} (${group.memberCount} members)`);
      });
    }
    
    // Tổng hợp kết quả
    const totalSpecialGroups = createdGroups.length + adminGroups.length + bothGroups.length;
    
    console.log('\n🤔 CONCLUSION:');
    if (totalSpecialGroups >= 30) {
      console.log(`✅ Found ${totalSpecialGroups} groups with special status - this matches the ~35 shown in UI!`);
      console.log('💡 The UI is likely showing "Groups you created OR admin" instead of just "Admin groups"');
    } else {
      console.log(`⚠️ Found only ${totalSpecialGroups} groups with special status - less than expected 35`);
      console.log('💡 There might be other criteria or the UI data is cached/different');
    }
    
    // Lưu kết quả
    const results = {
      currentUserId,
      totalGroupsChecked: checkedCount,
      totalGroupsInAccount: groupIds.length,
      createdGroups,
      adminGroups,
      bothGroups,
      totalSpecialGroups,
      checkedAt: new Date().toISOString()
    };
    
    fs.writeFileSync('./creator-vs-admin-result.json', JSON.stringify(results, null, 2));
    console.log('\n💾 Results saved to creator-vs-admin-result.json');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

checkCreatorVsAdmin();
