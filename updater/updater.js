const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const readline = require('readline');

// Configuration
const CONFIG = {
  updateUrl: 'https://tool.socialautopro.com/api/check-update',
  appName: 'ZALO TOOL - SOCIALAUTOPRO',
  currentVersion: '1.0.0'
};

// Colors for console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logHeader() {
  console.log('\n');
  log('╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║           ZALO TOOL - SOCIALAUTOPRO UPDATER                ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  console.log('\n');
}

// Read current version from package.json if exists
function getCurrentVersion() {
  try {
    const packagePath = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return pkg.version || CONFIG.currentVersion;
    }
  } catch (e) {}
  return CONFIG.currentVersion;
}

// Compare versions
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

// Fetch JSON from URL
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    }).on('error', reject);
  });
}

// Download file with progress
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    
    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: ${res.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(res.headers['content-length'], 10);
      let downloadedSize = 0;
      let lastPercent = 0;
      
      res.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const percent = Math.round((downloadedSize / totalSize) * 100);
        
        if (percent !== lastPercent) {
          lastPercent = percent;
          const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
          const sizeMB = (downloadedSize / 1024 / 1024).toFixed(1);
          const totalMB = (totalSize / 1024 / 1024).toFixed(1);
          process.stdout.write(`\r  [${bar}] ${percent}% (${sizeMB}/${totalMB} MB)`);
        }
      });
      
      res.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('\n');
        resolve(destPath);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// Ask user confirmation
function askConfirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes' || answer === '');
    });
  });
}

// Main update function
async function checkForUpdates() {
  logHeader();
  
  const currentVersion = getCurrentVersion();
  log(`  Phiên bản hiện tại: v${currentVersion}`, 'yellow');
  log('  Đang kiểm tra bản cập nhật...', 'cyan');
  console.log('');
  
  try {
    // Check for updates from server
    const updateInfo = await fetchJson(CONFIG.updateUrl);
    
    if (!updateInfo || !updateInfo.version) {
      log('  ✗ Không thể kiểm tra cập nhật. Vui lòng thử lại sau.', 'red');
      return;
    }
    
    const latestVersion = updateInfo.version;
    const comparison = compareVersions(latestVersion, currentVersion);
    
    if (comparison <= 0) {
      log('  ✓ Bạn đang sử dụng phiên bản mới nhất!', 'green');
      console.log('');
      return;
    }
    
    // New version available
    log(`  ★ Phát hiện bản mới: v${latestVersion}`, 'green');
    console.log('');
    
    if (updateInfo.changelog) {
      log('  Thay đổi:', 'cyan');
      updateInfo.changelog.split('\n').forEach(line => {
        log(`    ${line}`, 'reset');
      });
      console.log('');
    }
    
    // Ask to download
    const shouldDownload = await askConfirm('  Bạn có muốn tải và cài đặt bản mới? (Y/n): ');
    
    if (!shouldDownload) {
      log('  Đã hủy cập nhật.', 'yellow');
      return;
    }
    
    // Download update
    const downloadUrl = updateInfo.downloadUrl;
    if (!downloadUrl) {
      log('  ✗ Không tìm thấy link tải.', 'red');
      return;
    }
    
    const fileName = `ZALO_TOOL_Setup_${latestVersion}.exe`;
    const downloadPath = path.join(process.env.TEMP || '.', fileName);
    
    log(`  Đang tải bản cập nhật...`, 'cyan');
    console.log('');
    
    await downloadFile(downloadUrl, downloadPath);
    
    log('  ✓ Tải xuống hoàn tất!', 'green');
    console.log('');
    
    // Ask to install
    const shouldInstall = await askConfirm('  Bạn có muốn cài đặt ngay? (Y/n): ');
    
    if (shouldInstall) {
      log('  Đang khởi chạy trình cài đặt...', 'cyan');
      
      // Run installer
      const installer = spawn(downloadPath, [], {
        detached: true,
        stdio: 'ignore'
      });
      installer.unref();
      
      log('  ✓ Trình cài đặt đã được khởi chạy. Vui lòng làm theo hướng dẫn.', 'green');
      
      // Exit after 2 seconds
      setTimeout(() => process.exit(0), 2000);
    } else {
      log(`  File cài đặt đã được lưu tại:`, 'cyan');
      log(`  ${downloadPath}`, 'yellow');
    }
    
  } catch (error) {
    log(`  ✗ Lỗi: ${error.message}`, 'red');
    console.log('');
    log('  Vui lòng kiểm tra kết nối mạng và thử lại.', 'yellow');
  }
}

// Wait for user to press Enter before exit
async function waitAndExit() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log('');
    rl.question('  Nhấn Enter để thoát...', () => {
      rl.close();
      resolve();
    });
  });
}

// Run
(async () => {
  await checkForUpdates();
  await waitAndExit();
})();
