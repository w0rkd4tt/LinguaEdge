# LinguaEdge — extension

Browser extension cho Edge / Chrome / Brave (Manifest V3): bôi đen → dịch → lưu → ôn, không
rời trang.

## Cấu trúc

```
extension/
├─ src/
│  ├─ background/        # service worker (translate, messaging, alarms)
│  ├─ content/           # content script + Shadow-DOM popup
│  ├─ popup/             # toolbar popup (React)
│  ├─ dashboard/         # full-page dashboard SPA (React)
│  ├─ welcome/           # onboarding 4-bước
│  └─ common/            # types, Dexie DB, SRS (SM-2), translate engine
├─ public/icons/         # PNG icon (do scripts/gen-icons.py sinh ra)
├─ dashboard.html        # entry cho dashboard
├─ welcome.html          # entry cho onboarding
├─ vite.config.ts
├─ tsconfig.json
└─ package.json
```

## Cài đặt và build

Cần Node.js ≥ 18.

```bash
cd extension
npm install
npm run build       # → dist/
npm run dev         # rebuild khi đổi file (hỗ trợ HMR cho dashboard/popup)
```

Nếu muốn regenerate icons:

```bash
python3 scripts/gen-icons.py
```

## Nạp extension vào Edge / Chrome

1. Mở `edge://extensions` (hoặc `chrome://extensions`).
2. Bật **Developer mode**.
3. **Load unpacked** → chọn thư mục `extension/dist/`.
4. Lần cài đầu tiên sẽ tự mở trang welcome — thiết lập 4 bước.

## Tính năng MVP đã có

- **A1** Selection translate: bôi đen từ/cụm → popup hiện cạnh con trỏ với phiên âm, từ loại,
  nhiều nghĩa, nút lưu, nút phát âm (Web Speech API).
- **A2** (rút gọn) Phím tắt `Alt+T` để dịch lựa chọn không cần popup.
- **B1** Quick save: 1 phím `S` lưu kèm câu gốc, URL, tiêu đề, timestamp.
- **B2** Knowledge state 5 trạng thái — đổi nhanh từ popup.
- **B4** Vocabulary dashboard: filter (state/deck/search), bulk action, drill-in chi tiết
  (lịch sử contexts, SRS info).
- **B5** Auto-deck theo domain + manual deck.
- **C1** SRS (SM-2): thuật toán đầy đủ, alarm kiểm tra mỗi giờ, notification gộp.
- **C2** Flashcard + Cloze + Mixed mode, hỗ trợ phím tắt 1-4 / Space.
- **E1** Local-first qua Dexie/IndexedDB — không có server.
- **E3** Export JSON / CSV, import lại JSON.
- **Stats**: heatmap 16 tuần, phân bố trạng thái, streak.
- **Onboarding**: 4 bước, có demo lưu thử.

## Để sau MVP (theo roadmap)

- A3 Paragraph translate, A4 Full-page, A5 Multi-engine
- B3 Highlight on-page (CSS Custom Highlight API)
- C3 Re-encounter mode
- D1-D4 AI features (BYOK)
- E2 Sync backend

## Quyền cần xin

- `storage` — IndexedDB + chrome.storage cho settings cache
- `contextMenus` — chuột phải để dịch / lưu
- `notifications`, `alarms` — nhắc ôn tập
- `<all_urls>` — content script chạy trên mọi trang

## Bảo mật & quyền riêng tư

- Toàn bộ kho từ vựng nằm trong IndexedDB của extension trên máy bạn.
- Văn bản được dịch sẽ qua `translate.googleapis.com` (Google Translate free tier, không cần
  API key, cũng được dùng bởi extension chính chủ).
- Không có analytics tracker bên thứ 3.
- Cache dịch tự xóa sau 7 ngày.
