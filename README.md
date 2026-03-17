# TeleLegal - Real-time Video Calling Platform

TeleLegal là một ứng dụng gọi video trực tuyến thời gian thực (WebRTC) với phong cách thiết kế hiện đại, hỗ trợ hệ thống bạn bè, chat trong phòng và lịch sử cuộc gọi.

## 🌟 Tính năng nổi bật: Thiết kế "Liquid Glass"
Điểm nhấn lớn nhất của dự án là giao diện người dùng theo phong cách **Liquid Glass (Kính lỏng xuyên thấu)**:
- **Giao diện hiện đại:** Toàn bộ thanh điều hướng, cửa sổ chat và thanh công cụ cuộc gọi được thiết kế bằng hiệu ứng Glassmorphism (kính mờ).
- **Trải nghiệm mượt mà:** Hiệu ứng "Bong bóng ánh sáng" óng ánh khi di chuyển giữa các tab, tạo cảm giác cao cấp và tinh tế.
- **Tối ưu hiển thị:** Tự động điều chỉnh giao diện cho Mobile (ẩn văn bản, giữ lại biểu tượng) để mang lại không gian video lớn nhất.

## 🛠 Công nghệ sử dụng
- **Frontend:** React.js, Redux (State Management), WebRTC, Nginx (trong Docker).
- **Backend:** Node.js, Socket.io (Signaling), SQLite (Database), JWT (Auth).
- **Infrastructure:** Self-hosted STUN/TURN Server (vượt tường lửa 4G/Wifi công ty).

---

## 🐳 Hướng dẫn triển khai bằng Docker

Dự án bao gồm 3 thành phần độc lập. Dưới đây là cách đóng gói và quản lý cho từng phần.

### 1. Quy trình chung (Dành cho tất cả thư mục)

#### **Đóng gói (Build Image):**
Di chuyển vào từng thư mục (`front-end`, `back-end`, hoặc `turn-server`) và chạy:
```bash
docker build -t [tên-image] .
```

#### **Trích xuất Image để di chuyển máy khác (Save):**
```bash
docker save -o [tên-file].tar [tên-image]
```

#### **Nạp Image ở máy mới (Load):**
```bash
docker load -i [tên-file].tar
```

---

### 2. Chi tiết cấu hình chạy Container

#### **Back-end (API & Socket)**
- Cổng mặc định: `9000` (HTTPS)
```bash
docker run -d -p 9000:9000 --name tele-api telelegal-backend
```

#### **Front-end (Giao diện người dùng)**
- Cổng mặc định: `5069` (HTTPS)
```bash
docker run -d -p 5069:5069 --name tele-ui telelegal-frontend
```

#### **TURN Server (Hạ tầng mạng)**
- Chạy ở chế độ `--net=host` để tối ưu WebRTC.
```bash
docker run -d --name tele-turn --net=host --restart always telelegal-turn-server
```

---

### 3. Dọn dẹp hệ thống (Cleanup)

Nếu bạn muốn xóa sạch các bản cũ để cài đặt lại từ đầu:

**Xóa container đang chạy:**
```bash
# Xóa một cái cụ thể
docker stop [tên-container] && docker rm [tên-container]

# Xóa TẤT CẢ container đang có trong máy
docker rm -f $(docker ps -aq)
```

**Xóa Image (để giải phóng dung lượng):**
```bash
# Xóa một image cụ thể
docker rmi [tên-image]

# Xóa sạch các image rác (dangling images)
docker image prune -f
```

## 📝 Lưu ý quan trọng
1. **HTTPS:** Dự án yêu cầu chạy trên giao thức HTTPS để trình duyệt cho phép sử dụng Camera/Mic.
2. **Cấu hình IP:** Trước khi build Frontend, hãy cập nhật địa chỉ IP của bạn trong file `.env` và `stunServers.js`.
3. **Firewall:** Đảm bảo máy chủ đã mở cổng `3478` (TCP/UDP) và dải cổng `49152-65535` (UDP) để cuộc gọi 4G hoạt động.

---
*Dự án được xây dựng cho mục đích học tập và nghiên cứu về WebRTC.*
