# LinguaEdge - Roadmap & Business

## Roadmap phát hành

### Phase 0: Validation (2-3 tuần)
- [ ] Khảo sát 20-30 người học tiếng Anh trong network (Google Form)
- [ ] Phỏng vấn sâu 5 người về workflow đọc/học hiện tại
- [ ] Landing page đăng ký waitlist
- [ ] Logo + brand cơ bản

### Phase 1: MVP (8-10 tuần)
**Mục tiêu**: Extension dùng được, ra mắt closed beta cho ~50 người

Scope:
- A1 Selection translate (Google Translate engine)
- A2 Hover translate
- B1 Quick save
- B2 Knowledge state (5 trạng thái)
- B4 Vocabulary dashboard (CRUD đơn giản)
- C1 SRS thuật toán SM-2
- C2 Flashcard mode + Cloze mode
- E1 Local storage
- E3 Export JSON/CSV
- Onboarding flow

Stack: TypeScript, React, Vite, Dexie, Tailwind

### Phase 2: Public beta (4-6 tuần sau MVP)
**Mục tiêu**: Publish lên Edge Add-ons store + Chrome Web Store

Scope:
- A3 Paragraph translate
- B3 Highlight on page (CSS Custom Highlight API)
- B5 Decks (auto + manual)
- C2 thêm Multiple choice + Listening modes
- D4 Anki export (.apkg)
- Polish UX, fix bugs từ closed beta

### Phase 3: Differentiation (6-8 tuần)
**Mục tiêu**: Tính năng độc đáo, tăng retention

Scope:
- **C3 Re-encounter mode** (tính năng killer)
- A4 Full-page translate (3 chế độ)
- A5 Multi-engine (DeepL, BYOK LLM)
- D2 Article summary
- D3 Đề xuất từ nên học

### Phase 4: Sync & Mobile (3-4 tháng)
- E2 Sync backend (Cloudflare Workers + D1)
- Tài khoản, magic link auth
- Web app companion (review trên mobile browser)
- Firefox extension

### Phase 5: AI deep features (mở)
- D1 AI explanation (BYOK)
- Conversation practice với từ đã học
- Tích hợp với Reading apps khác (Pocket, Readwise)

---

## Mô hình kinh doanh

### Free tier (mãi mãi)
- Tất cả tính năng cốt lõi: dịch, lưu, SRS
- Local storage không giới hạn từ
- Export Anki, JSON, CSV
- 1 device

### Pro tier ($3-5/tháng hoặc $25-40/năm)
- Sync nhiều thiết bị
- AI features (LinguaEdge subsidize, không cần BYOK)
- Article summary không giới hạn
- Re-encounter mode (giữ free? hoặc đẩy lên Pro?)
- Theme tùy biến
- Ưu tiên support

### Educational tier
- Free 1 năm cho học sinh/sinh viên (verify qua email .edu hoặc thẻ sinh viên)
- Lifetime deal cho đợt early adopter (~$50 one-time)

### Tại sao mô hình này khả thi
- Cốt lõi free → dễ viral, dễ chia sẻ
- Pro nhắm người dùng đa thiết bị (laptop + phone) - segment chịu chi
- AI features có chi phí thực, paid hợp lý
- Tránh ad-based - giữ trải nghiệm sạch

---

## Cạnh tranh và định vị

### Thị trường
- Mate Translate: ~$30/năm, dịch tốt nhưng học yếu
- Toucan: free, gamified, dịch ngẫu nhiên (không user-driven)
- LingQ: $13/tháng, ecosystem đóng, đắt
- Reverso Context: free, nhiều ví dụ nhưng không có SRS
- Anki: free, mạnh về SRS, không tích hợp web

### Chỗ đứng của LinguaEdge
> *"Toucan dễ dùng nhưng không nghiêm túc. Anki nghiêm túc nhưng không tiện. LingQ làm cả hai nhưng đóng và đắt. LinguaEdge muốn là Anki + Toucan: tiện khi đọc, nghiêm túc khi ôn, mở dữ liệu, giá phải chăng."*

### Lợi thế cạnh tranh có thể bảo vệ
1. **Re-encounter feature** (C3) - chưa có ai làm tốt
2. **Local-first + open data** - người dùng tin tưởng, switch cost thấp = ít rời bỏ vì... không cần phải bị giam
3. **Tập trung vào người Việt học tiếng Anh** ban đầu - hiểu pain point rất rõ
4. **Build in public** - cộng đồng dev đông trên Twitter/LinkedIn quan tâm

---

## Rủi ro và mitigation

| Rủi ro | Khả năng | Tác động | Cách giảm thiểu |
|--------|----------|----------|----------------|
| Google Translate đổi/giới hạn API free | Cao | Cao | Chuẩn bị sẵn DeepL, MyMemory, Wiktionary offline |
| Manifest V3 limitations với content script | Trung | Trung | Đã build trên V3 từ đầu, theo dõi Chrome roadmap |
| Performance trên trang nặng (Twitter, FB) | Trung | Cao | Test sớm, opt-out cho domain lớn |
| Người dùng không biết feature → không dùng | Cao | Cao | Onboarding tốt, in-app discovery, blog posts |
| Trademark "Edge" của Microsoft | Thấp | Cao | Tham vấn luật sư trước khi launch, có plan B name |
| Anki cộng đồng phản đối "fragmenting" | Thấp | Thấp | Vị thế là complement, có Anki export |

---

## Metrics theo dõi

### Activation
- % user lưu từ đầu tiên trong 24h sau cài
- % user hoàn thành review session đầu tiên trong tuần đầu

### Engagement
- DAU/MAU ratio
- Số từ lưu trung bình / user / tuần
- Số review session / user / tuần
- Re-encounter trigger rate (số lần feature C3 hoạt động)

### Retention
- D7, D30, D90 retention
- Churn của Pro tier

### Quality
- App store rating
- NPS qua in-app survey sau 30 ngày dùng
- Bug report rate

---

## Phát hành & Marketing

### Pre-launch
- Build in public trên Twitter/X + LinkedIn (Vietnamese tech community)
- Bài viết trên Viblo, dev.to về quá trình build
- Demo video TikTok/YouTube Shorts (2-3 phút)

### Launch
- Edge Add-ons + Chrome Web Store
- Product Hunt
- Hacker News (Show HN)
- Reddit: r/languagelearning, r/EnglishLearning, r/Anki
- Cộng đồng VN: Group "Học tiếng Anh", forum tinhte, Voz Anh ngữ

### Post-launch retention
- Email newsletter hàng tuần: tip học, từ vựng theo chủ đề
- Blog: case study người dùng, so sánh phương pháp học
- Tích hợp với newsletter platforms (Substack reader integration)
