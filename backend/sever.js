// --- Bước 1: Import các gói đã cài đặt ---
const express = require('express'); 
const sql = require('mssql'); 
const cors = require('cors'); 

// --- Bước 2: Tạo máy chủ express ---
const app = express();
const port = 3000; 

// --- Bước 3: Cấu hình middleware ---
app.use(cors()); 
app.use(express.json()); 

// --- Bước 4: Cấu hình kết nối SQL Server ---
const dbConfig = {
    user: 'Nhom11App', 
    password: 'nhom11@123',
    server: 'localhost\\SQLEXPRESS', 
    database: 'KhachSanNhom11', 
    options: {
        encrypt: false, 
        trustServerCertificate: true, 
    }
};

// --- Bước 5: API ĐĂNG KÝ (SỬA: Thêm SoDienThoai, MatKhauCap2, dbo.) ---
app.post('/dang-ky', async (req, res) => {
    console.log('Đã nhận được yêu cầu đăng ký:', req.body);
    
    // SỬA: Lấy thêm password2
    const { name, email, sdt, password, password2 } = req.body;

    // SỬA: Thêm check password2
    if (!name || !email || !sdt || !password || !password2) {
        return res.status(400).json({ message: 'Lỗi: Vui lòng nhập đầy đủ thông tin.' });
    }

    let pool; 
    try {
        console.log('Đang kết nối đến SQL Server (dùng user Nhom11App)...');
        pool = await sql.connect(dbConfig); 
        console.log('Kết nối SQL Server thành công!');

        await pool.request()
            .input('hoTenInput', sql.NVarChar(100), name) 
            .input('emailInput', sql.NVarChar(100), email)
            .input('sdtInput', sql.NVarChar(20), sdt) 
            .input('matKhauInput', sql.NVarChar(100), password)
            // SỬA: Thêm input cho MatKhauCap2
            .input('matKhauCap2Input', sql.NVarChar(100), password2)
            .query(`
                INSERT INTO dbo.NguoiDung (HoTen, Email, SoDienThoai, MatKhau, MatKhauCap2) 
                VALUES (@hoTenInput, @emailInput, @sdtInput, @matKhauInput, @matKhauCap2Input)
            `);
        
        console.log('Đã chèn dữ liệu vào bảng dbo.NguoiDung thành công!');
        
        res.status(201).json({ message: 'Đăng ký tài khoản thành công!' });

    } catch (err) {
        console.error('Lỗi SQL Server:', err.message);
        // Bắt lỗi trùng key (Email hoặc SĐT đã tồn tại)
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

// --- Bước 6: API ĐĂNG NHẬP (SỬA: Đăng nhập bằng SĐT, dbo.) ---
app.post('/login', async (req, res) => {
    console.log('Đã nhận được yêu cầu đăng nhập:', req.body);

    // SỬA: Đổi email thành sdt
    const { sdt, password } = req.body;

    // SỬA: Cập nhật thông báo lỗi
    if (!sdt || !password) { 
        return res.status(400).json({ message: 'Vui lòng nhập Số điện thoại và Mật khẩu.' });
    }

    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            // SỬA: Đổi input từ emailInput thành sdtInput
            .input('sdtInput', sql.NVarChar(20), sdt)
            // SỬA: Thêm dbo. và tìm bằng SoDienThoai
            .query('SELECT * FROM dbo.NguoiDung WHERE SoDienThoai = @sdtInput');
        
        if (result.recordset.length === 0) {
            console.log('Lỗi: Số điện thoại không tồn tại.');
            return res.status(404).json({ message: 'Số điện thoại này không tồn tại.' });
        }

        const user = result.recordset[0];

        // SỬA: Đổi tên biến so sánh
        if (user.MatKhau !== password) {
            console.log('Lỗi: Sai mật khẩu.');
            return res.status(401).json({ message: 'Sai mật khẩu. Vui lòng thử lại.' });
        }

        console.log('Đăng nhập thành công cho user:', user.Email);
        
        // SỬA: Gửi về HoTen và Email (để chào mừng)
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

// --- Bước 7: API QUÊN MẬT KHẨU (API MỚI) ---
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
// ... (Bên dưới API /quen-mat-khau) ...

// --- API MỚI 1: LƯU ĐẶT PHÒNG ---
app.post('/dat-phong', async (req, res) => {
    console.log('Đã nhận được yêu cầu đặt phòng:', req.body);
    
    // SỬA: Lấy thêm roomName, cccd, dob, hometown
    const { 
        userId, roomId, roomName, checkin, checkout, 
        guests, totalPrice, email, cccd, dob, hometown 
    } = req.body;

    // Validate (thêm các trường mới)
    if (!userId || !roomId || !roomName || !checkin || !checkout || !guests || !cccd || !dob || !hometown) {
        return res.status(400).json({ message: 'Lỗi: Vui lòng cung cấp đầy đủ thông tin đặt phòng.' });
    }

    let pool;
    try {
        pool = await sql.connect(dbConfig);
        await pool.request()
            .input('UserID', sql.Int, userId)
            .input('RoomID', sql.NVarChar(50), roomId)
            .input('RoomName', sql.NVarChar(100), roomName) // Thêm
            .input('CheckIn', sql.Date, checkin)
            .input('CheckOut', sql.Date, checkout)
            .input('Guests', sql.Int, guests)
            .input('TotalPrice', sql.NVarChar(50), totalPrice)
            .input('Email', sql.NVarChar(100), email)
            .input('CCCD', sql.NVarChar(20), cccd)         // Thêm
            .input('DOB', sql.NVarChar(10), dob)           // Thêm
            .input('Hometown', sql.NVarChar(100), hometown) // Thêm
            .query(`
                INSERT INTO dbo.DatPhong 
                    (UserID, RoomID, RoomName, CheckIn, CheckOut, Guests, TotalPrice, Email, CCCD, DOB, Hometown)
                VALUES 
                    (@UserID, @RoomID, @RoomName, @CheckIn, @CheckOut, @Guests, @TotalPrice, @Email, @CCCD, @DOB, @Hometown)
            `);
        
        console.log('Lưu đặt phòng vào SQL Server thành công!');
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

// --- Bước 8: Khởi động máy chủ ---
app.listen(port, () => {
    console.log(`Backend API đang chạy tại http://localhost:${port}`);
    console.log('Đang chờ yêu cầu từ trang web...');
}).on('error', (err) => { 
    console.error('\n!!! MÁY CHỦ CRASH VÌ LỖI SAU:');
    throw err; 
});

