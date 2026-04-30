# LinguaEdge

> Extension trình duyệt biến mọi trang web tiếng Anh thành phòng học cá nhân: dịch ngữ cảnh, lưu từ vựng, ôn tập bằng spaced repetition - tất cả trong một workflow liền mạch.

## Tài liệu

| File | Nội dung |
|------|----------|
| [01-overview.md](01-overview.md) | Tên, định vị, vấn đề, đối tượng người dùng, so sánh đối thủ |
| [02-features.md](02-features.md) | Chi tiết 5 nhóm tính năng (A-E) và scope MVP |
| [03-architecture.md](03-architecture.md) | Kiến trúc kỹ thuật, schema dữ liệu, stack đề xuất |
| [04-user-flows.md](04-user-flows.md) | 7 user flow chính kèm wireframe text |
| [05-roadmap.md](05-roadmap.md) | Lộ trình 5 phase, business model, marketing |

## Tóm tắt nhanh

**Tên**: LinguaEdge

**Pitch 1 câu**: Đọc → Dịch → Lưu → Ôn, không rời trang.

**3 differentiator**:
1. **Re-encounter mode** - tự động hỏi lại từ đã học khi gặp trên web
2. **Local-first, open data** - export Anki, không lock-in
3. **Highlight on page** - thấy ngay từ nào mình đã biết / chưa biết

**MVP scope**: Selection translate + Hover + Save với context + Dashboard + SRS Flashcard/Cloze + Export.

**Stack**: Manifest V3, TypeScript, React, Vite, Dexie (IndexedDB), Tailwind.

**Mô hình**: Free cốt lõi + Pro tier $3-5/tháng cho sync và AI.

## Bước tiếp theo đề xuất

1. Khảo sát 20-30 user tiềm năng để xác minh pain point
2. Kiểm tra trademark "LinguaEdge" - nếu có vấn đề chuyển sang phương án dự phòng (`WordHive`, `Vocabby`)
3. Mock-up Figma cho popup dịch và dashboard (3-5 màn hình chính)
4. Prototype technical: thử popup translate < 200ms với Google Translate free
5. Quyết định về Re-encounter mode: có vào MVP hay để phase 3?
