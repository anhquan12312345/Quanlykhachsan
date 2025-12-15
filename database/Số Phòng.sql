-- Lấy tất cả các loại phòng từ KHO (Inventory)
SELECT 
    RI.RoomID, 
    RI.RoomName,
    
    -- Đếm tổng số phòng vật lý (101, 102, 103...)
    COUNT(DISTINCT RI.RoomCode) AS TongSoPhong,
    
    -- Đếm số phòng vật lý ĐANG BẬN (bất kể ngày nào)
    COUNT(DISTINCT DP.RoomCode) AS SoPhongDangBan
    
FROM 
    dbo.RoomInventory RI
    
-- Nối với bảng Đặt phòng, nhưng CHỈ lấy các đơn đang hoạt động
LEFT JOIN 
    dbo.DatPhong DP ON RI.RoomCode = DP.RoomCode 
                   AND DP.[Trạng thái] IN (N'Mới', N'Đã xác nhận')
GROUP BY 
    RI.RoomID, RI.RoomName;