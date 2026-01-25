import Database from 'better-sqlite3'
import type {
  DbAccount,
  DbAccountInsert,
  DbAccountUpdate,
  DbFriend,
  DbFriendInsert,
  DbFriendUpdate,
  DbGroup,
  DbGroupInsert,
  DbGroupUpdate,
  DbMessageTemplate,
  DbMessageTemplateInsert,
  DbMessageTemplateUpdate,
  DbMessageLog,
  DbMessageLogInsert,
  DbShareContent,
  DbShareContentInsert,
  DbShareContentUpdate,
  DbShareCategory,
  DbShareCategoryInsert,
  FriendWithTags
} from './models'

export class DatabaseService {
  private readonly db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { verbose: console.log })
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('journal_mode = WAL')
    this.checkAndMigrateSchema()
    this.initialize()
  }

  private checkAndMigrateSchema() {
    // Check if friends table has old schema (id as PRIMARY KEY instead of composite)
    try {
      const tableInfo = this.db.prepare("PRAGMA table_info(friends)").all() as any[]
      if (tableInfo.length > 0) {
        // Check if 'id' column has pk=1 (sole primary key) - old schema
        const idCol = tableInfo.find(c => c.name === 'id')
        const accountIdCol = tableInfo.find(c => c.name === 'account_id')
        
        // If id is the only primary key (pk=1) and account_id is not part of pk (pk=0)
        if (idCol?.pk === 1 && accountIdCol?.pk === 0) {
          console.log('🔄 Detected old schema, migrating friends and groups tables...')
          this.migrateToCompositeKeys()
        }
      }
    } catch (e) {
      // Table doesn't exist yet, will be created in initialize()
    }
  }

  private migrateToCompositeKeys() {
    this.db.exec('PRAGMA foreign_keys = OFF')
    
    try {
      this.db.transaction(() => {
        // Migrate friends table
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS friends_new (
            id TEXT NOT NULL,
            account_id TEXT NOT NULL,
            name TEXT NOT NULL,
            display_name TEXT NOT NULL,
            phone TEXT,
            avatar TEXT,
            status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('online', 'offline', 'unknown')),
            added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_interaction DATETIME,
            PRIMARY KEY (id, account_id),
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
          );
          INSERT OR IGNORE INTO friends_new SELECT * FROM friends;
          DROP TABLE friends;
          ALTER TABLE friends_new RENAME TO friends;
        `)

        // Migrate groups table
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS groups_new (
            id TEXT NOT NULL,
            account_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            avatar TEXT,
            member_count INTEGER NOT NULL DEFAULT 0,
            is_admin BOOLEAN NOT NULL DEFAULT 0,
            joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_activity DATETIME,
            type TEXT NOT NULL DEFAULT 'private' CHECK(type IN ('public', 'private')),
            PRIMARY KEY (id, account_id),
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
          );
          INSERT OR IGNORE INTO groups_new SELECT * FROM groups;
          DROP TABLE groups;
          ALTER TABLE groups_new RENAME TO groups;
        `)

        console.log('✅ Schema migration completed')
      })()
    } catch (e) {
      console.error('❌ Schema migration failed:', e)
    }

    this.db.exec('PRAGMA foreign_keys = ON')
  }

  private initialize() {
    // Execute schema inline instead of reading from file
    const schema = `
-- Zalo Manager Database Schema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    imei TEXT NOT NULL,
    cookie TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'offline' CHECK(status IN ('online', 'offline', 'error')),
    last_login DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS friends (
    id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    phone TEXT,
    avatar TEXT,
    status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('online', 'offline', 'unknown')),
    added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_interaction DATETIME,
    PRIMARY KEY (id, account_id),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS friend_tags (
    friend_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (friend_id, account_id, tag),
    FOREIGN KEY (friend_id, account_id) REFERENCES friends(id, account_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS groups (
    id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    avatar TEXT,
    member_count INTEGER NOT NULL DEFAULT 0,
    is_admin BOOLEAN NOT NULL DEFAULT 0,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME,
    type TEXT NOT NULL DEFAULT 'private' CHECK(type IN ('public', 'private')),
    PRIMARY KEY (id, account_id),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS message_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('personal', 'group')),
    category TEXT,
    variables TEXT,
    media TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_logs (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    recipient_type TEXT NOT NULL CHECK(recipient_type IN ('friend', 'group')),
    content TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('sent', 'failed', 'delivered', 'read')),
    sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    error TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS share_content (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category_id TEXT,
    media TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS share_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_friends_account_id ON friends(account_id);
CREATE INDEX IF NOT EXISTS idx_friends_name ON friends(name);
CREATE INDEX IF NOT EXISTS idx_friends_phone ON friends(phone);
CREATE INDEX IF NOT EXISTS idx_friend_tags_account_id ON friend_tags(account_id);
CREATE INDEX IF NOT EXISTS idx_friend_tags_tag ON friend_tags(tag);
CREATE INDEX IF NOT EXISTS idx_groups_account_id ON groups(account_id);
CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);
CREATE INDEX IF NOT EXISTS idx_message_logs_account_id ON message_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_recipient ON message_logs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_sent_at ON message_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_share_content_category ON share_content(category_id);

CREATE TRIGGER IF NOT EXISTS update_accounts_timestamp
AFTER UPDATE ON accounts
BEGIN
    UPDATE accounts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_templates_timestamp
AFTER UPDATE ON message_templates
BEGIN
    UPDATE message_templates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_share_content_timestamp
AFTER UPDATE ON share_content
BEGIN
    UPDATE share_content SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
    `
    this.db.exec(schema)
  }

  // ==================== ACCOUNTS ====================
  
  createAccount(account: DbAccountInsert): DbAccount {
    const stmt = this.db.prepare(`
      INSERT INTO accounts (id, name, phone, imei, cookie, user_agent, status, last_login)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      account.id,
      account.name,
      account.phone,
      account.imei,
      account.cookie,
      account.user_agent,
      account.status,
      account.last_login
    )
    return this.getAccount(account.id)!
  }

  getAccount(id: string): DbAccount | undefined {
    const stmt = this.db.prepare('SELECT * FROM accounts WHERE id = ?')
    return stmt.get(id) as DbAccount | undefined
  }

  getAllAccounts(): DbAccount[] {
    const stmt = this.db.prepare('SELECT * FROM accounts ORDER BY created_at DESC')
    return stmt.all() as DbAccount[]
  }

  updateAccount(id: string, updates: DbAccountUpdate): DbAccount | undefined {
    const fields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ')
    
    if (fields.length === 0) return this.getAccount(id)

    const stmt = this.db.prepare(`UPDATE accounts SET ${fields} WHERE id = ?`)
    stmt.run(...Object.values(updates), id)
    return this.getAccount(id)
  }

  deleteAccount(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM accounts WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  // ==================== FRIENDS ====================
  
  createFriend(friend: DbFriendInsert): DbFriend {
    const stmt = this.db.prepare(`
      INSERT INTO friends (id, account_id, name, display_name, phone, avatar, status, last_interaction)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      friend.id,
      friend.account_id,
      friend.name,
      friend.display_name,
      friend.phone,
      friend.avatar,
      friend.status,
      friend.last_interaction
    )
    return this.getFriend(friend.id, friend.account_id)!
  }

  upsertFriend(friend: DbFriendInsert): DbFriend {
    const existing = this.getFriend(friend.id, friend.account_id)
    if (existing) {
      const updates: DbFriendUpdate = {
        name: friend.name,
        display_name: friend.display_name,
        phone: friend.phone,
        avatar: friend.avatar,
        status: friend.status,
        last_interaction: friend.last_interaction
      }
      return this.updateFriend(friend.id, friend.account_id, updates)!
    }
    return this.createFriend(friend)
  }

  getFriend(id: string, accountId: string): DbFriend | undefined {
    const stmt = this.db.prepare('SELECT * FROM friends WHERE id = ? AND account_id = ?')
    return stmt.get(id, accountId) as DbFriend | undefined
  }

  getFriendsByAccount(accountId: string): DbFriend[] {
    const stmt = this.db.prepare('SELECT * FROM friends WHERE account_id = ? ORDER BY name')
    return stmt.all(accountId) as DbFriend[]
  }

  getFriendsWithTags(accountId: string): FriendWithTags[] {
    const friends = this.getFriendsByAccount(accountId)
    return friends.map(friend => ({
      ...friend,
      tags: this.getFriendTags(friend.id, accountId)
    }))
  }

  updateFriend(id: string, accountId: string, updates: DbFriendUpdate): DbFriend | undefined {
    const fields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ')
    
    if (fields.length === 0) return this.getFriend(id, accountId)

    const stmt = this.db.prepare(`UPDATE friends SET ${fields} WHERE id = ? AND account_id = ?`)
    stmt.run(...Object.values(updates), id, accountId)
    return this.getFriend(id, accountId)
  }

  deleteFriend(id: string, accountId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM friends WHERE id = ? AND account_id = ?')
    const result = stmt.run(id, accountId)
    return result.changes > 0
  }

  // ==================== FRIEND TAGS ====================
  
  addFriendTag(friendId: string, accountId: string, tag: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO friend_tags (friend_id, account_id, tag)
      VALUES (?, ?, ?)
    `)
    stmt.run(friendId, accountId, tag)
  }

  removeFriendTag(friendId: string, accountId: string, tag: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM friend_tags WHERE friend_id = ? AND account_id = ? AND tag = ?
    `)
    stmt.run(friendId, accountId, tag)
  }

  getFriendTags(friendId: string, accountId: string): string[] {
    const stmt = this.db.prepare(`
      SELECT tag FROM friend_tags WHERE friend_id = ? AND account_id = ?
    `)
    const rows = stmt.all(friendId, accountId) as { tag: string }[]
    return rows.map(r => r.tag)
  }

  getAllTagsByAccount(accountId: string): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT tag FROM friend_tags WHERE account_id = ? ORDER BY tag
    `)
    const rows = stmt.all(accountId) as { tag: string }[]
    return rows.map(r => r.tag)
  }

  // ==================== GROUPS ====================
  
  createGroup(group: DbGroupInsert): DbGroup {
    const stmt = this.db.prepare(`
      INSERT INTO groups (id, account_id, name, description, avatar, member_count, is_admin, last_activity, type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      group.id,
      group.account_id,
      group.name,
      group.description,
      group.avatar,
      group.member_count,
      group.is_admin,
      group.last_activity,
      group.type
    )
    return this.getGroup(group.id, group.account_id)!
  }

  upsertGroup(group: DbGroupInsert): DbGroup {
    const existing = this.getGroup(group.id, group.account_id)
    if (existing) {
      const updates: DbGroupUpdate = {
        name: group.name,
        description: group.description,
        avatar: group.avatar,
        member_count: group.member_count,
        is_admin: group.is_admin,
        last_activity: group.last_activity,
        type: group.type
      }
      return this.updateGroup(group.id, group.account_id, updates)!
    }
    return this.createGroup(group)
  }

  getGroup(id: string, accountId: string): DbGroup | undefined {
    const stmt = this.db.prepare('SELECT * FROM groups WHERE id = ? AND account_id = ?')
    return stmt.get(id, accountId) as DbGroup | undefined
  }

  getGroupsByAccount(accountId: string): DbGroup[] {
    const stmt = this.db.prepare('SELECT * FROM groups WHERE account_id = ? ORDER BY name')
    return stmt.all(accountId) as DbGroup[]
  }

  updateGroup(id: string, accountId: string, updates: DbGroupUpdate): DbGroup | undefined {
    const fields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ')
    
    if (fields.length === 0) return this.getGroup(id, accountId)

    const stmt = this.db.prepare(`UPDATE groups SET ${fields} WHERE id = ? AND account_id = ?`)
    stmt.run(...Object.values(updates), id, accountId)
    return this.getGroup(id, accountId)
  }

  deleteGroup(id: string, accountId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM groups WHERE id = ? AND account_id = ?')
    const result = stmt.run(id, accountId)
    return result.changes > 0
  }

  // ==================== MESSAGE TEMPLATES ====================
  
  createTemplate(template: DbMessageTemplateInsert): DbMessageTemplate {
    const stmt = this.db.prepare(`
      INSERT INTO message_templates (id, name, content, type, category, variables, media)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      template.id,
      template.name,
      template.content,
      template.type,
      template.category,
      template.variables,
      template.media
    )
    return this.getTemplate(template.id)!
  }

  getTemplate(id: string): DbMessageTemplate | undefined {
    const stmt = this.db.prepare('SELECT * FROM message_templates WHERE id = ?')
    return stmt.get(id) as DbMessageTemplate | undefined
  }

  getAllTemplates(): DbMessageTemplate[] {
    const stmt = this.db.prepare('SELECT * FROM message_templates ORDER BY name')
    return stmt.all() as DbMessageTemplate[]
  }

  updateTemplate(id: string, updates: DbMessageTemplateUpdate): DbMessageTemplate | undefined {
    const fields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ')
    
    if (fields.length === 0) return this.getTemplate(id)

    const stmt = this.db.prepare(`UPDATE message_templates SET ${fields} WHERE id = ?`)
    stmt.run(...Object.values(updates), id)
    return this.getTemplate(id)
  }

  deleteTemplate(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM message_templates WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  // ==================== MESSAGE LOGS ====================

  createMessageLog(log: DbMessageLogInsert): DbMessageLog {
    const stmt = this.db.prepare(`
      INSERT INTO message_logs (id, account_id, recipient_id, recipient_type, content, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      log.id,
      log.account_id,
      log.recipient_id,
      log.recipient_type,
      log.content,
      log.status,
      log.error
    )
    return this.getMessageLog(log.id)!
  }

  getMessageLog(id: string): DbMessageLog | undefined {
    const stmt = this.db.prepare('SELECT * FROM message_logs WHERE id = ?')
    return stmt.get(id) as DbMessageLog | undefined
  }

  getMessageLogsByAccount(accountId: string, limit = 100): DbMessageLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM message_logs
      WHERE account_id = ?
      ORDER BY sent_at DESC
      LIMIT ?
    `)
    return stmt.all(accountId, limit) as DbMessageLog[]
  }

  // ==================== SHARE CONTENT ====================

  createShareContent(content: DbShareContentInsert): DbShareContent {
    const stmt = this.db.prepare(`
      INSERT INTO share_content (id, title, content, category_id, media)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(
      content.id,
      content.title,
      content.content,
      content.category_id,
      content.media
    )
    return this.getShareContent(content.id)!
  }

  getShareContent(id: string): DbShareContent | undefined {
    const stmt = this.db.prepare('SELECT * FROM share_content WHERE id = ?')
    return stmt.get(id) as DbShareContent | undefined
  }

  getAllShareContent(): DbShareContent[] {
    const stmt = this.db.prepare('SELECT * FROM share_content ORDER BY created_at DESC')
    return stmt.all() as DbShareContent[]
  }

  updateShareContent(id: string, updates: DbShareContentUpdate): DbShareContent | undefined {
    const fields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ')

    if (fields.length === 0) return this.getShareContent(id)

    const stmt = this.db.prepare(`UPDATE share_content SET ${fields} WHERE id = ?`)
    stmt.run(...Object.values(updates), id)
    return this.getShareContent(id)
  }

  deleteShareContent(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM share_content WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  // ==================== SHARE CATEGORIES ====================

  createShareCategory(category: DbShareCategoryInsert): DbShareCategory {
    const stmt = this.db.prepare(`
      INSERT INTO share_categories (id, name, description, color)
      VALUES (?, ?, ?, ?)
    `)
    stmt.run(category.id, category.name, category.description, category.color)
    return this.getShareCategory(category.id)!
  }

  getShareCategory(id: string): DbShareCategory | undefined {
    const stmt = this.db.prepare('SELECT * FROM share_categories WHERE id = ?')
    return stmt.get(id) as DbShareCategory | undefined
  }

  getAllShareCategories(): DbShareCategory[] {
    const stmt = this.db.prepare('SELECT * FROM share_categories ORDER BY name')
    return stmt.all() as DbShareCategory[]
  }

  deleteShareCategory(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM share_categories WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  // ==================== UTILITIES ====================

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }

  close() {
    this.db.close()
  }
}

