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