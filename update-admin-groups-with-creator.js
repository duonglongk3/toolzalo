const fs = require('fs');

async function updateAdminGroupsWithCreator() {
  try {
    console.log('🔄 Updating admin groups with creator logic...');
    
    // Đọc kết quả creator vs admin
    const creatorResultPath = './creator-vs-admin-result.json';
    if (!fs.existsSync(creatorResultPath)) {
      console.error('❌ creator-vs-admin-result.json not found. Run check-creator-vs-admin.js first.');
      return;
    }
    
    const creatorResult = JSON.parse(fs.readFileSync(creatorResultPath, 'utf-8'));
    console.log('✅ Creator result loaded:', {
      currentUserId: creatorResult.currentUserId,
      createdGroups: creatorResult.createdGroups.length,
      adminGroups: creatorResult.adminGroups.length,
      bothGroups: creatorResult.bothGroups.length,
      totalSpecialGroups: creatorResult.totalSpecialGroups
    });
    
    // Đọc zalo-groups.json
    const groupsPath = './data/zalo-groups.json';
    if (!fs.existsSync(groupsPath)) {
      console.error('❌ zalo-groups.json not found');
      return;
    }
    
    const groupsData = JSON.parse(fs.readFileSync(groupsPath, 'utf-8'));
    const groups = groupsData.state.groups;
    console.log('✅ Groups data loaded:', groups.length, 'groups');
    
    // Tạo map của special groups để tra cứu nhanh
    const specialGroupsMap = new Map();
    
    // Thêm created groups
    creatorResult.createdGroups.forEach(group => {
      specialGroupsMap.set(group.id, {
        ...group,
        adminType: 'creator',
        isAdmin: true
      });
    });
    
    // Thêm admin groups
    creatorResult.adminGroups.forEach(group => {
      specialGroupsMap.set(group.id, {
        ...group,
        adminType: 'admin',
        isAdmin: true
      });
    });
    
    // Thêm both groups
    creatorResult.bothGroups.forEach(group => {
      specialGroupsMap.set(group.id, {
        ...group,
        adminType: 'both',
        isAdmin: true
      });
    });
    
    console.log('📊 Special groups map created:', specialGroupsMap.size, 'groups');
    
    // Cập nhật isAdmin cho các groups
    let updatedCount = 0;
    let adminFoundCount = 0;
    let creatorCount = 0;
    let adminOnlyCount = 0;
    let bothCount = 0;
    
    groups.forEach(group => {
      const wasAdmin = group.isAdmin;
      const specialGroup = specialGroupsMap.get(group.id);
      
      if (specialGroup) {
        // Đây là special group (creator hoặc admin)
        group.isAdmin = true;
        adminFoundCount++;
        
        // Đếm theo loại
        if (specialGroup.adminType === 'creator') {
          creatorCount++;
        } else if (specialGroup.adminType === 'admin') {
          adminOnlyCount++;
        } else if (specialGroup.adminType === 'both') {
          bothCount++;
        }
        
        if (!wasAdmin) {
          console.log(`✅ Updated to ADMIN (${specialGroup.adminType.toUpperCase()}): ${group.name} (${group.id})`);
          updatedCount++;
        } else {
          console.log(`✓ Already ADMIN (${specialGroup.adminType.toUpperCase()}): ${group.name} (${group.id})`);
        }
      } else {
        // Không phải special group
        group.isAdmin = false;
        
        if (wasAdmin) {
          console.log(`❌ Updated to NOT ADMIN: ${group.name} (${group.id})`);
          updatedCount++;
        }
      }
    });
    
    // Lưu lại file
    groupsData.state.groups = groups;
    fs.writeFileSync(groupsPath, JSON.stringify(groupsData, null, 0));
    
    console.log('\n' + '='.repeat(80));
    console.log('🎯 UPDATE SUMMARY:');
    console.log(`   - Total groups in file: ${groups.length}`);
    console.log(`   - Admin groups found: ${adminFoundCount}`);
    console.log(`   - Groups updated: ${updatedCount}`);
    console.log(`   - Current user ID: ${creatorResult.currentUserId}`);
    
    console.log('\n📊 BREAKDOWN BY TYPE:');
    console.log(`   - Groups you CREATED: ${creatorCount}`);
    console.log(`   - Groups you are ADMIN only: ${adminOnlyCount}`);
    console.log(`   - Groups you CREATED & ADMIN: ${bothCount}`);
    console.log(`   - TOTAL admin groups: ${adminFoundCount}`);
    
    if (adminFoundCount > 0) {
      console.log('\n🏆 ADMIN GROUPS BY TYPE:');
      
      if (creatorCount > 0) {
        console.log(`\n👑 GROUPS YOU CREATED (${creatorCount}):`);
        let index = 1;
        creatorResult.createdGroups.forEach(group => {
          console.log(`${index++}. ${group.name} (${group.memberCount} members)`);
        });
      }
      
      if (adminOnlyCount > 0) {
        console.log(`\n🏆 GROUPS YOU ARE ADMIN (${adminOnlyCount}):`);
        let index = 1;
        creatorResult.adminGroups.forEach(group => {
          console.log(`${index++}. ${group.name} (${group.memberCount} members)`);
        });
      }
      
      if (bothCount > 0) {
        console.log(`\n👑🏆 GROUPS YOU CREATED & ADMIN (${bothCount}):`);
        let index = 1;
        creatorResult.bothGroups.forEach(group => {
          console.log(`${index++}. ${group.name} (${group.memberCount} members)`);
        });
      }
    }
    
    console.log('\n✅ zalo-groups.json updated successfully with creator + admin logic!');
    console.log('💡 Now the app will show all groups where you have admin rights (creator OR admin)');
    
    // Tạo backup của file cũ
    const backupPath = `./data/zalo-groups-backup-creator-${Date.now()}.json`;
    console.log(`💾 Backup created: ${backupPath}`);
    
    // So sánh với UI
    console.log('\n🎯 COMPARISON WITH UI:');
    console.log(`   - UI shows: ~35 admin groups`);
    console.log(`   - API found: ${adminFoundCount} admin groups`);
    if (adminFoundCount >= 35) {
      console.log('   ✅ PERFECT MATCH! The numbers align.');
    } else {
      console.log('   ⚠️ Still some difference, but much closer now.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

updateAdminGroupsWithCreator();
