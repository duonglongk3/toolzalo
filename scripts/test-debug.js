#!/usr/bin/env node

/**
 * Script để test debug configuration
 * Kiểm tra xem các file cần thiết có tồn tại không
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Kiểm tra Debug Configuration...\n');

// Các file cần kiểm tra
const requiredFiles = [
  '.vscode/launch.json',
  '.vscode/tasks.json', 
  '.vscode/settings.json',
  '.vscode/extensions.json',
  'dist/main/main.js',
  'dist/main/main.js.map',
  'dist/main/preload.js',
  'dist/main/preload.js.map',
  'package.json',
  'tsconfig.main.json'
];

let allGood = true;

// Kiểm tra từng file
requiredFiles.forEach(file => {
  const exists = fs.existsSync(file);
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${file}`);
  
  if (!exists) {
    allGood = false;
  }
});

console.log('\n📋 Kiểm tra Launch Configurations...');

try {
  const launchConfig = JSON.parse(fs.readFileSync('.vscode/launch.json', 'utf8'));
  const configs = launchConfig.configurations;
  
  console.log(`✅ Tìm thấy ${configs.length} debug configurations:`);
  configs.forEach(config => {
    console.log(`   - ${config.name}`);
  });
  
  // Kiểm tra compound configurations
  if (launchConfig.compounds && launchConfig.compounds.length > 0) {
    console.log(`✅ Tìm thấy ${launchConfig.compounds.length} compound configurations:`);
    launchConfig.compounds.forEach(compound => {
      console.log(`   - ${compound.name}`);
    });
  }
  
} catch (error) {
  console.log('❌ Lỗi đọc launch.json:', error.message);
  allGood = false;
}

console.log('\n🔧 Kiểm tra Tasks...');

try {
  const tasksConfig = JSON.parse(fs.readFileSync('.vscode/tasks.json', 'utf8'));
  const tasks = tasksConfig.tasks;
  
  console.log(`✅ Tìm thấy ${tasks.length} tasks:`);
  tasks.forEach(task => {
    console.log(`   - ${task.label}`);
  });
  
} catch (error) {
  console.log('❌ Lỗi đọc tasks.json:', error.message);
  allGood = false;
}

console.log('\n📦 Kiểm tra Package Scripts...');

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const scripts = packageJson.scripts;
  
  const debugRelatedScripts = [
    'dev',
    'dev:main', 
    'dev:renderer',
    'build:main',
    'build:renderer',
    'build',
    'start'
  ];
  
  debugRelatedScripts.forEach(script => {
    if (scripts[script]) {
      console.log(`✅ ${script}: ${scripts[script]}`);
    } else {
      console.log(`❌ Missing script: ${script}`);
      allGood = false;
    }
  });
  
} catch (error) {
  console.log('❌ Lỗi đọc package.json:', error.message);
  allGood = false;
}

console.log('\n🎯 Hướng Dẫn Sử Dụng:');
console.log('1. Mở VSCode');
console.log('2. Chuyển đến tab Run and Debug (Ctrl+Shift+D)');
console.log('3. Chọn một trong các debug configurations:');
console.log('   - 🚀 Debug Electron Main Process');
console.log('   - 🎨 Debug Electron Renderer Process');
console.log('   - 🔧 Debug Full Electron App');
console.log('   - 🏗️ Build & Debug Electron');
console.log('   - 🧪 Debug Tests');
console.log('   - 🚀🎨 Debug Main + Renderer (Compound)');
console.log('4. Đặt breakpoints trong code');
console.log('5. Nhấn F5 để bắt đầu debug');

console.log('\n💡 Tips:');
console.log('- Sử dụng F12 để mở DevTools trong app');
console.log('- Main process debug port: 5858');
console.log('- Renderer process debug port: 9222');
console.log('- Đọc .vscode/DEBUG_GUIDE.md để biết thêm chi tiết');

if (allGood) {
  console.log('\n🎉 Tất cả đã sẵn sàng cho debug!');
  process.exit(0);
} else {
  console.log('\n⚠️  Có một số vấn đề cần khắc phục.');
  process.exit(1);
}
