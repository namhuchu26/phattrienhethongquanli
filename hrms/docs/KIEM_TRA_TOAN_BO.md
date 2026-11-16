# Rà soát toàn bộ hệ thống - 16/11/2026

## Kết luận hiện tại

**Chưa đủ điều kiện chốt bản nộp là đã hoạt động hoàn chỉnh.** Có đủ cấu trúc 5 nhóm nghiệp vụ và các màn hình, nhưng phát hiện lỗi chặn lưu biểu mẫu từ trình duyệt cùng các lỗi/giới hạn dữ liệu bên dưới. Nhận định trước đây rằng đã hoàn thành dựa trên 10 kiểm thử API là chưa đủ: kiểm thử API không thực thi đoạn gửi biểu mẫu của giao diện.

Báo cáo này bổ sung và thay thế kết luận tổng quát trong `KIEM_TRA_DOI_CHIEU.md`. Đã kiểm tra mã nguồn, các luồng API, thao tác lưu thực tế trên Chrome, cơ sở dữ liệu đang dùng ở chế độ chỉ đọc, lược đồ, tài liệu chạy và nội dung ZIP. Không sửa mã ứng dụng, dữ liệu đang dùng hoặc ZIP trong lượt rà soát này.

## 1. Lỗi cần ưu tiên cao nhất: biểu mẫu không lưu

**Mức độ: chặn chức năng.**

Vị trí: `public/app.js`, bộ xử lý `document.addEventListener('submit', ...)`, khoảng dòng 194–201; các hàm tạo biểu mẫu có `<input name="id">`.

Đoạn xử lý so sánh `f.id` với chuỗi `modal-form`. Đối với các biểu mẫu có control tên `id`, truy cập `f.id` bị control này che thuộc tính định danh của form; điều kiện `if(f.id!=='modal-form')return` làm xử lý thoát trước khi gọi API. Nút được bật lại trong `finally`, không có thông báo lỗi.

Đã tái hiện trực tiếp trên Chrome, máy chủ riêng `127.0.0.1:3005`, SQLite trong bộ nhớ:

1. Đăng nhập admin, mở Phòng ban & chức vụ > Chức vụ > Thêm chức vụ.
2. Nhập mã `CV_AUDIT`, tên `Chức vụ kiểm tra giao diện`, cấp bậc 2.
3. Nhấn Lưu thông tin. Biểu mẫu vẫn mở, không báo lỗi và không có thông báo thành công.
4. Kiểm tra API của chính máy chủ thử nghiệm: vẫn 5 chức vụ, không có `CV_AUDIT`, không có nhật ký tạo đối tượng này.

**Phạm vi cùng nguyên nhân qua đọc mã:** thêm/sửa nhân viên; thêm/sửa phòng ban/chức vụ; lập hợp đồng; gia hạn/chấm dứt hợp đồng; duyệt/từ chối đơn nghỉ. Những biểu mẫu này đều chứa trường `name="id"` và đi qua bộ xử lý chung. Tái hiện tương tác thực tế trong lượt này dùng chức vụ; không tuyên bố đã bấm thử riêng mọi biểu mẫu.

Hướng sửa: dùng `f.getAttribute('id')`, `f.matches(...)` hoặc nhận diện form bằng `dataset`; tránh dựa vào thuộc tính bị control trùng tên che. Bổ sung kiểm thử xuyên suốt trình duyệt cho ít nhất một luồng tạo mới và duyệt đơn, kiểm tra dữ liệu thực sự thay đổi.

## 2. Lỗi và điểm thiếu đã tái hiện ở API

Tất cả thử ghi bên dưới chạy trên SQLite `:memory:` riêng, không sửa dữ liệu thật.

| Mức ưu tiên | Vấn đề | Bằng chứng | Vị trí / hướng sửa |
| --- | --- | --- | --- |
| Cao | Chưa dùng một quyết định cho nhiều nhân viên theo quan hệ ERD 1–N | Nhân viên thứ nhất tạo được (201); người thứ hai cùng số quyết định lỗi 409 | `server.mjs:141`: cho chọn quyết định hiện có hoặc tạo nhiều quá trình công tác chung quyết định |
| Cao | Quỹ phép nhiều năm không được đọc/hiển thị đầy đủ | Ghi NV003 năm 2028 tổng 20 ngày trả 200, DB có 20 nhưng `/api/state` không trả năm đó khi chưa có đơn nghỉ | `server.mjs:40`, `public/app.js:81,187`: lấy cả năm từ bảng quỹ phép, thêm bộ chọn năm |
| Vừa | Ngày vào làm sửa được thành sau hợp đồng hiện có | NV004 đổi ngày vào làm thành 16/11/2026 trả 200 trong khi HD004 bắt đầu 05/04/2026 | `server.mjs:95–101`: kiểm tra lịch sử liên quan trước khi cập nhật |
| Vừa | Loại biến động không khớp thay đổi | “Bổ nhiệm” được chấp nhận khi chỉ đổi PB04 sang PB02, chức vụ vẫn CV01 | `server.mjs:145`: suy ra loại từ thay đổi hoặc xác thực quy tắc tương ứng |
| Vừa | Khôi phục có thể đổi trạng thái nhân viên chưa lưu trữ | Gọi `/api/employees/NV011/restore` với hồ sơ Thử việc trả 200 và đổi thành Đang làm việc | `server.mjs:112`: chỉ cho khôi phục hồ sơ Đã lưu trữ; cân nhắc giữ trạng thái trước lưu trữ |

Hai vấn đề thêm về lịch sử hợp đồng cần thống nhất quy tắc rồi siết ràng buộc:

- Hợp đồng hết hạn 06/11/2026 vẫn cho ghi ngày chấm dứt 16/11/2026 (200). Nếu “chấm dứt” là ngày kết thúc hiệu lực thực tế, ngày này không nên vượt hạn kết thúc; nếu là ngày hoàn tất thủ tục thì cần trường/nhãn riêng.
- Sau khi chấm dứt, hợp đồng cũ bị loại hoàn toàn khỏi kiểm tra giao thời gian. Có thể lập thêm hợp đồng có khoảng thời gian trùng với giai đoạn hiệu lực lịch sử của hợp đồng đã chấm dứt (201). README hiện chỉ cam kết không trùng hợp đồng chưa chấm dứt, nên đây là giới hạn quy tắc đã chọn, không khẳng định là yêu cầu tường minh trong 4 sơ đồ. Nếu cần lịch sử hợp đồng nhất quán, so sánh cả khoảng hiệu lực thực tế đến ngày chấm dứt.

## 3. Dữ liệu mẫu

Đơn `NP004` có ngày nộp và ngày duyệt 16/11/2026 nhưng nghỉ từ 06/11 đến 07/11/2026. Mẫu này không thể tạo qua API hiện tại vì API cấm đăng ký nghỉ quá khứ. Nên chỉnh ngày nộp/duyệt mẫu phù hợp hoặc ghi rõ đây là dữ liệu lịch sử nhập bổ sung. Đây là vấn đề tính nhất quán dữ liệu minh họa, không làm hỏng SQLite.

Không có bộ phận nào tự động áp dụng quyết định có hiệu lực tương lai. Việc chặn ngày tương lai đang được ghi rõ trong README; là giới hạn của bản hiện tại.

## 4. Những phần kiểm tra đạt

- 10/10 nhóm kiểm thử tích hợp hiện có đạt khi chạy trong thư mục `hrms`.
- Giải nén bản `BAN_NOP_QLNS.zip` vào `tmp/zip-audit-20261116` và chạy lại bộ kiểm thử từ bản giải nén: 10/10 đạt.
- JavaScript `server.mjs`, `db.mjs`, `public/app.js` qua kiểm tra cú pháp.
- Phiên đăng nhập, đăng xuất, khóa tài khoản và đổi mật khẩu được kiểm tra ở API; mật khẩu lưu bằng scrypt, phiên cookie HttpOnly/SameSite.
- Kiểm tra bổ sung tài khoản nhân viên đối với lưu trữ, khôi phục, chấm dứt hợp đồng, công tác, quỹ phép và khóa tài khoản: cả 6 yêu cầu trả 403 như mong đợi.
- Bộ kiểm thử cũ xác nhận giới hạn dữ liệu của nhân viên/trưởng phòng, che mức lương đồng nghiệp, chặn tự duyệt và duyệt ngoài phòng, kiểm tra số ngày phép khi phê duyệt, ngăn duyệt hai lần.
- Kiểm tra nguồn yêu cầu, khóa ngoại, danh mục đang được sử dụng, không phục vụ trực tiếp file cơ sở dữ liệu qua HTTP đã có kiểm thử đạt. Đây là các kiểm tra cụ thể, không phải chứng nhận toàn bộ bảo mật.
- DB đang dùng được mở **chỉ đọc**: `integrity_check=ok`, `foreign_key_check` không có lỗi; tại thời điểm kiểm tra có 12 nhân viên, 12 hợp đồng, 4 đơn nghỉ.
- Backend khởi động được ở localhost bằng Node.js 24. File `.bat` trỏ đúng thư mục `hrms`, kiểm tra phiên bản Node và gọi `server.mjs`; lần này rà mã script, không chạy nhấp đúp lại file `.bat`.
- ZIP có 18 mục; hash của từng file trong ZIP trùng file tương ứng ở workspace; không chứa SQLite/phiên đăng nhập. ZIP chưa chứa các báo cáo rà soát được tạo sau bàn giao. Mã nguồn trong ZIP do đó **cũng còn các lỗi ứng dụng vừa tìm thấy**.

## 5. Báo cáo, xuất dữ liệu và giao diện

- Có đủ màn hình tổng quan, nhân viên, phòng ban/chức vụ, hợp đồng, công tác, nghỉ phép, báo cáo và quản trị.
- 4 loại báo cáo và lọc ngày/phòng ban có trong mã. Báo cáo biến động hiện chỉ liệt kê điều chuyển/bổ nhiệm; chưa có tổng tăng/giảm, tiếp nhận/ngừng làm việc. Tài liệu gốc không chốt danh sách chỉ tiêu, nên cần thống nhất phạm vi này.
- CSV có BOM UTF-8, escape dấu ngoặc kép và xử lý ký tự khởi đầu công thức; lượt này kiểm tra mã, chưa thử mở tất cả loại CSV bằng Excel.
- In báo cáo dùng `window.print()` và CSS in. Chưa kiểm tra đầy đủ ngắt trang hoặc bản PDF in từ từng báo cáo.
- Các bộ lọc tìm tên/mã/email, phân trang và breakpoint di động có mã triển khai. Chưa xác minh mọi kích thước màn hình/mobile; không kết luận tất cả giao diện đã đạt chỉ vì desktop mở được.
- Tên người duyệt có thể chỉ hiện mã nhân viên khi người duyệt không nằm trong tập hồ sơ được phép xem, vì giao diện tra tên từ `S.employees`. Đây là hạn chế trình bày cần cân nhắc bổ sung tên người duyệt tối thiểu từ API mà không lộ toàn bộ hồ sơ.
- Quy tắc 12 ngày/năm, tính theo ngày lịch, tối đa mỗi đơn của loại nghỉ và báo cáo theo phòng hiện tại là các giả định đã ghi trong README; 4 file không quy định đủ để xác nhận chúng là chính sách chính thức.

## 6. Đối chiếu yêu cầu và mức độ sẵn sàng

Bốn tài liệu đã được đối chiếu ở `KIEM_TRA_DOI_CHIEU.md`: có đủ đầu mục chức năng và 10 bảng nghiệp vụ, nhưng hiện tại chỉ có thể nói **đã triển khai cấu trúc và nhiều luồng API**, chưa thể nói 20 chức năng đã hoạt động đầy đủ từ giao diện. Lỗi gửi biểu mẫu làm thay đổi đáng kể kết luận nghiệm thu trước.

Ưu tiên hoàn thiện:

1. Sửa nhận diện form và thử lưu thật trên trình duyệt cho hồ sơ, danh mục, hợp đồng, phê duyệt nghỉ phép.
2. Hoàn thiện quyết định dùng chung và quỹ phép nhiều năm.
3. Siết cập nhật ngày vào làm, loại công tác, trạng thái khôi phục; thống nhất lịch sử hợp đồng.
4. Chỉnh dữ liệu mẫu, xác định chỉ tiêu báo cáo biến động và kiểm tra xuất/in, giao diện di động.
5. Thêm kiểm thử hồi quy cho các lỗi đã phát hiện, cập nhật hướng dẫn rồi đóng gói bản nộp mới.

## 7. Tái chạy kiểm tra

Từ thư mục gốc:

```powershell
node --test hrms/tests/api.test.mjs
node tmp/audit-requirements.mjs
node tmp/audit-extra.mjs
```

Hai script audit dùng cơ sở dữ liệu trong bộ nhớ; script bổ sung ghi kết quả vào `tmp/audit-extra-results.json`. Những script này ghi nhận hành vi hiện tại để phục vụ rà soát, không phải bộ kiểm thử hồi quy xác nhận ứng dụng đã được sửa.
