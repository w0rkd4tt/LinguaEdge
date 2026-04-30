import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'LinguaEdge',
  short_name: 'LinguaEdge',
  description: 'Đọc → Dịch → Lưu → Ôn, không rời trang. Học từ vựng tiếng Anh trên mọi website.',
  version: pkg.version,
  icons: {
    16: 'public/icons/icon-16.png',
    32: 'public/icons/icon-32.png',
    48: 'public/icons/icon-48.png',
    128: 'public/icons/icon-128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'public/icons/icon-16.png',
      32: 'public/icons/icon-32.png',
    },
    default_title: 'LinguaEdge',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/content-script.ts'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],
  permissions: ['storage', 'contextMenus', 'notifications', 'alarms', 'scripting'],
  host_permissions: ['<all_urls>'],
  web_accessible_resources: [
    {
      resources: ['dashboard.html', 'welcome.html', 'public/icons/*'],
      matches: ['<all_urls>'],
    },
  ],
  commands: {
    'translate-selection': {
      suggested_key: { default: 'Alt+T', mac: 'Alt+T' },
      description: 'Dịch lựa chọn hiện tại',
    },
    'open-dashboard': {
      suggested_key: { default: 'Alt+Shift+D', mac: 'Alt+Shift+D' },
      description: 'Mở dashboard LinguaEdge',
    },
  },
});
