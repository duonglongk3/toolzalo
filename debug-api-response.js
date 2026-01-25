const { Zalo } = require('./zca-js/dist/cjs/index.cjs');
const fs = require('fs');

async function debugApiResponse() {
  try {
    console.log('🔍 Debugging API response structure...');
    
    // Đọc credentials
    const accountsPath = './data/zalo-accounts.json';
    const accountsData = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
    const activeAccount = accountsData.state.activeAccount;
    
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
    
    // Test với 3 nhóm đầu tiên
    console.log('\n🔍 Testing API response structure on first 3 groups...');
    const testGroupIds = groupIds.slice(0, 3);
    
    const groupInfo = await api.getGroupInfo(testGroupIds);
    
    console.log('\n📋 RAW API RESPONSE:');
    console.log('Type of groupInfo:', typeof groupInfo);
    console.log('Keys in groupInfo:', Object.keys(groupInfo || {}));
    
    if (groupInfo && groupInfo.gridInfoMap) {
      console.log('\n📋 gridInfoMap structure:');
      console.log('Type of gridInfoMap:', typeof groupInfo.gridInfoMap);
      console.log('Keys in gridInfoMap:', Object.keys(groupInfo.gridInfoMap));
      
      let count = 0;
      for (const [groupId, info] of Object.entries(groupInfo.gridInfoMap)) {
        if (count >= 3) break;
        count++;
        
        console.log(`\n📝 Group ${count}: ${groupId}`);
        console.log('Raw info object:', JSON.stringify(info, null, 2));
        
        // Kiểm tra tất cả các field có thể có
        const possibleCreatorFields = [
          'creatorId', 'creator_id', 'creator', 'ownerId', 'owner_id', 'owner',
          'founderId', 'founder_id', 'founder', 'adminId', 'admin_id'
        ];
        
        console.log('\n🔍 Checking possible creator fields:');
        for (const field of possibleCreatorFields) {
          if (info[field] !== undefined) {
            console.log(`   ✅ ${field}: "${info[field]}"`);
          } else {
            console.log(`   ❌ ${field}: undefined`);
          }
        }
        
        console.log('\n🔍 All available fields:');
        for (const [key, value] of Object.entries(info)) {
          console.log(`   - ${key}: ${typeof value === 'string' ? `"${value}"` : JSON.stringify(value)}`);
        }
      }
    } else {
      console.log('❌ No gridInfoMap found in response');
    }
    
    // Thử với một nhóm cụ thể mà chúng ta biết user là creator
    console.log('\n🎯 Testing with a specific group we know user created...');
    
    // Từ test trước, chúng ta biết group "7040693396795171814" user là creator
    const specificGroupId = '7040693396795171814';
    if (groupIds.includes(specificGroupId)) {
      console.log(`\n🔍 Testing specific group: ${specificGroupId}`);
      const specificInfo = await api.getGroupInfo([specificGroupId]);
      
      if (specificInfo && specificInfo.gridInfoMap && specificInfo.gridInfoMap[specificGroupId]) {
        const info = specificInfo.gridInfoMap[specificGroupId];
        console.log('Raw info for known creator group:', JSON.stringify(info, null, 2));
        
        // Kiểm tra tất cả các field
        console.log('\n🔍 All fields in known creator group:');
        for (const [key, value] of Object.entries(info)) {
          console.log(`   - ${key}: ${typeof value === 'string' ? `"${value}"` : JSON.stringify(value)}`);
        }
      }
    } else {
      console.log('❌ Known creator group not found in current group list');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugApiResponse();
