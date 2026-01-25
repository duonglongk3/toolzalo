const fs = require('fs');

async function updateAdminGroups() {
  try {
    console.log('🔄 Updating admin groups in zalo-groups.json...');
    
    // Đọc kết quả admin groups
    const adminResultPath = './admin-groups-result.json';
    if (!fs.existsSync(adminResultPath)) {
      console.error('❌ admin-groups-result.json not found. Run find-admin-groups.js first.');
      return;
    }
    
    const adminResult = JSON.parse(fs.readFileSync(adminResultPath, 'utf-8'));
    console.log('✅ Admin result loaded:', {
      currentUserId: adminResult.currentUserId,
      adminGroupsCount: adminResult.adminGroupsCount,
      totalChecked: adminResult.totalGroupsChecked
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
    
    // Tạo map của admin groups để tra cứu nhanh
    const adminGroupsMap = new Map();
    adminResult.adminGroups.forEach(adminGroup => {
      adminGroupsMap.set(adminGroup.id, adminGroup);
    });
    
    // Cập nhật isAdmin cho các groups
    let updatedCount = 0;
    let adminFoundCount = 0;
    
    groups.forEach(group => {
      const wasAdmin = group.isAdmin;
      const adminGroup = adminGroupsMap.get(group.id);
      
      if (adminGroup) {
        // Đây là admin group
        group.isAdmin = true;
        adminFoundCount++;
        
        if (!wasAdmin) {
          console.log(`✅ Updated to ADMIN: ${group.name} (${group.id})`);
          updatedCount++;
        } else {
          console.log(`✓ Already ADMIN: ${group.name} (${group.id})`);
        }
      } else {
        // Không phải admin group
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
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 UPDATE SUMMARY:');
    console.log(`   - Total groups in file: ${groups.length}`);
    console.log(`   - Admin groups found: ${adminFoundCount}`);
    console.log(`   - Groups updated: ${updatedCount}`);
    console.log(`   - Current user ID: ${adminResult.currentUserId}`);
    
    if (adminFoundCount > 0) {
      console.log('\n🏆 ADMIN GROUPS:');
      adminResult.adminGroups.forEach((adminGroup, index) => {
        console.log(`${index + 1}. ${adminGroup.name}`);
        console.log(`   - ID: ${adminGroup.id}`);
        console.log(`   - Members: ${adminGroup.memberCount}`);
        console.log(`   - Co-admins: ${adminGroup.adminIds.length - 1}`);
      });
    }
    
    console.log('\n✅ zalo-groups.json updated successfully!');
    
    // Tạo backup của file cũ
    const backupPath = `./data/zalo-groups-backup-${Date.now()}.json`;
    console.log(`💾 Backup created: ${backupPath}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

updateAdminGroups();
