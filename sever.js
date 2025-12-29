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


// --- CHẠY SERVER ---
// ... các biến app, port, dbConfig giữ nguyên ...

app.listen(port, () => {
    console.log(`🚀 Server đã sẵn sàng!`);
    console.log(`👉 Bây giờ hãy sang trình duyệt nhấn truy cập: http://localhost:${port}/Trangchu.html`);
});
    