# PeopleOps - Hệ thống quản lý nhân sự nhóm 16

Ứng dụng web tiếng Việt chạy tại máy, được xây dựng từ cả bốn tài liệu trong thư mục cha: sơ đồ BFD, DFD mức 0, ERD và ba trang DFD mức 1. Có backend, cơ sở dữ liệu SQLite, đăng nhập và phân quyền thực hiện tại máy chủ.

## Chạy nhanh

Máy cần **Node.js 24 trở lên**. Máy hiện tại đã có Node.js 24.20.0. Không cần cài thư viện, MySQL hay chạy `npm install`. Sau khi có Node.js, ứng dụng chạy ngoại tuyến; không tải font, ảnh hoặc mã từ CDN.

**Cách 1:** nhấp đúp `CHAY_HE_THONG.bat` trong thư mục cha, giữ cửa sổ máy chủ mở và truy cập **http://127.0.0.1:3000**.

**Cách 2:** mở Terminal tại thư mục `hrms`:

```powershell
npm.cmd start
```

Hoặc:

```powershell
node server.mjs
```

Dừng bằng `Ctrl+C`. Dữ liệu vẫn được giữ lại khi mở lại ứng dụng. Nếu cổng 3000 đã được sử dụng:

```powershell
$env:PORT = '3001'
npm.cmd start
```

Sau đó mở http://127.0.0.1:3001. Mặc định máy chủ chỉ lắng nghe trên máy hiện tại (`127.0.0.1`).

## Tài khoản mẫu

Khi thêm nhân viên mới, hệ thống tự tạo tài khoản vai trò Nhân viên trong cùng giao dịch. Tên đăng nhập là email nhân viên, chuẩn hóa thành chữ thường; mật khẩu ban đầu được sinh ngẫu nhiên và chỉ hiển thị sau khi tạo thành công. Lưu lại để giao cho nhân viên. Sửa hồ sơ không thay đổi tài khoản/mật khẩu. Hồ sơ đã tồn tại trước cập nhật không được tự tạo thêm tài khoản.

Mật khẩu chung ban đầu: **`Demo@12345`**.

| Tên đăng nhập | Vai trò | Nhân viên liên kết |
| --- | --- | --- |
| `admin` | Quản trị viên | NV001 - Nguyễn Minh Anh |
| `nhansu` | Cán bộ nhân sự | NV009 - Nguyễn Khánh Vy |
| `truongphong` | Trưởng phòng Công nghệ | NV002 - Trần Quốc Bảo |
| `nhanvien` | Nhân viên | NV003 - Lê Hoàng Nam |
| `giamdoc` | Ban giám đốc | NV010 - Trần Hải Đăng |

Trên trang đăng nhập, chọn nút vai trò để điền tài khoản mẫu rồi nhấn **Đăng nhập**. Các nút chỉ điền giá trị ban đầu; nếu đổi mật khẩu, phải nhập mật khẩu mới. Có thể đổi mật khẩu ở mục Quản trị hệ thống/Tài khoản của tôi.

## Chức năng đã thực hiện

| Nhóm nghiệp vụ | Chức năng |
| --- | --- |
| Tổng quan | Thống kê nhân sự, phân bổ phòng ban, nhân viên mới trong tháng, cảnh báo hợp đồng kết thúc trong 30 ngày, đơn nghỉ phép chờ duyệt |
| Hồ sơ nhân viên | Thêm, sửa, tra cứu theo tên/mã/email, lọc phòng ban/trạng thái, phân trang, xem hồ sơ kèm hợp đồng và lịch sử công tác, lưu trữ và khôi phục |
| Phòng ban & chức vụ | Thêm, sửa, xóa danh mục chưa được sử dụng; xem thành viên phòng ban và số nhân viên theo chức vụ |
| Hợp đồng | Lập hợp đồng, kiểm tra trùng thời hạn, gia hạn có lịch sử, chấm dứt có lý do, trạng thái hiệu lực/hết hạn/chưa hiệu lực, danh sách sắp hết hạn |
| Công tác | Điều chuyển, bổ nhiệm, lưu quyết định, lưu đơn vị/chức vụ cũ và mới, cập nhật hồ sơ trong cùng giao dịch |
| Nghỉ phép | Nộp đơn, kiểm tra trùng lịch, hủy đơn chờ duyệt, duyệt/từ chối có ghi chú, giới hạn phạm vi trưởng phòng, chống tự duyệt, trừ phép năm sau duyệt, điều chỉnh quỹ phép |
| Báo cáo | Thống kê nhân sự, biến động, hợp đồng, nghỉ phép; lọc thời gian/phòng ban, xuất CSV UTF-8 mở bằng Excel, in hoặc lưu PDF bằng hộp thoại in của trình duyệt |
| Quản trị | Tạo tài khoản, khóa/mở khóa, đổi mật khẩu, hết hạn phiên, nhật ký hoạt động |

## Phân quyền

| Vai trò | Phạm vi và quyền chính |
| --- | --- |
| Quản trị | Toàn bộ dữ liệu, nghiệp vụ, duyệt nghỉ phép và quản trị tài khoản; không tự duyệt đơn của mình |
| Nhân sự | Toàn bộ hồ sơ, danh mục, hợp đồng, công tác, tạo/hủy đơn và quỹ phép; xem báo cáo; không duyệt đơn hoặc quản trị tài khoản |
| Trưởng phòng | Chỉ xem nhân viên trong phòng của mình; chỉ xem lương của bản thân; nộp đơn cho bản thân và duyệt đơn nhân viên trong phòng; không tự duyệt |
| Nhân viên | Chỉ xem hồ sơ, hợp đồng, công tác, đơn nghỉ và quỹ phép của bản thân; nộp/hủy đơn của mình |
| Giám đốc | Xem dữ liệu và báo cáo toàn tổ chức, ghi nhận quyết định công tác; không sửa hồ sơ/hợp đồng, duyệt nghỉ phép hoặc quản trị tài khoản |

Quyền được kiểm tra tại API. Việc sửa nút trên trình duyệt không vượt qua phân quyền.

## Quy ước nghiệp vụ của bản nộp bài

Tài liệu không nêu chi tiết cách tính ngày phép và chính sách doanh nghiệp, nên bản này dùng các quy ước được hiển thị trong giao diện:

- Ngày nghỉ là **ngày lịch**, tính cả ngày đầu và ngày cuối; chưa tích hợp lịch ngày lễ/ca làm việc. Quỹ phép năm mặc định 12 ngày, có thể điều chỉnh theo nhân viên/năm. Đây là quy ước mô phỏng cho bài tập.
- Chỉ đơn loại **Phép năm** đã duyệt mới tiêu hao quỹ phép; số đã nghỉ/còn lại được tính từ đơn đã duyệt, không cho trừ lần hai. Nghỉ ốm, việc riêng và không hưởng lương không trừ quỹ phép năm.
- Đơn qua năm cần tách thành hai đơn. Không đăng ký ngày nghỉ trong quá khứ. Khi phê duyệt, máy chủ kiểm tra lại quỹ phép.
- Quyết định công tác được áp dụng ngay khi lưu và phải có hiệu lực không sau hôm nay; chưa có tác vụ tự áp dụng quyết định trong tương lai. Không cho ghi biến động trước biến động gần nhất.
- Khi sửa hồ sơ, phòng ban/chức vụ chỉ đọc; thay đổi phải đi qua chức năng Công tác để giữ lịch sử và quyết định.
- Hợp đồng chưa chấm dứt không được trùng thời gian của cùng nhân viên. Gia hạn giữ nguyên mức lương và lưu từng lần thay đổi ngày kết thúc. Chấm dứt ghi ngày không sau hôm nay.
- Chỉ lưu trữ nhân viên khi không còn hợp đồng hiện hành/tương lai và đơn chờ duyệt. Lưu trữ giữ toàn bộ lịch sử và chặn đăng nhập của tài khoản liên kết. Khôi phục giữ lại danh mục và lịch sử trước đó.
- Báo cáo lọc phòng ban theo **phòng ban hiện tại**; báo cáo thời gian lần lượt dựa vào ngày vào làm/ngày hiệu lực/ngày bắt đầu hợp đồng/ngày bắt đầu nghỉ.
- Không có mô-đun chấm công hoặc tính lương; bốn tài liệu chỉ yêu cầu mức lương trong hợp đồng.

## Dữ liệu và sao lưu

- Dữ liệu nằm ở `data/hrms.sqlite`, tự tạo khi chạy lần đầu với 12 nhân viên minh họa, 6 phòng ban, 5 chức vụ, hợp đồng, đơn phép và lịch sử công tác.
- Mọi tên, email, số điện thoại, mức lương mẫu là dữ liệu minh họa, không lấy từ hồ sơ nhân sự thật.
- Để sao lưu: dừng máy chủ bằng `Ctrl+C`, sau đó sao chép cả thư mục `data` đến nơi lưu trữ. Để phục hồi: dừng máy chủ và thay bằng bản sao lưu.
- Để bắt đầu lại dữ liệu minh họa mà giữ bản cũ: dừng máy chủ, đổi tên thư mục `data` thành `data-cu`, rồi chạy lại. Ứng dụng tạo `data` mới.
- Bản đóng gói mã nguồn không chứa cơ sở dữ liệu hoặc phiên đăng nhập. Máy nhận tự tạo dữ liệu mẫu khi chạy lần đầu.

## Kiểm thử

Chạy trong `hrms`:

```powershell
npm.cmd test
```

10 nhóm kiểm thử tích hợp dùng cơ sở dữ liệu tạm riêng, không chỉnh dữ liệu đang trình diễn. Kiểm thử gồm xác thực/nguồn yêu cầu, phân quyền và giới hạn lương, hồ sơ và danh mục, vòng đời hợp đồng, giao dịch quyết định công tác, mã hợp đồng chứa ký tự đặc biệt, nghỉ phép/quỹ phép, tài khoản/phiên đăng nhập, lưu bền/ràng buộc dữ liệu, phục vụ tài nguyên và chặn truy cập file cơ sở dữ liệu.

Đã kiểm tra thủ công trang đăng nhập, tổng quan, danh sách hồ sơ, biểu mẫu thêm hồ sơ và trang báo cáo trên Chrome. Phần kiểm tra API bao phủ các luồng ghi dữ liệu và phân quyền. Chưa có bộ kiểm thử tự động giao diện trên mọi kích thước màn hình.

## Cấu trúc mã nguồn

```text
hrms/
  server.mjs             HTTP server, API, xác thực và phân quyền
  db.mjs                 Schema, transaction, mật khẩu, dữ liệu mẫu
  public/
    index.html           Khung trang
    app.js               Giao diện, biểu mẫu, bộ lọc, báo cáo, CSV
    styles.css           Bố cục desktop/mobile và chế độ in
  tests/api.test.mjs      Kiểm thử tích hợp
  scripts/export-schema.mjs
  docs/THIET_KE.md        Đối chiếu tài liệu, ERD và mô tả API
  docs/schema.sql        Lược đồ SQLite để xem/nộp bài
  data/                  Dữ liệu chạy tại máy, không đóng gói
```

Backend dùng HTTP và SQLite tích hợp sẵn của Node.js; truy vấn tham số hóa, mật khẩu scrypt với salt, cookie phiên HttpOnly/SameSite, giới hạn lần đăng nhập sai, nhật ký thao tác. Phiên 8 giờ. Dữ liệu mẫu và cấu hình hiện tại được thiết kế cho bài tập chạy tại máy; nếu chuyển sang triển khai công khai cần cấu hình HTTPS, tài khoản thật và chính sách tổ chức.
