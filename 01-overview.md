# LinguaEdge - Tổng quan ý tưởng

## Tên đề xuất

**LinguaEdge** (chính)

Lý do chọn tên:
- "Lingua" (Latin) = ngôn ngữ - rõ ràng về chức năng
- "Edge" = vừa là tên trình duyệt Microsoft Edge, vừa mang nghĩa "lợi thế cạnh tranh"
- Ngắn gọn, dễ nhớ, dễ phát âm cho cả người Việt lẫn quốc tế
- Có thể mở rộng sang Chrome/Firefox về sau mà vẫn giữ được tên thương hiệu

### Các tên thay thế

| Tên | Ý nghĩa | Điểm mạnh | Điểm yếu |
|-----|---------|-----------|----------|
| **LinguaEdge** | Ngôn ngữ + Edge/lợi thế | Dễ nhớ, đa nghĩa | Cần kiểm tra trademark |
| **WordHive** | Tổ ong từ vựng | Gợi hình ảnh thu thập, lưu trữ | Hơi chung chung |
| **Vocabby** | Vocabulary + buddy | Thân thiện, gần gũi | Hơi trẻ con |
| **TranslateLearn** | Mô tả trực tiếp | Rõ chức năng | Không có cá tính |
| **PolyRead** | Polyglot + Read | Gợi đa ngôn ngữ | Khó phát âm |
| **WebLingo** | Web + Lingo | Đơn giản | Trùng nhiều sản phẩm |
| **MyLexicon** | Từ điển cá nhân | Học thuật | Hơi formal |
| **LearnAsYouRead** | Học khi đọc | Mô tả đúng concept | Quá dài |

## Một câu định nghĩa sản phẩm

> *LinguaEdge là extension trình duyệt biến mọi trang web tiếng Anh thành phòng học cá nhân: dịch ngữ cảnh, lưu từ vựng, và ôn tập bằng spaced repetition - tất cả trong một workflow liền mạch.*

## Vấn đề đang giải quyết

Người học tiếng Anh ở Việt Nam (và các nước non-native) khi đọc tài liệu trên web hiện đang:

1. **Phải dùng nhiều công cụ rời rạc**: Google Translate cho dịch nghĩa, Anki cho ôn từ, Notion/Excel để lưu từ vựng → ngắt mạch đọc
2. **Mất context khi học từ**: học từ qua flashcard không nhớ nó xuất hiện trong câu/bài nào, lĩnh vực nào
3. **Không có hệ thống ôn tập**: lưu từ rồi để đó, không quay lại review → quên
4. **Dịch toàn trang làm mất trải nghiệm đọc gốc**: Google Translate full-page khiến không còn tiếp xúc với tiếng Anh thật
5. **Không cá nhân hóa**: cùng một từ "diligent" có người biết rồi, có người chưa - các app từ vựng đại trà không phân biệt được

## Đối tượng người dùng chính

### Persona 1: Sinh viên/người đi làm tự học
- Đọc tài liệu chuyên ngành, blog, news bằng tiếng Anh hàng ngày
- Có nền tảng B1-B2, muốn lên C1
- Không có thời gian cho khóa học có lịch cố định
- **Pain**: Đọc xong quên hết từ mới gặp

### Persona 2: Lập trình viên/researcher
- Đọc docs kỹ thuật, paper, Stack Overflow
- Trình độ đọc hiểu ổn nhưng vốn từ chuyên ngành hẹp
- Cần dịch nhanh không phá flow code/đọc
- **Pain**: Translate tab khác làm mất context

### Persona 3: Học sinh THPT/luyện thi IELTS-TOEFL
- Cần xây vốn từ học thuật
- Đã quen Anki/Quizlet
- **Pain**: Phải gõ tay vào flashcard thủ công

## Khác biệt so với các giải pháp hiện có

| Công cụ hiện có | Hạn chế | Cách LinguaEdge giải quyết |
|-----------------|---------|----------------------------|
| Google Translate Extension | Chỉ dịch, không lưu, không học | Dịch + lưu + ôn trong cùng flow |
| Mate Translate | Có lưu nhưng UX không tối ưu cho học | Tích hợp SRS, gắn với context gốc |
| Anki | Phải tự nhập từ thủ công | Tự động capture khi đọc web |
| Toucan | Dịch ngẫu nhiên trên trang | Thiếu kho cá nhân + ôn tập có cấu trúc |
| LingQ | Đắt, ecosystem đóng | Miễn phí cốt lõi, mở dữ liệu |
