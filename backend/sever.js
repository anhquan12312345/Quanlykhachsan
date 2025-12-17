console.log("=== ĐÂY LÀ CODE MỚI NHẤT CÓ API LỊCH SỬ ===");
const express = require('express');
const sql = require('mssql'); 
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

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

// --- 2. KẾT NỐI DATABASE & GIỮ SERVER SỐNG ---
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
        if (password !== password2) return res.status(400).json({ message: "Mật khẩu không khớp." });

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

// API 4: ĐẶT PHÒNG
app.post('/dat-phong', async (req, res) => {
    try {
        const db = await getDb();
        const { userId, roomId, roomName, checkin, checkout, guests, totalPrice, email, cccd, dob, hometown } = req.body;
        const available = await db.request().input('RoomName', sql.NVarChar, roomName).input('CheckIn', sql.Date, checkin).input('CheckOut', sql.Date, checkout)
            .query(`SELECT TOP 1 RoomCode FROM RoomInventory WHERE RoomName = @RoomName AND RoomCode NOT IN (SELECT RoomCode FROM DatPhong WHERE (CheckIn < @CheckOut AND CheckOut > @CheckIn) AND RoomCode IS NOT NULL)`);

        if (available.recordset.length === 0) return res.status(400).json({ message: `Hết phòng ${roomName}!` });
        const realCode = available.recordset[0].RoomCode;

        await db.request()
            .input('UserID', sql.Int, userId).input('RoomID', sql.VarChar, roomId).input('RoomName', sql.NVarChar, roomName)
            .input('CheckIn', sql.Date, checkin).input('CheckOut', sql.Date, checkout).input('Guests', sql.Int, guests)
            .input('TotalPrice', sql.NVarChar, totalPrice).input('Email', sql.VarChar, email).input('CCCD', sql.VarChar, cccd)
            .input('DOB', sql.Int, dob).input('Hometown', sql.NVarChar, hometown).input('RoomCode', sql.VarChar, realCode)
            .query(`INSERT INTO DatPhong (UserID, RoomID, RoomName, CheckIn, CheckOut, Guests, TotalPrice, Email, CCCD, DOB, Hometown, RoomCode) VALUES (@UserID, @RoomID, @RoomName, @CheckIn, @CheckOut, @Guests, @TotalPrice, @Email, @CCCD, @DOB, @Hometown, @RoomCode)`);

        res.status(200).json({ message: `Thành công! Mã: ${realCode}` });
    } catch (err) { res.status(500).json({ message: "Lỗi đặt phòng." }); }
});

// API 5: LẤY LỊCH SỬ (QUAN TRỌNG)
app.get('/my-bookings/:userId', async (req, res) => {
    try {
        const db = await getDb();
        const { userId } = req.params;
        const result = await db.request()
            .input('UserID', sql.Int, userId)
            .query(`SELECT * FROM DatPhong WHERE UserID = @UserID ORDER BY NgayDat DESC`);
        res.status(200).json(result.recordset);
    } catch (err) { res.status(500).json({ message: "Lỗi server." }); }
});

// API 6: HỦY PHÒNG
app.put('/cancel-booking/:id', async (req, res) => {
    try {
        const db = await getDb();
        const { id } = req.params;
        await db.request().input('ID', sql.Int, id).query("UPDATE DatPhong SET TrangThai = N'Đã hủy' WHERE ID = @ID");
        res.status(200).json({ message: "Đã hủy." });
    } catch (err) { res.status(500).json({ message: "Lỗi server." }); }
});

// API 7: ADMIN
app.post('/login-admin', async (req, res) => {
    try {
        const db = await getDb();
        const { username, password } = req.body;
        const result = await db.request().input('username', sql.VarChar, username).input('matkhau', sql.VarChar, password)
            .query('SELECT HoTen, MaNhanVien, ChucVu FROM NhanVien WHERE TenDangNhap = @username AND MatKhau = @matkhau');

        if (result.recordset.length > 0) {
            const nv = result.recordset[0];
            if (nv.ChucVu === 'Admin' || nv.ChucVu === 'QuanLy') res.status(200).json({ message: 'OK', nguoiDung: { ...nv, role: 'admin' } });
            else res.status(403).json({ message: 'Không quyền.' });
        } else res.status(401).json({ message: 'Sai admin.' });
    } catch (err) { res.status(500).json({ message: "Lỗi server." }); }
});

// --- CHẠY SERVER (PHẢI NẰM CUỐI CÙNG) ---
app.listen(port, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${port}`);
});