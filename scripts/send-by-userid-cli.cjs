#!/usr/bin/env node
/*
 * CLI: Gửi tin nhắn trực tiếp bằng userId (không cần là bạn bè)
 * Ví dụ:
 *   node scripts/send-by-userid-cli.cjs --userId 500534362342884257 --msg "Xin chào"
 *   node scripts/send-by-userid-cli.cjs --userId 500534362342884257 --tpl test
 *   node scripts/send-by-userid-cli.cjs --userId 500534362342884257 --tpl test --img "C:\\path\\to\\image.png"
 */

const fs = require('fs');
const path = require('path');
const process = require('process');
const { Zalo, ThreadType } = require('../zca-js/dist/cjs/index.cjs');

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

function getImageMeta(filePath) {
  const stat = fs.statSync(filePath);
  const size = stat.size;
  const fd = fs.openSync(filePath, 'r');
  try {
    const sig = Buffer.alloc(16);
    fs.readSync(fd, sig, 0, 16, 0);
    // PNG signature
    if (sig.slice(0, 8).equals(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]))) {
      const ihdr = Buffer.alloc(24);
      fs.readSync(fd, ihdr, 0, 24, 8);
      const width = ihdr.readUInt32BE(8);
      const height = ihdr.readUInt32BE(12);
      if (width && height) return { width, height, size };
    }
    // JPEG SOF
    if (sig[0] === 0xFF && sig[1] === 0xD8) {
      let filePos = 2;
      const buf = Buffer.alloc(65536);
      while (true) {
        const read = fs.readSync(fd, buf, 0, buf.length, filePos);
        if (!read) break;
        let i = 0;
        while (i + 9 < read) {
          if (buf[i] === 0xFF && buf[i+1] >= 0xC0 && buf[i+1] <= 0xCF && ![0xC4,0xC8,0xCC].includes(buf[i+1])) {
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
  } catch (_) {
  } finally {
    fs.closeSync(fd);
  }
  return null;
}

function stripAccents(s) {
  return (s || '').normalize('NFD').replace(/\p{Diacritic}+/gu, '').toLowerCase();
}

function findTemplateByName(nameQuery, tplState) {
  const list = tplState?.state?.templates || [];
  const q = stripAccents(nameQuery);
  const matches = list.filter(t => stripAccents(t.name).includes(q));
  return matches[0] || null;
}

async function main() {
  const args = parseArgs(process.argv);
  
  // Validate userId
  const userId = args.userId || args.uid || args.id;
  if (!userId) {
    console.error('❌ Thiếu userId. Sử dụng: --userId <userId>');
    console.error('Ví dụ: node scripts/send-by-userid-cli.cjs --userId 500534362342884257 --msg "Xin chào"');
    process.exit(1);
  }

  // Normalize userId (chỉ giữ số) - QUAN TRỌNG: giữ dạng string để tránh mất precision
  const normalizedUserId = String(userId).replace(/[^\d]/g, '');
  if (!normalizedUserId) {
    console.error('❌ userId không hợp lệ:', userId);
    process.exit(1);
  }

  console.log('🎯 Target userId (raw):', userId);
  console.log('🎯 Target userId (normalized):', normalizedUserId);
  console.log('🎯 Length:', normalizedUserId.length, 'chars');

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

  // Prepare message
  let msg = '';
  let attachments = [];

  // Option 1: Use template
  if (args.tpl) {
    const tplState = readJSON('data/zalo-templates.json');
    if (!tplState) {
      console.error('❌ Không tìm thấy file data/zalo-templates.json');
      process.exit(1);
    }
    const tpl = findTemplateByName(args.tpl, tplState);
    if (!tpl) {
      console.error(`❌ Không tìm thấy template tên chứa "${args.tpl}"`);
      process.exit(1);
    }
    console.log('📝 Template:', tpl.name);
    msg = String(tpl.content || '');
    
    // Get attachments from template
    const media = Array.isArray(tpl.media) ? tpl.media : [];
    attachments = media
      .map(m => m?.path)
      .filter(Boolean)
      .map(p => path.resolve(p))
      .filter(p => fs.existsSync(p));
  }

  // Option 2: Direct message
  if (args.msg) {
    msg = String(args.msg);
  }

  // Option 3: Add image/file
  if (args.img || args.image || args.file) {
    const filePath = args.img || args.image || args.file;
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
      console.error('❌ File không tồn tại:', absPath);
      process.exit(1);
    }
    attachments.push(absPath);
  }

  // Validate message
  if (!msg && attachments.length === 0) {
    console.error('❌ Thiếu nội dung tin nhắn. Sử dụng --msg hoặc --tpl hoặc --img');
    console.error('Ví dụ:');
    console.error('  --msg "Xin chào"');
    console.error('  --tpl test');
    console.error('  --img "C:\\path\\to\\image.png"');
    process.exit(1);
  }

  console.log('💬 Message:', msg || '(no text)');
  if (attachments.length > 0) {
    console.log('📎 Attachments:', attachments);
  }

  // Login
  const zalo = new Zalo({ imageMetadataGetter: async (p) => getImageMeta(p) });
  console.log('🔐 Đăng nhập bằng tài khoản:', active.phone || active.name);
  const api = await zalo.login({ imei: active.imei, userAgent: active.userAgent, cookie: cookieArr });

  // Try to add friend first (optional, helps with non-friend users)
  if (args.addFriend || args.friend) {
    console.log('👥 Đang gửi lời mời kết bạn...');
    try {
      await api.sendFriendRequest('', normalizedUserId);
      console.log('✅ Đã gửi lời mời kết bạn');
      // Wait a bit for the request to be processed
      await new Promise(r => setTimeout(r, 2000));
    } catch (friendError) {
      const errMsg = friendError?.message || String(friendError);
      if (errMsg.includes('225') || errMsg.includes('222')) {
        console.log('ℹ️ Đã là bạn bè hoặc đã gửi lời mời trước đó');
      } else {
        console.warn('⚠️ Không thể kết bạn:', errMsg);
      }
    }
  }

  // Send message
  console.log('📤 Đang gửi tin nhắn...');
  try {
    const payload = {
      msg: msg || '',
      attachments: attachments.length > 0 ? attachments : undefined
    };

    const res = await api.sendMessage(payload, normalizedUserId, ThreadType.User);

    console.log('✅ Gửi thành công!');
    console.log('📊 Kết quả:', {
      message: !!res.message,
      messageId: res.message?.msgId,
      attachments: res.attachment?.length || 0,
    });
  } catch (error) {
    console.error('❌ Lỗi khi gửi:', error?.message || error);

    // If failed and not tried to add friend yet, suggest adding friend
    if (!args.addFriend && !args.friend) {
      console.log('');
      console.log('💡 Gợi ý: Thử thêm --addFriend để tự động kết bạn trước khi gửi');
      console.log('   Ví dụ: node scripts/send-by-userid-cli.cjs --userId 500534362342884257 --msg "Test" --addFriend');
    }

    if (error?.stack) console.error(error.stack);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Lỗi:', err?.message || err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});

