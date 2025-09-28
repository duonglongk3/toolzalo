#!/usr/bin/env node
/*
 * CLI: Gửi ảnh đến bạn bè bằng Zalo thông qua zca-js
 * Sử dụng tài khoản đang active trong data/zalo-accounts.json
 * Ví dụ:
 *   node scripts/send-image-cli.cjs --name "Văn Sơn" --file "D:\\SCAN-GROUP-NHOM-NGANH\\conten-profile\\ban-hang-ol-Anh Phi Nguyễn.png" --msg "Chào bạn"
 */

const fs = require('fs');
const path = require('path');
const process = require('process');
const { Zalo, ThreadType } = require('../zca-js/dist/cjs/index.cjs');

// --------- Helpers ---------
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

function stripAccents(s) {
  return (s || '').normalize('NFD').replace(/\p{Diacritic}+/gu, '').toLowerCase();
}

function readJSON(file) {
  const abs = path.resolve(process.cwd(), file);
  const raw = fs.readFileSync(abs, 'utf8');
  return JSON.parse(raw);
}

function findFriendIdByName(nameQuery, friendsState) {
  const q = stripAccents(nameQuery);
  const list = friendsState?.state?.friends || [];
  for (const f of list) {
    const name = stripAccents(f.name || '');
    const display = stripAccents(f.displayName || '');
    if (name.includes(q) || display.includes(q)) return f.id;
  }
  return null;
}

// Minimal metadata reader (PNG + JPEG). Return {width, height, size} or null
function getImageMeta(filePath) {
  const stat = fs.statSync(filePath);
  const size = stat.size;
  const fd = fs.openSync(filePath, 'r');
  try {
    const sig = Buffer.alloc(16);
    fs.readSync(fd, sig, 0, 16, 0);
    // PNG signature
    if (sig.slice(0, 8).equals(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]))) {
      // IHDR chunk starts at byte 8+8 (length+type)
      const ihdr = Buffer.alloc(24);
      fs.readSync(fd, ihdr, 0, 24, 8);
      // bytes 8..11: length, 12..15: 'IHDR', 16..19: width, 20..23: height (big-endian)
      const width = ihdr.readUInt32BE(8);
      const height = ihdr.readUInt32BE(12);
      if (width && height) return { width, height, size };
    }
    // JPEG: scan SOF markers
    if (sig[0] === 0xFF && sig[1] === 0xD8) {
      let pos = 2;
      const buf = Buffer.alloc(65536);
      let filePos = pos;
      while (true) {
        const read = fs.readSync(fd, buf, 0, buf.length, filePos);
        if (!read) break;
        let i = 0;
        while (i + 9 < read) {
          if (buf[i] === 0xFF && buf[i+1] >= 0xC0 && buf[i+1] <= 0xCF && ![0xC4,0xC8,0xCC].includes(buf[i+1])) {
            // SOF marker
            const blockLen = buf.readUInt16BE(i+2);
            const height = buf.readUInt16BE(i+5);
            const width = buf.readUInt16BE(i+7);
            if (width && height) return { width, height, size };
          }
          if (buf[i] === 0xFF && buf[i+1] !== 0x00 && buf[i+1] !== 0xD9) {
            const blockLen = buf.readUInt16BE(i+2);
            i += 2 + blockLen;
          } else {
            i++;
          }
        }
        filePos += read;
      }
    }
  } catch (e) {
    // ignore, will fall back to null
  } finally {
    fs.closeSync(fd);
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  const friendName = args.name || 'Văn Sơn';
  const file = args.file;
  const msg = args.msg || '';
  if (!file) {
    console.error('Thiếu --file \\path\\to\\image. Ví dụ: --file "D:\\\\SCAN-GROUP-NHOM-NGANH\\\\conten-profile\\\\ban-hang-ol-Anh Phi Nguyễn.png"');
    process.exit(1);
  }
  const fileAbs = path.resolve(file);
  if (!fs.existsSync(fileAbs)) {
    console.error('Không tìm thấy file:', fileAbs);
    process.exit(1);
  }

  // Load credentials
  const accState = readJSON('data/zalo-accounts.json');
  const active = accState?.state?.activeAccount;
  if (!active) {
    console.error('Không tìm thấy tài khoản active trong data/zalo-accounts.json');
    process.exit(1);
  }
  const cookieArr = (() => { try { return JSON.parse(active.cookie); } catch { return null; } })();
  if (!cookieArr) {
    console.error('Cookie activeAccount không hợp lệ.');
    process.exit(1);
  }

  // Find friend id
  const friendsState = readJSON('data/zalo-friends.json');
  const friendId = findFriendIdByName(friendName, friendsState);
  if (!friendId) {
    console.error(`Không tìm thấy bạn có tên chứa: "${friendName}" trong data/zalo-friends.json`);
    process.exit(1);
  }

  const zalo = new Zalo({
    // image metadata getter for images (png, jpg, webp)
    imageMetadataGetter: async (p) => getImageMeta(p),
    // logging: true,
  });

  console.log('🔐 Đăng nhập bằng cookie của tài khoản:', active.phone || active.name);
  const api = await zalo.login({
    imei: active.imei,
    userAgent: active.userAgent,
    cookie: cookieArr,
  });

  const attachments = [fileAbs];
  console.log('👤 Gửi đến:', friendName, `(${friendId})`);
  console.log('🖼️ Tệp:', fileAbs);

  const res = await api.sendMessage({ msg, attachments }, String(friendId), ThreadType.User);
  const attCount = res.attachment?.length || 0;
  const ext = (fileAbs.split('.').pop() || '').toLowerCase();
  const isImage = ['png','jpg','jpeg','webp'].includes(ext);
  const sentAsCaption = isImage && !!msg && attCount === 1;
  console.log('✅ Đã gửi. Kết quả:', {
    message: !!res.message,
    attachments: attCount,
    note: sentAsCaption ? 'Ảnh + caption (desc)' : undefined,
  });
}

main().catch((err) => {
  console.error('❌ Lỗi:', err?.message || err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});

