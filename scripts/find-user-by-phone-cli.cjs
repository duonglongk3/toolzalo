#!/usr/bin/env node
/*
 * CLI: Tìm userId từ số điện thoại
 * Ví dụ:
 *   node scripts/find-user-by-phone-cli.cjs --phone 0987654321
 */

const fs = require('fs');
const path = require('path');
const process = require('process');
const { Zalo } = require('../zca-js/dist/cjs/index.cjs');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) {
      args[m[1]] = m[2];
    } else if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[k] = v;
    }
  }
  return args;
}

function readJSON(file) {
  const abs = path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) return null;
  const raw = fs.readFileSync(abs, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const args = parseArgs(process.argv);
  
  // Validate phone
  const phone = args.phone || args.p;
  if (!phone) {
    console.error('❌ Thiếu số điện thoại. Sử dụng: --phone <số điện thoại>');
    console.error('Ví dụ: node scripts/find-user-by-phone-cli.cjs --phone 0987654321');
    process.exit(1);
  }

  const cleanPhone = String(phone).trim();
  console.log('🔍 Tìm kiếm số điện thoại:', cleanPhone);

  // Load account
  const accState = readJSON('data/zalo-accounts.json');
  if (!accState) {
    console.error('❌ Không tìm thấy file data/zalo-accounts.json');
    process.exit(1);
  }
  const active = accState?.state?.activeAccount;
  if (!active) {
    console.error('❌ Không tìm thấy tài khoản active trong data/zalo-accounts.json');
    process.exit(1);
  }
  const cookieArr = (() => { try { return JSON.parse(active.cookie); } catch { return null; } })();
  if (!cookieArr) {
    console.error('❌ Cookie activeAccount không hợp lệ.');
    process.exit(1);
  }

  // Login
  const zalo = new Zalo();
  console.log('🔐 Đăng nhập bằng tài khoản:', active.phone || active.name);
  const api = await zalo.login({ imei: active.imei, userAgent: active.userAgent, cookie: cookieArr });

  // Find user
  console.log('🔎 Đang tìm kiếm...');
  try {
    const result = await api.findUser(cleanPhone);

    console.log('');
    console.log('🔍 Raw result:', JSON.stringify(result, null, 2));
    console.log('');

    // Try different paths to find userId
    let userId = null;
    let userName = null;
    let displayName = null;

    if (result?.data?.uid) {
      userId = result.data.uid;
      userName = result.data.zalo_name;
      displayName = result.data.display_name;
    } else if (result?.uid) {
      userId = result.uid;
      userName = result.zalo_name;
      displayName = result.display_name;
    } else if (result?.info?.data?.uid) {
      userId = result.info.data.uid;
      userName = result.info.data.zalo_name;
      displayName = result.info.data.display_name;
    }

    if (!userId) {
      console.log('❌ Không tìm thấy userId trong response');
      process.exit(1);
    }

    console.log('✅ Tìm thấy user!');
    console.log('📋 Thông tin:');
    console.log('   - User ID:', userId);
    console.log('   - Tên Zalo:', userName);
    console.log('   - Tên hiển thị:', displayName);
    console.log('');
    console.log('💡 Sử dụng userId này để gửi tin nhắn:');
    console.log(`   node scripts/send-by-userid-cli.cjs --userId=${userId} --msg="Xin chào"`);

  } catch (error) {
    console.error('❌ Lỗi khi tìm kiếm:', error?.message || error);
    if (error?.stack) console.error(error.stack);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Lỗi:', err?.message || err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});

