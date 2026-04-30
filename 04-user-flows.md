# LinguaEdge - User Flows chính

## Flow 1: Người dùng mới cài extension

```
1. Cài từ Edge Add-ons store
   ↓
2. Onboarding popup tự mở (welcome.html)
   - Chọn ngôn ngữ mẹ đẻ (mặc định: Vietnamese)
   - Chọn trình độ tiếng Anh (A1/A2/B1/B2/C1/C2)
     → Dùng để filter từ "đáng học" sau này
   - Chọn engine dịch mặc định (Google free)
   - Bật/tắt hover translate
   ↓
3. Demo nhanh trên trang sample
   - "Hãy bôi đen từ này thử" (interactive)
   - "Click Save - đã có 1 từ trong kho"
   - "Mở dashboard xem"
   ↓
4. Done - extension sẵn sàng
```

**Mục tiêu**: Onboarding < 60 giây, người dùng phải hiểu 3 hành động cốt lõi: bôi đen-dịch, lưu, ôn.

---

## Flow 2: Đọc bài + lưu từ (use case chính)

```
User đang đọc bài blog tiếng Anh trên Medium
   ↓
Gặp từ "ubiquitous" không biết
   ↓
Bôi đen từ → popup hiện ngay (< 200ms)
   ┌────────────────────────────────┐
   │ ubiquitous /juːˈbɪkwɪtəs/ adj  │
   │ phổ biến, có mặt khắp nơi      │
   │                                │
   │ "AI is now ubiquitous in..."   │
   │ ─── (câu gốc highlight) ───    │
   │                                │
   │ [🔊 Nghe] [💾 Lưu (S)] [...]  │
   └────────────────────────────────┘
   ↓
User nhấn S (hoặc click Save)
   ↓
Toast nhỏ: "Đã lưu vào deck 'Medium' • 47 từ"
   ↓
User tiếp tục đọc, từ "ubiquitous" giờ có gạch chân vàng
trên trang (vì đang ở trạng thái "new")
```

**Yêu cầu UX**:
- Popup không che mất từ gốc
- Đóng được bằng `Esc` hoặc click ra ngoài
- Không gây re-flow trang (tuyệt đối tránh)
- Phím tắt `S` chỉ active khi popup đang mở

---

## Flow 3: Ôn tập từ vựng

```
9:00 sáng - notification: "Bạn có 12 từ đến hạn ôn tập"
   ↓
User click notification → mở dashboard tab Review
   ↓
Chọn mode: Flashcard / Cloze / Mixed
   ↓
Bắt đầu session (mặc định 10-20 cards)
   
   ┌─────────────────────────────────┐
   │ Cloze mode                       │
   │                                  │
   │ "She is a ______ student who     │
   │  always finishes homework."      │
   │                                  │
   │ Nguồn: bbc.com/learning - 3 ngày │
   │                                  │
   │ [Hiện đáp án]                    │
   └─────────────────────────────────┘
   ↓
Hiện đáp án: "diligent"
   ↓
User tự đánh giá: [Quên] [Khó] [Tốt] [Dễ]
   ↓
SRS tính lại interval
   ↓
Card tiếp theo
   ...
   ↓
Hết session: thống kê (8 đúng / 2 sai / 12 từ)
```

---

## Flow 4: Tính năng đặc trưng - Re-encounter trong đời thực

Đây là tính năng "killer" của LinguaEdge:

```
User học từ "ubiquitous" tuần trước (state: learning)
   ↓
Hôm nay tình cờ đọc bài khác trên Hacker News
   ↓
Bài có chứa "ubiquitous"
   ↓
LinguaEdge phát hiện → tô đậm + icon nhỏ ở mép phải
   ↓
Popup nhẹ hiện 1 giây: "💡 Đã gặp 5 ngày trước - còn nhớ?"
   ↓
User click → mini quiz inline (không rời trang):
   "ubiquitous = ?"
   [phổ biến khắp nơi] [hiếm gặp] [đắt đỏ] [tinh vi]
   ↓
User chọn đúng → SRS update, từ chuyển sang "reviewing"
User chọn sai → từ vẫn ở "learning", interval reset
   ↓
User tiếp tục đọc - mất tổng cộng 3 giây
```

**Tại sao quan trọng**:
- Học từ trong context tự nhiên (não nhớ tốt hơn 3-5 lần)
- Không cần dành riêng giờ "ôn tập"
- Người dùng cảm thấy việc đọc web đã là học

---

## Flow 5: Dịch toàn bài

```
User mở 1 bài research paper (PDF render trong trình duyệt)
   ↓
Click icon LinguaEdge ở thanh address → menu
   ↓
"Dịch toàn trang" → chọn chế độ:
   - Side-by-side (hiện tiếng Việt cột bên phải)
   - Interlinear (xen kẽ tiếng Anh / tiếng Việt từng đoạn)
   - Vocab-only (chỉ dịch từ chưa thuộc)
   ↓
LinguaEdge dịch theo viewport, lazy load
   ↓
User vẫn có thể bôi đen từ tiếng Anh để lưu vào kho
như bình thường
```

---

## Flow 6: Quản lý kho từ vựng

Dashboard chính (`chrome-extension://.../dashboard.html`):

```
┌──────────────────────────────────────────────────────────┐
│ LinguaEdge Dashboard                                      │
│ ┌─────────┬──────┬──────┬──────────┬────────────┐       │
│ │ Vocab   │ Decks│ Review│ Stats   │ Settings   │       │
│ └─────────┴──────┴──────┴──────────┴────────────┘       │
│                                                           │
│ Filter: [State ▾] [Deck ▾] [Source ▾] [🔍 Search...]   │
│                                                           │
│ ┌────────┬──────────────────┬────────────┬──────┬─────┐ │
│ │ Word   │ Meaning          │ State      │ Deck │ ... │ │
│ ├────────┼──────────────────┼────────────┼──────┼─────┤ │
│ │ diligent│ siêng năng      │ Learning   │ News │ ... │ │
│ │ ubiquitous│ phổ biến      │ New        │ Tech │ ... │ │
│ │ ...                                                  │ │
│ └────────┴──────────────────┴────────────┴──────┴─────┘ │
│                                                           │
│ Bulk: [Đổi trạng thái] [Thêm vào deck] [Xuất Anki]      │
└──────────────────────────────────────────────────────────┘
```

Tính năng dashboard:
- Click vào từ → modal xem chi tiết, lịch sử các lần gặp, các câu đã save
- Sort theo: thời gian gặp gần nhất, frequency, alphabet
- Heatmap "ngày học" giống GitHub contribution

---

## Flow 7: Export sang Anki

```
Dashboard → Settings → Import/Export
   ↓
"Export to Anki"
   ↓
Chọn deck cần xuất (có thể chọn nhiều / tất cả)
   ↓
Chọn template card:
   - Basic: Front=word, Back=meaning + sentence
   - Cloze: Front=câu có blank, Back=câu đầy đủ
   ↓
Download .apkg file
   ↓
User import vào Anki desktop/mobile
```
