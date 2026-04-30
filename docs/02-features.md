# LinguaEdge - Đặc tả tính năng

## Triết lý thiết kế

1. **Không phá vỡ flow đọc** - mọi tương tác phải nhẹ, nhanh, có thể đóng trong < 1 giây
2. **Học bằng ngữ cảnh** - mỗi từ lưu lại đều phải kèm câu/đoạn mà người dùng đã gặp
3. **Cá nhân hóa thật** - hệ thống biết người dùng đã thuộc từ nào, chưa thuộc từ nào
4. **Dữ liệu là của người dùng** - export được, không khóa vendor

---

## Nhóm tính năng A: Dịch trên web (Translation)

### A1. Dịch từ/cụm từ khi bôi đen (Selection translate)
- Bôi đen từ/cụm → popup nhỏ hiện ngay cạnh con trỏ
- Hiển thị: nghĩa, phiên âm IPA, từ loại, nghe phát âm
- 1 click để mở rộng: ví dụ câu, từ đồng nghĩa, các nghĩa khác
- Phím tắt tùy biến (mặc định: `Alt+T`)

### A2. Hover từ đơn (Inline hover)
- Bật/tắt theo trang hoặc theo domain
- Rê chuột lên từ → tooltip mini hiện nghĩa nhanh (~150ms delay)
- Ẩn khi rê đi - không cần click

### A3. Dịch câu/đoạn (Paragraph translate)
-Bôi đen câu/đoạn → press hotkey -> dịch song song bên cạnh (split view) hoặc inline bên dưới
- Giữ HTML formatting gốc (bold, link, code)

### A4. Dịch toàn trang (Full-page translate)
- Toggle on/off
- Có chế độ "interlinear" - dịch xen kẽ từng câu, giữ song ngữ
- Có chế độ "vocab-only" - chỉ dịch những từ người dùng đã đánh dấu là chưa thuộc

### A5. Tùy chọn engine dịch
- Mặc định: Google Translate (free tier)
- Tùy chọn nâng cao: DeepL, OpenAI/Claude (BYOK - bring your own key)
- Dictionary: từ điển offline (Wiktionary dump) cho từ đơn

---

## Nhóm tính năng B: Quản lý từ vựng cá nhân

### B1. Lưu từ nhanh (Quick save)
- Trong popup dịch (A1) có nút "Save" hoặc phím `S`
- 1 click lưu kèm:
  - Từ gốc + nghĩa
  - Câu chứa từ (auto-extract)
  - URL trang nguồn + tiêu đề trang
  - Timestamp
  - Chủ đề (tự động gợi ý từ domain/tag trang, ví dụ medium.com/tech → "Tech")

### B2. Phân loại trạng thái học (Knowledge state)
Mỗi từ có 1 trong 5 trạng thái (theo mô hình LingQ-style):
- 🆕 **New** - mới gặp lần đầu
- 📖 **Learning** - đang học
- 🔁 **Reviewing** - đã thuộc cơ bản, đang ôn
- ✅ **Known** - đã thuộc
- 🚫 **Ignored** - đã biết rồi, không cần học (tên riêng, từ tiếng mẹ đẻ...)

### B3. Tô màu từ trên trang (Highlighting)
- Khi bật, các từ trong kho cá nhân sẽ tự động được tô màu trên mọi trang web theo trạng thái:
  - Vàng = New, Cam = Learning, Xanh nhạt = Reviewing, không tô = Known
- Click vào từ đã tô → popup hiện lại nghĩa + đổi trạng thái nhanh

### B4. Kho từ vựng (Vocabulary dashboard)
Trang riêng (`linguaedge://vocab` hoặc options page) gồm:
- Bảng tất cả từ đã lưu, filter theo: trạng thái, chủ đề, ngày, nguồn
- Tìm kiếm full-text
- Bulk action: đổi trạng thái nhiều từ, xóa, gắn tag
- Thống kê: số từ mỗi trạng thái, biểu đồ tiến trình theo tuần/tháng

### B5. Tổ chức theo deck/chủ đề
- Auto-deck theo nguồn (ví dụ: "BBC News", "MDN Docs")
- Manual deck do người dùng tạo (ví dụ: "IELTS Writing Task 2")
- 1 từ có thể thuộc nhiều deck

---

## Nhóm tính năng C: Ôn tập (Review/SRS)

### C1. Spaced Repetition System (SRS)
- Thuật toán SM-2 (Anki-style) hoặc FSRS (mới hơn, hiệu quả hơn)
- Mỗi sáng/chiều có notification nhắc số từ đến hạn ôn
- Review session 5-10-20 từ tùy thời gian rảnh

### C2. Các kiểu ôn tập (Review modes)
- **Flashcard**: Từ → Nghĩa, hoặc Nghĩa → Từ
- **Cloze (điền vào chỗ trống)**: dùng chính câu gốc đã lưu, che từ cần học
- **Multiple choice**: 4 đáp án, gợi ý từ những từ cùng deck
- **Listening**: Nghe phát âm → gõ lại từ
- **Context recall**: Hiện câu đầy đủ ở trang gốc → người dùng tự đánh giá đã hiểu chưa

### C3. Ôn tập trong ngữ cảnh thật (Re-encounter mode)
- Tính năng đặc trưng: khi đang lướt web, nếu trang hiện tại có chứa từ "đến hạn ôn", LinguaEdge sẽ tô đậm + hiện popup nhỏ "Bạn đã học từ này tuần trước - còn nhớ không?"
- Đây là ưu thế lớn nhất so với Anki: ôn từ trong ngữ cảnh tự nhiên

### C4. Streak & gamification (nhẹ nhàng)
- Streak ngày học liên tiếp
- Mục tiêu hàng ngày (tùy người dùng đặt: 5/10/20 từ mới mỗi ngày)
- Không có badge/level rườm rà

---

## Nhóm tính năng D: AI và nâng cao

### D1. Giải thích sâu bằng AI (BYOK)
- Khi click "Explain more" trong popup từ:
  - Giải thích nghĩa theo ngữ cảnh câu cụ thể
  - So sánh với từ đồng nghĩa
  - Đưa thêm 2-3 ví dụ ở các ngữ cảnh khác
- Người dùng tự cắm API key OpenAI/Anthropic - chi phí tự chịu, không qua server LinguaEdge

### D2. Tóm tắt bài đọc (Article summary)
- Click 1 nút để có tóm tắt tiếng Việt + danh sách 5-10 từ "đáng học" mà bài này có
- Giúp quyết định có nên đọc kỹ bài này không

### D3. Đề xuất từ nên học
- Phân tích các từ trên trang đang đọc, đối chiếu với kho cá nhân
- Highlight những từ "ngoài vùng đã biết" mà tần suất cao theo COCA/BNC frequency list
- Gợi ý: "Trang này có 12 từ mới ở mức C1, bạn muốn lưu hết không?"

### D4. Tích hợp Anki
- Export 1 chiều: kho LinguaEdge → Anki deck (.apkg)
- Sync 2 chiều (tương lai)

---

## Nhóm tính năng E: Dữ liệu và đồng bộ

### E1. Local-first
- Mặc định mọi thứ lưu trong IndexedDB của extension
- Hoạt động hoàn toàn offline (trừ tính năng dịch online)

### E2. Sync (tùy chọn)
- Đồng bộ qua tài khoản LinguaEdge (Google/Email login)
- Hoặc qua user-owned storage: Dropbox, Google Drive, WebDAV

### E3. Import/Export
- Export: JSON, CSV, Anki .apkg
- Import: từ Anki, Quizlet, CSV

---

## MVP scope (phiên bản 1.0)

Phải có:
- A1, A2, A3 (dịch select / hover / paragraph)
- B1, B2, B4 (lưu từ, trạng thái, dashboard)
- C1, C2 với 2 mode (Flashcard, Cloze)
- E1, E3 (local-first + export)

Để sau:
- A4, A5 (full-page, multi-engine)
- B3 (highlight on page) - phức tạp về DOM
- C3 (re-encounter) - đỉnh cao nhưng có thể v2
- D1-D4 (AI features)
- E2 (sync)
