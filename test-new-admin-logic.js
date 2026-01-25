const { Zalo } = require('./zca-js/dist/cjs/index.cjs');
const fs = require('fs');

async function testNewAdminLogic() {
  try {
    console.log('🔍 Testing new admin logic (creatorId + adminIds)...');
    
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
    
    // Test với 10 nhóm đầu tiên
    console.log('\n🔍 Testing new admin logic on first 10 groups...');
    const testGroupIds = groupIds.slice(0, 10);
    
    const groupInfo = await api.getGroupInfo(testGroupIds);
    
    let adminCount = 0;
    let creatorCount = 0;
    let bothCount = 0;
    
    if (groupInfo && groupInfo.gridInfoMap) {
      for (const [groupId, info] of Object.entries(groupInfo.gridInfoMap)) {
        const groupData = info;
        const adminIds = groupData.adminIds || [];
        const creatorId = groupData.creatorId || '';
        
        const isAdminByIds = adminIds.includes(currentUserId);
        const isCreator = creatorId === currentUserId;
        const isAdmin = isAdminByIds || isCreator;
        
        console.log(`\n📝 Group: ${groupData.name || 'Unknown'}`);
        console.log(`   - ID: ${groupId}`);
        console.log(`   - Creator ID: ${creatorId}`);
        console.log(`   - Admin IDs: [${adminIds.join(', ')}]`);
        console.log(`   - Current User ID: ${currentUserId}`);
        console.log(`   - Is Creator: ${isCreator ? '✅' : '❌'}`);
        console.log(`   - Is Admin by IDs: ${isAdminByIds ? '✅' : '❌'}`);
        console.log(`   - Is Admin (final): ${isAdmin ? '🏆 YES' : '❌ NO'}`);
        
        if (isAdmin) {
          adminCount++;
          if (isCreator && isAdminByIds) {
            bothCount++;
          } else if (isCreator) {
            creatorCount++;
          }
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🎯 TEST RESULTS (first 10 groups):');
    console.log(`   - Total admin groups: ${adminCount}`);
    console.log(`   - Creator only: ${creatorCount}`);
    console.log(`   - Admin by IDs only: ${adminCount - creatorCount - bothCount}`);
    console.log(`   - Both creator & admin: ${bothCount}`);
    
    if (adminCount > 0) {
      console.log('\n✅ SUCCESS: New logic is working! Found admin groups.');
      console.log('💡 The frontend should now show the correct number of admin groups.');
    } else {
      console.log('\n⚠️ No admin groups found in first 10. This might be normal.');
      console.log('💡 Try testing with more groups or check if you are admin of any groups.');
    }
    
    // Estimate total admin groups
    const estimatedAdminGroups = Math.round((adminCount / 10) * groupIds.length);
    console.log(`\n📊 ESTIMATION:`);
    console.log(`   - Admin rate in sample: ${adminCount}/10 (${(adminCount/10*100).toFixed(1)}%)`);
    console.log(`   - Estimated total admin groups: ~${estimatedAdminGroups}`);
    console.log(`   - Expected from previous analysis: 36`);
    
    if (estimatedAdminGroups >= 30) {
      console.log('   ✅ Estimation looks good! Close to expected 36.');
    } else {
      console.log('   ⚠️ Estimation seems low. May need to check more groups.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testNewAdminLogic();
