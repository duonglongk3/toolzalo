# Hướng dẫn Migration sang SQLite3 Database

## Tổng quan

Dự án đã được nâng cấp từ lưu trữ JSON sang SQLite3 database để hỗ trợ quản lý nhiều tài khoản Zalo một cách hiệu quả, tránh lẫn lộn dữ liệu giữa các tài khoản.

## Những thay đổi chính

### 1. Database Layer (✅ Hoàn thành)

- **Schema SQLite**: Tạo các bảng với foreign key relationships
  - `accounts`: Lưu thông tin tài khoản Zalo
  - `friends`: Lưu danh sách bạn bè (liên kết với `account_id`)
  - `friend_tags`: Lưu tags của bạn bè (many-to-many)
  - `groups`: Lưu danh sách nhóm (liên kết với `account_id`)
  - `message_templates`: Lưu mẫu tin nhắn
  - `message_logs`: Lưu lịch sử gửi tin
  - `share_content` & `share_categories`: Lưu nội dung chia sẻ

- **DatabaseService**: Class quản lý CRUD operations
  - Hỗ trợ transactions
  - Prepared statements để tránh SQL injection
  - Upsert operations cho friends và groups
  - Indexes để tối ưu performance

- **MigrationService**: Tự động migrate dữ liệu từ JSON sang SQLite
  - Đọc các file JSON cũ (zalo-accounts.json, zalo-friends.json, etc.)
  - Chuyển đổi sang format database
  - Backup JSON files vào thư mục `data/json-backup`

### 2. Electron Main Process (✅ Hoàn thành)

- Khởi tạo database khi app start
- Tự động migration nếu database trống
- IPC handlers cho tất cả database operations:
  - `db-get-accounts`, `db-create-account`, `db-update-account`, `db-delete-account`
  - `db-get-friends`, `db-upsert-friend`, `db-delete-friend`
  - `db-add-friend-tag`, `db-remove-friend-tag`, `db-get-all-tags`
  - `db-get-groups`, `db-upsert-group`, `db-delete-group`
  - `db-get-templates`, `db-create-template`, etc.

### 3. Zustand Stores (✅ Hoàn thành)

Tạo mới `src/store/database-store.ts` với:

- **useAccountStore**: Quản lý accounts qua database
  - `loadAccounts()`: Load từ database
  - `addAccount()`, `updateAccount()`, `deleteAccount()`
  - `setActiveAccount()`: Chọn tài khoản đang hoạt động

- **useFriendsStore**: Quản lý friends theo account
  - `loadFriends(accountId)`: Load friends của account cụ thể
  - `addFriend(accountId, friend)`: Thêm friend vào account
  - `addFriendTag()`, `removeFriendTag()`: Quản lý tags

- **useGroupsStore**: Quản lý groups theo account
  - `loadGroups(accountId)`: Load groups của account cụ thể
  - `addGroup(accountId, group)`: Thêm group vào account

- **useTemplatesStore**: Quản lý message templates (không phụ thuộc account)

### 4. Preload API (✅ Hoàn thành)

Expose database API qua `window.electronAPI.db`:
```typescript
electronAPI.db.getAccounts()
electronAPI.db.getFriends(accountId)
electronAPI.db.getGroups(accountId)
// ... và nhiều methods khác
```

## Cách sử dụng

### Migration tự động

Khi chạy app lần đầu sau khi update:

1. App sẽ kiểm tra database có trống không
2. Nếu trống, tự động đọc các file JSON cũ
3. Migrate dữ liệu sang SQLite
4. Backup JSON files vào `data/json-backup/`

### Sử dụng trong Components

#### Ví dụ: Load accounts

```typescript
import { useAccountStore } from '@/store/database-store'

function AccountsPage() {
  const { accounts, loading, loadAccounts, setActiveAccount } = useAccountStore()
  
  useEffect(() => {
    loadAccounts()
  }, [])
  
  return (
    <div>
      {loading ? 'Loading...' : accounts.map(acc => (
        <div key={acc.id} onClick={() => setActiveAccount(acc)}>
          {acc.name}
        </div>
      ))}
    </div>
  )
}
```

#### Ví dụ: Load friends theo account

```typescript
import { useFriendsStore, useAccountStore } from '@/store/database-store'

function FriendsPage() {
  const { activeAccount } = useAccountStore()
  const { friends, loading, loadFriends } = useFriendsStore()
  
  useEffect(() => {
    if (activeAccount) {
      loadFriends(activeAccount.id)
    }
  }, [activeAccount])
  
  return (
    <div>
      <h2>Friends of {activeAccount?.name}</h2>
      {friends.map(friend => (
        <div key={friend.id}>{friend.name}</div>
      ))}
    </div>
  )
}
```

## Những việc còn lại

### 1. Cập nhật UI Components (🔄 Đang làm)

Cần cập nhật các pages sau để sử dụng database stores:

- **src/pages/Accounts.tsx**
  - Import `useAccountStore` từ `database-store`
  - Gọi `loadAccounts()` khi mount
  - Sử dụng async methods (addAccount, updateAccount, deleteAccount)

- **src/pages/Friends.tsx**
  - Import `useFriendsStore` từ `database-store`
  - Gọi `loadFriends(accountId)` khi activeAccount thay đổi
  - Hiển thị thông báo nếu chưa chọn account
  - Sử dụng async methods với accountId

- **src/pages/Groups.tsx**
  - Tương tự Friends.tsx
  - Load groups theo activeAccount

- **src/pages/Templates.tsx**
  - Import `useTemplatesStore` từ `database-store`
  - Gọi `loadTemplates()` khi mount

### 2. Cập nhật Zalo Service (⏳ Chưa làm)

- Lưu `accountId` khi login thành công
- Đảm bảo mọi operation (sync friends, groups) đều gắn với đúng account
- Hỗ trợ multi-account session management

### 3. UI/UX Enhancement (⏳ Chưa làm)

Cải thiện giao diện theo yêu cầu:
- Modern minimalist design
- Color scheme: white-gray-blue
- Professional status chips với màu sắc:
  - Paid (xanh): #ECFDF5 / #059669
  - Unpaid (xám): #F9FAFB / #6B7280
  - Overdue (đỏ): #FEF2F2 / #DC2626
- Shadows thay vì borders
- Spacing và rounded corners

### 4. Testing (⏳ Chưa làm)

- Test thêm nhiều accounts
- Test sync friends/groups cho từng account
- Test chuyển đổi giữa các accounts
- Verify data isolation
- Test migration từ JSON cũ

## Cấu trúc Database

```
data/
├── zalo-manager.db          # SQLite database chính
└── json-backup/             # Backup các file JSON cũ
    ├── zalo-accounts-*.json
    ├── zalo-friends-*.json
    └── zalo-groups-*.json
```

## Lưu ý quan trọng

1. **Data Isolation**: Mỗi account có friends và groups riêng biệt
2. **Foreign Keys**: Khi xóa account, tất cả friends và groups liên quan cũng bị xóa (CASCADE)
3. **Upsert**: Friends và Groups sử dụng upsert để tránh duplicate khi sync
4. **Tags**: Friend tags được lưu trong bảng riêng (many-to-many relationship)
5. **Transactions**: Migration sử dụng transaction để đảm bảo data integrity

## Troubleshooting

### Database bị lỗi

```bash
# Xóa database và để app tự tạo lại
rm data/zalo-manager.db
# App sẽ tự động migrate từ JSON backup
```

### Migration không hoạt động

Kiểm tra console logs để xem lỗi chi tiết. Migration sẽ log từng bước:
- `🔄 Migrating X accounts...`
- `✅ Migrated account: ...`
- `❌ Failed to migrate ...`

### Restore từ JSON backup

```bash
# Copy JSON backup về thư mục data
cp data/json-backup/zalo-accounts-*.json data/zalo-accounts.json
# Xóa database
rm data/zalo-manager.db
# Restart app để migration lại
```

## Performance

- **Indexes**: Đã tạo indexes cho các trường thường query (account_id, name, phone, tags)
- **WAL Mode**: SQLite sử dụng Write-Ahead Logging để tăng performance
- **Prepared Statements**: Tất cả queries đều sử dụng prepared statements
- **Transactions**: Batch operations sử dụng transactions

## Bảo mật

- **SQL Injection**: Sử dụng prepared statements
- **Foreign Keys**: Enforce data integrity
- **Validation**: Validate data trước khi insert/update

