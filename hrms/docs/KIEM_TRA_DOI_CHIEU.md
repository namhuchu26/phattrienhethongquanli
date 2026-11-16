# Kiểm tra đáp ứng 4 tài liệu yêu cầu

> Cập nhật sau rà soát toàn bộ: xem `KIEM_TRA_TOAN_BO.md`. Đã phát hiện thêm lỗi chặn lưu biểu mẫu từ trình duyệt; kết luận có đủ đầu mục không đồng nghĩa các chức năng đã chạy hoàn chỉnh qua giao diện.

Ngày kiểm tra: 16/11/2026. Phạm vi: mã nguồn và dữ liệu mẫu hiện có trong `hrms`, đối chiếu trực tiếp cả 4 tài liệu gốc. Đây là báo cáo kiểm tra; chưa sửa mã nghiệp vụ hoặc cập nhật bản ZIP đã bàn giao.

## Kết luận

Hệ thống đã có đủ 5 nhóm chức năng, 20 đầu mục BFD và bảng dữ liệu tương ứng 10 thực thể ERD. Các luồng thông thường có backend và lưu dữ liệu thực tế. Tuy nhiên **chưa đáp ứng hoàn toàn để kết luận nghiệm thu 100%**: còn hạn chế quan hệ quyết định 1-N khi thao tác qua ứng dụng, theo dõi quỹ phép nhiều năm và lỗi kiểm tra tính nhất quán hồ sơ/công tác.

10/10 nhóm kiểm thử hiện có vẫn đạt. Đã bổ sung kiểm tra độc lập trên cơ sở dữ liệu trong bộ nhớ và tái hiện được 4 vấn đề bên dưới. Không thay đổi cơ sở dữ liệu đang sử dụng. Các kiểm thử cũ không bao phủ các trường hợp này, nên không dùng kết quả 10/10 để khẳng định toàn bộ yêu cầu đã được đáp ứng.

## Đối chiếu từng tài liệu

| Tài liệu | Kết quả |
| --- | --- |
| BFD.jpeg | Có đủ 20 đầu mục chức năng. Theo dõi phép 4.4 và báo cáo biến động 5.2 còn hạn chế phạm vi; phần cập nhật hồ sơ/công tác còn lỗi ràng buộc. |
| DFD-MUC0.png | Có các tác nhân nghiệp vụ, 5 nhóm xử lý và 5 nhóm kho dữ liệu tương ứng. Quyền quản trị là phần bổ sung. Cần lưu ý cách nhân viên cung cấp thông tin cá nhân: hiện tại nhân sự nhập/sửa hộ, chưa có luồng nhân viên gửi đề nghị cập nhật trực tuyến. Sơ đồ không quy định bắt buộc giao diện tự sửa, nên đây là điểm cần thống nhất cách diễn giải khi trình bày. |
| ERD_QLNS_v2.drawio.pdf | Có đủ 10 bảng nghiệp vụ, các khóa ngoại chính và lịch sử gia hạn/công tác. Schema cho phép một quyết định có nhiều quá trình công tác, nhưng API/giao diện chưa cho tái sử dụng quyết định đã có. Số ngày đã nghỉ/còn lại được tính thay vì lưu cột, giữ tương đương ngữ nghĩa. |
| Nhom_16_QL_Nhan_su.pdf | Đã đối chiếu trực tiếp 3 trang DFD mức 1. Các tiến trình 1.1–5.4 có chức năng tương ứng; còn vấn đề ở cập nhật hồ sơ, công tác, theo dõi phép theo năm và độ rộng báo cáo biến động. |

## 1. Các vấn đề đã tái hiện

### P1. Chưa thao tác được quan hệ một quyết định - nhiều quá trình công tác

Nguồn: ERD, quan hệ QUYETDINH (1) - QUATRINHCONGTAC (N).

Vị trí: `server.mjs`, xử lý POST `/api/assignments` (khoảng dòng 141–147); `db.mjs`, bảng decisions/assignments.

Mỗi lần ghi công tác, API luôn tạo quyết định mới. `decisions.number` là duy nhất và không có lựa chọn quyết định có sẵn trong biểu mẫu. Khi áp dụng cùng quyết định cho hai nhân viên, lần đầu trả 201, lần thứ hai trả 409 do trùng số quyết định. Schema không cấm quan hệ 1-N, nhưng không thể thực hiện quan hệ này qua luồng ứng dụng hiện tại.

Khắc phục cần có: tách lập/chọn quyết định khỏi lập quá trình công tác; cho phép chọn `decision_id` đã có hoặc ghi nhiều nhân viên dưới cùng một quyết định; giữ kiểm tra quyền và transaction.

### P1. Quỹ phép theo năm chưa được trả và hiển thị đầy đủ

Nguồn: BFD 4.4, DFD mức 1 mục 4.4; ERD SONGAYPHEP có khóa (MaNV, Nam).

Vị trí: `server.mjs:40` và `public/app.js:81`, biểu mẫu điều chỉnh tại `public/app.js:187`.

Giao diện chỉ chọn năm hiện tại, trường năm khi điều chỉnh là chỉ đọc. API có thể ghi tổng phép cho năm khác, nhưng `/api/state` chỉ tạo danh sách năm hiện tại và năm xuất hiện trong đơn nghỉ, không lấy danh sách năm từ `leave_balances`.

Đã thử ghi 20 ngày cho NV003 năm 2028: POST `/api/balances` trả 200, cơ sở dữ liệu lưu 20, nhưng GET `/api/state` không có bản ghi phép NV003/2028 khi chưa có đơn nghỉ năm đó. Vì vậy đây không chỉ là thiếu bộ chọn năm trên giao diện.

Khắc phục cần có: đưa năm trong bảng quỹ phép vào dữ liệu trả về, bổ sung chọn năm trên giao diện và xuất CSV; đồng bộ năm khi xem hồ sơ và điều chỉnh quỹ phép.

### P2. Sửa ngày vào làm có thể làm sai quan hệ với lịch sử đã có

Nguồn: BFD/DFD 1.2 liên quan hồ sơ; ERD liên kết nhân viên với hợp đồng và công tác. Đây là lỗi tính nhất quán nghiệp vụ, không phải một chức năng mới cần thêm.

Vị trí: `server.mjs:95–101`.

Khi lập hợp đồng mới, API kiểm tra hợp đồng không trước ngày vào làm. Nhưng khi sửa hồ sơ, không kiểm tra lại hợp đồng/công tác đang có. Đã sửa ngày vào làm NV004 thành 16/11/2026 thành công (HTTP 200), trong khi hợp đồng HD004 vẫn bắt đầu 05/04/2026.

Khắc phục cần có: từ chối thay đổi ngày vào làm nếu làm cho hợp đồng/công tác/đơn nghỉ hiện có trở thành trước ngày vào làm, hoặc xây dựng quy trình sửa lịch sử có kiểm soát.

### P2. Loại biến động có thể không khớp thay đổi thực tế

Nguồn: BFD 2.3, 2.4 và 4.1; ERD LoaiBienDong, phòng ban/chức vụ cũ/mới.

Vị trí: `server.mjs:145–147`.

API chỉ kiểm tra có ít nhất một thay đổi, chưa đối chiếu loại biến động với trường thay đổi. Đã tạo bản ghi loại “Bổ nhiệm” cho NV012 thành công (201) khi chỉ đổi PB04 sang PB02, còn chức vụ vẫn CV01. Dữ liệu này làm sai phân loại lịch sử và báo cáo.

Khắc phục cần có: xác định loại từ thay đổi thực tế hoặc kiểm tra rõ Điều chuyển/Bổ nhiệm/Điều chuyển và bổ nhiệm; thống nhất liệu bổ nhiệm có được kèm chuyển phòng hay không.

## 2. Phạm vi và quy ước cần phân biệt với lỗi

### Báo cáo biến động mới tổng hợp điều chuyển/bổ nhiệm

`public/app.js:88` lấy dữ liệu từ `assignments` và hồ sơ hiện tại để hiển thị tên/phòng ban. Chưa thống kê nhân sự mới vào, ngừng làm việc/lưu trữ trong kỳ; chưa thể hiện tổng đầu kỳ/cuối kỳ, tăng/giảm.

DFD 5.2 ghi “Báo cáo biến động nhân sự” và có nguồn hồ sơ D1 cùng công tác D4, nhưng không liệt kê chỉ tiêu cụ thể. Vì vậy kết luận chính xác là **phạm vi báo cáo còn hẹp, cần thống nhất nội dung mong muốn**, không khẳng định mọi chỉ tiêu tăng/giảm đều là yêu cầu đã được ghi rõ. Nếu dùng nghĩa đầy đủ của biến động nhân sự, nên bổ sung tiếp nhận/ngừng làm việc; ngày lưu trữ không tự động đồng nghĩa với ngày nghỉ việc.

### Quyết định có hiệu lực trong tương lai chưa được hỗ trợ

API trả 400 khi ngày hiệu lực sau hôm nay. Đây là giới hạn đã ghi trong README. ERD có NgayHieuLuc nhưng các sơ đồ không nói rõ phải có lịch áp dụng tương lai; không tính giới hạn này thành một lỗi vi phạm yêu cầu tường minh. Nếu cần sử dụng thực tế, nên có quyết định chờ hiệu lực và cơ chế áp dụng theo ngày.

### Số ngày phép và chính sách phép

12 ngày/năm, tính ngày lịch và chỉ phép năm được trừ quỹ là quy ước triển khai do tài liệu chưa quy định công thức. Không có đủ cơ sở từ 4 tài liệu để khẳng định đây là chính sách doanh nghiệp chính thức. Tương tự, SoNgayToiDa của loại nghỉ đang được hiểu là tối đa mỗi đơn; tài liệu chưa xác định rõ theo đơn hay theo năm.

### Các cột phép suy ra và tên bảng tiếng Anh

`SoNgayDaNghi` và `SoNgayConLai` được tính từ đơn đã duyệt, không lưu lặp trong bảng vật lý. Cách này hợp lý nếu giải thích khi nộp bài; không xem đây là mất dữ liệu. Có thể thêm view SQL nếu giảng viên yêu cầu nhìn đủ cột như ERD. Tên bảng/cột tiếng Anh có bảng ánh xạ trong THIET_KE.md; không tự coi việc đổi tên là sai ERD.

## 3. Ma trận 20 đầu mục

“Có” dưới đây nghĩa là có mã nguồn/API/giao diện tương ứng và các luồng thông thường đã được kiểm tra ở mức phù hợp; không có nghĩa đã kiểm thử mọi tình huống.

| Mã | Yêu cầu | Đánh giá |
| --- | --- | --- |
| 1.1 | Thêm hồ sơ | Có |
| 1.2 | Cập nhật hồ sơ | Có; còn lỗi nhất quán ngày vào làm với lịch sử |
| 1.3 | Tra cứu hồ sơ | Có |
| 1.4 | Lưu trữ hồ sơ | Có; giữ lịch sử và cho khôi phục |
| 2.1 | Quản lý phòng ban | Có |
| 2.2 | Quản lý chức vụ | Có |
| 2.3 | Phân bổ nhân sự | Có; chưa dùng chung quyết định cho nhiều nhân viên |
| 2.4 | Bổ nhiệm chức vụ | Có; chưa kiểm tra loại biến động khớp dữ liệu |
| 3.1 | Lập hợp đồng | Có |
| 3.2 | Gia hạn hợp đồng | Có; lưu lịch sử từng lần |
| 3.3 | Chấm dứt hợp đồng | Có; lưu ngày và lý do |
| 3.4 | Theo dõi hết hạn | Có; cảnh báo trong 30 ngày |
| 4.1 | Ghi nhận công tác | Có; còn hạn chế quyết định 1-N và loại biến động |
| 4.2 | Đăng ký nghỉ phép | Có |
| 4.3 | Duyệt nghỉ phép | Có; giới hạn phòng, chống tự duyệt, kiểm tra quỹ |
| 4.4 | Theo dõi ngày phép | Có cho năm hiện tại; chưa đầy đủ nhiều năm |
| 5.1 | Thống kê nhân sự | Có; bảng và tổng quan phân bổ |
| 5.2 | Báo cáo biến động | Có cho điều chuyển/bổ nhiệm; phạm vi còn hẹp |
| 5.3 | Báo cáo hợp đồng | Có |
| 5.4 | Báo cáo nghỉ phép | Có |

## 4. Phương pháp và giới hạn kiểm tra

- Đọc trực tiếp BFD, DFD mức 0, trang ERD và cả 3 trang DFD mức 1. Đối chiếu với `db.mjs`, `server.mjs`, `public/app.js`, tài liệu thiết kế và README.
- Chạy lại `npm.cmd test`: 10 nhóm đạt, 0 thất bại; kiểm tra cú pháp JavaScript đạt.
- Chạy `node tmp/audit-requirements.mjs` từ thư mục gốc: dùng SQLite `:memory:` riêng, xác nhận bốn vấn đề nêu trên và giới hạn ngày hiệu lực tương lai.
- Lần kiểm tra này không thao tác lại toàn bộ giao diện bằng trình duyệt, không sửa mã nghiệp vụ, không sửa dữ liệu người dùng và không thay bản ZIP đã bàn giao.

Ưu tiên trước khi chốt bản nộp: sửa quan hệ quyết định và quỹ phép nhiều năm; bổ sung ràng buộc ngày hồ sơ và loại biến động; thống nhất phạm vi báo cáo biến động, sau đó thêm kiểm thử hồi quy và đóng gói lại.
