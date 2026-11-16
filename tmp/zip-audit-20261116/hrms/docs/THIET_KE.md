# Thiết kế và đối chiếu yêu cầu

## 1. Nguồn yêu cầu

Đã đọc cả bốn file ở thư mục gốc:

1. `BFD.jpeg`: 5 nhóm chức năng, mỗi nhóm 4 chức năng con.
2. `DFD-MUC0.png`: tác nhân Nhân viên, Cán bộ nhân sự, Trưởng phòng, Ban giám đốc; luồng hồ sơ, danh mục, hợp đồng, công tác/nghỉ phép và báo cáo.
3. `ERD_QLNS_v2.drawio.pdf`: 10 thực thể và các quan hệ lịch sử.
4. `Nhom_16_QL_Nhan_su.pdf`: 3 trang DFD mức 1 cho đầy đủ nhóm 1.0 đến 5.0. PDF này chứa hình; đã đọc bằng các trang render, không dựa vào trích xuất văn bản trống.

Không có dự án mã nguồn trước đó trong thư mục. Đã chọn Node.js + SQLite + HTML/CSS/JavaScript để chạy trực tiếp trên máy và dễ bàn giao, theo lựa chọn người dùng tự chọn công nghệ và chỉ chạy tại máy để học/nộp bài.

## 2. Đối chiếu BFD/DFD với chức năng

| Mã | Yêu cầu | Triển khai |
| --- | --- | --- |
| 1.1 | Thêm hồ sơ mới | Hồ sơ nhân viên > Thêm nhân viên; POST /api/employees |
| 1.2 | Cập nhật hồ sơ | Hồ sơ > Sửa; PUT /api/employees/:id |
| 1.3 | Tra cứu hồ sơ | Tìm tên/mã/email, phòng ban, trạng thái; xem Chi tiết |
| 1.4 | Lưu trữ hồ sơ | Chi tiết hồ sơ > Lưu trữ; tab Đã lưu trữ và Khôi phục |
| 2.1 | Quản lý phòng ban | Danh mục phòng ban: thêm/sửa/xóa, xem nhân viên |
| 2.2 | Quản lý chức vụ | Danh mục chức vụ: thêm/sửa/xóa và cấp bậc |
| 2.3 | Phân bổ nhân sự | Công tác > Ghi nhận công tác > Điều chuyển; lưu đơn vị cũ/mới |
| 2.4 | Bổ nhiệm chức vụ | Công tác > Bổ nhiệm; lưu quyết định và chức vụ cũ/mới |
| 3.1 | Lập hợp đồng | Hợp đồng > Lập hợp đồng; kiểm tra ngày, lương, trùng thời gian |
| 3.2 | Gia hạn hợp đồng | Chi tiết hợp đồng > Gia hạn; bảng lịch sử extensions |
| 3.3 | Chấm dứt hợp đồng | Chi tiết > Chấm dứt; lưu ngày và lý do |
| 3.4 | Theo dõi hết hạn | Tổng quan, tab Sắp hết hạn, trạng thái hiệu lực/hết hạn |
| 4.1 | Ghi nhận công tác | Lịch sử công tác + quyết định; transaction cập nhật hồ sơ |
| 4.2 | Đăng ký nghỉ phép | Nộp đơn theo nhân viên và loại nghỉ |
| 4.3 | Duyệt nghỉ phép | Trưởng phòng duyệt trong phòng, quản trị xử lý toàn bộ; từ chối có lý do |
| 4.4 | Theo dõi ngày phép | Tab Quỹ phép theo năm, tính số đã dùng/còn lại từ đơn duyệt |
| 5.1 | Thống kê nhân sự | Báo cáo > Thống kê nhân sự; tổng quan và biểu đồ phân bổ |
| 5.2 | Báo cáo biến động | Báo cáo > Biến động nhân sự |
| 5.3 | Báo cáo hợp đồng | Báo cáo > Báo cáo hợp đồng |
| 5.4 | Báo cáo nghỉ phép | Báo cáo > Báo cáo nghỉ phép |

Các báo cáo hỗ trợ lọc, CSV và in. D1 ở DFD tương ứng employees; D2 là departments/positions; D3 là contracts/extensions; D4 là assignments/decisions; D5 là leave_requests/leave_types/leave_balances.

## 3. Kiến trúc

```text
Trình duyệt (HTML/CSS/JS)
       | HTTP JSON + cookie phiên
       v
server.mjs
  Xác thực -> Phân quyền -> Kiểm tra dữ liệu -> Nghiệp vụ
       | truy vấn tham số hóa / transaction
       v
db.mjs -> SQLite trên máy (data/hrms.sqlite)
```

`GET /api/state` trả dữ liệu đã được giới hạn phạm vi ở máy chủ. Giao diện tạo biểu đồ/báo cáo từ dữ liệu đó. Nhân viên chỉ nhận dữ liệu của mình. Trưởng phòng chỉ nhận nhân viên trong phòng, và mức lương người khác bị trả `null` trước khi đến trình duyệt. Mỗi thao tác ghi kiểm tra quyền độc lập.

## 4. Ánh xạ ERD

| Thực thể ERD | Bảng SQLite | Khóa / quan hệ |
| --- | --- | --- |
| PHONGBAN | departments | id = MaPB |
| CHUCVU | positions | id = MaCV |
| NHANVIEN | employees | id = MaNV; department_id, position_id |
| HOPDONG | contracts | id = MaHD; employee_id |
| GIAHANHOPDONG | extensions | id = MaGH; contract_id; unique(contract_id, sequence) |
| QUYETDINH | decisions | id = MaQD; number = SoQD duy nhất |
| QUATRINHCONGTAC | assignments | employee_id, decision_id, 2 khóa phòng ban và 2 khóa chức vụ cũ/mới |
| LOAINGHIPHEP | leave_types | id = MaLoai; max_days = SoNgayToiDa |
| DONNGHIPHEP | leave_requests | employee_id, type_id, approver_id; ngày, số ngày, trạng thái |
| SONGAYPHEP | leave_balances | khóa kép(employee_id, year); total = TongSoNgayPhep |

`SoNgayDaNghi` và `SoNgayConLai` trong ERD được tính khi đọc dữ liệu: tổng ngày đơn Phép năm đã duyệt theo nhân viên/năm, và `total - used`. Không lưu lặp các giá trị suy ra để tránh lệch khi duyệt lại hoặc sửa tổng phép. Trừ phép và kiểm tra quỹ phép nằm trong transaction.

Thêm 3 bảng hỗ trợ: `users` (vai trò và mật khẩu băm), `sessions` (mã phiên đã băm, hạn dùng), `audit_log` (nhật ký). Bật ràng buộc khóa ngoại và WAL. Danh mục có liên kết lịch sử không được xóa. Hồ sơ nhân viên dùng lưu trữ mềm.

Xem schema đầy đủ tại `schema.sql`. Tái xuất schema từ mã hiện tại:

```powershell
node scripts/export-schema.mjs
```

## 5. API chính

Mọi thao tác ghi dùng JSON. Ngoại trừ đăng nhập, API cần cookie phiên. POST/PUT/DELETE kiểm tra Origin khi trình duyệt gửi Origin.

| Phương thức | Đường dẫn | Mô tả |
| --- | --- | --- |
| POST | /api/login | Đăng nhập |
| GET | /api/state | Dữ liệu được giới hạn theo quyền |
| POST | /api/logout | Đăng xuất |
| POST | /api/password | Đổi mật khẩu, kết thúc mọi phiên của tài khoản |
| POST | /api/employees | Thêm hồ sơ |
| PUT | /api/employees/:id | Cập nhật hồ sơ |
| POST | /api/employees/:id/archive | Lưu trữ |
| POST | /api/employees/:id/restore | Khôi phục |
| POST / PUT / DELETE | /api/departments[/:id] | Danh mục phòng ban |
| POST / PUT / DELETE | /api/positions[/:id] | Danh mục chức vụ |
| POST | /api/contracts | Lập hợp đồng |
| POST | /api/contracts/:id/extend | Gia hạn |
| POST | /api/contracts/:id/terminate | Chấm dứt |
| POST | /api/assignments | Tạo quyết định + lịch sử + cập nhật hồ sơ |
| POST | /api/leaves | Nộp đơn |
| POST | /api/leaves/:id/review | Duyệt hoặc từ chối |
| POST | /api/leaves/:id/cancel | Hủy đơn chờ duyệt |
| POST | /api/balances | Điều chỉnh tổng quỹ phép |
| POST | /api/users | Tạo tài khoản |
| POST | /api/users/:id/toggle | Khóa hoặc mở khóa |

Mã lỗi: 400 dữ liệu/nghiệp vụ không hợp lệ; 401 chưa đăng nhập; 403 không có quyền; 404 không tồn tại; 409 trùng/ràng buộc tham chiếu; 415 không phải JSON; 429 quá nhiều lần đăng nhập sai. Tài nguyên tĩnh chỉ được phục vụ từ danh sách cho phép, không phục vụ file mã nguồn hoặc cơ sở dữ liệu.

## 6. Kịch bản trình diễn

1. Đăng nhập `admin`. Chỉ ra 12 nhân viên, 6 phòng ban, 2 hợp đồng sắp hết hạn và 3 đơn chờ duyệt.
2. Vào Hồ sơ nhân viên, tìm `NV003`, xem hồ sơ, hợp đồng và số ngày phép.
3. Lập một hồ sơ mới và hợp đồng; thử nhập email trùng hoặc ngày kết thúc sai để thấy kiểm tra dữ liệu.
4. Vào Công tác, ghi điều chuyển/bổ nhiệm cho hồ sơ vừa tạo với số quyết định duy nhất. Xem hồ sơ đã đổi phòng/chức vụ và lịch sử vẫn giữ thông tin cũ.
5. Vào hợp đồng `HD003`, gia hạn với ngày mới sau ngày kết thúc cũ. Mở lại để xem lịch sử gia hạn.
6. Đăng xuất rồi vào `truongphong`. Chỉ thấy phòng Công nghệ; lương nhân viên khác bị hạn chế. Duyệt đơn của NV003, mở tab Quỹ phép để kiểm tra số còn lại giảm.
7. Vào `nhanvien`. Chỉ có hồ sơ và dữ liệu của NV003. Nộp một đơn vào ngày không trùng, xem trạng thái Chờ duyệt; có thể hủy khi chưa xử lý.
8. Vào `giamdoc`, mở 4 loại báo cáo, thử lọc khoảng thời gian/phòng ban, tải CSV và in.
9. Vào `admin`, xem nhật ký và tạo/khóa tài khoản nếu cần trình diễn quyền truy cập.

Thao tác demo thật sẽ lưu vào cơ sở dữ liệu. Có thể sao lưu trước khi trình diễn theo README.
