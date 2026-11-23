// ===== "PEKERJA LATAR": membuat aplikasi tetap jalan tanpa internet =====
// Cara kerjanya: saat pertama dibuka (dengan internet), semua file disalin ke HP.
// Kalau nanti internet mati, file diambil dari salinan itu.

// Kalau Anda mengubah file aplikasi, naikkan angka versi ini (v1 -> v2)
// supaya HP mengambil salinan yang baru.
const CACHE = 'belajar-seru-v2';

const INTI = [
  './', 'index.html', 'gambar.html', 'kartu-hijaiyah.html',
  'manifest.json', 'icon-192.png', 'icon-512.png'
];

// File suara huruf (harus sama persis dengan nama di folder suara/)
const SUARA = [
  '001-alif', '002-ba', '003-taa', '004-tsa',
  '005-jeem', '006-haa', '007-khaa', '008-dal',
  '009-dhal', '010-raa', '011-zai', '012-seen',
  '013-sheen', '014-saad', '015-dhaad', '016-tha',
  '017-dhaa', '018-ain', '019-ghain', '020-faa',
  '021-qaaf', '022-kaaf', '023-laam', '024-meem',
  '025-noon', '026-waw', '027-ha', '028-hamza',
  '029-yaa'
].map((n) => 'suara/' + n + '.mp3');

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(INTI);
    // Suara disalin satu per satu; kalau ada yang belum ada, yang lain tetap aman.
    await Promise.all(SUARA.map((u) => cache.add(u).catch(() => {})));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const nama = await caches.keys();
    await Promise.all(nama.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Beberapa browser (misalnya Safari) meminta audio per potongan ("Range").
// Fungsi ini memotong file dari salinan supaya suara tetap bisa diputar offline.
async function potongan(cached, range) {
  const m = /bytes=(\d+)-(\d*)/.exec(range);
  if (!m) return cached;
  const buf = await cached.arrayBuffer();
  const awal = Number(m[1]);
  const akhir = m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(awal, akhir + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': 'bytes ' + awal + '-' + akhir + '/' + buf.byteLength,
      'Content-Length': String(akhir - awal + 1)
    }
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // Utamakan internet (supaya selalu versi terbaru), lalu simpan salinannya.
      const net = await fetch(req);
      if (net.status === 200) cache.put(req.url, net.clone());
      return net;
    } catch (err) {
      // Tidak ada internet: pakai salinan di HP.
      let cached = await cache.match(req.url, { ignoreSearch: true });
      if (!cached && req.mode === 'navigate') cached = await cache.match('index.html');
      if (!cached) return new Response('Tidak ada koneksi', { status: 503 });
      const range = req.headers.get('range');
      return range ? potongan(cached, range) : cached;
    }
  })());
});
