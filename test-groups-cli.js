const { Zalo } = require('./zca-js/dist/cjs/index.cjs');
const fs = require('fs');

async function testGroups() {
  try {
    console.log('🔥 Starting CLI test for groups...');
    
    // Đọc credentials từ file
    const credentialsPath = './credentials.json';
    if (!fs.existsSync(credentialsPath)) {
      console.error('❌ Credentials file not found. Please create credentials.json');
      return;
    }
    
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    console.log('✅ Credentials loaded');
    
    // Khởi tạo Zalo
    const zalo = new Zalo();
    console.log('🔥 Logging in...');
    
    const api = await zalo.login(credentials);
    console.log('✅ Login successful');
    
    // Lấy thông tin tài khoản
    const accountInfo = await api.fetchAccountInfo();
    console.log('👤 Account Info:', {
      uid: accountInfo.uid,
      displayName: accountInfo.displayName,
      zaloName: accountInfo.zaloName
    });
    
    // Lấy danh sách nhóm
    console.log('🔥 Getting all groups...');
    const allGroups = await api.getAllGroups();
    console.log('📊 Total groups found:', Object.keys(allGroups.gridVerMap || {}).length);
    
    const groupIds = Object.keys(allGroups.gridVerMap || {});
    if (groupIds.length === 0) {
      console.log('❌ No groups found');
      return;
    }
    
    console.log('🔥 Getting group details...');
    
    // Test với 5 nhóm đầu tiên
    const testGroupIds = groupIds.slice(0, 5);
    console.log('🧪 Testing with groups:', testGroupIds);
    
    const groupInfo = await api.getGroupInfo(testGroupIds);
    console.log('📋 Group info response keys:', Object.keys(groupInfo || {}));
    
    if (groupInfo && groupInfo.gridInfoMap) {
      console.log('🔍 Analyzing groups for admin status...');
      
      let adminCount = 0;
      const currentUserId = accountInfo.uid;
      
      for (const [groupId, info] of Object.entries(groupInfo.gridInfoMap)) {
        const adminIds = info.adminIds || [];
        const isAdmin = adminIds.includes(currentUserId);
        
        console.log(`📝 Group: ${info.name || 'Unknown'}`);
        console.log(`   - ID: ${groupId}`);
        console.log(`   - Admin IDs: [${adminIds.join(', ')}]`);
        console.log(`   - Current User ID: ${currentUserId}`);
        console.log(`   - Is Admin: ${isAdmin}`);
        console.log(`   - Member Count: ${info.totalMember || 0}`);
        console.log('   ---');
        
        if (isAdmin) {
          adminCount++;
        }
      }
      
      console.log(`🎯 RESULT: You are admin in ${adminCount} out of ${testGroupIds.length} tested groups`);
      
      // Test với tất cả nhóm nếu cần
      if (groupIds.length > 5) {
        console.log(`📊 Total groups in account: ${groupIds.length}`);
        console.log('💡 To test all groups, modify the script to remove the slice(0, 5) limit');
      }
      
    } else {
      console.log('❌ No group info received');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testGroups();
