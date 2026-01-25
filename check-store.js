const Store = require('electron-store');

// Tạo store instance giống như trong main.ts
const store = new Store({
  name: 'zalo-manager-config',
  defaults: {
    windowBounds: { width: 1200, height: 800 },
    theme: 'system'
  }
});

console.log('🔍 Checking electron store for credentials...');

// Liệt kê tất cả keys
const allKeys = Object.keys(store.store);
console.log('📋 All store keys:', allKeys);

// Tìm keys liên quan đến account/credentials
const accountKeys = allKeys.filter(key => 
  key.includes('account') || 
  key.includes('credential') || 
  key.includes('zalo') ||
  key.includes('login') ||
  key.includes('auth')
);

console.log('🔑 Account-related keys:', accountKeys);

// Kiểm tra từng key
for (const key of accountKeys) {
  try {
    const value = store.get(key);
    console.log(`\n📝 Key: ${key}`);
    console.log('📄 Value type:', typeof value);
    if (typeof value === 'object') {
      console.log('📄 Object keys:', Object.keys(value || {}));
      // Nếu có credentials
      if (value && (value.cookie || value.imei || value.userAgent)) {
        console.log('✅ Found credentials in key:', key);
        console.log('📋 Credentials structure:', {
          hasCookie: !!value.cookie,
          hasImei: !!value.imei,
          hasUserAgent: !!value.userAgent,
          cookieType: typeof value.cookie,
          cookieLength: Array.isArray(value.cookie) ? value.cookie.length : 'not array'
        });
      }
    }
  } catch (error) {
    console.log(`❌ Error reading key ${key}:`, error.message);
  }
}

// Kiểm tra store path
console.log('\n📁 Store path:', store.path);
console.log('📁 Store size:', store.size);
