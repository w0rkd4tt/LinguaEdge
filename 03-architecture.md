# LinguaEdge - Kiến trúc kỹ thuật

## Nền tảng

- **Manifest V3** - chuẩn extension mới của Chromium (Edge, Chrome, Brave...)
- **Edge-first**: phát triển và thử nghiệm trên Microsoft Edge (Chromium-based), nhưng codebase 100% tương thích Chrome → publish lên cả Edge Add-ons store và Chrome Web Store cùng lúc
- **Firefox**: hỗ trợ ở pha 2 (cần adapter cho `browser.*` API)

## Các thành phần chính

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Edge/Chrome)                    │
│                                                               │
│  ┌──────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │ Content      │◄──►│ Service Worker  │◄──►│ Options /   │ │
│  │ Script       │    │ (background.js) │    │ Dashboard   │ │
│  │ (per tab)    │    │                 │    │ Page (SPA)  │ │
│  └──────┬───────┘    └────────┬────────┘    └──────┬──────┘ │
│         │                     │                    │         │
│         │                     ▼                    │         │
│         │          ┌────────────────────┐          │         │
│         └─────────►│  IndexedDB         │◄─────────┘         │
│                    │  (Dexie wrapper)    │                    │
│                    └────────────────────┘                    │
│                             │                                │
└─────────────────────────────┼────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
       ┌────────▼────────┐         ┌────────▼────────┐
       │ Translate APIs  │         │ Sync Backend    │
       │ - Google        │         │ (optional)      │
       │ - DeepL         │         │ Cloudflare      │
       │ - LLM (BYOK)    │         │ Workers + D1    │
       └─────────────────┘         └─────────────────┘
```

### 1. Content Script
- Inject vào mọi trang web
- Bắt sự kiện: text selection, hover, click
- Render UI nổi: popup dịch, tooltip, highlight overlay
- DOM manipulation cho highlight và full-page translate
- Shadow DOM để CSS không xung đột với trang gốc

### 2. Service Worker (background)
- Xử lý request gọi API dịch (tránh CORS issue)
- Quản lý cache dịch (LRU, TTL 7 ngày)
- Đẩy notification SRS
- Phối hợp giữa các tab

### 3. Storage layer
- **IndexedDB** qua wrapper [Dexie.js](https://dexie.org/) - dễ dùng hơn raw IDB
- **chrome.storage.sync** chỉ cho settings nhỏ (< 100KB)
- **chrome.storage.local** cho cache tạm

### 4. Options/Dashboard page
- React + Vite + TypeScript
- Chia 2 mode:
  - Options (settings nhỏ, mở từ icon extension)
  - Dashboard (full-page, truy cập qua `/dashboard.html` của extension)

---

## Schema dữ liệu

### Bảng `vocabulary`
```typescript
{
  id: string;              // uuid
  word: string;            // "diligent" (lowercase, trimmed)
  lemma: string;           // "diligent" (gốc - "ran" → "run")
  language: string;        // "en"
  state: 'new' | 'learning' | 'reviewing' | 'known' | 'ignored';
  meanings: Array<{
    partOfSpeech: string;  // "adj"
    definition: string;    // "showing care and effort..."
    translation: string;   // "siêng năng, cần cù"
  }>;
  pronunciation?: {
    ipa: string;           // "/ˈdɪlɪdʒənt/"
    audioUrl?: string;
  };
  contexts: Array<{
    sentence: string;      // "She is a diligent student."
    sourceUrl: string;
    sourceTitle: string;
    capturedAt: number;    // timestamp
  }>;
  decks: string[];         // deck IDs
  tags: string[];
  srs: {
    easeFactor: number;    // SM-2
    interval: number;      // ngày
    repetitions: number;
    nextReviewAt: number;  // timestamp
    lastReviewedAt?: number;
  };
  createdAt: number;
  updatedAt: number;
}
```

### Bảng `decks`
```typescript
{
  id: string;
  name: string;            // "BBC News" hoặc "IELTS Writing"
  type: 'auto' | 'manual';
  sourcePattern?: string;  // regex domain cho auto-deck
  color?: string;
  createdAt: number;
}
```

### Bảng `reviewSessions`
```typescript
{
  id: string;
  startedAt: number;
  endedAt?: number;
  cardsReviewed: number;
  correct: number;
  incorrect: number;
}
```

### Bảng `translationCache`
```typescript
{
  key: string;             // hash(sourceText + sourceLang + targetLang + engine)
  sourceText: string;
  translatedText: string;
  engine: string;
  cachedAt: number;
  ttl: number;
}
```

### Bảng `settings` (key-value)
```typescript
{
  key: string;
  value: any;
}
// keys ví dụ:
// "translateEngine.default": "google"
// "hover.enabled": true
// "hover.delayMs": 150
// "srs.algorithm": "sm2"
// "srs.dailyNewLimit": 10
```

---

## Performance considerations

### Hover/select translate phải cực nhanh
- Debounce 100ms cho hover, 0ms cho select
- Cache nóng trong memory (Map) cho 200 từ gần nhất
- Cache lạnh trong IndexedDB
- Chỉ gọi API khi cache miss

### Full-page translate không được lag
- Translate theo viewport - chỉ dịch những đoạn đang hiển thị + 1 viewport phía trên/dưới
- Lazy load khi scroll
- Batch các đoạn nhỏ vào 1 request (Google Translate cho phép array)

### Highlight không được làm chậm scroll
- Dùng `IntersectionObserver` thay vì scan toàn DOM
- Chỉ scan khi node mới vào viewport
- TreeWalker để duyệt text node hiệu quả
- Highlight bằng CSS Custom Highlight API (Chromium 105+) thay vì wrap span - tránh phá DOM gốc

---

## Bảo mật và quyền

### Permissions cần xin trong `manifest.json`
```json
{
  "permissions": [
    "storage",        // IndexedDB + chrome.storage
    "activeTab",      // chỉ truy cập tab hiện tại khi user tương tác
    "contextMenus",   // chuột phải để dịch/lưu
    "notifications",  // nhắc ôn tập
    "alarms"          // schedule SRS check
  ],
  "optional_permissions": [
    "tabs"            // chỉ khi user bật tính năng cross-tab
  ],
  "host_permissions": [
    "<all_urls>"      // bắt buộc cho content script
  ]
}
```

### Privacy
- Mặc định **KHÔNG** gửi dữ liệu trang web ra ngoài, trừ khi:
  - User chủ động chọn dịch (lúc đó text được dịch sẽ qua engine họ chọn)
  - User bật sync
- API key của user lưu trong `chrome.storage.local` (mã hóa nhẹ với key dẫn xuất từ user passphrase nếu họ đặt)
- Không có analytics tracker bên thứ 3 (không Google Analytics)
- Có thể gửi error report opt-in (Sentry self-hosted)

---

## Stack đề xuất

| Layer | Lựa chọn | Lý do |
|-------|----------|-------|
| Language | TypeScript | An toàn type, ecosystem mạnh |
| UI Framework | React 18 + Vite | Quen thuộc, build nhanh |
| State | Zustand | Nhẹ hơn Redux, đủ dùng |
| Storage wrapper | Dexie.js | API thân thiện trên IndexedDB |
| CSS | Tailwind CSS + Shadow DOM | Không xung đột trang gốc |
| Build | Vite + `@crxjs/vite-plugin` | HMR cho extension |
| Testing | Vitest + Playwright | Unit + E2E trong browser |
| SRS lib | `ts-fsrs` hoặc tự viết SM-2 | FSRS hiện đại hơn |
| i18n | `i18next` | UI tiếng Việt + tiếng Anh |

---

## Kiến trúc backend (cho sync, optional, pha 2)

Nếu/khi cần sync:
- **Cloudflare Workers** + **D1** (SQLite) hoặc **Turso** - rẻ, edge-distributed, đủ cho dữ liệu nhỏ
- Auth: **Clerk** hoặc tự build với JWT + Magic link
- Conflict resolution: last-write-wins ở mức từng từ, có version vector cho deck
- Free tier hào phóng, người dùng casual không cần trả phí
