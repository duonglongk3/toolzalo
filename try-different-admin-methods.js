const { Zalo } = require('./zca-js/dist/cjs/index.cjs');
const fs = require('fs');

async function tryDifferentAdminMethods() {
  try {
    console.log('🔍 Trying different methods to get admin info...');
    
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
    
    // Test với một vài nhóm cụ thể
    const testGroups = [
      '1044492939255875373', // OpenAI ChatGPT Việt Nam (Nhóm 2)
      '1249574336776384772', // Gmail-regphone-3k-7days
      '2276831208259481803', // Dak Nong Farm, Khả Ái, Huy Thịnh
      '7905397917735202790'  // SocialAuto Pro Support (nhóm duy nhất có admin)
    ];
    
    console.log('\n🔍 Testing different methods on specific groups...');
    
    for (const groupId of testGroups) {
      console.log(`\n📝 Testing Group ID: ${groupId}`);
      
      try {
        // Method 1: getGroupInfo (đã test)
        console.log('   Method 1: getGroupInfo()');
        const groupInfo1 = await api.getGroupInfo([groupId]);
        if (groupInfo1 && groupInfo1.gridInfoMap && groupInfo1.gridInfoMap[groupId]) {
          const info = groupInfo1.gridInfoMap[groupId];
          console.log(`   - Name: ${info.name || 'Unknown'}`);
          console.log(`   - Admin IDs: [${(info.adminIds || []).join(', ')}]`);
          console.log(`   - Members: ${info.totalMember || 0}`);
          console.log(`   - Has adminIds field: ${info.hasOwnProperty('adminIds')}`);
          console.log(`   - Raw info keys: [${Object.keys(info).join(', ')}]`);
        } else {
          console.log('   - No info returned');
        }
        
        await new Promise(r => setTimeout(r, 1000));
        
        // Method 2: Thử lấy thông tin chi tiết khác
        console.log('   Method 2: Checking raw group data');
        if (allGroups.gridVerMap && allGroups.gridVerMap[groupId]) {
          const rawInfo = allGroups.gridVerMap[groupId];
          console.log(`   - Raw data keys: [${Object.keys(rawInfo).join(', ')}]`);
          console.log(`   - Raw data: ${JSON.stringify(rawInfo).substring(0, 200)}...`);
        }
        
        await new Promise(r => setTimeout(r, 1000));
        
        // Method 3: Thử các API khác nếu có
        console.log('   Method 3: Checking API context for group info');
        try {
          // Kiểm tra xem có method nào khác không
          const apiMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(api));
          const groupMethods = apiMethods.filter(method => 
            method.toLowerCase().includes('group') || 
            method.toLowerCase().includes('admin') ||
            method.toLowerCase().includes('member')
          );
          console.log(`   - Available group-related methods: [${groupMethods.join(', ')}]`);
        } catch (e) {
          console.log('   - Could not get API methods');
        }
        
      } catch (error) {
        console.log(`   ❌ Error testing group ${groupId}: ${error.message}`);
      }
      
      console.log('   ' + '-'.repeat(50));
    }
    
    // Thử một cách tiếp cận khác: kiểm tra quyền của user hiện tại
    console.log('\n🔍 Checking current user permissions...');
    try {
      const accountInfo = await api.fetchAccountInfo();
      console.log('Account info:', {
        uid: accountInfo?.uid,
        displayName: accountInfo?.displayName,
        zaloName: accountInfo?.zaloName,
        keys: Object.keys(accountInfo || {})
      });
    } catch (e) {
      console.log('Could not get account info:', e.message);
    }
    
    // Thử lấy thông tin từ context
    console.log('\nAPI Context info:');
    console.log('Context keys:', Object.keys(apiContext || {}));
    console.log('Context uid:', apiContext?.uid);
    
    // Kết luận
    console.log('\n' + '='.repeat(80));
    console.log('🎯 ANALYSIS:');
    console.log('1. Most groups return empty adminIds array []');
    console.log('2. Only "SocialAuto Pro Support" returns actual admin IDs');
    console.log('3. This suggests API limitation or permission issue');
    console.log('4. UI might use different API endpoints or have different permissions');
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('1. Check if there are other API methods for getting admin info');
    console.log('2. Try using different zca-js version or configuration');
    console.log('3. Consider that UI data might be cached or from different source');
    console.log('4. The 35 admin groups in UI might be based on different criteria');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

tryDifferentAdminMethods();
