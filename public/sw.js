// アプリとしてインストールするための最小限のサービスワーカー。
// キャッシュはしない（常に最新のTimeTrackを表示するため）。
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
