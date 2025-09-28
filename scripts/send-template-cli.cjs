#!/usr/bin/env node
/*
 * CLI: Gửi template theo tên (kèm ảnh/video/file nếu có) tới bạn bè hoặc nhóm
 * - Đọc từ data/zalo-templates.json, data/zalo-accounts.json, data/zalo-friends.json / data/zalo-groups.json
 * - Ưu tiên kiểm thử template 'test' cá nhân gửi tới bạn 'Văn Sơn'
 * Ví dụ:
 *   npm run send:tpl:son
 *   npm run send:tpl -- --tpl "test" --name "Tên bạn" --cat personal
 *   npm run send:tpl -- --tpl "test" --group "Tên nhóm" --cat group
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

function stripAccents(s) {
  return (s || '').normalize('NFD').replace(/\p{Diacritic}+/gu, '').toLowerCase();
}

function readJSON(file) {
  const abs = path.resolve(process.cwd(), file);
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

function findTemplateByName(nameQuery, category, tplState) {
  const list = tplState?.state?.templates || [];
  const q = stripAccents(nameQuery);
  const matches = list.filter(t => stripAccents(t.name).includes(q) && (!category || t.category === category));
  // Ưu tiên đúng category, nếu không có thì trả bản đầu tiên trùng tên bất kỳ
  if (matches.length) return matches[0];
  const anyMatches = list.filter(t => stripAccents(t.name).includes(q));
  return anyMatches[0] || null;
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

function findGroupIdByName(nameQuery, groupsState) {
  const q = stripAccents(nameQuery);
  const list = groupsState?.state?.groups || [];
  for (const g of list) {
    const name = stripAccents(g.name || '');
    if (name.includes(q)) return g.id;
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  const tplName = args.tpl || 'test';
  const category = args.cat || args.category || 'personal'; // 'personal' | 'group'
  const friendName = args.name || (category === 'personal' ? 'Văn Sơn' : undefined);
  const groupName = args.group || (category === 'group' ? 'HVTD Thông Báo' : undefined);

  const tplState = readJSON('data/zalo-templates.json');
  const tpl = findTemplateByName(tplName, category, tplState);
  if (!tpl) {
    console.error(`Không tìm thấy template tên chứa "${tplName}"`);
    process.exit(1);
  }
  console.log('🧩 Template:', tpl.name, `(${tpl.category})`);

  const media = Array.isArray(tpl.media) ? tpl.media : [];
  const attachments = media
    .map(m => m?.path)
    .filter(Boolean)
    .map(p => path.resolve(p))
    .filter(p => fs.existsSync(p));

  const content = String(tpl.content || '');

  // Load account
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

  // Resolve target id
  let threadId = null; let type = ThreadType.User;
  if (category === 'group') {
    const groupsState = readJSON('data/zalo-groups.json');
    const gid = groupName ? findGroupIdByName(groupName, groupsState) : null;
    if (!gid) {
      console.error('Không tìm thấy nhóm phù hợp. Dùng --group "Tên nhóm"');
      process.exit(1);
    }
    threadId = gid; type = ThreadType.Group;
  } else {
    const friendsState = readJSON('data/zalo-friends.json');
    const fid = friendName ? findFriendIdByName(friendName, friendsState) : null;
    if (!fid) {
      console.error('Không tìm thấy bạn phù hợp. Dùng --name "Tên bạn"');
      process.exit(1);
    }
    threadId = fid; type = ThreadType.User;
  }

  const zalo = new Zalo({ imageMetadataGetter: async (p) => getImageMeta(p) });
  console.log('🔐 Đăng nhập bằng tài khoản:', active.phone || active.name);
  const api = await zalo.login({ imei: active.imei, userAgent: active.userAgent, cookie: cookieArr });

  // Replace variables sơ bộ
  let msg = content;
  if (type === ThreadType.User) {
    // Chèn {name} nếu có
    if (msg.includes('{name}')) {
      // Thử lấy tên từ friends store
      try {
        const friendsState = readJSON('data/zalo-friends.json');
        const list = friendsState?.state?.friends || [];
        const f = list.find(x => String(x.id) === String(threadId));
        if (f) msg = msg.replace(/\{name\}/g, f.displayName || f.name || '');
      } catch {}
    }
  }

  const hasAtt = attachments.length > 0;
  console.log('🎯 Đích:', threadId, type === ThreadType.User ? '(User)' : '(Group)');
  if (hasAtt) console.log('🖼️ Đính kèm:', attachments);

  const res = await api.sendMessage({ msg, attachments: hasAtt ? attachments : undefined }, String(threadId), type);
  console.log('✅ Kết quả:', {
    message: !!res.message,
    attachments: res.attachment?.length || 0,
  });
}

main().catch((err) => {
  console.error('❌ Lỗi:', err?.message || err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});

