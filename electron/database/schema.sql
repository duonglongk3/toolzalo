-- Zalo Manager Database Schema
-- SQLite3 Database for Multi-Account Management

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Accounts table
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

-- Friends table (linked to accounts)
CREATE TABLE IF NOT EXISTS friends (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    phone TEXT,
    avatar TEXT,
    status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('online', 'offline', 'unknown')),
    added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_interaction DATETIME,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE(account_id, id)
);

-- Friend tags table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS friend_tags (
    friend_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (friend_id, account_id, tag),
    FOREIGN KEY (friend_id, account_id) REFERENCES friends(id, account_id) ON DELETE CASCADE
);

-- Groups table (linked to accounts)
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    avatar TEXT,
    member_count INTEGER NOT NULL DEFAULT 0,
    is_admin BOOLEAN NOT NULL DEFAULT 0,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME,
    type TEXT NOT NULL DEFAULT 'private' CHECK(type IN ('public', 'private')),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE(account_id, id)
);

-- Message templates table
CREATE TABLE IF NOT EXISTS message_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('personal', 'group')),
    category TEXT,
    variables TEXT, -- JSON array of variable names
    media TEXT, -- JSON array of media attachments
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Message logs table (linked to accounts)
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

-- Share content table
CREATE TABLE IF NOT EXISTS share_content (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category_id TEXT,
    media TEXT, -- JSON array
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Share categories table
CREATE TABLE IF NOT EXISTS share_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
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

-- Triggers for updated_at
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

