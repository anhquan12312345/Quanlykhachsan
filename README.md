# 🏨 Hệ Thống Quản Lý Khách Sạn Nhóm 11

> Ứng dụng web quản lý khách sạn toàn diện với đặt phòng trực tuyến, quản lý dịch vụ và thống kê doanh thu.

---

## 📋 Mục Lục

- [🎯 Tính Năng Chính](#tính-năng-chính)
- [🔧 Yêu Cầu Hệ Thống](#yêu-cầu-hệ-thống)
- [📦 Cài Đặt](#cài-đặt)
- [▶️ Chạy Ứng Dụng](#chạy-ứng-dụng)
- [👥 Tài Khoản Mẫu](#tài-khoản-mẫu)
- [📂 Cấu Trúc Dự Án](#cấu-trúc-dự-án)
- [🎨 Giao Diện Chính](#giao-diện-chính)
- [📊 Các API Chính](#các-api-chính)
- [🛏️ Dịch Vụ & Giá Cả](#dịch-vụ--giá-cả)
- [🔐 Tính Năng Bảo Mật](#tính-năng-bảo-mật)
- [⚙️ Cấu Hình Database](#cấu-hình-database)
- [🚨 Xử Lý Lỗi](#xử-lý-lỗi)
- [🔄 Quy Trình Hoạt Động](#quy-trình-hoạt-động)
- [🛠️ Công Nghệ Sử Dụng](#công-nghệ-sử-dụng)
- [📞 Hỗ Trợ](#hỗ-trợ)

---

## 🎯 Tính Năng Chính

### ✨ Dành Cho Khách Hàng
- ✅ **Đăng Ký / Đăng Nhập** - Tài khoản an toàn với 2 mật khẩu
- ✅ **Đặt Phòng Online** - Chọn phòng, ngày, tự động tìm phòng trống
- ✅ **Lịch Sử Đặt Phòng** - Xem tất cả các đơn đặt trước đó
- ✅ **Đặt Dịch Vụ** - Gym, Spa, Buffet, Skybar, Infinity Pool
- ✅ **Lịch Sử Dịch Vụ** - Theo dõi các dịch vụ đã sử dụng

### 👨‍💼 Dành Cho Quản Lý
- ✅ **Dashboard** - Thống kê doanh thu, phòng trống, đơn dịch vụ mới
- ✅ **Quản Lý Phòng** - Check-in, Check-out, Thanh toán, Dọn phòng
- ✅ **Quản Lý Nhân Viên** - Thêm, sửa xóa nhân viên, quản lý tài khoản
- ✅ **Quản Lý Dịch Vụ** - Xem danh sách, cập nhật trạng thái dịch vụ
- ✅ **Khách Hàng** - Xem lịch sử khách, chi tiêu, CCCD
- ✅ **Biểu Đồ Doanh Thu** - Thống kê theo tuần, theo tháng

---

## 🔧 Yêu Cầu Hệ Thống

### 💻 Máy Tính
- **Hệ điều hành**: Windows 10+, macOS, Linux
- **RAM**: 4GB trở lên
- **Ổ cứng**: 500MB dung lượng trống

### 📌 Phần Mềm Cần Cài

| Phần Mềm | Phiên Bản | Tải Về |
|---------|----------|--------|
| **Node.js** | 18.0+ | [nodejs.org](https://nodejs.org) |
| **SQL Server** | 2019+ | [microsoft.com/sql-server](https://www.microsoft.com/sql-server) |
| **Git** (tùy chọn) | Mới nhất | [git-scm.com](https://git-scm.com) |

### ✔️ Kiểm Tra Cài Đặt
```bash
node --version    # Phải là v18.0+
npm --version     # Phải là v8.0+
```

---

## 📦 Cài Đặt

### 1️⃣ Tải / Clone Dự Án

**Cách A: Clone từ Git**
```bash
git clone https://github.com/anhquan12312345/Quanlykhachsan.git
cd Quanlykhachsan
```

**Cách B: Tải File ZIP**
- Tải file ZIP từ GitHub
- Giải nén vào thư mục tùy ý
- Mở Command Prompt / Terminal tại thư mục đó

### 2️⃣ Cài Đặt Dependencies

```bash
npm install
```

**Output chờ đợi:**
```
added 45 packages in 2m
```

---

## ⚙️ Cấu Hình Database

### 📍 Bước 1: Tạo Database SQL Server

**Mở SQL Server Management Studio (SSMS):**

1. Kết nối đến SQL Server của bạn
2. Click chuột phải vào **Databases** → **New Database**
3. Đặt tên: `KhachsanNhom11`
4. Click **OK**

### 📍 Bước 2: Chạy Script SQL

Nếu bạn có file `.sql`, hãy:

1. Mở SSMS → File → Open → Query File
2. Chọn file SQL
3. Nhấn **Execute** (F5)

**Hoặc** nhập các lệnh SQL sau:

```sql
-- Tạo bảng NguoiDung (Khách hàng)
CREATE TABLE NguoiDung (
    ID INT PRIMARY KEY IDENTITY(1,1),
    HoTen NVARCHAR(100) NOT NULL,
    Email VARCHAR(100),
    SoDienThoai VARCHAR(20),
    MatKhau VARCHAR(100),
    MatKhauCap2 VARCHAR(100)
);

-- Tạo bảng NhanVien (Nhân viên)
CREATE TABLE NhanVien (
    MaNV INT PRIMARY KEY IDENTITY(1,1),
    HoTen NVARCHAR(100),
    TenDangNhap VARCHAR(50) UNIQUE,
    MatKhau VARCHAR(100),
    ChucVu NVARCHAR(50),
    SoDienThoai VARCHAR(20),
    Email VARCHAR(100),
    QueQuan NVARCHAR(100)
);

-- Tạo bảng RoomInventory (Phòng)
CREATE TABLE RoomInventory (
    RoomCode VARCHAR(20) PRIMARY KEY,
    RoomName NVARCHAR(100),
    RoomType NVARCHAR(50),
    Price DECIMAL(18,0),
    TrangThai NVARCHAR(50)
);

-- Tạo bảng DatPhong (Đặt phòng)
CREATE TABLE DatPhong (
    ID INT PRIMARY KEY IDENTITY(1,1),
    UserID INT,
    RoomID VARCHAR(20),
    RoomName NVARCHAR(100),
    RoomCode VARCHAR(20),
    CheckIn DATETIME,
    CheckOut DATETIME,
    Guests INT,
    TotalPrice NVARCHAR(50),
    Email VARCHAR(100),
    CCCD VARCHAR(20),
    DOB INT,
    Hometown NVARCHAR(100),
    NgayDat DATETIME DEFAULT GETDATE(),
    NgayTraThucTe DATETIME,
    [Tráº¡ng ThÃ¡i] NVARCHAR(50) DEFAULT 'ÄÃ£ Ä'áº·t',
    FOREIGN KEY (UserID) REFERENCES NguoiDung(ID)
);

-- Tạo bảng DichVu (Dịch vụ)
CREATE TABLE DichVu (
    ID INT PRIMARY KEY IDENTITY(1,1),
    UserID INT,
    CustomerName NVARCHAR(100),
    CustomerPhone VARCHAR(20),
    ServiceName NVARCHAR(100),
    ServiceID VARCHAR(20),
    Quantity INT,
    UnitPrice INT,
    TotalPrice INT,
    ServiceDate DATE,
    Note NVARCHAR(500),
    OrderDate DATETIME DEFAULT GETDATE(),
    Status NVARCHAR(50) DEFAULT 'Chá» xÃ¡c nháº­n',
    FOREIGN KEY (UserID) REFERENCES NguoiDung(ID)
);

-- Thêm dữ liệu khách hàng mẫu
INSERT INTO NguoiDung (HoTen, Email, SoDienThoai, MatKhau, MatKhauCap2)
VALUES (N'Nguyễn Văn A', 'nguyenvana@email.com', '0912345678', '123123', '111111');

-- Thêm nhân viên Admin
INSERT INTO NhanVien (HoTen, TenDangNhap, MatKhau, ChucVu, SoDienThoai, Email, QueQuan)
VALUES (N'Admin', 'admin', '123123', 'Admin', '0988888888', 'admin@khachsan.com', N'Huế');

-- Thêm phòng mẫu
INSERT INTO RoomInventory (RoomCode, RoomName, RoomType, Price, TrangThai)
VALUES 
('P101', N'Phòng Tổng Thư Ký 101', N'Tổng Thư Ký', 15000000, NULL),
('P102', N'Phòng Suite Gia Đình 102', N'Suite Gia Đình', 5000000, NULL),
('P201', N'Phòng Deluxe 201', N'Deluxe', 3000000, NULL),
('P202', N'Phòng Cặp Đôi 202', N'Cặp Đôi', 2000000, NULL),
('P301', N'Phòng Đơn Tiêu Chuẩn 301', N'Đơn Tiêu Chuẩn', 1200000, NULL);
```

### 📍 Bước 3: Sửa Cấu Hình Trong server.js

Mở file `server.js` bằng trình soạn thảo (VS Code, Notepad++...):

```javascript
// Tìm dòng này (khoảng dòng 17-25):
const dbConfig = {
    server: 'localhost',         // ← Sửa IP/hostname SQL Server của bạn
    port: 53439,                 // ← Sửa cổng SQL Server
    user: 'Nhom11web',           // ← Sửa username SQL Server
    password: '123123',          // ← Sửa password SQL Server
    database: 'KhachsanNhom11',  // ← Tên database
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    }
};
```

**⚠️ Ví dụ cấu hình khác:**

Nếu bạn dùng **Azure SQL**:
```javascript
const dbConfig = {
    server: 'myserver.database.windows.net',
    user: 'admin@myserver',
    password: 'MySecurePassword123!',
    database: 'KhachsanNhom11',
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};
```

Nếu bạn dùng **SQL Server trên máy tính cá nhân**:
```javascript
const dbConfig = {
    server: 'LAPTOP-ABC\\SQLEXPRESS',  // Tên instance
    user: 'sa',                         // SQL Server login
    password: 'YourPassword123',
    database: 'KhachsanNhom11'
};
```

---

## ▶️ Chạy Ứng Dụng

### 📍 Bước 1: Mở Terminal/Command Prompt

- **Windows**: Nhấn `Win + R`, gõ `cmd`
- **macOS/Linux**: Mở Terminal

### 📍 Bước 2: Điều Hướng Đến Thư Mục Dự Án

```bash
cd đường/dẫn/đến/Quanlykhachsan
```

Ví dụ:
```bash
cd C:\Users\Admin\MyWebsite\QLKS
```

### 📍 Bước 3: Chạy Server

```bash
node server.js
```

**Output chờ đợi:**
```
✅ Đã kết nối SQL!
🚀 Server đã sẵn sàng!
👉 Bây giờ hãy sang trình duyệt nhấn truy cập: http://localhost:3000/Trangchu.html
```

### 📍 Bước 4: Mở Trình Duyệt

Nhập vào thanh địa chỉ:
```
http://localhost:3000/Trangchu.html
```

**✅ Xong! Ứng dụng đã chạy thành công.**

---

## 👥 Tài Khoản Mẫu

### 🟢 Tài Khoản Khách Hàng

```
Số Điện Thoại: 0912345678
Mật Khẩu: 123123
Mật Khẩu Cấp 2 (quên MK): 111111
Tên: Nguyễn Văn A
```

**Cách Đăng Nhập:**
1. Vào trang chủ
2. Nhấn nút **Đăng Nhập**
3. Nhập SĐT + Mật khẩu

### 🔴 Tài Khoản Quản Lý/Nhân Viên

```
Tài Khoản: admin
Mật Khẩu: 123123
Chức Vụ: Admin
```

**Cách Đăng Nhập:**
1. Vào trang chủ
2. Nhấn nút **Đăng Nhập Quản Lý** (nút đỏ)
3. Nhập username + password
4. Sẽ vào trang dashboard

---

## 📂 Cấu Trúc Dự Án

```
Quanlykhachsan/
│
├── 📄 server.js                    # Backend API chính
├── 📄 package.json                 # Dependencies
├── 📄 package-lock.json
│
├── 📄 Trangchu.html               # Trang chủ
├── 📄 Trangquanly.html            # Dashboard quản lý
├── 📄 trang_dat_phong.html        # Trang đặt phòng
├── 📄 dat_dich_vu.html            # Đặt dịch vụ
├── 📄 lich_su_dich_vu.html        # Lịch sử dịch vụ
├── 📄 TTdatphong.html             # Lịch sử đặt phòng
│
├── 📁 card/                        # Trang chi tiết dịch vụ
│   ├── Cardspa.html
│   ├── Cardgym.html
│   ├── Cardbuffet.html
│   ├── CardSkybar.html
│   ├── Cardinfinitypool.html
│   └── Cardlobbywedding.html
│
├── 📁 images/                      # Hình ảnh
│   ├── logo.png
│   ├── background.jpg
│   └── ...
│
└── 📄 README.md                    # File hướng dẫn này
```

---

## 🎨 Giao Diện Chính

### 🏠 Trang Chủ (Trangchu.html)
- Giới thiệu khách sạn
- Nút Đăng Nhập / Đăng Ký
- Danh sách 6 dịch vụ chính với hình ảnh
- Mô tả chi tiết từng dịch vụ

### 🛎️ Trang Đặt Phòng (trang_dat_phong.html)
- Chọn phòng từ danh sách 5 loại phòng
- Chọn ngày check-in/out
- Nhập thông tin (CCCD, năm sinh, địa chỉ)
- Xác nhận thanh toán
- Hiển thị mã phòng được phân

### 🛏️ Lịch Sử Phòng (TTdatphong.html)
- Danh sách các đơn đặt phòng trước đó
- Hiển thị ngày, phòng, giá tiền
- Trạng thái: Đã đặt, Đang ở, Đã thanh toán

### 🧘 Dịch Vụ Bổ Sung (dat_dich_vu.html)
- Danh sách 7 dịch vụ
- Chọn số lượng, ngày sử dụng
- Ghi chú yêu cầu đặc biệt
- Xác nhận và lưu đơn

### 📊 Dashboard Quản Lý (Trangquanly.html)
- Thống kê: Doanh thu, Phòng trống, Khách đang ở
- Tab quản lý: Phòng, Thanh toán, Nhân viên, Dịch vụ, Khách hàng
- Biểu đồ doanh thu theo tuần
- Bảng dữ liệu chi tiết

---

## 📊 Các API Chính

### 🔑 Xác Thực

| API | Method | Tác Vụ |
|-----|--------|--------|
| `/login` | POST | Đăng nhập khách hàng |
| `/login-admin` | POST | Đăng nhập quản lý |
| `/dang-ky` | POST | Đăng ký tài khoản |
| `/quen-mat-khau` | POST | Lấy lại mật khẩu |

**Ví dụ:**
```bash
POST http://localhost:3000/login
Content-Type: application/json

{
  "sdt": "0912345678",
  "password": "123123"
}
```

### 🏨 Phòng

| API | Method | Tác Vụ |
|-----|--------|--------|
| `/api/phong` | GET | Danh sách tất cả phòng |
| `/api/dat-phong/chi-tiet/:roomCode` | GET | Chi tiết phòng |

### 🛏️ Đặt Phòng

| API | Method | Tác Vụ |
|-----|--------|--------|
| `/dat-phong` | POST | Đặt phòng mới |
| `/my-bookings/:userId` | GET | Lịch sử đặt phòng |
| `/api/check-in/:roomCode` | PUT | Check-in phòng |
| `/api/thanh-toan/:roomCode` | PUT | Thanh toán phòng |
| `/api/don-phong/:roomCode` | PUT | Hoàn tất dọn phòng |

### 🎁 Dịch Vụ

| API | Method | Tác Vụ |
|-----|--------|--------|
| `/api/dat-dich-vu` | POST | Đặt dịch vụ |
| `/api/lich-su-dich-vu/:userId` | GET | Lịch sử dịch vụ |
| `/api/quan-ly-dich-vu` | GET | Danh sách dịch vụ (Admin) |
| `/api/update-service-status` | PUT | Cập nhật trạng thái |

### 👨‍💼 Nhân Viên

| API | Method | Tác Vụ |
|-----|--------|--------|
| `/api/nhan-vien` | GET | Danh sách nhân viên |
| `/api/them-nhan-vien` | POST | Thêm nhân viên |
| `/api/nhan-vien/:id` | PUT | Cập nhật nhân viên |
| `/api/nhan-vien/:id` | DELETE | Xóa nhân viên |

### 📊 Thống Kê

| API | Method | Tác Vụ |
|-----|--------|--------|
| `/api/thong-ke-dashboard` | GET | Thống kê dashboard |
| `/api/doanh-thu-thang` | GET | Doanh thu tháng |
| `/api/bieu-do-tuan` | GET | Dữ liệu biểu đồ tuần |
| `/api/khach-hang` | GET | Danh sách khách hàng |

---

## 🛏️ Dịch Vụ & Giá Cả

### 🏨 Các Loại Phòng

| Loại Phòng | Giá/Đêm | Diện Tích | Mô Tả |
|-----------|---------|----------|-------|
| **Tổng Thư Ký** | 15,000,000 VND | 100 m² | Phòng VIP, view sông, quanh năm |
| **Suite Gia Đình** | 5,000,000 VND | 50 m² | Rộng, 2 phòng ngủ |
| **Deluxe** | 3,000,000 VND | 28 m² | Sang trọng, view sông |
| **Cặp Đôi** | 2,000,000 VND | 25 m² | Lãng mạn, voucher Skybar |
| **Đơn Tiêu Chuẩn** | 1,200,000 VND | 20 m² | Tiền lợi, giường đơn |

### 🎁 Dịch Vụ Bổ Sung

| Dịch Vụ | Giá | Thời Gian |
|---------|-----|-----------|
| 🏋️ **Gym** | 100,000 VND | 1 ngày |
| 🧖 **Spa Cơ Bản** | 400,000 VND | 90 phút |
| 🧖 **Spa Nâng Cao** | 700,000 VND | 120 phút |
| 🧖 **Spa Hoàng Gia** | 1,200,000 VND | 180 phút |
| 🍽️ **Buffet Sáng** | 250,000 VND | Bữa |
| 🍸 **Skybar** | 300,000 VND | Voucher |
| 🏊 **Infinity Pool** | Miễn Phí | Toàn Ngày |

---

## 🔐 Tính Năng Bảo Mật

### ✅ Các Biện Pháp Bảo Mật Hiện Tại
- 🔒 **Xác thực 2 lớp** - Mật khẩu cấp 2 để khôi phục tài khoản
- 🔐 **Lưu mật khẩu** - Lưu trực tiếp trong DB (nên hash trong sản phẩm thực)
- 🛡️ **CORS** - Kiểm soát truy cập từ các domain khác
- ✔️ **Validation** - Kiểm tra dữ liệu đầu vào

### ⚠️ Khuyến Nghị Bảo Mật

Để sản phẩm hoàn hảo hơn, nên thêm:
1. **Hash mật khẩu** với bcrypt
2. **JWT token** cho phiên đăng nhập
3. **Rate limiting** chống brute force
4. **HTTPS** khi triển khai thực tế
5. **SQL Injection prevention** (hiện tại đã an toàn)

---

## 🚨 Xử Lý Lỗi

### ❌ Lỗi: "Cannot connect to database"

**Nguyên Nhân:**
- SQL Server không chạy
- Cấu hình sai trong `server.js`
- Network bị chặn

**Giải Pháp:**
```bash
# 1. Kiểm tra SQL Server đang chạy
# Windows: Services → SQL Server (MSSQLSERVER) = Running
# macOS: brew services list | grep sqlserver
# Linux: sudo systemctl status mssql-server

# 2. Kiểm tra kết nối
sqlcmd -S localhost -U username -P password

# 3. Reset config trong server.js
# Đảm bảo server, port, user, password đúng
```

### ❌ Lỗi: "Port 3000 already in use"

**Giải Pháp:**
```bash
# Windows - Tìm process chiếm port 3000
netstat -ano | findstr :3000
# Kết quả: TCP  0.0.0.0:3000  LISTENING  12345
# Kill process:
taskkill /PID 12345 /F

# macOS/Linux
lsof -i :3000
kill -9 <PID>

# Hoặc sử dụng port khác
# Mở server.js, sửa dòng:
// const port = 3001; // Thay 3000 bằng 3001
```

### ❌ Lỗi: "npm ERR! 404 Not Found"

**Giải Pháp:**
```bash
# Xóa node_modules và cài lại
rm -rf node_modules package-lock.json
npm install

# Hoặc xóa cache npm
npm cache clean --force
npm install
```

### ❌ Lỗi: Không thấy các phòng khi đặt

**Nguyên Nhân:** Chưa thêm dữ liệu phòng vào database

**Giải Pháp:** 
Chạy lại đoạn SQL tạo phòng mẫu (xem mục Cấu Hình Database)

### ❌ Lỗi: Không thể đăng nhập

**Kiểm Tra:**
1. SĐT/Username: `0912345678` hay `admin`
2. Mật khẩu: `123123`
3. Kiểm tra database có dữ liệu không (SELECT * FROM NguoiDung)

---

## 🔄 Quy Trình Hoạt Động

### 📋 Quy Trình Đặt Phòng

```
1. KHÁCH HÀNG TRUY CẬP
   ├─ Chưa có tài khoản → Nhấn "Đăng Ký"
   └─ Có tài khoản → Nhấn "Đăng Nhập"
           ↓
2. VÀO TRANG ĐẶT PHÒNG
   ├─ Chọn loại phòng
   ├─ Chọn ngày check-in/out
   └─ Nhập CCCD, năm sinh, địa chỉ
           ↓
3. HỆ THỐNG TÌM PHÒNG TRỐNG
   ├─ Kiểm tra phòng bảo trì?
   ├─ Kiểm tra phòng có trùng lịch?
   └─ Phân phòng tự động
           ↓
4. THANH TOÁN
   ├─ Xác nhận giá tiền
   ├─ Tạo hóa đơn
   └─ Trạng thái: "Đã đặt" ✅
           ↓
5. NHẬN MÃ PHÒNG
   └─ Sẵn sàng check-in
```

### 🏨 Quy Trình Check-in / Check-out

```
QUẢN LÝ NHẤN CHECK-IN
   ↓
Trạng thái: "Đã đặt" → "Đang ở" ✅
   ↓
KHÁCH VÀO PHÒNG
   ↓
... (khách lưu trú)
   ↓
QUẢN LÝ NHẤN THANH TOÁN
   ↓
Trạng thái: "Đang ở" → "Đã thanh toán" ✅
   ↓
TÍNH PHÍ THÊM (nếu có)
├─ Quá 12h trưa:
