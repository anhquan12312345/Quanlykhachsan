// --- Bước 1: Import các gói đã cài đặt ---
const express = require('express'); 
const sql = require('mssql'); 
const cors = require('cors'); 
require('dotenv').config();

// --- Bước 2: Tạo máy chủ express ---
const app = express();
const port = 3000; 

// --- Bước 3: Cấu hình middleware ---
app.use(cors()); 
app.use(express.json()); 

// --- Bước 4: Cấu hình kết nối SQL Server ---
const dbConfig = {
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER, 
    database: process.env.DB_NAME, 
    options: {
        encrypt: false, 
        trustServerCertificate: true, 
    }
};

// --- Bước 5: API ĐĂNG KÝ (Không đổi) ---
app.post('/dang-ky', async (req, res) => {
    console.log('Đã nhận được yêu cầu đăng ký:', req.body);
    
    const { name, email, sdt, password, password2 } = req.body;

    if (!name || !email || !sdt || !password || !password2) {
        return res.status(400).json({ message: 'Lỗi: Vui lòng nhập đầy đủ thông tin.' });
    }

    let pool; 
    try {
        console.log('Đang kết nối đến SQL Server...');
        pool = await sql.connect(dbConfig); 
        console.log('Kết nối SQL Server thành công!');

        await pool.request()
            .input('hoTenInput', sql.NVarChar(100), name) 
            .input('emailInput', sql.NVarChar(100), email)
            .input('sdtInput', sql.NVarChar(20), sdt) 
            .input('matKhauInput', sql.NVarChar(100), password)
            .input('matKhauCap2Input', sql.NVarChar(100), password2)
            .query(`
                INSERT INTO dbo.NguoiDung (HoTen, Email, SoDienThoai, MatKhau, MatKhauCap2) 
                VALUES (@hoTenInput, @emailInput, @sdtInput, @matKhauInput, @matKhauCap2Input)
            `);
        
        console.log('Đã chèn dữ liệu vào bảng dbo.NguoiDung thành công!');
        
        res.status(201).json({ message: 'Đăng ký tài khoản thành công!' });

    } catch (err) {
        console.error('Lỗi SQL Server:', err.message);
        if (err.number === 2627 || err.number === 2601) {
            return res.status(409).json({ message: 'Email hoặc Số điện thoại này đã tồn tại.' });
        }
        res.status(500).json({ message: 'Lỗi máy chủ: Không thể đăng ký tài khoản.', error: err.message });
    
    } finally {
        if (pool) {
            pool.close();
            console.log('Đã đóng kết nối SQL.');
        }
    }
});

// --- Bước 6: API ĐĂNG NHẬP (Không đổi) ---
app.post('/login', async (req, res) => {
    console.log('Đã nhận được yêu cầu đăng nhập:', req.body);

    const { sdt, password } = req.body;

    if (!sdt || !password) { 
        return res.status(400).json({ message: 'Vui lòng nhập Số điện thoại và Mật khẩu.' });
    }

    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('sdtInput', sql.NVarChar(20), sdt)
            .query('SELECT * FROM dbo.NguoiDung WHERE SoDienThoai = @sdtInput');
        
        if (result.recordset.length === 0) {
            console.log('Lỗi: Số điện thoại không tồn tại.');
            return res.status(404).json({ message: 'Số điện thoại này không tồn tại.' });
        }

        const user = result.recordset[0];

        if (user.MatKhau !== password) {
            console.log('Lỗi: Sai mật khẩu.');
            return res.status(401).json({ message: 'Sai mật khẩu. Vui lòng thử lại.' });
        }

        console.log('Đăng nhập thành công cho user:', user.Email);
        
        res.status(200).json({
            message: 'Đăng nhập thành công!',
            nguoiDung: {
                id: user.ID,
                hoTen: user.HoTen,
                email: user.Email,
                sdt: user.SoDienThoai
            }
        });

    } catch (err) {
        console.error('Lỗi SQL Server khi đăng nhập:', err.message);
        res.status(500).json({ message: 'Lỗi máy chủ: Không thể xử lý đăng nhập.', error: err.message });
    } finally {
        if (pool) {
            pool.close();
            console.log('Đã đóng kết nối SQL.');
        }
    }
});

// --- Bước 7: API QUÊN MẬT KHẨU (Không đổi) ---
app.post('/quen-mat-khau', async (req, res) => {
    console.log('Đã nhận được yêu cầu quên mật khẩu:', req.body);
    const { sdt, password2 } = req.body;

    if (!sdt || !password2) {
        return res.status(400).json({ message: 'Vui lòng nhập SĐT và Mật khẩu cấp 2.' });
    }

    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .input('sdtInput', sql.NVarChar(20), sdt)
            .input('matKhauCap2Input', sql.NVarChar(100), password2)
            .query('SELECT MatKhau FROM dbo.NguoiDung WHERE SoDienThoai = @sdtInput AND MatKhauCap2 = @matKhauCap2Input');
        
        if (result.recordset.length === 0) {
            console.log('Lỗi: SĐT hoặc Mật khẩu cấp 2 không đúng.');
            return res.status(404).json({ message: 'Số điện thoại hoặc Mật khẩu cấp 2 không đúng.' });
        }

        // Lấy mật khẩu cấp 1
        const matKhauCap1 = result.recordset[0].MatKhau;

        console.log('Khôi phục mật khẩu thành công cho SĐT:', sdt);
        
        // Trả về mật khẩu cấp 1
        res.status(200).json({
            message: 'Khôi phục thành công!',
            matKhau: matKhauCap1
        });

    } catch (err) {
        console.error('Lỗi SQL Server khi quên mật khẩu:', err.message);
        res.status(500).json({ message: 'Lỗi máy chủ: Không thể xử lý yêu cầu.', error: err.message });
    } finally {
        if (pool) {
            pool.close();
            console.log('Đã đóng kết nối SQL.');
        }
    }
});

// --- API ĐẶT PHÒNG (SỬ DỤNG TÊN CỘT KHÔNG DẤU) ---
app.post('/dat-phong', async (req, res) => {
    const { userId, roomId, roomName, checkin, checkout, guests, totalPrice, email, cccd, dob, hometown } = req.body;

    if (!userId || !roomId || !roomName || !checkin || !checkout || !guests || !cccd || !dob || !hometown) {
        return res.status(400).json({ message: 'Lỗi: Vui lòng cung cấp đầy đủ thông tin đặt phòng.' });
    }

    let pool;
    let selectedRoomCode = null;

    try {
        pool = await sql.connect(dbConfig);

        // 1. KIỂM TRA PHÒNG CÒN TRỐNG và CHỌN ROOMCODE
        const availableCodeResult = await pool.request()
            .input('RoomID', sql.NVarChar(50), roomId)
            .query(`
    SELECT TOP 1 RI.RoomCode 
    FROM dbo.RoomInventory RI
    LEFT JOIN dbo.DatPhong DP ON RI.RoomCode = DP.RoomCode AND DP.[Trạng thái] IN (N'Mới', N'Đã xác nhận')
    WHERE RI.RoomID = @RoomID AND DP.RoomCode IS NULL
    ORDER BY RI.RoomCode ASC;
`);

        if (availableCodeResult.recordset.length === 0) {
            return res.status(409).json({ message: `Xin lỗi, ${roomName} đã hết phòng.` });
        }
        
        selectedRoomCode = availableCodeResult.recordset[0].RoomCode;

        // 2. CHÈN ĐƠN HÀNG VÀO DATABASE
        await pool.request()
            .input('UserID', sql.Int, userId)
            .input('RoomID', sql.NVarChar(50), roomId)
            .input('RoomCode', sql.NVarChar(10), selectedRoomCode)
            .input('RoomName', sql.NVarChar(100), roomName)
            .input('CheckIn', sql.Date, checkin)
            .input('CheckOut', sql.Date, checkout)
            .input('Guests', sql.Int, guests)
            .input('TotalPrice', sql.NVarChar(50), totalPrice)
            .input('Email', sql.NVarChar(100), email)
            .input('CCCD', sql.NVarChar(20), cccd)
            .input('DOB', sql.NVarChar(10), dob)
            .input('Hometown', sql.NVarChar(100), hometown)
            .query(`
                INSERT INTO dbo.DatPhong 
        (UserID, RoomID, RoomCode, RoomName, CheckIn, CheckOut, Guests, TotalPrice, Email, CCCD, DOB, Hometown, NgayDat, [Trạng thái])
    VALUES 
        (@UserID, @RoomID, @RoomCode, @RoomName, @CheckIn, @CheckOut, @Guests, @TotalPrice, @Email, @CCCD, @DOB, @Hometown, GETDATE(), N'Mới')
`);
        
        res.status(201).json({ message: 'Đặt phòng thành công!' });

    } catch (err) {
        console.error('Lỗi SQL Server khi đặt phòng:', err.message);
        res.status(500).json({ message: 'Lỗi máy chủ: Không thể xử lý đặt phòng.', error: err.message });
    } finally {
        if (pool) pool.close();
    }
});

// --- API MỚI 2: LẤY TẤT CẢ ĐẶT PHÒNG (CHO QUẢN LÝ) ---
app.get('/get-all-bookings', async (req, res) => {
    console.log('Đã nhận được yêu cầu lấy tất cả booking');
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`
                SELECT 
                    dp.*, 
                    nd.HoTen AS TenNguoiDat 
                FROM 
                    dbo.DatPhong dp
                JOIN 
                    dbo.NguoiDung nd ON dp.UserID = nd.ID
                ORDER BY 
                    dp.NgayDat DESC 
            `);

        console.log(`Đã truy vấn được ${result.recordset.length} booking.`);
        res.status(200).json(result.recordset); // Trả về mảng dữ liệu

    } catch (err) {
        console.error('Lỗi SQL Server khi lấy bookings:', err.message);
        res.status(500).json({ message: 'Lỗi máy chủ: Không thể lấy dữ liệu.', error: err.message });
    } finally {
        if (pool) pool.close();
    }
});

// --- API MỚI 3: LẤY LỊCH SỬ ĐẶT PHÒNG CỦA CÁ NHÂN (SỬ DỤNG TÊN CỘT KHÔNG DẤU) ---
app.get('/my-bookings/:userId', async (req, res) => {
    const { userId } = req.params;
    console.log(`Đã nhận được yêu cầu lấy booking cho UserID: ${userId}`);

    if (!userId) {
        return res.status(400).json({ message: 'Lỗi: Thiếu UserID.' });
    }

    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
          .query(`
    SELECT 
        ID, 
        RoomID, 
        RoomName, 
        CheckIn, 
        CheckOut, 
        Guests, 
        TotalPrice, 
        CCCD, 
        NgayDat,
        [Trạng thái] AS TrangThai  -- <--- SỬA CHỖ NÀY
    FROM 
        dbo.DatPhong 
    WHERE 
        UserID = @UserID 
    ORDER BY 
        NgayDat DESC 
`)
        
        console.log(`Đã tìm thấy ${result.recordset.length} booking cho user này.`);
        res.status(200).json(result.recordset);

    } catch (err) {
        console.error('Lỗi SQL Server khi lấy my-bookings:', err.message);
        res.status(500).json({ message: 'Lỗi máy chủ: Không thể lấy dữ liệu.', error: err.message });
    } finally {
        if (pool) pool.close();
    }
});

// --- API HỦY ĐẶT PHÒNG (SỬ DỤNG TÊN CỘT KHÔNG DẤU) ---
app.put('/cancel-booking/:bookingId', async (req, res) => {
    const { bookingId } = req.params;
    console.log(`Đã nhận được yêu cầu HỦY booking ID: ${bookingId}`);

    let pool;
    try {
        pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('BookingID', sql.Int, bookingId)
            .input('TrangThaiMoi', sql.NVarChar, 'Đã hủy')
            .query(`
                UPDATE dbo.DatPhong
                SET [Trạng thái] = @TrangThaiMoi
                WHERE ID = @BookingID
            `);
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Không tìm thấy đơn đặt phòng để hủy.' });
        }

        console.log(`Booking ID ${bookingId} đã được hủy thành công.`);
        res.status(200).json({ message: 'Đơn đặt phòng đã được hủy thành công.' });

    } catch (err) {
        console.error('Lỗi SQL Server khi hủy booking:', err.message);
        res.status(500).json({ message: 'Lỗi máy chủ: Không thể hủy đơn đặt phòng.', error: err.message });
    } finally {
        if (pool) pool.close();
    }
});

// --- Bước 8: Khởi động máy chủ ---
app.listen(port, () => {
    console.log(`Backend API đang chạy tại http://localhost:${port}`);
    console.log('Đang chờ yêu cầu từ trang web...');
}).on('error', (err) => { 
    console.error('\n!!! MÁY CHỦ CRASH VÌ LỖI SAU:');
    throw err; 
});