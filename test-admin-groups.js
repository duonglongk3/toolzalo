const { Zalo } = require('./zca-js/dist/cjs/index.cjs');
const fs = require('fs');

async function testAdminGroups() {
  try {
    console.log('🔥 Starting admin groups test...');
    
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
    
    // Lấy thông tin tài khoản
    const accountInfo = await api.fetchAccountInfo();

    // Lấy UID từ context của API
    const apiContext = api.getContext();
    const currentUserId = apiContext.uid;

    console.log('👤 Account Info:', {
      uid: accountInfo.uid,
      displayName: accountInfo.displayName,
      zaloName: accountInfo.zaloName
    });

    console.log('🔥 Current User ID from context:', currentUserId);
    
    // Lấy danh sách nhóm
    console.log('🔥 Getting all groups...');
    const allGroups = await api.getAllGroups();
    const groupIds = Object.keys(allGroups.gridVerMap || {});
    console.log('📊 Total groups found:', groupIds.length);
    
    if (groupIds.length === 0) {
      console.log('❌ No groups found');
      return;
    }
    
    console.log('🔥 Getting group details for admin check...');
    
    // Test với tất cả nhóm để tìm admin groups
    const testGroupIds = groupIds; // Test tất cả nhóm
    console.log(`🧪 Testing ${testGroupIds.length} groups for admin status...`);
    
    const groupInfo = await api.getGroupInfo(testGroupIds);
    console.log('📋 Group info response keys:', Object.keys(groupInfo || {}));
    
    if (groupInfo && groupInfo.gridInfoMap) {
      console.log('🔍 Analyzing groups for admin status...');
      console.log('='.repeat(80));
      
      let adminCount = 0;
      let totalChecked = 0;
      // Sử dụng currentUserId từ context thay vì accountInfo.uid
      
      for (const [groupId, info] of Object.entries(groupInfo.gridInfoMap)) {
        const adminIds = info.adminIds || [];
        const isAdmin = adminIds.includes(currentUserId);
        totalChecked++;
        
        console.log(`📝 Group ${totalChecked}: ${info.name || 'Unknown'}`);
        console.log(`   - ID: ${groupId}`);
        console.log(`   - Admin IDs: [${adminIds.join(', ')}]`);
        console.log(`   - Current User ID: ${currentUserId}`);
        console.log(`   - Is Admin: ${isAdmin ? '✅ YES' : '❌ NO'}`);
        console.log(`   - Member Count: ${info.totalMember || 0}`);
        console.log('   ' + '-'.repeat(60));
        
        if (isAdmin) {
          adminCount++;
          console.log(`   🎯 ADMIN GROUP FOUND! (${adminCount})`);
        }
      }
      
      console.log('='.repeat(80));
      console.log(`🎯 FINAL RESULT:`);
      console.log(`   - Total groups checked: ${totalChecked}`);
      console.log(`   - Admin groups found: ${adminCount}`);
      console.log(`   - Admin percentage: ${((adminCount / totalChecked) * 100).toFixed(1)}%`);
      
      if (adminCount === 0) {
        console.log('');
        console.log('🤔 ANALYSIS: No admin groups found. Possible reasons:');
        console.log('   1. Account is not admin in any of the tested groups');
        console.log('   2. API response format might have changed');
        console.log('   3. Current user ID might not match admin IDs format');
        console.log('   4. Groups might not have admin information available');
        console.log('');
        console.log('💡 DEBUGGING INFO:');
        console.log(`   - Current User ID: "${currentUserId}"`);
        console.log(`   - User ID type: ${typeof currentUserId}`);
        console.log(`   - User ID length: ${String(currentUserId).length}`);
        
        // Kiểm tra format của admin IDs
        const sampleAdminIds = Object.values(groupInfo.gridInfoMap)
          .map(info => info.adminIds || [])
          .filter(ids => ids.length > 0)
          .slice(0, 3);
          
        if (sampleAdminIds.length > 0) {
          console.log('   - Sample admin IDs format:');
          sampleAdminIds.forEach((ids, index) => {
            console.log(`     Group ${index + 1}: [${ids.map(id => `"${id}" (${typeof id}, len:${String(id).length})`).join(', ')}]`);
          });
        }
      }
      
      // Test với tất cả nhóm nếu cần
      if (groupIds.length > testGroupIds.length) {
        console.log('');
        console.log(`📊 Note: Total groups in account: ${groupIds.length}`);
        console.log(`   Only tested first ${testGroupIds.length} groups`);
        console.log('   To test all groups, modify the script to remove the slice limit');
      }
      
    } else {
      console.log('❌ No group info received or invalid format');
      console.log('Raw response:', JSON.stringify(groupInfo, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAdminGroups();
