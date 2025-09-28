# Zalo Manager - Professional Desktop Tool

Một ứng dụng desktop chuyên nghiệp để quản lý tài khoản Zalo, được xây dựng với Electron, React, và TypeScript.

## ✨ Tính năng chính

### 🔐 Quản lý tài khoản Zalo
- Thêm và quản lý nhiều tài khoản Zalo
- Đăng nhập tự động với IMEI, Cookie, User-Agent
- Theo dõi trạng thái kết nối real-time
- Chuyển đổi giữa các tài khoản dễ dàng

### 👥 Quản lý bạn bè
- Xem danh sách bạn bè với phân trang và tìm kiếm
- Thêm bạn hàng loạt bằng số điện thoại
- Phân loại bạn bè bằng hệ thống tag
- Lọc và sắp xếp danh sách bạn bè

### 💬 Nhắn tin cá nhân
- Gửi tin nhắn cá nhân theo số điện thoại
- Quản lý template tin nhắn có thể tái sử dụng
- Gửi tin nhắn hàng loạt với delay tùy chỉnh
- Theo dõi trạng thái gửi tin nhắn

### 👥 Quản lý nhóm
- Tham gia nhóm bằng link mời
- Xem danh sách nhóm đã tham gia
- Rời nhóm với xác nhận
- Thông tin chi tiết về nhóm

### 📢 Nhắn tin nhóm
- Gửi tin nhắn đến nhiều nhóm cùng lúc
- Lên lịch gửi tin nhắn tự động
- Template tin nhắn chuyên biệt cho nhóm
- Theo dõi engagement và analytics

### 🔍 Quét thành viên nhóm
- Lấy danh sách thành viên nhóm chi tiết
- Xuất dữ liệu ra file CSV/Excel
- Thông tin đầy đủ về thành viên
- Lọc và tìm kiếm trong danh sách

### 🔗 Share & Phân loại thẻ
- Chia sẻ nội dung với hệ thống phân loại
- Quản lý categories và tags
- Bulk sharing với analytics
- Template nội dung có thể tùy chỉnh

## 🛠️ Công nghệ sử dụng

- **Frontend**: React 18 + TypeScript
- **Desktop**: Electron 27
- **State Management**: Zustand với Immer
- **UI Framework**: Tailwind CSS + Custom Components
- **API Integration**: zca-js library
- **Data Storage**: Electron Store (JSON-based)
- **Build Tool**: Vite
- **Package Manager**: npm

## 📋 Yêu cầu hệ thống

- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **OS**: Windows 10+, macOS 10.15+, Ubuntu 18.04+
- **RAM**: Tối thiểu 4GB
- **Disk**: 500MB trống

## 🚀 Cài đặt và chạy

### 1. Clone repository
```bash
git clone <repository-url>
cd zalotool
```

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Chạy ở chế độ development
```bash
npm run dev
```

### 4. Build ứng dụng
```bash
npm run build
npm run build:all
```

## 📁 Cấu trúc dự án

```
zalotool/
├── electron/           # Electron main process
│   ├── main.ts        # Main process entry
│   └── preload.ts     # Preload script
├── src/               # React application
│   ├── components/    # UI components
│   ├── pages/         # Application pages
│   ├── services/      # API services
│   ├── store/         # State management
│   ├── types/         # TypeScript definitions
│   └── utils/         # Utility functions
├── zca-js/            # Zalo API library
└── dist/              # Build output
```

## 🔧 Cấu hình

### Thêm tài khoản Zalo
1. Mở trình duyệt và đăng nhập Zalo Web
2. Sử dụng Developer Tools để lấy:
   - **IMEI**: Device identifier
   - **Cookie**: Session cookies
   - **User-Agent**: Browser user agent
3. Thêm thông tin vào ứng dụng

### Cài đặt ứng dụng
- **Theme**: Light/Dark/System
- **Language**: Tiếng Việt/English
- **Message Delay**: Thời gian delay giữa các tin nhắn
- **Auto Backup**: Tự động sao lưu dữ liệu

## 📊 Tính năng nâng cao

### Analytics & Reporting
- Thống kê tin nhắn đã gửi
- Tỷ lệ thành công/thất bại
- Báo cáo hoạt động theo thời gian
- Export báo cáo ra PDF/Excel

### Automation
- Lên lịch gửi tin nhắn
- Auto-retry khi thất bại
- Bulk operations với progress tracking
- Background tasks management

### Security & Privacy
- Mã hóa dữ liệu nhạy cảm
- Secure credential storage
- Session management
- Activity logging

## 🔒 Bảo mật

- Tất cả dữ liệu được lưu trữ local
- Mã hóa thông tin đăng nhập
- Không gửi dữ liệu lên server bên ngoài
- Tuân thủ các best practices bảo mật

## ⚠️ Lưu ý quan trọng

- Đây là công cụ không chính thức cho Zalo
- Sử dụng có thể dẫn đến việc tài khoản bị khóa
- Chúng tôi không chịu trách nhiệm về các vấn đề phát sinh
- Sử dụng với trách nhiệm và tuân thủ ToS của Zalo

## 🤝 Đóng góp

Chúng tôi hoan nghênh mọi đóng góp! Vui lòng:

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Tạo Pull Request

## 📄 License

MIT License - xem file [LICENSE](LICENSE) để biết thêm chi tiết.

## 🆘 Hỗ trợ

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Email**: support@zalomanager.com

## 🎯 Roadmap

- [ ] Multi-language support
- [ ] Plugin system
- [ ] Advanced scheduling
- [ ] AI-powered message suggestions
- [ ] Integration with other platforms
- [ ] Mobile companion app

---

**Zalo Manager** - Công cụ quản lý Zalo chuyên nghiệp cho doanh nghiệp và cá nhân.
