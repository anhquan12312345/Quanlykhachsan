const express = require('express');
const sql = require('mssql'); 
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const open = require('open');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- 1. CẤU HÌNH DATABASE ---
const dbConfig = {
    server: 'localhost', 
    port: 53439, 
    user: 'Nhom11web',    
    password: '123123',   
    database: 'KhachsanNhom11', 
    options: {
        encrypt: false, 
        trustServerCertificate: true, 
        enableArithAbort: true
    }
};

// --- 2. KẾT NỐI DATABASE ---
let pool;
async function getDb() {
    if (pool) return pool;
    try {
        pool = await sql.connect(dbConfig);
        console.log('✅ Đã kết nối SQL!');
        return pool;
    } catch (err) {
        console.error('❌ Lỗi kết nối SQL:', err);
        throw err;
    }
}
getDb(); 
setInterval(() => { /* Chống tắt server */ }, 10000);

// ================= DANH SÁCH API =================

// API 1: ĐĂNG NHẬP
app.post('/login', async (req, res) => {
    try {
        const db = await getDb();
        const { sdt, password } = req.body;
        const result = await db.request()
            .input('sdt', sql.VarChar, sdt).input('password', sql.VarChar, password)
            .query('SELECT ID, HoTen, Email, SoDienThoai FROM NguoiDung WHERE SoDienThoai = @sdt AND MatKhau = @password');

        if (result.recordset.length === 1) {
            const user = result.recordset[0];
            res.status(200).json({ 
                message: "Login OK", 
                nguoiDung: { 
                    Id: user.ID, id: user.ID,
                    Ten: user.HoTen, hoTen: user.HoTen,
                    Email: user.Email, Sdt: user.SoDienThoai 
                } 
            });
        } else { res.status(401).json({ message: "Sai SĐT hoặc mật khẩu." }); }
    } catch (err) { res.status(500).json({ message: "Lỗi server." }); }
});

// API 2: ĐĂNG KÝ
app.post('/dang-ky', async (req, res) => {
    try {
        const db = await getDb();
        const { name, email, sdt, password, password2 } = req.body;

        const check = await db.request().input('sdt', sql.VarChar, sdt).input('email', sql.VarChar, email)
            .query('SELECT COUNT(*) AS count FROM NguoiDung WHERE SoDienThoai = @sdt OR Email = @email');

        if (check.recordset[0].count > 0) return res.status(409).json({ message: "Đã tồn tại." });

        await db.request()
            .input('Ten', sql.NVarChar, name).input('Email', sql.VarChar, email)
            .input('Sdt', sql.VarChar, sdt).input('MatKhau', sql.VarChar, password).input('MatKhauCap2', sql.VarChar, password2)
            .query(`INSERT INTO NguoiDung (HoTen, Email, SoDienThoai, MatKhau, MatKhauCap2) VALUES (@Ten, @Email, @Sdt, @MatKhau, @MatKhauCap2)`);
        
        res.status(201).json({ message: "Đăng ký thành công!" });
    } catch (err) { res.status(500).json({ message: "Lỗi đăng ký." }); }
});

// API 3: QUÊN MK
app.post('/quen-mat-khau', async (req, res) => {
    try {
        const db = await getDb();
        const { sdt, password2 } = req.body;
        const result = await db.request().input('sdt', sql.VarChar, sdt).input('matkhau2', sql.VarChar, password2)
            .query('SELECT MatKhau FROM NguoiDung WHERE SoDienThoai = @sdt AND MatKhauCap2 = @matkhau2');

        if (result.recordset.length > 0) res.status(200).json({ message: 'OK', matKhau: result.recordset[0].MatKhau });
        else res.status(401).json({ message: 'Sai thông tin.' });
    } catch (err) { res.status(500).json({ message: "Lỗi server." }); }
});

// API 4: ĐẶT PHÒNG (Sửa trạng thái ban đầu thành "Đã đặt")
app.post('/dat-phong', async (req, res) => {
    try {
        const db = await getDb();
        const { userId, roomId, roomName, checkin, checkout, guests, totalPrice, email, cccd, dob, hometown } = req.body;
        const ngayDatHienTai = new Date();

        console.log(`\n📌 [ĐẶT PHÒNG] Yêu cầu: ${roomName} (${roomId})`);

        // ===== BƯỚC 1: XÁC ĐỊNH LOẠI PHÒNG =====
        const getRoomType = await db.request()
            .input('InputID', sql.VarChar, roomId)
            .input('InputName', sql.NVarChar, roomName)
            .query(`
                SELECT TOP 1 RoomType, Price
                FROM RoomInventory 
                WHERE RoomCode = @InputID OR RoomName LIKE N'%' + @InputName + N'%'
            `);

        if (getRoomType.recordset.length === 0) {
            return res.status(400).json({ message: `❌ Không tìm thấy loại phòng này!` });
        }

        const roomType = getRoomType.recordset[0].RoomType;
        console.log(`   🏷️ Loại phòng: ${roomType}`);

        // ===== BƯỚC 2: TÌM TẤT CẢ PHÒNG CÙNG LOẠI =====
        const allRoomsOfType = await db.request()
            .input('RoomType', sql.NVarChar, roomType)
            .query(`
                SELECT RoomCode, RoomName, TrangThai
                FROM RoomInventory 
                WHERE RoomType = @RoomType
                ORDER BY RoomCode ASC
            `);

        console.log(`   📊 Có ${allRoomsOfType.recordset.length} phòng ${roomType} trong hệ thống`);

        // ===== BƯỚC 3: LỌC RA PHÒNG TRỐNG =====
        let availableRoom = null;

        for (const room of allRoomsOfType.recordset) {
            if (room.TrangThai === 'Bảo trì') {
                console.log(`   ⚠️ ${room.RoomCode}: Đang bảo trì - Bỏ qua`);
                continue;
            }

            const checkBooking = await db.request()
            .input('RoomCode', sql.VarChar, room.RoomCode)
                .input('CheckIn', sql.DateTime, checkin)
                .input('CheckOut', sql.DateTime, checkout)
                .query(`
                    SELECT COUNT(*) AS SoDon
                    FROM DatPhong 
                    WHERE RoomCode = @RoomCode
                    AND (CheckIn < @CheckOut AND CheckOut > @CheckIn)
                    AND [Trạng Thái] IN (N'Đã đặt', N'Đang ở')
                `);

            const conflict = checkBooking.recordset[0].SoDon;

            if (conflict === 0) {
                availableRoom = room;
                console.log(`   ✅ ${room.RoomCode}: TRỐNG - Chọn phòng này!`);
                break;
            } else {
                console.log(`   ❌ ${room.RoomCode}: Đã có ${conflict} đơn trùng lịch`);
            }
        }

        // ===== BƯỚC 4: KIỂM TRA KẾT QUẢ =====
        if (!availableRoom) {
            return res.status(400).json({ 
                message: `😢 Rất tiếc! Tất cả phòng ${roomType} đã kín trong khung giờ này. Vui lòng chọn ngày khác hoặc loại phòng khác.` 
            });
        }

        console.log(`   🎯 Phân phòng: ${availableRoom.RoomCode} (${availableRoom.RoomName})`);

        // ===== BƯỚC 5: LƯU ĐƠN ĐẶT PHÒNG VỚI TRẠNG THÁI "Đã đặt" =====
        await db.request()
            .input('UserID', sql.Int, userId)
            .input('RoomID', sql.VarChar, availableRoom.RoomCode)
            .input('RoomName', sql.NVarChar, availableRoom.RoomName)
            .input('CheckIn', sql.DateTime, checkin)
            .input('CheckOut', sql.DateTime, checkout)
            .input('Guests', sql.Int, guests)
            .input('TotalPrice', sql.NVarChar, totalPrice)
            .input('Email', sql.VarChar, email)
            .input('CCCD', sql.VarChar, cccd)
            .input('DOB', sql.Int, dob)
            .input('Hometown', sql.NVarChar, hometown)
            .input('RoomCode', sql.VarChar, availableRoom.RoomCode)
            .input('NgayDat', sql.DateTime, ngayDatHienTai)
            .query(`
                INSERT INTO DatPhong (UserID, RoomID, RoomName, CheckIn, CheckOut, Guests, TotalPrice, Email, CCCD, DOB, Hometown, RoomCode, NgayDat, [Trạng Thái]) 
                VALUES (@UserID, @RoomID, @RoomName, @CheckIn, @CheckOut, @Guests, @TotalPrice, @Email, @CCCD, @DOB, @Hometown, @RoomCode, @NgayDat, N'Đã đặt')
            `);

        res.status(200).json({ 
            message: `✅ Đặt phòng thành công!\n🏨 Phòng của bạn: ${availableRoom.RoomName}`,
            roomAssigned: {
                code: availableRoom.RoomCode,
                name: availableRoom.RoomName
            }
        });

    } catch (err) { 
        console.error("❌ Lỗi đặt phòng:", err);
        res.status(500).json({ message: "Lỗi hệ thống: " + err.message }); 
    }
});

// API 5: LẤY LỊCH SỬ
app.get('/my-bookings/:userId', async (req, res) => {
    try {
        const db = await getDb();
        const { userId } = req.params;
        
        const result = await db.request()
            .input('UserID', sql.Int, userId)
            .query(`
                SELECT 
                    ID, RoomCode, RoomName, CheckIn, CheckOut, 
                    TotalPrice, NgayDat, [Trạng Thái] as TrangThai
                FROM DatPhong 
                WHERE UserID = @UserID 
                ORDER BY NgayDat DESC
            `);
        
        res.status(200).json(result.recordset);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ message: "Lỗi server." }); 
    }
});

// API 6: HỦY PHÒNG (Đã sửa tên cột [Trạng Thái])
app.put('/cancel-booking/:id', async (req, res) => {
    try {
        const db = await getDb();
        const { id } = req.params;
        // SỬA TÊN CỘT Ở DÒNG DƯỚI ĐÂY:
        await db.request().input('ID', sql.Int, id).query("UPDATE DatPhong SET [Trạng Thái] = N'Đã hủy' WHERE ID = @ID");
        res.status(200).json({ message: "Đã hủy." });
    } catch (err) { res.status(500).json({ message: "Lỗi server." }); }
});

// ===== THAY THẾ API 7 trong server.js =====

// API 7: ĐĂNG NHẬP QUẢN LÝ (Cho phép tất cả nhân viên, không chỉ admin)
app.post('/login-admin', async (req, res) => {
    const { username, password } = req.body;
    
    console.log(`🔐 [ĐĂNG NHẬP QUẢN LÝ] Tài khoản: ${username}`);
    
    try {
        const db = await getDb();
        
        // ⭐ BỎ ĐIỀU KIỆN ChucVu = 'admin' - Cho phép tất cả nhân viên đăng nhập
        const result = await db.request()
            .input('user', sql.VarChar, username)
            .input('pass', sql.VarChar, password)
            .query(`
                SELECT 
                    MaNV,
                    HoTen, 
                    TenDangNhap, 
                    ChucVu,
                    SoDienThoai,
                    Email,
                    QueQuan
                FROM NhanVien 
                WHERE TenDangNhap = @user AND MatKhau = @pass
            `);

        if (result.recordset.length > 0) {
            const nhanVien = result.recordset[0];
            
            console.log(`   ✅ Đăng nhập thành công: ${nhanVien.HoTen} (${nhanVien.ChucVu})`);
            
            res.json({ 
                success: true, 
                message: `Đăng nhập thành công! Chào ${nhanVien.HoTen}`,
                nguoiDung: nhanVien
            });
        } else {
            console.log(`   ❌ Đăng nhập thất bại: Sai tài khoản hoặc mật khẩu`);
            
            res.status(401).json({ 
                success: false, 
                message: "❌ Sai tài khoản hoặc mật khẩu!" 
            });
        }
    } catch (err) {
        console.error("❌ Lỗi SQL:", err);
        res.status(500).json({ 
            success: false,
            message: "Lỗi Server SQL" 
        });
    }
});
// API 8: LẤY DANH SÁCH NHÂN VIÊN
app.get('/api/nhan-vien', async (req, res) => {
    try {
        const db = await getDb();
        const result = await db.request().query`SELECT * FROM NhanVien`;
        res.json(result.recordset);
    } catch (err) {
        console.error("Lỗi lấy nhân viên:", err);
        res.status(500).json({ message: "Lỗi Server" });
    }
});

// API 9: XÓA NHÂN VIÊN
app.delete('/api/nhan-vien/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const db = await getDb();
        const check = await db.request().input('MaNV', sql.VarChar, id).query(`SELECT TenDangNhap FROM NhanVien WHERE MaNV = @MaNV`);
        
        if (check.recordset.length > 0 && check.recordset[0].TenDangNhap === 'admin') {
            return res.status(403).json({ message: "Không được xóa Admin gốc!" });
        }
        await db.request().input('MaNV', sql.VarChar, id).query(`DELETE FROM NhanVien WHERE MaNV = @MaNV`);
        res.json({ success: true, message: "Đã xóa thành công!" });
    } catch (err) {
        console.error("Lỗi xóa:", err);
        res.status(500).json({ message: "Lỗi Server: " + err.message });
    }
});

// API 10: LẤY DANH SÁCH PHÒNG (Fix tạm - Xử lý mọi trường hợp)
app.get('/api/phong', async (req, res) => {
    try {
        const db = await getDb();
        const query = `
            SELECT 
                R.RoomCode AS MaPhong, 
                R.RoomName AS TenPhong, 
                ISNULL(R.RoomType, N'Tiêu chuẩn') AS LoaiPhong,
                ISNULL(R.Price, 0) AS GiaPhong,

                -- Lấy tên khách
                (SELECT TOP 1 N.HoTen 
                 FROM dbo.DatPhong D 
                 JOIN dbo.NguoiDung N ON D.UserID = N.ID 
                 WHERE LTRIM(RTRIM(D.RoomCode)) = LTRIM(RTRIM(R.RoomCode))
                 AND CAST(D.CheckOut AS DATE) >= CAST(GETDATE() AS DATE)
                 AND D.[Trạng Thái] NOT IN (N'Đã hủy', N'Đã thanh toán')
                 ORDER BY 
                    CASE WHEN D.[Trạng Thái] = N'Đang ở' THEN 1 ELSE 2 END,
                    D.CheckIn ASC
                ) AS TenKhachHang,

                -- ===== TRẠNG THÁI PHÒNG (Fix chặt chẽ) =====
                CASE 
                    -- 1. BẢO TRÌ
                    WHEN R.TrangThai IS NOT NULL 
                         AND LTRIM(RTRIM(UPPER(R.TrangThai))) LIKE N'%BẢO TRÌ%'
                    THEN N'Bảo trì'

                    -- 2. ĐANG Ở
                    WHEN EXISTS (
                        SELECT 1 FROM dbo.DatPhong D 
                        WHERE LTRIM(RTRIM(D.RoomCode)) = LTRIM(RTRIM(R.RoomCode))
                        AND LTRIM(RTRIM(D.[Trạng Thái])) = N'Đang ở'
                        AND CAST(D.CheckOut AS DATE) >= CAST(GETDATE() AS DATE)
                    ) THEN N'Đang ở'
                    
                    -- 3. ĐÃ ĐẶT (FIX QUAN TRỌNG!)
                    WHEN EXISTS (
                        SELECT 1 FROM dbo.DatPhong D 
                        WHERE LTRIM(RTRIM(D.RoomCode)) = LTRIM(RTRIM(R.RoomCode))
                        AND LTRIM(RTRIM(D.[Trạng Thái])) = N'Đã đặt'
                        AND CAST(D.CheckOut AS DATE) >= CAST(GETDATE() AS DATE)
                    ) THEN N'Đã đặt'

                    ELSE N'Trống' 
                END AS TrangThai

            FROM dbo.RoomInventory R
            ORDER BY R.Price DESC, R.RoomName ASC
        `;
        
        const result = await db.request().query(query);
        
        // Log chi tiết để debug
        const stats = {
            total: result.recordset.length,
            baoTri: result.recordset.filter(r => r.TrangThai === 'Bảo trì').length,
            dangO: result.recordset.filter(r => r.TrangThai === 'Đang ở').length,
            daDat: result.recordset.filter(r => r.TrangThai === 'Đã đặt').length,
            trong: result.recordset.filter(r => r.TrangThai === 'Trống').length
        };
        
        console.log(`📊 [API PHÒNG] Tổng: ${stats.total} | Bảo trì: ${stats.baoTri} | Đang ở: ${stats.dangO} | Đã đặt: ${stats.daDat} | Trống: ${stats.trong}`);
        
        // Log các phòng Đã đặt để debug
        const bookedRooms = result.recordset.filter(r => r.TrangThai === 'Đã đặt');
        if (bookedRooms.length > 0) {
            console.log(`   ✅ Phòng đã đặt:`, bookedRooms.map(r => r.MaPhong).join(', '));
        }
        
        res.json(result.recordset);
    } catch (err) { 
        console.error("❌ Lỗi API phòng:", err);
        res.status(500).send(err.message); 
    }
});

// API 11: THỐNG KÊ DASHBOARD (Phiên bản An Toàn - Tính bằng JS)
app.get('/api/thong-ke-dashboard', async (req, res) => {
    try {
        const db = await getDb();

        // 1. Lấy số liệu cơ bản (Đếm phòng)
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM dbo.RoomInventory) AS TongSo,
                (SELECT COUNT(DISTINCT RoomCode) FROM dbo.DatPhong WHERE [Trạng Thái] = N'Đang ở') AS DangO, 
                (SELECT COUNT(DISTINCT RoomCode) FROM dbo.DatPhong WHERE [Trạng Thái] = N'Đã đặt' AND CAST(CheckIn AS DATE) <= CAST(GETDATE() AS DATE)) AS DaDat,
                (SELECT COUNT(*) FROM dbo.RoomInventory WHERE TrangThai = N'Bảo trì') AS BaoTri,
                (SELECT COUNT(*) FROM dbo.DichVu WHERE Status = N'Chờ xác nhận') AS DichVuMoi
        `;
        const statsResult = await db.request().query(statsQuery);
        const data = statsResult.recordset[0];

        // 2. Lấy danh sách hóa đơn PHÒNG thanh toán HÔM NAY
        const roomRevenueQuery = `
        SELECT TotalPrice 
            FROM dbo.DatPhong
            WHERE [Trạng Thái] = N'Đã thanh toán'
            AND CAST(NgayTraThucTe AS DATE) = CAST(GETDATE() AS DATE)
        `;
        const roomRes = await db.request().query(roomRevenueQuery);

        // 3. Lấy danh sách hóa đơn DỊCH VỤ thanh toán HÔM NAY
        const serviceRevenueQuery = `
            SELECT TotalPrice 
            FROM dbo.DichVu
            WHERE Status = N'Đã thanh toán'
            AND CAST(OrderDate AS DATE) = CAST(GETDATE() AS DATE) -- Hoặc dùng cột ngày thanh toán nếu có
        `;
        const serviceRes = await db.request().query(serviceRevenueQuery);

        // 4. Hàm làm sạch tiền (Chấp nhận cả chuỗi "100.000 VND" và số 100000)
        const parseMoney = (raw) => {
            if (!raw) return 0;
            if (typeof raw === 'number') return raw;
            // Xóa tất cả ký tự KHÔNG PHẢI SỐ
            const str = String(raw).replace(/[^0-9]/g, '');
            return parseInt(str) || 0;
        };

        // 5. Cộng tổng bằng vòng lặp JS (An toàn tuyệt đối)
        let totalToday = 0;
        
        roomRes.recordset.forEach(item => {
            totalToday += parseMoney(item.TotalPrice);
        });

        serviceRes.recordset.forEach(item => {
            totalToday += parseMoney(item.TotalPrice);
        });

        // 6. Tính phòng trống
        const phongTrong = data.TongSo - data.DangO - data.DaDat - data.BaoTri;

        console.log(`💰 [DASHBOARD] Doanh thu hôm nay: ${totalToday.toLocaleString('vi-VN')} đ`);

        // 7. Trả kết quả
        res.json({ 
            ...data, 
            PhongTrong: phongTrong,
            DoanhThuHomNay: totalToday 
        });

    } catch (err) {
        console.error("❌ Lỗi API Thống kê:", err);
        // Trả về dữ liệu mặc định để không làm sập web
        res.json({
            TongSo: 0, DangO: 0, DaDat: 0, BaoTri: 0, DichVuMoi: 0, PhongTrong: 0, DoanhThuHomNay: 0
        });
    }
});

// API 12: LẤY CHI TIẾT ĐẶT PHÒNG (Fix cho cả Đã đặt & Đang ở)
app.get('/api/dat-phong/chi-tiet/:roomCode', async (req, res) => {
    try {
        const { roomCode } = req.params;
        const db = await getDb();

        console.log(`🔍 [CHI TIẾT PHÒNG] Đang tìm: [${roomCode}]`);

        const query = `
            SELECT TOP 1 
                D.RoomName, 
                D.CheckIn, 
                D.CheckOut, 
                D.Guests AS SoLuongKhach, 
                D.TotalPrice AS TongTien, 
                D.Email, 
                D.CCCD, 
                D.Hometown AS QueQuan, 
                D.DOB AS NamSinh,
                N.HoTen, 
                D.[Trạng Thái] AS TrangThai
            FROM dbo.DatPhong D
            LEFT JOIN dbo.NguoiDung N ON D.UserID = N.ID
            WHERE LTRIM(RTRIM(D.RoomCode)) = @RoomCode
            -- ⭐ BỎ ĐIỀU KIỆN CheckOut > GETDATE() để hiện cả đơn cũ
            AND D.[Trạng Thái] IN (N'Đã đặt', N'Đang ở')
            ORDER BY 
                -- Ưu tiên Đang ở trước, sau đó đến Đã đặt
                CASE WHEN D.[Trạng Thái] = N'Đang ở' THEN 1 ELSE 2 END,
                D.CheckIn DESC
        `;
        
        const result = await db.request()
            .input('RoomCode', sql.VarChar, roomCode.trim())
            .query(query);

        if (result.recordset.length === 0) {
            console.log(`   ❌ Không tìm thấy đơn đặt nào cho phòng [${roomCode}]`);
            return res.status(404).json({ message: "Phòng này hiện đang trống hoặc không có đơn hợp lệ!" });
        }

        console.log(`   ✅ Tìm thấy: ${result.recordset[0].HoTen} - ${result.recordset[0].TrangThai}`);
        res.json(result.recordset[0]);

    } catch (err) { 
        console.error("❌ Lỗi API Chi tiết:", err);
        res.status(500).json({ message: "Lỗi Server: " + err.message }); 
    }
});

// API 13: CHECK-IN (Chuyển "Đã đặt" → "Đang ở")
app.put('/api/check-in/:roomCode', async (req, res) => {
    try {
        const { roomCode } = req.params;
        const db = await getDb();
        
        console.log(`🔑 [CHECK-IN API] Phòng: [${roomCode}]`);
        
        // ⭐ Cập nhật: "Đã đặt" → "Đang ở"
        const result = await db.request()
            .input('RoomCode', sql.VarChar, roomCode.trim())
            .query(`
                UPDATE dbo.DatPhong 
                SET [Trạng Thái] = N'Đang ở', 
                    CheckIn = GETDATE()
                WHERE LTRIM(RTRIM(RoomCode)) = @RoomCode 
                AND [Trạng Thái] = N'Đã đặt'
                AND CAST(CheckOut AS DATE) >= CAST(GETDATE() AS DATE)
            `);
        
        if (result.rowsAffected[0] > 0) {
            console.log(`   ✅ Check-in thành công: ${result.rowsAffected[0]} đơn`);
            res.json({ success: true, message: "✅ Check-in thành công! Khách đã vào ở." });
        } else {
            console.log(`   ⚠️ Không tìm thấy đơn 'Đã đặt' phù hợp`);
            res.json({ success: false, message: "⚠️ Không tìm thấy đơn đặt phòng hợp lệ!" });
        }
        
    } catch (err) { 
        console.error("❌ Lỗi Check-in:", err);
        res.status(500).json({ success: false, message: "Lỗi: " + err.message }); 
    }
});

// API 14: THANH TOÁN (Chuyển "Đang ở" → "Đã thanh toán")
app.put('/api/thanh-toan/:roomCode', async (req, res) => {
    try {
        let { roomCode } = req.params;
        roomCode = roomCode.trim();

        console.log(`💰 [THANH TOÁN] Phòng: [${roomCode}]`);
        const db = await getDb();

        // ⭐ BƯỚC 1: Chuyển "Đang ở" → "Đã thanh toán"
        const result = await db.request()
            .input('RoomCode', sql.VarChar, roomCode)
            .query(`
                UPDATE dbo.DatPhong 
                SET [Trạng Thái] = N'Đã thanh toán', 
                    NgayTraThucTe = GETDATE()
                WHERE LTRIM(RTRIM(RoomCode)) = @RoomCode 
                AND [Trạng Thái] = N'Đang ở'
            `);

        if (result.rowsAffected[0] === 0) {
            console.log(`   ⚠️ Không tìm thấy đơn 'Đang ở' để thanh toán`);
            return res.json({ 
                success: false, 
                message: "⚠️ Phòng này không có đơn đang ở để thanh toán!" 
            });
        }

        console.log(`   ✅ Đã thanh toán: ${result.rowsAffected[0]} đơn`);

        // ⭐ BƯỚC 2: Chuyển phòng sang Bảo trì
        const updateRoom = await db.request()
            .input('RoomCode', sql.VarChar, roomCode)
            .query(`
                UPDATE dbo.RoomInventory 
                SET TrangThai = N'Bảo trì' 
                WHERE LTRIM(RTRIM(RoomCode)) = @RoomCode
            `);

        console.log(`   🧹 Chuyển sang Bảo trì: ${updateRoom.rowsAffected[0]} phòng`);

        res.json({ 
            success: true, 
            message: "✅ Thanh toán thành công!\n🧹 Phòng đã chuyển sang Bảo trì." 
        });

    } catch (err) { 
        console.error("❌ Lỗi thanh toán:", err);
        res.status(500).json({ 
            success: false, 
            message: "Lỗi: " + err.message 
        }); 
    }
});

// API 15: XEM HÓA ĐƠN 
// Gọi API này trước khi bấm nút "Thanh toán" để hiện số tiền cho khách xem
app.get('/api/hoa-don/:roomCode', async (req, res) => {
    try {
        const { roomCode } = req.params;
        const db = await getDb();

        const query = `
            SELECT TOP 1 
                D.ID,
                D.RoomName,
                FORMAT(D.CheckIn, 'dd/MM/yyyy') + ' 12:00 PM' AS GioNhanQuyDinh,
                GETDATE() AS GioTraThucTe, -- Lấy giờ hiện tại để tính thử

                -- 1. Lấy giá gốc (Xử lý chuỗi "2.000.000 VND")
                CAST(REPLACE(REPLACE(D.TotalPrice, ' VND', ''), '.', '') AS DECIMAL(18,0)) AS TongTienGoc,

                -- 2. Tính số đêm
                CASE WHEN DATEDIFF(DAY, D.CheckIn, GETDATE()) = 0 THEN 1 ELSE DATEDIFF(DAY, D.CheckIn, GETDATE()) END AS SoDem,

                -- 3. Tính Phụ Thu (Logic: Quá 12h trưa tính tiền)
                CASE 
                    WHEN DATEPART(HOUR, GETDATE()) < 12 THEN 0 -- Trước 12h: Free
                    
                    WHEN DATEPART(HOUR, GETDATE()) >= 12 AND DATEPART(HOUR, GETDATE()) < 15 
                    THEN (CAST(REPLACE(REPLACE(D.TotalPrice, ' VND', ''), '.', '') AS DECIMAL(18,0)) / NULLIF(DATEDIFF(DAY, D.CheckIn, D.CheckOut), 0)) * 0.3 -- 30%
                    
                    WHEN DATEPART(HOUR, GETDATE()) >= 15 AND DATEPART(HOUR, GETDATE()) < 18
                    THEN (CAST(REPLACE(REPLACE(D.TotalPrice, ' VND', ''), '.', '') AS DECIMAL(18,0)) / NULLIF(DATEDIFF(DAY, D.CheckIn, D.CheckOut), 0)) * 0.5 -- 50%
                    
                    ELSE (CAST(REPLACE(REPLACE(D.TotalPrice, ' VND', ''), '.', '') AS DECIMAL(18,0)) / NULLIF(DATEDIFF(DAY, D.CheckIn, D.CheckOut), 0)) * 1.0 -- 100%
                END AS TienPhuThu

            FROM dbo.DatPhong D
            WHERE D.RoomCode = @RoomCode 
            AND D.[Trạng Thái] = N'Đang ở'
        `;

        const result = await db.request().input('RoomCode', sql.VarChar, roomCode).query(query);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy phòng đang ở!" });
        }

        const data = result.recordset[0];
        
        // Tính tổng tiền cuối cùng tại Node.js cho gọn
        const finalTotal = data.TongTienGoc + data.TienPhuThu;

        res.json({
            ...data,
            TongTienPhaiTra: finalTotal
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Lỗi tính tiền" });
    }
});
// API 16: LẤY DANH SÁCH THANH TOÁN (Đã thêm RoomCode để nút Thanh toán hoạt động)
app.get('/api/quan-ly-thanh-toan', async (req, res) => {
    try {
        const db = await getDb();
        const query = `
            SELECT 
                D.ID AS MaHD,
                N.HoTen AS TenKhachHang, 
                D.RoomName AS TenPhong,
                D.RoomCode,  -- 👈 THÊM CÁI NÀY ĐỂ THANH TOÁN ĐƯỢC
                D.TotalPrice AS TongTienRaw, 
                D.NgayDat,
                D.[Trạng Thái] AS TrangThai
            FROM dbo.DatPhong D
            LEFT JOIN dbo.NguoiDung N ON D.UserID = N.ID
            WHERE D.[Trạng Thái] != N'Đã hủy'
            ORDER BY D.NgayDat DESC
        `;
        
        const result = await db.request().query(query);
        
        const cleanData = result.recordset.map(item => {
            let rawStr = item.TongTienRaw ? String(item.TongTienRaw) : "0";
            let onlyNumbers = rawStr.replace(/[^0-9]/g, '');
            let finalPrice = parseInt(onlyNumbers) || 0;

            return {
                ...item,
                TongTien: finalPrice
            };
        });

        res.json(cleanData);

    } catch (err) {
        console.error("Lỗi:", err);
        res.json([]);
    }
});

// API 17: DỌN PHÒNG XONG (Chuyển từ Bảo trì -> Trống)
app.put('/api/don-phong/:roomCode', async (req, res) => {
    try {
        const { roomCode } = req.params;
        const db = await getDb();

        // Set lại trạng thái phòng thành NULL (hoặc 'Sẵn sàng') để nó hiện màu Trắng/Xanh
        await db.request()
            .input('RoomCode', sql.VarChar, roomCode)
            .query(`
                UPDATE dbo.RoomInventory 
                SET TrangThai = NULL
                WHERE RoomCode = @RoomCode
            `);

        res.json({ success: true, message: "Đã dọn phòng xong! Phòng sẵn sàng đón khách." });
    } catch (err) { res.status(500).json({ message: "Lỗi server" }); }
});

// API 18: ĐẶT DỊCH VỤ (Gym, Buffet, Spa...)
app.post('/api/dat-dich-vu', async (req, res) => {
    try {
        const db = await getDb();
        const { userId, services, serviceDate, note, customerName, customerPhone } = req.body;
        const ngayDat = new Date();

        console.log(`🎫 [ĐẶT DỊCH VỤ] User ${userId} đặt ${services.length} dịch vụ`);

        // Tính tổng tiền
        let totalAmount = 0;
        services.forEach(service => {
            totalAmount += service.price * service.qty;
        });

        // Lưu từng dịch vụ vào database
        for (const service of services) {
            await db.request()
                .input('UserID', sql.Int, userId)
                .input('ServiceName', sql.NVarChar, service.name)
                .input('ServiceID', sql.VarChar, service.id)
                .input('Quantity', sql.Int, service.qty)
                .input('UnitPrice', sql.Int, service.price)
                .input('TotalPrice', sql.Int, service.price * service.qty)
                .input('ServiceDate', sql.Date, serviceDate)
                .input('Note', sql.NVarChar, note || null)
                .input('CustomerName', sql.NVarChar, customerName)
                .input('CustomerPhone', sql.VarChar, customerPhone)
                .input('OrderDate', sql.DateTime, ngayDat)
                .input('Status', sql.NVarChar, 'Chờ xác nhận')
                .query(`
                    INSERT INTO DichVu 
                    (UserID, ServiceName, ServiceID, Quantity, UnitPrice, TotalPrice, ServiceDate, Note, CustomerName, CustomerPhone, OrderDate, Status) 
                    VALUES 
                    (@UserID, @ServiceName, @ServiceID, @Quantity, @UnitPrice, @TotalPrice, @ServiceDate, @Note, @CustomerName, @CustomerPhone, @OrderDate, @Status)
                `);
        }

        console.log(`   ✅ Đã lưu ${services.length} dịch vụ, tổng: ${totalAmount.toLocaleString('vi-VN')}đ`);

        res.status(200).json({ 
            message: '✅ Đặt dịch vụ thành công!',
            totalAmount: totalAmount
        });

    } catch (err) { 
        console.error("❌ Lỗi đặt dịch vụ:", err);
        res.status(500).json({ message: "Lỗi hệ thống: " + err.message }); 
    }
});

// API 19: LẤY LỊCH SỬ DỊCH VỤ CỦA USER
app.get('/api/lich-su-dich-vu/:userId', async (req, res) => {
    try {
        const db = await getDb();
        const { userId } = req.params;
        
        const result = await db.request()
            .input('UserID', sql.Int, userId)
            .query(`
                SELECT * FROM DichVu 
                WHERE UserID = @UserID
                ORDER BY OrderDate DESC
            `);
        
        res.status(200).json(result.recordset);
    } catch (err) { 
        res.status(500).json({ message: "Lỗi server." }); 
    }
});

// API 20: LẤY DANH SÁCH DỊCH VỤ (CHO ADMIN)
app.get('/api/quan-ly-dich-vu', async (req, res) => {
    try {
        const db = await getDb();
        const result = await db.request().query(`
            SELECT 
                D.ID,
                D.ServiceName,
                D.CustomerName,
                D.CustomerPhone,
                D.Quantity,
                D.TotalPrice,
                D.ServiceDate,
                D.OrderDate,
                D.Status,
                D.Note
            FROM DichVu D
            ORDER BY D.OrderDate DESC
        `);
        
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Lỗi lấy danh sách dịch vụ" });
    }
});

// API 21: KHÁCH ĐẶT DỊCH VỤ
app.post('/api/dat-dich-vu', async (req, res) => {
    try {
        const db = await getDb();
        const { userId, services, serviceDate, note, customerName, customerPhone } = req.body;

        // Lưu từng món dịch vụ vào bảng DichVu
        for (const item of services) {
            await db.request()
                .input('UserID', sql.Int, userId)
                .input('CustomerName', sql.NVarChar, customerName)
                .input('CustomerPhone', sql.VarChar, customerPhone)
                .input('ServiceName', sql.NVarChar, item.name)   // Sửa tên cột
                .input('ServiceID', sql.VarChar, item.id)        // Thêm ServiceID
                .input('Quantity', sql.Int, item.qty)            // Sửa tên cột
                .input('UnitPrice', sql.Int, item.price)         // Sửa tên cột
                .input('TotalPrice', sql.Int, item.price * item.qty) // Sửa tên cột
                .input('ServiceDate', sql.Date, serviceDate)     // Sửa tên cột
                .input('Note', sql.NVarChar, note)               // Sửa tên cột
                .query(`
                    INSERT INTO DichVu (UserID, CustomerName, CustomerPhone, ServiceName, ServiceID, Quantity, UnitPrice, TotalPrice, ServiceDate, Note, Status)
                    VALUES (@UserID, @CustomerName, @CustomerPhone, @ServiceName, @ServiceID, @Quantity, @UnitPrice, @TotalPrice, @ServiceDate, @Note, N'Chờ xác nhận')
                `);
        }

        res.json({ success: true, message: "Đặt dịch vụ thành công!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Lỗi lưu dịch vụ: " + err.message });
    }
});

// API 22: LẤY DANH SÁCH DỊCH VỤ (Cho trang quản lý)
app.get('/api/quan-ly-dich-vu', async (req, res) => {
    try {
        const db = await getDb();
        // Lấy dữ liệu và sắp xếp ngày đặt mới nhất lên đầu
        const result = await db.request().query(`SELECT * FROM DichVu ORDER BY OrderDate DESC`);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: "Lỗi lấy dữ liệu" });
    }
});

// API 23: CẬP NHẬT TRẠNG THÁI DỊCH VỤ (Đã đặt -> Đang sử dụng -> Đã thanh toán)
app.put('/api/update-service-status', async (req, res) => {
    try {
        const { id, status } = req.body;
        const db = await getDb();
        
        await db.request()
            .input('ID', sql.Int, id)
            .input('Status', sql.NVarChar, status)
            .query("UPDATE DichVu SET Status = @Status WHERE ID = @ID");

        res.json({ success: true, message: "Cập nhật thành công!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Lỗi server: " + err.message });
    }
});

// API 24: THÊM NHÂN VIÊN MỚI (Thêm vào server.js)
app.post('/api/them-nhan-vien', async (req, res) => {
    try {
        const db = await getDb();
        const { hoTen, tenDangNhap, matKhau, chucVu, soDienThoai, email, queQuan } = req.body;

        console.log(`👤 [THÊM NHÂN VIÊN] ${tenDangNhap} - ${chucVu}`);

        // Kiểm tra dữ liệu đầu vào
        if (!hoTen || !tenDangNhap || !matKhau || !chucVu || !queQuan) {
            return res.status(400).json({ message: '❌ Vui lòng điền đầy đủ thông tin bắt buộc!' });
        }

        // Kiểm tra tên đăng nhập đã tồn tại chưa
        const checkExist = await db.request()
            .input('TenDangNhap', sql.VarChar, tenDangNhap)
            .query('SELECT COUNT(*) AS count FROM NhanVien WHERE TenDangNhap = @TenDangNhap');

        if (checkExist.recordset[0].count > 0) {
            return res.status(409).json({ message: '⚠️ Tên đăng nhập đã tồn tại!' });
        }

        // Thêm nhân viên mới
        await db.request()
            .input('HoTen', sql.NVarChar, hoTen)
            .input('TenDangNhap', sql.VarChar, tenDangNhap)
            .input('MatKhau', sql.VarChar, matKhau)
            .input('ChucVu', sql.NVarChar, chucVu)
            .input('SoDienThoai', sql.VarChar, soDienThoai || null)
            .input('Email', sql.VarChar, email || null)
            .input('QueQuan', sql.NVarChar, queQuan)
            .query(`
                INSERT INTO NhanVien (HoTen, TenDangNhap, MatKhau, ChucVu, SoDienThoai, Email, QueQuan) 
                VALUES (@HoTen, @TenDangNhap, @MatKhau, @ChucVu, @SoDienThoai, @Email, @QueQuan)
            `);

        console.log(`   ✅ Đã thêm nhân viên: ${hoTen} (${tenDangNhap})`);

        res.status(201).json({ 
            message: `✅ Thêm nhân viên "${hoTen}" thành công!\n📌 Tài khoản có thể đăng nhập vào hệ thống.` 
        });

    } catch (err) { 
        console.error("❌ Lỗi thêm nhân viên:", err);
        res.status(500).json({ message: "Lỗi hệ thống: " + err.message }); 
    }
});

// API 25: CẬP NHẬT TRẠNG THÁI DỊCH VỤ
app.put('/api/update-service-status', async (req, res) => {
    try {
        const db = await getDb();
        const { id, status } = req.body;

        await db.request()
            .input('ID', sql.Int, id)
            .input('Status', sql.NVarChar, status)
            .query('UPDATE DichVu SET Status = @Status WHERE ID = @ID');

        res.json({ success: true, message: 'Cập nhật thành công!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// API 26: CẬP NHẬT THÔNG TIN NHÂN VIÊN
app.put('/api/nhan-vien/:id', async (req, res) => {
    try {
        const { id } = req.params; // Lấy ID nhân viên từ URL
        const { MatKhau, ChucVu, SoDienThoai, Email } = req.body; // Lấy dữ liệu gửi lên
        
        console.log(`🛠️ [CẬP NHẬT NV] ID: ${id} | Chức vụ: ${ChucVu}`);

        const db = await getDb();
        const request = db.request();

        // Thêm các tham số chung
        request.input('MaNV', sql.Int, id);
        request.input('ChucVu', sql.NVarChar, ChucVu);
        request.input('SoDienThoai', sql.VarChar, SoDienThoai);
        request.input('Email', sql.VarChar, Email);

        let query = '';

        // LOGIC QUAN TRỌNG: 
        // Nếu người dùng KHÔNG nhập mật khẩu mới (chuỗi rỗng) -> Chỉ update thông tin khác, GIỮ NGUYÊN mật khẩu cũ.
        // Nếu có nhập -> Update cả mật khẩu.
        if (MatKhau && MatKhau.trim() !== "") {
            request.input('MatKhau', sql.VarChar, MatKhau);
            query = `
                UPDATE NhanVien 
                SET MatKhau = @MatKhau, 
                    ChucVu = @ChucVu, 
                    SoDienThoai = @SoDienThoai, 
                    Email = @Email 
                WHERE MaNV = @MaNV
            `;
        } else {
            query = `
                UPDATE NhanVien 
                SET ChucVu = @ChucVu, 
                    SoDienThoai = @SoDienThoai, 
                    Email = @Email 
                WHERE MaNV = @MaNV
            `;
        }

        const result = await request.query(query);

        if (result.rowsAffected[0] > 0) {
            res.json({ success: true, message: '✅ Cập nhật thông tin thành công!' });
        } else {
            res.status(404).json({ success: false, message: '❌ Không tìm thấy nhân viên này!' });
        }

    } catch (err) {
        console.error("❌ Lỗi cập nhật nhân viên:", err);
        res.status(500).json({ success: false, message: 'Lỗi Server: ' + err.message });
    }
});

// API 27: THỐNG KÊ DOANH THU (Đã sửa lỗi hiển thị)
app.get('/api/doanh-thu-thang', async (req, res) => {
    try {
        const db = await getDb();
        const now = new Date();
        const currentMonth = now.getMonth() + 1; 
        const currentYear = now.getFullYear();

        console.log(`📊 [API DOANH THU] Đang tính toán cho Tháng ${currentMonth}/${currentYear}...`);

        // Lấy tiền phòng (Chỉ tính đơn Đã thanh toán)
        const roomRes = await db.request().query(`
            SELECT TotalPrice 
            FROM DatPhong 
            WHERE [Trạng Thái] = N'Đã thanh toán' 
            AND MONTH(NgayTraThucTe) = ${currentMonth} 
            AND YEAR(NgayTraThucTe) = ${currentYear}
        `);

        // Lấy tiền dịch vụ
        const serviceRes = await db.request().query(`
            SELECT TotalPrice 
            FROM DichVu 
            WHERE Status = N'Đã thanh toán' 
            AND MONTH(OrderDate) = ${currentMonth} 
            AND YEAR(OrderDate) = ${currentYear}
        `);

        // Hàm xử lý tiền mạnh mẽ hơn (chấp nhận cả số và chuỗi)
        const parseMoney = (raw) => {
            if (!raw) return 0;
            if (typeof raw === 'number') return raw; // Nếu là số thì lấy luôn
            // Nếu là chuỗi thì xóa chữ, giữ số
            const str = String(raw).replace(/[^0-9]/g, ''); 
            return parseInt(str) || 0;
        };

        let totalRoom = 0;
        roomRes.recordset.forEach(item => totalRoom += parseMoney(item.TotalPrice));

        let totalService = 0;
        serviceRes.recordset.forEach(item => totalService += parseMoney(item.TotalPrice));

        console.log(`   + Phòng: ${totalRoom}`);
        console.log(`   + Dịch vụ: ${totalService}`);

        res.json({
            thang: currentMonth,
            nam: currentYear,
            tienPhong: totalRoom,
            tienDichVu: totalService,
            tongCong: totalRoom + totalService
        });

    } catch (err) {
        console.error("❌ Lỗi API Doanh thu:", err);
        res.status(500).json({ message: "Lỗi server" });
    }
});

// API 28: DỮ LIỆU BIỂU ĐỒ TUẦN (Thực tế)
app.get('/api/bieu-do-tuan', async (req, res) => {
    try {
        const db = await getDb();
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        console.log(`📈 [BIỂU ĐỒ] Đang tính toán cho Tháng ${currentMonth}...`);

        // 1. Lấy tiền PHÒNG (Đã thanh toán trong tháng này)
        const roomRes = await db.request().query(`
            SELECT TotalPrice, DAY(NgayTraThucTe) as Ngay
            FROM DatPhong 
            WHERE [Trạng Thái] = N'Đã thanh toán' 
            AND MONTH(NgayTraThucTe) = ${currentMonth} 
            AND YEAR(NgayTraThucTe) = ${currentYear}
        `);

        // 2. Lấy tiền DỊCH VỤ (Đã thanh toán trong tháng này)
        const serviceRes = await db.request().query(`
            SELECT TotalPrice, DAY(OrderDate) as Ngay
            FROM DichVu 
            WHERE Status = N'Đã thanh toán' 
            AND MONTH(OrderDate) = ${currentMonth} 
            AND YEAR(OrderDate) = ${currentYear}
        `);

        // Hàm làm sạch tiền (Bỏ chữ 'VND', chuyển thành số)
        const parseMoney = (raw) => {
            if (!raw) return 0;
            if (typeof raw === 'number') return raw;
            return parseInt(String(raw).replace(/[^0-9]/g, '')) || 0;
        };

        // 3. Khởi tạo 4 tuần (Mảng 4 số 0)
        // Tuần 1: 1-7 | Tuần 2: 8-14 | Tuần 3: 15-21 | Tuần 4: 22-Hết
        let weeklyData = [0, 0, 0, 0];

        // Hàm cộng tiền vào đúng tuần
        const addToWeek = (day, amount) => {
            if (day <= 7) weeklyData[0] += amount;
            else if (day <= 14) weeklyData[1] += amount;
            else if (day <= 21) weeklyData[2] += amount;
            else weeklyData[3] += amount;
        };

        // Duyệt và cộng tiền Phòng
        roomRes.recordset.forEach(item => {
            addToWeek(item.Ngay, parseMoney(item.TotalPrice));
        });

        // Duyệt và cộng tiền Dịch vụ
        serviceRes.recordset.forEach(item => {
            addToWeek(item.Ngay, parseMoney(item.TotalPrice));
        });

        console.log(`   👉 Kết quả tuần:`, weeklyData);
        res.json(weeklyData); // Trả về mảng ví dụ: [5000000, 12000000, 0, 0]

    } catch (err) {
        console.error("Lỗi API Biểu đồ:", err);
        res.status(500).json([0, 0, 0, 0]); // Lỗi thì trả về mảng 0
    }
});

// API 29: LẤY DANH SÁCH KHÁCH HÀNG (Phiên bản Bất Tử - Fix lỗi nvarchar to numeric)
app.get('/api/khach-hang', async (req, res) => {
    try {
        const db = await getDb();

        // 1. Lấy danh sách Người Dùng
        const usersReq = await db.request().query('SELECT ID, HoTen, SoDienThoai FROM NguoiDung ORDER BY ID DESC');
        
        // 2. Lấy toàn bộ dữ liệu Đặt Phòng (Để tính toán an toàn bằng JS)
        const bookingsReq = await db.request().query(`
            SELECT UserID, TotalPrice, CCCD, RoomName, [Trạng Thái] as TrangThai 
            FROM DatPhong 
            ORDER BY NgayDat DESC
        `);

        const users = usersReq.recordset;
        const bookings = bookingsReq.recordset;

        // 3. Hàm làm sạch tiền (Chấp nhận mọi thể loại: "100k", "100.000 VND", null...)
        const parseMoney = (raw) => {
            if (!raw) return 0;
            if (typeof raw === 'number') return raw;
            // Chỉ giữ lại số, xóa hết chữ và ký tự đặc biệt
            const str = String(raw).replace(/[^0-9]/g, ''); 
            return parseInt(str) || 0;
        };

        // 4. Ghép dữ liệu và Tính tổng
        const result = users.map(user => {
            // Lấy tất cả đơn của user này
            const userBookings = bookings.filter(b => b.UserID === user.ID);

            // a. Tính tổng chi tiêu (Chỉ cộng đơn đã thanh toán)
            let totalSpent = 0;
            userBookings.forEach(b => {
                if (b.TrangThai === 'Đã thanh toán') {
                    totalSpent += parseMoney(b.TotalPrice);
                }
            });

            // b. Tìm CCCD (Lấy cái đầu tiên có dữ liệu)
            const foundCCCD = userBookings.find(b => b.CCCD && b.CCCD.length > 5);

            // c. Tìm Phòng (Lấy phòng mới nhất)
            const latestBooking = userBookings[0];

            return {
                ID: user.ID,
                HoTen: user.HoTen,
                SoDienThoai: user.SoDienThoai,
                CCCD: foundCCCD ? foundCCCD.CCCD : '', // Nếu không có thì để trống
                Phong: latestBooking ? latestBooking.RoomName : 'Chưa đặt',
                ChiTieu: totalSpent
            };
        });
        
        res.json(result);

    } catch (err) {
        console.error("Lỗi lấy khách hàng:", err);
        // Trả về mảng rỗng để Web không bị treo
        res.json([]); 
    }
});

// API 30: LẤY CHI TIẾT LỊCH SỬ (PHÒNG + DỊCH VỤ) CỦA KHÁCH
app.get('/api/khach-hang/chi-tiet/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await getDb();

        // 1. Lấy tất cả phòng từng đặt (Mới nhất lên đầu)
        const roomsRes = await db.request().input('UserID', sql.Int, id).query(`
            SELECT RoomName, CheckIn, CheckOut, TotalPrice, [Trạng Thái] as TrangThai
            FROM DatPhong
            WHERE UserID = @UserID
            ORDER BY CheckIn DESC
        `);

        // 2. Lấy tất cả dịch vụ từng dùng (Mới nhất lên đầu)
        const servicesRes = await db.request().input('UserID', sql.Int, id).query(`
            SELECT ServiceName, Quantity, TotalPrice, OrderDate, Status
            FROM DichVu
            WHERE UserID = @UserID
            ORDER BY OrderDate DESC
        `);

        res.json({
            rooms: roomsRes.recordset,
            services: servicesRes.recordset
        });

    } catch (err) {
        console.error("Lỗi lấy chi tiết:", err);
        res.status(500).json({ rooms: [], services: [] }); // Trả về rỗng để không lỗi web
    }
});
// --- CHẠY SERVER ---
// ... các biến app, port, dbConfig giữ nguyên ...

app.listen(port, () => {
    console.log(`🚀 Server đã sẵn sàng!`);
    console.log(`👉 Bây giờ hãy sang trình duyệt nhấn truy cập: http://localhost:${port}/Trangchu.html`);
});