# ZALO TOOL Updater

## Cách hoạt động

1. `update.exe` kiểm tra version từ API: `https://tool.socialautopro.com/api/check-update`
2. So sánh với version hiện tại
3. Nếu có bản mới → tải về và cài đặt

## API Response Format

Server cần trả về JSON với format:

```json
{
  "version": "1.1.0",
  "downloadUrl": "https://tool.socialautopro.com/downloads/ZALO_TOOL_Setup_1.1.0.exe",
  "changelog": "- Thêm tính năng ABC\n- Sửa lỗi XYZ\n- Cải thiện hiệu suất",
  "forceUpdate": false,
  "minVersion": "1.0.0"
}
```

### Các trường:
- `version`: Version mới nhất (bắt buộc)
- `downloadUrl`: Link tải file installer (bắt buộc)
- `changelog`: Ghi chú thay đổi (tùy chọn)
- `forceUpdate`: Bắt buộc update (tùy chọn)
- `minVersion`: Version tối thiểu phải update (tùy chọn)

## Cách build update.exe

```bash
cd updater
npm install -g pkg
pkg . --output ../release/update.exe --targets node18-win-x64
```

## Cách sử dụng

1. Copy `update.exe` vào cùng thư mục với app
2. Khi có bản mới, người dùng chỉ cần double-click `update.exe`
3. Updater sẽ tự động kiểm tra, tải và cài đặt bản mới

## Cấu hình

Sửa file `updater.js` để thay đổi:
- `CONFIG.updateUrl`: URL API kiểm tra update
- `CONFIG.appName`: Tên ứng dụng
- `CONFIG.currentVersion`: Version mặc định
