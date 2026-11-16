# Các lỗi đã sửa

- Nhận diện form bằng getAttribute để trường id không chặn gửi biểu mẫu.
- Trả cả năm có quỹ phép trong API và thêm bộ chọn năm trên trang nghỉ phép.
- Dùng lại số quyết định có sẵn khi toàn bộ thông tin quyết định khớp; mỗi nhân viên tạo một lịch sử tham chiếu chung quyết định. Điền cùng số, loại, ngày ký/hiệu lực, người ký và nội dung để sử dụng chung.
- Kiểm tra loại biến động khớp thay đổi thực tế.
- Chặn sửa ngày vào làm sau hợp đồng/công tác/đơn nghỉ đã có.
- Chỉ khôi phục nhân viên đã lưu trữ.
- Chặn ngày chấm dứt sau ngày hết hạn hợp đồng.
- Chỉnh ngày nộp đơn lịch sử trong dữ liệu mẫu mới.

Chưa bổ sung lịch áp dụng quyết định tương lai, thống kê tăng/giảm nhân sự và kiểm tra toàn bộ bản in/mobile. Dữ liệu SQLite đã tồn tại không tự sửa lại ngày trong mẫu cũ. Các báo cáo kiểm tra trước phản ánh phiên bản trước sửa.
