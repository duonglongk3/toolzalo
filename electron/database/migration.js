"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationService = void 0;
/**
 * Migration utility to convert from JSON storage to SQLite
 */
class MigrationService {
    constructor(db) {
        Object.defineProperty(this, "db", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: db
        });
    }
    /**
     * Migrate accounts from Zustand store format to database
     */
    migrateAccounts(accounts) {
        console.log(`🔄 Migrating ${accounts.length} accounts...`);
        for (const account of accounts) {
            const dbAccount = {
                id: account.id,
                name: account.name,
                phone: account.phone,
                imei: account.imei,
                cookie: account.cookie,
                user_agent: account.userAgent,
                status: account.status,
                last_login: account.lastLogin ? new Date(account.lastLogin).toISOString() : null
            };
            try {
                this.db.createAccount(dbAccount);
                console.log(`✅ Migrated account: ${account.name}`);
            }
            catch (error) {
                console.error(`❌ Failed to migrate account ${account.name}:`, error);
            }
        }
    }
    /**
     * Migrate friends from Zustand store format to database
     * NOTE: This requires accountId to be specified or inferred
     */
    migrateFriends(friends, accountId) {
        console.log(`🔄 Migrating ${friends.length} friends for account ${accountId}...`);
        for (const friend of friends) {
            const dbFriend = {
                id: friend.id,
                account_id: accountId,
                name: friend.name,
                display_name: friend.displayName,
                phone: friend.phone || null,
                avatar: friend.avatar || null,
                status: friend.status,
                last_interaction: friend.lastInteraction ? new Date(friend.lastInteraction).toISOString() : null
            };
            try {
                this.db.upsertFriend(dbFriend);
                // Migrate tags
                if (friend.tags && friend.tags.length > 0) {
                    for (const tag of friend.tags) {
                        this.db.addFriendTag(friend.id, accountId, tag);
                    }
                }
                console.log(`✅ Migrated friend: ${friend.name}`);
            }
            catch (error) {
                console.error(`❌ Failed to migrate friend ${friend.name}:`, error);
            }
        }
    }
    /**
     * Migrate groups from Zustand store format to database
     */
    migrateGroups(groups, accountId) {
        console.log(`🔄 Migrating ${groups.length} groups for account ${accountId}...`);
        for (const group of groups) {
            const dbGroup = {
                id: group.id,
                account_id: accountId,
                name: group.name,
                description: group.description || null,
                avatar: group.avatar || null,
                member_count: group.memberCount,
                is_admin: group.isAdmin ? 1 : 0,
                last_activity: group.lastActivity ? new Date(group.lastActivity).toISOString() : null,
                type: group.type
            };
            try {
                this.db.upsertGroup(dbGroup);
                console.log(`✅ Migrated group: ${group.name}`);
            }
            catch (error) {
                console.error(`❌ Failed to migrate group ${group.name}:`, error);
            }
        }
    }
    /**
     * Migrate message templates from Zustand store format to database
     */
    migrateTemplates(templates) {
        console.log(`🔄 Migrating ${templates.length} templates...`);
        for (const template of templates) {
            const dbTemplate = {
                id: template.id,
                name: template.name,
                content: template.content,
                type: template.type || 'personal',
                category: template.category || null,
                variables: JSON.stringify(template.variables || []),
                media: JSON.stringify(template.media || [])
            };
            try {
                this.db.createTemplate(dbTemplate);
                console.log(`✅ Migrated template: ${template.name}`);
            }
            catch (error) {
                console.error(`❌ Failed to migrate template ${template.name}:`, error);
            }
        }
    }
    /**
     * Migrate share content from Zustand store format to database
     */
    migrateShareContent(content) {
        console.log(`🔄 Migrating ${content.length} share content items...`);
        for (const item of content) {
            const dbContent = {
                id: item.id,
                title: item.title,
                content: item.content,
                category_id: item.categoryId || null,
                media: JSON.stringify(item.media || [])
            };
            try {
                this.db.createShareContent(dbContent);
                console.log(`✅ Migrated share content: ${item.title}`);
            }
            catch (error) {
                console.error(`❌ Failed to migrate share content ${item.title}:`, error);
            }
        }
    }
    /**
     * Migrate share categories from Zustand store format to database
     */
    migrateShareCategories(categories) {
        console.log(`🔄 Migrating ${categories.length} share categories...`);
        for (const category of categories) {
            const dbCategory = {
                id: category.id,
                name: category.name,
                description: category.description || null,
                color: category.color || null
            };
            try {
                this.db.createShareCategory(dbCategory);
                console.log(`✅ Migrated category: ${category.name}`);
            }
            catch (error) {
                console.error(`❌ Failed to migrate category ${category.name}:`, error);
            }
        }
    }
    /**
     * Full migration from JSON files
     * This should be called once when transitioning from JSON to SQLite
     */
    async migrateFromJSON(jsonData) {
        console.log('🚀 Starting full migration from JSON to SQLite...');
        this.db.transaction(() => {
            // Migrate accounts first
            if (jsonData.accounts && jsonData.accounts.length > 0) {
                this.migrateAccounts(jsonData.accounts);
                // For friends and groups, we need to associate them with an account
                // If there's only one account, use it. Otherwise, use the first one or require manual mapping
                const defaultAccountId = jsonData.accounts[0]?.id;
                if (defaultAccountId) {
                    if (jsonData.friends && jsonData.friends.length > 0) {
                        this.migrateFriends(jsonData.friends, defaultAccountId);
                    }
                    if (jsonData.groups && jsonData.groups.length > 0) {
                        this.migrateGroups(jsonData.groups, defaultAccountId);
                    }
                }
            }
            // Migrate templates (not account-specific)
            if (jsonData.templates && jsonData.templates.length > 0) {
                this.migrateTemplates(jsonData.templates);
            }
            // Migrate share content and categories
            if (jsonData.shareContent && jsonData.shareContent.length > 0) {
                this.migrateShareContent(jsonData.shareContent);
            }
            if (jsonData.shareCategories && jsonData.shareCategories.length > 0) {
                this.migrateShareCategories(jsonData.shareCategories);
            }
        });
        console.log('✅ Migration completed successfully!');
    }
    /**
     * Check if migration is needed (database is empty)
     */
    needsMigration() {
        const accounts = this.db.getAllAccounts();
        return accounts.length === 0;
    }
}
exports.MigrationService = MigrationService;
//# sourceMappingURL=migration.js.map